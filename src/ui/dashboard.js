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

  if (viewName === 'batches') {
    activeView = 'batches';
    updateNavButtons('batches');
    openBatchesView(options.batchId || null);
    return;
  }

  if (viewName === 'brewday') {
    activeView = 'brewday';
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
    renderDashboard();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    // 'recipe'
    dashboardView?.classList.add('hidden');
    appBody?.classList.remove('hidden');
    if (globalRecalculate) globalRecalculate();
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

      <!-- ==================== 4 PRIMARY ACTION CARDS ==================== -->
      <section class="hub-actions-grid">

        <!-- 1. Skapa Nytt Recept -->
        <div class="hub-action-card" id="hub-card-new-recipe" role="button" tabindex="0">
          <div class="hub-action-icon-wrap" style="background:#fef3c7; color:#d97706;">➕</div>
          <div class="hub-action-body">
            <h3 class="hub-action-title">Nytt recept</h3>
            <p class="hub-action-desc">Börja från grunden med standardvolym (20 L) och tomma givor.</p>
          </div>
          <div class="hub-action-footer">
            <span class="hub-action-link">Skapa tomt recept →</span>
          </div>
        </div>

        <!-- 2. Välj bland stilmallar -->
        <div class="hub-action-card" id="hub-card-templates" role="button" tabindex="0">
          <div class="hub-action-icon-wrap" style="background:#e0f2fe; color:#0284c7;">📋</div>
          <div class="hub-action-body">
            <h3 class="hub-action-title">Färdiga stilmallar</h3>
            <p class="hub-action-desc">Pilsner, West Coast IPA, Dry Stout, Hefeweizen, Saison m.fl.</p>
          </div>
          <div class="hub-action-footer">
            <span class="hub-action-link">Välj bland mallar →</span>
          </div>
        </div>

        <!-- 3. Aktivt Recept (Resume) -->
        <div class="hub-action-card hub-action-active-recipe" id="hub-card-active-recipe" role="button" tabindex="0">
          <div class="hub-action-icon-wrap" style="background:#fef08a; color:#854d0e;">🍺</div>
          <div class="hub-action-body">
            <div class="hub-active-badge">Aktivt i redigeraren</div>
            <h3 class="hub-action-title">${escHtml(recipeName)}</h3>
            <div class="hub-recipe-specs">
              <span>${metrics.styleName || 'Valfri stil'}</span> · 
              <span>${State.recipe?.batchVolume || 20}L</span> · 
              <span>${formatSG(metrics.og)} OG</span> · 
              <span>${metrics.abv ? `${metrics.abv.toFixed(1)}%` : '—'}</span> · 
              <span>${metrics.ibu ? `${metrics.ibu.toFixed(0)} IBU` : '—'}</span>
            </div>
          </div>
          <div class="hub-action-footer">
            <span class="hub-action-link">Fortsätt redigera →</span>
          </div>
        </div>

        <!-- 4. Starta Bryggdagsläge -->
        <div class="hub-action-card" id="hub-card-start-brewday" role="button" tabindex="0">
          <div class="hub-action-icon-wrap" style="background:#dcfce7; color:#15803d;">⏱️</div>
          <div class="hub-action-body">
            <h3 class="hub-action-title">Bryggdagsläget</h3>
            <p class="hub-action-desc">Interaktiv guide med timers, humlelarm, Wake Lock och checklistor.</p>
          </div>
          <div class="hub-action-footer">
            <span class="hub-action-link">Starta bryggning →</span>
          </div>
        </div>

      </section>

      <!-- ==================== MAIN DASHBOARD TWO-COLUMN GRID ==================== -->
      <div class="hub-main-grid">

        <!-- LEFT COLUMN: AKTIVA JÄSNINGAR & SPARADE RECEPT -->
        <div class="hub-column">

          <!-- KORT: AKTIVA JÄSNINGAR & BATCHER -->
          <div class="hub-section-card">
            <div class="hub-section-header">
              <div class="hub-section-title-wrap">
                <span class="hub-section-icon">📒</span>
                <h2>Mina bryggningar & Jäsning</h2>
                <span class="badge ${activeBatches.length > 0 ? 'badge-success' : 'badge-secondary'}">
                  ${activeBatches.length} aktiva
                </span>
              </div>
              <button type="button" class="btn btn-secondary btn-sm" id="hub-btn-all-batches">
                Visa alla (${allBatches.length}) →
              </button>
            </div>

            <div class="hub-section-body">
              ${activeBatches.length === 0 ? `
                <div class="hub-empty-box">
                  <span style="font-size:2rem; margin-bottom:6px;">🍾</span>
                  <strong>Inga aktiva jäsningar just nu</strong>
                  <p class="text-muted" style="margin-top:4px; font-size:0.86rem;">
                    När du brygger ett öl kan du spara det till "Mina bryggningar" för att logga temperatur, jässchema och flaskning här.
                  </p>
                  <button type="button" class="btn btn-secondary btn-sm" id="hub-btn-goto-batches-empty" style="margin-top:10px;">
                    Öppna Mina bryggningar
                  </button>
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

          <!-- KORT: SPARADE RECEPT I ARKIVET -->
          <div class="hub-section-card">
            <div class="hub-section-header">
              <div class="hub-section-title-wrap">
                <span class="hub-section-icon">📂</span>
                <h2>Sparade recept i arkivet</h2>
                <span class="badge badge-secondary">${savedKeys.length} st</span>
              </div>
              <button type="button" class="btn btn-secondary btn-sm" id="hub-btn-manage-recipes">
                Hantera arkiv →
              </button>
            </div>

            <div class="hub-section-body">
              ${savedKeys.length === 0 ? `
                <div class="hub-empty-box">
                  <span style="font-size:1.8rem; margin-bottom:4px;">🌾</span>
                  <strong>Inga sparade recept i arkivet ännu</strong>
                  <p class="text-muted" style="font-size:0.85rem; margin-top:4px;">
                    Skapa ett recept eller välj en färdig mall och klicka på "Spara" så visas dina recept här.
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

        </div>

        <!-- RIGHT COLUMN: TILT IOT TELEMETRY & SNABBVERKTYG -->
        <div class="hub-column">

          <!-- KORT: TILT HYDROMETER IOT LIVE PANEL -->
          <div class="hub-section-card">
            <div class="hub-section-header">
              <div class="hub-section-title-wrap">
                <span class="hub-section-icon">🧲</span>
                <h2>Tilt Hydrometer (IoT Bluetooth)</h2>
              </div>
            </div>
            <div class="hub-section-body" style="padding-top:4px;">
              <p class="tool-hint" style="margin-bottom:12px; font-size:0.86rem;">
                Realtids telemetri direkt i webbläsaren. Anslut din digitala hydrometer eller testa den interaktiva simulatorn.
              </p>
              ${getTiltPanelHtml('hub')}
            </div>
          </div>

          <!-- KORT: SNABBVERKTYG & DOKUMENTATION -->
          <div class="hub-section-card">
            <div class="hub-section-header">
              <div class="hub-section-title-wrap">
                <span class="hub-section-icon">⚡</span>
                <h2>Snabbverktyg & Data</h2>
              </div>
            </div>

            <div class="hub-section-body">
              <div class="hub-tools-grid">
                <button type="button" class="hub-tool-btn" id="hub-tool-carb">
                  <span class="hub-tool-icon">🍾</span>
                  <div class="hub-tool-text">
                    <strong>Kolsyra & Flaskning</strong>
                    <span>Primingsocker & fatkolsyra</span>
                  </div>
                </button>

                <button type="button" class="hub-tool-btn" id="hub-tool-refrac">
                  <span class="hub-tool-icon">🔍</span>
                  <div class="hub-tool-text">
                    <strong>Refraktometer</strong>
                    <span>Terrills formel för jäst vört</span>
                  </div>
                </button>

                <button type="button" class="hub-tool-btn" id="hub-tool-yeast">
                  <span class="hub-tool-icon">🧫</span>
                  <div class="hub-tool-text">
                    <strong>Jäst & Förkultur</strong>
                    <span>Pitch rate och cellbehov</span>
                  </div>
                </button>

                <button type="button" class="hub-tool-btn" id="hub-tool-strike">
                  <span class="hub-tool-icon">🌡️</span>
                  <div class="hub-tool-text">
                    <strong>Inmäskning (Strike)</strong>
                    <span>Palmers temperaturformel</span>
                  </div>
                </button>

                <button type="button" class="hub-tool-btn" id="hub-tool-import">
                  <span class="hub-tool-icon">📤</span>
                  <div class="hub-tool-text">
                    <strong>Importera Recept</strong>
                    <span>BeerXML 1.0 eller JSON</span>
                  </div>
                </button>

                <button type="button" class="hub-tool-btn" id="hub-tool-backup">
                  <span class="hub-tool-icon">💾</span>
                  <div class="hub-tool-text">
                    <strong>Säkerhetskopia</strong>
                    <span>Fullständig JSON-backup</span>
                  </div>
                </button>

                <button type="button" class="hub-tool-btn" id="hub-tool-qr" style="grid-column: 1 / -1;">
                  <span class="hub-tool-icon">📱</span>
                  <div class="hub-tool-text">
                    <strong>Dela till mobilen (QR-kod)</strong>
                    <span>Serverlös överföring direkt till telefonen</span>
                  </div>
                </button>
              </div>
            </div>
          </div>

        </div>

      </div>

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

  // 2. Templates
  container.querySelector('#hub-card-templates')?.addEventListener('click', () => {
    openPresetRecipesModal((_presetId) => {
      if (globalRecalculate) globalRecalculate();
      switchDesktopView('recipe');
    });
  });

  // 3. Resume Active Recipe
  container.querySelector('#hub-card-active-recipe')?.addEventListener('click', () => {
    switchDesktopView('recipe');
  });

  // 4. Start Brew Day
  container.querySelector('#hub-card-start-brewday')?.addEventListener('click', () => {
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

  // Quick Tools
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
