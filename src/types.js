/**
 * JSDoc type definitions for Brygglabbet domain model.
 * Provides IDE autocompletion and structural typing across the codebase.
 */

/**
 * @typedef {'base' | 'cara' | 'roasted' | 'sugar'} FermentableType
 */

/**
 * @typedef {Object} Fermentable
 * @property {number} id - Unique item ID
 * @property {string} name - Ingredient name
 * @property {number} amount - Weight in kg
 * @property {number} yield - Extraction yield percentage (0-100)
 * @property {number} ebc - Color rating in EBC
 * @property {FermentableType} [type] - Ingredient classification
 * @property {number} [costPerKg] - Cost in SEK/kg
 */

/**
 * @typedef {'pellets' | 'kottar'} HopForm
 */

/**
 * @typedef {'kok' | 'whirlpool' | 'torrhumle'} HopUse
 */

/**
 * @typedef {Object} Hop
 * @property {number} id - Unique item ID
 * @property {string} name - Hop variety name
 * @property {number} amount - Weight in grams
 * @property {number} alpha - Alpha acid percentage (0-30)
 * @property {number} time - Boil/contact time in minutes
 * @property {HopForm} form - Hop physical form
 * @property {HopUse} use - Addition phase
 * @property {number} [costPerG] - Cost in SEK/g
 */

/**
 * @typedef {'ale' | 'lager'} YeastType
 */

/**
 * @typedef {Object} Yeast
 * @property {string} name - Yeast strain name
 * @property {string} lab - Producer / Laboratory
 * @property {YeastType} type - Fermentation type
 * @property {number} attMin - Minimum apparent attenuation percentage
 * @property {number} attMax - Maximum apparent attenuation percentage
 * @property {number} tempMin - Minimum recommended temperature in °C
 * @property {number} tempMax - Maximum recommended temperature in °C
 * @property {string} [notes] - Additional notes or description
 */

/**
 * @typedef {Object} MashStep
 * @property {number} id - Unique step ID
 * @property {string} name - Step label
 * @property {'Infusion' | 'Steg'} type - Heat method
 * @property {number} temp - Target temperature in °C
 * @property {number} time - Step duration in minutes
 */

/**
 * @typedef {Object} WaterProfile
 * @property {number} ca - Calcium (ppm)
 * @property {number} mg - Magnesium (ppm)
 * @property {number} na - Sodium (ppm)
 * @property {number} cl - Chloride (ppm)
 * @property {number} so4 - Sulfate (ppm)
 * @property {number} hco3 - Bicarbonate (ppm)
 */

/**
 * @typedef {Object} WaterSalts
 * @property {number} gypsum - Calcium Sulfate (g)
 * @property {number} calciumChloride - Calcium Chloride (g)
 * @property {number} epsomSalt - Magnesium Sulfate (g)
 * @property {number} tableSalt - Sodium Chloride (g)
 * @property {number} chalk - Calcium Carbonate (g)
 * @property {number} bakingSoda - Sodium Bicarbonate (g)
 */

/**
 * @typedef {Object} EquipmentProfile
 * @property {string} id - Profile identifier
 * @property {string} name - Display name
 * @property {number} batchVolume - Final batch volume into fermenter (L)
 * @property {number} efficiency - Brewhouse efficiency (0-100)
 * @property {number} boilOffRate - Boil off rate per hour (L/h)
 * @property {number} kettleLoss - Trub / kettle loss (L)
 * @property {number} fermenterLoss - Fermenter loss (L)
 * @property {number} grainAbsorption - Grain absorption rate (L/kg)
 * @property {number} mashRatio - Water to grain ratio (L/kg)
 */

/**
 * @typedef {Object} RecipeInfo
 * @property {string} name - Recipe title
 * @property {string} styleId - BJCP style ID (e.g. "18B")
 * @property {number} batchVolume - Batch volume in liters
 * @property {number} boilVolume - Pre-boil volume in liters
 * @property {number} boilTime - Boil duration in minutes
 * @property {number} efficiency - Expected brewhouse efficiency percentage
 * @property {string} notes - Recipe description / brewing notes
 */

/**
 * @typedef {Object} AppState
 * @property {RecipeInfo} recipe - Basic recipe information
 * @property {EquipmentProfile} equipment - Equipment profile
 * @property {Fermentable[]} fermentables - Grain bill
 * @property {Hop[]} hops - Hop additions
 * @property {Yeast} yeast - Yeast selection
 * @property {MashStep[]} mash - Mash schedule
 * @property {{ volume: number, base: WaterProfile, salts: WaterSalts }} water - Water setup
 */

export {};
