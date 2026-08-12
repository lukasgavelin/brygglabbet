/**
 * Dedicated Brew Day Mode Module (Bryggdags-läge).
 * Modern 2-column cooking app layout: Ingredients on left, interactive Step-by-Step with Timers on right.
 */

import { State } from '../state.js';
import { calculateOG, calculateFG, calculateABV, calculateIBU, calculateEBC, formatSG, calculateWaterVolumes } from '../core/calculations.js';
import { showToast, escHtml } from './toast.js';

let activeTimer = null;
let timerSecondsRemaining = 0;
let isBrewdayOpen = false;

/**
 * Toggles the main view between Recipe Editor and Brew Day Mode.
 * @param {Function} recalculateCallback - Callback to trigger recalculations
 */
export function toggleBrewdayView(recalculateCallback) {
  const recipeView = document.getElementById('app-body');
  const brewdayView = document.getElementById('brewday-view');
  const btnToggle = document.getElementById('btn-toggle-brewday');

  if (!recipeView || !brewdayView) return;

  isBrewdayOpen = !isBrewdayOpen;

  if (isBrewdayOpen) {
    recipeView.classList.add('hidden');
    brewdayView.classList.remove('hidden');
    if (btnToggle) {
      btnToggle.classList.add('btn-primary');
      btnToggle.classList.remove('btn-secondary');
      btnToggle.innerHTML = '<span class="quick-icon">📝</span> Receptbyggaren';
    }
    renderBrewdayContent(recalculateCallback);
    showToast('🍺 Välkommen till Bryggdagsläget!', 'info');
  } else {
    brewdayView.classList.add('hidden');
    recipeView.classList.remove('hidden');
    if (btnToggle) {
      btnToggle.classList.add('btn-secondary');
      btnToggle.classList.remove('btn-primary');
      btnToggle.innerHTML = '<span class="quick-icon">🍺</span> Bryggdag';
    }
  }
}

/**
 * Renders the 2-column Brew Day view.
 * @param {Function} recalculateCallback - Recalculate callback
 */
export function renderBrewdayContent(_recalculateCallback) {
  const container = document.getElementById('brewday-view');
  if (!container) return;

  const waterVols = calculateWaterVolumes(
    State.recipe.batchVolume,
    State.recipe.boilTime,
    State.equipment.boilOffRate,
    State.equipment.kettleLoss,
    State.equipment.fermenterLoss,
    State.fermentables,
    State.equipment.grainAbsorption,
    State.equipment.mashRatio
  );

  const ogRes = calculateOG(State.fermentables, State.recipe.batchVolume, State.recipe.efficiency);
  const fgRes = calculateFG(ogRes.sg, (State.yeast.attMin + State.yeast.attMax) / 2);
  const abvRes = calculateABV(ogRes.sg, fgRes.sg);
  const ibuRes = calculateIBU(State.hops, ogRes.sg, State.recipe.batchVolume);
  const ebcRes = calculateEBC(State.fermentables, State.recipe.batchVolume);

  container.innerHTML = `
    <div class="brewday-header-bar">
      <div>
        <h2 class="brewday-title">🍺 BRYGGDAG: ${escHtml(State.recipe.name || 'Namnlöst recept')}</h2>
        <div class="brewday-subtitle">
          <span>Target OG: <strong>${formatSG(ogRes.sg)}</strong></span> • 
          <span>Target IBU: <strong>${ibuRes.total.toFixed(0)}</strong></span> • 
          <span>Target EBC: <strong>${ebcRes.ebc.toFixed(0)}</strong></span> • 
          <span>Est. ABV: <strong>${abvRes.abv.toFixed(1)}%</strong></span>
        </div>
      </div>
      <div class="brewday-tab-switch">
        <button class="btn btn-sm btn-primary brewday-mobile-tab active" data-btab="ingredients">🌾 Ingredienser</button>
        <button class="btn btn-sm btn-secondary brewday-mobile-tab" data-btab="steps">⏱️ Steg-för-steg</button>
      </div>
    </div>

    <div class="brewday-grid">
      <!-- LEFT COLUMN: INGREDIENTS & PREP CHECKLIST -->
      <div class="brewday-col brewday-col-left" id="bpanel-ingredients">
        <div class="brewday-card">
          <h3 class="brewday-card-title">💧 1. Vatten & Salter</h3>
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
          <p class="section-label" style="margin-top:10px">Bryggsalter (Totalt):</p>
          <ul class="brewday-checklist">
            <li><label><input type="checkbox"> Gips (CaSO₄): <strong>${State.water.salts.gypsum || 0} g</strong></label></li>
            <li><label><input type="checkbox"> Kalciumklorid (CaCl₂): <strong>${State.water.salts.calciumChloride || 0} g</strong></label></li>
            <li><label><input type="checkbox"> Epsomsalt (MgSO₄): <strong>${State.water.salts.epsomSalt || 0} g</strong></label></li>
            <li><label><input type="checkbox"> Bordssalt (NaCl): <strong>${State.water.salts.tableSalt || 0} g</strong></label></li>
          </ul>
        </div>

        <div class="brewday-card">
          <h3 class="brewday-card-title">🌾 2. Maltnota (${State.fermentables.reduce((s,f)=>s+(f.amount||0),0).toFixed(2)} kg)</h3>
          ${
            State.fermentables.length === 0
              ? '<p class="text-muted" style="font-size:0.85rem">Ingen malt inlagd i receptet.</p>'
              : `<ul class="brewday-checklist">
                  ${State.fermentables
                    .map(
                      (f) =>
                        `<li><label><input type="checkbox"> <strong>${f.amount} kg</strong> – ${escHtml(f.name)} <span class="badge-tag">${f.ebc} EBC</span></label></li>`
                    )
                    .join('')}
                </ul>`
          }
        </div>

        <div class="brewday-card">
          <h3 class="brewday-card-title">🌿 3. Humlegivor (${State.hops.reduce((s,h)=>s+(h.amount||0),0)} g)</h3>
          ${
            State.hops.length === 0
              ? '<p class="text-muted" style="font-size:0.85rem">Ingen humle inlagd i receptet.</p>'
              : `<ul class="brewday-checklist">
                  ${State.hops
                    .map(
                      (h) =>
                        `<li><label><input type="checkbox"> <strong>${h.amount} g</strong> – ${escHtml(h.name)} (${h.alpha}% α) @ ${h.time} min (${h.use})</label></li>`
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
              <strong>${escHtml(State.yeast.name || 'Ej vald')}</strong>
            </div>
            <div class="brewday-stat-item">
              <span>Jästemperatur:</span>
              <strong>${State.yeast.tempMin || 18}°C – ${State.yeast.tempMax || 22}°C</strong>
            </div>
          </div>
        </div>
      </div>

      <!-- RIGHT COLUMN: INTERACTIVE STEP-BY-STEP & TIMERS -->
      <div class="brewday-col brewday-col-right" id="bpanel-steps">
        <!-- STEG 1: Strike Water -->
        <div class="brewday-step-card">
          <div class="brewday-step-num">1</div>
          <div class="brewday-step-body">
            <h4>🔥 Värm Mäskvatten</h4>
            <p>Värm <strong>${waterVols.mashWater.toFixed(1)} L</strong> vatten till cirka <strong>${((State.mash[0]?.temp || 67) + 4).toFixed(1)}°C</strong> (Strike Temp för att hamna på ${State.mash[0]?.temp || 67}°C vid inmäskning).</p>
            <label class="brewday-done-check"><input type="checkbox"> Vattnet är redo för inmäskning</label>
          </div>
        </div>

        <!-- STEG 2: Mash Schedule -->
        <div class="brewday-step-card">
          <div class="brewday-step-num">2</div>
          <div class="brewday-step-body">
            <h4>♨️ Mäskning</h4>
            <p>Rör ner malten noga för att undvika klumpar. Följ mäskschemat:</p>
            ${
              State.mash.length === 0
                ? '<p>Standard mäskning: 60 min vid 67°C.</p>'
                : State.mash
                    .map(
                      (m, i) => `
                <div class="brewday-timer-block">
                  <div class="brewday-timer-header">
                    <strong>Steg ${i + 1}: ${escHtml(m.name)}</strong> – ${m.temp}°C i ${m.time} min
                  </div>
                  <div class="brewday-timer-controls">
                    <div class="timer-display" id="timer-display-mash-${i}">${m.time}:00</div>
                    <button class="btn btn-sm btn-primary btn-start-timer" data-time="${m.time * 60}" data-target="timer-display-mash-${i}">▶ Starta</button>
                    <button class="btn btn-sm btn-secondary btn-reset-timer" data-time="${m.time * 60}" data-target="timer-display-mash-${i}">🔄 Nollställ</button>
                  </div>
                </div>
              `
                    )
                    .join('')
            }
          </div>
        </div>

        <!-- STEG 3: Sparging -->
        <div class="brewday-step-card">
          <div class="brewday-step-num">3</div>
          <div class="brewday-step-body">
            <h4>💧 Lakning & Vörtinsamling</h4>
            <p>Laka med <strong>${waterVols.spargeWater.toFixed(1)} L</strong> varmt vatten (~76°C) tills du samlat cirka <strong>${State.recipe.boilVolume || 25} L</strong> vört i kokkärlet.</p>
            <label class="brewday-done-check"><input type="checkbox"> Kokkärlet är fyllt med pre-boil vört</label>
          </div>
        </div>

        <!-- STEG 4: Boil & Hop Additions -->
        <div class="brewday-step-card">
          <div class="brewday-step-num">4</div>
          <div class="brewday-step-body">
            <h4>⚡ Vörtkok & Humlegivor (${State.recipe.boilTime || 60} min)</h4>
            <p>Koka vörten kraftigt i <strong>${State.recipe.boilTime || 60} minuter</strong> och tillsätt humle enligt schemat:</p>
            <div class="brewday-timer-block" style="margin-bottom:12px">
              <div class="brewday-timer-controls">
                <div class="timer-display" id="timer-display-boil">${State.recipe.boilTime || 60}:00</div>
                <button class="btn btn-sm btn-primary btn-start-timer" data-time="${(State.recipe.boilTime || 60) * 60}" data-target="timer-display-boil">▶ Starta Kok-Timer</button>
                <button class="btn btn-sm btn-secondary btn-reset-timer" data-time="${(State.recipe.boilTime || 60) * 60}" data-target="timer-display-boil">🔄 Nollställ</button>
              </div>
            </div>
            <ul class="brewday-checklist">
              ${State.hops
                .map(
                  (h) =>
                    `<li><label><input type="checkbox"> Vid <strong>${h.time} min</strong> kvar: Lägg i <strong>${h.amount} g ${escHtml(h.name)}</strong> (${h.use})</label></li>`
                )
                .join('')}
            </ul>
          </div>
        </div>

        <!-- STEG 5: Chilling & Pitching -->
        <div class="brewday-step-card">
          <div class="brewday-step-num">5</div>
          <div class="brewday-step-body">
            <h4>❄️ Kylning & Jästtillsats</h4>
            <p>Kyl vörten snabbt ned till <strong>${State.yeast.tempMin || 18}°C</strong>, överför till jäskärl, lufta kraftigt och tilsätt <strong>${escHtml(State.yeast.name || 'jästen')}</strong>.</p>
            <label class="brewday-done-check"><input type="checkbox"> Ölet står säkert i jäskammaren</label>
          </div>
        </div>

        <!-- STEG 6: Brew Log Entry -->
        <div class="brewday-step-card" style="border-color:var(--accent)">
          <div class="brewday-step-num" style="background:var(--accent)">6</div>
          <div class="brewday-step-body">
            <h4>💾 Spara Mätningar för Dagen</h4>
            <div class="card-grid-2" style="margin-top:8px">
              <div class="form-group">
                <label class="form-label" for="bd-measured-og">Uppmätt OG</label>
                <div class="input-group">
                  <input type="number" inputmode="decimal" id="bd-measured-og" placeholder="t.ex. 1.052" step="0.001">
                </div>
              </div>
              <div class="form-group">
                <label class="form-label" for="bd-measured-ph">Uppmätt Mäsk-pH</label>
                <div class="input-group">
                  <input type="number" inputmode="decimal" id="bd-measured-ph" placeholder="t.ex. 5.35" step="0.01">
                </div>
              </div>
            </div>
            <div class="form-group" style="margin-top:8px">
              <label class="form-label" for="bd-notes">Bryggdagsnoteringar</label>
              <textarea id="bd-notes" placeholder="Hur gick bryggningen? Avvikelser, doft, färg..."></textarea>
            </div>
            <button class="btn btn-primary" id="btn-save-brewlog" style="margin-top:10px">💾 Spara Bryggnoteringar i Receptet</button>
          </div>
        </div>
      </div>
    </div>
  `;

  setupTimerControls();
  setupMobileBrewdayTabs();

  document.getElementById('btn-save-brewlog')?.addEventListener('click', () => {
    const ogInput = document.getElementById('bd-measured-og')?.value;
    const phInput = document.getElementById('bd-measured-ph')?.value;
    const notesInput = document.getElementById('bd-notes')?.value;

    let logMsg = `Bryggdag genomförd ${new Date().toLocaleDateString('sv-SE')}:`;
    if (ogInput) logMsg += ` Uppmätt OG = ${ogInput}.`;
    if (phInput) logMsg += ` Mäsk-pH = ${phInput}.`;
    if (notesInput) logMsg += `\n${notesInput}`;

    State.recipe.notes = State.recipe.notes ? `${State.recipe.notes}\n\n${logMsg}` : logMsg;
    showToast('💾 Bryggdagsnoteringar sparade i receptet!', 'success');
  });
}

function setupTimerControls() {
  document.querySelectorAll('.btn-start-timer').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const targetEl = document.getElementById(targetId);
      if (!targetEl) return;

      if (btn.classList.contains('running')) {
        // Pause timer
        clearInterval(activeTimer);
        activeTimer = null;
        btn.classList.remove('running');
        btn.innerHTML = '▶ Fortsätt';
        btn.classList.replace('btn-warning', 'btn-primary');
      } else {
        // Start / Resume timer
        if (!timerSecondsRemaining || btn.dataset.currentTarget !== targetId) {
          timerSecondsRemaining = parseInt(btn.dataset.time, 10) || 3600;
          btn.dataset.currentTarget = targetId;
        }

        btn.classList.add('running');
        btn.innerHTML = '⏸️ Pausa';
        btn.classList.replace('btn-primary', 'btn-warning');

        clearInterval(activeTimer);
        activeTimer = setInterval(() => {
          timerSecondsRemaining--;
          if (timerSecondsRemaining <= 0) {
            clearInterval(activeTimer);
            activeTimer = null;
            timerSecondsRemaining = 0;
            targetEl.textContent = '00:00';
            btn.classList.remove('running');
            btn.innerHTML = '✅ Klart!';
            btn.classList.replace('btn-warning', 'btn-success');
            showToast('⏰ Timern har löpt ut!', 'success');
          } else {
            const m = Math.floor(timerSecondsRemaining / 60);
            const s = timerSecondsRemaining % 60;
            targetEl.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
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

      clearInterval(activeTimer);
      activeTimer = null;
      timerSecondsRemaining = totalSecs;

      const m = Math.floor(totalSecs / 60);
      const s = totalSecs % 60;
      if (targetEl) targetEl.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

      const startBtn = document.querySelector(`.btn-start-timer[data-target="${targetId}"]`);
      if (startBtn) {
        startBtn.classList.remove('running', 'btn-warning', 'btn-success');
        startBtn.classList.add('btn-primary');
        startBtn.innerHTML = '▶ Starta';
      }
    });
  });
}

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
      }
    });
  });
}
