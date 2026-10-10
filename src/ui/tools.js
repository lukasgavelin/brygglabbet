/**
 * Brewing tools modal: carbonation, refractometer, hydrometer, yeast pitching
 * and strike water. Thin UI layer – all math lives in core/brewtools.js.
 */

import { State } from '../state.js';
import { STYLES } from '../core/data.js';
import { computeRecipeMetrics } from '../core/calculations.js';
import { CO2_GRAMS_PER_LITER_PER_VOLUME } from '../constants.js';
import {
  PRIMING_SUGARS,
  CARBONATION_GUIDE,
  suggestCarbonation,
  yeastProfile,
  primingSugar,
  kegPressure,
  brixToSG,
  sgToBrix,
  refractometerFG,
  measuredResults,
  hydrometerTempCorrection,
  pitchRate,
  starterSize,
  strikeTemp,
  infusionVolume,
} from '../core/brewtools.js';
import { openModal } from './modals.js';
import { escHtml } from './utils.js';

/** Tool values kept between tab switches within a session. */
const values = {};
let activeTab = 'carb';
let onStateChange = () => {};

const parseNum = (v) => parseFloat(String(v ?? '').replace(',', '.'));
const fmt = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d).replace('.', ',') : '—');
const sg = (v) => (Number.isFinite(v) ? v.toFixed(3) : '—');

function field(id, label, value, { unit = '', step = 'any', type = 'number' } = {}) {
  const input = `<input type="${type}" ${type === 'number' ? 'inputmode="decimal"' : ''} id="${id}" value="${escHtml(String(value ?? ''))}" step="${step}">`;
  return `<div class="form-group">
    <label class="form-label" for="${id}">${label}</label>
    ${unit ? `<div class="input-group">${input}<span class="input-addon">${unit}</span></div>` : input}
  </div>`;
}

function select(id, label, options, value) {
  const opts = options
    .map((o) => `<option value="${o.value}" ${String(o.value) === String(value) ? 'selected' : ''}>${escHtml(o.label)}</option>`)
    .join('');
  return `<div class="form-group"><label class="form-label" for="${id}">${label}</label><select id="${id}">${opts}</select></div>`;
}

const v = (id) => values[id];

// ---------------------------------------------------------------------------
// Defaults from the current recipe
// ---------------------------------------------------------------------------

function prefill() {
  const m = computeRecipeMetrics(State);
  const style = STYLES.find((s) => s.id === State.recipe?.styleId);
  const carb = suggestCarbonation(style);
  const yp = yeastProfile(State.yeast);
  const firstStep = (State.mash || [])[0];
  const secondStep = (State.mash || [])[1];
  const eq = State.equipment || {};
  const packagedL = Math.max(0, m.batchVolume - (Number(eq.fermenterLoss) || 0));

  Object.assign(values, {
    // Kolsyra
    'carb-vols': State.recipe?.carbonationVols ?? carb.target,
    'carb-temp': Number(State.yeast?.tempMax) || 20,
    'carb-volume': Math.round(packagedL * 10) / 10,
    'carb-sugar': values['carb-sugar'] || 'sucrose',
    'carb-keg-temp': values['carb-keg-temp'] ?? 4,
    // Refraktometer
    'refrac-wcf': values['refrac-wcf'] ?? 1.04,
    'refrac-og': values['refrac-og'] ?? Math.round(sgToBrix(m.og) * 10) / 10,
    'refrac-fg': values['refrac-fg'] ?? '',
    // Hydrometer
    'hydro-sg': values['hydro-sg'] ?? Number(m.og.toFixed(3)),
    'hydro-temp': values['hydro-temp'] ?? 30,
    'hydro-cal': values['hydro-cal'] ?? 20,
    // Jäst
    'yeast-og': Number(m.og.toFixed(3)),
    'yeast-volume': m.batchVolume,
    'yeast-type': yp.type,
    'yeast-form': yp.form,
    'yeast-pack': yp.packSizeG,
    'yeast-mfg': values['yeast-mfg'] ?? '',
    // Inmäskning
    'strike-mash': Number(firstStep?.temp) || 67,
    'strike-grain': Number(eq.grainTemp ?? 18),
    'strike-ratio': Number(eq.mashRatio) || 3,
    'strike-loss': values['strike-loss'] ?? 0,
    'strike-kg': Math.round(
      (State.fermentables || []).filter((f) => f.type !== 'sugar').reduce((s, f) => s + (Number(f.amount) || 0), 0) * 100
    ) / 100,
    'strike-next': Number(secondStep?.temp) || 72,
  });
  values._carbGuide = carb;
  values._styleName = style ? `${style.id} ${style.name}` : '';
}

// ---------------------------------------------------------------------------
// Tab renderers: form (static) + results (recomputed on input)
// ---------------------------------------------------------------------------

const TABS = {
  carb: {
    form() {
      const g = values._carbGuide;
      const sugars = Object.entries(PRIMING_SUGARS).map(([value, s]) => ({ value, label: s.label }));
      const guide = CARBONATION_GUIDE.map(
        (c) => `<span class="${c.id === g.id ? 'tool-chip active' : 'tool-chip'}">${c.label}: ${fmt(c.min)}–${fmt(c.max)}</span>`
      ).join('');
      return `
        <p class="tool-hint">Förslag för ${values._styleName ? escHtml(values._styleName) : 'vald stil'}: <strong>${fmt(g.min)}–${fmt(g.max)} vol</strong>. Målet sparas i receptet.</p>
        <div class="tool-chips">${guide}</div>
        <div class="card-grid-2">
          ${field('carb-vols', 'Önskad kolsyrenivå', v('carb-vols'), { unit: 'vol CO₂', step: '0.1' })}
          ${field('carb-volume', 'Volym att flaska', v('carb-volume'), { unit: 'L', step: '0.5' })}
          ${field('carb-temp', 'Högsta öltemp efter jäsning', v('carb-temp'), { unit: '°C', step: '0.5' })}
          ${select('carb-sugar', 'Sockertyp', sugars, v('carb-sugar'))}
        </div>
        <div class="tool-result" id="carb-result-bottle"></div>
        <p class="section-label" style="margin-top:14px">Fat (tvångskolsyrning)</p>
        <div class="card-grid-2">${field('carb-keg-temp', 'Temperatur i fatet', v('carb-keg-temp'), { unit: '°C', step: '0.5' })}</div>
        <div class="tool-result" id="carb-result-keg"></div>`;
    },
    results() {
      const vols = parseNum(v('carb-vols'));
      const p = primingSugar({
        volumeL: parseNum(v('carb-volume')),
        targetVols: vols,
        beerTempC: parseNum(v('carb-temp')),
        sugarType: v('carb-sugar'),
      });
      const sugarLabel = PRIMING_SUGARS[v('carb-sugar')]?.label.split(' (')[0].toLowerCase() || 'socker';
      const gL = vols * CO2_GRAMS_PER_LITER_PER_VOLUME;
      setHTML('carb-result-bottle', `
        <div class="tool-result-main">${p.grams} g ${sugarLabel}</div>
        <div class="tool-hint">${fmt(p.gramsPerLiter)} g/L · mål ${fmt(vols)} vol (${fmt(gL)} g CO₂/L) · redan löst i ölet: ${fmt(p.residualVols, 2)} vol</div>
        <div class="tool-hint">Lös sockret i lite kokt vatten och blanda försiktigt ner i ölet innan flaskning.</div>
        ${vols > 3.0 ? '<div class="tool-hint" style="color:var(--warning)">⚠️ Över 3 vol – använd tjockväggiga flaskor (t.ex. belgiska/champagne).</div>' : ''}`);
      const bar = kegPressure(parseNum(v('carb-keg-temp')), vols);
      setHTML('carb-result-keg', `
        <div class="tool-result-main">${fmt(bar, 2)} bar</div>
        <div class="tool-hint">Övertryck på regulatorn. Räkna med 7–10 dagar till full kolsyra vid konstant tryck.</div>`);
    },
    onInput(id) {
      if (id === 'carb-vols') {
        const vols = parseNum(v('carb-vols'));
        if (Number.isFinite(vols) && vols > 0) {
          State.recipe.carbonationVols = vols;
          onStateChange();
        }
      }
    },
  },

  refrac: {
    form() {
      return `
        <p class="tool-hint">Refraktometern visar fel när alkohol finns i ölet. Ange OG-avläsningen (Brix) från bryggdagen och nuvarande avläsning för att få korrekt FG (Terrills formel).</p>
        <div class="card-grid-3">
          ${field('refrac-og', 'Avläsning före jäsning', v('refrac-og'), { unit: '°Bx', step: '0.1' })}
          ${field('refrac-fg', 'Avläsning nu', v('refrac-fg'), { unit: '°Bx', step: '0.1' })}
          ${field('refrac-wcf', 'Korrektionsfaktor (WCF)', v('refrac-wcf'), { step: '0.01' })}
        </div>
        <div class="tool-result" id="refrac-result"></div>
        <p class="tool-hint">WCF är normalt 1,02–1,06. Kalibrera genom att jämföra med hydrometer på ojäst vört: WCF = Brix ÷ °Plato.</p>`;
    },
    results() {
      const wcf = parseNum(v('refrac-wcf')) || 1.04;
      const ogBx = parseNum(v('refrac-og'));
      const fgBx = parseNum(v('refrac-fg'));
      const og = brixToSG(ogBx, wcf);
      let html = `<div><strong>OG:</strong> ${sg(og)}</div>`;
      if (Number.isFinite(fgBx) && fgBx > 0) {
        const fg = refractometerFG(ogBx, fgBx, wcf);
        const r = measuredResults(og, fg);
        html = `
          <div class="tool-result-main">FG ${sg(fg)}</div>
          <div class="tool-hint">OG ${sg(og)} · ABV ${fmt(r.abv)} % · skenbar förjäsning ${r.apparentAttenuation} %</div>`;
      }
      setHTML('refrac-result', html);
    },
  },

  hydro: {
    form() {
      return `
        <p class="tool-hint">Hydrometern är kalibrerad vid en viss temperatur (oftast 20°C i Sverige). Varmare prov ger för lågt värde.</p>
        <div class="card-grid-3">
          ${field('hydro-sg', 'Avläst SG', v('hydro-sg'), { step: '0.001' })}
          ${field('hydro-temp', 'Provets temperatur', v('hydro-temp'), { unit: '°C', step: '0.5' })}
          ${field('hydro-cal', 'Kalibrerad vid', v('hydro-cal'), { unit: '°C', step: '0.5' })}
        </div>
        <div class="tool-result" id="hydro-result"></div>`;
    },
    results() {
      const temp = parseNum(v('hydro-temp'));
      const corrected = hydrometerTempCorrection(parseNum(v('hydro-sg')), temp, parseNum(v('hydro-cal')) || 20);
      setHTML('hydro-result', `
        <div class="tool-result-main">Korrigerad SG ${sg(corrected)}</div>
        ${temp > 40 ? '<div class="tool-hint" style="color:var(--warning)">⚠️ Över ca 40°C blir korrigeringen osäker – kyl provet först.</div>' : ''}`);
    },
  },

  yeast: {
    form() {
      const name = State.yeast?.name ? escHtml(`${State.yeast.name}${State.yeast.lab ? ` (${State.yeast.lab})` : ''}`) : 'ingen vald';
      return `
        <p class="tool-hint">Receptets jäst: <strong>${name}</strong>. Rekommenderad mängd friska jästceller.</p>
        <div class="card-grid-3">
          ${field('yeast-og', 'OG', v('yeast-og'), { step: '0.001' })}
          ${field('yeast-volume', 'Volym i jäskärl', v('yeast-volume'), { unit: 'L', step: '0.5' })}
          ${select('yeast-type', 'Typ', [
            { value: 'ale', label: 'Ale' },
            { value: 'lager', label: 'Lager' },
            { value: 'kveik', label: 'Kveik' },
          ], v('yeast-type'))}
          ${select('yeast-form', 'Form', [
            { value: 'dry', label: 'Torrjäst' },
            { value: 'liquid', label: 'Flytande' },
          ], v('yeast-form'))}
          ${v('yeast-form') === 'dry'
            ? field('yeast-pack', 'Påsens vikt', v('yeast-pack'), { unit: 'g', step: '0.5' })
            : field('yeast-mfg', 'Tillverkningsdatum', v('yeast-mfg'), { type: 'date' })}
        </div>
        <div class="tool-result" id="yeast-result"></div>`;
    },
    results() {
      const form = v('yeast-form');
      const type = v('yeast-type');
      const r = pitchRate({
        og: parseNum(v('yeast-og')),
        volumeL: parseNum(v('yeast-volume')),
        type,
        form,
        packSizeG: parseNum(v('yeast-pack')),
        mfgDate: v('yeast-mfg') || undefined,
      });
      let html;
      if (form === 'dry') {
        html = `
          <div class="tool-result-main">${r.packs} ${r.packs === 1 ? 'påse' : 'påsar'} (${fmt(r.grams)} g)</div>
          <div class="tool-hint">Behov ca ${r.cellsNeededB} miljarder celler · ${r.cellsPerPackB} per påse.</div>`;
      } else {
        const st = starterSize({ cellsNeededB: r.cellsNeededB, cellsAvailableB: r.cellsPerPackB });
        html = `
          <div class="tool-result-main">${r.packs} ${r.packs === 1 ? 'förpackning' : 'förpackningar'}</div>
          <div class="tool-hint">Behov ca ${r.cellsNeededB} miljarder celler · viabilitet ${Math.round(r.viability * 100)} % (${r.cellsPerPackB} per förpackning).</div>
          ${st.needed ? `<div style="margin-top:6px">Alternativ: 1 förpackning + starter på <strong>${fmt(st.liters, 2)} L</strong> (${st.dmeG} g ljust torrmaltextrakt, magnetomrörare).</div>` : ''}`;
      }
      if (type === 'kveik') html += '<div class="tool-hint">Kveik tål låg pitch – ofta räcker en liten mängd även till starka öl.</div>';
      html += '<div class="tool-hint">Antagande: ca 15 miljarder levande celler per gram torrjäst. Tillverkarna rekommenderar ofta 50–100 g/hL; en påse räcker vanligen till 20–25 L normalstarkt öl.</div>';
      setHTML('yeast-result', html);
    },
    onInput(id) {
      if (id === 'yeast-form') renderTab(); // swap pack/date field
    },
  },

  strike: {
    form() {
      return `
        <p class="tool-hint">Beräknar temperatur på inmäskningsvattnet så att mäsken hamnar rätt (Palmers formel).</p>
        <div class="card-grid-3">
          ${field('strike-mash', 'Önskad mäsktemp', v('strike-mash'), { unit: '°C', step: '0.5' })}
          ${field('strike-grain', 'Maltens temperatur', v('strike-grain'), { unit: '°C', step: '1' })}
          ${field('strike-ratio', 'Vatten/malt', v('strike-ratio'), { unit: 'L/kg', step: '0.1' })}
          ${field('strike-kg', 'Maltmängd', v('strike-kg'), { unit: 'kg', step: '0.1' })}
          ${field('strike-loss', 'Värmeförlust i kärl', v('strike-loss'), { unit: '°C', step: '0.5' })}
        </div>
        <div class="tool-result" id="strike-result"></div>
        <p class="section-label" style="margin-top:14px">Stegmäskning med kokande vatten</p>
        <div class="card-grid-3">${field('strike-next', 'Nästa steg', v('strike-next'), { unit: '°C', step: '0.5' })}</div>
        <div class="tool-result" id="strike-infusion"></div>
        <p class="tool-hint">Maltens temperatur sparas i utrustningsprofilen. Elbryggverk (Grainfather, Brewzilla m.fl.) värmer mäsken själva – sätt värmeförlust 0.</p>`;
    },
    results() {
      const ratio = parseNum(v('strike-ratio'));
      const kg = parseNum(v('strike-kg'));
      const mash = parseNum(v('strike-mash'));
      const t = strikeTemp({
        mashTempC: mash,
        grainTempC: parseNum(v('strike-grain')),
        ratioLPerKg: ratio,
        tunLossC: parseNum(v('strike-loss')) || 0,
      });
      const waterL = kg * ratio;
      setHTML('strike-result', `
        <div class="tool-result-main">${fmt(t)} °C</div>
        <div class="tool-hint">${fmt(waterL)} L inmäskningsvatten till ${fmt(kg, 2)} kg malt.</div>`);
      const add = infusionVolume({ currentTempC: mash, targetTempC: parseNum(v('strike-next')), grainKg: kg, mashWaterL: waterL });
      setHTML('strike-infusion', add > 0
        ? `<div class="tool-result-main">${fmt(add)} L kokande vatten</div><div class="tool-hint">Från ${fmt(mash)} °C till ${fmt(parseNum(v('strike-next')))} °C.</div>`
        : '<div class="tool-hint">Nästa steg måste vara varmare än nuvarande.</div>');
    },
    onInput(id) {
      if (id === 'strike-grain') {
        const g = parseNum(v('strike-grain'));
        if (Number.isFinite(g)) {
          State.equipment.grainTemp = g;
          onStateChange();
        }
      }
    },
  },
};

function setHTML(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function renderTab() {
  const body = document.getElementById('tools-body');
  const tab = TABS[activeTab];
  if (!body || !tab) return;
  body.innerHTML = tab.form();
  tab.results();
  document.querySelectorAll('#tools-tabs .tools-tab').forEach((b) => {
    b.classList.toggle('active', b.dataset.tool === activeTab);
  });
}

/**
 * Wires up the tools modal. Call once on startup.
 * @param {() => void} recalculateCallback - Called when a tool updates the recipe state
 */
export function setupToolsModal(recalculateCallback) {
  onStateChange = recalculateCallback || (() => {});
  document.getElementById('tools-tabs')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.tools-tab');
    if (!btn) return;
    activeTab = btn.dataset.tool;
    renderTab();
  });
  const body = document.getElementById('tools-body');
  const handle = (e) => {
    const id = e.target?.id;
    if (!id || !(id in values)) return;
    values[id] = e.target.value;
    TABS[activeTab].onInput?.(id);
    TABS[activeTab].results();
  };
  body?.addEventListener('input', handle);
  body?.addEventListener('change', handle);
  document.getElementById('btn-tools')?.addEventListener('click', () => openToolsModal());
}

/**
 * Opens the tools modal, prefilled from the current recipe.
 * @param {'carb'|'refrac'|'hydro'|'yeast'|'strike'} [tab]
 */
export function openToolsModal(tab) {
  prefill();
  if (tab && TABS[tab]) activeTab = tab;
  renderTab();
  openModal('modal-tools');
}
