import { describe, it, expect } from 'vitest';
import { normalizeRegions, displayRegion, keyOf } from './regions.js';

const r = (name, stationcount = 1) => ({ name, stationcount });
const spain = { countryName: 'Spain', countryCode: 'ES' };

describe('keyOf', () => {
  it('ignores case, accents, spaces and punctuation', () => {
    expect(keyOf('Andalucía')).toBe('andalucia');
    expect(keyOf('  País Valencià ')).toBe('paisvalencia');
    expect(keyOf('Castilla-La Mancha')).toBe('castillalamancha');
  });
});

describe('displayRegion', () => {
  it('cleans a station region the same way the region list is cleaned', () => {
    expect(displayRegion('Spain', spain)).toBe('');
    expect(displayRegion('spain', spain)).toBe('');
    expect(displayRegion('Comunidad de Madrid', spain)).toBe('Madrid');
    expect(displayRegion('Lugo, Galicia', spain)).toBe('Lugo');
    expect(displayRegion('Islas Baleares', spain)).toBe('Illes Balears');
    expect(displayRegion('', spain)).toBe('');
    expect(displayRegion(undefined, spain)).toBe('');
  });
});

describe('normalizeRegions', () => {
  it('merges spellings that differ only in case or accents, keeping the most common one', () => {
    const out = normalizeRegions([r('Andalucia', 2), r('Andalucía', 30), r('ANDALUCIA', 1)], spain);
    expect(out).toEqual([{ name: 'Andalucía', stationCount: 33, variants: ['Andalucia', 'Andalucía', 'ANDALUCIA'] }]);
  });

  it('merges multilingual variants under one canonical name', () => {
    const out = normalizeRegions([r('Islas Baleares', 10), r('Illes Balears', 8), r('Balearic Islands', 1)], spain);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ name: 'Illes Balears', stationCount: 19 });
    expect(out[0].variants).toEqual(['Islas Baleares', 'Illes Balears', 'Balearic Islands']);
  });

  it('folds "City, Region" and "Region, Qualifier" down to their first part', () => {
    const out = normalizeRegions([r('Lugo, Galicia', 2), r('Lugo', 3), r('Asturias, Principado de', 2), r('Asturias', 7)], spain);
    expect(out.map(x => [x.name, x.stationCount])).toEqual([['Asturias', 9], ['Lugo', 5]]);
  });

  it('drops the country itself, its code and other junk', () => {
    const out = normalizeRegions([r('spain', 17), r('ESPAÑA ', 2), r('sp', 2), r('ES', 1), r(' ', 1), r('', 4), r('Madrid', 99)], spain);
    expect(out.map(x => x.name)).toEqual(['Madrid']);
  });

  it('sorts by station count, then name', () => {
    const out = normalizeRegions([r('Girona', 10), r('Madrid', 99), r('Cantabria', 10)], spain);
    expect(out.map(x => x.name)).toEqual(['Madrid', 'Cantabria', 'Girona']);
  });

  it('leaves unknown names untouched apart from cleaning', () => {
    const out = normalizeRegions([r('  Terres de   l\'Ebre. ', 4)], spain);
    expect(out[0].name).toBe("Terres de l'Ebre");
    expect(out[0].variants).toEqual(["  Terres de   l'Ebre. "]);
  });
});
