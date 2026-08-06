/**
 * Main Application Entry Point.
 * Clean Code: High-level orchestrator initializing components.
 */

import { State } from './state.js';
import { STYLES } from './core/data.js';
import { setupTabNavigation } from './ui/tabs.js';
import { setupYeastTab, populateYeastSelector } from './ui/yeast.js';
import { setupMashTab } from './ui/mash.js';
import { setupWaterTab, populateWaterProfileSelector } from './ui/water.js';
import {
  openFermentableModal,
  openHopModal,
  setupModalClose,
  filterModalList,
} from './ui/modals.js';
import {
  saveRecipe,
  newRecipe,
  openRecipeModal,
  exportJSON,
  importJSON,
  loadDefaultRecipe,
} from './ui/recipes.js';
import { recalculate } from './ui/sidebar.js';

document.addEventListener('DOMContentLoaded', () => {
  populateStyleSelector();
  populateWaterProfileSelector();
  populateYeastSelector();

  setupTabNavigation();
  setupHeaderControls();
  setupRecipeInputs();

  setupFermentableEvents();
  setupHopEvents();
  setupYeastTab(recalculate);
  setupMashTab(recalculate);
  setupWaterTab(recalculate);
  setupSidebarActions();
  setupModalClose();

  loadDefaultRecipe(recalculate);
  recalculate();
});

function populateStyleSelector() {
  const sel = document.getElementById('recipe-style');
  if (!sel) return;

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

function setupHeaderControls() {
  document.getElementById('recipe-name-input')?.addEventListener('input', (e) => {
    State.recipe.name = e.target.value;
  });
  document.getElementById('btn-new')?.addEventListener('click', () => newRecipe(recalculate));
  document
    .getElementById('btn-open')
    ?.addEventListener('click', () => openRecipeModal(recalculate));
  document.getElementById('btn-save')?.addEventListener('click', saveRecipe);
}

function setupRecipeInputs() {
  const ids = ['batch-volume', 'boil-volume', 'boil-time', 'efficiency', 'att-min', 'att-max'];
  ids.forEach((id) => {
    document.getElementById(id)?.addEventListener('input', () => {
      syncRecipeFromUI();
      recalculate();
    });
  });

  document.getElementById('recipe-notes')?.addEventListener('input', (e) => {
    State.recipe.notes = e.target.value;
  });
  document.getElementById('recipe-style')?.addEventListener('change', (e) => {
    State.recipe.styleId = e.target.value;
    recalculate();
  });
}

function syncRecipeFromUI() {
  State.recipe.batchVolume = parseFloat(document.getElementById('batch-volume')?.value) || 20;
  State.recipe.boilVolume = parseFloat(document.getElementById('boil-volume')?.value) || 25;
  State.recipe.boilTime = parseFloat(document.getElementById('boil-time')?.value) || 60;
  State.recipe.efficiency = parseFloat(document.getElementById('efficiency')?.value) || 75;
  State.yeast.attMin = parseFloat(document.getElementById('att-min')?.value) || 72;
  State.yeast.attMax = parseFloat(document.getElementById('att-max')?.value) || 78;
}

function setupFermentableEvents() {
  document.getElementById('btn-add-fermentable')?.addEventListener('click', () => {
    openFermentableModal(recalculate);
  });
  document.getElementById('fermentable-search')?.addEventListener('input', (e) => {
    filterModalList('fermentable-list', e.target.value);
  });
}

function setupHopEvents() {
  document.getElementById('btn-add-hop')?.addEventListener('click', () => {
    openHopModal(recalculate);
  });
  document.getElementById('hop-search')?.addEventListener('input', (e) => {
    filterModalList('hop-list', e.target.value);
  });
}

function setupSidebarActions() {
  document.getElementById('sb-btn-save')?.addEventListener('click', saveRecipe);
  document.getElementById('sb-btn-export')?.addEventListener('click', exportJSON);
  document.getElementById('sb-btn-import')?.addEventListener('click', () => {
    document.getElementById('import-file-input')?.click();
  });
  document.getElementById('import-file-input')?.addEventListener('change', (e) => {
    importJSON(e, recalculate);
  });
}
