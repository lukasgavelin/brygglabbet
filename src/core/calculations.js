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
 * Calculates IBUs for all hop additions.
 * @param {Array<{amount: number, alpha: number, time?: number, form?: string, use?: string}>} hops
 * @param {number} og_sg - Original Gravity in SG
 * @param {number} volume_L - Volume in liters
 * @returns {{ total: number, perHop: number[] }}
 */
export function calculateIBU(hops, og_sg, volume_L) {
  if (!volume_L || volume_L <= 0) return { total: 0, perHop: [] };
  const boilSG = 1 + (og_sg - 1) * 0.5;

  let total = 0;
  const perHop = hops.map((h) => {
    if (h.use === 'dry-hop' || h.use === 'torrhumle') return 0;
    const pelletBonus = h.form === 'pellets' ? PELLET_UTILIZATION_MULTIPLIER : 1.0;
    const u = tinsethUtilization(boilSG, h.time || 0);
    const ibu = (h.amount * (h.alpha / 100) * u * pelletBonus * 1000) / volume_L;
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
 * Estimates mash pH based on water profile and dark malt proportion.
 * @param {Record<string, number>} waterProfile - Water profile
 * @param {Array<{amount: number, ebc: number}>} fermentables - Grain bill
 * @returns {number} Estimated mash pH
 */
export function estimateMashPH(waterProfile, fermentables) {
  const ra = calculateResidualAlkalinity(waterProfile);
  const totalKg = fermentables.reduce((s, f) => s + (f.amount || 0), 0);

  let darkAdjust = 0;
  fermentables.forEach((f) => {
    if (f.ebc > 300 && totalKg > 0) {
      darkAdjust -= 0.025 * (f.amount / totalKg) * 100;
    } else if (f.ebc > 120 && totalKg > 0) {
      darkAdjust -= 0.01 * (f.amount / totalKg) * 100;
    } else if (f.ebc > 40 && totalKg > 0) {
      darkAdjust -= 0.005 * (f.amount / totalKg) * 100;
    }
  });

  const raAdjust = ra / 357;
  const estimatedPH = MASH_PH_REFERENCE + darkAdjust + raAdjust;
  return Math.min(6.5, Math.max(4.5, estimatedPH));
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
