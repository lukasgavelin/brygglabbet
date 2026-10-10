/**
 * Recipe persistence (localStorage, JSON import/export, default recipe).
 */

import { State, createInitialState, setNextId, generateId, pushHistory, applyState } from '../state.js';
import { calculateOG, formatSG, scaleRecipe } from '../core/calculations.js';
import { PRESET_RECIPES } from '../core/data.js';
import { openModal, closeModal } from './modals.js';
import { showToast, escHtml } from './toast.js';
import { recalculate } from './sidebar.js';
import { updateAccordionBadges } from './tabs.js';
import { renderFermentablesTable } from './fermentables.js';
import { renderHopsTable } from './hops.js';
import { renderMashTable } from './mash.js';
import { syncYeastToUI } from './yeast.js';
import { syncWaterToUI } from './water.js';
import { syncEquipmentToUI } from './equipment.js';
import { renderMobileFermentablesCards, renderMobileHopsCards } from './mobile/mobileCards.js';
import { setupInputSteppers } from './stepper.js';
import { exportBeerXML, importBeerXML } from '../core/beerxml.js';
import { getBatches, getBatchesForRecipe, importBatches } from '../core/batches.js';
import { updateRecipeBrewCountBadge } from './batches.js';
import { safeStorage, safeSessionStorage } from '../core/storage.js';

const LOCAL_STORAGE_KEY = 'brygglabbet_recipes';
const FALLBACK_STORAGE_KEY = 'brew_recipes';

export function getSavedRecipes() {
  const primary = safeStorage.getJSON(LOCAL_STORAGE_KEY, null);
  if (primary && typeof primary === 'object') return primary;
  const fallback = safeStorage.getJSON(FALLBACK_STORAGE_KEY, null);
  if (fallback && typeof fallback === 'object') return fallback;
  return {};
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
  const success = safeStorage.setJSON(LOCAL_STORAGE_KEY, all);
  if (success) {
    showToast(`💾 Recept sparat: ${name}`, 'success');
  }
}

export function newRecipe(recalculateCallback) {
  if (!confirm('Skapa ett nytt recept? Osparade ändringar försvinner.')) return;
  applyState(State, createInitialState());
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

      const brewCount = getBatchesForRecipe(name).length;
      const brewBadgeHtml = brewCount > 0
        ? `<span class="badge-tag" style="margin-left:6px; background:var(--accent-muted); color:var(--accent); font-weight:600; font-size:0.75rem;">Bryggd ${brewCount} ${brewCount === 1 ? 'gång' : 'gånger'}</span>`
        : '';

      const div = document.createElement('div');
      div.className = 'recipe-list-item';
      div.innerHTML = `
        <div style="flex:1; cursor:pointer">
          <div class="recipe-name">${escHtml(name)}${brewBadgeHtml}</div>
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
          safeStorage.setJSON(LOCAL_STORAGE_KEY, all);
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

  const scaledRecipe = {
    ...preset.recipe,
    batchVolume: targetVol,
    boilVolume: Math.round((preset.recipe.boilVolume || 25) * factor),
  };

  const scaledFermentables = (preset.fermentables || []).map((f) => ({
    ...f,
    id: generateId(),
    amount: Math.round(f.amount * factor * 100) / 100,
  }));

  const scaledHops = (preset.hops || []).map((h) => ({
    ...h,
    id: generateId(),
    amount: Math.round(h.amount * factor),
  }));

  const scaledYeast = preset.yeast ? JSON.parse(JSON.stringify(preset.yeast)) : { name: '' };
  const scaledMash = (preset.mash || []).map((m) => ({ ...m, id: generateId() }));

  const scaledWater = preset.water
    ? {
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
      }
    : State.water;

  applyState(State, {
    recipe: scaledRecipe,
    fermentables: scaledFermentables,
    hops: scaledHops,
    yeast: scaledYeast,
    mash: scaledMash,
    water: scaledWater,
  });

  let maxId = 0;
  [...State.fermentables, ...State.hops, ...State.mash].forEach((x) => {
    if (x.id && x.id > maxId) maxId = x.id;
  });
  setNextId(maxId);

  // Force close modal
  closeModal('modal-preset-recipes');
  const modalEl = document.getElementById('modal-preset-recipes');
  if (modalEl) {
    modalEl.classList.add('hidden');
    modalEl.style.display = 'none';
  }

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

  container.querySelectorAll('.preset-recipe-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const presetId = card.getAttribute('data-preset-id');
      if (presetId) {
        loadPresetRecipe(presetId, cb);
      }
    });
  });

  const modalEl = document.getElementById('modal-preset-recipes');
  if (modalEl) {
    modalEl.style.display = '';
    modalEl.classList.remove('hidden');
  }
}

export function scaleCurrentRecipe(targetBatchVol, targetEff, recalculateCallback) {
  const newBatchVol = parseFloat(targetBatchVol);
  const newEff = targetEff ? parseFloat(targetEff) : null;

  if (isNaN(newBatchVol) || newBatchVol <= 0) {
    showToast('⚠️ Ange en giltig batchvolym', 'error');
    return;
  }

  const updatedState = scaleRecipe(State, newBatchVol, newEff);
  applyState(State, updatedState);

  syncUIFromState(recalculateCallback);
  showToast(`⚖️ Receptet har skalats om till ${newBatchVol}L!`, 'success');
}

export function loadRecipe(name, recalculateCallback) {
  const all = getSavedRecipes();
  const saved = all[name];
  if (!saved) return;

  applyState(State, saved);

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
  updateAccordionBadges();
  updateRecipeBrewCountBadge();
  if (typeof recalculateCallback === 'function') {
    recalculateCallback();
  }
}

const AUTOSAVE_STORAGE_KEY = 'brygglabbet_autosave';

function isStateDefault(state) {
  const defaults = createInitialState();
  return state.recipe?.name === defaults.recipe.name &&
         state.recipe?.batchVolume === defaults.recipe.batchVolume &&
         (state.fermentables || []).length === 0 &&
         (state.hops || []).length === 0 &&
         (state.mash || []).length === 0;
}

export function autosaveSession() {
  try {
    if (isStateDefault(State)) {
      safeSessionStorage.removeItem(AUTOSAVE_STORAGE_KEY);
      return;
    }
    safeSessionStorage.setJSON(AUTOSAVE_STORAGE_KEY, {
      state: State,
      savedAt: Date.now(),
    });
  } catch (err) {
    console.warn('Autosave error:', err);
  }
}

export function checkAndRestoreSession(recalculateCallback) {
  try {
    const data = safeSessionStorage.getJSON(AUTOSAVE_STORAGE_KEY, null);
    if (!data) return false;
    if (data && data.state && data.savedAt) {
      if (isStateDefault(data.state)) {
        safeSessionStorage.removeItem(AUTOSAVE_STORAGE_KEY);
        return false;
      }
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
          applyState(State, data.state);
          let maxId = 0;
          [...(State.fermentables || []), ...(State.hops || []), ...(State.mash || [])].forEach(
            (x) => {
              if (x.id && x.id > maxId) maxId = x.id;
            }
          );
          setNextId(maxId);
          syncUIFromState(recalculateCallback);
          showToast('🔄 Autosparad session återställd', 'success');
          return true;
        }
      }
    }
    safeSessionStorage.removeItem(AUTOSAVE_STORAGE_KEY);
    return false;
  } catch (err) {
    console.warn('Restore session error:', err);
    safeSessionStorage.removeItem(AUTOSAVE_STORAGE_KEY);
    return false;
  }
}

export function exportJSON() {
  const name = State.recipe.name || 'recept';
  const exportPayload = {
    _version: 1,
    exportDate: new Date().toISOString(),
    ...State,
    batches: getBatches(),
  };
  const data = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name.replace(/[^a-z0-9åäö]/gi, '_')}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📤 Recept och batcher exporterade som JSON', 'success');
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
        applyState(State, stateSlice);
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

        if (Array.isArray(data.batches) && data.batches.length > 0) {
          importBatches(data.batches);
          delete data.batches;
        }

        delete data._version;
        delete data.exportDate;
        applyState(State, data);

        let maxId = 0;
        [...(State.fermentables || []), ...(State.hops || []), ...(State.mash || [])].forEach(
          (x) => {
            if (x.id && x.id > maxId) maxId = x.id;
          }
        );
        setNextId(maxId);

        syncUIFromState(recalculateCallback);
        showToast(`📥 Recept och eventuella batcher importerade: ${State.recipe.name || 'Okänt'}`, 'success');
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
  applyState(State, createInitialState());
  syncUIFromState(recalculateCallback);
}
