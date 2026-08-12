import { describe, it, expect } from 'vitest';
import { exportBeerXML, importBeerXML } from '../src/core/beerxml.js';

describe('BeerXML Import & Export Module', () => {
  const sampleState = {
    recipe: {
      name: 'Test IPA',
      batchVolume: 20,
      boilVolume: 25,
      boilTime: 60,
      efficiency: 75,
      notes: 'Test noteringar',
    },
    fermentables: [
      { id: 1, name: 'Pale Ale Malt', amount: 5.0, yield: 78, ebc: 6, type: 'base' },
      { id: 2, name: 'Socker', amount: 0.3, yield: 100, ebc: 0, type: 'sugar' },
    ],
    hops: [
      { id: 1, name: 'Citra', amount: 30, alpha: 12.5, time: 60, use: 'kok', form: 'pellets' },
      { id: 2, name: 'Mosaic', amount: 50, alpha: 11.5, time: 0, use: 'torrhumle', form: 'pellets' },
    ],
    yeast: {
      name: 'US-05',
      lab: 'Fermentis',
      type: 'ale',
      attMin: 72,
      attMax: 78,
    },
    mash: [
      { id: 1, name: 'Mäskning', type: 'Infusion', temp: 67, time: 60 },
    ],
  };

  it('exports state to a valid BeerXML string', () => {
    const xml = exportBeerXML(sampleState);
    expect(xml).toContain('<NAME>Test IPA</NAME>');
    expect(xml).toContain('<BATCH_SIZE>20.0</BATCH_SIZE>');
    expect(xml).toContain('<FERMENTABLE>');
    expect(xml).toContain('<NAME>Pale Ale Malt</NAME>');
    expect(xml).toContain('<HOP>');
    expect(xml).toContain('<NAME>Citra</NAME>');
  });

  it('roundtrips export and import BeerXML correctly', () => {
    const xml = exportBeerXML(sampleState);
    const importedState = importBeerXML(xml);

    expect(importedState.recipe.name).toBe('Test IPA');
    expect(importedState.recipe.batchVolume).toBe(20);
    expect(importedState.fermentables).toHaveLength(2);
    expect(importedState.fermentables[0].name).toBe('Pale Ale Malt');
    expect(importedState.fermentables[0].amount).toBe(5.0);
    expect(importedState.hops).toHaveLength(2);
    expect(importedState.hops[0].name).toBe('Citra');
    expect(importedState.hops[0].amount).toBe(30);
    expect(importedState.hops[1].use).toBe('torrhumle');
  });

  it('throws error when importing invalid BeerXML', () => {
    expect(() => importBeerXML('<INVALID>xml</INVALID>')).toThrow();
  });
});
