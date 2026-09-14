// The station catalogue: the only way the UI learns about countries, regions and stations.
//
//   countries()                          -> Country[]
//   regionsIn(countryCode)               -> Region[]   (may be empty: half the stations carry no region)
//   stationsIn(countryCode, { region })  -> Station[]  (playable over HTTPS, not broken, most voted first)
//   randomStation()                      -> Station
//   streamFor(station)                   -> string     (stream URL to play; reports the play to the provider)
//
//   Country = { code, name, stationCount }
//   Region  = { name, stationCount }
//   Station = { id, name, country, countryName, region, tags, logo, stream, bitrate, codec, homepage }
//
// Errors surface as CatalogueError. Never put a provider URL anywhere else in the app.

import { createRadioBrowserCatalogue, CatalogueError } from './radioBrowser.js';
import { createFixtureCatalogue } from './fixture.js';

const useFixture =
  import.meta.env.VITE_CATALOGUE === 'fixture' ||
  (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('fixture'));

export const catalogue = useFixture ? createFixtureCatalogue() : createRadioBrowserCatalogue();

export { CatalogueError };
