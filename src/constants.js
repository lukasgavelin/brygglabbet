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
export const WHIRLPOOL_IBU_FACTOR = 0.2; // 20% utilization for whirlpool additions
export const BOIL_SG_CORRECTION_FACTOR = 0.5; // Average boil gravity estimate factor

// Mash & Water Constants
export const MASH_PH_REFERENCE = 5.72; // Reference pH for pale malt in neutral water
export const ALKALINITY_HCO3_TO_CACO3 = 50 / 61;
export const RA_CA_DIVISOR = 3.5;
export const RA_MG_DIVISOR = 7.0;
