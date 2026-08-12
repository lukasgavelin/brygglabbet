/**
 * Main Mobile App Controller.
 * Connects shared application State with Mobile UI elements, sticky metrics, and advanced controls.
 */

import { State } from '../../state.js';
import {
  calculateOG,
  calculateFG,
  calculateABV,
  calculateIBU,
  calculateEBC,
  calculateWaterVolumes,
  calculateWaterProfile,
  formatSG,
  ebcToColor,
} from '../../core/calculations.js';
import { setupMobileNav } from './mobileNav.js';
import { renderMobileFermentablesCards, renderMobileHopsCards } from './mobileCards.js';
import { STYLES, YEASTS, EQUIPMENT_PROFILES, WATER_PROFILES, MASH_PRESETS } from '../../core/data.js';
import { saveRecipe, newRecipe, openRecipeModal, openPresetRecipesModal, exportJSON, importJSON } from '../recipes.js';
import { escHtml } from '../toast.js';

let isMobileViewActive = false;

export function initMobileApp(recalculateCallback) {
  setupMobileNav();
  populateMobileStyleSelector();
  populateMobileYeastSelector();
  populateMobileEquipmentSelector();
  populateMobileWaterSelector();
  setupMobileInputs(recalculateCallback);
  setupMobileYeastInputs(recalculateCallback);
  setupMobileEquipmentInputs(recalculateCallback);
  setupMobileWaterInputs(recalculateCallback);
  setupMobileMashInputs(recalculateCallback);
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
  const baseProfile = {
    ca: State.water.baseCa || 0,
    mg: State.water.baseMg || 0,
    na: State.water.baseNa || 0,
    cl: State.water.baseCl || 0,
    so4: State.water.baseSo4 || 0,
    hco3: State.water.baseHco3 || 0,
  };
  const waterIons = calculateWaterProfile(baseProfile, State.water.salts, State.recipe.batchVolume);
  const ratioText = waterIons.ratio > 0 ? `${waterIons.ratio.toFixed(1)} (${waterIons.ratioDesc})` : '1.0 (Balanserad)';
  setVal('mobile-water-ratio', ratioText);

  // 5. Style Match Card
  updateMobileStyleMatch(sg, fg_sg, abv, ibuResult.total, ebc);

  // 6. Render Cards & Steps
  renderMobileFermentablesCards(recalculateCallback);
  renderMobileHopsCards(recalculateCallback);
  renderMobileMashSteps(recalculateCallback);

  // 7. Sync inputs
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

  setInp('mobile-yeast-name', State.yeast.name);
  setInp('mobile-yeast-lab', State.yeast.lab);
  setInp('mobile-yeast-type', State.yeast.type);
  setInp('mobile-att-min', State.yeast.attMin);
  setInp('mobile-att-max', State.yeast.attMax);

  setInp('mobile-salt-gypsum', State.water.salts.gypsum);
  setInp('mobile-salt-cacl2', State.water.salts.cacl2);
  setInp('mobile-salt-epsom', State.water.salts.epsom);
  setInp('mobile-salt-nacl', State.water.salts.nacl);
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

  // Quick Action Modals
  document.getElementById('mobile-btn-preset-recipes')?.addEventListener('click', () => {
    openPresetRecipesModal(recalculateCallback);
  });
  document.getElementById('mobile-btn-scale-recipe')?.addEventListener('click', () => {
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

function setupMobileYeastInputs(recalculateCallback) {
  const sel = document.getElementById('mobile-yeast-select');
  if (sel) {
    sel.addEventListener('change', (e) => {
      const selectedName = e.target.value;
      const found = YEASTS.find((y) => y.name === selectedName);
      if (found) {
        State.yeast.name = found.name;
        State.yeast.lab = found.lab;
        State.yeast.type = found.type;
        State.yeast.attMin = found.attMin;
        State.yeast.attMax = found.attMax;
        recalculateCallback();
      }
    });
  }

  const fields = [
    { id: 'mobile-yeast-name', key: 'name', type: 'string' },
    { id: 'mobile-yeast-lab', key: 'lab', type: 'string' },
    { id: 'mobile-yeast-type', key: 'type', type: 'string' },
    { id: 'mobile-att-min', key: 'attMin', type: 'float' },
    { id: 'mobile-att-max', key: 'attMax', type: 'float' },
  ];

  fields.forEach(({ id, key, type }) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', (e) => {
        State.yeast[key] = type === 'float' ? parseFloat(e.target.value) || 0 : e.target.value;
        recalculateCallback();
      });
    }
  });
}

function setupMobileEquipmentInputs(recalculateCallback) {
  const sel = document.getElementById('mobile-equipment-preset');
  if (sel) {
    sel.addEventListener('change', (e) => {
      const found = EQUIPMENT_PROFILES.find((eq) => eq.id === e.target.value);
      if (found) {
        State.equipment = { ...found };
        recalculateCallback();
      }
    });
  }
}

function setupMobileWaterInputs(recalculateCallback) {
  const sel = document.getElementById('mobile-water-preset');
  if (sel) {
    sel.addEventListener('change', (e) => {
      const found = WATER_PROFILES.find((p) => p.name === e.target.value);
      if (found) {
        State.water.profileName = found.name;
        State.water.baseCa = found.ca;
        State.water.baseMg = found.mg;
        State.water.baseNa = found.na;
        State.water.baseCl = found.cl;
        State.water.baseSo4 = found.so4;
        State.water.baseHco3 = found.hco3;
        recalculateCallback();
      }
    });
  }

  // Salt steppers
  document.querySelectorAll('.mobile-salt-item .stepper-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const saltKey = btn.dataset.salt;
      const dir = parseFloat(btn.dataset.dir);
      if (State.water.salts[saltKey] !== undefined) {
        State.water.salts[saltKey] = Math.max(0, Math.round((State.water.salts[saltKey] + dir * 0.5) * 10) / 10);
        recalculateCallback();
      }
    });
  });
}

function setupMobileMashInputs(recalculateCallback) {
  // Mash Presets
  document.querySelectorAll('[data-mobile-mash]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const presetKey = btn.dataset.mobileMash;
      const preset = MASH_PRESETS[presetKey];
      if (preset) {
        State.mash.profileName = preset.name;
        State.mash.steps = preset.steps.map((s, idx) => ({ ...s, id: Date.now() + idx }));
        recalculateCallback();
      }
    });
  });

  // Add Mash Step
  document.getElementById('mobile-btn-add-mash-step')?.addEventListener('click', () => {
    State.mash.steps.push({
      id: Date.now(),
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

  container.innerHTML = '';

  State.mash.steps.forEach((step) => {
    const card = document.createElement('div');
    card.className = 'mobile-card';
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

  // Inputs
  container.querySelectorAll('input').forEach((inp) => {
    inp.addEventListener('change', (e) => {
      const id = parseInt(e.target.dataset.id);
      const field = e.target.dataset.field;
      const step = State.mash.steps.find((s) => s.id === id);
      if (step) {
        step[field] = field === 'name' ? e.target.value : parseFloat(e.target.value) || 0;
        recalculateCallback();
      }
    });
  });

  // Steppers
  container.querySelectorAll('.stepper-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      const field = btn.dataset.stepField;
      const dir = parseFloat(btn.dataset.dir);
      const step = State.mash.steps.find((s) => s.id === id);
      if (step) {
        step[field] = Math.max(0, step[field] + dir);
        recalculateCallback();
      }
    });
  });

  // Remove
  container.querySelectorAll('[data-remove-step]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.removeStep);
      State.mash.steps = State.mash.steps.filter((s) => s.id !== id);
      recalculateCallback();
    });
  });
}

function updateMobileStyleMatch(og, fg, abv, ibu, ebc) {
  const nameEl = document.getElementById('mobile-style-match-name');
  const container = document.getElementById('mobile-style-bars-container');
  if (!container) return;

  const style = STYLES.find((s) => s.id === State.recipe.styleId);
  if (!style) {
    if (nameEl) nameEl.textContent = 'Välj en ölstil ovan';
    container.innerHTML = '';
    return;
  }

  if (nameEl) nameEl.textContent = `${style.id} – ${style.name}`;

  const metrics = [
    { label: 'OG', current: og, min: style.ogMin, max: style.ogMax, fmt: (v) => v.toFixed(3) },
    { label: 'FG', current: fg, min: style.fgMin, max: style.fgMax, fmt: (v) => v.toFixed(3) },
    { label: 'ABV', current: abv, min: style.abvMin, max: style.abvMax, fmt: (v) => `${v.toFixed(1)}%` },
    { label: 'IBU', current: ibu, min: style.ibuMin, max: style.ibuMax, fmt: (v) => v.toFixed(0) },
    { label: 'EBC', current: ebc, min: style.ebcMin, max: style.ebcMax, fmt: (v) => v.toFixed(0) },
  ];

  container.innerHTML = metrics
    .map((m) => {
      const inRange = m.current >= m.min && m.current <= m.max;
      const pct = Math.min(100, Math.max(0, ((m.current - m.min) / (m.max - m.min || 1)) * 100));
      const barColor = inRange ? '#10b981' : '#ef4444';

      return `
      <div class="mobile-style-row">
        <span class="lbl">${m.label}: <strong>${m.fmt(m.current)}</strong></span>
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct}%; background:${barColor}"></div>
        </div>
        <span class="range">${m.fmt(m.min)} – ${m.fmt(m.max)}</span>
      </div>
    `;
    })
    .join('');
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

function populateMobileYeastSelector() {
  const sel = document.getElementById('mobile-yeast-select');
  if (!sel) return;

  sel.innerHTML = '<option value="">— Välj ur jästdatabas —</option>';
  YEASTS.forEach((y) => {
    const opt = document.createElement('option');
    opt.value = y.name;
    opt.textContent = `${y.name} (${y.lab})`;
    sel.appendChild(opt);
  });
}

function populateMobileEquipmentSelector() {
  const sel = document.getElementById('mobile-equipment-preset');
  if (!sel) return;

  sel.innerHTML = '';
  EQUIPMENT_PROFILES.forEach((eq) => {
    const opt = document.createElement('option');
    opt.value = eq.id;
    opt.textContent = eq.name;
    sel.appendChild(opt);
  });
}

function populateMobileWaterSelector() {
  const sel = document.getElementById('mobile-water-preset');
  if (!sel) return;

  sel.innerHTML = '<option value="">— Välj vattenprofil —</option>';
  WATER_PROFILES.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.name;
    opt.textContent = p.name;
    sel.appendChild(opt);
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
