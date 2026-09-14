import { useEffect, useId, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { MagnifyingGlass, X } from '@phosphor-icons/react';

const MAX_VISIBLE = 40;

// Searchable single-select. Type to filter, arrows to move, Enter to choose, Escape to close.
// `items` are { value, label, count? }; `value` '' means nothing chosen.
export default function SearchCombobox({ id: givenId, label, items, value, onChange, disabled = false, placeholder, size = 'md' }) {
  const generatedId = useId();
  const id = givenId || generatedId;
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const selected = useMemo(() => items.find(i => i.value === value) || null, [items, value]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  // When the selection changes from outside (random dial, favourite), show its label.
  useEffect(() => { setQuery(selected ? selected.label : ''); }, [selected]);

  const matches = useMemo(() => {
    const q = fold(query);
    const list = q ? items.filter(i => fold(i.label).includes(q)) : items;
    return list.slice(0, MAX_VISIBLE);
  }, [items, query]);

  useEffect(() => { setActive(0); }, [matches]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  function choose(item) {
    onChange(item.value);
    setQuery(item.label);
    setOpen(false);
    inputRef.current?.blur();
  }

  function clear() {
    onChange('');
    setQuery('');
    setOpen(false);
    inputRef.current?.focus();
  }

  function onKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive(i => Math.min(i + 1, matches.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(i => Math.max(i - 1, 0));
    } else if (event.key === 'Enter' && open && matches[active]) {
      event.preventDefault();
      choose(matches[active]);
    } else if (event.key === 'Escape') {
      setOpen(false);
      setQuery(selected ? selected.label : '');
    }
  }

  const height = size === 'sm' ? 'h-11' : 'h-12';

  return (
    <div className="relative min-w-0 flex-1">
      {label && (
        <label htmlFor={`${id}-input`} className="mb-2 block text-sm font-semibold text-zinc-300">
          {label}
        </label>
      )}
      <div className="relative">
        <MagnifyingGlass size={20} weight="bold" aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          ref={inputRef}
          id={`${id}-input`}
          type="text"
          role="combobox"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          enterKeyHint="done"
          aria-label={label ? undefined : placeholder}
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-activedescendant={open && matches[active] ? `${id}-opt-${active}` : undefined}
          aria-autocomplete="list"
          disabled={disabled}
          placeholder={placeholder}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          className={`${height} w-full rounded-[10px] border border-white/10 bg-zinc-900/80 pl-11 pr-11 text-base text-zinc-50 placeholder:text-zinc-400 transition-[border-color,box-shadow] focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/40 disabled:opacity-60`}
        />
        {selected && (
          <button
            type="button"
            onClick={clear}
            aria-label={`Clear ${label ? label.toLowerCase() : 'selection'}`}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-50 active:scale-95"
          >
            <X size={18} weight="bold" aria-hidden="true" />
          </button>
        )}
      </div>

      {open && !disabled && (
        <ul
          ref={listRef}
          id={`${id}-list`}
          role="listbox"
          className="scroll-thin absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-[10px] border border-white/10 bg-zinc-900 py-1 shadow-2xl shadow-black/60"
        >
          {matches.length === 0 && (
            <li className="px-4 py-3 text-sm text-zinc-400">Nothing matches “{query.trim()}”</li>
          )}
          {matches.map((item, i) => (
            <li
              key={item.value}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={item.value === value}
              onPointerDown={e => e.preventDefault()}
              onClick={() => choose(item)}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-baseline justify-between gap-3 px-4 py-2.5 text-[15px] ${i === active ? 'bg-white/10 text-zinc-50' : 'text-zinc-200'} ${item.value === value ? 'font-semibold text-signal' : ''}`}
            >
              <span className="truncate">{item.label}</span>
              {item.count != null && <span className="shrink-0 text-xs tabular-nums text-zinc-500">{item.count}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Accent- and case-insensitive matching, so "andalucia" finds "Andalucía".
function fold(text) {
  return text.normalize('NFD').replace(/[^\w\s]/g, '').toLowerCase().trim();
}

SearchCombobox.propTypes = {
  id: PropTypes.string,
  label: PropTypes.string,
  items: PropTypes.arrayOf(PropTypes.shape({ value: PropTypes.string.isRequired, label: PropTypes.string.isRequired, count: PropTypes.number })).isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  placeholder: PropTypes.string.isRequired,
  size: PropTypes.oneOf(['sm', 'md']),
};
