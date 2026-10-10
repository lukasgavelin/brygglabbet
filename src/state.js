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
      carbonationVols: null, // null = föreslå utifrån ölstil
      fermentation: {
        profile: 'auto',
        coldCrash: false,
        customStages: [],
      },
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
      grainTemp: 18,
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
      acid: { enabled: false, targetPH: 5.4, type: 'lactic', strength: 80, treatSparge: true },
    },
  };
}

/**
 * Normalizes an arbitrary or legacy application state object into a fully-formed,
 * schema-compliant state, mapping legacy property names and ensuring valid numbers.
 * @param {object} [raw] - Partial or legacy state object
 * @returns {object} Clean, safe application state
 */
export function normalizeState(raw = {}, baseState = null) {
  const initial = baseState ? JSON.parse(JSON.stringify(baseState)) : createInitialState();
  if (!raw || typeof raw !== 'object') return initial;

  const rawRecipe = raw.recipe || {};
  const rawEq = raw.equipment !== undefined ? raw.equipment : (baseState?.equipment || {});
  const rawYeast = raw.yeast !== undefined ? raw.yeast : (baseState?.yeast || {});
  const rawWater = raw.water !== undefined ? raw.water : (baseState?.water || {});
  const rawSalts = rawWater.salts || {};
  const rawAcid = rawWater.acid || {};
  const rawFerm = rawRecipe.fermentation || {};

  // Safe numeric helper
  const num = (v, fallback) => {
    const parsed = parseFloat(v);
    return isNaN(parsed) ? fallback : parsed;
  };

  // Legacy mappings for equipment
  const mashRatio = Math.max(1.0, num(rawEq.mashRatio ?? rawEq.mashThickness, initial.equipment.mashRatio));

  // Legacy mappings for salts
  const calciumChloride = Math.max(0, num(rawSalts.calciumChloride ?? rawSalts.cacl2, 0));
  const epsomSalt = Math.max(0, num(rawSalts.epsomSalt ?? rawSalts.epsom, 0));
  const tableSalt = Math.max(0, num(rawSalts.tableSalt ?? rawSalts.nacl, 0));
  const gypsum = Math.max(0, num(rawSalts.gypsum, 0));
  const chalk = Math.max(0, num(rawSalts.chalk ?? rawSalts.caco3, 0));
  const bakingSoda = Math.max(0, num(rawSalts.bakingSoda ?? rawSalts.nahco3, 0));

  const recipe = {
    name: typeof rawRecipe.name === 'string' && rawRecipe.name.trim() ? rawRecipe.name.trim() : initial.recipe.name,
    styleId: typeof rawRecipe.styleId === 'string' ? rawRecipe.styleId : '',
    batchVolume: Math.max(1, num(rawRecipe.batchVolume, initial.recipe.batchVolume)),
    boilVolume: Math.max(1, num(rawRecipe.boilVolume, initial.recipe.boilVolume)),
    boilTime: Math.max(0, num(rawRecipe.boilTime, initial.recipe.boilTime)),
    efficiency: Math.max(10, Math.min(100, num(rawRecipe.efficiency, initial.recipe.efficiency))),
    notes: typeof rawRecipe.notes === 'string' ? rawRecipe.notes : '',
    carbonationVols: rawRecipe.carbonationVols !== null && rawRecipe.carbonationVols !== undefined
      ? num(rawRecipe.carbonationVols, null)
      : null,
    fermentation: {
      profile: rawFerm.profile || 'auto',
      coldCrash: Boolean(rawFerm.coldCrash),
      customStages: Array.isArray(rawFerm.customStages) ? rawFerm.customStages : [],
    },
  };

  const equipment = {
    id: typeof rawEq.id === 'string' ? rawEq.id : initial.equipment.id,
    name: typeof rawEq.name === 'string' && rawEq.name.trim() ? rawEq.name.trim() : initial.equipment.name,
    batchVolume: Math.max(1, num(rawEq.batchVolume, recipe.batchVolume)),
    efficiency: Math.max(10, Math.min(100, num(rawEq.efficiency, recipe.efficiency))),
    boilOffRate: Math.max(0, num(rawEq.boilOffRate, initial.equipment.boilOffRate)),
    kettleLoss: Math.max(0, num(rawEq.kettleLoss, initial.equipment.kettleLoss)),
    fermenterLoss: Math.max(0, num(rawEq.fermenterLoss, initial.equipment.fermenterLoss)),
    grainAbsorption: Math.max(0.1, num(rawEq.grainAbsorption, initial.equipment.grainAbsorption)),
    mashRatio,
    grainTemp: num(rawEq.grainTemp, initial.equipment.grainTemp),
  };

  const fermentables = Array.isArray(raw.fermentables)
    ? raw.fermentables.map((f, i) => ({
        id: f.id !== undefined && f.id !== null ? f.id : i + 1,
        name: typeof f.name === 'string' && f.name.trim() ? f.name.trim() : `Malt ${i + 1}`,
        amount: Math.max(0, num(f.amount, 0)),
        yield: Math.max(0, Math.min(100, num(f.yield, 75))),
        ebc: Math.max(0, num(f.ebc, 5)),
        type: f.type === 'sugar' ? 'sugar' : 'base',
      }))
    : [];

  const hops = Array.isArray(raw.hops)
    ? raw.hops.map((h, i) => ({
        id: h.id !== undefined && h.id !== null ? h.id : i + 1,
        name: typeof h.name === 'string' && h.name.trim() ? h.name.trim() : `Humle ${i + 1}`,
        amount: Math.max(0, num(h.amount, 0)),
        alpha: Math.max(0, num(h.alpha, 5)),
        time: Math.max(0, num(h.time, 60)),
        use: h.use === 'whirlpool' || h.use === 'torrhumle' ? h.use : 'kok',
        form: h.form === 'kottar' ? 'kottar' : 'pellets',
        ...(h.whirlpoolTemp !== undefined ? { whirlpoolTemp: Math.max(40, Math.min(100, num(h.whirlpoolTemp, 80))) } : {}),
        ...(h.dryHopDay !== undefined ? { dryHopDay: Math.max(0, num(h.dryHopDay, 7)) } : {}),
        ...(h.dryHopDays !== undefined ? { dryHopDays: Math.max(1, num(h.dryHopDays, 3)) } : {}),
      }))
    : [];

  const yeast = {
    name: typeof rawYeast.name === 'string' ? rawYeast.name : '',
    lab: typeof rawYeast.lab === 'string' ? rawYeast.lab : '',
    type: typeof rawYeast.type === 'string' ? rawYeast.type : 'ale',
    attMin: Math.max(40, Math.min(100, num(rawYeast.attMin, 72))),
    attMax: Math.max(40, Math.min(100, num(rawYeast.attMax, 78))),
    tempMin: num(rawYeast.tempMin, 18),
    tempMax: num(rawYeast.tempMax, 22),
    notes: typeof rawYeast.notes === 'string' ? rawYeast.notes : '',
  };

  const mash = Array.isArray(raw.mash)
    ? raw.mash.map((m, i) => ({
        id: m.id !== undefined && m.id !== null ? m.id : i + 1,
        name: typeof m.name === 'string' && m.name.trim() ? m.name.trim() : `Steg ${i + 1}`,
        temp: Math.max(20, Math.min(100, num(m.temp, 67))),
        time: Math.max(0, num(m.time, 60)),
        type: typeof m.type === 'string' ? m.type : 'Infusion',
      }))
    : [];

  const water = {
    volume: Math.max(1, num(rawWater.volume, initial.water.volume)),
    base: {
      name: rawWater.base?.name || initial.water.base.name,
      ca: num(rawWater.base?.ca, initial.water.base.ca),
      mg: num(rawWater.base?.mg, initial.water.base.mg),
      na: num(rawWater.base?.na, initial.water.base.na),
      cl: num(rawWater.base?.cl, initial.water.base.cl),
      so4: num(rawWater.base?.so4, initial.water.base.so4),
      hco3: num(rawWater.base?.hco3, initial.water.base.hco3),
    },
    salts: {
      gypsum,
      calciumChloride,
      epsomSalt,
      tableSalt,
      chalk,
      bakingSoda,
    },
    acid: {
      enabled: Boolean(rawAcid.enabled),
      targetPH: Math.max(4.5, Math.min(6.5, num(rawAcid.targetPH, 5.4))),
      type: rawAcid.type === 'phosphoric' ? 'phosphoric' : 'lactic',
      strength: num(rawAcid.strength, 80),
      treatSparge: rawAcid.treatSparge !== false,
    },
  };

  return {
    recipe,
    equipment,
    fermentables,
    hops,
    yeast,
    mash,
    water,
  };
}

/**
 * Applies a partial or raw state to an existing target state after normalization.
 * @param {object} targetState - Existing state to mutate
 * @param {object} newState - New state data to normalize and apply
 * @returns {object} Mutated targetState
 */
export function applyState(targetState, newState) {
  const clean = normalizeState(newState, targetState);
  Object.keys(clean).forEach((key) => {
    targetState[key] = clean[key];
  });
  return targetState;
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
  applyState(State, previousState);
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
  applyState(State, nextState);
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

