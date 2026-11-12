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
    expect(xml).toContain('<COLOR>3.0</COLOR>'); // 6 EBC / 1.97 ≈ 3.0 SRM
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
    expect(importedState.fermentables[0].ebc).toBe(6);
    expect(importedState.hops).toHaveLength(2);
    expect(importedState.hops[0].name).toBe('Citra');
    expect(importedState.hops[0].amount).toBe(30);
    expect(importedState.hops[1].use).toBe('torrhumle');
  });

  it('roundtrips carbonation, whirlpool temp, and dry hop days correctly', () => {
    const stateWithExtras = {
      ...sampleState,
      recipe: {
        ...sampleState.recipe,
        carbonationVols: 2.5,
      },
      hops: [
        { id: 1, name: 'Simcoe', amount: 40, alpha: 13, time: 20, use: 'whirlpool', whirlpoolTemp: 80, form: 'pellets' },
        { id: 2, name: 'Amarillo', amount: 60, alpha: 9, time: 0, use: 'torrhumle', dryHopDay: 5, dryHopDays: 4, form: 'pellets' },
      ],
    };
    const xml = exportBeerXML(stateWithExtras);
    expect(xml).toContain('<CARBONATION>2.50</CARBONATION>');
    expect(xml).toContain('Whirlpool Temp: 80°C');
    expect(xml).toContain('Tillsätt dag: 5');

    const imported = importBeerXML(xml);
    expect(imported.recipe.carbonationVols).toBe(2.5);
    expect(imported.hops[0].use).toBe('whirlpool');
    expect(imported.hops[0].whirlpoolTemp).toBe(80);
    expect(imported.hops[1].use).toBe('torrhumle');
    expect(imported.hops[1].dryHopDay).toBe(5);
    expect(imported.hops[1].dryHopDays).toBe(4);
  });

  it('konverterar maltfärg mellan EBC och SRM enligt BeerXML-standarden', () => {
    // 1. Export: EBC -> SRM
    const xml = exportBeerXML({
      recipe: { name: 'Färgtest', batchVolume: 20 },
      fermentables: [
        { name: 'Pilsnermalt', amount: 4, yield: 80, ebc: 3.5, type: 'base' },
        { name: 'Chokladmalt', amount: 0.5, yield: 70, ebc: 800, type: 'base' },
      ],
    });
    // 3.5 EBC / 1.97 ≈ 1.8 SRM
    // 800 EBC / 1.97 ≈ 406.1 SRM
    expect(xml).toContain('<COLOR>1.8</COLOR>');
    expect(xml).toContain('<COLOR>406.1</COLOR>');

    // 2. Import: SRM -> EBC
    const beerXmlInput = `<?xml version="1.0" encoding="UTF-8"?>
<RECIPES>
  <RECIPE>
    <NAME>Import Färg</NAME>
    <FERMENTABLES>
      <FERMENTABLE>
        <NAME>Briess 2-Row (1.8 SRM)</NAME>
        <AMOUNT>4.0</AMOUNT>
        <YIELD>80.0</YIELD>
        <COLOR>1.8</COLOR>
      </FERMENTABLE>
      <FERMENTABLE>
        <NAME>Crystal 60 (60 SRM)</NAME>
        <AMOUNT>0.5</AMOUNT>
        <YIELD>73.0</YIELD>
        <COLOR>60.0</COLOR>
      </FERMENTABLE>
    </FERMENTABLES>
  </RECIPE>
</RECIPES>`;
    const imported = importBeerXML(beerXmlInput);
    // 1.8 SRM * 1.97 ≈ 3.5 EBC
    // 60 SRM * 1.97 = 118.2 EBC
    expect(imported.fermentables[0].ebc).toBe(3.5);
    expect(imported.fermentables[1].ebc).toBe(118.2);
  });

  it('throws error when importing invalid BeerXML', () => {
    expect(() => importBeerXML('<INVALID>xml</INVALID>')).toThrow();
  });
});
