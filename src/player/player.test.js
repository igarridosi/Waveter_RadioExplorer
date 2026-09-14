import { describe, it, expect, vi } from 'vitest';
import { createPlayer } from './player.js';

// A minimal HTMLMediaElement stand-in: events, src, volume, and a play() we control.
function fakeAudio({ playResult = Promise.resolve() } = {}) {
  const el = new EventTarget();
  Object.assign(el, {
    src: '', volume: 1, muted: false, preload: '',
    play: vi.fn(() => playResult),
    pause: vi.fn(),
    load: vi.fn(),
    removeAttribute: vi.fn(name => { if (name === 'src') el.src = ''; }),
    fire: type => el.dispatchEvent(new Event(type)),
  });
  return el;
}

const station = { id: 'u1', name: 'Radio Uno', stream: 'https://x/stream' };
const flush = () => new Promise(r => setTimeout(r, 0));

describe('player', () => {
  it('starts idle with no station', () => {
    const player = createPlayer({ createAudio: fakeAudio });
    expect(player.getState()).toMatchObject({ status: 'idle', station: null, volume: 1, muted: false });
  });

  it('play() connects, then reports playing when the element does', async () => {
    const audio = fakeAudio();
    const player = createPlayer({ createAudio: () => audio });
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
    const player = createPlayer({ createAudio });
    player.play(station, 'https://x/1');
    player.play({ ...station, id: 'u2' }, 'https://x/2');
    await flush();
    expect(createAudio).toHaveBeenCalledTimes(1);
    expect(audio.load).toHaveBeenCalledTimes(1);
    expect(audio.src).toBe('https://x/2');
    expect(player.getState().station.id).toBe('u2');
  });

  it('shows connecting while the stream URL is still resolving, then plays it', async () => {
    const audio = fakeAudio();
    const player = createPlayer({ createAudio: () => audio });
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
    const player = createPlayer({ createAudio: fakeAudio });
    player.play(station, Promise.reject(new Error('offline')));
    await flush();
    expect(player.getState().status).toBe('error');
  });

  it('buffering after playing goes back to connecting', async () => {
    const audio = fakeAudio();
    const player = createPlayer({ createAudio: () => audio });
    player.play(station, 'https://x/stream');
    await flush();
    audio.fire('playing');
    audio.fire('waiting');
    expect(player.getState().status).toBe('connecting');
  });

  it('an element error becomes an error status with a message', () => {
    const audio = fakeAudio();
    const player = createPlayer({ createAudio: () => audio });
    player.play(station, 'https://x/stream');
    audio.fire('error');
    expect(player.getState()).toMatchObject({ status: 'error', station, error: expect.stringContaining('not responding') });
  });

  it('a rejected play() (autoplay blocked) asks the listener to press play', async () => {
    const audio = fakeAudio({ playResult: Promise.reject(Object.assign(new Error('blocked'), { name: 'NotAllowedError' })) });
    const player = createPlayer({ createAudio: () => audio });
    player.play(station, 'https://x/stream');
    await flush();
    expect(player.getState()).toMatchObject({ status: 'error', error: 'Press play to start listening.' });
  });

  it('ignores the rejection of a play() that was superseded', async () => {
    let reject;
    const audio = fakeAudio({ playResult: new Promise((_, r) => { reject = r; }) });
    const player = createPlayer({ createAudio: () => audio });
    player.play(station, 'https://x/1');
    await flush();
    player.stop();
    reject(new Error('aborted'));
    await flush();
    expect(player.getState().status).toBe('idle');
  });

  it('stop() releases the stream and returns to idle; a late error is ignored', async () => {
    const audio = fakeAudio();
    const player = createPlayer({ createAudio: () => audio });
    player.play(station, 'https://x/stream');
    await flush();
    player.stop();
    expect(audio.pause).toHaveBeenCalled();
    expect(audio.removeAttribute).toHaveBeenCalledWith('src');
    expect(player.getState()).toMatchObject({ status: 'idle', station: null });
    audio.fire('error');
    expect(player.getState().status).toBe('idle');
  });

  it('resume() retries the current station without changing it', async () => {
    const audio = fakeAudio();
    const player = createPlayer({ createAudio: () => audio });
    player.play(station, 'https://x/stream');
    await flush();
    audio.fire('error');
    player.resume();
    expect(audio.play).toHaveBeenCalledTimes(2);
    expect(player.getState()).toMatchObject({ status: 'connecting', station });
  });

  it('volume and mute mirror the element', () => {
    const audio = fakeAudio();
    const player = createPlayer({ createAudio: () => audio });
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
    const audio = fakeAudio();
    const player = createPlayer({ createAudio: () => audio });
    const fn = vi.fn();
    const off = player.subscribe(fn);
    off();
    player.play(station, 'https://x/stream');
    expect(fn).not.toHaveBeenCalled();
  });
});
