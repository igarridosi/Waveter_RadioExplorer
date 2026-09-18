import PropTypes from 'prop-types';
import { Play, Stop, SpeakerHigh, SpeakerSlash, Heart, ArrowClockwise } from '@phosphor-icons/react';
import StationLogo from './StationLogo.jsx';

// Persistent bottom bar: what is playing, whether it is really playing, and the controls.
export default function PlayerBar({ player, saved, onToggleSave }) {
  const { station, status, error, volume, muted, reconnecting } = player;
  if (!station) return null;

  const place = station.region ? `${station.region}, ${station.countryName}` : station.countryName;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6 md:pb-5">
      <div
        key={station.id}
        role="region"
        aria-label="Now playing"
        className="anim-rise glass mx-auto grid max-w-[1400px] grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 rounded-[10px] p-3 md:grid-cols-[52px_minmax(0,1fr)_auto_auto] md:gap-4 md:p-4"
      >
        <StationLogo src={station.logo} size={52} />

        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-zinc-50 md:text-base">{station.name}</p>
          <p className="truncate text-xs text-zinc-400 md:text-sm">{place}</p>
          <Status status={status} error={error} reconnecting={reconnecting} />
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <button
            type="button"
            onClick={player.toggleMute}
            aria-label={muted ? 'Unmute' : 'Mute'}
            className="rounded-full p-2 text-zinc-300 transition-colors hover:bg-white/10 hover:text-zinc-50 active:scale-[0.96]"
          >
            {muted || volume === 0 ? <SpeakerSlash size={20} weight="bold" aria-hidden="true" /> : <SpeakerHigh size={20} weight="bold" aria-hidden="true" />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.02"
            value={muted ? 0 : volume}
            onChange={e => player.setVolume(Number(e.target.value))}
            aria-label="Volume"
            className="w-24"
          />
        </div>

        <div className="flex items-center gap-1.5 md:gap-2">
          <button
            type="button"
            onClick={() => onToggleSave(station)}
            aria-pressed={saved}
            aria-label={saved ? 'Remove from saved radios' : 'Save this radio'}
            className={`tap rounded-full p-2.5 ${saved ? 'text-signal' : 'text-zinc-300'}`}
          >
            <Heart size={22} weight={saved ? 'fill' : 'bold'} aria-hidden="true" />
          </button>
          {status === 'error' ? (
            <button
              type="button"
              onClick={player.resume}
              aria-label="Try again"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-50 text-zinc-950 transition-transform duration-100 active:scale-[0.94]"
            >
              <ArrowClockwise size={22} weight="bold" aria-hidden="true" />
            </button>
          ) : status === 'paused' ? (
            <button
              type="button"
              onClick={player.resume}
              aria-label="Play"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-50 text-zinc-950 transition-transform duration-100 active:scale-[0.94]"
            >
              <Play size={20} weight="fill" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={player.stop}
              aria-label="Stop"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-50 text-zinc-950 transition-transform duration-100 active:scale-[0.94]"
            >
              <Stop size={20} weight="fill" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Status({ status, error, reconnecting }) {
  if (status === 'playing') {
    return (
      <p className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-signal">
        <span className="anim-on-air inline-block h-2 w-2 rounded-full bg-signal" aria-hidden="true" />
        On air
      </p>
    );
  }
  if (status === 'connecting') {
    return <p className="mt-0.5 text-xs text-zinc-400">{reconnecting ? 'Reconnecting' : 'Connecting'}</p>;
  }
  if (status === 'paused') {
    return <p className="mt-0.5 text-xs text-zinc-400">Paused</p>;
  }
  if (status === 'error') {
    return <p className="mt-0.5 truncate text-xs text-signal" role="alert">{error}</p>;
  }
  return null;
}

Status.propTypes = { status: PropTypes.string.isRequired, error: PropTypes.string, reconnecting: PropTypes.bool };

PlayerBar.propTypes = {
  player: PropTypes.shape({
    station: PropTypes.object,
    status: PropTypes.string.isRequired,
    error: PropTypes.string,
    volume: PropTypes.number.isRequired,
    muted: PropTypes.bool.isRequired,
    reconnecting: PropTypes.bool,
    stop: PropTypes.func.isRequired,
    resume: PropTypes.func.isRequired,
    setVolume: PropTypes.func.isRequired,
    toggleMute: PropTypes.func.isRequired,
  }).isRequired,
  saved: PropTypes.bool.isRequired,
  onToggleSave: PropTypes.func.isRequired,
};
