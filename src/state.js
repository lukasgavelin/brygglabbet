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
    equipment: {
      id: 'custom_30l',
      name: 'Standard Gryta 30L',
      batchVolume: 20,
      efficiency: 75,
      boilOffRate: 3.0,
      kettleLoss: 2.0,
      fermenterLoss: 1.0,
      grainAbsorption: 0.96,
      mashRatio: 3.0,
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
      base: { name: 'Kranvatten (Mälaren/Uppland)', ca: 17, mg: 3, na: 14, cl: 20, so4: 20, hco3: 65 },
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

const historyStack = [];
const redoStack = [];
const MAX_HISTORY = 30;

/**
 * Saves a snapshot of the current state to the undo history stack.
 */
export function pushHistory() {
  const snapshot = JSON.stringify(State);
  if (historyStack.length > 0 && historyStack[historyStack.length - 1] === snapshot) {
    return;
  }
  historyStack.push(snapshot);
  if (historyStack.length > MAX_HISTORY) {
    historyStack.shift();
  }
  redoStack.length = 0;
}

/**
 * Undoes the last action if available.
 * @param {Function} onStateRestored - Callback after restoring state
 * @returns {boolean} Whether undo was executed
 */
export function undoState(onStateRestored) {
  if (historyStack.length === 0) return false;
  redoStack.push(JSON.stringify(State));
  const previousState = JSON.parse(historyStack.pop());
  Object.assign(State, previousState);
  if (typeof onStateRestored === 'function') {
    onStateRestored();
  }
  return true;
}

/**
 * Redoes the last undone action if available.
 * @param {Function} onStateRestored - Callback after restoring state
 * @returns {boolean} Whether redo was executed
 */
export function redoState(onStateRestored) {
  if (redoStack.length === 0) return false;
  historyStack.push(JSON.stringify(State));
  const nextState = JSON.parse(redoStack.pop());
  Object.assign(State, nextState);
  if (typeof onStateRestored === 'function') {
    onStateRestored();
  }
  return true;
}

export function canUndo() {
  return historyStack.length > 0;
}

export function canRedo() {
  return redoStack.length > 0;
}

