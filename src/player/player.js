// The Player: one audio element for the whole session, and its status as data.
//
//   status: 'idle' | 'connecting' | 'playing' | 'paused' | 'error'
//   play(station, streamUrl) · resume() · stop() · setVolume(0..1) · toggleMute() · subscribe(fn)
//   (`streamUrl` may be a promise: the bar shows "connecting" while the URL resolves)
//
// The element is created once and reused, so switching stations never leaks
// an <audio> and the browser's autoplay permission carries over. The element
// factory and the clock are injectable so the state machine is tested without a DOM.
//
// A live stream is a connection that will eventually break: the server drops a
// slow reader, the network blips, the phone changes network, the laptop sleeps.
// Browsers do not reconnect a media element on their own, so this player does:
// `ended`, `error`, a rejected play(), or STALL_MS without playback progress
// trigger a reconnect with exponential backoff while the listener still wants
// to hear the station. (`stalled`/`waiting` alone do not: Chrome fires them
// while there is still buffer to play; the progress watchdog is the judge.)
// A pause the listener did not ask for (lock-screen controls, unplugged
// headphones) is respected as `paused`; resume() reconnects the live stream.
//
// Deliberately no Web Audio (AnalyserNode): routing a cross-origin stream that
// lacks CORS headers through an AudioContext silences it, and most stations lack them.

export const STALL_MS = 8000;        // no progress for this long = the stream is dead
export const WATCHDOG_MS = 2000;     // how often progress is checked
export const MAX_RECONNECTS = 6;     // 1s, 2s, 4s, 8s, 16s, 30s, then give up
const BACKOFF_MAX_MS = 30000;

const NOT_RESPONDING = 'This station is not responding. Try another one.';

export function createPlayer({
  createAudio = () => new Audio(),
  now = () => Date.now(),
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = id => clearTimeout(id),
  setInterval: setTicker = (fn, ms) => setInterval(fn, ms),
  clearInterval: clearTicker = id => clearInterval(id),
  onlineEvents = typeof window !== 'undefined' ? window : null,
} = {}) {
  const audio = createAudio();
  audio.preload = 'none';

  let state = { status: 'idle', station: null, volume: 1, muted: false, error: null, reconnecting: false };
  const listeners = new Set();

  // What the listener asked for, independent of what the element is doing right now.
  let intent = null;          // { station, url, attempt } while they want to hear something
  let session = 0;            // bumped by play()/stop(); async work from an older session is ignored
  let generation = 0;         // bumped by every connect(); a play() promise from an older one is ignored
  let connectedAt = 0;        // when connect() last ran
  let lastProgress = 0;
  let reconnectTimer = null;
  let watchdog = null;

  function set(patch) {
    state = { ...state, ...patch };
    listeners.forEach(fn => fn(state));
  }

  // --- element events -------------------------------------------------------

  audio.addEventListener('playing', () => {
    if (!intent) return;
    lastProgress = now();
    intent.attempt = 0;
    set({ status: 'playing', error: null, reconnecting: false });
  });
  audio.addEventListener('timeupdate', () => { lastProgress = now(); });
  audio.addEventListener('waiting', () => { if (intent) set({ status: 'connecting' }); });
  audio.addEventListener('ended', () => scheduleReconnect());
  audio.addEventListener('pause', () => {
    // We never pause ourselves (stop() clears `intent` first), so this came from the
    // OS or the hardware. Keep the station, wait for resume().
    if (!intent || audio.ended) return;
    if (now() - connectedAt < 1000) return; // load()/play() churn right after connecting, not a person
    set({ status: 'paused', reconnecting: false });
  });
  audio.addEventListener('error', () => {
    if (!intent) return; // clearing src on stop fires a harmless error
    scheduleReconnect();
  });
  audio.addEventListener('volumechange', () => set({ volume: audio.volume, muted: audio.muted }));

  onlineEvents?.addEventListener?.('online', () => {
    // The network is back: do not wait out the backoff.
    if (intent && reconnectTimer !== null) { clearTimer(reconnectTimer); reconnectTimer = null; connect(); }
  });

  // --- connecting -----------------------------------------------------------

  function connect() {
    if (!intent) return;
    const thisGeneration = ++generation;
    connectedAt = lastProgress = now();
    audio.src = intent.url;   // load() aborts the previous play() with AbortError
    audio.load();
    audio.play()?.catch?.(err => {
      if (thisGeneration !== generation || !intent) return; // an older attempt, already replaced
      if (err?.name === 'AbortError') return;
      if (err?.name === 'NotAllowedError') {
        // Autoplay policy: only a gesture can fix this, so do not loop on it.
        set({ status: 'error', error: 'Press play to start listening.', reconnecting: false });
        return;
      }
      scheduleReconnect();
    });
  }

  function scheduleReconnect() {
    if (!intent || reconnectTimer !== null) return;
    if (state.status === 'paused') return;
    if (intent.attempt >= MAX_RECONNECTS) {
      set({ status: 'error', error: NOT_RESPONDING, reconnecting: false });
      return;
    }
    const delay = Math.min(BACKOFF_MAX_MS, 1000 * 2 ** intent.attempt);
    intent.attempt += 1;
    set({ status: 'connecting', error: null, reconnecting: true });
    const thisSession = session;
    reconnectTimer = setTimer(() => {
      reconnectTimer = null;
      if (thisSession === session) connect();
    }, delay);
  }

  function startWatchdog() {
    stopWatchdog();
    watchdog = setTicker(() => {
      if (!intent || reconnectTimer !== null) return;
      if (state.status === 'error' || state.status === 'paused') return;
      if (now() - lastProgress > STALL_MS) scheduleReconnect();
    }, WATCHDOG_MS);
  }

  function stopWatchdog() {
    if (watchdog !== null) { clearTicker(watchdog); watchdog = null; }
  }

  function clearPending() {
    if (reconnectTimer !== null) { clearTimer(reconnectTimer); reconnectTimer = null; }
  }

  // --- public verbs ---------------------------------------------------------

  function play(station, streamUrl) {
    const thisSession = ++session;
    clearPending();
    intent = { station, url: null, attempt: 0 };
    set({ status: 'connecting', station, error: null, reconnecting: false });
    Promise.resolve(streamUrl).then(url => {
      if (thisSession !== session || !intent) return; // superseded by a newer play()/stop()
      intent.url = url;
      startWatchdog();
      connect();
    }, () => {
      if (thisSession !== session || !intent) return;
      set({ status: 'error', error: NOT_RESPONDING, reconnecting: false });
    });
  }

  function resume() {
    if (!intent?.url) return;
    clearPending();
    intent.attempt = 0;
    set({ status: 'connecting', error: null, reconnecting: false });
    startWatchdog();
    connect();
  }

  function stop() {
    session++;
    clearPending();
    stopWatchdog();
    intent = null;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    set({ status: 'idle', station: null, error: null, reconnecting: false });
  }

  function setVolume(volume) {
    audio.volume = Math.min(1, Math.max(0, volume));
    if (audio.volume > 0 && audio.muted) audio.muted = false;
  }

  function toggleMute() {
    audio.muted = !audio.muted;
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  // `element` is exposed for diagnostics only (dev console); the UI never touches it.
  return { play, resume, stop, setVolume, toggleMute, subscribe, getState: () => state, element: audio };
}
