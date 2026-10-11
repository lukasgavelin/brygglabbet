/**
 * Unified State-DOM Synchronization Bridge.
 * Eliminates duplicate event handling and state sync divergence between Desktop and Mobile views.
 */

import { State } from '../state.js';


const SYNCED_FIELDS = [
  { desktopId: 'recipe-name-input', mobileId: 'mobile-recipe-name', path: ['recipe', 'name'], type: 'text' },
  { desktopId: 'batch-volume', mobileId: 'mobile-batch-volume', path: ['recipe', 'batchVolume'], type: 'number' },
  { desktopId: 'boil-volume', mobileId: 'mobile-boil-volume', path: ['recipe', 'boilVolume'], type: 'number' },
  { desktopId: 'boil-time', mobileId: 'mobile-boil-time', path: ['recipe', 'boilTime'], type: 'number' },
  { desktopId: 'efficiency', mobileId: 'mobile-efficiency', path: ['recipe', 'efficiency'], type: 'number' },
  { desktopId: 'recipe-style', mobileId: 'mobile-recipe-style', path: ['recipe', 'styleId'], type: 'text' },
  { desktopId: 'recipe-notes', mobileId: 'mobile-recipe-notes', path: ['recipe', 'notes'], type: 'text' },

  // Equipment parameters
  { desktopId: 'equipment-preset', mobileId: 'mobile-equipment-preset', path: ['equipment', 'id'], type: 'text' },
  { desktopId: 'eq-boiloff', mobileId: 'mobile-eq-boiloff', path: ['equipment', 'boilOffRate'], type: 'number' },
  { desktopId: 'eq-kettle-loss', mobileId: 'mobile-eq-kettle-loss', path: ['equipment', 'kettleLoss'], type: 'number' },
  { desktopId: 'eq-grain-abs', mobileId: 'mobile-eq-grain-abs', path: ['equipment', 'grainAbsorption'], type: 'number' },
  { desktopId: null, mobileId: 'mobile-eq-mash-thickness', path: ['equipment', 'mashRatio'], type: 'number' },

  // Yeast fields
  { desktopId: 'yeast-name', mobileId: 'mobile-yeast-name', path: ['yeast', 'name'], type: 'text' },
  { desktopId: 'yeast-lab', mobileId: 'mobile-yeast-lab', path: ['yeast', 'lab'], type: 'text' },
  { desktopId: 'yeast-type', mobileId: 'mobile-yeast-type', path: ['yeast', 'type'], type: 'text' },
  { desktopId: 'att-min', mobileId: 'mobile-att-min', path: ['yeast', 'attMin'], type: 'number' },
  { desktopId: 'att-max', mobileId: 'mobile-att-max', path: ['yeast', 'attMax'], type: 'number' },

  // Water fields
  { desktopId: 'water-total-volume', mobileId: 'mobile-water-volume', path: ['water', 'volume'], type: 'number', fallback: 25 },
  { desktopId: 'w-salt-gypsum', mobileId: 'mobile-salt-gypsum', path: ['water', 'salts', 'gypsum'], type: 'number' },
  { desktopId: 'w-salt-cacl2', mobileId: 'mobile-salt-calciumChloride', path: ['water', 'salts', 'calciumChloride'], type: 'number' },
  { desktopId: 'w-salt-epsom', mobileId: 'mobile-salt-epsomSalt', path: ['water', 'salts', 'epsomSalt'], type: 'number' },
  { desktopId: 'w-salt-nacl', mobileId: 'mobile-salt-tableSalt', path: ['water', 'salts', 'tableSalt'], type: 'number' },
];

function getNestedValue(obj, path) {
  let curr = obj;
  for (const seg of path) {
    if (curr === undefined || curr === null) return undefined;
    curr = curr[seg];
  }
  return curr;
}

function setNestedValue(obj, path, val) {
  let curr = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const seg = path[i];
    if (!curr[seg] || typeof curr[seg] !== 'object') {
      curr[seg] = {};
    }
    curr = curr[seg];
  }
  curr[path[path.length - 1]] = val;
}

/**
 * Synchronizes all configured input values from State to both Desktop and Mobile elements.
 * Skips the currently focused element to preserve user input/caret.
 */
export function syncInputsFromState() {
  SYNCED_FIELDS.forEach(({ desktopId, mobileId, path, fallback }) => {
    const val = getNestedValue(State, path) ?? fallback ?? '';

    [desktopId, mobileId].forEach((id) => {
      if (!id) return;
      const el = document.getElementById(id);
      if (el && document.activeElement !== el) {
        if (el.type === 'checkbox') {
          el.checked = Boolean(val);
        } else {
          el.value = val !== undefined && val !== null ? val : '';
        }
      }
    });
  });
}

/**
 * Sets up bidirectional synchronization listeners between paired desktop and mobile inputs.
 * Uses event delegation on the mobile view for steppers and quick loss adjustments.
 * @param {Function} recalculateCallback
 */
export function setupSyncBridge(recalculateCallback) {
  SYNCED_FIELDS.forEach(({ desktopId, mobileId, path, type }) => {
    const bindField = (sourceId, targetId) => {
      const sourceEl = document.getElementById(sourceId);
      if (!sourceEl) return;

      const eventType = sourceEl.tagName === 'SELECT' ? 'change' : 'input';
      sourceEl.addEventListener(eventType, (e) => {
        const rawVal = sourceEl.type === 'checkbox' ? sourceEl.checked : e.target.value;
        const parsedVal = type === 'number' ? (parseFloat(rawVal) || 0) : rawVal;

        setNestedValue(State, path, parsedVal);

        // Mirror to twin element
        if (targetId) {
          const targetEl = document.getElementById(targetId);
          if (targetEl && document.activeElement !== targetEl) {
            if (targetEl.type === 'checkbox') {
              targetEl.checked = Boolean(parsedVal);
            } else {
              targetEl.value = parsedVal;
            }
          }
        }

        recalculateCallback();
      });
    };

    if (desktopId) bindField(desktopId, mobileId);
    if (mobileId) bindField(mobileId, desktopId);
  });

  // Delegated steppers on #mobile-app-view
  const mobileContainer = document.getElementById('mobile-app-view');
  if (mobileContainer) {
    mobileContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.stepper-btn');
      if (!btn) return;

      // 1. Equipment loss steppers
      if (btn.dataset.eqLoss) {
        const field = btn.dataset.eqLoss;
        const dir = parseFloat(btn.dataset.dir);
        if (State.equipment && State.equipment[field] !== undefined) {
          State.equipment[field] = Math.max(0, Math.round((State.equipment[field] + dir) * 100) / 100);
          syncInputsFromState();
          recalculateCallback();
        }
        return;
      }

      // 2. Water salt steppers
      if (btn.dataset.salt) {
        const saltKey = btn.dataset.salt;
        const dir = parseFloat(btn.dataset.dir);
        if (State.water?.salts && State.water.salts[saltKey] !== undefined) {
          State.water.salts[saltKey] = Math.max(0, Math.round((State.water.salts[saltKey] + dir * 0.5) * 10) / 10);
          syncInputsFromState();
          recalculateCallback();
        }
      }
    });

    // Delegated salt direct inputs on #mobile-app-view
    mobileContainer.addEventListener('input', (e) => {
      const inp = e.target;
      if (inp.id && inp.id.startsWith('mobile-salt-')) {
        const saltKey = inp.id.replace('mobile-salt-', '');
        if (State.water?.salts && State.water.salts[saltKey] !== undefined) {
          State.water.salts[saltKey] = Math.max(0, parseFloat(inp.value) || 0);
          recalculateCallback();
        }
      }
    });
  }
}
