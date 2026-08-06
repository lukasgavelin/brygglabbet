/**
 * Centralized state management. Single source of truth.
 */

let nextIdCounter = 1;

/**
 * Returns a unique numeric ID for recipe items.
 * @returns {number} Unique ID
 */
export function generateId() {
  return nextIdCounter++;
}

/**
 * Sets the ID counter threshold (used when loading a saved recipe).
 * @param {number} maxId - Maximum existing ID
 */
export function setNextId(maxId) {
  nextIdCounter = maxId + 1;
}

/**
 * Creates a fresh default application state.
 * @returns {object} Application state object
 */
export function createInitialState() {
  return {
    recipe: {
      name: 'Mitt nya öl',
      styleId: '',
      batchVolume: 20,
      boilVolume: 25,
      boilTime: 60,
      efficiency: 75,
      notes: '',
    },
    fermentables: [],
    hops: [],
    yeast: {
      name: '',
      lab: '',
      type: 'ale',
      attMin: 72,
      attMax: 78,
      tempMin: 18,
      tempMax: 22,
      notes: '',
    },
    mash: [],
    water: {
      volume: 25,
      base: { ca: 50, mg: 10, na: 20, cl: 50, so4: 50, hco3: 100 },
      salts: {
        gypsum: 0,
        calciumChloride: 0,
        epsomSalt: 0,
        tableSalt: 0,
        chalk: 0,
        bakingSoda: 0,
      },
    },
  };
}

export const State = createInitialState();
