/**
 * Recipe persistence (localStorage, JSON import/export, default recipe).
 */

import { State, createInitialState, setNextId, generateId } from '../state.js';
import { calculateOG, formatSG, scaleRecipe } from '../core/calculations.js';
import { PRESET_RECIPES } from '../core/data.js';
import { openModal, closeModal } from './modals.js';
import { showToast, escHtml } from './toast.js';
import { syncYeastToUI } from './yeast.js';
import { syncWaterToUI } from './water.js';
import { renderMashTable } from './mash.js';
import { syncEquipmentToUI } from './equipment.js';
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

export function openPresetRecipesModal(recalculateCallback) {
  const list = document.getElementById('preset-recipes-list');
  if (!list) return;

  list.innerHTML = '';
  PRESET_RECIPES.forEach((preset) => {
    const div = document.createElement('div');
    div.className = 'preset-recipe-card';
    div.innerHTML = `
      <div class="preset-recipe-info">
        <div class="preset-recipe-title">${escHtml(preset.name)} <span class="badge">${escHtml(preset.styleId)}</span></div>
        <div class="preset-recipe-desc">${escHtml(preset.description)}</div>
        <div class="preset-recipe-meta">${preset.recipe.batchVolume}L · ${preset.fermentables.length} maltsorter · ${preset.hops.length} humlegivor</div>
      </div>
      <button class="btn btn-primary btn-sm" data-use-preset="${preset.id}">Använd som mall</button>
    `;

    div.querySelector('[data-use-preset]')?.addEventListener('click', () => {
      loadPresetRecipe(preset.id, recalculateCallback);
      closeModal('modal-preset-recipes');
    });

    list.appendChild(div);
  });

  openModal('modal-preset-recipes');
}

export function loadPresetRecipe(presetId, recalculateCallback) {
  const preset = PRESET_RECIPES.find((p) => p.id === presetId);
  if (!preset) return;

  // Clone recipe state
  const newState = createInitialState();
  newState.recipe = JSON.parse(JSON.stringify(preset.recipe));

  // Maintain existing equipment settings if set, or sync batch size
  if (State.equipment) {
    newState.equipment = {
      ...State.equipment,
      batchVolume: preset.recipe.batchVolume,
      efficiency: preset.recipe.efficiency,
    };
  }

  newState.fermentables = preset.fermentables.map((f) => ({ ...f, id: generateId() }));
  newState.hops = preset.hops.map((h) => ({ ...h, id: generateId() }));
  newState.yeast = JSON.parse(JSON.stringify(preset.yeast));
  newState.mash = preset.mash.map((m) => ({ ...m, id: generateId() }));
  newState.water = JSON.parse(JSON.stringify(preset.water));

  Object.assign(State, newState);

  let maxId = 0;
  [...State.fermentables, ...State.hops, ...State.mash].forEach((x) => {
    if (x.id && x.id > maxId) maxId = x.id;
  });
  setNextId(maxId);

  syncUIFromState(recalculateCallback);
  showToast(`✨ Receptmall laddad: ${preset.name}`, 'success');
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
  recalculateCallback();
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
