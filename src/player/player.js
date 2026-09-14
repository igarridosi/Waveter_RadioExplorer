// The Player: one audio element for the whole session, and its status as data.
//
//   status: 'idle' | 'connecting' | 'playing' | 'error'
//   play(station, streamUrl) · stop() · setVolume(0..1) · toggleMute() · subscribe(fn)
//   (`streamUrl` may be a promise: the bar shows "connecting" while the URL resolves)
//
// The element is created once and reused, so switching stations never leaks
// an <audio> and the browser's autoplay permission carries over. The element
// factory is injectable so the state machine can be tested without a DOM.
//
// Deliberately no Web Audio (AnalyserNode): routing a cross-origin stream that
// lacks CORS headers through an AudioContext silences it, and most stations lack them.

export function createPlayer({ createAudio = () => new Audio() } = {}) {
  const audio = createAudio();
  audio.preload = 'none';

  let state = { status: 'idle', station: null, volume: 1, muted: false, error: null };
  const listeners = new Set();
  let attempt = 0;

  function set(patch) {
    state = { ...state, ...patch };
    listeners.forEach(fn => fn(state));
  }

  audio.addEventListener('playing', () => set({ status: 'playing', error: null }));
  audio.addEventListener('waiting', () => { if (state.station) set({ status: 'connecting' }); });
  audio.addEventListener('error', () => {
    if (!state.station) return; // clearing src on stop fires a harmless error
    set({ status: 'error', error: 'This station is not responding. Try another one.' });
  });
  audio.addEventListener('volumechange', () => set({ volume: audio.volume, muted: audio.muted }));

  function play(station, streamUrl) {
    const thisAttempt = ++attempt;
    set({ status: 'connecting', station, error: null });
    Promise.resolve(streamUrl).then(url => {
      if (thisAttempt !== attempt) return; // superseded by a newer play()/stop()
      audio.src = url;
      audio.load();
      const started = audio.play();
      if (started?.catch) {
        started.catch(err => {
          if (thisAttempt !== attempt) return;
          set({ status: 'error', error: err?.name === 'NotAllowedError' ? 'Press play to start listening.' : 'This station is not responding. Try another one.' });
        });
      }
    }, () => {
      if (thisAttempt !== attempt) return;
      set({ status: 'error', error: 'This station is not responding. Try another one.' });
    });
  }

  function resume() {
    if (!state.station) return;
    set({ status: 'connecting', error: null });
    audio.play()?.catch?.(() => set({ status: 'error', error: 'This station is not responding. Try another one.' }));
  }

  function stop() {
    attempt++;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    set({ status: 'idle', station: null, error: null });
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

  return { play, resume, stop, setVolume, toggleMute, subscribe, getState: () => state };
}
