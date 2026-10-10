/**
 * Domain constants for brewing calculations and conversions.
 * Clean Code principle: No magic numbers in business logic.
 */

// Extract & Gravity Constants
export const GU_PER_KG_SUCROSE = 384; // Gravity Units per kg rent socker per liter (conversion from 46 PPG)
export const METRIC_TO_MCU_FACTOR = 4.23; // Conversion multiplier from kg/EBC/L to Malt Color Units (MCU)
export const SRM_TO_EBC_MULTIPLIER = 1.97;
export const MOREY_EXPONENT = 0.6859;
export const MOREY_MULTIPLIER = 1.4922;

// ABV Calculation Constants
export const ABV_MULTIPLIER = 131.25;

// Tinseth IBU Formula Constants
export const TINSETH_BIGNESS_FACTOR = 1.65;
export const TINSETH_BIGNESS_BASE = 0.000125;
export const TINSETH_TIME_FACTOR = 0.04;
export const TINSETH_TIME_DIVISOR = 4.15;
export const PELLET_UTILIZATION_MULTIPLIER = 1.1;
// Whirlpool / hop stand: relative isomerization rate vs 100°C (Malowicki & Shellhammer 2005):
// rate(T) = A * exp(-Ea/R / T_kelvin), normalized so that rate(100°C) ≈ 1.0
export const WHIRLPOOL_ARRHENIUS_A = 2.39e11;
export const WHIRLPOOL_ARRHENIUS_EA_R = 9773; // Kelvin
export const WHIRLPOOL_DEFAULT_TEMP_C = 80;
export const WHIRLPOOL_DEFAULT_MINUTES = 15;
// Fallback when pre-boil gravity is unknown: average boil gravity ≈ 90 % of OG gravity points
// (pre-boil typically ≈ 80 %, post-boil = 100 %).
export const TYPICAL_BOIL_GRAVITY_FRACTION = 0.9;

// Mash & Water Constants
export const MASH_PH_REFERENCE = 5.72; // Reference pH for pale malt in neutral water
export const ALKALINITY_HCO3_TO_CACO3 = 50 / 61;
export const RA_CA_DIVISOR = 3.5;
export const RA_MG_DIVISOR = 7.0;

// Carbonation
export const CO2_GRAMS_PER_LITER_PER_VOLUME = 1.977; // 1 volym CO₂ ≈ 1.977 g CO₂ per liter öl
export const SUCROSE_CO2_YIELD = 0.5143; // g CO₂ per g sackaros (fullständig jäsning)
export const PSI_TO_BAR = 0.0689476;

// Mash thermodynamics (metric Palmer): specific heat of grain relative to water, L/kg-based
export const GRAIN_THERMAL_CONSTANT = 0.41;

// Extract
export const DME_EXTRACT_FACTOR = 0.93; // torrmaltextrakt ger ≈ 93 % av sackarosens extrakt

// Yeast pitching (miljoner celler per mL per °P)
export const PITCH_RATE_ALE = 0.75;
export const PITCH_RATE_LAGER = 1.5;
export const PITCH_RATE_KVEIK = 0.4;
export const DRY_YEAST_BILLION_CELLS_PER_GRAM = 15; // praktiskt antagande för färsk torrjäst
export const LIQUID_YEAST_BILLION_CELLS_PER_PACK = 100;
export const LIQUID_YEAST_VIABILITY_LOSS_PER_DAY = 0.007; // ≈ 21 % per månad
export const STARTER_EXTRACT_G_PER_L = 93; // ca 100 g DME per liter → ~1.036

// Refractometer & hydrometer
export const DEFAULT_WORT_CORRECTION_FACTOR = 1.04;
export const DEFAULT_HYDROMETER_CALIBRATION_C = 20;

// Acids (pKa används för dissociationsgrad vid mäsk-pH)
export const LACTIC_ACID_MW = 90.08;
export const LACTIC_ACID_PKA = 3.86;
export const PHOSPHORIC_ACID_MW = 98.0;
export const CARBONIC_ACID_PKA1 = 6.35;
export const ACIDULATED_MALT_LACTIC_FRACTION = 0.02; // surmalt innehåller ≈ 2 % mjölksyra
