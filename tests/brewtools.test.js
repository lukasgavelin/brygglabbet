import { describe, it, expect } from 'vitest';
import {
  residualCO2,
  primingSugar,
  kegPressure,
  suggestCarbonation,
  yeastProfile,
  strikeTemp,
  infusionVolume,
  calculateABVPrecise,
  measuredResults,
  actualEfficiency,
  preboilCorrection,
  brixToSG,
  sgToBrix,
  refractometerFG,
  hydrometerTempCorrection,
  pitchRate,
  pitchRateFor,
  liquidYeastViability,
  starterSize,
  acidMeqPerMl,
  acidAddition,
  spargeAcid,
} from '../src/core/brewtools.js';
import {
  calculateOG,
  calculateIBU,
  estimateBoilGravity,
  whirlpoolTempFactor,
  estimateMashPH,
  maltAcidityProfile,
  gristBuffer,
  computeRecipeMetrics,
  calculateFG,
  calculateEBC,
} from '../src/core/calculations.js';

describe('Brewtools – kolsyra', () => {
  it('residual CO₂ ≈ 0.86 vol at 20°C and higher when colder', () => {
    expect(residualCO2(20)).toBeCloseTo(0.86, 1);
    expect(residualCO2(10)).toBeGreaterThan(residualCO2(20));
  });

  it('priming: 20 L, 2.4 vol, 20°C with strösocker ≈ 6 g/L (classic Swedish rule of thumb)', () => {
    const r = primingSugar({ volumeL: 20, targetVols: 2.4, beerTempC: 20, sugarType: 'sucrose' });
    expect(r.gramsPerLiter).toBeGreaterThan(5.5);
    expect(r.gramsPerLiter).toBeLessThan(6.5);
    expect(r.grams).toBeCloseTo(r.gramsPerLiter * 20, -1);
  });

  it('priming: druvsocker and DME need more than strösocker', () => {
    const base = { volumeL: 20, targetVols: 2.5, beerTempC: 19 };
    const sucrose = primingSugar({ ...base, sugarType: 'sucrose' }).grams;
    expect(primingSugar({ ...base, sugarType: 'dextrose' }).grams).toBeGreaterThan(sucrose);
    expect(primingSugar({ ...base, sugarType: 'dme' }).grams).toBeGreaterThan(sucrose);
  });

  it('priming returns 0 when residual CO₂ already exceeds target', () => {
    expect(primingSugar({ volumeL: 20, targetVols: 1.0, beerTempC: 4 }).grams).toBe(0);
  });

  it('keg pressure ≈ 0.8 bar at 4°C for 2.5 vol', () => {
    const bar = kegPressure(4, 2.5);
    expect(bar).toBeGreaterThan(0.7);
    expect(bar).toBeLessThan(0.95);
    expect(kegPressure(10, 2.5)).toBeGreaterThan(bar);
  });

  it('suggests carbonation per style family', () => {
    expect(suggestCarbonation({ id: '10A', category: 'Ale - Vete' }).id).toBe('wheat');
    expect(suggestCarbonation({ id: '13C', category: 'Ale - Brittisk' }).id).toBe('stout');
    expect(suggestCarbonation({ id: '11A', category: 'Ale - Brittisk' }).id).toBe('british');
    expect(suggestCarbonation({ id: '5D', category: 'Lager - Ljus' }).id).toBe('lager');
    expect(suggestCarbonation(undefined).target).toBe(2.4);
  });
});

describe('Brewtools – jästtolkning', () => {
  it('detects dry/liquid, kveik and lager', () => {
    expect(yeastProfile({ name: 'SafAle US-05', lab: 'Fermentis', type: 'ale' })).toEqual({ type: 'ale', form: 'dry', packSizeG: 11.5 });
    expect(yeastProfile({ name: 'Lallemand Voss Kveik', lab: 'Lallemand', type: 'ale' })).toEqual({ type: 'kveik', form: 'dry', packSizeG: 11 });
    expect(yeastProfile({ name: 'Omega Hornindal Kveik', lab: 'Omega' }).form).toBe('liquid');
    expect(yeastProfile({ name: 'SafLager W-34/70', lab: 'Fermentis', type: 'lager' }).type).toBe('lager');
    expect(yeastProfile({ name: 'Wyeast 3068', lab: 'Wyeast' }).form).toBe('liquid');
  });
});

describe('Brewtools – inmäskning', () => {
  it('strike temp for 67°C mash, 18°C grain, 3 L/kg ≈ 73.7°C', () => {
    expect(strikeTemp({ mashTempC: 67, grainTempC: 18, ratioLPerKg: 3 })).toBeCloseTo(73.7, 1);
  });

  it('thinner mash (BIAB) needs a lower strike temp', () => {
    const thick = strikeTemp({ mashTempC: 67, grainTempC: 18, ratioLPerKg: 2.5 });
    const biab = strikeTemp({ mashTempC: 67, grainTempC: 18, ratioLPerKg: 6 });
    expect(biab).toBeLessThan(thick);
  });

  it('adds tun heat loss', () => {
    const base = strikeTemp({ mashTempC: 66, grainTempC: 20, ratioLPerKg: 3 });
    expect(strikeTemp({ mashTempC: 66, grainTempC: 20, ratioLPerKg: 3, tunLossC: 2 })).toBeCloseTo(base + 2, 1);
  });

  it('infusion volume to raise 5 kg / 15 L mash from 52 to 63°C with boiling water', () => {
    // (63-52)(0.41*5 + 15)/(100-63) = 11*17.05/37 ≈ 5.07 L
    expect(infusionVolume({ currentTempC: 52, targetTempC: 63, grainKg: 5, mashWaterL: 15 })).toBeCloseTo(5.1, 1);
    expect(infusionVolume({ currentTempC: 65, targetTempC: 60, grainKg: 5, mashWaterL: 15 })).toBe(0);
  });
});

describe('Brewtools – uppmätta värden & effektivitet', () => {
  it('precise ABV is close to simple formula for normal beer and higher for strong beer', () => {
    expect(calculateABVPrecise(1.05, 1.01)).toBeCloseTo(5.2, 0);
    const strongSimple = (1.1 - 1.02) * 131.25;
    expect(calculateABVPrecise(1.1, 1.02)).toBeGreaterThan(strongSimple);
  });

  it('measured results give ABV and attenuation', () => {
    const r = measuredResults(1.052, 1.012);
    expect(r.abv).toBeGreaterThan(5);
    expect(r.abv).toBeLessThan(5.6);
    expect(r.apparentAttenuation).toBe(77);
    expect(r.realAttenuation).toBeLessThan(r.apparentAttenuation);
  });

  it('actual efficiency round-trips with calculateOG', () => {
    const grist = [
      { amount: 4.5, yield: 80, type: 'base' },
      { amount: 0.3, yield: 75, type: 'cara' },
    ];
    const og = calculateOG(grist, 20, 72).sg;
    expect(actualEfficiency(grist, og, 20)).toBeCloseTo(72, 0);
  });

  it('actual efficiency excludes sugar from the basis', () => {
    const grist = [
      { amount: 4, yield: 80, type: 'base' },
      { amount: 0.5, yield: 100, type: 'sugar' },
    ];
    const og = calculateOG(grist, 20, 70).sg;
    expect(actualEfficiency(grist, og, 20)).toBeCloseTo(70, 0);
  });

  it('returns 0 when not computable', () => {
    expect(actualEfficiency([], 1.05, 20)).toBe(0);
    expect(actualEfficiency([{ amount: 4, yield: 80 }], 1.0, 20)).toBe(0);
  });
});

describe('Brewtools – korrigering före kok', () => {
  const base = { measuredVolL: 26, boilTimeMin: 60, boilOffRateLph: 3 };

  it('ok when on target', () => {
    // 26 L @ 1.044 → 23 L → 1.0497
    const r = preboilCorrection({ ...base, measuredSG: 1.044, targetOG: 1.05 });
    expect(r.status).toBe('ok');
    expect(r.postBoilVolL).toBe(23);
  });

  it('low gravity → extend boil or add sugar/DME', () => {
    const r = preboilCorrection({ ...base, measuredSG: 1.04, targetOG: 1.05 });
    expect(r.status).toBe('low');
    expect(r.extendBoilMin).toBeGreaterThan(0);
    expect(r.volumeAfterExtendedBoilL).toBeLessThan(r.postBoilVolL);
    expect(r.dmeG).toBeGreaterThan(r.sugarG);
    // Extract check: sugar fills the deficit exactly
    const deficit = 50 * r.postBoilVolL - 40 * 26;
    expect(r.sugarG).toBeCloseTo((deficit / 384) * 1000, -1);
  });

  it('high gravity → dilute', () => {
    const r = preboilCorrection({ ...base, measuredSG: 1.05, targetOG: 1.05 });
    expect(r.status).toBe('high');
    // 26*50 = 1300 GU·L → 1300/50 = 26 L needed, 23 L post-boil → 3 L water
    expect(r.diluteL).toBeCloseTo(3, 1);
  });
});

describe('Brewtools – refraktometer & hydrometer', () => {
  it('brix ↔ SG round-trip with wort correction factor', () => {
    const sg = brixToSG(13);
    expect(sg).toBeGreaterThan(1.048);
    expect(sg).toBeLessThan(1.052);
    expect(sgToBrix(sg)).toBeCloseTo(13, 1);
  });

  it('Terrill FG for 12 → 6 °Brix ≈ 1.011', () => {
    expect(refractometerFG(12, 6)).toBeCloseTo(1.011, 3);
  });

  it('raw brix FG reading would overestimate FG without correction', () => {
    expect(refractometerFG(12, 6)).toBeLessThan(brixToSG(6));
  });

  it('hydrometer: no correction at calibration temp, positive correction when hot', () => {
    expect(hydrometerTempCorrection(1.05, 20)).toBeCloseTo(1.05, 4);
    const hot = hydrometerTempCorrection(1.05, 60);
    expect(hot - 1.05).toBeGreaterThan(0.012);
    expect(hot - 1.05).toBeLessThan(0.02);
  });
});

describe('Brewtools – jäst', () => {
  it('pitch rate per type', () => {
    expect(pitchRateFor('ale')).toBe(0.75);
    expect(pitchRateFor('lager')).toBe(1.5);
    expect(pitchRateFor('kveik')).toBeLessThan(0.75);
  });

  it('one dry packet is enough for a normal 20 L ale', () => {
    const r = pitchRate({ og: 1.05, volumeL: 20, type: 'ale', form: 'dry', packSizeG: 11.5 });
    expect(r.packs).toBe(1);
  });

  it('lager 20 L @ 1.050 needs 2 dry packets', () => {
    const r = pitchRate({ og: 1.05, volumeL: 20, type: 'lager', form: 'dry', packSizeG: 11.5 });
    expect(r.packs).toBe(2);
  });

  it('liquid yeast viability drops over time', () => {
    const today = new Date('2026-10-10');
    expect(liquidYeastViability('2026-10-10', today)).toBe(1);
    expect(liquidYeastViability('2026-09-10', today)).toBeCloseTo(0.79, 2);
    expect(liquidYeastViability('2020-01-01', today)).toBe(0.1);
  });

  it('starter is recommended for old liquid yeast and sized to reach target', () => {
    const today = new Date('2026-10-10');
    const r = pitchRate({ og: 1.06, volumeL: 20, type: 'ale', form: 'liquid', mfgDate: '2026-08-10', today });
    expect(r.cellsPerPackB).toBeLessThan(r.cellsNeededB);
    const s = starterSize({ cellsNeededB: r.cellsNeededB, cellsAvailableB: r.cellsPerPackB });
    expect(s.needed).toBe(true);
    expect(s.finalCellsB).toBeGreaterThanOrEqual(r.cellsNeededB);
    expect(s.dmeG).toBe(s.liters * 100);
  });

  it('no starter needed when cells suffice', () => {
    expect(starterSize({ cellsNeededB: 100, cellsAvailableB: 150 }).needed).toBe(false);
  });
});

describe('Brewtools – syra', () => {
  it('lactic 80 % ≈ 10.3 mEq/mL and 88 % is stronger', () => {
    expect(acidMeqPerMl('lactic', 80)).toBeCloseTo(10.3, 0);
    expect(acidMeqPerMl('lactic', 88)).toBeGreaterThan(acidMeqPerMl('lactic', 80));
    expect(acidMeqPerMl('phosphoric', 10)).toBeCloseTo(1.07, 1);
  });

  it('acid addition brings predicted pH to target using the app pH model', () => {
    const water = { ca: 17, mg: 3, na: 14, cl: 20, so4: 20, hco3: 150 };
    const grist = [{ amount: 5, ebc: 4, type: 'base' }];
    const r = acidAddition({ waterProfile: water, fermentables: grist, mashRatio: 3, mashWaterL: 15, targetPH: 5.4 });
    expect(r.currentPH).toBeGreaterThan(5.4);
    expect(r.ml).toBeGreaterThan(0);
    expect(r.acidulatedMaltPct).toBeGreaterThan(0);

    // Verify: removing the acid's mEq from alkalinity gives the target pH
    const hco3Removed = (r.mEq / 15) * 61;
    const treated = { ...water, hco3: water.hco3 - hco3Removed };
    expect(estimateMashPH(treated, grist, 3)).toBeCloseTo(5.4, 1);
  });

  it('no acid when already at or below target', () => {
    const water = { ca: 100, mg: 10, na: 10, cl: 50, so4: 50, hco3: 0 };
    const grist = [{ amount: 4, ebc: 4 }, { amount: 0.5, ebc: 1200 }];
    const current = estimateMashPH(water, grist, 3);
    const r = acidAddition({ waterProfile: water, fermentables: grist, mashWaterL: 13, targetPH: current + 0.1 });
    expect(r.ml).toBe(0);
    expect(r.acidulatedMaltG).toBe(0);
  });

  it('sparge acid neutralizes ~82 % of bicarbonate at pH 5.7', () => {
    const r = spargeAcid({ hco3: 61, spargeL: 10, targetPH: 5.7 });
    expect(r.mEq).toBeCloseTo(8.2, 1);
    expect(r.ml).toBeGreaterThan(0);
  });
});

describe('Mäsk-pH-modell (laddningsbalans)', () => {
  const distilled = { ca: 0, mg: 0, na: 0, cl: 0, so4: 0, hco3: 0 };

  it('pilsner malt in distilled water ≈ 5.7', () => {
    expect(estimateMashPH(distilled, [{ amount: 5, ebc: 3.5, type: 'base' }])).toBeCloseTo(5.71, 1);
  });

  it('crystal malt has lower distilled pH the darker it is', () => {
    expect(maltAcidityProfile({ type: 'cara', ebc: 295 }).pH).toBeLessThan(maltAcidityProfile({ type: 'cara', ebc: 40 }).pH);
    expect(maltAcidityProfile({ type: 'roasted', ebc: 1300 }).pH).toBeCloseTo(4.6, 1);
  });

  it('dry stout (≈10 % roasted barley) mashes clearly lower than a pale grist', () => {
    const pale = [{ amount: 4.8, ebc: 6, type: 'base' }];
    const stout = [
      { amount: 4.0, ebc: 6, type: 'base' },
      { amount: 0.5, ebc: 1300, type: 'roasted' },
      { amount: 0.3, ebc: 120, type: 'cara' },
    ];
    const delta = estimateMashPH(distilled, pale) - estimateMashPH(distilled, stout);
    expect(delta).toBeGreaterThan(0.15);
    expect(estimateMashPH(distilled, stout)).toBeLessThan(5.55);
  });

  it('alkaline water raises pH, more so in a thinner mash', () => {
    const grist = [{ amount: 5, ebc: 6, type: 'base' }];
    const hard = { ca: 20, mg: 3, na: 10, cl: 20, so4: 20, hco3: 200 };
    const thick = estimateMashPH(hard, grist, 2.5);
    const thin = estimateMashPH(hard, grist, 5);
    expect(thick).toBeGreaterThan(estimateMashPH(distilled, grist));
    expect(thin).toBeGreaterThan(thick);
  });

  it('grist buffer sums kg × buffer and ignores sugar', () => {
    const b = gristBuffer([{ amount: 5, ebc: 4, type: 'base' }, { amount: 1, type: 'sugar' }]);
    expect(b.bufferMeqPerPH).toBe(200);
    expect(b.grainKg).toBe(5);
  });
});

describe('IBU-modell (ny)', () => {
  it('boil gravity is the mean of pre-boil and OG, or ~90 % of OG points as fallback', () => {
    expect(estimateBoilGravity(1.05, 1.04)).toBeCloseTo(1.045, 4);
    expect(estimateBoilGravity(1.05)).toBeCloseTo(1.045, 4);
    expect(estimateBoilGravity(1.0)).toBe(1.0);
  });

  it('whirlpool temperature factor ≈ 1 at boil, ≈ 0.23 at 80°C, lower when colder', () => {
    expect(whirlpoolTempFactor(100)).toBeCloseTo(1, 1);
    expect(whirlpoolTempFactor(80)).toBeCloseTo(0.23, 1);
    expect(whirlpoolTempFactor(70)).toBeLessThan(whirlpoolTempFactor(80));
    expect(whirlpoolTempFactor(0)).toBe(0);
  });

  it('hotter whirlpool gives more IBU', () => {
    const hop = { amount: 50, alpha: 12, time: 20, form: 'pellets', use: 'whirlpool' };
    const hot = calculateIBU([{ ...hop, whirlpoolTemp: 95 }], 1.06, 20).total;
    const cool = calculateIBU([{ ...hop, whirlpoolTemp: 75 }], 1.06, 20).total;
    expect(hot).toBeGreaterThan(cool * 2);
  });

  it('accepts an explicit boil gravity', () => {
    const hops = [{ amount: 25, alpha: 12, time: 60, form: 'pellets', use: 'kok' }];
    const low = calculateIBU(hops, 1.05, 20, { boilGravity: 1.03 }).total;
    const high = calculateIBU(hops, 1.05, 20, { boilGravity: 1.06 }).total;
    expect(low).toBeGreaterThan(high);
  });
});

describe('computeRecipeMetrics', () => {
  const state = {
    recipe: { batchVolume: 20, efficiency: 75, boilTime: 60 },
    equipment: { batchVolume: 20, boilOffRate: 3, kettleLoss: 2, fermenterLoss: 1, grainAbsorption: 0.96, mashRatio: 3 },
    fermentables: [
      { amount: 4.5, yield: 80, ebc: 4, type: 'base' },
      { amount: 0.3, yield: 75, ebc: 120, type: 'cara' },
    ],
    hops: [
      { amount: 25, alpha: 12, time: 60, form: 'pellets', use: 'kok' },
      { amount: 50, alpha: 10, time: 20, form: 'pellets', use: 'whirlpool', whirlpoolTemp: 80 },
      { amount: 60, alpha: 12, time: 0, form: 'pellets', use: 'torrhumle' },
    ],
    yeast: { attMin: 73, attMax: 78 },
  };

  it('matches the individual calculation functions', () => {
    const m = computeRecipeMetrics(state);
    const og = calculateOG(state.fermentables, 20, 75).sg;
    expect(m.og).toBeCloseTo(og, 6);
    expect(m.fg).toBeCloseTo(calculateFG(og, 75.5), 6);
    expect(m.ebc).toBeCloseTo(calculateEBC(state.fermentables, 20).ebc, 6);
    expect(m.ibu).toBeCloseTo(calculateIBU(state.hops, og, 20, { boilGravity: m.boilSG }).total, 6);
    expect(m.ibuPerHop[2]).toBe(0);
  });

  it('derives pre-boil volume/gravity from the equipment profile', () => {
    const m = computeRecipeMetrics(state);
    expect(m.preboilVolume).toBe(26);
    expect(m.preboilSG).toBeLessThan(m.og);
    expect(m.boilSG).toBeGreaterThan(m.preboilSG);
    expect(m.boilSG).toBeLessThan(m.og);
  });

  it('handles an empty state without throwing', () => {
    const m = computeRecipeMetrics({});
    expect(m.og).toBe(1.0);
    expect(m.ibu).toBe(0);
  });
});
