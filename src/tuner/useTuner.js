import { useReducer, useEffect, useCallback } from 'react';
import { reducer, initialState, actions } from './reducer.js';

// Wires the Tuner reducer to a catalogue. All the decisions live in the reducer;
// this hook only turns state changes into catalogue calls and calls into actions.
export function useTuner(catalogue) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { country, region, query, requestId } = state;

  useEffect(() => {
    let cancelled = false;
    catalogue.countries()
      .then(countries => { if (!cancelled) dispatch(actions.countriesLoaded(countries)); })
      .catch(error => { if (!cancelled) dispatch(actions.countriesFailed(describe(error))); });
    return () => { cancelled = true; };
  }, [catalogue]);

  useEffect(() => {
    if (!country || requestId === 0) return;
    let cancelled = false;
    Promise.all([
      region ? null : catalogue.regionsIn(country),
      catalogue.stationsIn(country, { ...(region ? { region } : {}), ...(query ? { query } : {}) }),
    ])
      .then(([regions, stations]) => {
        if (!cancelled) dispatch(actions.stationsLoaded(requestId, stations, regions ?? undefined));
      })
      .catch(error => {
        if (!cancelled) dispatch(actions.stationsFailed(requestId, describe(error)));
      });
    return () => { cancelled = true; };
  }, [catalogue, country, region, query, requestId]);

  const selectCountry = useCallback(code => dispatch(actions.selectCountry(code)), []);
  const selectRegion = useCallback(name => dispatch(actions.selectRegion(name)), []);
  const search = useCallback(query => dispatch(actions.search(query)), []);
  const tune = useCallback(station => dispatch(actions.tune(station)), []);
  const retry = useCallback(() => dispatch(actions.retry()), []);

  const tuneRandom = useCallback(async () => {
    const station = await catalogue.randomStation();
    dispatch(actions.tune(station));
    return station;
  }, [catalogue]);

  return { ...state, selectCountry, selectRegion, search, tune, tuneRandom, retry };
}

function describe(error) {
  return error?.message || 'Something went wrong';
}
