import { useMemo } from 'react';
import PropTypes from 'prop-types';
import SearchCombobox from './SearchCombobox.jsx';
import StationList from './StationList.jsx';

// The console: country, optional region, stations.
export default function Tuner({ tuner, onTune }) {
  const { countries, countriesStatus, country, region, regions, stations, stationsStatus, error, station } = tuner;

  const countryItems = useMemo(() => countries.map(c => ({ value: c.code, label: c.name, count: c.stationCount })), [countries]);
  const regionItems = useMemo(() => regions.map(r => ({ value: r.name, label: r.name, count: r.stationCount })), [regions]);

  const countryPlaceholder = countriesStatus === 'loading' ? 'Loading countries' : countriesStatus === 'error' ? 'Catalogue unavailable' : 'Search a country';

  return (
    <section aria-label="Tune a station" className="glass rounded-[10px] p-4 md:p-6">
      <SearchCombobox
        id="country"
        label="Country"
        items={countryItems}
        value={country}
        onChange={tuner.selectCountry}
        disabled={countriesStatus !== 'ready'}
        placeholder={countryPlaceholder}
      />

      {country && regions.length > 0 && (
        <div className="mt-4 md:mt-5">
          <p className="mb-2 text-sm font-semibold text-zinc-300" id="region-label">Region</p>
          <div className="flex items-center gap-2" role="group" aria-labelledby="region-label">
            <button
              type="button"
              aria-pressed={region === ''}
              onClick={() => tuner.selectRegion('')}
              className={`h-11 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors active:scale-[0.97] ${region === '' ? 'bg-zinc-50 text-zinc-950' : 'border border-white/12 text-zinc-300 hover:bg-white/8 hover:text-zinc-50'}`}
            >
              All
            </button>
            <SearchCombobox
              id="region"
              items={regionItems}
              value={region}
              onChange={tuner.selectRegion}
              placeholder={`Search ${regions.length} regions`}
              size="sm"
            />
          </div>
        </div>
      )}

      <div className="mt-4 md:mt-5">
        <StationList
          stations={stations}
          status={stationsStatus}
          error={error}
          tunedId={station?.id}
          hasCountry={Boolean(country)}
          hideRegion={Boolean(region)}
          onTune={onTune}
          onRetry={tuner.retry}
        />
      </div>
    </section>
  );
}

Tuner.propTypes = {
  tuner: PropTypes.object.isRequired,
  onTune: PropTypes.func.isRequired,
};
