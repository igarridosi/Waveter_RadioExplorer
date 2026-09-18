import { describe, it, expect, vi } from 'vitest';
import { createPlayer, STALL_MS, WATCHDOG_MS, MAX_RECONNECTS } from './player.js';

// A minimal HTMLMediaElement stand-in: events, src, volume, and a play() we control.
function fakeAudio({ playResult = () => Promise.resolve() } = {}) {
  const el = new EventTarget();
  Object.assign(el, {
    src: '', volume: 1, muted: false, preload: '', ended: false,
    play: vi.fn(() => playResult()),
    pause: vi.fn(),
    load: vi.fn(),
    removeAttribute: vi.fn(name => { if (name === 'src') el.src = ''; }),
    fire: type => el.dispatchEvent(new Event(type)),
  });
  return el;
}

// A manual clock for the watchdog and the backoff timers.
function fakeClock() {
  let time = 0;
  const timers = new Map();
  let nextId = 1;
  const api = {
    now: () => time,
    setTimer: (fn, ms) => { const id = nextId++; timers.set(id, { fn, at: time + ms, every: null }); return id; },
    clearTimer: id => timers.delete(id),
    setInterval: (fn, ms) => { const id = nextId++; timers.set(id, { fn, at: time + ms, every: ms }); return id; },
    clearInterval: id => timers.delete(id),
    // Advance the clock, running whatever comes due, in order.
    async advance(ms) {
      const target = time + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        const [id, t] = due;
        time = t.at;
        if (t.every) t.at += t.every; else timers.delete(id);
        t.fn();
        await flush();
      }
      time = target;
    },
    pendingTimers: () => timers.size,
  };
  return api;
}

const station = { id: 'u1', name: 'Radio Uno', stream: 'https://x/stream' };
const flush = () => new Promise(r => setTimeout(r, 0));

function setup(audioOptions) {
  const audio = fakeAudio(audioOptions);
  const clock = fakeClock();
  const online = new EventTarget();
  const player = createPlayer({ createAudio: () => audio, ...clock, onlineEvents: online });
  return { audio, clock, player, online };
}

// Reaches 'playing': the element reports it and keeps reporting progress.
async function startPlaying({ audio, player }) {
  player.play(station, 'https://x/stream');
  await flush();
  audio.fire('playing');
}

describe('player', () => {
  it('starts idle with no station', () => {
    const { player } = setup();
    expect(player.getState()).toMatchObject({ status: 'idle', station: null, volume: 1, muted: false, reconnecting: false });
  });

  it('play() connects, then reports playing when the element does', async () => {
    const { audio, player } = setup();
    const seen = [];
    player.subscribe(s => seen.push(s.status));

    player.play(station, 'https://x/stream');
    expect(player.getState()).toMatchObject({ status: 'connecting', station });
    await flush();
    expect(audio.src).toBe('https://x/stream');
    expect(audio.play).toHaveBeenCalled();

    audio.fire('playing');
    expect(player.getState().status).toBe('playing');
    expect(seen).toEqual(['connecting', 'playing']);
  });

  it('reuses the same element across stations, and only loads the latest one', async () => {
    const audio = fakeAudio();
    const createAudio = vi.fn(() => audio);
    const player = createPlayer({ createAudio, ...fakeClock() });
    player.play(station, 'https://x/1');
    player.play({ ...station, id: 'u2' }, 'https://x/2');
    await flush();
    expect(createAudio).toHaveBeenCalledTimes(1);
    expect(audio.load).toHaveBeenCalledTimes(1);
    expect(audio.src).toBe('https://x/2');
    expect(player.getState().station.id).toBe('u2');
  });

  it('shows connecting while the stream URL is still resolving, then plays it', async () => {
    const { audio, player } = setup();
    let resolve;
    player.play(station, new Promise(r => { resolve = r; }));
    expect(player.getState()).toMatchObject({ status: 'connecting', station });
    expect(audio.play).not.toHaveBeenCalled();
    resolve('https://x/late');
    await flush();
    expect(audio.src).toBe('https://x/late');
    expect(audio.play).toHaveBeenCalled();
  });

  it('a stream URL that fails to resolve becomes an error', async () => {
    const { player } = setup();
    player.play(station, Promise.reject(new Error('offline')));
    await flush();
    expect(player.getState().status).toBe('error');
  });

  it('buffering after playing goes back to connecting, without reconnecting', async () => {
    const ctx = setup();
    await startPlaying(ctx);
    ctx.audio.fire('waiting');
    ctx.audio.fire('stalled');
    expect(ctx.player.getState()).toMatchObject({ status: 'connecting', reconnecting: false });
    expect(ctx.audio.load).toHaveBeenCalledTimes(1);
  });

  it('a rejected play() (autoplay blocked) asks the listener to press play, and does not loop', async () => {
    const { audio, player, clock } = setup({ playResult: () => Promise.reject(Object.assign(new Error('blocked'), { name: 'NotAllowedError' })) });
    player.play(station, 'https://x/stream');
    await flush();
    expect(player.getState()).toMatchObject({ status: 'error', error: 'Press play to start listening.' });
    await clock.advance(60000);
    expect(audio.play).toHaveBeenCalledTimes(1);
  });

  it('stop() releases the stream and returns to idle; a late error is ignored', async () => {
    const { audio, player, clock } = setup();
    player.play(station, 'https://x/stream');
    await flush();
    player.stop();
    expect(audio.pause).toHaveBeenCalled();
    expect(audio.removeAttribute).toHaveBeenCalledWith('src');
    expect(player.getState()).toMatchObject({ status: 'idle', station: null });
    audio.fire('error');
    audio.fire('pause');
    expect(player.getState().status).toBe('idle');
    expect(clock.pendingTimers()).toBe(0); // no watchdog left running
  });

  it('volume and mute mirror the element', () => {
    const { audio, player } = setup();
    player.setVolume(1.7);
    expect(audio.volume).toBe(1);
    player.setVolume(0.4);
    audio.fire('volumechange');
    expect(player.getState().volume).toBe(0.4);
    player.toggleMute();
    audio.fire('volumechange');
    expect(player.getState().muted).toBe(true);
    player.setVolume(0.5); // raising the volume unmutes
    expect(audio.muted).toBe(false);
  });

  it('unsubscribe stops notifications', () => {
    const { player } = setup();
    const fn = vi.fn();
    const off = player.subscribe(fn);
    off();
    player.play(station, 'https://x/stream');
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('player: keeping a live stream alive', () => {
  it('reconnects when the stream ends, and reports playing again', async () => {
    const ctx = setup();
    await startPlaying(ctx);
    ctx.audio.ended = true;
    ctx.audio.fire('ended');
    expect(ctx.player.getState()).toMatchObject({ status: 'connecting', reconnecting: true, station });

    await ctx.clock.advance(1000);
    expect(ctx.audio.load).toHaveBeenCalledTimes(2);
    expect(ctx.audio.play).toHaveBeenCalledTimes(2);
    ctx.audio.ended = false;
    ctx.audio.fire('playing');
    expect(ctx.player.getState()).toMatchObject({ status: 'playing', reconnecting: false });
  });

  it('reconnects when the element errors mid-stream', async () => {
    const ctx = setup();
    await startPlaying(ctx);
    ctx.audio.fire('error');
    expect(ctx.player.getState()).toMatchObject({ status: 'connecting', reconnecting: true });
    await ctx.clock.advance(1000);
    expect(ctx.audio.load).toHaveBeenCalledTimes(2);
  });

  it('reconnects when playback stops making progress, even without any event', async () => {
    const ctx = setup();
    await startPlaying(ctx);
    // Healthy: progress keeps arriving.
    for (let i = 0; i < 5; i++) { await ctx.clock.advance(WATCHDOG_MS); ctx.audio.fire('timeupdate'); }
    expect(ctx.audio.load).toHaveBeenCalledTimes(1);
    // Silent death: no progress at all.
    await ctx.clock.advance(STALL_MS + WATCHDOG_MS);
    expect(ctx.player.getState()).toMatchObject({ status: 'connecting', reconnecting: true });
    await ctx.clock.advance(1000);
    expect(ctx.audio.load).toHaveBeenCalledTimes(2);
  });

  it('backs off exponentially and gives up after MAX_RECONNECTS with a retry offered', async () => {
    const ctx = setup();
    await startPlaying(ctx);
    const delays = [1000, 2000, 4000, 8000, 16000, 30000];
    for (let i = 0; i < MAX_RECONNECTS; i++) {
      ctx.audio.fire('error');
      expect(ctx.player.getState().reconnecting).toBe(true);
      await ctx.clock.advance(delays[i] - 1);
      expect(ctx.audio.load).toHaveBeenCalledTimes(i + 1);
      await ctx.clock.advance(1);
      expect(ctx.audio.load).toHaveBeenCalledTimes(i + 2);
    }
    ctx.audio.fire('error');
    expect(ctx.player.getState()).toMatchObject({ status: 'error', reconnecting: false, error: expect.stringContaining('not responding') });

    ctx.player.resume(); // the retry button
    expect(ctx.player.getState().status).toBe('connecting');
    expect(ctx.audio.load).toHaveBeenCalledTimes(MAX_RECONNECTS + 2);
  });

  it('a successful reconnect resets the backoff', async () => {
    const ctx = setup();
    await startPlaying(ctx);
    ctx.audio.fire('error');
    await ctx.clock.advance(1000);
    ctx.audio.fire('error');
    await ctx.clock.advance(2000);
    ctx.audio.fire('playing'); // back on air
    ctx.audio.fire('error');
    await ctx.clock.advance(999);
    expect(ctx.audio.load).toHaveBeenCalledTimes(3);
    await ctx.clock.advance(1); // first-step delay again, not 4s
    expect(ctx.audio.load).toHaveBeenCalledTimes(4);
  });

  it('the network coming back skips the remaining backoff', async () => {
    const ctx = setup();
    await startPlaying(ctx);
    ctx.audio.fire('error');
    await ctx.clock.advance(1000);
    ctx.audio.fire('error'); // second failure: 2 s backoff
    ctx.online.dispatchEvent(new Event('online'));
    await flush();
    expect(ctx.audio.load).toHaveBeenCalledTimes(3);
  });

  it('ignores the AbortError of a play() that a reconnect replaced', async () => {
    let calls = 0;
    const ctx = setup({ playResult: () => (++calls === 1 ? new Promise(() => {}) : Promise.resolve()) });
    await startPlaying(ctx);
    ctx.audio.fire('error');
    await ctx.clock.advance(1000); // load() would abort the first play(): simulate that rejection now
    expect(ctx.audio.load).toHaveBeenCalledTimes(2);
    expect(ctx.player.getState().reconnecting).toBe(true);
    await ctx.clock.advance(10);
    expect(ctx.audio.load).toHaveBeenCalledTimes(2); // no extra attempt was queued
  });

  it('stop() during a backoff cancels the reconnect', async () => {
    const ctx = setup();
    await startPlaying(ctx);
    ctx.audio.fire('error');
    ctx.player.stop();
    await ctx.clock.advance(60000);
    expect(ctx.audio.play).toHaveBeenCalledTimes(1); // stop() itself calls load() to release the stream
    expect(ctx.player.getState().status).toBe('idle');
  });

  it('switching station during a backoff plays the new one, not the old', async () => {
    const ctx = setup();
    await startPlaying(ctx);
    ctx.audio.fire('error');
    ctx.player.play({ ...station, id: 'u2' }, 'https://x/2');
    await flush();
    await ctx.clock.advance(60000);
    expect(ctx.audio.src).toBe('https://x/2');
    expect(ctx.player.getState().station.id).toBe('u2');
  });

  it('a pause from the OS is kept as paused; resume() reconnects instead of playing stale buffer', async () => {
    const ctx = setup();
    await startPlaying(ctx);
    await ctx.clock.advance(5000);
    ctx.audio.fire('pause');
    expect(ctx.player.getState()).toMatchObject({ status: 'paused', station });
    await ctx.clock.advance(STALL_MS * 3); // the watchdog leaves a paused player alone
    expect(ctx.audio.load).toHaveBeenCalledTimes(1);

    ctx.player.resume();
    expect(ctx.player.getState().status).toBe('connecting');
    expect(ctx.audio.load).toHaveBeenCalledTimes(2);
  });

  it('a pause right after connecting is browser churn, not a person', async () => {
    const ctx = setup();
    await startPlaying(ctx);
    ctx.audio.fire('pause');
    expect(ctx.player.getState().status).toBe('playing');
  });
});
