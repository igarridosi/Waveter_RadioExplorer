// Catalogue adapter for Radio Browser (https://api.radio-browser.info).
//
// Everything provider-specific lives here: hosts and failover, query parameters,
// the raw response shapes, the HTTPS-only policy and the country code <-> name
// mapping the API needs. The rest of the app only ever sees Country, Region and
// Station objects (see index.js for the shapes).

import { normalizeRegions, displayRegion } from './regions.js';

const DEFAULT_HOSTS = ['all.api.radio-browser.info', 'de1.api.radio-browser.info'];

// Radio Browser has no pagination; a country like the US has >10k stations.
// We ask for the most voted ones and let the region filter narrow further.
const STATION_LIMIT = 300;

// Comfortably below the number of playable stations, so a random offset never runs past the end.
const RANDOM_OFFSET_RANGE = 20000;

export class CatalogueError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'CatalogueError';
  }
}

// `httpProxy(station)` returns a same-origin URL that relays the station's http:// stream.
// Without it, only https:// streams are playable (the site is served over HTTPS).
export function createRadioBrowserCatalogue({ fetch = globalThis.fetch?.bind(globalThis), hosts = DEFAULT_HOSTS, httpProxy = null } = {}) {
  let countriesPromise = null;
  const countryNames = new Map();
  const regionsByCountry = new Map(); // code -> Promise<Region[]> (with raw variants)

  async function get(path, params = {}) {
    const query = new URLSearchParams({ hidebroken: 'true', ...params }).toString();
    let lastError;
    for (const host of hosts) {
      try {
        const response = await fetch(`https://${host}${path}?${query}`, { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error(`${host} responded ${response.status}`);
        return await response.json();
      } catch (error) {
        lastError = error;
      }
    }
    throw new CatalogueError('The station catalogue is unreachable', { cause: lastError });
  }

  async function countries() {
    countriesPromise ??= get('/json/countries', { order: 'name' })
      .then(list => list.filter(c => c.iso_3166_1 && c.name && c.stationcount > 0).map(toCountry).sort(byName))
      .catch(error => {
        countriesPromise = null; // let the next call retry
        throw error;
      });
    const list = await countriesPromise;
    for (const country of list) countryNames.set(country.code, country.name);
    return list;
  }

  function loadRegions(countryCode) {
    if (!regionsByCountry.has(countryCode)) {
      const promise = countries().then(async () => {
        const name = countryNames.get(countryCode);
        if (!name) return [];
        const list = await get(`/json/states/${encodeURIComponent(name)}/`, { order: 'stationcount', reverse: 'true' });
        return normalizeRegions(list, { countryName: name, countryCode });
      });
      promise.catch(() => regionsByCountry.delete(countryCode));
      regionsByCountry.set(countryCode, promise);
    }
    return regionsByCountry.get(countryCode);
  }

  async function regionsIn(countryCode) {
    const regions = await loadRegions(countryCode);
    return regions.map(({ name, stationCount }) => ({ name, stationCount }));
  }

  const playable = station => isPlayable(station, Boolean(httpProxy));
  const secure = httpProxy ? {} : { is_https: 'true' };

  // `query` matches station names (substring) and tags (exact), both server-side.
  async function stationsIn(countryCode, { region, query } = {}) {
    const base = { countrycode: countryCode, ...secure, order: 'votes', reverse: 'true', limit: String(STATION_LIMIT) };
    let scopes = [base];
    if (region) {
      // One normalised region stands for every raw spelling contributors used.
      const known = (await loadRegions(countryCode)).find(r => r.name === region);
      const variants = known ? known.variants : [region];
      scopes = variants.map(state => ({ ...base, state, stateExact: 'true' }));
    }
    const q = (query || '').trim();
    const queries = q ? scopes.flatMap(s => [{ ...s, name: q }, { ...s, tag: q }]) : scopes;
    const lists = await Promise.all(queries.map(params => get('/json/stations/search', params)));
    return dedupe(lists.flat().map(toStation).filter(playable))
      .sort((a, b) => b.votes - a.votes)
      .slice(0, STATION_LIMIT)
      .map(station => region ? { ...station, region } : station);
  }

  async function randomStation() {
    // `order=random` is resolved server-side, so we never download a whole country to pick one.
    // The API caches responses per URL, so an identical query returns the same "random"
    // station for a while; a random offset makes every spin a different query.
    const offset = String(Math.floor(Math.random() * RANDOM_OFFSET_RANGE));
    const list = await get('/json/stations/search', { ...secure, order: 'random', limit: '5', offset });
    const station = list.map(toStation).find(playable);
    if (!station) throw new CatalogueError('No playable station was returned');
    return station;
  }

  async function streamFor(station) {
    // Radio Browser asks clients to report plays through this endpoint; it also
    // returns the freshest stream URL. Fall back to what we already know.
    let stream = station.stream;
    try {
      const result = await get(`/json/url/${encodeURIComponent(station.id)}`);
      if (typeof result?.url === 'string' && (result.url.startsWith('https://') || (httpProxy && result.url.startsWith('http://')))) stream = result.url;
    } catch {
      // counting the click is best-effort
    }
    // http:// would be blocked as mixed content: hand it to the relay instead.
    return stream.startsWith('http://') && httpProxy ? httpProxy(station) : stream;
  }

  return { countries, regionsIn, stationsIn, randomStation, streamFor };
}

function toCountry(raw) {
  return { code: raw.iso_3166_1, name: raw.name, stationCount: raw.stationcount };
}

function toStation(raw) {
  return {
    id: raw.stationuuid,
    name: (raw.name || '').trim(),
    country: raw.countrycode,
    countryName: raw.country,
    region: displayRegion(raw.state, { countryName: raw.country, countryCode: raw.countrycode }),
    tags: raw.tags ? raw.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    logo: raw.favicon || '',
    stream: raw.url_resolved || raw.url || '',
    bitrate: raw.bitrate || 0,
    codec: raw.codec || '',
    homepage: raw.homepage || '',
    hls: raw.hls === 1,
    votes: raw.votes || 0,
  };
}

// Contributors add the same station more than once; the stream URL is the real identity.
function dedupe(stations) {
  const byStream = new Map();
  for (const station of stations) {
    const key = station.stream.replace(/\/+$/, '').toLowerCase();
    const seen = byStream.get(key);
    if (!seen || station.votes > seen.votes) byStream.set(key, station);
  }
  return [...byStream.values()];
}

// The site is served over HTTPS, so http:// streams are blocked as mixed content unless a
// relay is configured, and a plain <audio> element cannot play HLS playlists outside Safari.
function isPlayable(station, viaProxy) {
  const scheme = viaProxy ? /^https?:\/\// : /^https:\/\//;
  return station.id && station.name && scheme.test(station.stream) && !station.hls;
}

function byName(a, b) {
  return a.name.localeCompare(b.name);
}
