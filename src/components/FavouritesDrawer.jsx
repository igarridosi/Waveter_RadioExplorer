import PropTypes from 'prop-types';
import { X, Heart } from '@phosphor-icons/react';
import Sheet from './Sheet.jsx';
import StationLogo from './StationLogo.jsx';

// The saved radios, in a sheet.
export default function FavouritesDrawer({ open, onClose, favourites, tunedId, onTune, onRemove }) {
  return (
    <Sheet open={open} onClose={onClose} title="Saved radios">
      {favourites.length === 0 ? (
        <div className="flex min-h-56 flex-col items-center justify-center gap-3 px-8 py-10 text-center text-sm text-zinc-400">
          <Heart size={28} weight="bold" aria-hidden="true" />
          Nothing saved yet. Tap the heart on a station you like and it will wait for you here.
        </div>
      ) : (
        <ul className="p-3">
          {favourites.map(station => {
            const tuned = station.id === tunedId;
            return (
              <li key={station.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onTune(station)}
                  aria-current={tuned ? 'true' : undefined}
                  className={`tap grid min-w-0 flex-1 grid-cols-[40px_1fr] items-center gap-3 rounded-[10px] px-2.5 py-2.5 text-left ${tuned ? 'bg-signal/12' : ''}`}
                >
                  <StationLogo src={station.logo} size={40} />
                  <span className="min-w-0">
                    <span className={`block truncate text-[15px] font-semibold ${tuned ? 'text-signal' : 'text-zinc-50'}`}>{station.name}</span>
                    <span className="block truncate text-xs text-zinc-400">{station.region ? `${station.region}, ${station.countryName}` : station.countryName}</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(station.id)}
                  aria-label={`Remove ${station.name}`}
                  className="tap rounded-full p-2.5 text-zinc-500 hover:text-zinc-50"
                >
                  <X size={18} weight="bold" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}

FavouritesDrawer.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  favourites: PropTypes.array.isRequired,
  tunedId: PropTypes.string,
  onTune: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
};
