/**
 * Dedicated Brew Day Mode Module (Bryggdags-läge).
 * Modern wizard-style cooking app layout:
 * - Persistent/Toggled Ingredients on the left.
 * - Interactive vertical stepper on the right showing previous, active, and next steps.
 * - Integrated background timers, sound/vibration feedback, and smooth auto-scrolling.
 */

import { State } from '../state.js';
import {
  calculateOG,
  calculateFG,
  calculateABV,
  calculateIBU,
  calculateEBC,
  formatSG,
  calculateWaterVolumes,
  sgToPlato,
} from '../core/calculations.js';
import { showToast, escHtml } from './toast.js';

// Timer & Navigation state
let activeTimer = null;
let timerSecondsRemaining = 0;
let activeTimerTargetId = null;
let isTimerRunning = false;

let currentStepIndex = 0;
let isBrewdayOpen = false;

// UI Persistence state
const checkedItems = new Set();
let measuredOG = '';
let measuredPH = '';
let brewNotes = '';

/**
 * Toggles the main view between Recipe Editor and Brew Day Mode.
 * @param {Function} recalculateCallback - Callback to trigger recalculations
 */
export function toggleBrewdayView(recalculateCallback) {
  const desktopView = document.getElementById('desktop-app-view');
  const mobileView = document.getElementById('mobile-app-view');
  const brewdayView = document.getElementById('brewday-view');
  const btnToggle = document.getElementById('btn-toggle-brewday');

  if (!brewdayView) return;

  isBrewdayOpen = !isBrewdayOpen;

  if (isBrewdayOpen) {
    desktopView?.classList.add('view-hidden');
    mobileView?.classList.add('view-hidden');
    brewdayView.classList.remove('hidden');

    if (btnToggle) {
      btnToggle.classList.add('btn-primary');
      btnToggle.classList.remove('btn-secondary');
      btnToggle.innerHTML = '<span class="quick-icon">📝</span> Receptbyggaren';
    }

    // Hide mobile dropdown if open
    document.getElementById('mobile-menu-dropdown')?.classList.remove('open');
    document.getElementById('mobile-menu-backdrop')?.classList.remove('open');

    renderBrewdayContent(recalculateCallback);
    showToast('🍺 Välkommen till Bryggdagsläget!', 'info');
    
    // Smooth scroll to active card initially
    setTimeout(() => {
      const activeCard = document.querySelector('.brewday-step-card.brewday-step-active');
      if (activeCard) {
        activeCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);
  } else {
    brewdayView.classList.add('hidden');

    if (document.body.classList.contains('mobile-mode')) {
      mobileView?.classList.remove('view-hidden');
    } else {
      desktopView?.classList.remove('view-hidden');
    }

    if (btnToggle) {
      btnToggle.classList.add('btn-secondary');
      btnToggle.classList.remove('btn-primary');
      btnToggle.innerHTML = '<span class="quick-icon">🍺</span> Bryggdag';
    }
  }
}

/**
 * Formats seconds to mm:ss format.
 * @param {number} totalSecs 
 * @returns {string}
 */
function formatSeconds(totalSecs) {
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Triggers alarm audio (synthesized beep) and device vibration.
 */
function playAlarmNotification() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    let time = ctx.currentTime;
    
    // Play 3 pulsing electronic beeps
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, time); // A5 note
      
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.4, time + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
      
      osc.start(time);
      osc.stop(time + 0.4);
      
      time += 0.5; // space beeps out
    }
  } catch (err) {
    console.warn('AudioContext failed:', err);
  }

  // Device vibration pattern (Vibrate 300ms, Pause 100ms, repeat)
  if (navigator.vibrate) {
    navigator.vibrate([300, 100, 300, 100, 300]);
  }
}

/**
 * Updates a small background timer indicator in the header bar if a timer is running.
 */
function updateHeaderTimerIndicator() {
  const container = document.getElementById('brewday-header-timer-container');
  if (!container) return;

  if (isTimerRunning && timerSecondsRemaining > 0) {
    container.innerHTML = `
      <div class="brewday-header-timer" title="En timer räknar ner i bakgrunden">
        <span class="timer-pulse-dot running"></span>
        <span>Aktiv timer: <strong>${formatSeconds(timerSecondsRemaining)}</strong></span>
      </div>
    `;
  } else if (timerSecondsRemaining === 0 && activeTimerTargetId && !isTimerRunning) {
    container.innerHTML = `
      <div class="brewday-header-timer" style="border-color: #10b981; color: #10b981;">
        <span class="timer-pulse-dot" style="background: #10b981; box-shadow: none;"></span>
        <span><strong>⏰ Timer klar!</strong></span>
      </div>
    `;
  } else {
    container.innerHTML = '';
  }
}

/**
 * Renders the 2-column Brew Day view with step wizard.
 * @param {Function} recalculateCallback - Recalculate callback
 */
export function renderBrewdayContent(recalculateCallback) {
  const container = document.getElementById('brewday-view');
  if (!container) return;

  // Correct parameters: (equipment, fermentables, boilTime)
  const waterVols = calculateWaterVolumes(
    State.equipment || {},
    State.fermentables || [],
    State.recipe.boilTime || 60
  );

  const ogRes = calculateOG(State.fermentables || [], State.recipe.batchVolume || 20, State.recipe.efficiency || 75);
  const fg_sg = calculateFG(ogRes.sg, ((State.yeast?.attMin || 72) + (State.yeast?.attMax || 78)) / 2);
  const fg_plato = sgToPlato(fg_sg);
  const abv = calculateABV(ogRes.sg, fg_sg);
  const ibuRes = calculateIBU(State.hops || [], ogRes.sg, State.recipe.batchVolume || 20);
  const ebcRes = calculateEBC(State.fermentables || [], State.recipe.batchVolume || 20);

  // Define steps
  const steps = [];

  // Step 1: Prep & Water
  steps.push({
    title: '💧 Förberedelse & Vattenbehandling',
    render: () => {
      const saltsList = Object.entries(State.water?.salts || {})
        .filter(([_, val]) => Number(val) > 0)
        .map(([salt, val]) => {
          const translation = {
            gypsum: 'Gips (CaSO₄)',
            calciumChloride: 'Kalciumklorid (CaCl₂)',
            epsomSalt: 'Epsomsalt (MgSO₄)',
            tableSalt: 'Bordssalt (NaCl)',
            chalk: 'Krita (CaCO₃)',
            bakingSoda: 'Bikarbonat (NaHCO₃)',
          };
          const saltId = `step-salt-${salt}`;
          return `<li><label><input type="checkbox" id="${saltId}" ${checkedItems.has(saltId) ? 'checked' : ''}> <span>Mät upp <strong>${Number(val).toFixed(1)} g</strong> ${translation[salt] || salt}</span></label></li>`;
        }).join('');

      return `
        <p>Värm <strong>${waterVols.mashWater.toFixed(1)} L</strong> mäskvatten till ca <strong>${((State.mash[0]?.temp || 67) + 4).toFixed(1)}°C</strong> (strike-temperatur).</p>
        <p>Förbered också <strong>${waterVols.spargeWater.toFixed(1)} L</strong> lakvatten och värm till ~76-78°C.</p>
        ${saltsList ? `
          <p style="margin-top:12px; margin-bottom:6px;"><strong>Bryggsalter:</strong></p>
          <ul class="brewday-step-inner-checklist">
            ${saltsList}
          </ul>
        ` : ''}
        <div style="margin-top:16px;">
          <label class="brewday-done-check">
            <input type="checkbox" id="step-prep-ready" ${checkedItems.has('step-prep-ready') ? 'checked' : ''}> 
            <span>Mäskvatten och lakvatten är redo</span>
          </label>
        </div>
      `;
    }
  });

  // Steps 2..N: Mash Schedule Steps
  const mashSchedule = State.mash && State.mash.length > 0 ? State.mash : [{ id: 1, name: 'Sackarifikation', temp: 67, time: 60, type: 'Infusion' }];
  mashSchedule.forEach((m, idx) => {
    steps.push({
      title: `♨️ Mäskning: ${escHtml(m.name)}`,
      render: () => {
        const timerId = `timer-display-mash-${idx}`;
        const isCurrentActiveTimer = activeTimerTargetId === timerId;
        const currentVal = isCurrentActiveTimer ? formatSeconds(timerSecondsRemaining) : `${m.time}:00`;
        const startBtnText = isCurrentActiveTimer && isTimerRunning ? '⏸️ Pausa' : (isCurrentActiveTimer && timerSecondsRemaining > 0 ? '▶ Fortsätt' : '▶ Starta');
        const startBtnClass = isCurrentActiveTimer && isTimerRunning ? 'btn-warning running' : 'btn-primary';

        return `
          <p>Blanda i (mäska in) all krossad malt under omrörning. Håll sedan mäsken vid <strong>${m.temp}°C</strong> i <strong>${m.time} min</strong> (${m.type || 'Infusion'}).</p>
          <div class="brewday-timer-block">
            <div class="brewday-timer-header"><strong>Timer:</strong> ${escHtml(m.name)}</div>
            <div class="brewday-timer-controls">
              <div class="timer-display" id="${timerId}">${currentVal}</div>
              <button class="btn btn-sm ${startBtnClass} btn-start-timer" data-time="${m.time * 60}" data-target="${timerId}">
                ${startBtnText}
              </button>
              <button class="btn btn-sm btn-secondary btn-reset-timer" data-time="${m.time * 60}" data-target="${timerId}">
                🔄 Nollställ
              </button>
            </div>
          </div>
          <div style="margin-top:16px;">
            <label class="brewday-done-check">
              <input type="checkbox" id="step-mash-${idx}-ready" ${checkedItems.has(`step-mash-${idx}-ready`) ? 'checked' : ''}> 
              <span>Mäsksteg slutfört</span>
            </label>
          </div>
        `;
      }
    });
  });

  // Step N+1: Lautering & Sparging
  steps.push({
    title: '💧 Lakning & Vörtinsamling',
    render: () => {
      return `
        <p>Laka långsamt genom malten med <strong>${waterVols.spargeWater.toFixed(1)} L</strong> vatten vid ~76-78°C.</p>
        <p>Samla upp totalt cirka <strong>${State.recipe.boilVolume || 25} L</strong> vört i kokkärlet före kok startar.</p>
        <div style="margin-top:16px;">
          <label class="brewday-done-check">
            <input type="checkbox" id="step-sparge-ready" ${checkedItems.has('step-sparge-ready') ? 'checked' : ''}> 
            <span>Lakning avslutad och vört insamlad i kokkärlet</span>
          </label>
        </div>
      `;
    }
  });

  // Step N+2: Boiling & Hop Additions
  steps.push({
    title: '⚡ Vörtkok & Humlegivor',
    render: () => {
      const timerId = `timer-display-boil`;
      const isCurrentActiveTimer = activeTimerTargetId === timerId;
      const currentVal = isCurrentActiveTimer ? formatSeconds(timerSecondsRemaining) : `${State.recipe.boilTime || 60}:00`;
      const startBtnText = isCurrentActiveTimer && isTimerRunning ? '⏸️ Pausa' : (isCurrentActiveTimer && timerSecondsRemaining > 0 ? '▶ Fortsätt' : '▶ Starta');
      const startBtnClass = isCurrentActiveTimer && isTimerRunning ? 'btn-warning running' : 'btn-primary';

      const boilHops = (State.hops || []).filter(h => h.use === 'kok' || h.use === 'whirlpool');
      const hopListHtml = boilHops.map((h, i) => {
        const checkId = `step-boil-hop-${i}`;
        let useStr = '';
        if (h.use === 'kok') useStr = `vid ${h.time} min kvar`;
        else useStr = `vid whirlpool / kokslut`;
        return `<li><label><input type="checkbox" id="${checkId}" ${checkedItems.has(checkId) ? 'checked' : ''}> <span>Tillsätt <strong>${h.amount} g ${escHtml(h.name)}</strong> (${useStr})</span></label></li>`;
      }).join('');

      return `
        <p>Koka vörten kraftigt utan lock i totalt <strong>${State.recipe.boilTime || 60} minuter</strong>. Tillsätt humlen enligt schema:</p>
        <div class="brewday-timer-block">
          <div class="brewday-timer-header"><strong>Boil-Timer</strong></div>
          <div class="brewday-timer-controls">
            <div class="timer-display" id="${timerId}">${currentVal}</div>
            <button class="btn btn-sm ${startBtnClass} btn-start-timer" data-time="${(State.recipe.boilTime || 60) * 60}" data-target="${timerId}">
              ${startBtnText}
            </button>
            <button class="btn btn-sm btn-secondary btn-reset-timer" data-time="${(State.recipe.boilTime || 60) * 60}" data-target="${timerId}">
              🔄 Nollställ
            </button>
          </div>
        </div>
        ${hopListHtml ? `
          <p style="margin-top:14px; margin-bottom:6px;"><strong>Humleschema:</strong></p>
          <ul class="brewday-step-inner-checklist">
            ${hopListHtml}
          </ul>
        ` : '<p style="margin-top:10px; font-style:italic; font-size:0.85rem;">Inga humletillsatser under koket.</p>'}
      `;
    }
  });

  // Step N+3: Chilling & Fermentation Pitching
  steps.push({
    title: '❄️ Kylning & Jästtillsats',
    render: () => {
      const dryHops = (State.hops || []).filter(h => h.use === 'torrhumle' || h.use === 'dry-hop');
      const dryHopsHtml = dryHops.map((h, i) => {
        const checkId = `step-dry-hop-${i}`;
        return `<li><label><input type="checkbox" id="${checkId}" ${checkedItems.has(checkId) ? 'checked' : ''}> <span>Mät upp <strong>${h.amount} g ${escHtml(h.name)}</strong> för torrhumling under jäsningen</span></label></li>`;
      }).join('');

      return `
        <p>Kyl vörten så snabbt som möjligt till jästemperatur (ca <strong>18-20°C</strong>).</p>
        <p>Överför vörten till ett desinficerat jäskärl, lufta vörten kraftigt för att tillföra syre, och tillsätt jästen: <strong>${escHtml(State.yeast?.name || 'Ej angiven jäst')}</strong>.</p>
        <p>Placera jäskärlet i ett utrymme med temperatur på <strong>${State.yeast?.tempMin || 18}–${State.yeast?.tempMax || 22}°C</strong>.</p>
        ${dryHopsHtml ? `
          <p style="margin-top:14px; margin-bottom:6px;"><strong>Kommande torrhumling:</strong></p>
          <ul class="brewday-step-inner-checklist">
            ${dryHopsHtml}
          </ul>
        ` : ''}
        <div style="margin-top:16px;">
          <label class="brewday-done-check">
            <input type="checkbox" id="step-chill-ready" ${checkedItems.has('step-chill-ready') ? 'checked' : ''}> 
            <span>Kylt, jäst tillsatt och ölet står för jäsning</span>
          </label>
        </div>
      `;
    }
  });

  // Step N+4: Logging & Saving
  steps.push({
    title: '💾 Brygglogg & Slutförande',
    render: () => {
      return `
        <p>Fyll i bryggdagens faktiska mätningar för att spara dem i receptet:</p>
        <div class="card-grid-2" style="margin-top:12px">
          <div class="form-group">
            <label class="form-label" for="bd-measured-og">Faktiskt OG (Original Gravity)</label>
            <div class="input-group">
              <input type="number" inputmode="decimal" id="bd-measured-og" placeholder="t.ex. 1.055" step="0.001" value="${measuredOG}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="bd-measured-ph">Faktiskt Mäsk-pH</label>
            <div class="input-group">
              <input type="number" inputmode="decimal" id="bd-measured-ph" placeholder="t.ex. 5.30" step="0.01" value="${measuredPH}">
            </div>
          </div>
        </div>
        <div class="form-group" style="margin-top:12px">
          <label class="form-label" for="bd-notes">Bryggdagsnoteringar (anteckna avvikelser, flöde, doft etc.)</label>
          <textarea id="bd-notes" rows="4" placeholder="Hur gick bryggningen?">${escHtml(brewNotes)}</textarea>
        </div>
        <button class="btn btn-primary" id="btn-save-brewlog" style="margin-top:12px; width: 100%; justify-content: center;">
          💾 Spara bryggnoteringar i receptet
        </button>
      `;
    }
  });

  // Render main layout
  const totalSteps = steps.length;
  const progressPercent = Math.round((currentStepIndex / (totalSteps - 1)) * 100);

  const stepsHtml = steps.map((step, idx) => {
    let statusClass = 'brewday-step-inactive';
    if (idx === currentStepIndex) {
      statusClass = 'brewday-step-active';
    } else if (idx < currentStepIndex) {
      statusClass = 'brewday-step-completed';
    }

    // Only render full content for the active step, previous step, and next step to avoid clutter
    const isVisible = idx === currentStepIndex || idx === currentStepIndex - 1 || idx === currentStepIndex + 1;
    const bodyContent = isVisible
      ? step.render()
      : '<p style="font-style:italic; font-size:0.85rem; color:var(--text-secondary);">Klicka på steget för att hoppa dit.</p>';

    return `
      <div class="brewday-step-card ${statusClass}" data-step-idx="${idx}">
        <div class="brewday-step-num">${idx + 1}</div>
        <div class="brewday-step-body">
          <h4>${step.title}</h4>
          ${bodyContent}
        </div>
      </div>
    `;
  }).join('');

  const totalMaltKg = (State.fermentables || []).reduce((s, f) => s + (f.amount || 0), 0);
  const totalHopsG = (State.hops || []).reduce((s, h) => s + (h.amount || 0), 0);

  container.innerHTML = `
    <div class="brewday-header-bar">
      <div>
        <h2 class="brewday-title">🍺 BRYGGDAG: ${escHtml(State.recipe?.name || 'Namnlöst recept')}</h2>
        <div class="brewday-subtitle">
          <span>Target OG: <strong>${formatSG(ogRes.sg)}</strong> (${ogRes.plato.toFixed(1)}°P)</span> • 
          <span>Target FG: <strong>${formatSG(fg_sg)}</strong> (${fg_plato.toFixed(1)}°P)</span> • 
          <span>Target Beska: <strong>${ibuRes.total.toFixed(0)} IBU</strong></span> • 
          <span>Target Färg: <strong>${ebcRes.ebc.toFixed(0)} EBC</strong></span> • 
          <span>Est. ABV: <strong>${abv.toFixed(1)}%</strong></span>
        </div>
      </div>
      <!-- Timer indicator container -->
      <div id="brewday-header-timer-container"></div>
      <div class="brewday-tab-switch">
        <button class="btn btn-sm btn-primary brewday-mobile-tab active" data-btab="ingredients">🌾 Ingredienser</button>
        <button class="btn btn-sm btn-secondary brewday-mobile-tab" data-btab="steps">⏱️ Brygguiden</button>
      </div>
    </div>

    <div class="brewday-grid">
      <!-- LEFT COLUMN: INGREDIENTS CHECKLIST (PERSISTENT ON DESKTOP, TABBED ON MOBILE) -->
      <div class="brewday-col brewday-col-left" id="bpanel-ingredients">
        <div class="brewday-card">
          <h3 class="brewday-card-title">💧 1. Vatten & Vattenbehandling</h3>
          <div class="brewday-stat-list">
            <div class="brewday-stat-item">
              <span>Mäskvatten:</span>
              <strong>${waterVols.mashWater.toFixed(1)} L</strong>
            </div>
            <div class="brewday-stat-item">
              <span>Lakvatten:</span>
              <strong>${waterVols.spargeWater.toFixed(1)} L</strong>
            </div>
            <div class="brewday-stat-item">
              <span>Totalt Vattenbehov:</span>
              <strong>${waterVols.totalWater.toFixed(1)} L</strong>
            </div>
          </div>
          <p class="section-label" style="margin-top:10px; font-weight: bold; font-size: 0.82rem;">Bryggsalter (Totalt):</p>
          <ul class="brewday-checklist">
            <li><label><input type="checkbox" id="left-salt-gypsum" ${checkedItems.has('left-salt-gypsum') ? 'checked' : ''}> <span>Gips (CaSO₄): <strong>${State.water?.salts?.gypsum || 0} g</strong></span></label></li>
            <li><label><input type="checkbox" id="left-salt-calciumChloride" ${checkedItems.has('left-salt-calciumChloride') ? 'checked' : ''}> <span>Kalciumklorid (CaCl₂): <strong>${State.water?.salts?.calciumChloride || 0} g</strong></span></label></li>
            <li><label><input type="checkbox" id="left-salt-epsomSalt" ${checkedItems.has('left-salt-epsomSalt') ? 'checked' : ''}> <span>Epsomsalt (MgSO₄): <strong>${State.water?.salts?.epsomSalt || 0} g</strong></span></label></li>
            <li><label><input type="checkbox" id="left-salt-tableSalt" ${checkedItems.has('left-salt-tableSalt') ? 'checked' : ''}> <span>Bordssalt (NaCl): <strong>${State.water?.salts?.tableSalt || 0} g</strong></span></label></li>
            <li><label><input type="checkbox" id="left-salt-chalk" ${checkedItems.has('left-salt-chalk') ? 'checked' : ''}> <span>Krita (CaCO₃): <strong>${State.water?.salts?.chalk || 0} g</strong></span></label></li>
            <li><label><input type="checkbox" id="left-salt-bakingSoda" ${checkedItems.has('left-salt-bakingSoda') ? 'checked' : ''}> <span>Bikarbonat (NaHCO₃): <strong>${State.water?.salts?.bakingSoda || 0} g</strong></span></label></li>
          </ul>
        </div>

        <div class="brewday-card">
          <h3 class="brewday-card-title">🌾 2. Maltnota (${totalMaltKg.toFixed(2)} kg)</h3>
          ${
            !State.fermentables || State.fermentables.length === 0
              ? '<p class="text-muted" style="font-size:0.85rem">Ingen malt inlagd i receptet.</p>'
              : `<ul class="brewday-checklist">
                  ${State.fermentables
                    .map(
                      (f, i) => {
                        const id = `left-malt-${i}`;
                        return `<li><label><input type="checkbox" id="${id}" ${checkedItems.has(id) ? 'checked' : ''}> <span><strong>${f.amount} kg</strong> – ${escHtml(f.name)} <span class="badge-tag">${f.ebc} EBC</span></span></label></li>`;
                      }
                    )
                    .join('')}
                </ul>`
          }
        </div>

        <div class="brewday-card">
          <h3 class="brewday-card-title">🌿 3. Humlegivor (${totalHopsG} g)</h3>
          ${
            !State.hops || State.hops.length === 0
              ? '<p class="text-muted" style="font-size:0.85rem">Ingen humle inlagd i receptet.</p>'
              : `<ul class="brewday-checklist">
                  ${State.hops
                    .map(
                      (h, i) => {
                        const id = `left-hop-${i}`;
                        let useStr = '';
                        if (h.use === 'kok') useStr = `${h.time} min`;
                        else if (h.use === 'whirlpool') useStr = 'Whirlpool';
                        else useStr = 'Torrhumle';
                        return `<li><label><input type="checkbox" id="${id}" ${checkedItems.has(id) ? 'checked' : ''}> <span><strong>${h.amount} g</strong> – ${escHtml(h.name)} (${h.alpha}% α) @ ${useStr}</span></label></li>`;
                      }
                    )
                    .join('')}
                </ul>`
          }
        </div>

        <div class="brewday-card">
          <h3 class="brewday-card-title">🧫 4. Jäst & Jäsning</h3>
          <div class="brewday-stat-list">
            <div class="brewday-stat-item">
              <span>Jäststam:</span>
              <strong>${escHtml(State.yeast?.name || 'Ej vald')}</strong>
            </div>
            <div class="brewday-stat-item">
              <span>Jästemperatur:</span>
              <strong>${State.yeast?.tempMin || 18}°C – ${State.yeast?.tempMax || 22}°C</strong>
            </div>
          </div>
        </div>
      </div>

      <!-- RIGHT COLUMN: INTERACTIVE STEPS WIZARD -->
      <div class="brewday-col brewday-col-right" id="bpanel-steps">
        <div class="brewday-progress-container" title="Bryggdagens framsteg: ${progressPercent}%">
          <div class="brewday-progress-bar" style="width: ${progressPercent}%;"></div>
        </div>

        <div class="brewday-steps-stepper">
          ${stepsHtml}
        </div>

        <div class="brewday-wizard-nav">
          <button class="btn btn-secondary" id="btn-wizard-prev" ${currentStepIndex === 0 ? 'disabled' : ''}>
            ⬅️ Föregående
          </button>
          <div style="font-size: 0.9rem; font-weight: bold; color: var(--text-secondary);">
            Steg ${currentStepIndex + 1} av ${totalSteps}
          </div>
          <button class="btn btn-primary" id="btn-wizard-next" ${currentStepIndex === totalSteps - 1 ? 'disabled' : ''}>
            Nästa steg ➡️
          </button>
        </div>
      </div>
    </div>
  `;

  // Bind UI Events
  setupTimerControls();
  setupMobileBrewdayTabs();
  updateHeaderTimerIndicator();

  // Listen to step card clicks (jumping directly to step)
  document.querySelectorAll('.brewday-step-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      // Avoid clicks on inputs, buttons, checkboxes or textareas
      if (e.target.closest('button, input, textarea, label')) return;

      const idx = parseInt(card.dataset.stepIdx, 10);
      if (!isNaN(idx) && idx !== currentStepIndex) {
        currentStepIndex = idx;
        renderBrewdayContent(recalculateCallback);
        
        // Smooth scroll to center the active card
        setTimeout(() => {
          const activeCard = document.querySelector('.brewday-step-card.brewday-step-active');
          if (activeCard) {
            activeCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 50);
      }
    });
  });

  // Track checkboxes checked states generically
  container.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      if (cb.id) {
        if (cb.checked) {
          checkedItems.add(cb.id);
        } else {
          checkedItems.delete(cb.id);
        }
      }
    });
  });

  // Track logging input fields
  document.getElementById('bd-measured-og')?.addEventListener('input', (e) => {
    measuredOG = e.target.value;
  });
  document.getElementById('bd-measured-ph')?.addEventListener('input', (e) => {
    measuredPH = e.target.value;
  });
  document.getElementById('bd-notes')?.addEventListener('input', (e) => {
    brewNotes = e.target.value;
  });

  // Wizard Nav buttons
  document.getElementById('btn-wizard-prev')?.addEventListener('click', () => {
    if (currentStepIndex > 0) {
      currentStepIndex--;
      renderBrewdayContent(recalculateCallback);
      setTimeout(() => {
        const activeCard = document.querySelector('.brewday-step-card.brewday-step-active');
        if (activeCard) {
          activeCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
    }
  });

  document.getElementById('btn-wizard-next')?.addEventListener('click', () => {
    if (currentStepIndex < totalSteps - 1) {
      currentStepIndex++;
      renderBrewdayContent(recalculateCallback);
      setTimeout(() => {
        const activeCard = document.querySelector('.brewday-step-card.brewday-step-active');
        if (activeCard) {
          activeCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
    }
  });

  // Save brewlog notes
  document.getElementById('btn-save-brewlog')?.addEventListener('click', () => {
    let logMsg = `Bryggdag genomförd ${new Date().toLocaleDateString('sv-SE')}:`;
    if (measuredOG) logMsg += ` Uppmätt OG = ${measuredOG}.`;
    if (measuredPH) logMsg += ` Faktiskt pH = ${measuredPH}.`;
    if (brewNotes) logMsg += `\n${brewNotes}`;

    State.recipe.notes = State.recipe.notes ? `${State.recipe.notes}\n\n${logMsg}` : logMsg;
    showToast('💾 Bryggdagsnoteringar sparade i receptet!', 'success');
  });
}

/**
 * Attaches event listeners for starting, pausing and resetting timers.
 */
function setupTimerControls() {
  document.querySelectorAll('.btn-start-timer').forEach((btn) => {
    const targetId = btn.dataset.target;
    
    btn.addEventListener('click', () => {
      const targetEl = document.getElementById(targetId);
      if (!targetEl) return;

      if (isTimerRunning && activeTimerTargetId === targetId) {
        // Pause timer
        clearInterval(activeTimer);
        activeTimer = null;
        isTimerRunning = false;
        btn.classList.remove('running');
        btn.innerHTML = '▶ Fortsätt';
        btn.classList.replace('btn-warning', 'btn-primary');
        updateHeaderTimerIndicator();
      } else {
        // Start or Resume timer
        if (activeTimerTargetId !== targetId) {
          if (activeTimer) {
            clearInterval(activeTimer);
          }
          activeTimerTargetId = targetId;
          timerSecondsRemaining = parseInt(btn.dataset.time, 10) || 3600;
        } else if (timerSecondsRemaining <= 0) {
          // If restarted from 0
          timerSecondsRemaining = parseInt(btn.dataset.time, 10) || 3600;
        }

        isTimerRunning = true;
        btn.classList.add('running');
        btn.innerHTML = '⏸️ Pausa';
        btn.classList.replace('btn-primary', 'btn-warning');
        updateHeaderTimerIndicator();

        clearInterval(activeTimer);
        activeTimer = setInterval(() => {
          timerSecondsRemaining--;
          
          if (timerSecondsRemaining <= 0) {
            clearInterval(activeTimer);
            activeTimer = null;
            isTimerRunning = false;
            timerSecondsRemaining = 0;
            
            const currentTargetEl = document.getElementById(activeTimerTargetId);
            if (currentTargetEl) {
              currentTargetEl.textContent = '00:00';
            }
            btn.classList.remove('running');
            btn.innerHTML = '✅ Klart!';
            btn.classList.replace('btn-warning', 'btn-success');
            
            playAlarmNotification();
            showToast('⏰ Timern har löpt ut!', 'success');
            updateHeaderTimerIndicator();
          } else {
            const timeStr = formatSeconds(timerSecondsRemaining);
            const currentTargetEl = document.getElementById(activeTimerTargetId);
            if (currentTargetEl) {
              currentTargetEl.textContent = timeStr;
            }
            updateHeaderTimerIndicator();
          }
        }, 1000);
      }
    });
  });

  document.querySelectorAll('.btn-reset-timer').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const targetEl = document.getElementById(targetId);
      const totalSecs = parseInt(btn.dataset.time, 10) || 3600;

      if (activeTimerTargetId === targetId) {
        clearInterval(activeTimer);
        activeTimer = null;
        isTimerRunning = false;
        timerSecondsRemaining = totalSecs;
      }

      if (targetEl) {
        targetEl.textContent = formatSeconds(totalSecs);
      }

      const startBtn = document.querySelector(`.btn-start-timer[data-target="${targetId}"]`);
      if (startBtn) {
        startBtn.classList.remove('running', 'btn-warning', 'btn-success');
        startBtn.classList.add('btn-primary');
        startBtn.innerHTML = '▶ Starta';
      }
      updateHeaderTimerIndicator();
    });
  });
}

/**
 * Handles toggling mobile tabs (Ingredients vs Brewday).
 */
function setupMobileBrewdayTabs() {
  const tabs = document.querySelectorAll('.brewday-mobile-tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.btab;
      tabs.forEach((t) => {
        t.classList.remove('active', 'btn-primary');
        t.classList.add('btn-secondary');
      });
      tab.classList.add('active', 'btn-primary');
      tab.classList.remove('btn-secondary');

      const colLeft = document.getElementById('bpanel-ingredients');
      const colRight = document.getElementById('bpanel-steps');

      if (target === 'ingredients') {
        if (colLeft) colLeft.style.display = 'block';
        if (colRight) colRight.style.display = 'none';
      } else {
        if (colLeft) colLeft.style.display = 'none';
        if (colRight) colRight.style.display = 'block';
        
        // When switching to steps, smooth scroll to the active card immediately
        setTimeout(() => {
          const activeCard = document.querySelector('.brewday-step-card.brewday-step-active');
          if (activeCard) {
            activeCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 50);
      }
    });
  });
}
