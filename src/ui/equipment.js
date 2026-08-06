/**
 * Equipment Profile UI & Water Volume Calculations Component.
 */

import { State } from '../state.js';
import { EQUIPMENT_PROFILES } from '../core/data.js';
import { calculateWaterVolumes } from '../core/calculations.js';

/**
 * Populates the equipment dropdown selector.
 */
export function populateEquipmentSelector() {
  const sel = document.getElementById('equipment-profile-select');
  if (!sel) return;

  sel.innerHTML = '<option value="">— Välj utrustningsprofil —</option>';
  EQUIPMENT_PROFILES.forEach((profile) => {
    const opt = document.createElement('option');
    opt.value = profile.id;
    opt.textContent = profile.name;
    sel.appendChild(opt);
  });
}

/**
 * Synchronizes equipment state with UI form inputs.
 */
export function syncEquipmentToUI() {
  const eq = State.equipment || {};

  const sel = document.getElementById('equipment-profile-select');
  const nameInput = document.getElementById('eq-name');
  const batchVolInput = document.getElementById('eq-batch-vol');
  const effInput = document.getElementById('eq-efficiency');
  const boilOffInput = document.getElementById('eq-boil-off');
  const kettleLossInput = document.getElementById('eq-kettle-loss');
  const fermenterLossInput = document.getElementById('eq-fermenter-loss');
  const grainAbsInput = document.getElementById('eq-grain-abs');
  const mashRatioInput = document.getElementById('eq-mash-ratio');

  if (sel) sel.value = eq.id || '';
  if (nameInput) nameInput.value = eq.name || '';
  if (batchVolInput) batchVolInput.value = eq.batchVolume ?? 20;
  if (effInput) effInput.value = eq.efficiency ?? 75;
  if (boilOffInput) boilOffInput.value = eq.boilOffRate ?? 3.0;
  if (kettleLossInput) kettleLossInput.value = eq.kettleLoss ?? 2.0;
  if (fermenterLossInput) fermenterLossInput.value = eq.fermenterLoss ?? 1.0;
  if (grainAbsInput) grainAbsInput.value = eq.grainAbsorption ?? 0.96;
  if (mashRatioInput) mashRatioInput.value = eq.mashRatio ?? 3.0;
}

/**
 * Reads UI input values into State.equipment and State.recipe.
 */
export function syncEquipmentFromUI() {
  if (!State.equipment) State.equipment = {};

  State.equipment.name = document.getElementById('eq-name')?.value || 'Anpassad Utrustning';
  const batchVol = parseFloat(document.getElementById('eq-batch-vol')?.value) || 20;
  const eff = parseFloat(document.getElementById('eq-efficiency')?.value) || 75;

  State.equipment.batchVolume = batchVol;
  State.equipment.efficiency = eff;
  State.equipment.boilOffRate = parseFloat(document.getElementById('eq-boil-off')?.value) || 3.0;
  State.equipment.kettleLoss = parseFloat(document.getElementById('eq-kettle-loss')?.value) || 2.0;
  State.equipment.fermenterLoss = parseFloat(document.getElementById('eq-fermenter-loss')?.value) || 1.0;
  State.equipment.grainAbsorption = parseFloat(document.getElementById('eq-grain-abs')?.value) || 0.96;
  State.equipment.mashRatio = parseFloat(document.getElementById('eq-mash-ratio')?.value) || 3.0;

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

  const sel = document.getElementById('equipment-profile-select');
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

  const eqInputIds = [
    'eq-name',
    'eq-batch-vol',
    'eq-efficiency',
    'eq-boil-off',
    'eq-kettle-loss',
    'eq-fermenter-loss',
    'eq-grain-abs',
    'eq-mash-ratio',
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
    State.equipment || State.recipe,
    State.fermentables,
    State.recipe.boilTime || 60
  );

  State.recipe.boilVolume = volumes.boilVolume;
  const boilVolInput = document.getElementById('boil-volume');
  if (boilVolInput && document.activeElement !== boilVolInput) {
    boilVolInput.value = volumes.boilVolume;
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
