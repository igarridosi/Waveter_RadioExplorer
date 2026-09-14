// The Tuner: what the listener has selected and the verbs that change it.
//
// Pure. No React, no DOM, no network. Every way of arriving at a station
// (picking it from the list, the random dial, a favourite) goes through `tune`,
// so the three paths cannot disagree about what is selected.
//
// `requestId` tags every load the hook starts; responses carrying an older id
// are ignored, which is what makes fast country switching safe.

export const initialState = {
  countries: [],
  countriesStatus: 'loading', // 'loading' | 'ready' | 'error'
  country: '',                 // ISO code, '' when nothing is chosen
  region: '',                  // '' means "all regions"
  regions: [],
  stations: [],
  stationsStatus: 'idle',      // 'idle' | 'loading' | 'ready' | 'error'
  station: null,               // the tuned Station, independent of the list it came from
  error: null,
  requestId: 0,
};

export function reducer(state, action) {
  switch (action.type) {
    case 'countriesLoaded':
      return { ...state, countries: action.countries, countriesStatus: 'ready', error: null };

    case 'countriesFailed':
      return { ...state, countriesStatus: 'error', error: action.error };

    case 'selectCountry':
      if (!action.country) {
        return { ...state, country: '', region: '', regions: [], stations: [], stationsStatus: 'idle', error: null };
      }
      return startLoading({ ...state, country: action.country, region: '', regions: [] });

    case 'selectRegion':
      if (!state.country) return state;
      return startLoading({ ...state, region: action.region || '' });

    case 'stationsLoaded': {
      if (action.requestId !== state.requestId) return state;
      const stations = withTunedStation(action.stations, state.station, state.country, state.region);
      return { ...state, regions: action.regions ?? state.regions, stations, stationsStatus: 'ready', error: null };
    }

    case 'stationsFailed':
      if (action.requestId !== state.requestId) return state;
      return { ...state, stationsStatus: 'error', error: action.error };

    case 'tune': {
      const { station } = action;
      const sameCountry = station.country === state.country;
      const next = { ...state, station, error: null };
      if (sameCountry) {
        return { ...next, stations: withTunedStation(state.stations, station, state.country, state.region) };
      }
      // A station from elsewhere (random dial, favourite) moves the whole selection with it.
      return startLoading({ ...next, country: station.country, region: '', regions: [] });
    }

    case 'retry':
      return state.country ? startLoading(state) : state;

    default:
      return state;
  }
}

function startLoading(state) {
  return { ...state, stations: [], stationsStatus: 'loading', error: null, requestId: state.requestId + 1 };
}

// Keep the tuned station visible in the list it belongs to, even when it is not
// among the stations the catalogue returned (it may not be in the top N).
function withTunedStation(stations, station, country, region) {
  if (!station || station.country !== country) return stations;
  if (region && station.region !== region) return stations;
  if (stations.some(s => s.id === station.id)) return stations;
  return [station, ...stations];
}

// Action creators, so the hook and the tests speak the same language.
export const actions = {
  countriesLoaded: countries => ({ type: 'countriesLoaded', countries }),
  countriesFailed: error => ({ type: 'countriesFailed', error }),
  selectCountry: country => ({ type: 'selectCountry', country }),
  selectRegion: region => ({ type: 'selectRegion', region }),
  stationsLoaded: (requestId, stations, regions) => ({ type: 'stationsLoaded', requestId, stations, regions }),
  stationsFailed: (requestId, error) => ({ type: 'stationsFailed', requestId, error }),
  tune: station => ({ type: 'tune', station }),
  retry: () => ({ type: 'retry' }),
};
