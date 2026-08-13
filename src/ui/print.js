/**
 * Cooking-App Style Print Module (Bryggprotokoll).
 * Prepares a clean, dedicated print layout featuring a compact ingredient list
 * and clear step-by-step instructions.
 */

import { State } from '../state.js';
import { STYLES } from '../core/data.js';
import {
  calculateOG,
  calculateFG,
  calculateABV,
  calculateIBU,
  calculateEBC,
  formatSG,
  calculateWaterVolumes,
} from '../core/calculations.js';

export function setupPrintHandler() {
  window.addEventListener('beforeprint', preparePrintView);
  window.addEventListener('afterprint', cleanupPrintView);
}

export function triggerPrint() {
  window.print();
}

function preparePrintView() {
  // Create or update dynamic Print Container
  let printContainer = document.getElementById('print-container');
  if (!printContainer) {
    printContainer = document.createElement('div');
    printContainer.id = 'print-container';
    document.body.appendChild(printContainer);
  }

  // Core Calculations
  const ogRes = calculateOG(State.fermentables, State.recipe.batchVolume, State.recipe.efficiency);
  const fgRes = calculateFG(ogRes.sg, (State.yeast.attMin + State.yeast.attMax) / 2);
  const abvRes = calculateABV(ogRes.sg, fgRes.sg);
  const ibuRes = calculateIBU(State.hops, ogRes.sg, State.recipe.batchVolume);
  const ebcRes = calculateEBC(State.fermentables, State.recipe.batchVolume);
  const vols = calculateWaterVolumes(State.equipment, State.fermentables, State.recipe.boilTime || 60);

  const style = STYLES.find((s) => s.id === State.recipe.styleId);
  const styleName = style ? `${style.id} – ${style.name}` : 'Ej angiven ölstil';

  const todayStr = new Date().toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // 1. Fermentables
  const totalMaltKg = State.fermentables.reduce((sum, f) => sum + (f.amount || 0), 0);
  const fermentablesHtml = State.fermentables.map((f) => {
    const pct = totalMaltKg > 0 ? Math.round((f.amount / totalMaltKg) * 100) : 0;
    return `<li><strong>${f.amount.toFixed(2)} kg</strong> ${escapeHtml(f.name)} (${pct}%)</li>`;
  }).join('') || '<li>Ingen malt tillagd</li>';

  // 2. Hops Sorting and Layout
  const sortedHops = [...State.hops].sort((a, b) => {
    const getOrder = (h) => {
      if (h.use === 'kok') return 1;
      if (h.use === 'whirlpool') return 2;
      return 3; // torrhumle
    };
    const orderA = getOrder(a);
    const orderB = getOrder(b);
    if (orderA !== orderB) return orderA - orderB;
    if (a.use === 'kok') return b.time - a.time; // Descending boil time
    return 0;
  });

  const hopsHtml = sortedHops.map((h) => {
    let useStr = '';
    if (h.use === 'kok') useStr = `${h.time} min`;
    else if (h.use === 'whirlpool') useStr = 'Whirlpool';
    else useStr = 'Torrhumle';
    return `<li><strong>${h.amount} g</strong> ${escapeHtml(h.name)} (${useStr})</li>`;
  }).join('') || '<li>Inga humlegivor tillagda</li>';

  // 3. Yeast
  let yeastHtml = '';
  if (State.yeast.name) {
    yeastHtml = `<li><strong>${escapeHtml(State.yeast.name)}</strong> (${escapeHtml(State.yeast.lab || '')})`;
    if (State.yeast.tempMin && State.yeast.tempMax) {
      yeastHtml += `<br>Rek. temp: ${State.yeast.tempMin}–${State.yeast.tempMax}°C`;
    }
    yeastHtml += '</li>';
  } else {
    yeastHtml = '<li>Ingen jäst vald</li>';
  }

  // 4. Salts & Ions
  const saltsList = Object.entries(State.water.salts)
    .filter(([_, val]) => val > 0)
    .map(([salt, val]) => {
      const translation = {
        gypsum: 'Gypsum (Kalciumsulfat)',
        calciumChloride: 'Kalciumklorid',
        epsomSalt: 'Epsomsalt (Magnesiumsulfat)',
        tableSalt: 'Bordssalt (Natriumklorid)',
        chalk: 'Krita (Kalciumkarbonat)',
        bakingSoda: 'Bakpulver/Bikarbonat',
      };
      return `<li><strong>${val.toFixed(1)} g</strong> ${translation[salt] || salt}</li>`;
    }).join('');

  // 5. Strike Water Temp Calculation
  const strikeTemp = ((State.mash[0]?.temp || 67) + 4).toFixed(1);

  // 6. Mash Steps
  let mashStepsHtml = '';
  if (State.mash.length > 0) {
    mashStepsHtml = State.mash.map((s, i) => {
      return `<li><strong>Steg ${i + 1}:</strong> Håll <strong>${s.temp}°C</strong> i <strong>${s.time} min</strong> (${s.type})</li>`;
    }).join('');
  } else {
    mashStepsHtml = '<li>Inga mäsksteg angivna.</li>';
  }

  // 7. Hops Instructions
  const boilHops = sortedHops.filter(h => h.use === 'kok');
  const wpHops = sortedHops.filter(h => h.use === 'whirlpool');
  const dryHops = sortedHops.filter(h => h.use === 'torrhumle');

  const hopSteps = [];
  if (boilHops.length > 0) {
    boilHops.forEach((h) => {
      const timeRemaining = h.time;
      const timePassed = (State.recipe.boilTime || 60) - timeRemaining;
      hopSteps.push(`Tillsätt <strong>${h.amount} g ${escapeHtml(h.name)}</strong> (${h.alpha}%) när <strong>${timeRemaining} min kvar</strong> (efter ${timePassed} min koktid)`);
    });
  }
  if (wpHops.length > 0) {
    wpHops.forEach((h) => {
      hopSteps.push(`Tillsätt <strong>${h.amount} g ${escapeHtml(h.name)}</strong> vid <strong>whirlpool / kokslut</strong>`);
    });
  }

  let hopStepsHtml = hopSteps.map(step => `<li>${step}</li>`).join('');
  if (!hopStepsHtml) {
    hopStepsHtml = '<li>Inga humletillsatser under koket.</li>';
  }

  let dryHopsHtml = '';
  if (dryHops.length > 0) {
    dryHopsHtml = dryHops.map(h => `<li><strong>${h.amount} g ${escapeHtml(h.name)}</strong></li>`).join('');
  }

  const recipeNotesHtml = State.recipe.notes ? `
    <div class="print-section">
      <h3>📝 Receptanteckningar</h3>
      <p style="font-style: italic; font-size: 8.5pt; color: #444; white-space: pre-wrap; margin: 0;">${escapeHtml(State.recipe.notes)}</p>
    </div>
  ` : '';

  printContainer.innerHTML = `
    <div class="print-header">
      <div class="print-title-area">
        <span class="print-app-logo">🧪 Brygglabbet</span>
        <h1>${escapeHtml(State.recipe.name || 'Namnlöst Recept')}</h1>
        <div class="print-recipe-style">${styleName}</div>
      </div>
      <div class="print-meta-date">Utskrift: ${todayStr}</div>
    </div>

    <div class="print-metrics-row">
      <div class="metric-item"><strong>OG</strong><br>${formatSG(ogRes.sg)} (${ogRes.plato.toFixed(1)}°P)</div>
      <div class="metric-item"><strong>FG</strong><br>${formatSG(fgRes.sg)} (${fgRes.plato.toFixed(1)}°P)</div>
      <div class="metric-item"><strong>ABV</strong><br>${abvRes.abv.toFixed(1)}%</div>
      <div class="metric-item"><strong>Beska</strong><br>${ibuRes.total.toFixed(0)} IBU</div>
      <div class="metric-item"><strong>Färg</strong><br>${ebcRes.ebc.toFixed(0)} EBC</div>
      <div class="metric-item"><strong>Batchvolym</strong><br>${State.recipe.batchVolume} L</div>
    </div>

    <div class="print-content-layout">
      <div class="print-sidebar">
        <div class="print-section">
          <h3>📋 Receptdetaljer</h3>
          <ul class="print-list">
            <li><strong>Effektivitet:</strong> ${State.recipe.efficiency}%</li>
            <li><strong>Koktid:</strong> ${State.recipe.boilTime} min</li>
          </ul>
        </div>
        
        <div class="print-section">
          <h3>🌾 Malt & Råvaror</h3>
          <ul class="print-list">
            ${fermentablesHtml}
          </ul>
        </div>

        <div class="print-section">
          <h3>🌿 Humlegivor</h3>
          <ul class="print-list">
            ${hopsHtml}
          </ul>
        </div>

        <div class="print-section">
          <h3>🧫 Jäst</h3>
          <ul class="print-list">
            ${yeastHtml}
          </ul>
        </div>
        
        ${saltsList ? `
        <div class="print-section">
          <h3>💧 Vattenbehandling</h3>
          <ul class="print-list">
            ${saltsList}
          </ul>
        </div>
        ` : ''}

        ${recipeNotesHtml}
      </div>

      <div class="print-main">
        <div class="print-section">
          <h3>🍳 Steg-för-steg instruktioner</h3>
          <ol class="print-steps-list">
            <li>
              <strong>Mäskning</strong>
              <p>Värm <strong>${vols.mashWater.toFixed(1)} L</strong> vatten till ca <strong>${strikeTemp}°C</strong> (strike-temperatur).</p>
              <p>Mäska in malten och utför följande steg:</p>
              <ul class="print-substeps">
                ${mashStepsHtml}
              </ul>
            </li>
            <li>
              <strong>Lakning & Pre-boil</strong>
              <p>Laka med <strong>${vols.spargeWater.toFixed(1)} L</strong> vatten vid 78°C.</p>
              <p>Samla upp cirka <strong>${vols.boilVolume.toFixed(1)} L</strong> vört i kokkärlet före kok.</p>
            </li>
            <li>
              <strong>Kokning & Humleschema</strong>
              <p>Koka vörten i totalt <strong>${State.recipe.boilTime || 60} minuter</strong> och tillsätt humle enligt schema:</p>
              <ul class="print-substeps">
                ${hopStepsHtml}
              </ul>
            </li>
            <li>
              <strong>Kylning & Jäsning</strong>
              <p>Kyl vörten till 18-20°C (eller rekommenderad jästtemperatur), lufta/syresätt och pitcha jästen.</p>
              <p>Jäs vid <strong>${State.yeast.tempMin || 18}-${State.yeast.tempMax || 22}°C</strong> i cirka 14 dagar.</p>
              ${dryHopsHtml ? `
              <p style="margin-top: 6px; margin-bottom: 2px;"><strong>Torrhumling:</strong> Tillsätt följande givor under jäsningen:</p>
              <ul class="print-substeps">
                ${dryHopsHtml}
              </ul>
              ` : ''}
            </li>
            <li>
              <strong>Flaskning / Fatning</strong>
              <p>Tillsätt socker för kolsyrejäsning (ca 5-6 g/L) vid buteljering, eller överför till fat och kolsyresätt under tryck.</p>
            </li>
          </ol>
        </div>

        <div class="print-section print-avoid-break">
          <h3>📝 Mätningar & Anteckningar</h3>
          <div class="print-notes-grid">
            <div class="notes-field"><span>Mäsk-pH:</span><div class="notes-line"></div></div>
            <div class="notes-field"><span>Pre-boil SG:</span><div class="notes-line"></div></div>
            <div class="notes-field"><span>Uppmätt OG:</span><div class="notes-line"></div></div>
            <div class="notes-field"><span>Slutvolym (L):</span><div class="notes-line"></div></div>
            <div class="notes-field"><span>Uppmätt FG:</span><div class="notes-line"></div></div>
            <div class="notes-field"><span>Flaskningsdatum:</span><div class="notes-line"></div></div>
          </div>
          <div style="margin-top: 12px;">
            <span>Egna noteringar under bryggdagen:</span>
            <div class="notes-box"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function cleanupPrintView() {
  const container = document.getElementById('print-container');
  if (container) {
    container.innerHTML = '';
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
