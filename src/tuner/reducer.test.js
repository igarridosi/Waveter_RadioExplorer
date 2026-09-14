import { describe, it, expect } from 'vitest';
import { reducer, initialState, actions } from './reducer.js';

const madrid = { id: 'm1', name: 'Radio Madrid', country: 'ES', region: 'Madrid', stream: 'https://m/1' };
const sevilla = { id: 's1', name: 'Radio Sevilla', country: 'ES', region: 'Sevilla', stream: 'https://s/1' };
const tokyo = { id: 't1', name: 'Radio Tokyo', country: 'JP', region: '', stream: 'https://t/1' };

const run = (...list) => list.reduce(reducer, initialState);

describe('tuner reducer', () => {
  it('starts with nothing selected and countries loading', () => {
    expect(initialState.country).toBe('');
    expect(initialState.countriesStatus).toBe('loading');
    expect(initialState.stationsStatus).toBe('idle');
  });

  it('selecting a country clears region and stations and starts a load', () => {
    const s = run(actions.selectCountry('ES'));
    expect(s).toMatchObject({ country: 'ES', region: '', regions: [], stations: [], stationsStatus: 'loading', requestId: 1 });
  });

  it('clearing the country goes back to idle', () => {
    const s = run(actions.selectCountry('ES'), actions.selectCountry(''));
    expect(s).toMatchObject({ country: '', stationsStatus: 'idle', stations: [], requestId: 1 });
  });

  it('accepts stations only for the latest request', () => {
    const s = run(
      actions.selectCountry('ES'),   // requestId 1
      actions.selectCountry('JP'),   // requestId 2
      actions.stationsLoaded(1, [madrid], [{ name: 'Madrid', stationCount: 3 }]),
    );
    expect(s.stationsStatus).toBe('loading');
    expect(s.stations).toEqual([]);

    const done = reducer(s, actions.stationsLoaded(2, [tokyo], []));
    expect(done.stationsStatus).toBe('ready');
    expect(done.stations).toEqual([tokyo]);
  });

  it('selecting a region keeps the regions list and reloads stations', () => {
    const s = run(
      actions.selectCountry('ES'),
      actions.stationsLoaded(1, [madrid, sevilla], [{ name: 'Madrid', stationCount: 3 }]),
      actions.selectRegion('Madrid'),
      actions.stationsLoaded(2, [madrid]),
    );
    expect(s.region).toBe('Madrid');
    expect(s.regions).toEqual([{ name: 'Madrid', stationCount: 3 }]);
    expect(s.stations).toEqual([madrid]);
  });

  it('ignores a region without a country', () => {
    expect(run(actions.selectRegion('Madrid'))).toBe(initialState);
  });

  it('tuning a station from the current country does not reload', () => {
    const s = run(actions.selectCountry('ES'), actions.stationsLoaded(1, [madrid, sevilla], []), actions.tune(sevilla));
    expect(s.station).toBe(sevilla);
    expect(s.stationsStatus).toBe('ready');
    expect(s.requestId).toBe(1);
  });

  it('tuning a station from another country moves the selection there (random dial, favourites)', () => {
    const s = run(actions.selectCountry('ES'), actions.stationsLoaded(1, [madrid], []), actions.tune(tokyo));
    expect(s).toMatchObject({ station: tokyo, country: 'JP', region: '', stationsStatus: 'loading', requestId: 2 });

    const loaded = reducer(s, actions.stationsLoaded(2, [], []));
    expect(loaded.stations).toEqual([tokyo]); // kept visible even though the catalogue returned nothing
  });

  it('keeps the tuned station in the list when the catalogue did not return it', () => {
    const s = run(actions.selectCountry('ES'), actions.tune(sevilla), actions.stationsLoaded(1, [madrid], []));
    expect(s.stations).toEqual([sevilla, madrid]);
  });

  it('does not force the tuned station into a list from another region', () => {
    const s = run(
      actions.selectCountry('ES'),
      actions.tune(sevilla),
      actions.stationsLoaded(1, [madrid, sevilla], []),
      actions.selectRegion('Madrid'),
      actions.stationsLoaded(2, [madrid]),
    );
    expect(s.stations).toEqual([madrid]);
    expect(s.station).toBe(sevilla); // still playing, just not in this filtered list
  });

  it('records a failure for the latest request only, and retry reloads', () => {
    const failed = run(actions.selectCountry('ES'), actions.stationsFailed(1, 'boom'));
    expect(failed).toMatchObject({ stationsStatus: 'error', error: 'boom' });

    const retried = reducer(failed, actions.retry());
    expect(retried).toMatchObject({ stationsStatus: 'loading', error: null, requestId: 2 });

    const stale = reducer(retried, actions.stationsFailed(1, 'late'));
    expect(stale).toBe(retried);
  });

  it('searching reloads within the country and clears when the country changes', () => {
    const s = run(actions.selectCountry('ES'), actions.stationsLoaded(1, [madrid, sevilla], []), actions.search(' jazz '));
    expect(s).toMatchObject({ query: 'jazz', stationsStatus: 'loading', requestId: 2 });
    expect(reducer(s, actions.search('jazz'))).toBe(s); // same query, nothing to do

    const cleared = reducer(s, actions.search(''));
    expect(cleared).toMatchObject({ query: '', stationsStatus: 'loading', requestId: 3 });

    const other = reducer(s, actions.selectCountry('JP'));
    expect(other.query).toBe('');
    expect(run(actions.search('jazz'))).toBe(initialState); // no country yet
  });

  it('search results are not padded with the tuned station', () => {
    const s = run(actions.selectCountry('ES'), actions.tune(sevilla), actions.search('madrid'), actions.stationsLoaded(2, [madrid]));
    expect(s.stations).toEqual([madrid]);
    expect(s.station).toBe(sevilla);
  });

  it('records countries loading and failing', () => {
    expect(run(actions.countriesLoaded([{ code: 'ES' }]))).toMatchObject({ countriesStatus: 'ready', countries: [{ code: 'ES' }] });
    expect(run(actions.countriesFailed('offline'))).toMatchObject({ countriesStatus: 'error', error: 'offline' });
  });
});
