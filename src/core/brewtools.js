/**
 * Brewing tools: pure calculation functions for the brewer's practical toolbox.
 * Carbonation, strike water, refractometer/hydrometer, measured results,
 * efficiency, pre-boil corrections, yeast pitching and acid additions.
 *
 * Clean Code: pure functions, zero side effects, metric units (L, kg, g, °C, bar).
 * Swedish-first: sugar types and labels follow Swedish homebrewing vocabulary.
 */

import {
  GU_PER_KG_SUCROSE,
  CO2_GRAMS_PER_LITER_PER_VOLUME,
  SUCROSE_CO2_YIELD,
  PSI_TO_BAR,
  GRAIN_THERMAL_CONSTANT,
  DME_EXTRACT_FACTOR,
  PITCH_RATE_ALE,
  PITCH_RATE_LAGER,
  PITCH_RATE_KVEIK,
  DRY_YEAST_BILLION_CELLS_PER_GRAM,
  LIQUID_YEAST_BILLION_CELLS_PER_PACK,
  LIQUID_YEAST_VIABILITY_LOSS_PER_DAY,
  STARTER_EXTRACT_G_PER_L,
  DEFAULT_WORT_CORRECTION_FACTOR,
  DEFAULT_HYDROMETER_CALIBRATION_C,
  LACTIC_ACID_MW,
  LACTIC_ACID_PKA,
  PHOSPHORIC_ACID_MW,
  CARBONIC_ACID_PKA1,
  ACIDULATED_MALT_LACTIC_FRACTION,
} from '../constants.js';
import { sgToPlato, platoToSG, estimateMashPH, gristBuffer, calculateApparentAttenuation } from './calculations.js';

const cToF = (c) => (c * 9) / 5 + 32;
const num = (v, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
const round = (v, decimals = 1) => {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
};

// ---------------------------------------------------------------------------
// 1. Kolsyra (flaskning & fat)
// ---------------------------------------------------------------------------

/**
 * Priming sugar types with CO₂ yield relative to sucrose (strösocker).
 * @type {Record<string, { label: string, sucroseEquivalent: number }>}
 */
export const PRIMING_SUGARS = {
  sucrose: { label: 'Strösocker (sackaros)', sucroseEquivalent: 1.0 },
  dextrose: { label: 'Druvsocker (glukos)', sucroseEquivalent: 1.15 },
  dme: { label: 'Ljust torrmaltextrakt (DME)', sucroseEquivalent: 1.6 },
  honey: { label: 'Honung', sucroseEquivalent: 1.25 },
};

/**
 * Typical carbonation levels (volumes CO₂) per beer family.
 * @type {Array<{ id: string, label: string, min: number, max: number }>}
 */
export const CARBONATION_GUIDE = [
  { id: 'british', label: 'Brittisk ale / Bitter', min: 1.5, max: 2.0 },
  { id: 'stout', label: 'Porter & Stout', min: 1.8, max: 2.3 },
  { id: 'ale', label: 'Pale Ale / IPA / Amber', min: 2.2, max: 2.6 },
  { id: 'lager', label: 'Lager & Pilsner', min: 2.4, max: 2.7 },
  { id: 'belgian', label: 'Belgisk ale / Saison', min: 2.8, max: 3.5 },
  { id: 'wheat', label: 'Veteöl (Hefeweizen)', min: 3.3, max: 4.0 },
];

/**
 * Suggests a carbonation level for a BJCP style entry from the style database.
 * @param {{ id?: string, category?: string } | undefined} style
 * @returns {{ id: string, label: string, min: number, max: number, target: number }}
 */
export function suggestCarbonation(style) {
  const cat = style?.category || '';
  const id = style?.id || '';
  let key = 'ale';
  if (cat.includes('Vete')) key = 'wheat';
  else if (cat.includes('Belgisk')) key = 'belgian';
  else if (cat.includes('Stout') || id === '13C') key = 'stout';
  else if (cat.includes('Brittisk')) key = 'british';
  else if (cat.includes('Lager')) key = 'lager';
  const g = CARBONATION_GUIDE.find((c) => c.id === key);
  return { ...g, target: round((g.min + g.max) / 2, 1) };
}

/**
 * Interprets a yeast selection for pitching purposes.
 * @param {{ name?: string, lab?: string, type?: string }} yeast
 * @returns {{ type: 'ale'|'lager'|'kveik', form: 'dry'|'liquid', packSizeG: number }}
 */
export function yeastProfile(yeast) {
  const name = (yeast?.name || '').toLowerCase();
  const lab = (yeast?.lab || '').toLowerCase();
  const liquidLabs = ['wyeast', 'white labs', 'omega', 'imperial', 'escarpment'];
  const form = liquidLabs.some((l) => lab.includes(l)) ? 'liquid' : 'dry';
  let type = 'ale';
  if (name.includes('kveik')) type = 'kveik';
  else if (yeast?.type === 'lager') type = 'lager';
  let packSizeG = 11.5;
  if (lab.includes('lallemand')) packSizeG = 11;
  else if (lab.includes('mangrove')) packSizeG = 10;
  return { type, form, packSizeG };
}

/**
 * Residual CO₂ dissolved in beer after fermentation (volumes).
 * Use the HIGHEST temperature the beer reached after active fermentation.
 * @param {number} tempC - Beer temperature in °C
 * @returns {number} Volumes of CO₂ already in solution
 */
export function residualCO2(tempC) {
  const f = cToF(num(tempC, 20));
  return Math.max(0, 3.0378 - 0.050062 * f + 0.00026555 * f * f);
}

/**
 * Priming sugar needed for bottle conditioning.
 * @param {{ volumeL: number, targetVols: number, beerTempC: number, sugarType?: keyof PRIMING_SUGARS }} p
 * @returns {{ grams: number, gramsPerLiter: number, residualVols: number, addedVols: number }}
 */
export function primingSugar({ volumeL, targetVols, beerTempC, sugarType = 'sucrose' }) {
  const vol = Math.max(0, num(volumeL));
  const residualVols = residualCO2(beerTempC);
  const addedVols = Math.max(0, num(targetVols) - residualVols);
  const sugar = PRIMING_SUGARS[sugarType] || PRIMING_SUGARS.sucrose;
  const sucrosePerLiter = (addedVols * CO2_GRAMS_PER_LITER_PER_VOLUME) / SUCROSE_CO2_YIELD;
  const gramsPerLiter = sucrosePerLiter * sugar.sucroseEquivalent;
  return {
    grams: round(gramsPerLiter * vol, 0),
    gramsPerLiter: round(gramsPerLiter, 1),
    residualVols: round(residualVols, 2),
    addedVols: round(addedVols, 2),
  };
}

/**
 * Regulator pressure for force carbonation in a keg.
 * @param {number} tempC - Keg temperature in °C
 * @param {number} targetVols - Desired carbonation (volumes CO₂)
 * @returns {number} Pressure in bar (overtryck), never negative
 */
export function kegPressure(tempC, targetVols) {
  const t = cToF(num(tempC, 4));
  const v = num(targetVols, 2.4);
  const psi =
    -16.6999 -
    0.0101059 * t +
    0.00116512 * t * t +
    0.173354 * t * v +
    4.24267 * v -
    0.0684226 * v * v;
  return round(Math.max(0, psi * PSI_TO_BAR), 2);
}

// ---------------------------------------------------------------------------
// 2. Inmäskning
// ---------------------------------------------------------------------------

/**
 * Strike water temperature for a single infusion (Palmer, metric).
 * Tw = (0.41 / r)(T2 − T1) + T2  [+ heat loss to an unheated mash tun]
 * @param {{ mashTempC: number, grainTempC?: number, ratioLPerKg?: number, tunLossC?: number }} p
 * @returns {number} Strike water temperature in °C
 */
export function strikeTemp({ mashTempC, grainTempC = 18, ratioLPerKg = 3, tunLossC = 0 }) {
  const t2 = num(mashTempC, 67);
  const t1 = num(grainTempC, 18);
  const r = Math.max(0.5, num(ratioLPerKg, 3));
  return round((GRAIN_THERMAL_CONSTANT / r) * (t2 - t1) + t2 + num(tunLossC), 1);
}

/**
 * Volume of hot water to add to raise mash temperature (step infusion).
 * Wa = (T2 − T1)(0.41·G + Wm) / (Tw − T2)
 * @param {{ currentTempC: number, targetTempC: number, grainKg: number, mashWaterL: number, infusionTempC?: number }} p
 * @returns {number} Liters of infusion water (0 if not possible)
 */
export function infusionVolume({ currentTempC, targetTempC, grainKg, mashWaterL, infusionTempC = 100 }) {
  const t1 = num(currentTempC);
  const t2 = num(targetTempC);
  const tw = num(infusionTempC, 100);
  if (t2 <= t1 || tw <= t2) return 0;
  const liters = ((t2 - t1) * (GRAIN_THERMAL_CONSTANT * num(grainKg) + num(mashWaterL))) / (tw - t2);
  return round(Math.max(0, liters), 1);
}

// ---------------------------------------------------------------------------
// 3. Uppmätta värden (OG/FG → ABV)
// ---------------------------------------------------------------------------

/**
 * ABV using the alternative formula, more accurate for strong beers (> ~1.070).
 * @param {number} og - Original gravity (SG)
 * @param {number} fg - Final gravity (SG)
 * @returns {number} ABV percentage
 */
export function calculateABVPrecise(og, fg) {
  const o = num(og);
  const f = num(fg);
  if (o <= 1 || f <= 0 || f >= o) return 0;
  return ((76.08 * (o - f)) / (1.775 - o)) * (f / 0.794);
}

/**
 * Summarizes measured fermentation results.
 * @param {number} og - Measured OG (SG)
 * @param {number} fg - Measured FG (SG)
 * @returns {{ abv: number, apparentAttenuation: number, realAttenuation: number }}
 */
export function measuredResults(og, fg) {
  const o = num(og);
  const f = num(fg);
  if (o <= 1 || f <= 0 || f > o) return { abv: 0, apparentAttenuation: 0, realAttenuation: 0 };
  const oe = sgToPlato(o);
  const ae = sgToPlato(f);
  const re = 0.1808 * oe + 0.8192 * ae;
  return {
    abv: round(calculateABVPrecise(o, f), 1),
    apparentAttenuation: round(calculateApparentAttenuation(o, f), 0),
    realAttenuation: oe > 0 ? round(((oe - re) / oe) * 100, 0) : 0,
  };
}

// ---------------------------------------------------------------------------
// 4. Faktisk effektivitet
// ---------------------------------------------------------------------------

/**
 * Actual brewhouse efficiency from measured OG and volume into the fermenter.
 * Matches how the app applies efficiency (extract delivered to batch volume).
 * Sugars are assumed 100 % extracted and excluded from the efficiency basis.
 * @param {Array<{ amount: number, yield: number, type?: string }>} fermentables
 * @param {number} measuredOG - Measured OG (SG)
 * @param {number} volumeL - Measured volume into fermenter (L)
 * @returns {number} Efficiency percentage (0 if not computable)
 */
export function actualEfficiency(fermentables, measuredOG, volumeL) {
  const list = fermentables || [];
  let grainPotential = 0;
  let sugarExtract = 0;
  list.forEach((f) => {
    const pts = num(f.amount) * (num(f.yield) / 100) * GU_PER_KG_SUCROSE;
    if (f.type === 'sugar') sugarExtract += pts;
    else grainPotential += pts;
  });
  const measuredExtract = (num(measuredOG) - 1) * 1000 * num(volumeL);
  if (grainPotential <= 0 || measuredExtract <= 0) return 0;
  return round(((measuredExtract - sugarExtract) / grainPotential) * 100, 1);
}

// ---------------------------------------------------------------------------
// 5. Korrigering före kok
// ---------------------------------------------------------------------------

/**
 * Suggests corrections when the measured pre-boil gravity misses the plan.
 * @param {{ measuredSG: number, measuredVolL: number, targetOG: number,
 *           boilTimeMin: number, boilOffRateLph: number, toleranceGU?: number }} p
 * @returns {{
 *   predictedOG: number, postBoilVolL: number, status: 'low'|'ok'|'high',
 *   extendBoilMin: number, volumeAfterExtendedBoilL: number,
 *   sugarG: number, dmeG: number, diluteL: number
 * }}
 */
export function preboilCorrection({
  measuredSG,
  measuredVolL,
  targetOG,
  boilTimeMin,
  boilOffRateLph,
  toleranceGU = 2,
}) {
  const preGU = (num(measuredSG) - 1) * 1000;
  const preVol = num(measuredVolL);
  const targetGU = (num(targetOG) - 1) * 1000;
  const boilOff = Math.max(0, num(boilOffRateLph));
  const postVol = Math.max(0.1, preVol - (boilOff * num(boilTimeMin)) / 60);
  const totalExtract = preGU * preVol;
  const predictedGU = totalExtract / postVol;

  const result = {
    predictedOG: round(1 + predictedGU / 1000, 3),
    postBoilVolL: round(postVol, 1),
    status: 'ok',
    extendBoilMin: 0,
    volumeAfterExtendedBoilL: round(postVol, 1),
    sugarG: 0,
    dmeG: 0,
    diluteL: 0,
  };
  if (preGU <= 0 || preVol <= 0 || targetGU <= 0) return result;

  if (predictedGU < targetGU - toleranceGU) {
    result.status = 'low';
    const neededVol = totalExtract / targetGU;
    const extraEvap = postVol - neededVol;
    result.extendBoilMin = boilOff > 0 ? Math.ceil((extraEvap / boilOff) * 60) : 0;
    result.volumeAfterExtendedBoilL = round(neededVol, 1);
    const deficit = targetGU * postVol - totalExtract; // GU·L
    result.sugarG = Math.ceil((deficit / GU_PER_KG_SUCROSE) * 1000);
    result.dmeG = Math.ceil((deficit / (GU_PER_KG_SUCROSE * DME_EXTRACT_FACTOR)) * 1000);
  } else if (predictedGU > targetGU + toleranceGU) {
    result.status = 'high';
    result.diluteL = round(totalExtract / targetGU - postVol, 1);
  }
  return result;
}

// ---------------------------------------------------------------------------
// 6. Refraktometer
// ---------------------------------------------------------------------------

/**
 * Converts a refractometer Brix reading of unfermented wort to SG.
 * @param {number} brix - Refractometer reading (°Brix)
 * @param {number} [wcf=1.04] - Wort correction factor
 * @returns {number} Specific gravity
 */
export function brixToSG(brix, wcf = DEFAULT_WORT_CORRECTION_FACTOR) {
  const b = num(brix);
  if (b <= 0) return 1.0;
  return platoToSG(b / (num(wcf) || DEFAULT_WORT_CORRECTION_FACTOR));
}

/**
 * Converts SG to the expected refractometer reading (°Brix) for unfermented wort.
 * @param {number} sg - Specific gravity
 * @param {number} [wcf=1.04] - Wort correction factor
 * @returns {number} °Brix
 */
export function sgToBrix(sg, wcf = DEFAULT_WORT_CORRECTION_FACTOR) {
  return sgToPlato(num(sg)) * (num(wcf) || DEFAULT_WORT_CORRECTION_FACTOR);
}

/**
 * Final gravity from refractometer readings during/after fermentation
 * (Sean Terrill's cubic equation, corrects for alcohol).
 * @param {number} ogBrix - Original reading (°Brix)
 * @param {number} fgBrix - Current reading (°Brix)
 * @param {number} [wcf=1.04] - Wort correction factor
 * @returns {number} Corrected FG (SG)
 */
export function refractometerFG(ogBrix, fgBrix, wcf = DEFAULT_WORT_CORRECTION_FACTOR) {
  const w = num(wcf) || DEFAULT_WORT_CORRECTION_FACTOR;
  const ob = num(ogBrix) / w;
  const fb = num(fgBrix) / w;
  return (
    1.0 -
    0.0044993 * ob +
    0.011774 * fb +
    0.00027581 * ob * ob -
    0.0012717 * fb * fb -
    0.00000728 * ob * ob * ob +
    0.000063293 * fb * fb * fb
  );
}

// ---------------------------------------------------------------------------
// 7. Hydrometer
// ---------------------------------------------------------------------------

/**
 * Temperature correction for hydrometer readings.
 * @param {number} sg - Measured SG
 * @param {number} sampleTempC - Sample temperature in °C
 * @param {number} [calibrationC=20] - Hydrometer calibration temperature in °C
 * @returns {number} Corrected SG
 */
export function hydrometerTempCorrection(sg, sampleTempC, calibrationC = DEFAULT_HYDROMETER_CALIBRATION_C) {
  const density = (f) =>
    1.00130346 - 0.000134722124 * f + 0.00000204052596 * f * f - 0.00000000232820948 * f * f * f;
  return num(sg) * (density(cToF(num(sampleTempC))) / density(cToF(num(calibrationC, 20))));
}

// ---------------------------------------------------------------------------
// 8. Jäst
// ---------------------------------------------------------------------------

/**
 * Target pitch rate in million cells per mL per °P.
 * @param {'ale'|'lager'|'kveik'|string} type - Yeast type
 * @returns {number}
 */
export function pitchRateFor(type) {
  if (type === 'lager') return PITCH_RATE_LAGER;
  if (type === 'kveik') return PITCH_RATE_KVEIK;
  return PITCH_RATE_ALE;
}

/**
 * Viability of liquid yeast given manufacturing date.
 * @param {string|Date} mfgDate - Manufacturing date
 * @param {Date} [today=new Date()] - Reference date
 * @returns {number} Viability fraction (0.1–1.0)
 */
export function liquidYeastViability(mfgDate, today = new Date()) {
  const d = mfgDate instanceof Date ? mfgDate : new Date(mfgDate);
  if (Number.isNaN(d.getTime())) return 1;
  const days = Math.max(0, (today.getTime() - d.getTime()) / 86400000);
  return Math.max(0.1, 1 - days * LIQUID_YEAST_VIABILITY_LOSS_PER_DAY);
}

/**
 * Cells needed and packs required for a batch.
 * @param {{ og: number, volumeL: number, type?: string, form?: 'dry'|'liquid',
 *           packSizeG?: number, mfgDate?: string, today?: Date }} p
 * @returns {{ cellsNeededB: number, cellsPerPackB: number, packs: number,
 *             packsExact: number, grams: number, viability: number }}
 */
export function pitchRate({ og, volumeL, type = 'ale', form = 'dry', packSizeG = 11.5, mfgDate, today }) {
  const plato = sgToPlato(num(og, 1.05));
  const cellsNeededB = pitchRateFor(type) * num(volumeL) * plato; // billions
  let cellsPerPackB;
  let viability = 1;
  if (form === 'liquid') {
    viability = mfgDate ? liquidYeastViability(mfgDate, today) : 1;
    cellsPerPackB = LIQUID_YEAST_BILLION_CELLS_PER_PACK * viability;
  } else {
    cellsPerPackB = num(packSizeG, 11.5) * DRY_YEAST_BILLION_CELLS_PER_GRAM;
  }
  const packsExact = cellsPerPackB > 0 ? cellsNeededB / cellsPerPackB : 0;
  // Accept up to ~10 % below target before recommending an extra pack.
  const packs = Math.max(1, Math.ceil(packsExact * 0.9 - 1e-9));
  return {
    cellsNeededB: round(cellsNeededB, 0),
    cellsPerPackB: round(cellsPerPackB, 0),
    packs,
    packsExact: round(packsExact, 2),
    grams: form === 'dry' ? round(cellsNeededB / DRY_YEAST_BILLION_CELLS_PER_GRAM, 1) : 0,
    viability: round(viability, 2),
  };
}

/**
 * Starter size needed to grow from available to needed cell count
 * (simplified Braukaiser model). Starter wort ≈ 1.036 (100 g DME per liter).
 * @param {{ cellsNeededB: number, cellsAvailableB: number, stirPlate?: boolean }} p
 * @returns {{ liters: number, dmeG: number, finalCellsB: number, needed: boolean }}
 */
export function starterSize({ cellsNeededB, cellsAvailableB, stirPlate = true }) {
  const need = num(cellsNeededB);
  const have = num(cellsAvailableB);
  if (have >= need) return { liters: 0, dmeG: 0, finalCellsB: round(have, 0), needed: false };

  const growthFactor = stirPlate ? 1.0 : 0.5;
  const grow = (liters) => {
    const extractG = liters * STARTER_EXTRACT_G_PER_L;
    const inoculation = have / extractG; // B cells per g extract
    const perGram = inoculation < 1.4 ? 1.4 : Math.max(0, 2.33 - 0.67 * inoculation);
    return extractG * perGram * growthFactor;
  };

  for (let liters = 0.5; liters <= 5; liters += 0.25) {
    const total = have + grow(liters);
    if (total >= need) {
      return { liters, dmeG: Math.round(liters * 100), finalCellsB: round(total, 0), needed: true };
    }
  }
  return { liters: 5, dmeG: 500, finalCellsB: round(have + grow(5), 0), needed: true };
}

// ---------------------------------------------------------------------------
// 11. Syra för pH-justering
// ---------------------------------------------------------------------------

/**
 * Acid options. Strength in % w/w with density (g/mL) used for mEq/mL.
 * @type {Record<string, { label: string, strengths: Record<number, number> }>}
 */
export const ACIDS = {
  lactic: { label: 'Mjölksyra', strengths: { 80: 1.19, 88: 1.209 } },
  phosphoric: { label: 'Fosforsyra', strengths: { 10: 1.053, 75: 1.579 } },
};

/**
 * Milliequivalents of acidity per mL of acid solution at mash pH.
 * @param {'lactic'|'phosphoric'} acid
 * @param {number} strengthPct - Strength in % (e.g. 80)
 * @param {number} [atPH=5.4] - pH at which dissociation is evaluated
 * @returns {number} mEq per mL
 */
export function acidMeqPerMl(acid, strengthPct, atPH = 5.4) {
  const def = ACIDS[acid] || ACIDS.lactic;
  const pct = num(strengthPct, acid === 'phosphoric' ? 10 : 80);
  const density = def.strengths[pct] ?? 1 + pct * 0.0024;
  if (acid === 'phosphoric') {
    // First proton fully dissociated at mash pH; second negligible.
    return ((density * (pct / 100)) / PHOSPHORIC_ACID_MW) * 1000;
  }
  const dissociation = 1 / (1 + 10 ** (LACTIC_ACID_PKA - atPH));
  return ((density * (pct / 100)) / LACTIC_ACID_MW) * 1000 * dissociation;
}

/**
 * Acid needed to bring the estimated mash pH down to a target.
 * Exact inverse of estimateMashPH: required mEq = ΔpH × grist buffer capacity,
 * so the result is consistent with the pH shown in the app.
 * @param {{ waterProfile: object, fermentables: Array, mashRatio?: number,
 *           targetPH?: number, acid?: 'lactic'|'phosphoric', strengthPct?: number }} p
 * @returns {{ currentPH: number, targetPH: number, mEq: number, ml: number,
 *             acidulatedMaltG: number, acidulatedMaltPct: number }}
 */
export function acidAddition({
  waterProfile,
  fermentables,
  mashRatio = 3,
  targetPH = 5.4,
  acid = 'lactic',
  strengthPct = 80,
}) {
  const currentPH = estimateMashPH(waterProfile || {}, fermentables || [], mashRatio);
  const base = { currentPH, targetPH, mEq: 0, ml: 0, acidulatedMaltG: 0, acidulatedMaltPct: 0 };
  const delta = currentPH - num(targetPH, 5.4);
  const { bufferMeqPerPH } = gristBuffer(fermentables);
  if (delta <= 0 || bufferMeqPerPH <= 0) return base;

  const mEq = delta * bufferMeqPerPH;
  const ml = mEq / acidMeqPerMl(acid, strengthPct, targetPH);

  const lacticMeqPerG = (1 / LACTIC_ACID_MW) * 1000 / (1 + 10 ** (LACTIC_ACID_PKA - targetPH));
  const acidMaltG = mEq / (ACIDULATED_MALT_LACTIC_FRACTION * lacticMeqPerG);
  const grainG = (fermentables || [])
    .filter((f) => f.type !== 'sugar')
    .reduce((s, f) => s + num(f.amount) * 1000, 0);

  return {
    currentPH,
    targetPH,
    mEq: round(mEq, 1),
    ml: round(ml, 1),
    acidulatedMaltG: Math.round(acidMaltG),
    acidulatedMaltPct: grainG > 0 ? round((acidMaltG / grainG) * 100, 1) : 0,
  };
}

/**
 * Acid needed to treat sparge water (neutralize bicarbonate alkalinity) so the
 * sparge water reaches roughly the target pH (default 5.7). Prevents tannin
 * extraction during lautering.
 * @param {{ hco3: number, spargeL: number, targetPH?: number, acid?: 'lactic'|'phosphoric', strengthPct?: number }} p
 * @returns {{ mEq: number, ml: number }}
 */
export function spargeAcid({ hco3, spargeL, targetPH = 5.7, acid = 'lactic', strengthPct = 80 }) {
  const alkMeqPerL = num(hco3) / 61;
  const fractionNeutralized = 1 - 1 / (1 + 10 ** (CARBONIC_ACID_PKA1 - num(targetPH, 5.7)));
  const mEq = alkMeqPerL * fractionNeutralized * num(spargeL);
  if (mEq <= 0) return { mEq: 0, ml: 0 };
  return { mEq: round(mEq, 1), ml: round(mEq / acidMeqPerMl(acid, strengthPct, targetPH), 1) };
}
