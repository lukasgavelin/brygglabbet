/**
 * Dedicated Brew Day Mode Module (Bryggdags-läge).
 * Modern wizard-style cooking app layout:
 * - Persistent/Toggled Ingredients on the left.
 * - Interactive vertical stepper on the right showing previous, active, and next steps ("Gör så här").
 * - Mobile-first responsive layout with sticky bottom navigation and tab retention.
 * - Integrated background timers, sound/vibration feedback, and smooth auto-scrolling.
 */

import { State } from '../state.js';
import {
  computeRecipeMetrics,
  formatSG,
  calculateWaterProfile,
} from '../core/calculations.js';
import {
  strikeTemp,
  infusionVolume,
  pitchRate,
  yeastProfile,
  actualEfficiency,
  brixToSG,
  hydrometerTempCorrection,
  preboilCorrection,
  acidAddition,
  spargeAcid,
  ACIDS,
} from '../core/brewtools.js';
import { openToolsModal } from './tools.js';
import { showToast, escHtml } from './toast.js';
import { createBatch } from '../core/batches.js';

// Timer & Navigation state
let activeTimer = null;
let timerSecondsRemaining = 0;
let activeTimerTargetId = null;
let isTimerRunning = false;

let currentStepIndex = 0;
let isBrewdayOpen = false;
let activeMobileTab = 'steps'; // 'steps' | 'ingredients'

// UI Persistence & Brew Session state
const SESSION_STORAGE_KEY = 'brygglabbet_brew_session';

function getInitialSession() {
  return {
    preboilMode: 'sg', // 'sg' | 'brix'
    measuredPreboilGravity: '',
    sampleTempC: 20,
    measuredPreboilVol: '',
    measuredOG: '',
    measuredFermenterVol: '',
    measuredPH: '',
    brewNotes: '',
    checkedItems: [],
  };
}

const brewSession = (() => {
  try {
    const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(SESSION_STORAGE_KEY) : null;
    if (raw) return { ...getInitialSession(), ...JSON.parse(raw) };
  } catch {
    // Ignore storage read errors
  }
  return getInitialSession();
})();

const checkedItems = new Set(brewSession.checkedItems || []);
const triggeredHopAlerts = new Set();

function persistBrewSession() {
  try {
    brewSession.checkedItems = Array.from(checkedItems);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(brewSession));
    }
  } catch {
    // Ignore storage write errors
  }
}

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

    // Smooth scroll to active card initially if on steps tab
    setTimeout(() => {
      if (activeMobileTab === 'steps') {
        const activeCard = document.querySelector('.brewday-step-card.brewday-step-active');
        if (activeCard) {
          activeCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
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
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
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
    }
  } catch (err) {
    console.warn('AudioContext notification error:', err);
  }

  // Device vibration pattern (Vibrate 300ms, Pause 100ms, repeat)
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate([300, 100, 300, 100, 300]);
  }
}

/**
 * Updates small background timer indicators in header and mobile bars.
 */
function updateHeaderTimerIndicator() {
  const containers = document.querySelectorAll('.brewday-timer-indicator-slot');
  if (!containers || containers.length === 0) return;

  let htmlContent = '';
  if (isTimerRunning && timerSecondsRemaining > 0) {
    htmlContent = `
      <div class="brewday-header-timer" title="En timer räknar ner i bakgrunden">
        <span class="timer-pulse-dot running"></span>
        <span>Aktiv: <strong>${formatSeconds(timerSecondsRemaining)}</strong></span>
      </div>
    `;
  } else if (timerSecondsRemaining === 0 && activeTimerTargetId && !isTimerRunning) {
    htmlContent = `
      <div class="brewday-header-timer completed" title="Timern har löpt ut!">
        <span class="timer-pulse-dot completed"></span>
        <span><strong>⏰ Timer klar!</strong></span>
      </div>
    `;
  }

  containers.forEach((c) => {
    c.innerHTML = htmlContent;
  });
}

/**
 * Calculates and updates the pre-boil status and guidance box in-place.
 * @param {object} metrics - Computed recipe metrics
 */
function renderPreboilResult(metrics) {
  const container = document.getElementById('bd-preboil-result');
  if (!container) return;

  const gravStr = brewSession.measuredPreboilGravity;
  if (!gravStr) {
    container.innerHTML = `
      <div class="tool-hint" style="margin-top:10px; color:var(--text-secondary); font-size:0.83rem;">
        Mata in uppmätt gravitet (SG eller Brix) och volym för att få förutsägelse av slutligt OG samt ev. korrigeringsförslag (koktid, socker eller spädning).
      </div>
    `;
    return;
  }

  const numVal = parseFloat(String(gravStr).replace(',', '.'));
  if (!Number.isFinite(numVal) || numVal <= 0) {
    container.innerHTML = '';
    return;
  }

  const rawSG = brewSession.preboilMode === 'brix' ? brixToSG(numVal) : numVal;
  if (rawSG < 1.0) {
    container.innerHTML = '<div class="tool-hint" style="margin-top:8px; color:var(--warning);">Ogiltig förkoksgravitet (måste vara minst 1.000).</div>';
    return;
  }

  const tempNum = Number.isFinite(Number(brewSession.sampleTempC)) ? Number(brewSession.sampleTempC) : 20;
  const correctedSG = hydrometerTempCorrection(rawSG, tempNum, 20);
  const volNum = parseFloat(String(brewSession.measuredPreboilVol).replace(',', '.')) || metrics.preboilVolume;

  const corr = preboilCorrection({
    measuredSG: correctedSG,
    measuredVolL: volNum,
    targetOG: metrics.og,
    boilTimeMin: State.recipe.boilTime || 60,
    boilOffRateLph: State.equipment?.boilOffRate || 3.0,
    toleranceGU: 2,
  });

  const tempNote = tempNum !== 20 ? ` (tempkorrigerad från ${tempNum}°C till 20°C: <strong>${formatSG(correctedSG)}</strong>)` : '';
  let statusHtml = '';

  if (corr.status === 'ok') {
    statusHtml = `
      <div style="margin-top:12px; padding:12px; background:rgba(16, 185, 129, 0.12); border:1px solid rgba(16, 185, 129, 0.35); border-radius:var(--radius);">
        <div style="font-weight:700; color:#10b981; margin-bottom:4px;">✅ Perfekt på spåret!</div>
        <div style="font-size:0.88rem;">Förväntat OG vid kokslut: <strong>${formatSG(corr.predictedOG)}</strong> (Mål: ${formatSG(metrics.og)})${tempNote}.</div>
        <div style="font-size:0.82rem; color:var(--text-secondary); margin-top:2px;">Förväntad vörtvolym efter kok: ca ${corr.postBoilVolL.toFixed(1)} L.</div>
      </div>
    `;
  } else if (corr.status === 'low') {
    statusHtml = `
      <div style="margin-top:12px; padding:12px; background:rgba(245, 158, 11, 0.12); border:1px solid rgba(245, 158, 11, 0.35); border-radius:var(--radius);">
        <div style="font-weight:700; color:#f59e0b; margin-bottom:4px;">⚠️ Beräknat OG är lägre än målet</div>
        <div style="font-size:0.88rem;">Förväntat OG: <strong>${formatSG(corr.predictedOG)}</strong> (Mål: ${formatSG(metrics.og)})${tempNote}.</div>
        <div style="margin-top:8px; font-size:0.85rem;"><strong>Åtgärdsförslag för att nå målet:</strong></div>
        <ul style="margin:6px 0 0 16px; padding:0; font-size:0.84rem; display:flex; flex-direction:column; gap:4px;">
          ${corr.extendBoilMin > 0 ? `<li><strong>Koka ${corr.extendBoilMin} min längre</strong> (totalt ${(State.recipe.boilTime || 60) + corr.extendBoilMin} min koktid, ger ca ${corr.volumeAfterExtendedBoilL.toFixed(1)} L vört).</li>` : ''}
          <li><strong>Tillsätt ${corr.sugarG} g strösocker</strong> (eller <strong>${corr.dmeG} g DME</strong>) under koket.</li>
        </ul>
      </div>
    `;
  } else if (corr.status === 'high') {
    statusHtml = `
      <div style="margin-top:12px; padding:12px; background:rgba(59, 130, 246, 0.12); border:1px solid rgba(59, 130, 246, 0.35); border-radius:var(--radius);">
        <div style="font-weight:700; color:#3b82f6; margin-bottom:4px;">ℹ️ Beräknat OG är högre än målet</div>
        <div style="font-size:0.88rem;">Förväntat OG: <strong>${formatSG(corr.predictedOG)}</strong> (Mål: ${formatSG(metrics.og)})${tempNote}.</div>
        <div style="margin-top:8px; font-size:0.85rem;"><strong>Åtgärdsförslag:</strong></div>
        <div style="font-size:0.84rem; margin-top:4px;">
          ${corr.diluteL > 0 ? `Späd vörten med <strong>${corr.diluteL.toFixed(1)} L vatten</strong> före eller under koket för att träffa målvolym och gravitet.` : 'Ingen spädning krävs.'}
        </div>
      </div>
    `;
  }

  container.innerHTML = statusHtml;
}

/**
 * Calculates and updates actual brewhouse efficiency box in-place.
 * @param {object} metrics - Computed recipe metrics
 * @param {Function} recalculateCallback - State recalculate callback
 */
function renderEfficiencyResult(metrics, recalculateCallback) {
  const container = document.getElementById('bd-eff-result');
  if (!container) return;

  const ogNum = parseFloat(String(brewSession.measuredOG).replace(',', '.'));
  const volNum = parseFloat(String(brewSession.measuredFermenterVol).replace(',', '.')) || metrics.batchVolume;

  if (ogNum > 1 && volNum > 0) {
    const eff = actualEfficiency(State.fermentables, ogNum, volNum);
    if (eff > 0) {
      container.innerHTML = `
        <div class="brewday-eff-box" style="margin-top:14px; padding:12px 14px; background:var(--bg-secondary); border-radius:var(--radius); border:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div>
            <div style="font-size:0.82rem; color:var(--text-secondary);">Faktisk brygghuseffektivitet:</div>
            <div style="font-size:1.25rem; font-weight:800; color:var(--accent);">${eff.toFixed(1)}%</div>
            <div style="font-size:0.78rem; color:var(--text-secondary);">Planerad i utrustningsprofil: ${metrics.efficiency}%</div>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-update-profile-eff">
            ⚙️ Sätt profil till ${eff.toFixed(1)}%
          </button>
        </div>
      `;

      document.getElementById('btn-update-profile-eff')?.addEventListener('click', () => {
        State.equipment.efficiency = eff;
        State.recipe.efficiency = eff;
        recalculateCallback();
        renderEfficiencyResult(computeRecipeMetrics(State), recalculateCallback);
        showToast(`Utrustningsprofil och recept uppdaterades till ${eff.toFixed(1)}% effektivitet!`, 'success');
      });
      return;
    }
  }

  container.innerHTML = '';
}

/**
 * Renders the responsive Brew Day cooking wizard view.
 * @param {Function} recalculateCallback - Recalculate callback
 */
export function renderBrewdayContent(recalculateCallback) {
  const container = document.getElementById('brewday-view');
  if (!container) return;

  const metrics = computeRecipeMetrics(State);
  const waterVols = metrics.volumes;

  const ogRes = { sg: metrics.og, plato: metrics.plato };
  const fg_sg = metrics.fg;
  const abv = metrics.abv;
  const ibuRes = { total: metrics.ibu, perHop: metrics.ibuPerHop };
  const ebcRes = { ebc: metrics.ebc };

  // Calculate strike temperature and acid additions
  const mashTemp = State.mash && State.mash.length > 0 ? State.mash[0].temp : 67;
  const grainTemp = State.equipment?.grainTemp ?? 18;
  const mashRatio = State.equipment?.mashRatio || 3.0;
  const calculatedStrikeTemp = strikeTemp({
    mashTempC: mashTemp,
    grainTempC: grainTemp,
    ratioLPerKg: mashRatio,
    tunLossC: 0,
  });

  const acidConfig = State.water?.acid || {};
  let mashAcid = { ml: 0 };
  let spargeAcidRes = { ml: 0 };
  let acidLabel = '';
  if (acidConfig.enabled) {
    const waterResult = calculateWaterProfile(
      State.water?.base || {},
      State.water?.salts || {},
      State.water?.volume || 25
    );
    mashAcid = acidAddition({
      waterProfile: waterResult,
      fermentables: State.fermentables,
      mashRatio,
      targetPH: acidConfig.targetPH ?? 5.4,
      acid: acidConfig.type || 'lactic',
      strengthPct: acidConfig.strength ?? 80,
    });
    const spargeL = waterVols.spargeWater || 0;
    if (acidConfig.treatSparge && spargeL > 0) {
      spargeAcidRes = spargeAcid({
        hco3: waterResult.hco3,
        spargeL,
        targetPH: 5.7,
        acid: acidConfig.type || 'lactic',
        strengthPct: acidConfig.strength ?? 80,
      });
    }
    acidLabel = `${ACIDS[acidConfig.type]?.label || 'Mjölksyra'} ${acidConfig.strength ?? 80} %`;
  }

  const totalGrainKg = (State.fermentables || [])
    .filter((f) => f.type !== 'sugar')
    .reduce((s, f) => s + (f.amount || 0), 0);

  const yeastProf = yeastProfile(State.yeast);
  const pitch = pitchRate({
    og: metrics.og,
    volumeL: metrics.batchVolume,
    type: yeastProf.type,
    form: yeastProf.form,
    packSizeG: yeastProf.packSizeG,
  });

  const saltTranslation = {
    gypsum: 'Gips (CaSO₄)',
    calciumChloride: 'Kalciumklorid (CaCl₂)',
    epsomSalt: 'Epsomsalt (MgSO₄)',
    tableSalt: 'Bordssalt (NaCl)',
    chalk: 'Krita (CaCO₃)',
    bakingSoda: 'Bikarbonat (NaHCO₃)',
  };

  const saltsList = Object.entries(State.water?.salts || {})
    .filter(([_, val]) => Number(val) > 0)
    .map(([salt, val]) => {
      const saltId = `step-salt-${salt}`;
      return `<li><label><input type="checkbox" id="${saltId}" ${checkedItems.has(saltId) ? 'checked' : ''}> <span>Mät upp <strong>${Number(val).toFixed(1)} g</strong> ${saltTranslation[salt] || salt}</span></label></li>`;
    }).join('');

  const leftSaltsList = Object.entries(State.water?.salts || {})
    .filter(([_, val]) => Number(val) > 0)
    .map(([salt, val]) => {
      const saltId = `left-salt-${salt}`;
      return `<li><label><input type="checkbox" id="${saltId}" ${checkedItems.has(saltId) ? 'checked' : ''}> <span>${saltTranslation[salt] || salt}: <strong>${Number(val).toFixed(1)} g</strong></span></label></li>`;
    }).join('');

  // Define steps
  const steps = [];

  // Step 1: Prep & Water
  steps.push({
    title: '💧 Förberedelse & Vattenbehandling',
    render: () => {

      const acidChecklist = [];
      if (acidConfig.enabled) {
        if (mashAcid.ml > 0) {
          acidChecklist.push(`<li><label><input type="checkbox" id="step-acid-mash" ${checkedItems.has('step-acid-mash') ? 'checked' : ''}> <span>Mät upp <strong>${mashAcid.ml.toFixed(1)} ml</strong> ${acidLabel} till mäskvattnet (för mål-pH ${acidConfig.targetPH})</span></label></li>`);
        }
        if (spargeAcidRes.ml > 0) {
          acidChecklist.push(`<li><label><input type="checkbox" id="step-acid-sparge" ${checkedItems.has('step-acid-sparge') ? 'checked' : ''}> <span>Mät upp <strong>${spargeAcidRes.ml.toFixed(1)} ml</strong> ${acidLabel} till lakvattnet (pH ≈ 5,7)</span></label></li>`);
        }
      }

      return `
        <p>Värm <strong>${waterVols.mashWater.toFixed(1)} L</strong> mäskvatten till <strong>${calculatedStrikeTemp.toFixed(1)}°C</strong> (strike-temperatur vid ${grainTemp}°C malt och mäskförhållande ${mashRatio.toFixed(1)} L/kg).</p>
        <p>Förbered också <strong>${waterVols.spargeWater.toFixed(1)} L</strong> lakvatten och värm till ~76–78°C.</p>
        ${saltsList || acidChecklist.length > 0 ? `
          <p style="margin-top:12px; margin-bottom:6px;"><strong>Vattenbehandling (salter & syra):</strong></p>
          <ul class="brewday-step-inner-checklist">
            ${saltsList}
            ${acidChecklist.join('')}
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

        let infusionNotice = '';
        if (idx > 0) {
          const prevStep = mashSchedule[idx - 1];
          if (m.temp > prevStep.temp) {
            const infVol = infusionVolume({
              currentTempC: prevStep.temp,
              targetTempC: m.temp,
              grainKg: totalGrainKg,
              mashWaterL: waterVols.mashWater,
              infusionTempC: 100,
            });
            infusionNotice = `
              <div class="brewday-infusion-hint" style="margin-top:10px; margin-bottom:12px; padding:10px 12px; background:var(--bg-secondary); border-left:3px solid var(--accent); border-radius:var(--radius-sm); font-size:0.86rem;">
                💡 <strong>Temperatursteg (${prevStep.temp}°C → ${m.temp}°C):</strong> Tillsätt ca <strong>${infVol.toFixed(1)} L</strong> kokande vatten (100°C) under omrörning (eller värm direkt med bryggverkets element).
              </div>
            `;
          }
        }

        return `
          <p>Blanda i (mäska in) all krossad malt under omrörning. Håll sedan mäsken vid <strong>${m.temp}°C</strong> i <strong>${m.time} min</strong> (${m.type || 'Infusion'}).</p>
          ${infusionNotice}
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

  // Step N+1: Lautering & Sparging / Pre-boil
  steps.push({
    title: '💧 Lakning & Vörtkontroll före kok',
    render: () => {
      const mode = brewSession.preboilMode || 'sg';
      const gravPlaceholder = mode === 'sg' ? formatSG(metrics.preboilSG) : metrics.preboilPlato.toFixed(1);
      const isBrix = mode === 'brix';

      return `
        <p>Laka långsamt genom malten med <strong>${waterVols.spargeWater.toFixed(1)} L</strong> vatten vid ~76–78°C.</p>
        <p>Planerat före kok: <strong>${metrics.preboilVolume.toFixed(1)} L</strong> vört vid <strong>${formatSG(metrics.preboilSG)}</strong> (${metrics.preboilPlato.toFixed(1)} °P).</p>

        <div style="margin-top:14px; padding:14px; background:var(--bg-secondary); border-radius:var(--radius); border:1px solid var(--border);">
          <div style="font-weight:700; font-size:0.92rem; margin-bottom:8px;">📊 Mätning före kok (gravitet & volym)</div>
          <div class="card-grid-3">
            <div class="form-group">
              <label class="form-label" for="bd-preboil-mode">Enhet</label>
              <select id="bd-preboil-mode" style="width:100%;">
                <option value="sg" ${!isBrix ? 'selected' : ''}>SG (Hydrometer)</option>
                <option value="brix" ${isBrix ? 'selected' : ''}>°Brix (Refraktometer)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="bd-preboil-grav">${isBrix ? 'Uppmätt °Brix' : 'Uppmätt SG'}</label>
              <input type="number" inputmode="decimal" id="bd-preboil-grav" placeholder="t.ex. ${gravPlaceholder}" step="${isBrix ? '0.1' : '0.001'}" value="${escHtml(brewSession.measuredPreboilGravity)}">
            </div>
            <div class="form-group">
              <label class="form-label" for="bd-preboil-temp">Provtemp (°C)</label>
              <input type="number" inputmode="decimal" id="bd-preboil-temp" placeholder="20" step="1" value="${brewSession.sampleTempC ?? 20}">
            </div>
          </div>
          <div class="form-group" style="margin-top:8px;">
            <label class="form-label" for="bd-preboil-vol">Uppmätt volym i kokkärlet (L)</label>
            <input type="number" inputmode="decimal" id="bd-preboil-vol" placeholder="t.ex. ${metrics.preboilVolume.toFixed(1)}" step="0.5" value="${escHtml(brewSession.measuredPreboilVol)}">
          </div>
          <div id="bd-preboil-result"></div>
        </div>

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
        if (h.use === 'kok') {
          useStr = `vid ${h.time} min kvar`;
        } else {
          const wpTemp = h.whirlpoolTemp || 85;
          const wpTime = h.time || 15;
          useStr = `vid whirlpool (${wpTemp}°C, ${wpTime} min)`;
        }
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
        <div style="margin-top:16px;">
          <label class="brewday-done-check">
            <input type="checkbox" id="step-boil-ready" ${checkedItems.has('step-boil-ready') ? 'checked' : ''}> 
            <span>Vörtkok och humlegivor slutförda</span>
          </label>
        </div>
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

      const pitchText = yeastProf.form === 'dry'
        ? `Beräknad jästmängd: <strong>${pitch.packs} st påse${pitch.packs > 1 ? 'ar' : ''}</strong> (${pitch.grams} g torrjäst, ~${pitch.cellsNeededB} mdr celler).`
        : `Beräknat cellbehov: <strong>~${pitch.cellsNeededB} mdr celler</strong> (${pitch.packs} st färsk förpackning${pitch.packs > 1 ? 'ar' : ''} eller förkultur).`;

      return `
        <p>Kyl vörten så snabbt som möjligt till jästemperatur (ca <strong>18–20°C</strong>).</p>
        <p>Överför vörten till ett desinficerat jäskärl, lufta vörten kraftigt för att tillföra syre, och tillsätt jästen: <strong>${escHtml(State.yeast?.name || 'Ej angiven jäst')}</strong>.</p>
        <div style="margin:10px 0; padding:10px 12px; background:var(--bg-secondary); border-radius:var(--radius-sm); font-size:0.86rem;">
          <div>🧫 ${pitchText}</div>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-open-yeast-tool-step" style="margin-top:8px;">
            🧫 Öppna Jäst- & Förkulturverktyg
          </button>
        </div>
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
        <p>Fyll i bryggdagens faktiska mätningar för att spara dem i receptet och beräkna faktisk effektivitet:</p>
        <div class="card-grid-2" style="margin-top:12px">
          <div class="form-group">
            <label class="form-label" for="bd-measured-og">Faktiskt OG (Original Gravity)</label>
            <div class="input-group">
              <input type="number" inputmode="decimal" id="bd-measured-og" placeholder="t.ex. ${formatSG(metrics.og)}" step="0.001" value="${escHtml(brewSession.measuredOG)}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="bd-measured-vol">Volym i jäskärlet (L)</label>
            <div class="input-group">
              <input type="number" inputmode="decimal" id="bd-measured-vol" placeholder="t.ex. ${metrics.batchVolume.toFixed(1)}" step="0.5" value="${escHtml(brewSession.measuredFermenterVol)}">
            </div>
          </div>
        </div>
        <div class="card-grid-2" style="margin-top:10px">
          <div class="form-group">
            <label class="form-label" for="bd-measured-ph">Faktiskt Mäsk-pH</label>
            <div class="input-group">
              <input type="number" inputmode="decimal" id="bd-measured-ph" placeholder="t.ex. 5.30" step="0.01" value="${escHtml(brewSession.measuredPH)}">
            </div>
          </div>
        </div>
        <div id="bd-eff-result"></div>
        <div class="form-group" style="margin-top:12px">
          <label class="form-label" for="bd-notes">Bryggdagsnoteringar (anteckna avvikelser, flöde, doft etc.)</label>
          <textarea id="bd-notes" rows="4" placeholder="Hur gick bryggningen?">${escHtml(brewSession.brewNotes)}</textarea>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px; margin-top:12px;">
          <button class="btn btn-success" id="btn-save-as-batch" style="background:#10b981; color:#fff; border:none; padding:10px 14px; font-weight:bold; justify-content:center;">
            📒 Spara som ny batch i Mina bryggningar
          </button>
          <button class="btn btn-secondary" id="btn-save-brewlog" style="justify-content:center;">
            💾 Spara noteringar i receptet
          </button>
        </div>
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

    // Only render full content for active, previous and next step
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

  // Determine grid mode class for responsive tab switching
  const gridModeClass = `show-${activeMobileTab}`;

  container.innerHTML = `
    <!-- Top Header Bar -->
    <div class="brewday-header-bar">
      <div class="brewday-header-top-row">
        <button class="btn btn-secondary btn-sm" id="btn-close-brewday-header" title="Avsluta bryggdag och återgå till receptet">
          ← Recept
        </button>
        <h2 class="brewday-title">🍺 BRYGGDAG: ${escHtml(State.recipe?.name || 'Namnlöst recept')}</h2>
        <div class="brewday-timer-indicator-slot"></div>
      </div>

      <!-- Quick Metrics Strip -->
      <div class="brewday-subtitle-chips">
        <span class="chip">OG: <strong>${formatSG(ogRes.sg)}</strong></span>
        <span class="chip">FG: <strong>${formatSG(fg_sg)}</strong></span>
        <span class="chip">IBU: <strong>${ibuRes.total.toFixed(0)}</strong></span>
        <span class="chip">EBC: <strong>${ebcRes.ebc.toFixed(0)}</strong></span>
        <span class="chip">ABV: <strong>${abv.toFixed(1)}%</strong></span>
      </div>

      <!-- Segmented Tab Switcher (Mobile Cooking Layout) -->
      <div class="brewday-tab-switch-wrap">
        <div class="brewday-segmented-control">
          <button class="brewday-seg-btn ${activeMobileTab === 'steps' ? 'active' : ''}" data-btab="steps">
            ⏱️ Gör så här <span class="badge-step-count">Steg ${currentStepIndex + 1}/${totalSteps}</span>
          </button>
          <button class="brewday-seg-btn ${activeMobileTab === 'ingredients' ? 'active' : ''}" data-btab="ingredients">
            🌾 Ingredienser
          </button>
        </div>
      </div>
    </div>

    <div class="brewday-grid ${gridModeClass}">
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
          ${leftSaltsList ? `
            <p class="section-label" style="margin-top:10px; font-weight: bold; font-size: 0.82rem;">Bryggsalter (Totalt):</p>
            <ul class="brewday-checklist">
              ${leftSaltsList}
            </ul>
          ` : ''}
          ${acidConfig.enabled && (mashAcid.ml > 0 || spargeAcidRes.ml > 0) ? `
            <p class="section-label" style="margin-top:10px; font-weight: bold; font-size: 0.82rem;">Syrajustering:</p>
            <ul class="brewday-checklist">
              ${mashAcid.ml > 0 ? `<li><label><input type="checkbox" id="left-acid-mash" ${checkedItems.has('left-acid-mash') ? 'checked' : ''}> <span>Mäskvatten: <strong>${mashAcid.ml.toFixed(1)} ml</strong> ${acidLabel}</span></label></li>` : ''}
              ${spargeAcidRes.ml > 0 ? `<li><label><input type="checkbox" id="left-acid-sparge" ${checkedItems.has('left-acid-sparge') ? 'checked' : ''}> <span>Lakvatten: <strong>${spargeAcidRes.ml.toFixed(1)} ml</strong> ${acidLabel}</span></label></li>` : ''}
            </ul>
          ` : ''}
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
                        else if (h.use === 'whirlpool') {
                          const wpTemp = h.whirlpoolTemp || 85;
                          const wpTime = h.time || 15;
                          useStr = `Whirlpool (${wpTemp}°C, ${wpTime} min)`;
                        }
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
            <div class="brewday-stat-item">
              <span>Rek. giva:</span>
              <strong>${pitch.packs} st påse${pitch.packs > 1 ? 'ar' : ''} (${yeastProf.form === 'dry' ? `${pitch.grams} g` : 'flytande'})</strong>
            </div>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-open-yeast-tool-panel" style="margin-top:10px; width:100%; justify-content:center;">
            🧫 Jäst- & Förkulturverktyg
          </button>
        </div>

        <!-- Quick Switch Button on mobile when reviewing ingredients -->
        <button class="btn btn-primary btn-block mobile-only-btn" id="btn-switch-to-steps-bottom" style="margin-top:10px; width:100%; justify-content:center; padding:12px;">
          ⏱️ Gå till Bryggstegen (Gör så här) →
        </button>
      </div>

      <!-- RIGHT COLUMN: INTERACTIVE STEPS WIZARD ("GÖR SÅ HÄR") -->
      <div class="brewday-col brewday-col-right" id="bpanel-steps">
        <div class="brewday-progress-container" title="Bryggdagens framsteg: ${progressPercent}%">
          <div class="brewday-progress-bar" style="width: ${progressPercent}%;"></div>
        </div>

        <div class="brewday-steps-stepper">
          ${stepsHtml}
        </div>

        <!-- Sticky Navigation Bar for Step Wizard -->
        <div class="brewday-wizard-nav">
          <button class="btn btn-secondary" id="btn-wizard-prev" ${currentStepIndex === 0 ? 'disabled' : ''}>
            ⬅️ Föregående
          </button>
          <div class="brewday-step-counter-text">
            Steg ${currentStepIndex + 1} av ${totalSteps}
          </div>
          ${currentStepIndex === totalSteps - 1
            ? `<button class="btn btn-success" id="btn-wizard-finish" style="background:#10b981; color:#fff; border:none; font-weight:bold; padding: 8px 18px;">🎉 Slutför bryggdag</button>`
            : `<button class="btn btn-primary" id="btn-wizard-next">Nästa steg ➡️</button>`
          }
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
        persistBrewSession();
      }
    });
  });

  // Track pre-boil input fields and live calculations
  const onPreboilInput = () => {
    brewSession.preboilMode = document.getElementById('bd-preboil-mode')?.value || 'sg';
    brewSession.measuredPreboilGravity = document.getElementById('bd-preboil-grav')?.value || '';
    brewSession.sampleTempC = Number(document.getElementById('bd-preboil-temp')?.value) || 20;
    brewSession.measuredPreboilVol = document.getElementById('bd-preboil-vol')?.value || '';
    persistBrewSession();
    renderPreboilResult(metrics);
  };
  document.getElementById('bd-preboil-mode')?.addEventListener('change', () => {
    brewSession.preboilMode = document.getElementById('bd-preboil-mode')?.value || 'sg';
    persistBrewSession();
    renderBrewdayContent(recalculateCallback);
  });
  document.getElementById('bd-preboil-grav')?.addEventListener('input', onPreboilInput);
  document.getElementById('bd-preboil-temp')?.addEventListener('input', onPreboilInput);
  document.getElementById('bd-preboil-vol')?.addEventListener('input', onPreboilInput);
  renderPreboilResult(metrics);

  // Track logging input fields and live actual efficiency
  const onLogInput = () => {
    brewSession.measuredOG = document.getElementById('bd-measured-og')?.value || '';
    brewSession.measuredFermenterVol = document.getElementById('bd-measured-vol')?.value || '';
    brewSession.measuredPH = document.getElementById('bd-measured-ph')?.value || '';
    brewSession.brewNotes = document.getElementById('bd-notes')?.value || '';
    persistBrewSession();
    renderEfficiencyResult(metrics, recalculateCallback);
  };
  document.getElementById('bd-measured-og')?.addEventListener('input', onLogInput);
  document.getElementById('bd-measured-vol')?.addEventListener('input', onLogInput);
  document.getElementById('bd-measured-ph')?.addEventListener('input', onLogInput);
  document.getElementById('bd-notes')?.addEventListener('input', onLogInput);
  renderEfficiencyResult(metrics, recalculateCallback);

  // Tools modal trigger buttons
  document.getElementById('btn-open-yeast-tool-step')?.addEventListener('click', () => openToolsModal('yeast'));
  document.getElementById('btn-open-yeast-tool-panel')?.addEventListener('click', () => openToolsModal('yeast'));

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

  // Quick switch button in ingredients
  document.getElementById('btn-switch-to-steps-bottom')?.addEventListener('click', () => {
    activeMobileTab = 'steps';
    const grid = document.querySelector('.brewday-grid');
    if (grid) {
      grid.classList.remove('show-ingredients');
      grid.classList.add('show-steps');
    }
    document.querySelectorAll('.brewday-seg-btn').forEach((b) => {
      if (b.dataset.btab === 'steps') b.classList.add('active');
      else b.classList.remove('active');
    });
    setTimeout(() => {
      const activeCard = document.querySelector('.brewday-step-card.brewday-step-active');
      if (activeCard) {
        activeCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
  });

  // Close & Finish Brewday buttons
  document.getElementById('btn-close-brewday-header')?.addEventListener('click', () => {
    toggleBrewdayView(recalculateCallback);
  });

  function recordBrewLog() {
    let logMsg = `Bryggdag genomförd ${new Date().toLocaleDateString('sv-SE')}:`;
    if (brewSession.measuredOG) logMsg += ` Uppmätt OG = ${brewSession.measuredOG}.`;
    if (brewSession.measuredFermenterVol) logMsg += ` Volym i jäskärl = ${brewSession.measuredFermenterVol} L.`;
    const ogNum = parseFloat(String(brewSession.measuredOG).replace(',', '.'));
    const volNum = parseFloat(String(brewSession.measuredFermenterVol).replace(',', '.')) || metrics.batchVolume;
    if (ogNum > 1 && volNum > 0) {
      const eff = actualEfficiency(State.fermentables, ogNum, volNum);
      if (eff > 0) logMsg += ` Faktisk effektivitet = ${eff.toFixed(1)}%.`;
    }
    if (brewSession.measuredPH) logMsg += ` Faktiskt pH = ${brewSession.measuredPH}.`;
    if (brewSession.measuredPreboilGravity) logMsg += ` Förkoksgravitet = ${brewSession.measuredPreboilGravity} (${(brewSession.preboilMode || 'sg').toUpperCase()}).`;
    if (brewSession.brewNotes) logMsg += `\n${brewSession.brewNotes}`;

    State.recipe.notes = State.recipe.notes ? `${State.recipe.notes}\n\n${logMsg}` : logMsg;
    persistBrewSession();
  }

  document.getElementById('btn-wizard-finish')?.addEventListener('click', () => {
    if (brewSession.measuredOG || brewSession.measuredPH || brewSession.brewNotes || brewSession.measuredPreboilGravity) {
      recordBrewLog();
      createBatch({
        recipeSnapshot: State,
        measured: brewSession,
        notes: brewSession.brewNotes,
      });
    }

    showToast('🎉 Bryggdagen är slutförd! Återgår till receptet.', 'success');
    toggleBrewdayView(recalculateCallback);
  });

  // Save as Batch in Mina bryggningar
  document.getElementById('btn-save-as-batch')?.addEventListener('click', () => {
    recordBrewLog();
    const batch = createBatch({
      recipeSnapshot: State,
      measured: brewSession,
      notes: brewSession.brewNotes,
    });
    showToast(`🎉 Batchen "${batch.recipeName}" sparades i Mina bryggningar!`, 'success');
  });

  // Save brewlog notes
  document.getElementById('btn-save-brewlog')?.addEventListener('click', () => {
    recordBrewLog();
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

          // Check for active boil hop additions
          if (activeTimerTargetId === 'timer-display-boil' && State.hops && State.hops.length > 0) {
            const boilHops = State.hops.filter((h) => h.use === 'kok' || h.use === 'whirlpool');
            boilHops.forEach((h, hopIdx) => {
              const targetSecs = (h.use === 'kok' ? (h.time || 0) : 0) * 60;
              const alertKey = `${h.name}-${h.amount}-${targetSecs}`;
              if (timerSecondsRemaining === targetSecs && !triggeredHopAlerts.has(alertKey)) {
                triggeredHopAlerts.add(alertKey);
                playAlarmNotification();
                const timeLabel = h.time > 0 ? `${h.time} min kvar av koket` : 'Whirlpool / Kokslut';
                showToast(`🌿 Humlegiva: Tillsätt ${h.amount} g ${h.name} (${timeLabel})!`, 'warning');

                // Animate/highlight the checklist row
                const hopCb = document.getElementById(`step-boil-hop-${hopIdx}`);
                if (hopCb) {
                  const label = hopCb.closest('li');
                  if (label) {
                    label.classList.add('hop-alert-active');
                    setTimeout(() => label.classList.remove('hop-alert-active'), 15000);
                  }
                }
              }
            });
          }

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

            // Auto-check completed step checkbox
            if (activeTimerTargetId && activeTimerTargetId.startsWith('timer-display-mash-')) {
              const mashIdx = activeTimerTargetId.replace('timer-display-mash-', '');
              const cb = document.getElementById(`step-mash-${mashIdx}-ready`);
              if (cb) {
                cb.checked = true;
                checkedItems.add(cb.id);
              }
            } else if (activeTimerTargetId === 'timer-display-boil') {
              const cb = document.getElementById('step-boil-ready');
              if (cb) {
                cb.checked = true;
                checkedItems.add(cb.id);
              }
            }

            // Pulse Next button to guide user
            const nextBtn = document.getElementById('btn-wizard-next');
            if (nextBtn) {
              nextBtn.classList.add('btn-pulse-next');
              setTimeout(() => nextBtn.classList.remove('btn-pulse-next'), 7000);
            }
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
        if (targetId === 'timer-display-boil') {
          triggeredHopAlerts.clear();
        }
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
 * Handles toggling mobile segmented tabs (Ingredienser vs Gör så här / Steg).
 */
function setupMobileBrewdayTabs() {
  const segBtns = document.querySelectorAll('.brewday-seg-btn');
  const grid = document.querySelector('.brewday-grid');

  segBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.btab;
      activeMobileTab = target;

      segBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      if (grid) {
        grid.classList.remove('show-ingredients', 'show-steps');
        grid.classList.add(`show-${target}`);
      }

      if (target === 'steps') {
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
