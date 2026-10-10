/**
 * Core batch management: pure functions and storage operations for batches,
 * fermentation schedules, gravity tracking, reminders, and iCalendar (.ics) generation.
 *
 * Swedish homebrewing vocabulary: jäser, konditioneras, klar, primärjäsning,
 * diacetylvila, kallkrasch, torrhumling, flaskning, fatning.
 */

import { computeRecipeMetrics } from './calculations.js';
import {
  actualEfficiency,
  measuredResults,
  refractometerFG,
  brixToSG,
  sgToBrix,
  hydrometerTempCorrection,
} from './brewtools.js';

export const BATCHES_STORAGE_KEY = 'brygglabbet_batches';

export const BATCH_STATUS = {
  FERMENTING: 'jäser',
  CONDITIONING: 'konditioneras',
  COMPLETED: 'klar',
};

/**
 * Standard fermentation schedule templates per yeast profile.
 */
export const FERMENTATION_TEMPLATES = {
  ale: [
    { name: 'Primärjäsning', tempC: 19, days: 12 },
  ],
  lager: [
    { name: 'Primärjäsning', tempC: 11, days: 10 },
    { name: 'Diacetylvila', tempC: 17, days: 4 },
    { name: 'Kallagring (Lagering)', tempC: 3, days: 14 },
  ],
  kveik: [
    { name: 'Primärjäsning', tempC: 33, days: 4 },
  ],
  wheat: [
    { name: 'Primärjäsning', tempC: 20, days: 10 },
  ],
};

/**
 * Formats a Date or timestamp as YYYY-MM-DD.
 * @param {Date|number|string} [date]
 * @returns {string} YYYY-MM-DD
 */
export function formatDateISO(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Adds N days to a YYYY-MM-DD date string and returns the new date string.
 * @param {string} dateStr - YYYY-MM-DD
 * @param {number} days - Number of days to add
 * @returns {string} YYYY-MM-DD
 */
export function addDays(dateStr, days) {
  if (!dateStr || typeof dateStr !== 'string') return formatDateISO();
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  const date = new Date(Date.UTC(y, m, d));
  date.setUTCDate(date.getUTCDate() + (Number(days) || 0));
  return date.toISOString().slice(0, 10);
}

/**
 * Calculates day difference between two YYYY-MM-DD dates (b - a).
 * @param {string} dateA - YYYY-MM-DD
 * @param {string} dateB - YYYY-MM-DD
 * @returns {number} Days difference
 */
export function diffDays(dateA, dateB) {
  if (!dateA || !dateB) return 0;
  const [y1, m1, d1] = dateA.split('-').map(Number);
  const [y2, m2, d2] = dateB.split('-').map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
}

/**
 * Calculates a complete fermentation schedule with dates for stages and dry hop additions.
 * @param {object} options
 * @param {string} [options.brewDate] - Brew day date (YYYY-MM-DD)
 * @param {string} [options.yeastType='ale'] - 'ale' | 'lager' | 'kveik' | 'wheat'
 * @param {boolean} [options.coldCrash=false] - Whether to append cold crash stage
 * @param {Array<object>} [options.customStages] - Optional custom stages override
 * @param {Array<object>} [options.hops=[]] - Recipe hops array
 * @returns {{ fermentationPlan: Array<object>, dryHopSchedule: Array<object>, estimatedBottlingDate: string }}
 */
export function calculateFermentationSchedule({
  brewDate,
  yeastType = 'ale',
  coldCrash = false,
  customStages = null,
  hops = [],
} = {}) {
  const baseDate = brewDate || formatDateISO();
  let stagesTemplate = [];

  if (Array.isArray(customStages) && customStages.length > 0) {
    stagesTemplate = customStages.map((s) => ({ ...s }));
  } else {
    const tplKey = (yeastType || 'ale').toLowerCase();
    const tpl = FERMENTATION_TEMPLATES[tplKey] || FERMENTATION_TEMPLATES.ale;
    stagesTemplate = tpl.map((s) => ({ ...s }));
  }

  if (coldCrash && !stagesTemplate.some((s) => s.name.toLowerCase().includes('kallkrasch'))) {
    stagesTemplate.push({ name: 'Kallkrasch', tempC: 3, days: 2 });
  }

  let curDate = baseDate;
  const fermentationPlan = stagesTemplate.map((stage) => {
    const startDate = curDate;
    const days = Math.max(1, Number(stage.days) || 1);
    const endDate = addDays(startDate, days);
    curDate = endDate;
    return {
      name: stage.name || 'Jäsning',
      tempC: Number(stage.tempC) || 20,
      days,
      startDate,
      endDate,
    };
  });

  const dryHopSchedule = (hops || [])
    .filter((h) => h.use === 'torrhumle' || h.use === 'torr')
    .map((h) => {
      const day = Number(h.dryHopDay) > 0 ? Number(h.dryHopDay) : 7;
      const days = Number(h.dryHopDays) > 0 ? Number(h.dryHopDays) : 3;
      const addDate = addDays(baseDate, day);
      const removeDate = addDays(addDate, days);
      return {
        hopId: h.id,
        hopName: h.name || 'Torrhumle',
        amount: Number(h.amount) || 0,
        day,
        days,
        addDate,
        removeDate,
        added: false,
        removed: false,
      };
    });

  let estBottlingDate = curDate;
  dryHopSchedule.forEach((dh) => {
    if (dh.removeDate > estBottlingDate) {
      estBottlingDate = dh.removeDate;
    }
  });

  return {
    fermentationPlan,
    dryHopSchedule,
    estimatedBottlingDate: estBottlingDate,
  };
}

/**
 * Calculates current actual FG, ABV and attenuation from batch readings and OG.
 * @param {object} batch
 */
export function recalculateBatchState(batch) {
  if (!batch) return;
  const ogNum = parseFloat(String(batch.measured?.og || '').replace(',', '.'));
  const validOG = Number.isFinite(ogNum) && ogNum > 1.0 ? ogNum : null;

  const volNum = parseFloat(String(batch.measured?.fermenterVol || '').replace(',', '.'));
  if (validOG && Number.isFinite(volNum) && volNum > 0 && Array.isArray(batch.recipeSnapshot?.fermentables)) {
    batch.efficiency = actualEfficiency(batch.recipeSnapshot.fermentables, validOG, volNum);
  }

  const readings = Array.isArray(batch.readings) ? [...batch.readings] : [];
  if (readings.length === 0) {
    batch.fg = null;
    batch.abv = null;
    batch.attenuation = null;
    return;
  }

  // Sort chronologically
  readings.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const latest = readings[readings.length - 1];

  let currentSG = null;
  if (latest.sg && Number.isFinite(Number(latest.sg)) && Number(latest.sg) > 0) {
    currentSG = Number(latest.sg);
  } else if (latest.brix && Number.isFinite(Number(latest.brix)) && Number(latest.brix) > 0) {
    const brixVal = Number(latest.brix);
    if (validOG) {
      const ogBrix = sgToBrix(validOG);
      currentSG = refractometerFG(ogBrix, brixVal, latest.wcf || 1.0);
    } else {
      currentSG = brixToSG(brixVal);
    }
  }

  if (currentSG && latest.tempC !== null && latest.tempC !== undefined && latest.isHydrometer) {
    currentSG = hydrometerTempCorrection(currentSG, Number(latest.tempC), 20);
  }

  if (currentSG && Number.isFinite(currentSG)) {
    batch.fg = Math.round(currentSG * 1000) / 1000;
    if (validOG) {
      const res = measuredResults(validOG, batch.fg);
      batch.abv = res.abv;
      batch.attenuation = Math.round(((validOG - batch.fg) / (validOG - 1.0)) * 1000) / 10;
    }
  }
}

/**
 * Returns active reminders for a batch relative to today's date.
 * @param {object} batch
 * @param {string} [todayStr] - YYYY-MM-DD
 * @returns {Array<{ type: string, date: string, isToday: boolean, isPast: boolean, text: string }>}
 */
export function getReminders(batch, todayStr = formatDateISO()) {
  if (!batch || batch.status === BATCH_STATUS.COMPLETED) return [];
  const reminders = [];

  // Dry hop additions
  (batch.dryHopSchedule || []).forEach((dh) => {
    if (!dh.added) {
      const diff = diffDays(todayStr, dh.addDate);
      reminders.push({
        type: 'dryhop_add',
        date: dh.addDate,
        isToday: diff === 0,
        isPast: diff < 0,
        text: `Tillsätt ${dh.amount} g ${dh.hopName} i jäskärlet`,
      });
    }
    if (!dh.removed) {
      const diff = diffDays(todayStr, dh.removeDate);
      reminders.push({
        type: 'dryhop_remove',
        date: dh.removeDate,
        isToday: diff === 0,
        isPast: diff < 0,
        text: `Avlägsna ${dh.amount} g ${dh.hopName} från jäskärlet`,
      });
    }
  });

  // Fermentation stages temperature transitions
  (batch.fermentationPlan || []).forEach((stage) => {
    if (stage.startDate !== batch.brewDate) {
      const diff = diffDays(todayStr, stage.startDate);
      reminders.push({
        type: 'stage_start',
        date: stage.startDate,
        isToday: diff === 0,
        isPast: diff < 0,
        text: `Justera jästemperatur till ${stage.tempC}°C (${stage.name})`,
      });
    }
  });

  // Bottling
  if (batch.status === BATCH_STATUS.FERMENTING && batch.estimatedBottlingDate) {
    const diff = diffDays(todayStr, batch.estimatedBottlingDate);
    reminders.push({
      type: 'bottling',
      date: batch.estimatedBottlingDate,
      isToday: diff === 0,
      isPast: diff < 0,
      text: `Planerad flaskning / fatning av ${batch.recipeName}`,
    });
  }

  return reminders.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Escapes characters for iCalendar RFC 5545 text fields.
 * @param {string} str
 * @returns {string}
 */
function escapeICS(str) {
  if (!str) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Formats a YYYY-MM-DD date as YYYYMMDD for iCalendar.
 * @param {string} dateStr
 * @returns {string}
 */
function toICSDate(dateStr) {
  return String(dateStr).replace(/-/g, '');
}

/**
 * Generates an RFC 5545 valid .ics calendar string for the batch.
 * @param {object} batch
 * @returns {string} iCalendar file text
 */
export function generateBatchICS(batch) {
  if (!batch) return '';
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Brygglabbet//Hembryggning//SV',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  let eventIdx = 1;

  const pushEvent = (title, description, startDateStr, endDateStr = startDateStr) => {
    const startICS = toICSDate(startDateStr);
    const endICS = toICSDate(addDays(endDateStr, 1)); // ICS all-day end date is exclusive
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:batch-${batch.id}-${eventIdx++}@brygglabbet.se`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(`DTSTART;VALUE=DATE:${startICS}`);
    lines.push(`DTEND;VALUE=DATE:${endICS}`);
    lines.push(`SUMMARY:${escapeICS(title)}`);
    lines.push(`DESCRIPTION:${escapeICS(description)}`);
    lines.push('STATUS:CONFIRMED');
    lines.push('TRANSP:TRANSPARENT');
    lines.push('END:VEVENT');
  };

  // 1. Brew Day
  if (batch.brewDate) {
    const plannedVol = batch.metricsSnapshot?.batchVolume || 20;
    const plannedOG = batch.metricsSnapshot?.og ? batch.metricsSnapshot.og.toFixed(3) : '—';
    pushEvent(
      `[Brygglabbet] Bryggdag: ${batch.recipeName}`,
      `Bryggdag för ${batch.recipeName}. Planerad volym: ${plannedVol} L. Planerat OG: ${plannedOG}.`,
      batch.brewDate
    );
  }

  // 2. Fermentation Stages
  (batch.fermentationPlan || []).forEach((stage) => {
    pushEvent(
      `[Brygglabbet] Jäsning: ${stage.name} (${stage.tempC}°C)`,
      `${stage.name} vid ${stage.tempC}°C under ${stage.days} dagar för ${batch.recipeName}.`,
      stage.startDate,
      stage.endDate
    );
  });

  // 3. Dry Hops
  (batch.dryHopSchedule || []).forEach((dh) => {
    pushEvent(
      `[Brygglabbet] Tillsätt torrhumle: ${dh.amount} g ${dh.hopName}`,
      `Tillsätt ${dh.amount} g ${dh.hopName} i jäskärlet. Låt ligga i ${dh.days} dagar fram till ${dh.removeDate}.`,
      dh.addDate
    );
    pushEvent(
      `[Brygglabbet] Avlägsna torrhumle: ${dh.amount} g ${dh.hopName}`,
      `Dags att avlägsna eller kallkrascha torrhumlen (${dh.hopName}) från jäskärlet.`,
      dh.removeDate
    );
  });

  // 4. Bottling / Packaging
  const bottleDate = batch.bottling?.date || batch.estimatedBottlingDate;
  if (bottleDate) {
    pushEvent(
      `[Brygglabbet] Buteljering / fatning: ${batch.recipeName}`,
      `Dags att flaska eller fata ${batch.recipeName}. Mät slutlig FG och beräkna kolsocker i Brygglabbet!`,
      bottleDate
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Loads all saved batches from localStorage.
 * @returns {Array<object>}
 */
export function getBatches() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(BATCHES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Saves the full batches array to localStorage.
 * @param {Array<object>} batches
 */
export function saveBatches(batches) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(BATCHES_STORAGE_KEY, JSON.stringify(batches));
    }
  } catch (err) {
    console.error('Kunde inte spara batcher till localStorage:', err);
  }
}

/**
 * Retrieves a single batch by ID.
 * @param {string} id
 * @returns {object|null}
 */
export function getBatchById(id) {
  if (!id) return null;
  const batches = getBatches();
  return batches.find((b) => b.id === id) || null;
}

/**
 * Returns all batches matching a recipe name or ID.
 * @param {string|number} recipeNameOrId
 * @returns {Array<object>}
 */
export function getBatchesForRecipe(recipeNameOrId) {
  if (!recipeNameOrId) return [];
  const batches = getBatches();
  const query = String(recipeNameOrId).toLowerCase().trim();
  return batches.filter((b) => {
    return (
      (b.recipeId && String(b.recipeId).toLowerCase() === query) ||
      (b.recipeName && b.recipeName.toLowerCase().trim() === query)
    );
  });
}

/**
 * Creates and persists a new batch snapshot.
 * @param {object} params
 * @param {object} params.recipeSnapshot - Deep copy of state at brewing
 * @param {object} [params.measured={}] - Measured brewing day values
 * @param {string} [params.brewDate] - YYYY-MM-DD
 * @param {string} [params.status='jäser'] - Initial status
 * @param {string} [params.notes=''] - Brew notes
 * @param {boolean} [params.coldCrash=false] - Whether cold crash is planned
 * @returns {object} The created batch
 */
export function createBatch({
  recipeSnapshot,
  measured = {},
  brewDate = null,
  status = BATCH_STATUS.FERMENTING,
  notes = '',
  coldCrash = false,
} = {}) {
  const id = `batch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const date = brewDate || formatDateISO();
  const snapshot = JSON.parse(JSON.stringify(recipeSnapshot || {}));
  const metrics = computeRecipeMetrics(snapshot);

  const yeastType = snapshot.yeast?.type || 'ale';
  const { fermentationPlan, dryHopSchedule, estimatedBottlingDate } = calculateFermentationSchedule({
    brewDate: date,
    yeastType,
    coldCrash,
    customStages: snapshot.recipe?.fermentation?.customStages,
    hops: snapshot.hops || [],
  });

  const rawOG = parseFloat(String(measured.og || '').replace(',', '.'));
  const rawVol = parseFloat(String(measured.fermenterVol || '').replace(',', '.')) || metrics.batchVolume;
  const actualEff = (rawOG > 1 && rawVol > 0 && Array.isArray(snapshot.fermentables))
    ? actualEfficiency(snapshot.fermentables, rawOG, rawVol)
    : null;

  const batch = {
    id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    brewDate: date,
    recipeId: snapshot.recipe?.id || null,
    recipeName: snapshot.recipe?.name || 'Namnlöst öl',
    recipeSnapshot: snapshot,
    metricsSnapshot: {
      og: metrics.og,
      fg: metrics.fg,
      abv: metrics.abv,
      ibu: metrics.ibu,
      ebc: metrics.ebc,
      batchVolume: metrics.batchVolume,
      efficiency: snapshot.equipment?.efficiency || snapshot.recipe?.efficiency || 75,
    },
    measured: {
      preboilSG: measured.preboilSG || '',
      preboilVol: measured.preboilVol || '',
      sampleTempC: Number(measured.sampleTempC) || 20,
      og: measured.og || '',
      fermenterVol: measured.fermenterVol || '',
      mashPH: measured.mashPH || '',
    },
    readings: [],
    fg: null,
    abv: null,
    attenuation: null,
    efficiency: actualEff,
    bottling: null,
    fermentationPlan,
    dryHopSchedule,
    estimatedBottlingDate,
    status,
    tastingNotes: '',
    rating: null,
    notes: notes || '',
  };

  const batches = getBatches();
  batches.unshift(batch);
  saveBatches(batches);
  return batch;
}

/**
 * Updates an existing batch in localStorage.
 * @param {object} updatedBatch
 * @returns {object|null}
 */
export function saveBatch(updatedBatch) {
  if (!updatedBatch || !updatedBatch.id) return null;
  const batches = getBatches();
  const idx = batches.findIndex((b) => b.id === updatedBatch.id);
  updatedBatch.updatedAt = new Date().toISOString();
  recalculateBatchState(updatedBatch);

  if (idx !== -1) {
    batches[idx] = updatedBatch;
  } else {
    batches.unshift(updatedBatch);
  }
  saveBatches(batches);
  return updatedBatch;
}

/**
 * Deletes a batch from localStorage.
 * @param {string} id
 * @returns {boolean}
 */
export function deleteBatch(id) {
  const batches = getBatches();
  const filtered = batches.filter((b) => b.id !== id);
  if (filtered.length === batches.length) return false;
  saveBatches(filtered);
  return true;
}

/**
 * Adds a fermentation reading to a batch and recalculates current FG and ABV.
 * @param {string} batchId
 * @param {object} reading
 * @returns {object|null}
 */
export function addReadingToBatch(batchId, reading) {
  const batches = getBatches();
  const batch = batches.find((b) => b.id === batchId);
  if (!batch) return null;

  const readingId = `read-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const newReading = {
    id: readingId,
    date: reading.date || formatDateISO(),
    sg: reading.sg ? Number(reading.sg) : null,
    brix: reading.brix ? Number(reading.brix) : null,
    tempC: reading.tempC !== null && reading.tempC !== undefined && reading.tempC !== '' ? Number(reading.tempC) : null,
    isHydrometer: Boolean(reading.isHydrometer),
    wcf: Number(reading.wcf) || 1.0,
    note: reading.note || '',
  };

  batch.readings = batch.readings || [];
  batch.readings.push(newReading);
  batch.readings.sort((a, b) => String(a.date).localeCompare(String(b.date)));

  recalculateBatchState(batch);
  batch.updatedAt = new Date().toISOString();

  saveBatches(batches);
  return batch;
}

/**
 * Removes a reading from a batch.
 * @param {string} batchId
 * @param {string} readingId
 * @returns {object|null}
 */
export function deleteReadingFromBatch(batchId, readingId) {
  const batches = getBatches();
  const batch = batches.find((b) => b.id === batchId);
  if (!batch) return null;

  batch.readings = (batch.readings || []).filter((r) => r.id !== readingId);
  recalculateBatchState(batch);
  batch.updatedAt = new Date().toISOString();

  saveBatches(batches);
  return batch;
}

/**
 * Updates bottling / kegging data for a batch and changes status to 'konditioneras' if fermenting.
 * @param {string} batchId
 * @param {object} bottlingData
 * @returns {object|null}
 */
export function updateBottling(batchId, bottlingData) {
  const batches = getBatches();
  const batch = batches.find((b) => b.id === batchId);
  if (!batch) return null;

  batch.bottling = {
    date: bottlingData.date || formatDateISO(),
    method: bottlingData.method || 'flaska',
    sugarType: bottlingData.sugarType || 'sucrose',
    sugarG: Number(bottlingData.sugarG) || 0,
    sugarGPerL: Number(bottlingData.sugarGPerL) || 0,
    vols: Number(bottlingData.vols) || 2.4,
    tempC: Number(bottlingData.tempC) || 20,
    volumeL: Number(bottlingData.volumeL) || Number(batch.measured?.fermenterVol) || 20,
  };

  if (batch.status === BATCH_STATUS.FERMENTING) {
    batch.status = BATCH_STATUS.CONDITIONING;
  }
  batch.updatedAt = new Date().toISOString();

  saveBatches(batches);
  return batch;
}

/**
 * Imports an array of batches and merges them with existing ones based on ID.
 * @param {Array<object>} importedBatches
 * @returns {Array<object>} Merged batches array
 */
export function importBatches(importedBatches) {
  if (!Array.isArray(importedBatches)) return getBatches();
  const existing = getBatches();
  const map = new Map();
  existing.forEach((b) => {
    if (b && b.id) map.set(b.id, b);
  });

  importedBatches.forEach((b) => {
    if (b && b.id) {
      if (!map.has(b.id)) {
        map.set(b.id, b);
      } else {
        const cur = map.get(b.id);
        const curTime = cur.updatedAt ? new Date(cur.updatedAt).getTime() : 0;
        const impTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        if (impTime >= curTime) {
          map.set(b.id, b);
        }
      }
    }
  });

  const merged = Array.from(map.values()).sort((a, b) => (b.brewDate || '').localeCompare(a.brewDate || ''));
  saveBatches(merged);
  return merged;
}
