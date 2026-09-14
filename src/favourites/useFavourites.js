import { useCallback, useEffect, useState } from 'react';

// Favourites ("Saved radios"): stations the listener keeps across sessions.
// Keyed by station id. This is the only place that touches localStorage.
const KEY = 'savedRadios';

function read() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    // Entries from the radio.garden era have no `stream`; they cannot be played anymore.
    return Array.isArray(list) ? list.filter(s => s && typeof s.id === 'string' && typeof s.stream === 'string') : [];
  } catch {
    return [];
  }
}

function write(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // storage full or blocked: favourites just do not survive the session
  }
}

export function useFavourites() {
  const [list, setList] = useState([]);

  useEffect(() => { setList(read()); }, []);

  const has = useCallback(id => list.some(s => s.id === id), [list]);

  const toggle = useCallback(station => {
    setList(current => {
      const next = current.some(s => s.id === station.id)
        ? current.filter(s => s.id !== station.id)
        : [...current, station];
      write(next);
      return next;
    });
  }, []);

  const remove = useCallback(id => {
    setList(current => {
      const next = current.filter(s => s.id !== id);
      write(next);
      return next;
    });
  }, []);

  return { list, has, toggle, remove };
}
