# Waveter domain glossary

The words the code, tests and docs use. When a concept gets a new name, change it here first.

- **Catalogue**: the source of the world's radio stations. Implemented in `src/catalogue/` behind one
  interface (`countries`, `regionsIn`, `stationsIn`, `randomStation`, `streamFor`). The provider
  today is Radio Browser; the UI never sees a provider URL or a raw provider response.
- **Country**: `{ code, name, stationCount }`. `code` is ISO 3166-1 alpha-2 and is what the UI keys on.
- **Region**: `{ name, stationCount }`. A sub-national area (city, province, community) after the
  catalogue has normalised the provider's free text (`src/catalogue/regions.js`): case and accents
  merged, "City, Region" folded to the city, the country itself dropped, and known multilingual
  variants (Illes Balears / Islas Baleares, Euskadi / Basque Country / País Vasco...) merged under one
  name. A region remembers its raw variants so the filter queries all of them. Only about half of
  the stations carry one, so a region is a filter on a country, never a mandatory step.
- **Sheet**: the modal surface for secondary content (today: favourites). A draggable bottom sheet on
  phones, a side panel on wider screens; enters and leaves along the same edge (`src/components/Sheet.jsx`,
  physics in `src/ui/spring.js`).
- **Station**: `{ id, name, country, countryName, region, tags, logo, stream, bitrate, codec, homepage }`.
  Its identity is `id`; the `stream` is a property that can change, so anything persisted keys on `id`.
- **Stream**: the URL the player actually opens. Always `https://` (see ADR-0001). Resolved through
  `catalogue.streamFor(station)` when tuning, which also reports the play to the provider.
- **Tuner**: the current selection (country, region, station) and the verbs that change it: choose a
  country, choose a region, tune a station, random dial. A pure reducer in `src/tuner/reducer.js`
  (every path to a station goes through `tune`; stale loads are dropped by `requestId`) and a thin
  hook `useTuner(catalogue)` that only performs the loads.
- **Random dial**: tuning a station picked at random from the whole catalogue, not from the current country.
- **Player**: one `Audio` object for the whole session and its status as data
  (`idle | connecting | playing | error`), in `src/player/player.js`. Never a spectrum analyser (ADR-0002).
- **Player bar**: the persistent bottom bar showing the tuned station, its status (ON AIR is the
  `playing` state, not decoration) and the controls.
- **Console**: the panel where the listener tunes: country combobox, region chips, station list.
- **Favourites** ("Saved radios" in the UI): stations the listener keeps across sessions, keyed by
  station id, in `localStorage` through `src/favourites/useFavourites.js` only.
- **Playable**: a station the catalogue will show: HTTPS stream, not broken, not HLS (ADR-0001, ADR-0002).
