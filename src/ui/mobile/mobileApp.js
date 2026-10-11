/**
 * Main Mobile App Controller.
 * Modular, decoupled controller connecting shared State with Mobile UI elements,
 * sticky metrics, and mobile-friendly steppers.
 */

import { State, generateId, undoState, redoState } from '../../state.js';
import {
  computeRecipeMetrics,
  calculateWaterVolumes,
  calculateWaterProfile,
  chlorideSulfateBalance,
  formatSG,
  ebcToColor,
} from '../../core/calculations.js';
import { setupMobileNav } from './mobileNav.js';
import { mountMobileAppView } from './mobileTemplate.js';
import { renderMobileFermentablesCards, renderMobileHopsCards } from './mobileCards.js';
import { MASH_PRESETS } from '../../core/data.js';
import { setupContinuousStepperDelegation } from './mobileStepper.js';
import {
  saveRecipe,
  newRecipe,
  openRecipeModal,
  openPresetRecipesModal,
  exportJSON,
  exportBeerXMLFile,
  syncUIFromState,
} from '../recipes.js';
import { openModal, openFermentableModal, openHopModal } from '../modals.js';
import { toggleBrewdayView } from '../brewday.js';
import { openBatchesView } from '../batches.js';
import { triggerPrint } from '../print.js';
import { openToolsModal } from '../tools.js';
import { renderMashTable } from '../mash.js';
import { escHtml } from '../toast.js';
import { safeStorage } from '../../core/storage.js';
import { updateStyleMatch } from '../styleMatch.js';
import { setupSyncBridge, syncInputsFromState } from '../syncBridge.js';

// eslint-disable-next-line no-unused-vars
let isMobileViewActive = false;

export function initMobileApp(recalculateCallback) {
  mountMobileAppView();
  setupSyncBridge(recalculateCallback);
  setupMobileNav();
  setupMobileActionButtons(recalculateCallback);
  setupMobileMashInputs(recalculateCallback);
  setupMobileMenuActions(recalculateCallback);
  setupViewSwitcher();

  // Viewport mode check
  checkViewportMode();
  window.addEventListener('resize', checkViewportMode);
}

export function updateMobileUI(recalculateCallback) {
  const metrics = computeRecipeMetrics(State);
  const sg = metrics.og;
  const abv = metrics.abv;
  const ibuResult = { total: metrics.ibu, perHop: metrics.ibuPerHop };
  const ebc = metrics.ebc;

  // 1. Sticky Metrics Bar
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setVal('mobile-metric-og', sg > 1 ? formatSG(sg) : '1.000');
  setVal('mobile-metric-abv', abv > 0 ? `${abv.toFixed(1)}%` : '0.0%');
  setVal('mobile-metric-ibu', ibuResult.total > 0 ? `${ibuResult.total.toFixed(0)}` : '0');
  setVal('mobile-metric-ebc-text', ebc > 0 ? `${ebc.toFixed(0)}` : '0');

  const colorDot = document.getElementById('mobile-metric-color-dot');
  if (colorDot) {
    colorDot.style.background = ebcToColor(ebc);
  }

  // 2. Summary Banners
  const totalMaltKg = State.fermentables.reduce((s, f) => s + (f.amount || 0), 0);
  setVal('mobile-total-malt-kg', `${totalMaltKg.toFixed(2)} kg`);
  setVal('mobile-total-malt-ebc', ebc.toFixed(0));

  const totalHopsG = State.hops.reduce((s, h) => s + (h.amount || 0), 0);
  setVal('mobile-total-hops-g', `${totalHopsG} g`);
  setVal('mobile-total-hops-ibu', ibuResult.total.toFixed(1));

  // 3. Water Requirements
  const waterReq = calculateWaterVolumes(State.equipment, State.fermentables, State.recipe.boilTime);
  setVal('mobile-mash-water', `${waterReq.mashWater.toFixed(1)} L`);
  setVal('mobile-sparge-water', `${waterReq.spargeWater.toFixed(1)} L`);
  setVal('mobile-total-water', `${waterReq.totalWater.toFixed(1)} L`);

  // 4. Water Salts & Cl:SO4 ratio
  const treatedWaterVol = State.water?.volume || 25;
  const waterIons = calculateWaterProfile(State.water.base, State.water.salts, treatedWaterVol);
  const ratioResult = chlorideSulfateBalance(waterIons);
  const ratioText = ratioResult.ratio > 0 ? `${ratioResult.ratio.toFixed(1)} (${ratioResult.label})` : '1.0 (Balanserad)';
  setVal('mobile-water-ratio', ratioText);

  // 5. Style Match Card (Unified)
  updateStyleMatch(metrics, State.recipe.styleId);

  // 6. Render Ingredient Cards & Mash Steps
  renderMobileFermentablesCards(recalculateCallback);
  renderMobileHopsCards(recalculateCallback);
  renderMobileMashSteps(recalculateCallback);

  // 7. Sync all form inputs
  syncInputsFromState();
}

function setupMobileActionButtons(recalculateCallback) {
  // Quick Action Modals
  document.getElementById('mobile-btn-preset-recipes')?.addEventListener('click', () => {
    openPresetRecipesModal(recalculateCallback);
  });
  document.getElementById('mobile-btn-scale-recipe')?.addEventListener('click', () => {
    openModal('modal-scale-recipe');
  });

  // Screen 5 CTA buttons
  document.getElementById('mobile-btn-batches')?.addEventListener('click', () => {
    openBatchesView();
  });
  document.getElementById('mobile-btn-start-brewday')?.addEventListener('click', () => {
    toggleBrewdayView(recalculateCallback);
  });
  document.getElementById('mobile-btn-print-brewday')?.addEventListener('click', triggerPrint);
  document.getElementById('mobile-btn-scale-brewday')?.addEventListener('click', () => {
    openModal('modal-scale-recipe');
  });

  // Mobile Add ingredient triggers
  document.getElementById('mobile-btn-add-fermentable')?.addEventListener('click', () => {
    openFermentableModal(recalculateCallback);
  });
  document.getElementById('mobile-btn-add-hop')?.addEventListener('click', () => {
    openHopModal(recalculateCallback);
  });
}

function setupMobileMashInputs(recalculateCallback) {
  // Mash Presets
  document.querySelectorAll('[data-mobile-mash]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const presetKey = btn.dataset.mobileMash;
      const preset = MASH_PRESETS[presetKey];
      if (preset) {
        State.mash = preset.steps.map((s) => ({ ...s, id: generateId() }));
        recalculateCallback();
      }
    });
  });

  // Add Mash Step
  document.getElementById('mobile-btn-add-mash-step')?.addEventListener('click', () => {
    State.mash.push({
      id: generateId(),
      name: 'Försockring',
      temp: 67,
      time: 60,
      type: 'Infusion',
    });
    recalculateCallback();
  });
}

function renderMobileMashSteps(recalculateCallback) {
  const container = document.getElementById('mobile-mash-steps-list');
  if (!container) return;

  // Initialize delegated listeners once
  if (!container.dataset.initialized) {
    setupMashStepsDelegation(container, recalculateCallback);
    container.dataset.initialized = 'true';
  }

  // Ensure all steps have IDs
  State.mash.forEach((step) => {
    if (step.id === undefined || step.id === null) {
      step.id = generateId();
    }
  });

  // Fast path: In-place DOM update if IDs match
  const currentCards = Array.from(container.children);
  const isMatch =
    currentCards.length === State.mash.length &&
    currentCards.every((card, idx) => Number(card.dataset.cardId) === Number(State.mash[idx]?.id));

  if (isMatch) {
    State.mash.forEach((step, idx) => {
      const card = currentCards[idx];
      const nameInp = card.querySelector('.mobile-input-name');
      if (nameInp && document.activeElement !== nameInp && nameInp.value !== step.name) {
        nameInp.value = step.name;
      }
      const tempInp = card.querySelector('input[data-field="temp"]');
      if (tempInp && document.activeElement !== tempInp && Number(tempInp.value) !== step.temp) {
        tempInp.value = step.temp;
      }
      const timeInp = card.querySelector('input[data-field="time"]');
      if (timeInp && document.activeElement !== timeInp && Number(timeInp.value) !== step.time) {
        timeInp.value = step.time;
      }
    });
    return;
  }

  // Slow path: structural update
  container.innerHTML = '';

  State.mash.forEach((step) => {
    const card = document.createElement('div');
    card.className = 'mobile-card';
    card.dataset.cardId = String(step.id);
    card.innerHTML = `
      <div class="mobile-card-header">
        <div class="mobile-card-title">
          <span>🌡️</span>
          <input type="text" class="mobile-input-name" value="${escHtml(step.name)}" data-id="${step.id}" data-field="name">
        </div>
        <button class="btn btn-danger btn-icon btn-sm" data-remove-step="${step.id}">✕</button>
      </div>

      <div class="mobile-card-body">
        <div class="mobile-field-group">
          <label class="mobile-field-label">Temp (°C)</label>
          <div class="mobile-stepper">
            <button class="stepper-btn" data-step-field="temp" data-dir="-1" data-id="${step.id}">–</button>
            <input type="number" inputmode="decimal" class="stepper-input" value="${step.temp}" min="30" max="100" data-id="${step.id}" data-field="temp">
            <button class="stepper-btn" data-step-field="temp" data-dir="1" data-id="${step.id}">+</button>
          </div>
        </div>

        <div class="mobile-field-group">
          <label class="mobile-field-label">Tid (min)</label>
          <div class="mobile-stepper">
            <button class="stepper-btn" data-step-field="time" data-dir="-5" data-id="${step.id}">–</button>
            <input type="number" inputmode="decimal" class="stepper-input" value="${step.time}" min="0" max="240" step="5" data-id="${step.id}" data-field="time">
            <button class="stepper-btn" data-step-field="time" data-dir="5" data-id="${step.id}">+</button>
          </div>
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

function setupMashStepsDelegation(container, recalculateCallback) {
  // Inputs change
  container.addEventListener('change', (e) => {
    const id = parseInt(e.target.dataset.id, 10);
    const field = e.target.dataset.field;
    if (!id || !field) return;

    const step = State.mash.find((s) => s.id === id);
    if (step) {
      step[field] = field === 'name' ? e.target.value : parseFloat(e.target.value) || 0;
      recalculateCallback();
    }
  });

  // Remove step
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove-step]');
    if (!btn) return;
    const id = parseInt(btn.dataset.removeStep, 10);
    State.mash = State.mash.filter((s) => s.id !== id);
    renderMobileMashSteps(recalculateCallback);
    renderMashTable(recalculateCallback);
    recalculateCallback();
  });

  // Continuous steppers
  setupContinuousStepperDelegation(container, (btn) => {
    const id = parseInt(btn.dataset.id, 10);
    const field = btn.dataset.stepField;
    const dir = parseFloat(btn.dataset.dir);
    const step = State.mash.find((s) => s.id === id);
    if (step) {
      step[field] = Math.max(0, step[field] + dir);
      recalculateCallback();
    }
  });
}

function setupMobileMenuActions(recalculateCallback) {
  document.getElementById('mobile-menu-batches')?.addEventListener('click', () => openBatchesView());
  document.getElementById('mobile-menu-brewday')?.addEventListener('click', () => toggleBrewdayView(recalculateCallback));
  document.getElementById('mobile-menu-print')?.addEventListener('click', triggerPrint);
  document.getElementById('mobile-menu-tools')?.addEventListener('click', () => openToolsModal());
  document.getElementById('mobile-menu-new')?.addEventListener('click', () => newRecipe(recalculateCallback));
  document.getElementById('mobile-menu-open')?.addEventListener('click', () => openRecipeModal(recalculateCallback));
  document.getElementById('mobile-menu-save')?.addEventListener('click', saveRecipe);
  document.getElementById('mobile-menu-export')?.addEventListener('click', exportJSON);
  document.getElementById('mobile-menu-export-beerxml')?.addEventListener('click', exportBeerXMLFile);
  document.getElementById('mobile-menu-import')?.addEventListener('click', () => {
    document.getElementById('import-file-input')?.click();
  });
  document.getElementById('mobile-menu-undo')?.addEventListener('click', () => {
    undoState(() => syncUIFromState(recalculateCallback));
  });
  document.getElementById('mobile-menu-redo')?.addEventListener('click', () => {
    redoState(() => syncUIFromState(recalculateCallback));
  });
  document.getElementById('mobile-menu-guide')?.addEventListener('click', () => openModal('modal-swe-info'));
}

function setupViewSwitcher() {
  document.getElementById('btn-switch-to-desktop')?.addEventListener('click', () => {
    setMode('desktop');
  });
  document.getElementById('btn-switch-to-mobile')?.addEventListener('click', () => {
    setMode('mobile');
  });
}

function checkViewportMode() {
  const isSmallScreen = window.innerWidth <= 768;
  const userPref = safeStorage.getItem('brygglabbet_view_mode');

  if (userPref === 'desktop') {
    setMode('desktop');
  } else if (userPref === 'mobile' || isSmallScreen) {
    setMode('mobile');
  } else {
    setMode('desktop');
  }
}

function setMode(mode) {
  const desktopApp = document.getElementById('desktop-app-view');
  const mobileApp = document.getElementById('mobile-app-view');

  if (mode === 'mobile') {
    desktopApp?.classList.add('view-hidden');
    mobileApp?.classList.remove('view-hidden');
    document.body.classList.add('mobile-mode');
    isMobileViewActive = true;
  } else {
    desktopApp?.classList.remove('view-hidden');
    mobileApp?.classList.add('view-hidden');
    document.body.classList.remove('mobile-mode');
    isMobileViewActive = false;
  }

  safeStorage.setItem('brygglabbet_view_mode', mode);
}
