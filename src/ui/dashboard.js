/**
 * Desktop Start-Hubb & Dashboard Module.
 * Welcoming cockpit view for desktop users:
 * - Direct access to create/open recipes or pick style templates.
 * - Active recipe summary with one-click return to editor.
 * - Live active fermentation monitoring and batch schedules.
 * - Real-time Tilt Hydrometer Web Bluetooth IoT panel.
 * - Quick-access brewing calculators & full workspace backup.
 * - Persistent desktop navigation bar with view switching.
 */

import { State } from '../state.js';
import { computeRecipeMetrics, formatSG } from '../core/calculations.js';
import { getBatches, BATCH_STATUS, formatDateISO, getReminders } from '../core/batches.js';
import { safeStorage, safeSessionStorage } from '../core/storage.js';
import {
  getSavedRecipes,
  newRecipe,
  openPresetRecipesModal,
  openRecipeModal,
  loadRecipe,
  loadPresetRecipe,
  exportFullWorkspaceBackup,
} from './recipes.js';
import { openBatchesView } from './batches.js';
import { toggleBrewdayView } from './brewday.js';
import { openToolsModal } from './tools.js';
import { getTiltPanelHtml, setupTiltPanel } from './tiltController.js';
import { openShareQrModal } from './shareQr.js';
import { showToast, escHtml } from './toast.js';

const STORAGE_DIRECT_RECIPE_KEY = 'brygglabbet_direct_recipe_mode';
const SESSION_ACTIVE_VIEW_KEY = 'brygglabbet_active_desktop_view';

let activeView = 'hub'; // 'hub' | 'recipe' | 'batches' | 'brewday'
let globalRecalculate = null;

/**
 * Checks whether user has configured to always skip the hub and go straight to the recipe editor.
 * @returns {boolean}
 */
export function isDirectRecipeModeEnabled() {
  return safeStorage.getItem(STORAGE_DIRECT_RECIPE_KEY) === 'true';
}

/**
 * Sets whether user wants to skip the hub and open recipe editor directly.
 * @param {boolean} enabled
 */
export function setDirectRecipeMode(enabled) {
  safeStorage.setItem(STORAGE_DIRECT_RECIPE_KEY, enabled ? 'true' : 'false');
}

/**
 * Returns currently active desktop view name.
 * @returns {string}
 */
export function getActiveDesktopView() {
  return activeView;
}

/**
 * Switches the active desktop view.
 * @param {'hub'|'recipe'|'batches'|'brewday'} viewName
 * @param {object} [options]
 * @param {string} [options.batchId]
 */
export function switchDesktopView(viewName, options = {}) {
  const desktopView = document.getElementById('desktop-app-view');
  const dashboardView = document.getElementById('dashboard-view');
  const appBody = document.getElementById('app-body');
  const batchesView = document.getElementById('batches-view');
  const brewdayView = document.getElementById('brewday-view');
  const recipeControls = document.getElementById('header-recipe-controls');
  const hubControls = document.getElementById('header-hub-controls');

  if (viewName === 'batches') {
    activeView = 'batches';
    recipeControls?.classList.add('hidden');
    hubControls?.classList.add('hidden');
    updateNavButtons('batches');
    openBatchesView(options.batchId || null);
    return;
  }

  if (viewName === 'brewday') {
    activeView = 'brewday';
    recipeControls?.classList.add('hidden');
    hubControls?.classList.add('hidden');
    updateNavButtons('brewday');
    toggleBrewdayView(globalRecalculate);
    return;
  }

  // Hide sub-fullscreens if open
  if (batchesView && !batchesView.classList.contains('hidden')) {
    batchesView.classList.add('hidden');
  }
  if (brewdayView && !brewdayView.classList.contains('hidden')) {
    brewdayView.classList.add('hidden');
  }
  if (desktopView) {
    desktopView.classList.remove('view-hidden');
  }

  activeView = viewName;
  safeSessionStorage.setItem(SESSION_ACTIVE_VIEW_KEY, viewName);
  updateNavButtons(viewName);

  if (viewName === 'hub') {
    dashboardView?.classList.remove('hidden');
    appBody?.classList.add('hidden');
    recipeControls?.classList.add('hidden');
    hubControls?.classList.remove('hidden');
    renderDashboard();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (viewName === 'recipe') {
    dashboardView?.classList.add('hidden');
    appBody?.classList.remove('hidden');
    recipeControls?.classList.remove('hidden');
    hubControls?.classList.add('hidden');
    if (globalRecalculate) globalRecalculate();
  } else {
    // batches or brewday
    recipeControls?.classList.add('hidden');
    hubControls?.classList.add('hidden');
  }
}

/**
 * Updates highlighted state of the desktop nav buttons.
 * @param {string} currentView
 */
function updateNavButtons(currentView) {
  document.querySelectorAll('.desktop-nav-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.navView === currentView);
  });
}

/**
 * Initializes desktop navigation bar and Start-Hubb view.
 * @param {Function} recalculateCallback
 */
export function setupDashboard(recalculateCallback) {
  globalRecalculate = recalculateCallback;

  // Bind Desktop Nav bar buttons in header
  document.querySelectorAll('.desktop-nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.navView;
      if (target) {
        switchDesktopView(target);
      }
    });
  });

  // Clicking logo goes to Hub
  document.getElementById('header-logo')?.addEventListener('click', (e) => {
    e.preventDefault();
    switchDesktopView('hub');
  });

  // Hub Header actions
  document.getElementById('btn-hub-header-tools')?.addEventListener('click', () => {
    openToolsModal();
  });
  document.getElementById('btn-switch-to-mobile-header')?.addEventListener('click', () => {
    document.getElementById('btn-switch-to-mobile')?.click();
  });
  document.getElementById('btn-batches')?.addEventListener('click', () => {
    switchDesktopView('batches');
  });

  // Determine initial desktop view
  const lastSessionView = safeSessionStorage.getItem(SESSION_ACTIVE_VIEW_KEY);
  const isDirectRecipe = isDirectRecipeModeEnabled();

  const isMobile = typeof window !== 'undefined' && (window.innerWidth <= 768 || document.body.classList.contains('mobile-mode'));

  if (!isMobile) {
    if (lastSessionView === 'recipe' || isDirectRecipe) {
      switchDesktopView('recipe');
    } else {
      switchDesktopView('hub');
    }
  }
}

/**
 * Renders the full Start-Hubb dashboard content.
 */
export function renderDashboard() {
  const container = document.getElementById('dashboard-view');
  if (!container) return;

  const metrics = computeRecipeMetrics(State);
  const recipeName = State.recipe?.name || 'Mitt nya öl';
  const savedRecipes = getSavedRecipes();
  const savedKeys = Object.keys(savedRecipes);

  const allBatches = getBatches();
  const activeBatches = allBatches.filter(
    (b) => b.status === BATCH_STATUS.FERMENTING || b.status === BATCH_STATUS.CONDITIONING
  );
  const todayStr = formatDateISO();

  const isDirectMode = isDirectRecipeModeEnabled();

  container.innerHTML = `
    <div class="hub-container">

      <!-- ==================== HERO SECTION ==================== -->
      <section class="hub-hero">
        <div class="hub-hero-main">
          <div class="hub-hero-badge">🍺 Välkommen till Brygglabbet</div>
          <h1 class="hub-hero-title">Vad vill du brygga eller göra idag?</h1>
          <p class="hub-hero-subtitle">
            Ditt kompletta verktyg för receptskapande, vattenkemi, jäsning och IoT-telemetri med Tilt Hydrometer.
          </p>
        </div>
        <div class="hub-hero-meta">
          <div class="hub-meta-pill">
            <span class="hub-meta-num">${savedKeys.length}</span>
            <span class="hub-meta-lbl">Sparade recept</span>
          </div>
          <div class="hub-meta-pill">
            <span class="hub-meta-num">${allBatches.length}</span>
            <span class="hub-meta-lbl">Bryggda batcher</span>
          </div>
          ${activeBatches.length > 0 ? `
            <div class="hub-meta-pill highlight">
              <span class="hub-meta-num">${activeBatches.length}</span>
              <span class="hub-meta-lbl">Aktiva jäsningar</span>
            </div>
          ` : ''}
        </div>
      </section>

      <!-- ==================== ZON 1: RECEPTVERKSTAD & SNABBSTART ==================== -->
      <section class="hub-zone-section">
        <div class="hub-zone-header">
          <span class="hub-zone-tag">Zon 1</span>
          <h2 class="hub-zone-title">Receptverkstad &amp; Snabbstart</h2>
        </div>
        <div class="hub-zone-grid-spotlight">
          <!-- Spotlight: Aktivt Recept -->
          <div class="hub-spotlight-card" id="hub-card-active-recipe" role="button" tabindex="0">
            <div class="hub-spotlight-badge">🍺 Pågående i redigeraren</div>
            <div class="hub-spotlight-header">
              <h3 class="hub-spotlight-title">${escHtml(recipeName)}</h3>
              <span class="hub-spotlight-style">${escHtml(metrics.styleName || 'Valfri ölstil')}</span>
            </div>
            <div class="hub-spotlight-metrics">
              <div class="hub-metric-tile">
                <span class="lbl">Volym</span>
                <span class="val">${State.recipe?.batchVolume || 20} L</span>
              </div>
              <div class="hub-metric-tile">
                <span class="lbl">OG</span>
                <span class="val">${formatSG(metrics.og)}</span>
              </div>
              <div class="hub-metric-tile">
                <span class="lbl">Est. ABV</span>
                <span class="val highlight">${metrics.abv ? `${metrics.abv.toFixed(1)}%` : '—'}</span>
              </div>
              <div class="hub-metric-tile">
                <span class="lbl">Beska</span>
                <span class="val">${metrics.ibu ? `${metrics.ibu.toFixed(0)} IBU` : '—'}</span>
              </div>
              <div class="hub-metric-tile">
                <span class="lbl">Färg</span>
                <span class="val">${metrics.ebc ? `${metrics.ebc.toFixed(0)} EBC` : '—'}</span>
              </div>
            </div>
            <div class="hub-spotlight-actions">
              <button type="button" class="btn btn-primary" id="hub-btn-resume-recipe">
                Fortsätt redigera →
              </button>
              <button type="button" class="btn btn-secondary" id="hub-card-start-brewday">
                ⏱️ Starta bryggdag
              </button>
            </div>
          </div>

          <!-- Snabbstart & Mallar -->
          <div class="hub-quickstart-panel">
            <div class="hub-quick-action-item" id="hub-card-new-recipe" role="button" tabindex="0">
              <div class="hub-quick-icon" style="background:#fef3c7; color:#d97706;">➕</div>
              <div class="hub-quick-content">
                <strong>Skapa tomt recept</strong>
                <span>Börja från grunden med standardvolym (20 L)</span>
              </div>
              <span class="hub-quick-arrow">→</span>
            </div>

            <div class="hub-quick-action-item" id="hub-card-templates" role="button" tabindex="0">
              <div class="hub-quick-icon" style="background:#e0f2fe; color:#0284c7;">📋</div>
              <div class="hub-quick-content">
                <strong>Välj stilmall</strong>
                <span>Klassiska receptmallar med beprövade proportioner</span>
                <div class="hub-template-quicktags">
                  <span class="hub-tag" data-preset="west_coast_ipa">West Coast IPA</span>
                  <span class="hub-tag" data-preset="hazy_neipa">NEIPA</span>
                  <span class="hub-tag" data-preset="klassisk_pilsner">Pilsner</span>
                  <span class="hub-tag" data-preset="choklad_porter">Porter</span>
                  <span class="hub-tag" data-preset="hefeweizen">Veteöl</span>
                </div>
              </div>
              <span class="hub-quick-arrow">→</span>
            </div>

            <div class="hub-quick-action-item" id="hub-card-import-quick" role="button" tabindex="0">
              <div class="hub-quick-icon" style="background:#ede9fe; color:#7c3aed;">📥</div>
              <div class="hub-quick-content">
                <strong>Importera receptfil</strong>
                <span>Öppna BeerXML 1.0 eller Brygglabbet JSON</span>
              </div>
              <span class="hub-quick-arrow">→</span>
            </div>
          </div>
        </div>
      </section>

      <!-- ==================== ZON 2: I BRYGGERIET JUST NU ==================== -->
      <section class="hub-zone-section">
        <div class="hub-zone-header">
          <span class="hub-zone-tag">Zon 2</span>
          <h2 class="hub-zone-title">I bryggeriet just nu (Jäsning &amp; Telemetri)</h2>
        </div>
        <div class="hub-zone-grid-two">
          <!-- Kort A: Aktiva Jäsningar & Schema -->
          <div class="hub-card">
            <div class="hub-card-header">
              <div class="hub-card-title-wrap">
                <span class="hub-card-icon">⏳</span>
                <h3>Aktiva jäsningar &amp; schema</h3>
                <span class="badge ${activeBatches.length > 0 ? 'badge-success' : 'badge-secondary'}">
                  ${activeBatches.length} aktiva
                </span>
              </div>
              <button type="button" class="btn btn-secondary btn-sm" id="hub-btn-all-batches">
                Mina bryggningar (${allBatches.length}) →
              </button>
            </div>
            <div class="hub-card-body">
              ${activeBatches.length === 0 ? `
                <div class="hub-empty-state">
                  <span style="font-size:2rem; margin-bottom:6px;">🍾</span>
                  <strong>Inga aktiva jäsningar just nu</strong>
                  <p class="text-muted" style="font-size:0.85rem; margin-top:4px;">
                    Starta en bryggning och spara till "Mina bryggningar" för att logga temperatur, jässchema och flaskning här.
                  </p>
                </div>
              ` : `
                <div class="hub-batch-list">
                  ${activeBatches.map((b) => {
                    const daysAgo = Math.floor((new Date(todayStr) - new Date(b.brewDate)) / (1000 * 60 * 60 * 24));
                    const daysText = daysAgo === 0 ? 'Bryggd idag' : `${daysAgo} dagar i jäskärl`;
                    const rems = getReminders(b, todayStr).filter((r) => r.isToday);
                    const lastReading = b.readings && b.readings.length > 0 ? b.readings[b.readings.length - 1] : null;

                    return `
                      <div class="hub-batch-item" data-batch-id="${b.id}" role="button" tabindex="0">
                        <div class="hub-batch-main">
                          <div class="hub-batch-title-row">
                            <strong>${escHtml(b.recipeName)}</strong>
                            <span class="badge ${b.status === BATCH_STATUS.FERMENTING ? 'badge-info' : 'badge-warning'}">
                              ${b.status === BATCH_STATUS.FERMENTING ? '⏳ Jäser' : '🍾 Konditioneras'}
                            </span>
                          </div>
                          <div class="hub-batch-meta">
                            <span>📅 ${escHtml(b.brewDate)} (${daysText})</span>
                            ${lastReading ? `· <span>Senaste SG: <strong>${formatSG(lastReading.sg || 1.0)}</strong></span>` : ''}
                          </div>
                          ${rems.length > 0 ? `
                            <div class="hub-batch-reminder">
                              🔔 <strong>Idag:</strong> ${escHtml(rems[0].text)}
                            </div>
                          ` : ''}
                        </div>
                        <button type="button" class="btn btn-ghost btn-sm" data-open-batch="${b.id}">
                          Öppna →
                        </button>
                      </div>
                    `;
                  }).join('')}
                </div>
              `}
            </div>
          </div>

          <!-- Kort B: Tilt Hydrometer IoT Bluetooth -->
          <div class="hub-card">
            <div class="hub-card-header">
              <div class="hub-card-title-wrap">
                <span class="hub-card-icon">📡</span>
                <h3>Tilt Hydrometer (IoT Telemetri)</h3>
              </div>
            </div>
            <div class="hub-card-body">
              <p class="tool-hint" style="margin-bottom:12px; font-size:0.86rem;">
                Trådlös realtidsövervakning av densitet och temperatur via Web Bluetooth direkt i webbläsaren.
              </p>
              ${getTiltPanelHtml('hub')}
            </div>
          </div>
        </div>
      </section>

      <!-- ==================== ZON 3: ARKIV & BRYGGARVERKTYG ==================== -->
      <section class="hub-zone-section">
        <div class="hub-zone-header">
          <span class="hub-zone-tag">Zon 3</span>
          <h2 class="hub-zone-title">Receptarkiv &amp; Bryggarverktyg</h2>
        </div>
        <div class="hub-zone-grid-two">
          <!-- Kort A: Sparade Recept (Arkiv) -->
          <div class="hub-card">
            <div class="hub-card-header">
              <div class="hub-card-title-wrap">
                <span class="hub-card-icon">📂</span>
                <h3>Sparade recept i arkivet</h3>
                <span class="badge badge-secondary">${savedKeys.length} st</span>
              </div>
              <button type="button" class="btn btn-secondary btn-sm" id="hub-btn-manage-recipes">
                Hantera arkiv →
              </button>
            </div>
            <div class="hub-card-body">
              ${savedKeys.length === 0 ? `
                <div class="hub-empty-state">
                  <span style="font-size:1.8rem; margin-bottom:4px;">🌾</span>
                  <strong>Inga sparade recept i arkivet ännu</strong>
                  <p class="text-muted" style="font-size:0.85rem; margin-top:4px;">
                    Skapa ett recept eller välj en färdig mall och klicka på "Spara" för att bygga upp ditt receptarkiv.
                  </p>
                </div>
              ` : `
                <div class="hub-recipes-grid">
                  ${savedKeys.slice(0, 6).map((name) => {
                    const r = savedRecipes[name];
                    const vol = r.recipe?.batchVolume || 20;
                    return `
                      <div class="hub-recipe-chip" data-recipe-name="${escHtml(name)}" role="button" tabindex="0">
                        <div class="hub-recipe-chip-body">
                          <strong>${escHtml(name)}</strong>
                          <span class="hub-recipe-chip-meta">${r.recipe?.styleId || 'Stil saknas'} · ${vol} L</span>
                        </div>
                        <span class="hub-recipe-chip-arrow">→</span>
                      </div>
                    `;
                  }).join('')}
                </div>
              `}
            </div>
          </div>

          <!-- Kort B: Bryggarverktyg uppdelade i kategorier -->
          <div class="hub-card">
            <div class="hub-card-header">
              <div class="hub-card-title-wrap">
                <span class="hub-card-icon">🧰</span>
                <h3>Bryggarverktyg &amp; Data</h3>
              </div>
              <button type="button" class="btn btn-secondary btn-sm" id="hub-btn-all-tools">
                Alla verktyg →
              </button>
            </div>
            <div class="hub-card-body">
              <span class="section-label" style="margin-bottom:6px;">Mätning &amp; Beräkningar</span>
              <div class="hub-tools-grouped-grid" style="margin-bottom:14px;">
                <button type="button" class="hub-tool-compact-btn" id="hub-tool-carb">
                  <span class="hub-tool-icon">🍾</span>
                  <div>
                    <strong>Kolsyra &amp; Flaskning</strong>
                    <span>Sockermängd &amp; fatkolsyra</span>
                  </div>
                </button>
                <button type="button" class="hub-tool-compact-btn" id="hub-tool-refrac">
                  <span class="hub-tool-icon">🔍</span>
                  <div>
                    <strong>Refraktometer</strong>
                    <span>Terrills formel för jäst vört</span>
                  </div>
                </button>
                <button type="button" class="hub-tool-compact-btn" id="hub-tool-yeast">
                  <span class="hub-tool-icon">🧫</span>
                  <div>
                    <strong>Jäst &amp; Förkultur</strong>
                    <span>Cellberäkning &amp; pitch rate</span>
                  </div>
                </button>
                <button type="button" class="hub-tool-compact-btn" id="hub-tool-strike">
                  <span class="hub-tool-icon">🌡️</span>
                  <div>
                    <strong>Inmäskning (Strike)</strong>
                    <span>Palmers temperaturformel</span>
                  </div>
                </button>
              </div>

              <span class="section-label" style="margin-bottom:6px;">Data &amp; Mobil</span>
              <div class="hub-tools-grouped-grid">
                <button type="button" class="hub-tool-compact-btn" id="hub-tool-qr">
                  <span class="hub-tool-icon">📱</span>
                  <div>
                    <strong>Dela till mobilen</strong>
                    <span>Serverlös QR-överföring</span>
                  </div>
                </button>
                <button type="button" class="hub-tool-compact-btn" id="hub-tool-backup">
                  <span class="hub-tool-icon">💾</span>
                  <div>
                    <strong>Säkerhetskopia</strong>
                    <span>Fullständig JSON-export</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ==================== FOOTER PREFERENCES ==================== -->
      <footer class="hub-footer">
        <label class="hub-pref-check">
          <input type="checkbox" id="hub-pref-direct-recipe" ${isDirectMode ? 'checked' : ''}>
          <span>Starta alltid direkt i receptredigeraren framöver (hoppa över denna översikt)</span>
        </label>
      </footer>

    </div>
  `;

  // Attach Event Handlers
  setupDashboardEvents(container);
}

/**
 * Attaches interactive listeners to dashboard buttons and cards.
 * @param {HTMLElement} container
 */
function setupDashboardEvents(container) {
  // 1. New Recipe
  container.querySelector('#hub-card-new-recipe')?.addEventListener('click', () => {
    newRecipe(globalRecalculate);
    switchDesktopView('recipe');
  });

  // 2. Templates Modal
  container.querySelector('#hub-card-templates')?.addEventListener('click', () => {
    openPresetRecipesModal((_presetId) => {
      if (globalRecalculate) globalRecalculate();
      switchDesktopView('recipe');
    });
  });

  // 2b. Quick Preset Tags (direct load)
  container.querySelectorAll('.hub-tag[data-preset]').forEach((tag) => {
    tag.addEventListener('click', (e) => {
      e.stopPropagation();
      const presetId = tag.dataset.preset;
      if (presetId) {
        loadPresetRecipe(presetId, globalRecalculate);
        switchDesktopView('recipe');
      }
    });
  });

  // 2c. Quick Import Recipe
  container.querySelector('#hub-card-import-quick')?.addEventListener('click', () => {
    document.getElementById('import-file-input')?.click();
  });

  // 3. Resume Active Recipe
  container.querySelector('#hub-card-active-recipe')?.addEventListener('click', () => {
    switchDesktopView('recipe');
  });
  container.querySelector('#hub-btn-resume-recipe')?.addEventListener('click', (e) => {
    e.stopPropagation();
    switchDesktopView('recipe');
  });

  // 4. Start Brew Day
  container.querySelector('#hub-card-start-brewday')?.addEventListener('click', (e) => {
    e.stopPropagation();
    switchDesktopView('brewday');
  });

  // All Batches button
  container.querySelector('#hub-btn-all-batches')?.addEventListener('click', () => {
    switchDesktopView('batches');
  });
  container.querySelector('#hub-btn-goto-batches-empty')?.addEventListener('click', () => {
    switchDesktopView('batches');
  });

  // Click on active batch card
  container.querySelectorAll('.hub-batch-item').forEach((item) => {
    item.addEventListener('click', () => {
      const batchId = item.dataset.batchId;
      switchDesktopView('batches', { batchId });
    });
  });
  container.querySelectorAll('[data-open-batch]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const batchId = btn.dataset.openBatch;
      if (batchId) {
        switchDesktopView('batches', { batchId });
      }
    });
  });

  // Manage Saved Recipes
  container.querySelector('#hub-btn-manage-recipes')?.addEventListener('click', () => {
    openRecipeModal(globalRecalculate);
  });

  // Click on saved recipe chip
  container.querySelectorAll('.hub-recipe-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const name = chip.dataset.recipeName;
      if (name) {
        loadRecipe(name, globalRecalculate);
        switchDesktopView('recipe');
      }
    });
  });

  // Quick Tools & All Tools
  container.querySelector('#hub-btn-all-tools')?.addEventListener('click', () => {
    openToolsModal();
  });
  container.querySelector('#hub-tool-carb')?.addEventListener('click', () => openToolsModal('carb'));
  container.querySelector('#hub-tool-refrac')?.addEventListener('click', () => openToolsModal('refrac'));
  container.querySelector('#hub-tool-yeast')?.addEventListener('click', () => openToolsModal('yeast'));
  container.querySelector('#hub-tool-strike')?.addEventListener('click', () => openToolsModal('strike'));
  container.querySelector('#hub-tool-import')?.addEventListener('click', () => {
    document.getElementById('import-file-input')?.click();
  });
  container.querySelector('#hub-tool-backup')?.addEventListener('click', exportFullWorkspaceBackup);
  container.querySelector('#hub-tool-qr')?.addEventListener('click', openShareQrModal);

  // Tilt Panel setup on Hub
  const tiltPanel = container.querySelector('#hub-tilt-panel');
  if (tiltPanel) {
    setupTiltPanel(tiltPanel, {
      idPrefix: 'hub',
      defaultSG: 1.050,
      defaultTempC: 20.0,
      onLogReading: ({ sg, tempC }) => {
        showToast(`Mätning avläst: ${formatSG(sg)} SG (${tempC}°C). För att spara historik, öppna "Mina bryggningar".`, 'info');
      },
    });
  }

  // Direct Recipe Mode Preference Checkbox
  container.querySelector('#hub-pref-direct-recipe')?.addEventListener('change', (e) => {
    setDirectRecipeMode(e.target.checked);
    showToast(
      e.target.checked
        ? '⚙️ Sparat! Nästa gång öppnas receptredigeraren direkt.'
        : '⚙️ Sparat! Du möts nu av Start-Hubben vid start.',
      'info'
    );
  });
}
