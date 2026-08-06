// ============================================================
//  calculations.js  –  Alla bryggberäkningar
//  Europeisk/svensk standard: liter, gram, kg, °Plato, EBC, IBU
// ============================================================

// ----------------------------------------------------------
//  ENHETSKONVERTERING
// ----------------------------------------------------------

/**
 * Konverterar Specifik Gravitet (SG) till grader Plato (°P).
 * Använder ASBC-polynomial (exakt).
 */
function sgToPlato(sg) {
  if (sg <= 1.0) return 0;
  return -668.962 + 1262.45 * sg - 776.43 * sg * sg + 182.94 * sg * sg * sg;
}

/**
 * Konverterar grader Plato (°P) till Specifik Gravitet (SG).
 */
function platoToSG(plato) {
  if (plato <= 0) return 1.0;
  return 1 + plato / (258.6 - (plato / 258.2) * 227.1);
}

/**
 * Formaterar SG med 3 decimaler (t.ex. 1.052).
 */
function formatSG(sg) {
  return sg.toFixed(3);
}

/**
 * Formaterar °Plato med 1 decimal (t.ex. 12.8 °P).
 */
function formatPlato(p) {
  return p.toFixed(1) + ' °P';
}

// ----------------------------------------------------------
//  STAMMVÖRTSGRAVITET (OG)
//  Formel: OG_GU = Σ(vikt_kg × utbyte × 384 × effektivitet) / volym_L
//  384 = GU per kg rent socker per liter (konverterat från PPG)
// ----------------------------------------------------------

/**
 * Beräknar stammvörtsgraviteten (OG) som SG och °Plato.
 * @param {Array}  fermentables  - Array av {amount, yield, type}
 * @param {number} batchVolume   - Bryggvolym i liter
 * @param {number} efficiency    - Bryggverkseffektivitet i % (0-100)
 * @returns {{ sg: number, plato: number, guPerFermentable: Array }}
 */
function calculateOG(fermentables, batchVolume, efficiency) {
  if (!batchVolume || batchVolume <= 0) return { sg: 1.0, plato: 0, guPerFermentable: [] };
  const effFraction = efficiency / 100;
  let totalGU = 0;
  const guPerFermentable = fermentables.map(f => {
    // Socker (type='sugar') påverkas inte av mäskeffektivitet
    const eff = (f.type === 'sugar') ? 1.0 : effFraction;
    const gu = (f.amount * (f.yield / 100) * 384 * eff) / batchVolume;
    totalGU += gu;
    return gu;
  });
  const sg = 1 + totalGU / 1000;
  return { sg, plato: sgToPlato(sg), guPerFermentable };
}

/**
 * Beräknar förkoksgraviteten (pre-boil gravity).
 * @param {number} og_sg       - Stammvörtsgravitet (SG)
 * @param {number} batchVolume - Bryggvolym i liter
 * @param {number} boilVolume  - Kokvolym i liter
 */
function calculatePreboilGravity(og_sg, batchVolume, boilVolume) {
  if (!boilVolume || boilVolume <= 0) return 1.0;
  const totalExtract_GU = (og_sg - 1) * 1000 * batchVolume;
  const preBoil_GU = totalExtract_GU / boilVolume;
  return 1 + preBoil_GU / 1000;
}

// ----------------------------------------------------------
//  SLUTGRAVITET (FG) & ABV
// ----------------------------------------------------------

/**
 * Beräknar förväntad slutgravitet baserat på OG och förjäsningsgrad.
 * @param {number} og_sg       - Stammvörtsgravitet (SG)
 * @param {number} attenuation - Förjäsningsgrad i % (t.ex. 75)
 */
function calculateFG(og_sg, attenuation) {
  const og_plato = sgToPlato(og_sg);
  const fg_plato = og_plato * (1 - attenuation / 100);
  return platoToSG(Math.max(0, fg_plato));
}

/**
 * Beräknar alkoholhalt (ABV) från OG och FG.
 * Formel: ABV = (OG - FG) × 131.25
 */
function calculateABV(og_sg, fg_sg) {
  return (og_sg - fg_sg) * 131.25;
}

/**
 * Beräknar synbar förjäsningsgrad från OG och FG.
 */
function calculateApparentAttenuation(og_sg, fg_sg) {
  if (og_sg <= 1.0) return 0;
  return ((og_sg - fg_sg) / (og_sg - 1.0)) * 100;
}

// ----------------------------------------------------------
//  BITTERHET – IBU (Tinseth-formeln, metrisk)
//  IBU = (vikt_g × alpha% × utilization × 1000) / volym_L
//  Pellets: +10% utilization
// ----------------------------------------------------------

/**
 * Beräknar Tinseth-utnyttjande för en enskild humletillsats.
 * @param {number} og_sg    - Vörtens gravitet under koket (SG)
 * @param {number} time_min - Koktid i minuter
 */
function tinsethUtilization(og_sg, time_min) {
  if (time_min <= 0) return 0;
  const bigness = 1.65 * Math.pow(0.000125, og_sg - 1);
  const timeFactor = (1 - Math.exp(-0.04 * time_min)) / 4.15;
  return bigness * timeFactor;
}

/**
 * Beräknar totalt IBU och per tillsats.
 * @param {Array}  hops       - Array av {amount_g, alpha, time, form, use}
 * @param {number} og_sg      - Vörtsgravitet (SG)
 * @param {number} volume_L   - Bryggvolym i liter
 * @returns {{ total: number, perHop: Array }}
 */
function calculateIBU(hops, og_sg, volume_L) {
  if (!volume_L || volume_L <= 0) return { total: 0, perHop: [] };
  // Använd genomsnittlig vörtsgravitet under koket (approx. halva av OG)
  const boilSG = 1 + (og_sg - 1) * 0.5;

  let total = 0;
  const perHop = hops.map(h => {
    if (h.use === 'dry-hop' || h.use === 'torrhumle') return 0;
    const pelletBonus = (h.form === 'pellets' || h.form === 'pellets') ? 1.1 : 1.0;
    const u = tinsethUtilization(boilSG, h.time || 0);
    const ibu = (h.amount * (h.alpha / 100) * u * pelletBonus * 1000) / volume_L;
    total += ibu;
    return ibu;
  });
  return { total, perHop };
}

// ----------------------------------------------------------
//  FÄRG – EBC (Europeisk Bryggerikonvention)
//  Steg 1: MCU (Malt Color Units, US-enheter) från ingredienser
//  Steg 2: SRM = 1.4922 × MCU^0.6859  (Morey-ekvationen)
//  Steg 3: EBC = SRM × 1.97
// ----------------------------------------------------------

/**
 * Beräknar vörtens färg i EBC.
 * @param {Array}  fermentables - Array av {amount, ebc}
 * @param {number} volume_L     - Bryggvolym i liter
 * @returns {{ ebc: number, perFermentable: Array }}
 */
function calculateEBC(fermentables, volume_L) {
  if (!volume_L || volume_L <= 0) return { ebc: 0, perFermentable: [] };

  // Konvertera alla EBC-bidrag till MCU (US-enheter)
  // MCU = Σ(vikt_lbs × malt_lovibond) / vol_gal
  // Konverteringsfaktor: (kg × 2.20462) × (ebc / 1.97) / (L × 0.264172)
  // = kg × ebc × (2.20462 / 1.97 / 0.264172) = kg × ebc × 4.23
  const K = 4.23; // metrisk-till-MCU-konverterare
  let totalMCU = 0;
  const perFermentable = fermentables.map(f => {
    const mcu = (f.amount * f.ebc * K) / volume_L;
    totalMCU += mcu;
    return mcu * (1.97 * 1.4922); // approximativt EBC-bidrag per malt
  });

  const srm = 1.4922 * Math.pow(totalMCU, 0.6859);
  const ebc = srm * 1.97;
  return { ebc: Math.max(0, ebc), perFermentable };
}

/**
 * Konverterar ett EBC-värde till en CSS-färgsträngar.
 * Interpolerar mellan kalibrerade referensfärger.
 */
function ebcToColor(ebc) {
  const colorMap = [
    { ebc: 2,   hex: [249, 249, 163] },
    { ebc: 4,   hex: [245, 230,  80] },
    { ebc: 6,   hex: [230, 200,  30] },
    { ebc: 8,   hex: [220, 175,  20] },
    { ebc: 12,  hex: [210, 145,  22] },
    { ebc: 16,  hex: [195, 110,  18] },
    { ebc: 20,  hex: [175,  88,  15] },
    { ebc: 30,  hex: [148,  60,  14] },
    { ebc: 40,  hex: [120,  38,  10] },
    { ebc: 60,  hex: [ 85,  22,   8] },
    { ebc: 80,  hex: [ 58,  12,   5] },
    { ebc: 120, hex: [ 35,   7,   3] },
    { ebc: 200, hex: [ 18,   3,   1] },
    { ebc: 400, hex: [  6,   1,   0] },
  ];

  if (ebc <= colorMap[0].ebc) return `rgb(${colorMap[0].hex.join(',')})`;
  if (ebc >= colorMap[colorMap.length - 1].ebc) {
    const last = colorMap[colorMap.length - 1].hex;
    return `rgb(${last.join(',')})`;
  }

  for (let i = 0; i < colorMap.length - 1; i++) {
    const lo = colorMap[i], hi = colorMap[i + 1];
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
 * Returnerar en textbeskrivning av ölstilens färg baserat på EBC.
 */
function ebcToLabel(ebc) {
  if (ebc <  4)  return 'Halmgul';
  if (ebc <  8)  return 'Ljusgul';
  if (ebc < 12)  return 'Gulguld';
  if (ebc < 18)  return 'Djupguld';
  if (ebc < 25)  return 'Amber';
  if (ebc < 35)  return 'Djup Amber';
  if (ebc < 50)  return 'Koppar / Rödbrun';
  if (ebc < 70)  return 'Brun';
  if (ebc < 100) return 'Mörkbrun';
  if (ebc < 150) return 'Nästan svart';
  return 'Svart';
}

// ----------------------------------------------------------
//  BESKA-TILL-GRAVITET-KVOT (BU:GU)
//  Indikator på balansen: hoppy > 0.7, malt < 0.5
// ----------------------------------------------------------
function calculateBUGU(ibu, og_sg) {
  const gu = (og_sg - 1) * 1000;
  if (gu <= 0) return 0;
  return ibu / gu;
}

// ----------------------------------------------------------
//  VATTENKEMI
//  SALT_IONS definieras i data.js (mg jon per gram salt)
// ----------------------------------------------------------

/**
 * Beräknar den resulterande vattenprofilen inklusive saltbidrag.
 * @param {Object} base   - Basvattenprofil {ca, mg, na, cl, so4, hco3}
 * @param {Object} salts  - Saltmängder i gram {gypsum, calciumChloride, ...}
 * @param {number} vol    - Vattenvolym i liter
 * @returns {Object} Resulterande profil {ca, mg, na, cl, so4, hco3}
 */
function calculateWaterProfile(base, salts, vol) {
  if (!vol || vol <= 0) return { ...base };
  const result = { ca: 0, mg: 0, na: 0, cl: 0, so4: 0, hco3: 0 };
  const ions = ['ca', 'mg', 'na', 'cl', 'so4', 'hco3'];

  // Starta med basvattnet
  ions.forEach(ion => { result[ion] = base[ion] || 0; });

  // Lägg till saltbidrag
  Object.entries(salts).forEach(([salt, grams]) => {
    if (!grams || grams <= 0 || !SALT_IONS[salt]) return;
    ions.forEach(ion => {
      result[ion] += (SALT_IONS[salt][ion] * grams) / vol;
    });
  });

  // Avrunda till 1 decimal
  ions.forEach(ion => { result[ion] = Math.round(result[ion] * 10) / 10; });
  return result;
}

/**
 * Beräknar residualalkalinitet (RA) i ppm som CaCO3.
 * RA = Alkalinitet - Ca/3.5 - Mg/7
 * Alkalinitet (som CaCO3) ≈ HCO3 × (50/61)
 */
function calculateResidualAlkalinity(profile) {
  const alk_CaCO3 = (profile.hco3 || 0) * (50 / 61);
  return alk_CaCO3 - (profile.ca || 0) / 3.5 - (profile.mg || 0) / 7;
}

/**
 * Uppskattar mäsk-pH (rumstemp.) – förenklad modell.
 * Notera: detta är en approximation. Faktiskt pH beror på
 * mältens exakta buffertkapacitet och mäskvattenkemi.
 *
 * Referenspunkt: pH 5.72 för pale malt + neutralt vatten.
 * Mörkare malt sänker pH; hög RA höjer pH.
 */
function estimateMashPH(waterProfile, fermentables) {
  const ra = calculateResidualAlkalinity(waterProfile);
  const totalKg = fermentables.reduce((s, f) => s + (f.amount || 0), 0);

  // Mörk malt-justering: malter > 300 EBC sänker pH
  let darkAdjust = 0;
  fermentables.forEach(f => {
    if (f.ebc > 300 && totalKg > 0) {
      darkAdjust -= 0.025 * (f.amount / totalKg) * 100;
    } else if (f.ebc > 120 && totalKg > 0) {
      darkAdjust -= 0.010 * (f.amount / totalKg) * 100;
    } else if (f.ebc > 40 && totalKg > 0) {
      darkAdjust -= 0.005 * (f.amount / totalKg) * 100;
    }
  });

  // RA-justering: positiv RA → högre pH, negativ RA → lägre pH
  const raAdjust = ra / 357;
  const estimatedPH = 5.72 + darkAdjust + raAdjust;
  return Math.min(6.5, Math.max(4.5, estimatedPH));
}

/**
 * Beräknar Cl:SO4-kvot och returnerar en stilbeskrivning.
 */
function chlorideSulfateBalance(profile) {
  const so4 = profile.so4 || 1;
  const ratio = (profile.cl || 0) / so4;
  let label, color;
  if (ratio > 2.0)       { label = 'Mycket maltbetonat'; color = '#8BC34A'; }
  else if (ratio > 1.2)  { label = 'Maltbetonat';        color = '#CDDC39'; }
  else if (ratio > 0.8)  { label = 'Balanserat';         color = '#FFEB3B'; }
  else if (ratio > 0.4)  { label = 'Humlebetonat';       color = '#FF9800'; }
  else                   { label = 'Mycket humlebetonat'; color = '#FF5722'; }
  return { ratio: Math.round(ratio * 100) / 100, label, color };
}

// ----------------------------------------------------------
//  STILMATCHNING
// ----------------------------------------------------------

/**
 * Kontrollerar om receptvärden matchar en given stil.
 * @param {{ og, fg, ibu, ebc, abv }} values - Receptets beräknade värden
 * @param {Object} style - Stilen från STYLES-arrayen
 * @returns {{ match: boolean, details: Object }}
 */
function checkStyleMatch(values, style) {
  const details = {};
  const checks = [
    { key: 'og',  min: style.og_min,  max: style.og_max,  val: values.og,  label: 'OG (SG)' },
    { key: 'fg',  min: style.fg_min,  max: style.fg_max,  val: values.fg,  label: 'FG (SG)' },
    { key: 'ibu', min: style.ibu_min, max: style.ibu_max, val: values.ibu, label: 'IBU' },
    { key: 'ebc', min: style.ebc_min, max: style.ebc_max, val: values.ebc, label: 'EBC' },
    { key: 'abv', min: style.abv_min, max: style.abv_max, val: values.abv, label: 'ABV' },
  ];
  let allMatch = true;
  checks.forEach(c => {
    const inRange = c.val >= c.min && c.val <= c.max;
    if (!inRange) allMatch = false;
    details[c.key] = { ...c, inRange };
  });
  return { match: allMatch, details };
}

// Exportera (stöder både module och globalt scope)
if (typeof module !== 'undefined') {
  module.exports = {
    sgToPlato, platoToSG, formatSG, formatPlato,
    calculateOG, calculatePreboilGravity,
    calculateFG, calculateABV, calculateApparentAttenuation,
    tinsethUtilization, calculateIBU,
    calculateEBC, ebcToColor, ebcToLabel,
    calculateBUGU,
    calculateWaterProfile, calculateResidualAlkalinity,
    estimateMashPH, chlorideSulfateBalance,
    checkStyleMatch,
  };
}
