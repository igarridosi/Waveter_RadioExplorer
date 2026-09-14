// Offline catalogue: the Radio Browser adapter driven by recorded responses.
//
// Used by the contract tests and for designing the UI without a network
// (`VITE_CATALOGUE=fixture npm run dev`, or append `?fixture` to the URL).
// Recorded on 2026-09-14 from de1.api.radio-browser.info.

import { createRadioBrowserCatalogue } from './radioBrowser.js';
import countries from './fixtures/countries.raw.json';
import statesSpain from './fixtures/states-spain.raw.json';
import stationsES from './fixtures/stations-es.raw.json';
import stationsESMadrid from './fixtures/stations-es-madrid.raw.json';

const allStations = [...stationsES, ...stationsESMadrid];

export function fixtureFetch(url) {
  const { pathname, searchParams } = new URL(url);
  return Promise.resolve(respond(route(pathname, searchParams)));
}

function route(pathname, params) {
  if (pathname === '/json/countries') return countries;
  if (pathname.startsWith('/json/states/')) {
    return decodeURIComponent(pathname.split('/')[3]) === 'Spain' ? statesSpain : [];
  }
  if (pathname === '/json/stations/search') {
    if (params.get('order') === 'random') return shuffle(allStations).slice(0, 5);
    if (params.get('countrycode') !== 'ES') return [];
    if (params.get('state')) return allStations.filter(s => s.state === params.get('state'));
    return stationsES;
  }
  if (pathname.startsWith('/json/url/')) {
    const station = allStations.find(s => s.stationuuid === pathname.split('/')[3]);
    return station ? { ok: true, url: station.url_resolved } : { ok: false };
  }
  return [];
}

function respond(data) {
  return { ok: true, status: 200, json: async () => data };
}

function shuffle(list) {
  return [...list].sort(() => Math.random() - 0.5);
}

export function createFixtureCatalogue() {
  return createRadioBrowserCatalogue({ fetch: fixtureFetch, hosts: ['fixture.local'] });
}
