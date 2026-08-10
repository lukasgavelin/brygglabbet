/**
 * Main Mobile App Controller.
 * Connects shared application State with Mobile UI elements and sticky metrics.
 */

import { State } from '../../state.js';
import {
  calculateOG,
  calculateFG,
  calculateABV,
  calculateIBU,
  calculateEBC,
  sgToPlato,
  formatSG,
  ebcToColor,
  ebcToLabel,
} from '../../core/calculations.js';
import { setupMobileNav } from './mobileNav.js';
import { renderMobileFermentablesCards, renderMobileHopsCards } from './mobileCards.js';
import { STYLES } from '../../core/data.js';
import { openFermentableModal, openHopModal, openModal } from '../modals.js';
import { saveRecipe, newRecipe, openRecipeModal, exportJSON, importJSON } from '../recipes.js';

let isMobileViewActive = false;

export function initMobileApp(recalculateCallback) {
  setupMobileNav();
  populateMobileStyleSelector();
  setupMobileInputs(recalculateCallback);
  setupMobileMenuActions(recalculateCallback);
  setupViewSwitcher();

  // Check initial viewport width
  checkViewportMode();
  window.addEventListener('resize', checkViewportMode);
}

export function updateMobileUI(recalculateCallback) {
  const ogResult = calculateOG(
    State.fermentables,
    State.recipe.batchVolume,
    State.recipe.efficiency
  );
  const sg = ogResult.sg;
  const plato = ogResult.plato;

  const attMid = (State.yeast.attMin + State.yeast.attMax) / 2;
  const fg_sg = calculateFG(sg, attMid);
  const abv = calculateABV(sg, fg_sg);
  const ibuResult = calculateIBU(State.hops, sg, State.recipe.batchVolume);
  const ebcResult = calculateEBC(State.fermentables, State.recipe.batchVolume);
  const ebc = ebcResult.ebc;

  // 1. Update Sticky Metrics Bar
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setVal('mobile-metric-og', sg > 1 ? formatSG(sg) : '1.000');
  setVal('mobile-metric-abv', abv > 0 ? `${abv.toFixed(1)}%` : '0.0%');
  setVal('mobile-metric-ibu', ibuResult.total > 0 ? `${ibuResult.total.toFixed(0)}` : '0');
  setVal('mobile-metric-ebc', ebc > 0 ? `${ebc.toFixed(0)}` : '0');

  const colorDot = document.getElementById('mobile-metric-color-dot');
  if (colorDot) {
    colorDot.style.background = ebcToColor(ebc);
  }

  // 2. Render Cards
  renderMobileFermentablesCards(recalculateCallback);
  renderMobileHopsCards(recalculateCallback);

  // 3. Sync inputs to State
  syncMobileInputValues();
}

function syncMobileInputValues() {
  const setInp = (id, val) => {
    const el = document.getElementById(id);
    if (el && document.activeElement !== el) {
      el.value = val !== undefined && val !== null ? val : '';
    }
  };

  setInp('mobile-recipe-name', State.recipe.name);
  setInp('mobile-batch-volume', State.recipe.batchVolume);
  setInp('mobile-boil-volume', State.recipe.boilVolume);
  setInp('mobile-boil-time', State.recipe.boilTime);
  setInp('mobile-efficiency', State.recipe.efficiency);
  setInp('mobile-recipe-style', State.recipe.styleId);
  setInp('mobile-recipe-notes', State.recipe.notes);
}

function setupMobileInputs(recalculateCallback) {
  const nameInp = document.getElementById('mobile-recipe-name');
  if (nameInp) {
    nameInp.addEventListener('input', (e) => {
      State.recipe.name = e.target.value;
      const desktopInp = document.getElementById('recipe-name-input');
      if (desktopInp) desktopInp.value = e.target.value;
    });
  }

  const inputs = [
    { id: 'mobile-batch-volume', key: 'batchVolume' },
    { id: 'mobile-boil-volume', key: 'boilVolume' },
    { id: 'mobile-boil-time', key: 'boilTime' },
    { id: 'mobile-efficiency', key: 'efficiency' },
  ];

  inputs.forEach(({ id, key }) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', (e) => {
        State.recipe[key] = parseFloat(e.target.value) || 0;
        recalculateCallback();
      });
    }
  });

  const styleSel = document.getElementById('mobile-recipe-style');
  if (styleSel) {
    styleSel.addEventListener('change', (e) => {
      State.recipe.styleId = e.target.value;
      recalculateCallback();
    });
  }

  const notesTxt = document.getElementById('mobile-recipe-notes');
  if (notesTxt) {
    notesTxt.addEventListener('input', (e) => {
      State.recipe.notes = e.target.value;
    });
  }

  // Mobile "Add ingredient" triggers
  document.getElementById('mobile-btn-add-fermentable')?.addEventListener('click', () => {
    openFermentableModal(recalculateCallback);
  });
  document.getElementById('mobile-btn-add-hop')?.addEventListener('click', () => {
    openHopModal(recalculateCallback);
  });
}

function populateMobileStyleSelector() {
  const sel = document.getElementById('mobile-recipe-style');
  if (!sel) return;

  sel.innerHTML = '<option value="">— Välj ölstil —</option>';
  const categories = [...new Set(STYLES.map((s) => s.category))];
  categories.forEach((cat) => {
    const group = document.createElement('optgroup');
    group.label = cat;
    STYLES.filter((s) => s.category === cat).forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `${s.id} – ${s.name}`;
      group.appendChild(opt);
    });
    sel.appendChild(group);
  });
}

function setupMobileMenuActions(recalculateCallback) {
  document.getElementById('mobile-menu-new')?.addEventListener('click', () => newRecipe(recalculateCallback));
  document.getElementById('mobile-menu-open')?.addEventListener('click', () => openRecipeModal(recalculateCallback));
  document.getElementById('mobile-menu-save')?.addEventListener('click', saveRecipe);
  document.getElementById('mobile-menu-export')?.addEventListener('click', exportJSON);
  document.getElementById('mobile-menu-import')?.addEventListener('click', () => {
    document.getElementById('import-file-input')?.click();
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
  const userPref = localStorage.getItem('brygglabbet_view_mode');

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

  localStorage.setItem('brygglabbet_view_mode', mode);
}
