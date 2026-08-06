/**
 * Recipe persistence (localStorage, JSON import/export, default recipe).
 */

import { State, createInitialState, setNextId, generateId } from '../state.js';
import { calculateOG, formatSG } from '../core/calculations.js';
import { openModal, closeModal } from './modals.js';
import { showToast, escHtml } from './toast.js';
import { syncYeastToUI } from './yeast.js';
import { syncWaterToUI } from './water.js';
import { renderMashTable } from './mash.js';

const LOCAL_STORAGE_KEY = 'brew_recipes';

export function getSavedRecipes() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

export function saveRecipe() {
  const nameInput = document.getElementById('recipe-name-input');
  const name = nameInput ? nameInput.value.trim() || 'Namnlöst recept' : 'Namnlöst recept';
  State.recipe.name = name;

  const all = getSavedRecipes();
  all[name] = JSON.parse(JSON.stringify(State));
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(all));
  showToast(`💾 Recept sparat: ${name}`, 'success');
}

export function newRecipe(recalculateCallback) {
  if (!confirm('Skapa ett nytt recept? Osparade ändringar försvinner.')) return;
  Object.assign(State, createInitialState());
  syncUIFromState(recalculateCallback);
}

export function openRecipeModal(recalculateCallback) {
  const all = getSavedRecipes();
  const list = document.getElementById('recipes-list');
  const noMsg = document.getElementById('no-recipes-msg');
  if (!list || !noMsg) return;

  list.innerHTML = '';
  const keys = Object.keys(all);
  if (keys.length === 0) {
    noMsg.style.display = '';
  } else {
    noMsg.style.display = 'none';
    keys.forEach((name) => {
      const r = all[name];
      const og =
        r.fermentables?.length > 0
          ? formatSG(
              calculateOG(r.fermentables, r.recipe?.batchVolume || 20, r.recipe?.efficiency || 75)
                .sg
            )
          : '—';

      const div = document.createElement('div');
      div.className = 'recipe-list-item';
      div.innerHTML = `
        <div style="flex:1; cursor:pointer">
          <div class="recipe-name">${escHtml(name)}</div>
          <div class="recipe-meta">${r.recipe?.batchVolume || '?'}L · OG ${og} · ${r.fermentables?.length || 0} malter · ${r.hops?.length || 0} humle</div>
        </div>
        <div class="recipe-list-actions">
          <button class="btn btn-secondary btn-sm" data-load="${escHtml(name)}">Ladda</button>
          <button class="btn btn-danger btn-sm" data-delete="${escHtml(name)}">✕</button>
        </div>
      `;

      div.querySelector('[data-load]')?.addEventListener('click', () => {
        loadRecipe(name, recalculateCallback);
        closeModal('modal-recipes');
      });

      div.querySelector('[data-delete]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Ta bort "${name}"?`)) {
          delete all[name];
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(all));
          div.remove();
          if (Object.keys(all).length === 0) noMsg.style.display = '';
        }
      });

      list.appendChild(div);
    });
  }
  openModal('modal-recipes');
}

export function loadRecipe(name, recalculateCallback) {
  const all = getSavedRecipes();
  const saved = all[name];
  if (!saved) return;

  Object.assign(State, JSON.parse(JSON.stringify(saved)));

  let maxId = 0;
  [...State.fermentables, ...State.hops, ...State.mash].forEach((x) => {
    if (x.id && x.id > maxId) maxId = x.id;
  });
  setNextId(maxId);

  syncUIFromState(recalculateCallback);
  showToast(`📂 Recept laddat: ${name}`, 'success');
}

export function syncUIFromState(recalculateCallback) {
  const nameInput = document.getElementById('recipe-name-input');
  const batchVolInput = document.getElementById('batch-volume');
  const boilVolInput = document.getElementById('boil-volume');
  const boilTimeInput = document.getElementById('boil-time');
  const effInput = document.getElementById('efficiency');
  const attMinInput = document.getElementById('att-min');
  const attMaxInput = document.getElementById('att-max');
  const notesInput = document.getElementById('recipe-notes');
  const styleSelect = document.getElementById('recipe-style');

  if (nameInput) nameInput.value = State.recipe.name || '';
  if (batchVolInput) batchVolInput.value = State.recipe.batchVolume || 20;
  if (boilVolInput) boilVolInput.value = State.recipe.boilVolume || 25;
  if (boilTimeInput) boilTimeInput.value = State.recipe.boilTime || 60;
  if (effInput) effInput.value = State.recipe.efficiency || 75;
  if (attMinInput) attMinInput.value = State.yeast.attMin || 72;
  if (attMaxInput) attMaxInput.value = State.yeast.attMax || 78;
  if (notesInput) notesInput.value = State.recipe.notes || '';
  if (styleSelect) styleSelect.value = State.recipe.styleId || '';

  syncYeastToUI();
  syncWaterToUI();
  renderMashTable(recalculateCallback);
  recalculateCallback();
}

export function exportJSON() {
  const name = State.recipe.name || 'recept';
  const data = JSON.stringify(State, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name.replace(/[^a-z0-9åäö]/gi, '_')}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📤 Recept exporterat som JSON', 'success');
}

export function importJSON(e, recalculateCallback) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const data = JSON.parse(evt.target.result);
      Object.assign(State, data);
      syncUIFromState(recalculateCallback);
      showToast(`📥 Recept importerat: ${State.recipe.name || 'Okänt'}`, 'success');
    } catch {
      showToast('⚠️ Ogiltig JSON-fil', 'error');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
}

export function loadDefaultRecipe(recalculateCallback) {
  State.recipe = {
    name: 'Gyllene Pale Ale',
    styleId: '18B',
    batchVolume: 20,
    boilVolume: 25,
    boilTime: 60,
    efficiency: 75,
    notes: 'Exempel-recept – en fruktig och fräsch Pale Ale.',
  };
  State.fermentables = [
    { id: generateId(), name: 'Pale Malt (2-rad)', amount: 4.2, ebc: 5, yield: 78, type: 'base' },
    {
      id: generateId(),
      name: 'Crystal 60 / Cara 60',
      amount: 0.3,
      ebc: 120,
      yield: 70,
      type: 'cara',
    },
    { id: generateId(), name: 'Caramünchen I', amount: 0.2, ebc: 50, yield: 70, type: 'cara' },
  ];
  State.hops = [
    {
      id: generateId(),
      name: 'Magnum',
      amount: 20,
      alpha: 12.0,
      time: 60,
      form: 'pellets',
      use: 'kok',
    },
    {
      id: generateId(),
      name: 'Cascade',
      amount: 20,
      alpha: 5.5,
      time: 15,
      form: 'pellets',
      use: 'kok',
    },
    {
      id: generateId(),
      name: 'Amarillo',
      amount: 25,
      alpha: 9.5,
      time: 5,
      form: 'pellets',
      use: 'kok',
    },
    {
      id: generateId(),
      name: 'Citra',
      amount: 30,
      alpha: 12.0,
      time: 0,
      form: 'pellets',
      use: 'torrhumle',
    },
  ];
  State.yeast = {
    name: 'Safale US-05',
    lab: 'Fermentis',
    type: 'ale',
    attMin: 73,
    attMax: 77,
    tempMin: 15,
    tempMax: 22,
    notes: '',
  };
  State.mash = [
    { id: generateId(), name: 'Sackarifikation', type: 'Infusion', temp: 67, time: 60 },
    { id: generateId(), name: 'Avmäskning', type: 'Steg', temp: 78, time: 10 },
  ];
  State.water = {
    volume: 25,
    base: { ca: 50, mg: 10, na: 20, cl: 50, so4: 80, hco3: 100 },
    salts: { gypsum: 3, calciumChloride: 0, epsomSalt: 0, tableSalt: 0, chalk: 0, bakingSoda: 0 },
  };

  syncUIFromState(recalculateCallback);
}
