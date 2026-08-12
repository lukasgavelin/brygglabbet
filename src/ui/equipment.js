/**
 * Equipment Profile UI & Water Volume Calculations Component.
 */

import { State } from '../state.js';
import { EQUIPMENT_PROFILES } from '../core/data.js';
import { calculateWaterVolumes } from '../core/calculations.js';

/**
 * Populates all equipment dropdown selectors across desktop and mobile.
 */
export function populateEquipmentSelector() {
  const selIds = ['equipment-preset', 'equipment-profile-select', 'mobile-equipment-preset'];
  
  selIds.forEach((id) => {
    const sel = document.getElementById(id);
    if (!sel) return;

    sel.innerHTML = '<option value="">— Välj utrustningsprofil —</option>';
    EQUIPMENT_PROFILES.forEach((profile) => {
      const opt = document.createElement('option');
      opt.value = profile.id;
      opt.textContent = profile.name;
      sel.appendChild(opt);
    });
  });
}

/**
 * Synchronizes equipment state with UI form inputs.
 */
export function syncEquipmentToUI() {
  const eq = State.equipment || {};

  const selIds = ['equipment-preset', 'equipment-profile-select', 'mobile-equipment-preset'];
  selIds.forEach((id) => {
    const sel = document.getElementById(id);
    if (sel) sel.value = eq.id || '';
  });

  const setInputVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };

  setInputVal('eq-name', eq.name || '');
  setInputVal('eq-batch-vol', eq.batchVolume ?? 20);
  setInputVal('eq-efficiency', eq.efficiency ?? 75);
  setInputVal('eq-boiloff', eq.boilOffRate ?? 3.0);
  setInputVal('eq-boil-off', eq.boilOffRate ?? 3.0);
  setInputVal('eq-kettle-loss', eq.kettleLoss ?? 2.0);
  setInputVal('eq-fermenter-loss', eq.fermenterLoss ?? 1.0);
  setInputVal('eq-grain-abs', eq.grainAbsorption ?? 0.96);
  setInputVal('eq-mash-ratio', eq.mashRatio ?? 3.0);
}

/**
 * Reads UI input values into State.equipment and State.recipe.
 */
export function syncEquipmentFromUI() {
  if (!State.equipment) State.equipment = {};

  State.equipment.name = document.getElementById('eq-name')?.value || State.equipment.name || 'Anpassad Utrustning';
  
  const getNumVal = (id, fallback) => {
    const el = document.getElementById(id);
    if (!el) return fallback;
    const val = parseFloat(el.value);
    return isNaN(val) ? fallback : val;
  };

  const batchVol = getNumVal('batch-volume', getNumVal('eq-batch-vol', 20));
  const eff = getNumVal('efficiency', getNumVal('eq-efficiency', 75));

  State.equipment.batchVolume = batchVol;
  State.equipment.efficiency = eff;
  State.equipment.boilOffRate = getNumVal('eq-boiloff', getNumVal('eq-boil-off', 3.0));
  State.equipment.kettleLoss = getNumVal('eq-kettle-loss', 2.0);
  State.equipment.fermenterLoss = getNumVal('eq-fermenter-loss', 1.0);
  State.equipment.grainAbsorption = getNumVal('eq-grain-abs', 0.96);
  State.equipment.mashRatio = getNumVal('eq-mash-ratio', 3.0);

  // Sync batch volume & efficiency to main recipe object as well
  State.recipe.batchVolume = batchVol;
  State.recipe.efficiency = eff;

  // Sync inputs on recipe tab if present
  const mainBatchInput = document.getElementById('batch-volume');
  const mainEffInput = document.getElementById('efficiency');
  if (mainBatchInput && document.activeElement !== mainBatchInput) mainBatchInput.value = batchVol;
  if (mainEffInput && document.activeElement !== mainEffInput) mainEffInput.value = eff;
}

/**
 * Initializes listeners for equipment selection and profile inputs.
 * @param {Function} recalculateCallback
 */
export function setupEquipmentListeners(recalculateCallback) {
  populateEquipmentSelector();

  const selIds = ['equipment-preset', 'equipment-profile-select', 'mobile-equipment-preset'];
  selIds.forEach((id) => {
    const sel = document.getElementById(id);
    sel?.addEventListener('change', (e) => {
      const selectedId = e.target.value;
      const profile = EQUIPMENT_PROFILES.find((p) => p.id === selectedId);
      if (profile) {
        State.equipment = { ...profile };
        State.recipe.batchVolume = profile.batchVolume;
        State.recipe.efficiency = profile.efficiency;
        syncEquipmentToUI();
        recalculateCallback();
      }
    });
  });

  const eqInputIds = [
    'eq-name',
    'eq-batch-vol',
    'eq-efficiency',
    'eq-boiloff',
    'eq-boil-off',
    'eq-kettle-loss',
    'eq-fermenter-loss',
    'eq-grain-abs',
    'eq-mash-ratio',
    'batch-volume',
    'efficiency',
  ];

  eqInputIds.forEach((id) => {
    document.getElementById(id)?.addEventListener('input', () => {
      syncEquipmentFromUI();
      recalculateCallback();
    });
  });
}

/**
 * Renders the calculated water requirements summary card.
 */
export function renderWaterRequirementCard() {
  const volumes = calculateWaterVolumes(
    State.equipment.batchVolume || State.recipe.batchVolume,
    State.recipe.boilTime || 60,
    State.equipment.boilOffRate || 3.0,
    State.equipment.kettleLoss || 2.0,
    State.equipment.fermenterLoss || 1.0,
    State.fermentables,
    State.equipment.grainAbsorption || 0.96,
    State.equipment.mashRatio || 3.0
  );

  State.recipe.boilVolume = volumes.boilVolume;
  const boilVolInput = document.getElementById('boil-volume');
  if (boilVolInput && document.activeElement !== boilVolInput) {
    boilVolInput.value = volumes.boilVolume;
  }

  const reqCard = document.getElementById('water-requirement-card');
  if (reqCard) {
    reqCard.innerHTML = `
      <div class="card" style="background:var(--bg-secondary); border-color:var(--border)">
        <p class="section-label" style="margin-bottom:8px">💧 Beräknat Vattenbehov (${State.equipment?.name || 'Standard'})</p>
        <div class="card-grid-3" style="font-size:0.88rem">
          <div>Mäskvatten: <strong id="vol-mash-water">${volumes.mashWater.toFixed(1)} L</strong></div>
          <div>Lakvatten: <strong id="vol-sparge-water">${volumes.spargeWater.toFixed(1)} L</strong></div>
          <div>Totalt vattenbehov: <strong id="vol-total-water" style="color:var(--accent)">${volumes.totalWater.toFixed(1)} L</strong></div>
        </div>
      </div>
    `;
  }

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setVal('vol-mash-water', `${volumes.mashWater.toFixed(1)} L`);
  setVal('vol-sparge-water', `${volumes.spargeWater.toFixed(1)} L`);
  setVal('vol-total-water', `${volumes.totalWater.toFixed(1)} L`);
  setVal('vol-preboil', `${volumes.boilVolume.toFixed(1)} L`);
  setVal('vol-grain-loss', `${volumes.grainAbsorptionLoss.toFixed(1)} L`);
  setVal('vol-total-grain', `${volumes.totalGrainKg.toFixed(2)} kg`);

  setVal('sb-eq-name', State.equipment?.name || 'Standard Gryta 30L');
  setVal('sb-mash-water', `${volumes.mashWater.toFixed(1)} L`);
  setVal('sb-sparge-water', `${volumes.spargeWater.toFixed(1)} L`);
  setVal('sb-total-water', `${volumes.totalWater.toFixed(1)} L`);
}
