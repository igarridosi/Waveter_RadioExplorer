import { useMemo, useSyncExternalStore } from 'react';
import { createPlayer } from './player.js';

let shared = null;

// One player per page. Components read its state through useSyncExternalStore,
// so a status change re-renders only what subscribed.
export function usePlayer() {
  const player = useMemo(() => (shared ??= createPlayer()), []);
  const state = useSyncExternalStore(player.subscribe, player.getState, player.getState);
  return { ...state, play: player.play, resume: player.resume, stop: player.stop, setVolume: player.setVolume, toggleMute: player.toggleMute };
}
