/**
 * Batches UI module: "Mina bryggningar" (Batches & Fermentation Tracking).
 * Full-featured view for managing brew sessions, tracking gravity readings,
 * viewing fermentation schedules, generating .ics reminders, and recording bottling & tasting.
 */

import { State } from '../state.js';
import {
  getBatches,
  getBatchById,
  createBatch,
  saveBatch,
  deleteBatch,
  getBatchesForRecipe,
  addReadingToBatch,
  deleteReadingFromBatch,
  updateBottling,
  getReminders,
  generateBatchICS,
  importBatches,
  formatDateISO,
  BATCH_STATUS,
} from '../core/batches.js';
import { formatSG } from '../core/calculations.js';
import {
  primingSugar,
  PRIMING_SUGARS,
  refractometerFG,
  sgToBrix,
  brixToSG,
} from '../core/brewtools.js';
import { showToast, escHtml } from './toast.js';

let activeBatchId = null;
let statusFilter = 'alla'; // 'alla' | 'jäser' | 'konditioneras' | 'klar'
let isBatchesOpen = false;
let globalRecalculate = null;

/**
 * Initializes batches view event listeners and binds to header buttons.
 * @param {Function} recalculateCallback
 */
export function setupBatchesView(recalculateCallback) {
  globalRecalculate = recalculateCallback;

  // Header button
  document.getElementById('btn-batches')?.addEventListener('click', () => {
    openBatchesView();
  });

  // Dropdown menu button
  document.getElementById('btn-batches-menu')?.addEventListener('click', () => {
    openBatchesView();
  });

  // Section 7 CTA button
  document.getElementById('cta-btn-view-batches')?.addEventListener('click', () => {
    const curRecipe = State.recipe?.name;
    const matching = getBatchesForRecipe(curRecipe);
    if (matching.length === 1) {
      openBatchesView(matching[0].id);
    } else {
      openBatchesView();
    }
  });

  // Recipe name input changes update badge
  document.getElementById('recipe-name-input')?.addEventListener('input', () => {
    updateRecipeBrewCountBadge();
  });

  updateRecipeBrewCountBadge();
}

/**
 * Updates the "Bryggd N ggr" badge next to the recipe name input and in Section 7.
 */
export function updateRecipeBrewCountBadge() {
  const curName = State.recipe?.name || '';
  const batches = getBatchesForRecipe(curName);
  const count = batches.length;

  const countEl = document.getElementById('recipe-brew-count');
  if (countEl) countEl.textContent = String(count);

  const badgeEl = document.getElementById('recipe-brew-badge');
  if (badgeEl) {
    if (count > 0) {
      badgeEl.textContent = `Bryggd ${count} ${count === 1 ? 'gång' : 'gånger'}`;
      badgeEl.classList.remove('hidden');
      badgeEl.onclick = () => {
        if (count === 1) openBatchesView(batches[0].id);
        else openBatchesView();
      };
    } else {
      badgeEl.classList.add('hidden');
      badgeEl.onclick = null;
    }
  }
}

/**
 * Opens the Batches view.
 * @param {string} [batchId] - If provided, opens directly to detail view
 */
export function openBatchesView(batchId = null) {
  const desktopView = document.getElementById('desktop-app-view');
  const mobileView = document.getElementById('mobile-app-view');
  const brewdayView = document.getElementById('brewday-view');
  const batchesView = document.getElementById('batches-view');

  if (!batchesView) return;

  activeBatchId = batchId;
  isBatchesOpen = true;

  desktopView?.classList.add('view-hidden');
  mobileView?.classList.add('view-hidden');
  brewdayView?.classList.add('hidden');
  batchesView.classList.remove('hidden');

  renderBatchesView();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Closes the Batches view and restores the editor.
 */
export function closeBatchesView() {
  const desktopView = document.getElementById('desktop-app-view');
  const batchesView = document.getElementById('batches-view');

  if (!batchesView) return;

  isBatchesOpen = false;
  activeBatchId = null;

  batchesView.classList.add('hidden');
  desktopView?.classList.remove('view-hidden');

  updateRecipeBrewCountBadge();
  if (globalRecalculate) globalRecalculate();
}

/**
 * Renders the Batches view (List or Detail).
 */
export function renderBatchesView() {
  const container = document.getElementById('batches-view');
  if (!container || !isBatchesOpen) return;

  if (activeBatchId) {
    renderBatchDetail(container, activeBatchId);
  } else {
    renderBatchList(container);
  }
}

/**
 * Renders the list of batches.
 * @param {HTMLElement} container
 */
function renderBatchList(container) {
  const batches = getBatches();
  const todayStr = formatDateISO();

  // Find active reminders for today across active batches
  const todayReminders = [];
  batches.forEach((b) => {
    if (b.status !== BATCH_STATUS.COMPLETED) {
      const rems = getReminders(b, todayStr).filter((r) => r.isToday);
      rems.forEach((r) => todayReminders.push({ ...r, batchName: b.recipeName, batchId: b.id }));
    }
  });

  // Filter batches
  let filtered = batches;
  if (statusFilter !== 'alla') {
    filtered = batches.filter((b) => b.status === statusFilter);
  }

  const counts = {
    alla: batches.length,
    jäser: batches.filter((b) => b.status === BATCH_STATUS.FERMENTING).length,
    konditioneras: batches.filter((b) => b.status === BATCH_STATUS.CONDITIONING).length,
    klar: batches.filter((b) => b.status === BATCH_STATUS.COMPLETED).length,
  };

  container.innerHTML = `
    <div class="batches-container">
      <!-- HEADER -->
      <div class="batches-header">
        <div>
          <h2 class="batches-title">📒 Mina bryggningar</h2>
          <p class="batches-subtitle">Historik, jäsningsmätningar, jässcheman och buteljering för dina batcher.</p>
        </div>
        <div class="batches-header-actions">
          <button class="btn btn-primary" id="btn-create-batch-current">
            ➕ Ny batch från aktuellt recept
          </button>
          <button class="btn btn-secondary btn-sm" id="btn-export-batches-json" title="Exportera alla batcher som JSON">
            📥 Exportera batcher
          </button>
          <button class="btn btn-secondary btn-sm" id="btn-import-batches-json" title="Importera sparade batcher">
            📤 Importera batcher
          </button>
          <input type="file" id="batch-import-file-input" accept=".json" style="display:none">
          <button class="btn btn-ghost btn-sm" id="btn-close-batches">
            ✕ Tillbaka till receptet
          </button>
        </div>
      </div>

      <!-- REMINDERS CALLOUT BANNER -->
      ${todayReminders.length > 0 ? `
        <div class="batches-reminder-box">
          <div class="batches-reminder-title">
            <span>🔔</span> <strong>Att göra idag (${todayStr})</strong>
          </div>
          <ul class="batches-reminder-list">
            ${todayReminders.map((r) => `
              <li>
                <strong>${escHtml(r.batchName)}:</strong> ${escHtml(r.text)}
                <button class="btn btn-xs btn-secondary" data-goto-batch="${r.batchId}">Visa batch →</button>
              </li>
            `).join('')}
          </ul>
        </div>
      ` : ''}

      <!-- FILTER TABS -->
      <div class="batches-filter-bar">
        <button class="batches-filter-btn ${statusFilter === 'alla' ? 'active' : ''}" data-filter="alla">
          Alla (${counts.alla})
        </button>
        <button class="batches-filter-btn ${statusFilter === 'jäser' ? 'active' : ''}" data-filter="jäser">
          Jäser (${counts.jäser})
        </button>
        <button class="batches-filter-btn ${statusFilter === 'konditioneras' ? 'active' : ''}" data-filter="konditioneras">
          Konditioneras (${counts.konditioneras})
        </button>
        <button class="batches-filter-btn ${statusFilter === 'klar' ? 'active' : ''}" data-filter="klar">
          Klara (${counts.klar})
        </button>
      </div>

      <!-- BATCH CARDS GRID -->
      ${filtered.length === 0 ? `
        <div class="empty-state" style="padding:48px 16px; background:var(--bg-card); border-radius:var(--radius); border:1px solid var(--border);">
          <div class="empty-icon" style="font-size:2.5rem; margin-bottom:12px">🍺</div>
          <h3 style="margin-bottom:6px">Inga batcher hittades</h3>
          <p style="color:var(--text-secondary); margin-bottom:16px">
            ${statusFilter === 'alla'
              ? 'Du har inte skapat några bryggningar än. Klicka på "Ny batch från aktuellt recept" eller slutför en bryggdag i bryggdagsläget!'
              : `Inga batcher med status "${statusFilter}".`}
          </p>
          <button class="btn btn-primary" id="btn-create-first-batch">
            ➕ Skapa batch från aktuellt recept
          </button>
        </div>
      ` : `
        <div class="batches-grid">
          ${filtered.map((b) => renderBatchCardHtml(b)).join('')}
        </div>
      `}
    </div>
  `;

  // Bind list events
  container.querySelector('#btn-close-batches')?.addEventListener('click', closeBatchesView);
  container.querySelector('#btn-create-batch-current')?.addEventListener('click', () => {
    const newB = createBatch({
      recipeSnapshot: State,
      brewDate: formatDateISO(),
      notes: State.recipe.notes || '',
    });
    showToast(`🎉 Ny batch skapad för "${newB.recipeName}"!`, 'success');
    activeBatchId = newB.id;
    renderBatchesView();
  });
  container.querySelector('#btn-create-first-batch')?.addEventListener('click', () => {
    const newB = createBatch({
      recipeSnapshot: State,
      brewDate: formatDateISO(),
      notes: State.recipe.notes || '',
    });
    showToast(`🎉 Ny batch skapad för "${newB.recipeName}"!`, 'success');
    activeBatchId = newB.id;
    renderBatchesView();
  });

  // Export JSON
  container.querySelector('#btn-export-batches-json')?.addEventListener('click', () => {
    const data = JSON.stringify(getBatches(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brygglabbet_batcher_${formatDateISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📥 Alla batcher exporterade som JSON', 'success');
  });

  // Import JSON
  const importInput = container.querySelector('#batch-import-file-input');
  container.querySelector('#btn-import-batches-json')?.addEventListener('click', () => {
    importInput?.click();
  });
  importInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target.result);
        if (!Array.isArray(parsed)) throw new Error('Ogiltigt batch-format');
        importBatches(parsed);
        showToast(`📤 Importerade ${parsed.length} batcher!`, 'success');
        renderBatchesView();
      } catch (err) {
        console.error(err);
        showToast('⚠️ Kunde inte importera batchfilen (ogiltig JSON)', 'error');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  });

  // Filter buttons
  container.querySelectorAll('.batches-filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      statusFilter = btn.dataset.filter;
      renderBatchesView();
    });
  });

  // Goto batch from reminder
  container.querySelectorAll('[data-goto-batch]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeBatchId = btn.dataset.gotoBatch;
      renderBatchesView();
    });
  });

  // Card click & action buttons
  container.querySelectorAll('.batch-card').forEach((card) => {
    const id = card.dataset.batchId;
    card.querySelector('[data-open-batch]')?.addEventListener('click', () => {
      activeBatchId = id;
      renderBatchesView();
    });
    card.querySelector('[data-download-ics]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      downloadICS(id);
    });
    card.querySelector('[data-delete-batch]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const b = getBatchById(id);
      if (confirm(`Är du säker på att du vill radera batchen "${b?.recipeName}"?`)) {
        deleteBatch(id);
        showToast('🗑️ Batch raderad', 'info');
        renderBatchesView();
      }
    });
  });
}

/**
 * Generates card HTML for single batch item in list view.
 * @param {object} b - Batch object
 * @returns {string} HTML
 */
function renderBatchCardHtml(b) {
  const statusColors = {
    [BATCH_STATUS.FERMENTING]: { bg: 'rgba(234, 88, 12, 0.12)', text: '#c2410c', border: '#f97316' },
    [BATCH_STATUS.CONDITIONING]: { bg: 'rgba(59, 130, 246, 0.12)', text: '#1d4ed8', border: '#3b82f6' },
    [BATCH_STATUS.COMPLETED]: { bg: 'rgba(16, 185, 129, 0.12)', text: '#047857', border: '#10b981' },
  };
  const color = statusColors[b.status] || statusColors[BATCH_STATUS.FERMENTING];

  const actualOG = b.measured?.og || (b.metricsSnapshot?.og ? formatSG(b.metricsSnapshot.og) : '—');
  const actualFG = b.fg ? b.fg.toFixed(3) : '—';
  const actualABV = b.abv ? `${b.abv.toFixed(1)}%` : (b.metricsSnapshot?.abv ? `(${b.metricsSnapshot.abv.toFixed(1)}%)` : '—');
  const effStr = b.efficiency ? `${b.efficiency.toFixed(1)}%` : (b.metricsSnapshot?.efficiency ? `${b.metricsSnapshot.efficiency}%` : '—');

  // Next reminder or stage
  const reminders = getReminders(b);
  const nextRem = reminders.find((r) => !r.isPast) || reminders[0];

  return `
    <div class="batch-card" data-batch-id="${b.id}" style="border-top: 4px solid ${color.border}">
      <div class="batch-card-header">
        <span class="batch-status-badge" style="background:${color.bg}; color:${color.text}; border:1px solid ${color.border}">
          ${escHtml(b.status.toUpperCase())}
        </span>
        <span class="batch-date-badge">🗓️ ${b.brewDate || '—'}</span>
      </div>

      <h3 class="batch-card-title">${escHtml(b.recipeName)}</h3>

      <div class="batch-stats-grid">
        <div class="batch-stat-cell">
          <span class="batch-stat-label">OG</span>
          <span class="batch-stat-val">${actualOG}</span>
        </div>
        <div class="batch-stat-cell">
          <span class="batch-stat-label">FG</span>
          <span class="batch-stat-val">${actualFG}</span>
        </div>
        <div class="batch-stat-cell">
          <span class="batch-stat-label">ABV</span>
          <span class="batch-stat-val">${actualABV}</span>
        </div>
        <div class="batch-stat-cell">
          <span class="batch-stat-label">Effektivitet</span>
          <span class="batch-stat-val">${effStr}</span>
        </div>
      </div>

      ${nextRem ? `
        <div class="batch-next-hint">
          ⏱️ <strong>${nextRem.isToday ? 'Idag' : nextRem.date}:</strong> ${escHtml(nextRem.text)}
        </div>
      ` : ''}

      <div class="batch-card-actions">
        <button class="btn btn-secondary btn-sm" data-open-batch style="flex:1; justify-content:center;">
          Öppna detaljer →
        </button>
        <button class="btn btn-ghost btn-sm" data-download-ics title="Ladda ner kalender (.ics)">
          📅 .ics
        </button>
        <button class="btn btn-danger btn-icon" data-delete-batch title="Ta bort batch">
          ✕
        </button>
      </div>
    </div>
  `;
}

/**
 * Renders the detail view for a single batch.
 * @param {HTMLElement} container
 * @param {string} batchId
 */
function renderBatchDetail(container, batchId) {
  const batch = getBatchById(batchId);
  if (!batch) {
    activeBatchId = null;
    renderBatchesView();
    return;
  }

  const planned = batch.metricsSnapshot || {};
  const measured = batch.measured || {};

  container.innerHTML = `
    <div class="batches-container">
      <!-- TOP NAV -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <button class="btn btn-secondary btn-sm" id="btn-back-to-list">
          ← Tillbaka till alla bryggningar
        </button>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-secondary btn-sm" id="btn-detail-download-ics">
            📅 Ladda ner kalender (.ics)
          </button>
          <button class="btn btn-danger btn-sm" id="btn-detail-delete">
            Radera batch
          </button>
        </div>
      </div>

      <!-- MAIN BATCH HEADER -->
      <div class="batch-detail-header-card">
        <div class="batch-detail-title-row">
          <div>
            <h1 class="batch-detail-title">${escHtml(batch.recipeName)}</h1>
            <div class="batch-detail-meta">
              Bryggdag: <strong>${escHtml(batch.brewDate)}</strong> · Skapad: ${new Date(batch.createdAt).toLocaleDateString('sv-SE')}
            </div>
          </div>
          <div class="batch-detail-status-picker">
            <label for="batch-status-select" style="font-size:0.85rem; font-weight:600; color:var(--text-secondary)">Status:</label>
            <select id="batch-status-select" class="form-control" style="font-weight:700; padding:6px 12px;">
              <option value="${BATCH_STATUS.FERMENTING}" ${batch.status === BATCH_STATUS.FERMENTING ? 'selected' : ''}>⏳ Jäser</option>
              <option value="${BATCH_STATUS.CONDITIONING}" ${batch.status === BATCH_STATUS.CONDITIONING ? 'selected' : ''}>🍾 Konditioneras</option>
              <option value="${BATCH_STATUS.COMPLETED}" ${batch.status === BATCH_STATUS.COMPLETED ? 'selected' : ''}>✅ Klar</option>
            </select>
          </div>
        </div>
      </div>

      <!-- COMPARISON SUMMARY (PLANNED VS ACTUAL) -->
      <div class="card" style="margin-top:16px;">
        <p class="section-label">📊 Planerade vs Faktiska Värden</p>
        <div class="batch-compare-grid">
          <div class="batch-compare-card">
            <span class="compare-title">Stammvörtstyrka (OG)</span>
            <div class="compare-row">
              <span class="compare-label">Planerat:</span>
              <strong class="compare-val">${planned.og ? formatSG(planned.og) : '—'}</strong>
            </div>
            <div class="compare-row">
              <span class="compare-label">Faktiskt:</span>
              <strong class="compare-val active-val">${measured.og || '—'}</strong>
            </div>
          </div>

          <div class="batch-compare-card">
            <span class="compare-title">Slutgravitet (FG)</span>
            <div class="compare-row">
              <span class="compare-label">Planerat:</span>
              <strong class="compare-val">${planned.fg ? formatSG(planned.fg) : '—'}</strong>
            </div>
            <div class="compare-row">
              <span class="compare-label">Faktiskt:</span>
              <strong class="compare-val active-val">${batch.fg ? batch.fg.toFixed(3) : '—'}</strong>
            </div>
          </div>

          <div class="batch-compare-card">
            <span class="compare-title">Alkoholhalt (ABV)</span>
            <div class="compare-row">
              <span class="compare-label">Planerat:</span>
              <strong class="compare-val">${planned.abv ? `${planned.abv.toFixed(1)}%` : '—'}</strong>
            </div>
            <div class="compare-row">
              <span class="compare-label">Faktiskt:</span>
              <strong class="compare-val active-val">${batch.abv ? `${batch.abv.toFixed(1)}%` : '—'}</strong>
            </div>
          </div>

          <div class="batch-compare-card">
            <span class="compare-title">Bryggeffektivitet</span>
            <div class="compare-row">
              <span class="compare-label">Planerat:</span>
              <strong class="compare-val">${planned.efficiency ? `${planned.efficiency}%` : '—'}</strong>
            </div>
            <div class="compare-row">
              <span class="compare-label">Faktisk:</span>
              <strong class="compare-val active-val">${batch.efficiency ? `${batch.efficiency.toFixed(1)}%` : '—'}</strong>
            </div>
          </div>

          <div class="batch-compare-card">
            <span class="compare-title">Volym i Jäskärl</span>
            <div class="compare-row">
              <span class="compare-label">Planerat:</span>
              <strong class="compare-val">${planned.batchVolume ? `${planned.batchVolume} L` : '—'}</strong>
            </div>
            <div class="compare-row">
              <span class="compare-label">Faktiskt:</span>
              <strong class="compare-val active-val">${measured.fermenterVol ? `${measured.fermenterVol} L` : '—'}</strong>
            </div>
          </div>

          <div class="batch-compare-card">
            <span class="compare-title">Mäsk-pH &amp; Förkok</span>
            <div class="compare-row">
              <span class="compare-label">Mäsk-pH:</span>
              <strong class="compare-val active-val">${measured.mashPH || '—'}</strong>
            </div>
            <div class="compare-row">
              <span class="compare-label">Förkok SG:</span>
              <strong class="compare-val active-val">${measured.preboilSG || '—'}</strong>
            </div>
          </div>
        </div>
      </div>

      <!-- FERMENTATION SCHEDULE & DRY HOPS -->
      <div class="card" style="margin-top:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <p class="section-label" style="margin:0">⏱️ Jässchema & Tidslinje</p>
          <span style="font-size:0.85rem; color:var(--text-secondary)">
            Beräknad buteljering: <strong>${batch.estimatedBottlingDate || '—'}</strong>
          </span>
        </div>

        <div class="batch-schedule-timeline">
          ${(batch.fermentationPlan || []).map((stage, idx) => {
            const isCurrent = formatDateISO() >= stage.startDate && formatDateISO() <= stage.endDate;
            return `
              <div class="timeline-stage-item ${isCurrent ? 'current-stage' : ''}">
                <div class="timeline-badge">${idx + 1}</div>
                <div class="timeline-content">
                  <strong>${escHtml(stage.name)}</strong>
                  <div class="timeline-temp">${stage.tempC}°C</div>
                  <div class="timeline-dates">${stage.startDate} → ${stage.endDate} (${stage.days} dagar)</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- DRY HOPS SCHEDULE -->
        ${(batch.dryHopSchedule || []).length > 0 ? `
          <div style="margin-top:16px; border-top:1px dashed var(--border); padding-top:12px;">
            <p style="font-weight:600; font-size:0.9rem; margin-bottom:8px;">🌿 Torrhumlingsschema</p>
            <div class="batch-dryhop-list">
              ${batch.dryHopSchedule.map((dh, dhIdx) => `
                <div class="batch-dryhop-row">
                  <div style="flex:1">
                    <strong>${dh.amount} g ${escHtml(dh.hopName)}</strong>
                    <div style="font-size:0.82rem; color:var(--text-secondary);">
                      Tillsätt: <strong>${dh.addDate}</strong> (dag ${dh.day}) · Ta bort: <strong>${dh.removeDate}</strong> (${dh.days} dagar)
                    </div>
                  </div>
                  <div style="display:flex; gap:12px; align-items:center;">
                    <label class="tool-check" style="font-size:0.82rem">
                      <input type="checkbox" data-dryhop-added="${dhIdx}" ${dh.added ? 'checked' : ''}> Tillsatt
                    </label>
                    <label class="tool-check" style="font-size:0.82rem">
                      <input type="checkbox" data-dryhop-removed="${dhIdx}" ${dh.removed ? 'checked' : ''}> Borttagen
                    </label>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>

      <!-- GRAVITY READINGS LOG -->
      <div class="card" style="margin-top:16px;">
        <p class="section-label">📉 Gravitetsmätningar & Jäsningslogg</p>

        <!-- ADD READING FORM -->
        <div class="batch-reading-form">
          <div class="form-group" style="flex:1; min-width:130px;">
            <label class="form-label" for="rd-date">Datum</label>
            <input type="date" id="rd-date" value="${formatDateISO()}">
          </div>
          <div class="form-group" style="flex:1; min-width:140px;">
            <label class="form-label" for="rd-instrument">Instrument</label>
            <select id="rd-instrument">
              <option value="sg">Hydrometer (SG)</option>
              <option value="brix">Refraktometer (°Brix)</option>
            </select>
          </div>
          <div class="form-group" style="flex:1; min-width:120px;">
            <label class="form-label" for="rd-val" id="rd-val-label">Mätvärde (SG)</label>
            <input type="number" inputmode="decimal" id="rd-val" placeholder="t.ex. 1.015" step="0.001">
          </div>
          <div class="form-group" style="width:100px;">
            <label class="form-label" for="rd-temp">Temp (°C)</label>
            <input type="number" inputmode="decimal" id="rd-temp" value="20" step="1">
          </div>
          <div class="form-group" style="flex:2; min-width:160px;">
            <label class="form-label" for="rd-note">Notering</label>
            <input type="text" id="rd-note" placeholder="t.ex. Doftar passionsfrukt, klarnar fint">
          </div>
          <div class="form-group" style="align-self:flex-end;">
            <button class="btn btn-primary" id="btn-add-reading">➕ Lägg till</button>
          </div>
        </div>

        <div id="rd-preview-hint" style="margin-top:6px; font-size:0.83rem; color:var(--text-secondary);"></div>

        <!-- READINGS TABLE -->
        ${(!batch.readings || batch.readings.length === 0) ? `
          <p class="tool-hint" style="margin-top:12px; font-style:italic;">Inga mätningar inlagda än. Mata in prov ovan för att beräkna FG, ABV och förjäsningsgrad.</p>
        ` : `
          <div class="table-responsive" style="margin-top:14px;">
            <table class="data-table" style="width:100%;">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Inmatat</th>
                  <th>Temp</th>
                  <th>Beräknat SG</th>
                  <th>Ack. ABV</th>
                  <th>Notering</th>
                  <th>Åtgärd</th>
                </tr>
              </thead>
              <tbody>
                ${batch.readings.map((r) => {
                  const valStr = r.sg ? `${Number(r.sg).toFixed(3)} SG` : `${Number(r.brix).toFixed(1)} °Brix`;
                  const curSG = r.sg || (r.brix && measured.og ? refractometerFG(sgToBrix(Number(measured.og)), Number(r.brix), r.wcf || 1.0) : brixToSG(Number(r.brix)));
                  const curABV = (measured.og && curSG && Number(measured.og) > curSG)
                    ? `${(((Number(measured.og) - curSG) * 131.25)).toFixed(1)}%`
                    : '—';
                  return `
                    <tr>
                      <td>${r.date}</td>
                      <td><strong>${valStr}</strong></td>
                      <td>${r.tempC !== null && r.tempC !== undefined ? `${r.tempC}°C` : '—'}</td>
                      <td><strong>${curSG ? curSG.toFixed(3) : '—'}</strong></td>
                      <td>${curABV}</td>
                      <td style="color:var(--text-secondary); font-size:0.85rem">${escHtml(r.note || '—')}</td>
                      <td>
                        <button class="btn btn-danger btn-icon" data-del-reading="${r.id}" title="Ta bort">✕</button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>

      <!-- BOTTLING & PACKAGING -->
      <div class="card" style="margin-top:16px;">
        <p class="section-label">🍾 Flaskning & Fatning (Kolsyrejäsning)</p>
        <div class="card-grid-3">
          <div class="form-group">
            <label class="form-label" for="btl-date">Förpackningsdatum</label>
            <input type="date" id="btl-date" value="${batch.bottling?.date || formatDateISO()}">
          </div>
          <div class="form-group">
            <label class="form-label" for="btl-method">Metod</label>
            <select id="btl-method">
              <option value="flaska" ${batch.bottling?.method === 'flaska' ? 'selected' : ''}>Flaska (Kolsyresocker)</option>
              <option value="fat" ${batch.bottling?.method === 'fat' ? 'selected' : ''}>Fat / Keg (Tryck/Socker)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="btl-sugar-type">Sockertyp</label>
            <select id="btl-sugar-type">
              ${Object.entries(PRIMING_SUGARS).map(([k, v]) => `
                <option value="${k}" ${batch.bottling?.sugarType === k ? 'selected' : ''}>${v.label}</option>
              `).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="btl-vols">Mål Kolsyra (Vols CO₂)</label>
            <input type="number" inputmode="decimal" id="btl-vols" value="${batch.bottling?.vols || 2.4}" step="0.1" min="1.0" max="4.5">
          </div>
          <div class="form-group">
            <label class="form-label" for="btl-temp">Jäs-/Öltemperatur (°C)</label>
            <input type="number" inputmode="decimal" id="btl-temp" value="${batch.bottling?.tempC || 20}" step="1">
          </div>
          <div class="form-group">
            <label class="form-label" for="btl-vol">Volym att buteljera (L)</label>
            <input type="number" inputmode="decimal" id="btl-vol" value="${batch.bottling?.volumeL || measured.fermenterVol || planned.batchVolume || 20}" step="0.5">
          </div>
        </div>

        <div id="btl-sugar-result" class="tool-result" style="margin-top:12px;"></div>

        <button class="btn btn-primary" id="btn-save-bottling" style="margin-top:12px;">
          💾 Spara buteljeringsdata
        </button>
      </div>

      <!-- TASTING NOTES & RATING -->
      <div class="card" style="margin-top:16px;">
        <p class="section-label">⭐ Provsmakning, Betyg & Slutomdöme</p>
        <div style="display:flex; gap:16px; align-items:center; margin-bottom:12px;">
          <label style="font-weight:600; color:var(--text-secondary)">Betyg (1–5 stjärnor):</label>
          <div class="batch-stars-rating" id="batch-stars-container">
            ${[1, 2, 3, 4, 5].map((star) => `
              <span class="batch-star ${batch.rating >= star ? 'filled' : ''}" data-star="${star}">★</span>
            `).join('')}
          </div>
          <span id="star-score-text" style="font-weight:700; color:var(--accent);">
            ${batch.rating ? `${batch.rating} av 5` : 'Ej betygsatt'}
          </span>
        </div>
        <div class="form-group">
          <label class="form-label" for="batch-tasting-notes">Smaknoteringar, doft, kolsyra och förbättringar till nästa gång</label>
          <textarea id="batch-tasting-notes" rows="4" placeholder="Hur smakar det färdiga ölet? Balans, beska, maltighet, skumkrona etc.">${escHtml(batch.tastingNotes || '')}</textarea>
        </div>
        <button class="btn btn-secondary" id="btn-save-tasting" style="margin-top:10px;">
          💾 Spara omdöme
        </button>
      </div>
    </div>
  `;

  // Bind Detail Events
  container.querySelector('#btn-back-to-list')?.addEventListener('click', () => {
    activeBatchId = null;
    renderBatchesView();
  });

  // Download ICS
  container.querySelector('#btn-detail-download-ics')?.addEventListener('click', () => {
    downloadICS(batch.id);
  });

  // Delete Batch
  container.querySelector('#btn-detail-delete')?.addEventListener('click', () => {
    if (confirm(`Är du säker på att du vill radera batchen "${batch.recipeName}"?`)) {
      deleteBatch(batch.id);
      showToast('🗑️ Batch raderad', 'info');
      activeBatchId = null;
      renderBatchesView();
    }
  });

  // Change Status
  container.querySelector('#batch-status-select')?.addEventListener('change', (e) => {
    batch.status = e.target.value;
    saveBatch(batch);
    showToast(`Status ändrad till ${batch.status}`, 'success');
  });

  // Dry hop checkboxes
  container.querySelectorAll('[data-dryhop-added]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const idx = parseInt(cb.dataset.dryhopAdded, 10);
      if (batch.dryHopSchedule[idx]) {
        batch.dryHopSchedule[idx].added = cb.checked;
        saveBatch(batch);
      }
    });
  });
  container.querySelectorAll('[data-dryhop-removed]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const idx = parseInt(cb.dataset.dryhopRemoved, 10);
      if (batch.dryHopSchedule[idx]) {
        batch.dryHopSchedule[idx].removed = cb.checked;
        saveBatch(batch);
      }
    });
  });

  // Live conversion hint in readings input
  const rdValInput = container.querySelector('#rd-val');
  const rdInstSelect = container.querySelector('#rd-instrument');
  const rdPreviewHint = container.querySelector('#rd-preview-hint');
  const updateReadingHint = () => {
    const isBrix = rdInstSelect?.value === 'brix';
    container.querySelector('#rd-val-label').textContent = isBrix ? 'Mätvärde (°Brix)' : 'Mätvärde (SG)';
    const val = parseFloat(rdValInput?.value?.replace(',', '.'));
    if (!Number.isFinite(val) || val <= 0) {
      if (rdPreviewHint) rdPreviewHint.textContent = '';
      return;
    }
    if (isBrix) {
      const ogNum = parseFloat(String(measured.og || '').replace(',', '.'));
      if (ogNum > 1.0) {
        const ogBrix = sgToBrix(ogNum);
        const estSG = refractometerFG(ogBrix, val, 1.0);
        if (rdPreviewHint) {
          rdPreviewHint.innerHTML = `💡 Beräknat slut-SG: <strong>${estSG.toFixed(3)}</strong> (med Terrills refraktometerformel utifrån OG ${formatSG(ogNum)}).`;
        }
      } else {
        const estSG = brixToSG(val);
        if (rdPreviewHint) {
          rdPreviewHint.innerHTML = `💡 Motsvarar ca <strong>${estSG.toFixed(3)} SG</strong> (före jäsning).`;
        }
      }
    } else {
      if (rdPreviewHint) rdPreviewHint.textContent = '';
    }
  };
  rdValInput?.addEventListener('input', updateReadingHint);
  rdInstSelect?.addEventListener('change', updateReadingHint);

  // Add Reading
  container.querySelector('#btn-add-reading')?.addEventListener('click', () => {
    const date = container.querySelector('#rd-date')?.value || formatDateISO();
    const inst = container.querySelector('#rd-instrument')?.value || 'sg';
    const val = parseFloat(container.querySelector('#rd-val')?.value?.replace(',', '.'));
    const temp = parseFloat(container.querySelector('#rd-temp')?.value);
    const note = container.querySelector('#rd-note')?.value || '';

    if (!Number.isFinite(val) || val <= 0) {
      showToast('⚠️ Ange ett giltigt mätvärde', 'warning');
      return;
    }

    addReadingToBatch(batch.id, {
      date,
      sg: inst === 'sg' ? val : null,
      brix: inst === 'brix' ? val : null,
      tempC: Number.isFinite(temp) ? temp : null,
      isHydrometer: inst === 'sg',
      note,
    });

    showToast('📊 Mätning tillagd!', 'success');
    renderBatchesView();
  });

  // Delete Reading
  container.querySelectorAll('[data-del-reading]').forEach((btn) => {
    btn.addEventListener('click', () => {
      deleteReadingFromBatch(batch.id, btn.dataset.delReading);
      showToast('Mätning borttagen', 'info');
      renderBatchesView();
    });
  });

  // Priming sugar live preview
  const updateSugarPreview = () => {
    const resBox = container.querySelector('#btl-sugar-result');
    if (!resBox) return;
    const vol = parseFloat(container.querySelector('#btl-vol')?.value) || 20;
    const vols = parseFloat(container.querySelector('#btl-vols')?.value) || 2.4;
    const temp = parseFloat(container.querySelector('#btl-temp')?.value) || 20;
    const sugarType = container.querySelector('#btl-sugar-type')?.value || 'sucrose';
    const method = container.querySelector('#btl-method')?.value || 'flaska';

    const pRes = primingSugar({
      volumeL: vol,
      targetVols: vols,
      tempC: temp,
      sugar: sugarType,
    });

    if (method === 'fat') {
      resBox.innerHTML = `
        <strong>Fatkolsyresättning:</strong> För att uppnå <strong>${vols} volymer CO₂</strong> vid ${temp}°C krävs ett jämviktstryck på ca <strong>${(vols * 0.7).toFixed(1)} bar</strong>. Om socker används: tillsätt <strong>${Math.round(pRes.sugarG * 0.5)} g</strong> socker (fat kolsyresätts ofta med hälften så mycket primingsocker).
      `;
    } else {
      resBox.innerHTML = `
        <strong>Beräknad sockergiva:</strong> Tillsätt <strong>${pRes.sugarG} g</strong> ${PRIMING_SUGARS[sugarType]?.label || sugarType} (ca <strong>${pRes.sugarGPerL} g/L</strong>) för att nå <strong>${vols} volymer CO₂</strong> vid ${temp}°C.
      `;
    }
  };
  ['btl-vol', 'btl-vols', 'btl-temp', 'btl-sugar-type', 'btl-method'].forEach((id) => {
    container.querySelector(`#${id}`)?.addEventListener('input', updateSugarPreview);
    container.querySelector(`#${id}`)?.addEventListener('change', updateSugarPreview);
  });
  updateSugarPreview();

  // Save Bottling
  container.querySelector('#btn-save-bottling')?.addEventListener('click', () => {
    const vol = parseFloat(container.querySelector('#btl-vol')?.value) || 20;
    const vols = parseFloat(container.querySelector('#btl-vols')?.value) || 2.4;
    const temp = parseFloat(container.querySelector('#btl-temp')?.value) || 20;
    const sugarType = container.querySelector('#btl-sugar-type')?.value || 'sucrose';
    const method = container.querySelector('#btl-method')?.value || 'flaska';
    const date = container.querySelector('#btl-date')?.value || formatDateISO();

    const pRes = primingSugar({ volumeL: vol, targetVols: vols, tempC: temp, sugar: sugarType });

    updateBottling(batch.id, {
      date,
      method,
      sugarType,
      sugarG: pRes.sugarG,
      sugarGPerL: pRes.sugarGPerL,
      vols,
      tempC: temp,
      volumeL: vol,
    });

    showToast('🍾 Buteljeringsdata sparad!', 'success');
    renderBatchesView();
  });

  // Star Rating
  container.querySelectorAll('.batch-star').forEach((starEl) => {
    starEl.addEventListener('click', () => {
      const star = parseInt(starEl.dataset.star, 10);
      batch.rating = star;
      saveBatch(batch);
      container.querySelectorAll('.batch-star').forEach((s) => {
        const sVal = parseInt(s.dataset.star, 10);
        if (sVal <= star) s.classList.add('filled');
        else s.classList.remove('filled');
      });
      container.querySelector('#star-score-text').textContent = `${star} av 5`;
      showToast(`Betyg sparat: ${star} av 5 ★`, 'success');
    });
  });

  // Save Tasting Notes
  container.querySelector('#btn-save-tasting')?.addEventListener('click', () => {
    batch.tastingNotes = container.querySelector('#batch-tasting-notes')?.value || '';
    saveBatch(batch);
    showToast('💾 Smaknoteringar sparade!', 'success');
  });
}

/**
 * Triggers browser download of RFC 5545 .ics calendar file.
 * @param {string} batchId
 */
function downloadICS(batchId) {
  const batch = getBatchById(batchId);
  if (!batch) return;
  const ics = generateBatchICS(batch);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${batch.recipeName.replace(/[^a-z0-9åäö]/gi, '_')}_jasschema.ics`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📅 Kalenderfil (.ics) nedladdad!', 'success');
}
