import { describe, it, expect, vi } from 'vitest';
import { createRadioBrowserCatalogue, CatalogueError } from './radioBrowser.js';
import stationsES from './fixtures/stations-es.raw.json';

const ok = data => Promise.resolve({ ok: true, status: 200, json: async () => data });
const down = () => Promise.reject(new TypeError('Failed to fetch'));

describe('radioBrowser adapter', () => {
  it('fails over to the next host when one is unreachable', async () => {
    const fetch = vi.fn()
      .mockImplementationOnce(down)
      .mockImplementationOnce(() => ok([{ name: 'Spain', iso_3166_1: 'ES', stationcount: 3 }]));
    const catalogue = createRadioBrowserCatalogue({ fetch, hosts: ['a.example', 'b.example'] });

    await expect(catalogue.countries()).resolves.toEqual([{ code: 'ES', name: 'Spain', stationCount: 3 }]);
    expect(fetch.mock.calls[0][0]).toContain('https://a.example/json/countries');
    expect(fetch.mock.calls[1][0]).toContain('https://b.example/json/countries');
  });

  it('raises CatalogueError when every host fails, and retries on the next call', async () => {
    const fetch = vi.fn().mockImplementationOnce(down).mockImplementationOnce(() => ok([]));
    const catalogue = createRadioBrowserCatalogue({ fetch, hosts: ['a.example'] });

    await expect(catalogue.countries()).rejects.toBeInstanceOf(CatalogueError);
    await expect(catalogue.countries()).resolves.toEqual([]);
  });

  it('treats a non-2xx response as a failed host', async () => {
    const fetch = vi.fn()
      .mockImplementationOnce(() => ok(null).then(r => ({ ...r, ok: false, status: 503 })))
      .mockImplementationOnce(() => ok([]));
    const catalogue = createRadioBrowserCatalogue({ fetch, hosts: ['a.example', 'b.example'] });

    await expect(catalogue.countries()).resolves.toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('fetches the country list once and reuses it', async () => {
    const fetch = vi.fn(() => ok([{ name: 'Spain', iso_3166_1: 'ES', stationcount: 3 }]));
    const catalogue = createRadioBrowserCatalogue({ fetch, hosts: ['a.example'] });

    await catalogue.countries();
    await catalogue.countries();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('drops countries without an ISO code, a name or stations', async () => {
    const fetch = vi.fn(() => ok([
      { name: 'Spain', iso_3166_1: 'ES', stationcount: 3 },
      { name: 'Nowhere', iso_3166_1: '', stationcount: 9 },
      { name: 'Empty', iso_3166_1: 'XE', stationcount: 0 },
      { name: '', iso_3166_1: 'XX', stationcount: 1 },
    ]));
    const catalogue = createRadioBrowserCatalogue({ fetch, hosts: ['a.example'] });

    expect(await catalogue.countries()).toEqual([{ code: 'ES', name: 'Spain', stationCount: 3 }]);
  });

  it('asks the API for HTTPS stations and still filters http:// streams client-side', async () => {
    const fetch = vi.fn(() => ok(stationsES));
    const catalogue = createRadioBrowserCatalogue({ fetch, hosts: ['a.example'] });

    const stations = await catalogue.stationsIn('ES');
    const url = new URL(fetch.mock.calls[0][0]);
    expect(url.searchParams.get('is_https')).toBe('true');
    expect(url.searchParams.get('hidebroken')).toBe('true');
    expect(url.searchParams.get('countrycode')).toBe('ES');
    expect(stations.length).toBeLessThan(stationsES.length);
    expect(stations.every(s => s.stream.startsWith('https://'))).toBe(true);
  });

  it('normalises a raw station into the Station shape', async () => {
    const fetch = vi.fn(() => ok([{
      stationuuid: 'u1', name: '  Radio Uno ', countrycode: 'ES', country: 'Spain', state: 'Madrid',
      tags: 'pop, rock,,news', favicon: 'https://x/logo.png', url: 'https://x/a', url_resolved: 'https://x/b',
      bitrate: 128, codec: 'MP3', homepage: 'https://x',
    }]));
    const catalogue = createRadioBrowserCatalogue({ fetch, hosts: ['a.example'] });

    expect(await catalogue.stationsIn('ES')).toEqual([{
      id: 'u1', name: 'Radio Uno', country: 'ES', countryName: 'Spain', region: 'Madrid',
      tags: ['pop', 'rock', 'news'], logo: 'https://x/logo.png', stream: 'https://x/b',
      bitrate: 128, codec: 'MP3', homepage: 'https://x', hls: false, votes: 0,
    }]);
  });

  it('drops HLS streams, which a plain audio element cannot play', async () => {
    const fetch = vi.fn(() => ok([
      { stationuuid: 'a', name: 'Plain', countrycode: 'ES', url_resolved: 'https://x/a', hls: 0 },
      { stationuuid: 'b', name: 'Playlist', countrycode: 'ES', url_resolved: 'https://x/b.m3u8', hls: 1 },
    ]));
    const catalogue = createRadioBrowserCatalogue({ fetch, hosts: ['a.example'] });

    expect((await catalogue.stationsIn('ES')).map(s => s.id)).toEqual(['a']);
  });

  it('queries every raw spelling of a normalised region, exactly, and merges the results', async () => {
    const fetch = vi.fn(url => {
      const u = new URL(url);
      if (u.pathname === '/json/countries') return ok([{ name: 'Spain', iso_3166_1: 'ES', stationcount: 3 }]);
      if (u.pathname.startsWith('/json/states/')) return ok([{ name: 'Islas Baleares', stationcount: 2 }, { name: 'Illes Balears', stationcount: 1 }]);
      const state = u.searchParams.get('state');
      expect(u.searchParams.get('stateExact')).toBe('true');
      return ok([{ stationuuid: state, name: state, countrycode: 'ES', state, url_resolved: `https://x/${encodeURIComponent(state)}`, votes: state.length }]);
    });
    const catalogue = createRadioBrowserCatalogue({ fetch, hosts: ['a.example'] });

    expect(await catalogue.regionsIn('ES')).toEqual([{ name: 'Illes Balears', stationCount: 3 }]);
    const stations = await catalogue.stationsIn('ES', { region: 'Illes Balears' });
    expect(stations.map(s => s.id).sort()).toEqual(['Illes Balears', 'Islas Baleares']);
    expect(stations.every(s => s.region === 'Illes Balears')).toBe(true);
  });

  it('removes duplicate entries that share a stream URL, keeping the most voted', async () => {
    const fetch = vi.fn(() => ok([
      { stationuuid: 'a', name: 'Segura irratia', countrycode: 'ES', url_resolved: 'https://x/segura/', votes: 11 },
      { stationuuid: 'b', name: 'Segura irratia', countrycode: 'ES', url_resolved: 'https://x/segura', votes: 15 },
      { stationuuid: 'c', name: 'Other', countrycode: 'ES', url_resolved: 'https://x/other', votes: 1 },
    ]));
    const catalogue = createRadioBrowserCatalogue({ fetch, hosts: ['a.example'] });

    expect((await catalogue.stationsIn('ES')).map(s => s.id)).toEqual(['b', 'c']);
  });

  it('looks regions up by country name, not code, and only once per country', async () => {
    const fetch = vi.fn()
      .mockImplementationOnce(() => ok([{ name: 'Spain', iso_3166_1: 'ES', stationcount: 3 }]))
      .mockImplementationOnce(() => ok([{ name: 'Madrid', country: 'Spain', stationcount: 40 }]));
    const catalogue = createRadioBrowserCatalogue({ fetch, hosts: ['a.example'] });

    expect(await catalogue.regionsIn('ES')).toEqual([{ name: 'Madrid', stationCount: 40 }]);
    expect(await catalogue.regionsIn('ES')).toEqual([{ name: 'Madrid', stationCount: 40 }]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1][0]).toContain('/json/states/Spain/');
  });

  it('random picks use a varying offset so the API cache cannot repeat them', async () => {
    const fetch = vi.fn(() => ok(stationsES.filter(s => s.url_resolved.startsWith('https'))));
    const catalogue = createRadioBrowserCatalogue({ fetch, hosts: ['a.example'] });

    await catalogue.randomStation();
    await catalogue.randomStation();
    const offsets = fetch.mock.calls.map(([url]) => new URL(url).searchParams.get('offset'));
    expect(offsets.every(o => /^\d+$/.test(o))).toBe(true);
    expect(new URL(fetch.mock.calls[0][0]).searchParams.get('order')).toBe('random');
  });

  describe('with an http relay configured', () => {
    const relay = station => `/stream/${station.id}`;

    it('keeps http stations and stops asking the API for https only', async () => {
      const fetch = vi.fn(() => ok(stationsES));
      const catalogue = createRadioBrowserCatalogue({ fetch, hosts: ['a.example'], httpProxy: relay });

      const stations = await catalogue.stationsIn('ES');
      expect(new URL(fetch.mock.calls[0][0]).searchParams.has('is_https')).toBe(false);
      expect(stations.some(s => s.stream.startsWith('http://'))).toBe(true);
      expect(stations.every(s => /^https?:\/\//.test(s.stream) && !s.hls)).toBe(true);
    });

    it('streamFor hands http streams to the relay and leaves https ones alone', async () => {
      const fetch = vi.fn(() => ok({ ok: true, url: 'http://fresh/stream' }));
      const catalogue = createRadioBrowserCatalogue({ fetch, hosts: ['a.example'], httpProxy: relay });
      expect(await catalogue.streamFor({ id: 'u1', stream: 'http://known/stream' })).toBe('/stream/u1');

      const secure = createRadioBrowserCatalogue({ fetch: vi.fn(() => ok({ ok: true, url: 'https://fresh/stream' })), hosts: ['a.example'], httpProxy: relay });
      expect(await secure.streamFor({ id: 'u1', stream: 'http://known/stream' })).toBe('https://fresh/stream');
    });
  });

  it('searches by name and by tag inside the current country and region', async () => {
    const fetch = vi.fn(() => ok([]));
    const catalogue = createRadioBrowserCatalogue({ fetch, hosts: ['a.example'] });

    await catalogue.stationsIn('ES', { query: ' jazz ' });
    const params = fetch.mock.calls.map(([url]) => new URL(url).searchParams);
    expect(params.map(p => [p.get('name'), p.get('tag')])).toEqual([['jazz', null], [null, 'jazz']]);
    expect(params.every(p => p.get('countrycode') === 'ES')).toBe(true);
  });

  it('streamFor reports the play and falls back to the known stream when that fails', async () => {
    const station = { id: 'u1', stream: 'https://known/stream' };

    const fresh = createRadioBrowserCatalogue({ fetch: vi.fn(() => ok({ ok: true, url: 'https://fresh/stream' })), hosts: ['a.example'] });
    expect(await fresh.streamFor(station)).toBe('https://fresh/stream');

    const insecure = createRadioBrowserCatalogue({ fetch: vi.fn(() => ok({ ok: true, url: 'http://fresh/stream' })), hosts: ['a.example'] });
    expect(await insecure.streamFor(station)).toBe('https://known/stream');

    const offline = createRadioBrowserCatalogue({ fetch: vi.fn(down), hosts: ['a.example'] });
    expect(await offline.streamFor(station)).toBe('https://known/stream');
  });
});
