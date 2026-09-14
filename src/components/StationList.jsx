import PropTypes from 'prop-types';
import { SpeakerHigh, ArrowClockwise, WarningCircle } from '@phosphor-icons/react';
import StationLogo from './StationLogo.jsx';

// The stations of the current selection, with every state the tuner can be in.
export default function StationList({ stations, status, error, tunedId, hasCountry, hideRegion = false, onTune, onRetry }) {
  if (!hasCountry) {
    return (
      <Empty>
        Pick a country to see its stations, or spin the random dial.
      </Empty>
    );
  }
  if (status === 'loading') return <Skeleton />;
  if (status === 'error') {
    return (
      <Empty icon={<WarningCircle size={28} weight="bold" className="text-signal" aria-hidden="true" />}>
        <span>{error || 'Could not load these stations.'}</span>
        <button
          type="button"
          onClick={onRetry}
          className="tap mt-1 inline-flex h-11 items-center gap-2 rounded-full border border-white/15 px-4 text-sm font-semibold text-zinc-100"
        >
          <ArrowClockwise size={16} weight="bold" aria-hidden="true" />
          Try again
        </button>
      </Empty>
    );
  }
  if (stations.length === 0) {
    return <Empty>No stations stream over HTTPS here yet. Try another region.</Empty>;
  }

  return (
    <ul className="scroll-thin -mx-2 px-2 md:max-h-[52vh] md:overflow-y-auto" aria-label="Stations">
      {stations.map((station, i) => {
        const tuned = station.id === tunedId;
        return (
          <li key={station.id} className="anim-reveal" style={{ '--i': i }}>
            <button
              type="button"
              onClick={() => onTune(station)}
              aria-current={tuned ? 'true' : undefined}
              className={`tap grid w-full grid-cols-[44px_1fr_auto] items-center gap-3.5 rounded-[10px] px-2.5 py-2.5 text-left ${tuned ? 'bg-signal/12 ring-1 ring-signal/60' : ''}`}
            >
              <StationLogo src={station.logo} />
              <span className="min-w-0">
                <span className={`block truncate text-[15px] font-semibold ${tuned ? 'text-signal' : 'text-zinc-50'}`}>{station.name}</span>
                <span className="block truncate text-xs text-zinc-400">{meta(station, hideRegion)}</span>
              </span>
              {tuned && <SpeakerHigh size={20} weight="bold" className="text-signal" aria-label="Tuned" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// When the list is already filtered by region, repeating it on every row says nothing.
function meta(station, hideRegion) {
  const parts = station.region && !hideRegion ? [station.region, station.tags[0]] : station.tags.slice(0, 2);
  return parts.filter(Boolean).join(' · ') || station.countryName;
}

function Skeleton() {
  return (
    <ul className="space-y-1" aria-busy="true" aria-label="Loading stations">
      {Array.from({ length: 7 }, (_, i) => (
        <li key={i} className="grid grid-cols-[44px_1fr] items-center gap-3.5 px-2.5 py-2.5">
          <span className="h-11 w-11 animate-pulse rounded-[10px] bg-white/8" />
          <span className="space-y-2">
            <span className="block h-3.5 animate-pulse rounded bg-white/10" style={{ width: `${45 + ((i * 17) % 40)}%` }} />
            <span className="block h-2.5 animate-pulse rounded bg-white/6" style={{ width: `${30 + ((i * 23) % 35)}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function Empty({ icon, children }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-[10px] border border-dashed border-white/12 px-6 py-10 text-center text-sm text-zinc-400">
      {icon}
      {children}
    </div>
  );
}

Empty.propTypes = { icon: PropTypes.node, children: PropTypes.node };

StationList.propTypes = {
  stations: PropTypes.array.isRequired,
  status: PropTypes.oneOf(['idle', 'loading', 'ready', 'error']).isRequired,
  error: PropTypes.string,
  tunedId: PropTypes.string,
  hasCountry: PropTypes.bool.isRequired,
  hideRegion: PropTypes.bool,
  onTune: PropTypes.func.isRequired,
  onRetry: PropTypes.func.isRequired,
};
