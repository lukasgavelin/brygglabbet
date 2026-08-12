/**
 * Professional Brewery Sheet Print Module (Bryggprotokoll).
 * Prepares a structured print layout with recipe summary, metrics, and brew log section.
 */

import { State } from '../state.js';
import { calculateOG, calculateFG, calculateABV, calculateIBU, calculateEBC, formatSG } from '../core/calculations.js';

export function setupPrintHandler() {
  window.addEventListener('beforeprint', preparePrintView);
  window.addEventListener('afterprint', cleanupPrintView);
}

export function triggerPrint() {
  window.print();
}

function preparePrintView() {
  // 1. Force expand all collapsed accordion cards for printing
  document.querySelectorAll('.accordion-card').forEach((card) => {
    card.dataset.wasCollapsed = card.classList.contains('collapsed') ? 'true' : 'false';
    card.classList.remove('collapsed');
  });

  // 2. Ensure textareas and select elements display full text in print
  document.querySelectorAll('textarea').forEach((ta) => {
    ta.setAttribute('data-print-val', ta.value);
  });

  // 3. Create or update dynamic Print Banner
  let banner = document.getElementById('print-brew-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'print-brew-banner';
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.insertBefore(banner, mainContent.firstChild);
    }
  }

  const ogRes = calculateOG(State.fermentables, State.recipe.batchVolume, State.recipe.efficiency);
  const fgRes = calculateFG(ogRes.sg, (State.yeast.attMin + State.yeast.attMax) / 2);
  const abvRes = calculateABV(ogRes.sg, fgRes.sg);
  const ibuRes = calculateIBU(State.hops, ogRes.sg, State.recipe.batchVolume);
  const ebcRes = calculateEBC(State.fermentables, State.recipe.batchVolume);

  const todayStr = new Date().toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  banner.innerHTML = `
    <div class="print-banner-header">
      <div class="print-brand">
        <h1 class="print-title">🍺 BRYGGPROTOKOLL – ${escapeHtml(State.recipe.name || 'Namnlöst Recept')}</h1>
        <div class="print-meta">Brygglabbet Receptkalkylator • Bryggdatum: ${todayStr}</div>
      </div>
    </div>
    <div class="print-metrics-grid">
      <div class="print-metric-box">
        <span class="print-metric-label">Stammvörtstyrka (OG)</span>
        <span class="print-metric-val">${formatSG(ogRes.sg)} (${ogRes.plato.toFixed(1)}°P)</span>
      </div>
      <div class="print-metric-box">
        <span class="print-metric-label">Slutgravitet (FG)</span>
        <span class="print-metric-val">${formatSG(fgRes.sg)} (${fgRes.plato.toFixed(1)}°P)</span>
      </div>
      <div class="print-metric-box">
        <span class="print-metric-label">Alkoholstyrka</span>
        <span class="print-metric-val">${abvRes.abv.toFixed(1)}% ABV</span>
      </div>
      <div class="print-metric-box">
        <span class="print-metric-label">Beska</span>
        <span class="print-metric-val">${ibuRes.total.toFixed(0)} IBU</span>
      </div>
      <div class="print-metric-box">
        <span class="print-metric-label">Färg</span>
        <span class="print-metric-val">${ebcRes.ebc.toFixed(0)} EBC (${ebcRes.srm.toFixed(0)} SRM)</span>
      </div>
      <div class="print-metric-box">
        <span class="print-metric-label">Batchvolym</span>
        <span class="print-metric-val">${State.recipe.batchVolume} L</span>
      </div>
    </div>
  `;

  // 4. Create or update Brew Day Log section at end of printout
  let brewLog = document.getElementById('print-brew-log');
  if (!brewLog) {
    brewLog = document.createElement('section');
    brewLog.id = 'print-brew-log';
    const tabContent = document.getElementById('tab-content');
    if (tabContent) {
      tabContent.appendChild(brewLog);
    }
  }

  brewLog.innerHTML = `
    <h3 class="print-section-title">📋 Mätningar & Anteckningar på Bryggdagen</h3>
    <div class="print-log-grid">
      <div class="print-log-field">
        <span class="print-log-label">Uppmätt Mäsk-pH:</span>
        <span class="print-log-line"></span>
      </div>
      <div class="print-log-field">
        <span class="print-log-label">Uppmätt Pre-Boil SG:</span>
        <span class="print-log-line"></span>
      </div>
      <div class="print-log-field">
        <span class="print-log-label">Uppmätt OG (Pre-fermenter):</span>
        <span class="print-log-line"></span>
      </div>
      <div class="print-log-field">
        <span class="print-log-label">Slutlig Jäsvolym:</span>
        <span class="print-log-line"></span>
      </div>
      <div class="print-log-field">
        <span class="print-log-label">Uppmätt FG:</span>
        <span class="print-log-line"></span>
      </div>
      <div class="print-log-field">
        <span class="print-log-label">Flaskning / Fatningsdatum:</span>
        <span class="print-log-line"></span>
      </div>
    </div>
    <div style="margin-top:12px">
      <span class="print-log-label">Egna noteringar under bryggningen & jäsningen:</span>
      <div class="print-log-notes-box"></div>
    </div>
  `;
}

function cleanupPrintView() {
  // Restore accordion states
  document.querySelectorAll('.accordion-card').forEach((card) => {
    if (card.dataset.wasCollapsed === 'true') {
      card.classList.add('collapsed');
    }
    delete card.dataset.wasCollapsed;
  });

  const banner = document.getElementById('print-brew-banner');
  if (banner) banner.remove();

  const brewLog = document.getElementById('print-brew-log');
  if (brewLog) brewLog.remove();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
