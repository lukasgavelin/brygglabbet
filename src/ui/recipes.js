/**
 * Recipe persistence (localStorage, JSON import/export, default recipe).
 */

import { State, createInitialState, setNextId, generateId } from '../state.js';
import { calculateOG, formatSG, scaleRecipe } from '../core/calculations.js';
import { PRESET_RECIPES } from '../core/data.js';
import { openModal, closeModal } from './modals.js';
import { showToast, escHtml } from './toast.js';
import { recalculate } from './sidebar.js';
import { renderFermentablesTable } from './fermentables.js';
import { renderHopsTable } from './hops.js';
import { renderMashTable } from './mash.js';
import { syncYeastToUI } from './yeast.js';
import { syncWaterToUI } from './water.js';
import { syncEquipmentToUI } from './equipment.js';
import { renderMobileFermentablesCards, renderMobileHopsCards } from './mobile/mobileCards.js';
import { setupInputSteppers } from './stepper.js';
import { exportBeerXML, importBeerXML } from '../core/beerxml.js';

const LOCAL_STORAGE_KEY = 'brygglabbet_recipes';
const FALLBACK_STORAGE_KEY = 'brew_recipes';

export function getSavedRecipes() {
  try {
    const primary = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (primary) return JSON.parse(primary);
    const fallback = localStorage.getItem(FALLBACK_STORAGE_KEY);
    if (fallback) return JSON.parse(fallback);
    return {};
  } catch {
    return {};
  }
}

export function saveRecipe() {
  const nameInput = document.getElementById('recipe-name-input');
  const name = nameInput ? nameInput.value.trim() || 'Namnlöst recept' : 'Namnlöst recept';
  State.recipe.name = name;

  const all = getSavedRecipes();
  if (all[name]) {
    if (!confirm(`Ett recept med namnet "${name}" finns redan. Vill du skriva över det?`)) {
      return;
    }
  }
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
          <div class="recipe-meta">${r.recipe?.batchVolume || '?'}L · OG ${og} · ${r.fermentables?.length || 0} maltsorter · ${r.hops?.length || 0} humlegivor</div>
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

export function loadPresetRecipe(presetId, recalculateCallback) {
  const cb = typeof recalculateCallback === 'function' ? recalculateCallback : recalculate;
  const preset = PRESET_RECIPES.find((p) => p.id === presetId);
  if (!preset) return;

  pushHistory();

  const targetVol = State.equipment?.batchVolume || State.recipe?.batchVolume || 20;
  const eqName = State.equipment?.name || 'Standard Gryta 30L';
  const baseVol = preset.recipe.batchVolume || 20;
  const factor = targetVol / baseVol;

  State.recipe = {
    ...preset.recipe,
    batchVolume: targetVol,
    boilVolume: Math.round((preset.recipe.boilVolume || 25) * factor),
  };

  State.fermentables = (preset.fermentables || []).map((f) => ({
    ...f,
    id: generateId(),
    amount: Math.round(f.amount * factor * 100) / 100,
  }));

  State.hops = (preset.hops || []).map((h) => ({
    ...h,
    id: generateId(),
    amount: Math.round(h.amount * factor),
  }));

  State.yeast = preset.yeast ? JSON.parse(JSON.stringify(preset.yeast)) : { name: '' };
  State.mash = (preset.mash || []).map((m) => ({ ...m, id: generateId() }));

  if (preset.water) {
    State.water = {
      volume: Math.round((preset.water.volume || 25) * factor),
      base: { ...(preset.water.base || { ca: 0, mg: 0, na: 0, cl: 0, so4: 0, hco3: 0 }) },
      salts: {
        gypsum: Math.round((preset.water.salts?.gypsum || 0) * factor * 10) / 10,
        calciumChloride: Math.round((preset.water.salts?.calciumChloride || 0) * factor * 10) / 10,
        epsomSalt: Math.round((preset.water.salts?.epsomSalt || 0) * factor * 10) / 10,
        tableSalt: Math.round((preset.water.salts?.tableSalt || 0) * factor * 10) / 10,
        chalk: Math.round((preset.water.salts?.chalk || 0) * factor * 10) / 10,
        bakingSoda: Math.round((preset.water.salts?.bakingSoda || 0) * factor * 10) / 10,
      },
    };
  }

  let maxId = 0;
  [...State.fermentables, ...State.hops, ...State.mash].forEach((x) => {
    if (x.id && x.id > maxId) maxId = x.id;
  });
  setNextId(maxId);

  closeModal('modal-preset-recipes');

  // Uncollapse accordion sections so the loaded recipe is visible immediately!
  ['sec-equipment', 'sec-water', 'sec-fermentables', 'sec-mash', 'sec-hops', 'sec-yeast', 'sec-recipe-info'].forEach((id) => {
    document.getElementById(id)?.classList.remove('collapsed');
  });

  syncUIFromState(cb);
  showToast(`🍺 Exempelrecept "${preset.name}" inläst & skalat till ${targetVol}L (${eqName})!`, 'success');
}

export function openPresetRecipesModal(recalculateCallback) {
  const cb = typeof recalculateCallback === 'function' ? recalculateCallback : recalculate;
  const container = document.getElementById('preset-recipes-list');
  if (!container) return;

  const targetVol = State.equipment?.batchVolume || State.recipe?.batchVolume || 20;
  const eqName = State.equipment?.name || 'Standard Gryta 30L';

  container.innerHTML = PRESET_RECIPES.map((preset) => {
    const baseVol = preset.recipe.batchVolume || 20;
    const factor = targetVol / baseVol;
    const scaledTotalMalt = preset.fermentables.reduce((sum, f) => sum + (f.amount * factor), 0).toFixed(2);

    return `
      <div class="preset-recipe-card" data-preset-id="${preset.id}" style="cursor:pointer">
        <div class="preset-recipe-info">
          <div class="preset-recipe-title">
            <span>🍺 ${escHtml(preset.name)}</span>
            <span class="badge-tag">${preset.styleId}</span>
          </div>
          <p class="preset-recipe-desc">${escHtml(preset.description)}</p>
          <div class="preset-recipe-meta">
            ⚡ Skalas automatiskt till din utrustning: <strong>${targetVol} L</strong> (${eqName}) • Total malt: <strong>${scaledTotalMalt} kg</strong>
          </div>
        </div>
        <button type="button" class="btn btn-primary btn-sm btn-load-preset" data-preset-id="${preset.id}">
          ⚡ Ladda & Skala (${targetVol} L)
        </button>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.btn-load-preset').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const presetId = btn.getAttribute('data-preset-id');
      loadPresetRecipe(presetId, cb);
    });
  });

  container.querySelectorAll('.preset-recipe-card').forEach((card) => {
    card.addEventListener('click', () => {
      const presetId = card.getAttribute('data-preset-id');
      loadPresetRecipe(presetId, cb);
    });
  });

  openModal('modal-preset-recipes');
}

export function scaleCurrentRecipe(targetBatchVol, targetEff, recalculateCallback) {
  const newBatchVol = parseFloat(targetBatchVol);
  const newEff = targetEff ? parseFloat(targetEff) : null;

  if (isNaN(newBatchVol) || newBatchVol <= 0) {
    showToast('⚠️ Ange en giltig batchvolym', 'error');
    return;
  }

  const updatedState = scaleRecipe(State, newBatchVol, newEff);
  Object.assign(State, updatedState);

  syncUIFromState(recalculateCallback);
  showToast(`⚖️ Receptet har skalats om till ${newBatchVol}L!`, 'success');
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

  syncEquipmentToUI();
  syncYeastToUI();
  syncWaterToUI();
  renderMashTable(recalculateCallback);
  renderFermentablesTable(recalculateCallback);
  renderHopsTable(recalculateCallback);
  renderMobileFermentablesCards(recalculateCallback);
  renderMobileHopsCards(recalculateCallback);
  setupInputSteppers(recalculateCallback);
  if (typeof recalculateCallback === 'function') {
    recalculateCallback();
  }
}

const AUTOSAVE_STORAGE_KEY = 'brygglabbet_autosave';

export function autosaveSession() {
  try {
    sessionStorage.setItem(
      AUTOSAVE_STORAGE_KEY,
      JSON.stringify({
        state: State,
        savedAt: Date.now(),
      })
    );
  } catch (err) {
    console.warn('Autosave error:', err);
  }
}

export function checkAndRestoreSession(recalculateCallback) {
  try {
    const raw = sessionStorage.getItem(AUTOSAVE_STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data && data.state && data.savedAt) {
      const ageMinutes = (Date.now() - data.savedAt) / (1000 * 60);
      if (ageMinutes < 60) {
        const recipeName = data.state.recipe?.name || 'recept';
        if (
          confirm(
            `Hittade en automatisk sparfil för "${recipeName}" (från ${Math.round(
              ageMinutes
            )} min sedan). Vill du återställa den?`
          )
        ) {
          Object.assign(State, data.state);
          let maxId = 0;
          [...(State.fermentables || []), ...(State.hops || []), ...(State.mash || [])].forEach(
            (x) => {
              if (x.id && x.id > maxId) maxId = x.id;
            }
          );
          setNextId(maxId);
          syncUIFromState(recalculateCallback);
          showToast('🔄 Autosparad session återställd', 'success');
        }
      }
    }
  } catch (err) {
    console.warn('Restore session error:', err);
  }
}

export function exportJSON() {
  const name = State.recipe.name || 'recept';
  const exportPayload = {
    _version: 1,
    exportDate: new Date().toISOString(),
    ...State,
  };
  const data = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name.replace(/[^a-z0-9åäö]/gi, '_')}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📤 Recept exporterat som JSON', 'success');
}

export function exportBeerXMLFile() {
  const name = State.recipe.name || 'recept';
  const xmlContent = exportBeerXML(State);
  const blob = new Blob([xmlContent], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name.replace(/[^a-z0-9åäö]/gi, '_')}.xml`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('🍺 Recept exporterat som BeerXML', 'success');
}

export function importJSON(e, recalculateCallback) {
  const file = e.target.files[0];
  if (!file) return;

  const isXml = file.name.endsWith('.xml') || file.name.endsWith('.beerxml');

  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      if (isXml) {
        const stateSlice = importBeerXML(evt.target.result);
        Object.assign(State, stateSlice);
        let maxId = 0;
        [...(State.fermentables || []), ...(State.hops || []), ...(State.mash || [])].forEach(
          (x) => {
            if (x.id && x.id > maxId) maxId = x.id;
          }
        );
        setNextId(maxId);
        syncUIFromState(recalculateCallback);
        showToast(`🍺 BeerXML importerat: ${State.recipe.name || 'Okänt'}`, 'success');
      } else {
        const data = JSON.parse(evt.target.result);
        if (!data || typeof data !== 'object') {
          throw new Error('Invalid format');
        }
        if (!data.recipe || !Array.isArray(data.fermentables) || !Array.isArray(data.hops)) {
          showToast('⚠️ Ogiltigt recept-format: nödvändiga fält saknas', 'error');
          return;
        }

        const { _version, exportDate, ...stateData } = data;
        Object.assign(State, stateData);

        let maxId = 0;
        [...(State.fermentables || []), ...(State.hops || []), ...(State.mash || [])].forEach(
          (x) => {
            if (x.id && x.id > maxId) maxId = x.id;
          }
        );
        setNextId(maxId);

        syncUIFromState(recalculateCallback);
        showToast(`📥 Recept importerat: ${State.recipe.name || 'Okänt'}`, 'success');
      }
    } catch (err) {
      console.error(err);
      showToast('⚠️ Ogiltig receptfil', 'error');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
}

export function loadDefaultRecipe(recalculateCallback) {
  Object.assign(State, createInitialState());
  syncUIFromState(recalculateCallback);
}
