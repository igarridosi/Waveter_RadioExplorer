// Region names in Radio Browser are free text typed by contributors: the same
// place shows up in several languages, with and without accents, as "City, Region",
// or as the country itself. This turns that list into one clean entry per place,
// each remembering the raw spellings it stands for, so a filter can query them all.

// Known multilingual variants, keyed by their canonical form (see `keyOf`).
// A value of null means "this is not a region, drop it".
const ALIASES = {
  // Spain
  catalunya: 'Catalunya', cataluna: 'Catalunya', catalonia: 'Catalunya',
  islasbaleares: 'Illes Balears', illesbalears: 'Illes Balears', balearicislands: 'Illes Balears', balearics: 'Illes Balears', baleares: 'Illes Balears', balears: 'Illes Balears',
  basquecountry: 'Euskadi', paisvasco: 'Euskadi', euskadi: 'Euskadi', euskalherria: 'Euskadi',
  comunitatvalenciana: 'Comunitat Valenciana', comunidadvalenciana: 'Comunitat Valenciana', paisvalencia: 'Comunitat Valenciana', regnedevalencia: 'Comunitat Valenciana',
  comunidaddemadrid: 'Madrid',
  islascanarias: 'Islas Canarias', canaryislands: 'Islas Canarias', canarias: 'Islas Canarias',
  galiza: 'Galicia',
  lacoruna: 'A Coruña', acoruna: 'A Coruña',
  vizcaya: 'Bizkaia', bizkaia: 'Bizkaia', biscay: 'Bizkaia',
  gipuzcoa: 'Gipuzkoa', guipuzcoa: 'Gipuzkoa', gipuzkoa: 'Gipuzkoa',
  regiondemurcia: 'Murcia',
  principadodeasturias: 'Asturias',
  castillaleon: 'Castilla y León',
  espana: null, sp: null,
  // The Netherlands: province abbreviations
  nh: 'Noord-Holland', zh: 'Zuid-Holland', dr: 'Drenthe', nb: 'Noord-Brabant', gld: 'Gelderland', ov: 'Overijssel', fr: 'Friesland', gr: 'Groningen', ut: 'Utrecht', ze: 'Zeeland', fl: 'Flevoland', li: 'Limburg',
  // Common elsewhere
  bavaria: 'Bayern', bayern: 'Bayern',
  lombardia: 'Lombardia', lombardy: 'Lombardia',
  tuscany: 'Toscana', toscana: 'Toscana',
  brittany: 'Bretagne', bretagne: 'Bretagne',
  flanders: 'Vlaanderen', vlaanderen: 'Vlaanderen',
  wallonia: 'Wallonie', wallonie: 'Wallonie',
};

// NFD splits accented letters into base + combining mark; the final replace drops the marks.
export function keyOf(name) {
  return name
    .normalize('NFD')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// "Lugo, Galicia" -> "Lugo"; "Asturias, Principado de" -> "Asturias"; trims and squashes spaces.
function clean(raw) {
  return raw.split(',')[0].replace(/\s+/g, ' ').replace(/^[\s.\-–]+|[\s.\-–]+$/g, '').trim();
}

// One raw region name -> { key, name } after cleaning and aliases, or null if it is not a region.
// `name` is the alias when there is one, otherwise the cleaned spelling.
function resolve(raw, junk) {
  const name = clean(raw || '');
  if (!name) return null;
  const key = keyOf(name);
  if (junk.has(key)) return null;
  if (key in ALIASES) {
    const alias = ALIASES[key];
    return alias === null ? null : { key: keyOf(alias), name: alias, aliased: true };
  }
  if (key.length < 3) return null; // stray abbreviations we do not know
  return { key, name, aliased: false };
}

function junkFor({ countryName = '', countryCode = '' }) {
  return new Set([keyOf(countryName), keyOf(countryCode)]);
}

// The region to show for a single station ('' when it is not really a region).
export function displayRegion(raw, country) {
  return resolve(raw, junkFor(country))?.name ?? '';
}

export function normalizeRegions(rawList, country = {}) {
  const junk = junkFor(country);
  const groups = new Map(); // canonical key -> { name, stationCount, variants, spellings: Map<name, count> }

  for (const raw of rawList) {
    const resolved = resolve(raw.name, junk);
    if (!resolved) continue;
    const { key, aliased } = resolved;
    const name = aliased ? null : resolved.name;
    const display = aliased ? resolved.name : null;

    const group = groups.get(key) ?? { name: display, stationCount: 0, variants: new Set(), spellings: new Map() };
    group.name ??= display;
    group.stationCount += raw.stationcount || 0;
    group.variants.add(raw.name);
    group.spellings.set(name, (group.spellings.get(name) || 0) + (raw.stationcount || 0));
    groups.set(key, group);
  }

  return [...groups.values()]
    .map(g => ({
      // Without an alias, the most common spelling wins.
      name: g.name ?? [...g.spellings.entries()].sort((a, b) => b[1] - a[1])[0][0],
      stationCount: g.stationCount,
      variants: [...g.variants],
    }))
    .sort((a, b) => b.stationCount - a.stationCount || a.name.localeCompare(b.name));
}
