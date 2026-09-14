import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { MagnifyingGlass, X } from '@phosphor-icons/react';

const DEBOUNCE_MS = 300;

// Keyword search over the stations of the current country and region (name or genre).
// Typing is local and instant; the tuner is asked once the listener pauses.
export default function StationSearch({ value, onSearch }) {
  const [text, setText] = useState(value);
  const timer = useRef(null);
  const inputRef = useRef(null);

  // The tuner cleared the query (country changed, random dial): mirror it.
  useEffect(() => { setText(value); }, [value]);

  useEffect(() => () => clearTimeout(timer.current), []);

  function change(next) {
    setText(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onSearch(next), DEBOUNCE_MS);
  }

  function submit(event) {
    event.preventDefault();
    clearTimeout(timer.current);
    onSearch(text);
    inputRef.current?.blur();
  }

  function clear() {
    clearTimeout(timer.current);
    setText('');
    onSearch('');
    inputRef.current?.focus();
  }

  return (
    <form role="search" onSubmit={submit} className="relative">
      <MagnifyingGlass size={20} weight="bold" aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
      <input
        ref={inputRef}
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
        aria-label="Search stations by name or genre"
        placeholder="Search stations by name or genre"
        value={text}
        onChange={e => change(e.target.value)}
        className="h-11 w-full appearance-none rounded-[10px] border border-white/10 bg-zinc-900/80 pl-11 pr-11 text-base text-zinc-50 placeholder:text-zinc-400 transition-[border-color,box-shadow] focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/40 [&::-webkit-search-cancel-button]:hidden"
      />
      {text && (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-50 active:scale-95"
        >
          <X size={18} weight="bold" aria-hidden="true" />
        </button>
      )}
    </form>
  );
}

StationSearch.propTypes = {
  value: PropTypes.string.isRequired,
  onSearch: PropTypes.func.isRequired,
};
