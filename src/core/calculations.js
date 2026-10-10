/**
 * Pure calculation functions for brewing calculations.
 * Clean Code: Pure functions, zero side effects, full JSDoc typing.
 */

import {
  GU_PER_KG_SUCROSE,
  METRIC_TO_MCU_FACTOR,
  SRM_TO_EBC_MULTIPLIER,
  MOREY_EXPONENT,
  MOREY_MULTIPLIER,
  ABV_MULTIPLIER,
  TINSETH_BIGNESS_FACTOR,
  TINSETH_BIGNESS_BASE,
  TINSETH_TIME_FACTOR,
  TINSETH_TIME_DIVISOR,
  PELLET_UTILIZATION_MULTIPLIER,
  WHIRLPOOL_ARRHENIUS_A,
  WHIRLPOOL_ARRHENIUS_EA_R,
  WHIRLPOOL_DEFAULT_TEMP_C,
  WHIRLPOOL_DEFAULT_MINUTES,
  TYPICAL_BOIL_GRAVITY_FRACTION,
  MASH_PH_REFERENCE,
  ALKALINITY_HCO3_TO_CACO3,
  RA_CA_DIVISOR,
  RA_MG_DIVISOR,
} from '../constants.js';
import { SALT_IONS } from './data.js';

/**
 * Converts Specific Gravity (SG) to degrees Plato (°P).
 * @param {number} sg - Specific gravity (e.g. 1.050)
 * @returns {number} Value in degrees Plato
 */
export function sgToPlato(sg) {
  if (sg <= 1.0) return 0;
  return -668.962 + 1262.45 * sg - 776.43 * sg * sg + 182.94 * sg * sg * sg;
}

/**
 * Converts degrees Plato (°P) to Specific Gravity (SG).
 * @param {number} plato - Degrees Plato
 * @returns {number} Specific gravity
 */
export function platoToSG(plato) {
  if (plato <= 0) return 1.0;
  return 1 + plato / (258.6 - (plato / 258.2) * 227.1);
}

/**
 * Formats SG to 3 decimal places.
 * @param {number} sg - Specific gravity
 * @returns {string} Formatted string (e.g. "1.050")
 */
export function formatSG(sg) {
  return sg.toFixed(3);
}

/**
 * Formats °Plato to 1 decimal place with unit.
 * @param {number} p - Degrees Plato
 * @returns {string} Formatted string (e.g. "12.5 °P")
 */
export function formatPlato(p) {
  return `${p.toFixed(1)} °P`;
}

/**
 * Calculates Original Gravity (OG).
 * @param {Array<{amount: number, yield: number, type?: string}>} fermentables
 * @param {number} batchVolume - Batch volume in liters
 * @param {number} efficiency - Efficiency in percent (0-100)
 * @returns {{ sg: number, plato: number, guPerFermentable: number[] }}
 */
export function calculateOG(fermentables, batchVolume, efficiency) {
  if (!batchVolume || batchVolume <= 0) return { sg: 1.0, plato: 0, guPerFermentable: [] };
  const effFraction = efficiency / 100;
  let totalGU = 0;
  const guPerFermentable = fermentables.map((f) => {
    const eff = f.type === 'sugar' ? 1.0 : effFraction;
    const gu = (f.amount * (f.yield / 100) * GU_PER_KG_SUCROSE * eff) / batchVolume;
    totalGU += gu;
    return gu;
  });
  const sg = 1 + totalGU / 1000;
  return { sg, plato: sgToPlato(sg), guPerFermentable };
}

/**
 * Calculates pre-boil gravity based on target OG and volumes.
 * @param {number} og_sg - Target OG in SG
 * @param {number} batchVolume - Target batch volume in liters
 * @param {number} boilVolume - Pre-boil volume in liters
 * @returns {number} Pre-boil gravity in SG
 */
export function calculatePreboilGravity(og_sg, batchVolume, boilVolume) {
  if (!boilVolume || boilVolume <= 0) return 1.0;
  const totalExtract_GU = (og_sg - 1) * 1000 * batchVolume;
  const preBoil_GU = totalExtract_GU / boilVolume;
  return 1 + preBoil_GU / 1000;
}

/**
 * Calculates Final Gravity (FG) given OG and apparent attenuation percentage.
 * @param {number} og_sg - OG in SG
 * @param {number} attenuation - Apparent attenuation percentage (e.g. 75)
 * @returns {number} FG in SG
 */
export function calculateFG(og_sg, attenuation) {
  const og_plato = sgToPlato(og_sg);
  const fg_plato = og_plato * (1 - attenuation / 100);
  return platoToSG(Math.max(0, fg_plato));
}

/**
 * Calculates Alcohol By Volume (ABV) percentage from OG and FG.
 * @param {number} og_sg - OG in SG
 * @param {number} fg_sg - FG in SG
 * @returns {number} ABV percentage
 */
export function calculateABV(og_sg, fg_sg) {
  return (og_sg - fg_sg) * ABV_MULTIPLIER;
}

/**
 * Calculates Apparent Attenuation percentage.
 * @param {number} og_sg - OG in SG
 * @param {number} fg_sg - FG in SG
 * @returns {number} Attenuation percentage
 */
export function calculateApparentAttenuation(og_sg, fg_sg) {
  if (og_sg <= 1.0) return 0;
  return ((og_sg - fg_sg) / (og_sg - 1.0)) * 100;
}

/**
 * Calculates Tinseth utilization factor for a hop addition.
 * @param {number} og_sg - Boil gravity
 * @param {number} time_min - Boil time in minutes
 * @returns {number} Utilization factor
 */
export function tinsethUtilization(og_sg, time_min) {
  if (time_min <= 0) return 0;
  const bigness = TINSETH_BIGNESS_FACTOR * Math.pow(TINSETH_BIGNESS_BASE, og_sg - 1);
  const timeFactor = (1 - Math.exp(-TINSETH_TIME_FACTOR * time_min)) / TINSETH_TIME_DIVISOR;
  return bigness * timeFactor;
}

/**
 * Estimates the average wort gravity during the boil (used by Tinseth).
 * Average of pre-boil and post-boil gravity. If pre-boil gravity is unknown,
 * a typical fraction of the OG gravity points is used.
 * @param {number} og_sg - Post-boil gravity (OG) in SG
 * @param {number} [preboil_sg] - Pre-boil gravity in SG
 * @returns {number} Average boil gravity in SG
 */
export function estimateBoilGravity(og_sg, preboil_sg) {
  if (!og_sg || og_sg <= 1) return 1.0;
  if (preboil_sg && preboil_sg > 1 && preboil_sg <= og_sg) {
    return (og_sg + preboil_sg) / 2;
  }
  return 1 + (og_sg - 1) * TYPICAL_BOIL_GRAVITY_FRACTION;
}

/**
 * Relative alpha-acid isomerization rate at a given temperature compared to a
 * rolling boil (100°C), based on Malowicki & Shellhammer (2005).
 * ≈1.00 at 100°C, ≈0.49 at 90°C, ≈0.23 at 80°C, ≈0.10 at 70°C.
 * @param {number} tempC - Wort temperature in °C
 * @returns {number} Relative rate (0–~1)
 */
export function whirlpoolTempFactor(tempC) {
  const t = Number(tempC);
  if (!Number.isFinite(t) || t <= 0) return 0;
  const kelvin = Math.min(t, 100) + 273.15;
  return Math.min(1, WHIRLPOOL_ARRHENIUS_A * Math.exp(-WHIRLPOOL_ARRHENIUS_EA_R / kelvin));
}

/**
 * Tinseth utilization for a whirlpool / hop stand addition.
 * @param {number} boil_sg - Wort gravity
 * @param {number} minutes - Contact time in whirlpool
 * @param {number} tempC - Average whirlpool temperature
 * @returns {number} Utilization factor
 */
export function whirlpoolUtilization(boil_sg, minutes, tempC) {
  return tinsethUtilization(boil_sg, minutes) * whirlpoolTempFactor(tempC);
}

/**
 * Calculates IBUs for all hop additions (Tinseth).
 * @param {Array<{amount: number, alpha: number, time?: number, form?: string, use?: string, whirlpoolTemp?: number}>} hops
 * @param {number} og_sg - Original Gravity in SG
 * @param {number} volume_L - Volume in liters
 * @param {{ boilGravity?: number }} [options] - Average boil gravity (defaults to an estimate from OG)
 * @returns {{ total: number, perHop: number[] }}
 */
export function calculateIBU(hops, og_sg, volume_L, options = {}) {
  if (!volume_L || volume_L <= 0) return { total: 0, perHop: [] };
  const boilSG = options.boilGravity && options.boilGravity > 1
    ? options.boilGravity
    : estimateBoilGravity(og_sg);

  let total = 0;
  const perHop = hops.map((h) => {
    if (h.use === 'dry-hop' || h.use === 'torrhumle') return 0;
    const pelletBonus = h.form === 'pellets' ? PELLET_UTILIZATION_MULTIPLIER : 1.0;
    let u;
    if (h.use === 'whirlpool') {
      const minutes = Number(h.time) > 0 ? Number(h.time) : WHIRLPOOL_DEFAULT_MINUTES;
      const temp = Number(h.whirlpoolTemp) > 0 ? Number(h.whirlpoolTemp) : WHIRLPOOL_DEFAULT_TEMP_C;
      u = whirlpoolUtilization(boilSG, minutes, temp);
    } else {
      u = tinsethUtilization(boilSG, Number(h.time) || 0);
    }
    const ibu = ((Number(h.amount) || 0) * ((Number(h.alpha) || 0) / 100) * u * pelletBonus * 1000) / volume_L;
    total += ibu;
    return ibu;
  });
  return { total, perHop };
}

/**
 * Calculates color in EBC scale using the Morey equation.
 * @param {Array<{amount: number, ebc: number}>} fermentables
 * @param {number} volume_L - Batch volume in liters
 * @returns {{ ebc: number, perFermentable: number[] }}
 */
export function calculateEBC(fermentables, volume_L) {
  if (!volume_L || volume_L <= 0) return { ebc: 0, perFermentable: [] };

  let totalMCU = 0;
  const perFermentable = fermentables.map((f) => {
    const mcu = (f.amount * f.ebc * METRIC_TO_MCU_FACTOR) / volume_L;
    totalMCU += mcu;
    return mcu * (SRM_TO_EBC_MULTIPLIER * MOREY_MULTIPLIER);
  });

  const srm = MOREY_MULTIPLIER * Math.pow(totalMCU, MOREY_EXPONENT);
  const ebc = srm * SRM_TO_EBC_MULTIPLIER;
  return { ebc: Math.max(0, ebc), perFermentable };
}

/**
 * Converts EBC color value to RGB CSS string.
 * @param {number} ebc - Color value in EBC
 * @returns {string} CSS rgb() string
 */
export function ebcToColor(ebc) {
  const colorMap = [
    { ebc: 2, hex: [249, 249, 163] },
    { ebc: 4, hex: [245, 230, 80] },
    { ebc: 6, hex: [230, 200, 30] },
    { ebc: 8, hex: [220, 175, 20] },
    { ebc: 12, hex: [210, 145, 22] },
    { ebc: 16, hex: [195, 110, 18] },
    { ebc: 20, hex: [175, 88, 15] },
    { ebc: 30, hex: [148, 60, 14] },
    { ebc: 40, hex: [120, 38, 10] },
    { ebc: 60, hex: [85, 22, 8] },
    { ebc: 80, hex: [58, 12, 5] },
    { ebc: 120, hex: [35, 7, 3] },
    { ebc: 200, hex: [18, 3, 1] },
    { ebc: 400, hex: [6, 1, 0] },
  ];

  if (ebc <= colorMap[0].ebc) return `rgb(${colorMap[0].hex.join(',')})`;
  if (ebc >= colorMap[colorMap.length - 1].ebc) {
    const last = colorMap[colorMap.length - 1].hex;
    return `rgb(${last.join(',')})`;
  }

  for (let i = 0; i < colorMap.length - 1; i++) {
    const lo = colorMap[i];
    const hi = colorMap[i + 1];
    if (ebc >= lo.ebc && ebc <= hi.ebc) {
      const t = (ebc - lo.ebc) / (hi.ebc - lo.ebc);
      const r = Math.round(lo.hex[0] + t * (hi.hex[0] - lo.hex[0]));
      const g = Math.round(lo.hex[1] + t * (hi.hex[1] - lo.hex[1]));
      const b = Math.round(lo.hex[2] + t * (hi.hex[2] - lo.hex[2]));
      return `rgb(${r},${g},${b})`;
    }
  }
  return 'rgb(6,1,0)';
}

/**
 * Returns human readable color label based on EBC value.
 * @param {number} ebc - EBC color
 * @returns {string} Swedish color description
 */
export function ebcToLabel(ebc) {
  if (ebc < 4) return 'Halmgul';
  if (ebc < 8) return 'Ljusgul';
  if (ebc < 12) return 'Gulguld';
  if (ebc < 18) return 'Djupguld';
  if (ebc < 25) return 'Amber';
  if (ebc < 35) return 'Djup Amber';
  if (ebc < 50) return 'Koppar / Rödbrun';
  if (ebc < 70) return 'Brun';
  if (ebc < 100) return 'Mörkbrun';
  if (ebc < 150) return 'Nästan svart';
  return 'Svart';
}

/**
 * Calculates Bitterness-to-Gravity ratio (BU:GU).
 * @param {number} ibu - Total IBU
 * @param {number} og_sg - OG in SG
 * @returns {number} BU:GU ratio
 */
export function calculateBUGU(ibu, og_sg) {
  const gu = (og_sg - 1) * 1000;
  if (gu <= 0) return 0;
  return ibu / gu;
}

/**
 * Calculates water profile ion concentrations after adding salts.
 * @param {Record<string, number>} base - Base water profile
 * @param {Record<string, number>} salts - Salt additions in grams
 * @param {number} vol - Water volume in liters
 * @returns {Record<string, number>} Resulting ion concentrations in ppm
 */
export function calculateWaterProfile(base, salts, vol) {
  if (!vol || vol <= 0) return { ...base };
  const result = { ca: 0, mg: 0, na: 0, cl: 0, so4: 0, hco3: 0 };
  const ions = ['ca', 'mg', 'na', 'cl', 'so4', 'hco3'];

  ions.forEach((ion) => {
    result[ion] = base[ion] || 0;
  });

  Object.entries(salts).forEach(([salt, grams]) => {
    if (!grams || grams <= 0 || !SALT_IONS[salt]) return;
    ions.forEach((ion) => {
      result[ion] += (SALT_IONS[salt][ion] * grams) / vol;
    });
  });

  ions.forEach((ion) => {
    result[ion] = Math.round(result[ion] * 10) / 10;
  });
  return result;
}

/**
 * Calculates Residual Alkalinity (RA) in ppm as CaCO3.
 * @param {Record<string, number>} profile - Water profile ions
 * @returns {number} Residual alkalinity
 */
export function calculateResidualAlkalinity(profile) {
  const alk_CaCO3 = (profile.hco3 || 0) * ALKALINITY_HCO3_TO_CACO3;
  return alk_CaCO3 - (profile.ca || 0) / RA_CA_DIVISOR - (profile.mg || 0) / RA_MG_DIVISOR;
}

/**
 * Distilled-water pH and buffer capacity for a single malt, estimated from its
 * type and color. Based on published measurements by Troester (Braukaiser) and
 * Riffe's charge-balance model:
 *  - Base malts: pH ≈ 5.75 falling with kilning color, buffer ≈ 40 mEq/(kg·pH)
 *  - Crystal/caramel: pH ≈ 5.22 − 0.00504·°L, buffer ≈ 50
 *  - Roasted malts: pH ≈ 4.6–5.1, buffer ≈ 59
 *  - Flaked adjuncts: pH ≈ 5.9, low buffer ≈ 25
 * @param {{ ebc?: number, type?: string }} malt
 * @returns {{ pH: number, buffer: number }}
 */
export function maltAcidityProfile(malt) {
  const ebc = Math.max(0, Number(malt?.ebc) || 0);
  const type = malt?.type || 'base';
  if (type === 'roasted') {
    return { pH: Math.max(4.6, 5.2 - ebc / 1500), buffer: 59 };
  }
  if (type === 'cara' && ebc > 10) {
    const srm = ebc / SRM_TO_EBC_MULTIPLIER;
    const lovibond = (srm + 0.76) / 1.3546;
    return { pH: Math.max(4.5, 5.22 - 0.00504 * lovibond), buffer: 50 };
  }
  if (type === 'adjunct') {
    return { pH: 5.9, buffer: 25 };
  }
  return { pH: Math.max(5.3, 5.75 - 0.012 * ebc), buffer: 40 };
}

/**
 * Grist distilled-water pH and total buffer capacity (charge-balance mix).
 * @param {Array<{amount: number, ebc?: number, type?: string}>} fermentables
 * @returns {{ distilledPH: number, bufferMeqPerPH: number, grainKg: number }}
 */
export function gristBuffer(fermentables) {
  let weighted = 0;
  let buffer = 0;
  let grainKg = 0;
  (fermentables || []).forEach((f) => {
    if (f.type === 'sugar') return;
    const kg = Number(f.amount) || 0;
    if (kg <= 0) return;
    const p = maltAcidityProfile(f);
    weighted += kg * p.buffer * p.pH;
    buffer += kg * p.buffer;
    grainKg += kg;
  });
  if (buffer <= 0) return { distilledPH: MASH_PH_REFERENCE, bufferMeqPerPH: 0, grainKg: 0 };
  return { distilledPH: weighted / buffer, bufferMeqPerPH: buffer, grainKg };
}

/**
 * Estimates mash pH with a charge-balance model (Troester / Riffe).
 * pH = grist distilled-water pH + (water residual alkalinity in mEq) / grist buffer.
 *
 * @param {Record<string, number>} waterProfile - Ion concentrations in ppm
 * @param {Array<{amount: number, ebc: number, type?: string}>} fermentables - Grain bill
 * @param {number} [mashRatio=3.0] - Water to grain ratio in L/kg
 * @returns {number} Estimated mash pH (clamped between 4.50 and 6.50)
 */
export function estimateMashPH(waterProfile, fermentables, mashRatio = 3.0) {
  const { distilledPH, bufferMeqPerPH, grainKg } = gristBuffer(fermentables);
  if (bufferMeqPerPH <= 0) return MASH_PH_REFERENCE;

  const ratio = Math.max(1.5, Number(mashRatio) || 3.0);
  const mashWaterL = grainKg * ratio;
  const raMeqPerL = calculateResidualAlkalinity(waterProfile || {}) / 50;
  const raDeltaPH = (raMeqPerL * mashWaterL) / bufferMeqPerPH;

  const estimatedPH = distilledPH + raDeltaPH;
  return Math.min(6.5, Math.max(4.5, Math.round(estimatedPH * 100) / 100));
}

/**
 * Calculates Chloride to Sulfate ratio and descriptive balance text.
 * @param {Record<string, number>} profile - Water profile
 * @returns {{ ratio: number, label: string, color: string }}
 */
export function chlorideSulfateBalance(profile) {
  const so4 = profile.so4 || 1;
  const ratio = (profile.cl || 0) / so4;
  let label;
  let color;
  if (ratio > 2.0) {
    label = 'Mycket maltbetonat';
    color = '#2e7d32';
  } else if (ratio > 1.2) {
    label = 'Maltbetonat';
    color = '#388e3c';
  } else if (ratio > 0.8) {
    label = 'Balanserat';
    color = '#f57c00';
  } else if (ratio > 0.4) {
    label = 'Humlebetonat';
    color = '#e65100';
  } else {
    label = 'Mycket humlebetonat';
    color = '#c62828';
  }
  return { ratio: Math.round(ratio * 100) / 100, label, color };
}

/**
 * Checks if calculated recipe metrics match a given style guide entry.
 * @param {{ og: number, fg: number, ibu: number, ebc: number, abv: number }} values
 * @param {object} style - Style entry from STYLES database
 * @returns {{ match: boolean, details: Record<string, object> }}
 */
export function checkStyleMatch(values, style) {
  const details = {};
  const checks = [
    { key: 'og', min: style.og_min, max: style.og_max, val: values.og, label: 'OG (SG)' },
    { key: 'fg', min: style.fg_min, max: style.fg_max, val: values.fg, label: 'FG (SG)' },
    { key: 'ibu', min: style.ibu_min, max: style.ibu_max, val: values.ibu, label: 'IBU' },
    { key: 'ebc', min: style.ebc_min, max: style.ebc_max, val: values.ebc, label: 'EBC' },
    { key: 'abv', min: style.abv_min, max: style.abv_max, val: values.abv, label: 'ABV' },
  ];
  let allMatch = true;
  checks.forEach((c) => {
    const inRange = c.val >= c.min && c.val <= c.max;
    if (!inRange) allMatch = false;
    details[c.key] = { ...c, inRange };
  });
  return { match: allMatch, details };
}

/**
 * Calculates required brewing water volumes based on equipment profile and grain bill.
 * @param {object} equipment - Equipment profile parameters
 * @param {Array<{amount: number, type?: string}>} fermentables - Grain bill
 * @param {number} boilTime - Boil time in minutes
 * @returns {{
 *   boilVolume: number,
 *   grainAbsorptionLoss: number,
 *   totalWater: number,
 *   mashWater: number,
 *   spargeWater: number,
 *   totalGrainKg: number
 * }}
 */
export function calculateWaterVolumes(equipment, fermentables = [], boilTime = 60) {
  const batchVol = Number(equipment?.batchVolume) || 20;
  const boilOffRate = Number(equipment?.boilOffRate) || 3.0;
  const kettleLoss = Number(equipment?.kettleLoss) || 2.0;
  const fermenterLoss = Number(equipment?.fermenterLoss) || 1.0;
  const grainAbs = Number(equipment?.grainAbsorption) || 0.96;
  const mashRatio = Number(equipment?.mashRatio) || 3.0;

  const totalGrainKg = fermentables.reduce((sum, f) => {
    if (f.type === 'sugar') return sum;
    return sum + (Number(f.amount) || 0);
  }, 0);

  const boilHours = boilTime / 60;
  const boilOffTotal = boilOffRate * boilHours;
  const boilVolume = Math.round((batchVol + boilOffTotal + kettleLoss + fermenterLoss) * 10) / 10;

  const grainAbsorptionLoss = Math.round(totalGrainKg * grainAbs * 10) / 10;
  const totalWater = Math.round((boilVolume + grainAbsorptionLoss) * 10) / 10;
  const mashWater = Math.round(totalGrainKg * mashRatio * 10) / 10;
  const spargeWater = Math.round(Math.max(0, totalWater - mashWater) * 10) / 10;

  return {
    boilVolume,
    grainAbsorptionLoss,
    totalWater,
    mashWater,
    spargeWater,
    totalGrainKg: Math.round(totalGrainKg * 100) / 100,
  };
}

/**
 * Scales fermentables and hops in state to target batch volume and efficiency.
 * @param {object} state - Current application state
 * @param {number} targetBatchVolume - New target batch volume in liters
 * @param {number} targetEfficiency - New target efficiency in percent (optional)
 * @returns {object} New state object with scaled fermentables and hops
 */
export function scaleRecipe(state, targetBatchVolume, targetEfficiency = null) {
  const oldBatchVol = Number(state.recipe.batchVolume) || 20;
  const newBatchVol = Number(targetBatchVolume) || 20;

  if (oldBatchVol <= 0 || newBatchVol <= 0) return state;

  const volRatio = newBatchVol / oldBatchVol;

  let effRatio = 1.0;
  if (targetEfficiency !== null && targetEfficiency > 0) {
    const oldEff = Number(state.recipe.efficiency) || 75;
    const newEff = Number(targetEfficiency) || 75;
    effRatio = oldEff / newEff;
  }

  const scaledFermentables = (state.fermentables || []).map((f) => {
    const isSugar = f.type === 'sugar';
    const mult = isSugar ? volRatio : volRatio * effRatio;
    return {
      ...f,
      amount: Math.round(f.amount * mult * 100) / 100,
    };
  });

  const scaledHops = (state.hops || []).map((h) => {
    return {
      ...h,
      amount: Math.round(h.amount * volRatio * 10) / 10,
    };
  });

  return {
    ...state,
    recipe: {
      ...state.recipe,
      batchVolume: newBatchVol,
      efficiency: targetEfficiency !== null ? targetEfficiency : state.recipe.efficiency,
    },
    equipment: {
      ...state.equipment,
      batchVolume: newBatchVol,
      efficiency: targetEfficiency !== null ? targetEfficiency : state.equipment?.efficiency || 75,
    },
    fermentables: scaledFermentables,
    hops: scaledHops,
  };
}

/**
 * Computes all derived recipe metrics from an application state in one place.
 * Single source of truth for OG, FG, ABV, IBU, EBC, BU:GU, pre-boil values and
 * water volumes, so that every view (sidebar, badges, tables, mobile, print,
 * brew day) presents identical numbers.
 *
 * @param {object} state - Application state (see AppState in types.js)
 * @returns {{
 *   batchVolume: number, efficiency: number, boilTime: number,
 *   og: number, plato: number, guPerFermentable: number[],
 *   attenuation: number, fg: number, fgPlato: number, apparentAttenuation: number, abv: number,
 *   ibu: number, ibuPerHop: number[], ebc: number, ebcPerFermentable: number[], bugu: number,
 *   preboilVolume: number, preboilSG: number, preboilPlato: number, boilSG: number,
 *   evaporationPct: number, volumes: ReturnType<typeof calculateWaterVolumes>
 * }}
 */
export function computeRecipeMetrics(state) {
  const recipe = state?.recipe || {};
  const equipment = state?.equipment || {};
  const fermentables = state?.fermentables || [];
  const hops = state?.hops || [];
  const yeast = state?.yeast || {};

  const batchVolume = Number(recipe.batchVolume) || Number(equipment.batchVolume) || 20;
  const efficiency = Number(recipe.efficiency) || Number(equipment.efficiency) || 75;
  const boilTime = Number(recipe.boilTime) || 60;

  const ogResult = calculateOG(fermentables, batchVolume, efficiency);
  const og = ogResult.sg;

  const attMin = Number(yeast.attMin ?? 72);
  const attMax = Number(yeast.attMax ?? 78);
  const attenuation = (attMin + attMax) / 2;
  const fg = calculateFG(og, attenuation);

  const volumes = calculateWaterVolumes(equipment, fermentables, boilTime);
  const preboilVolume = volumes.boilVolume;
  const preboilSG = calculatePreboilGravity(og, batchVolume, preboilVolume);
  const boilSG = estimateBoilGravity(og, preboilSG);

  const ibuResult = calculateIBU(hops, og, batchVolume, { boilGravity: boilSG });
  const ebcResult = calculateEBC(fermentables, batchVolume);

  const evaporationPct =
    preboilVolume > 0 ? ((preboilVolume - batchVolume) / preboilVolume) * 100 : 0;

  return {
    batchVolume,
    efficiency,
    boilTime,
    og,
    plato: ogResult.plato,
    guPerFermentable: ogResult.guPerFermentable,
    attenuation,
    fg,
    fgPlato: sgToPlato(fg),
    apparentAttenuation: calculateApparentAttenuation(og, fg),
    abv: calculateABV(og, fg),
    ibu: ibuResult.total,
    ibuPerHop: ibuResult.perHop,
    ebc: ebcResult.ebc,
    ebcPerFermentable: ebcResult.perFermentable,
    bugu: calculateBUGU(ibuResult.total, og),
    preboilVolume,
    preboilSG,
    preboilPlato: sgToPlato(preboilSG),
    boilSG,
    evaporationPct,
    volumes,
  };
}

