// Contract every catalogue adapter must honour. Runs against the recorded fixture;
// set LIVE=1 to also run it against the real Radio Browser API.

import { describe, it, expect } from 'vitest';
import { createFixtureCatalogue } from './fixture.js';
import { createRadioBrowserCatalogue } from './radioBrowser.js';

const adapters = [['fixture', createFixtureCatalogue()]];
if (import.meta.env.LIVE) adapters.push(['radio-browser (live)', createRadioBrowserCatalogue()]);

describe.each(adapters)('catalogue contract: %s', (_name, catalogue) => {
  it('lists countries with ISO codes, sorted by name', async () => {
    const countries = await catalogue.countries();
    expect(countries.length).toBeGreaterThan(0);
    for (const c of countries) {
      expect(c.code).toMatch(/^[A-Z]{2}$/);
      expect(c.name).toBeTruthy();
      expect(c.stationCount).toBeGreaterThan(0);
    }
    const names = countries.map(c => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('lists regions for a country, and none for an unknown code', async () => {
    const regions = await catalogue.regionsIn('ES');
    expect(regions.length).toBeGreaterThan(0);
    expect(regions[0]).toMatchObject({ name: expect.any(String), stationCount: expect.any(Number) });
    expect(await catalogue.regionsIn('ZZ')).toEqual([]);
  });

  it('returns only HTTPS stations of the requested country, in Station shape', async () => {
    const stations = await catalogue.stationsIn('ES');
    expect(stations.length).toBeGreaterThan(0);
    for (const s of stations) {
      expect(s.country).toBe('ES');
      expect(s.stream).toMatch(/^https:\/\//);
      expect(s).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        countryName: expect.any(String),
        region: expect.any(String),
        tags: expect.any(Array),
        logo: expect.any(String),
      });
    }
  });

  it('narrows stations by region', async () => {
    const stations = await catalogue.stationsIn('ES', { region: 'Madrid' });
    expect(stations.length).toBeGreaterThan(0);
    for (const s of stations) expect(s.region).toBe('Madrid');
  });

  it('picks a random playable station', async () => {
    const station = await catalogue.randomStation();
    expect(station.id).toBeTruthy();
    expect(station.stream).toMatch(/^https:\/\//);
  });

  it('resolves an HTTPS stream for a station', async () => {
    const [station] = await catalogue.stationsIn('ES');
    const url = await catalogue.streamFor(station);
    expect(url).toMatch(/^https:\/\//);
  });
});
