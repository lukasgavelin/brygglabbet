/**
 * Sidebar calculations and stats view component.
 */

import { State } from '../state.js';
import {
  calculateOG,
  calculateFG,
  calculateABV,
  calculateIBU,
  calculateEBC,
  calculateBUGU,
  calculateApparentAttenuation,
  calculatePreboilGravity,
  calculateWaterProfile,
  sgToPlato,
  formatSG,
  ebcToColor,
  ebcToLabel,
} from '../core/calculations.js';
import { renderFermentablesTable } from './fermentables.js';
import { renderHopsTable } from './hops.js';
import { renderWaterPanel } from './water.js';
import { updateStyleMatch } from './styleMatch.js';
import { renderWaterRequirementCard } from './equipment.js';

export function recalculate() {
  const ogResult = calculateOG(
    State.fermentables,
    State.recipe.batchVolume,
    State.recipe.efficiency
  );
  const sg = ogResult.sg;
  const plato = ogResult.plato;

  const attMid = (State.yeast.attMin + State.yeast.attMax) / 2;
  const fg_sg = calculateFG(sg, attMid);
  const fg_plato = sgToPlato(fg_sg);

  const abv = calculateABV(sg, fg_sg);
  const ibuResult = calculateIBU(State.hops, sg, State.recipe.batchVolume);
  const ebcResult = calculateEBC(State.fermentables, State.recipe.batchVolume);
  const ebc = ebcResult.ebc;
  const bugu = calculateBUGU(ibuResult.total, sg);
  const apparentAtt = calculateApparentAttenuation(sg, fg_sg);

  const preboilSG = calculatePreboilGravity(sg, State.recipe.batchVolume, State.recipe.boilVolume);
  const preboilPlato = sgToPlato(preboilSG);
  const evapPct =
    State.recipe.boilVolume > 0
      ? (
          ((State.recipe.boilVolume - State.recipe.batchVolume) / State.recipe.boilVolume) *
          100
        ).toFixed(1)
      : '0.0';

  const waterResult = calculateWaterProfile(
    State.water.base,
    State.water.salts,
    State.water.volume
  );

  updateSidebarStats({
    sg,
    plato,
    fg_sg,
    fg_plato,
    abv,
    ibu: ibuResult.total,
    ebc,
    bugu,
    apparentAtt,
  });
  updatePreboilDisplay(preboilSG, preboilPlato, evapPct);
  updateStyleMatch({ og: sg, fg: fg_sg, ibu: ibuResult.total, ebc, abv }, State.recipe.styleId);
  renderFermentablesTable(recalculate);
  renderHopsTable(recalculate);
  renderWaterPanel(waterResult);
  renderWaterRequirementCard();
}

function updateSidebarStats({ sg, plato, fg_sg, fg_plato, abv, ibu, ebc, bugu, apparentAtt }) {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('updated');
    el.textContent = val;
    void el.offsetWidth;
    el.classList.add('updated');
  };

  set('sb-og', plato > 0 ? `${plato.toFixed(1)} °P` : '—');
  set('sb-og-sg', sg > 1 ? formatSG(sg) : '—');
  set('sb-fg', fg_plato > 0 ? `${fg_plato.toFixed(1)} °P` : '—');
  set('sb-fg-sg', fg_sg > 1 ? formatSG(fg_sg) : '—');
  set('sb-abv', abv > 0 ? `${abv.toFixed(1)} %` : '—');
  set('sb-ibu', ibu > 0 ? ibu.toFixed(1) : '—');
  set('sb-ebc', ebc > 0 ? `${ebc.toFixed(0)} EBC` : '—');
  set('sb-bugu', bugu > 0 ? bugu.toFixed(2) : '—');
  set('sb-attenuation', apparentAtt > 0 ? `${apparentAtt.toFixed(0)} %` : '—');

  const totalMalt = State.fermentables.reduce((s, f) => s + (f.amount || 0), 0);
  set('sb-total-malt', `${totalMalt.toFixed(2)} kg`);

  const swatch = document.getElementById('sb-ebc-swatch');
  const label = document.getElementById('sb-ebc-label');
  if (swatch && ebc > 0) {
    swatch.style.background = ebcToColor(ebc);
    swatch.style.boxShadow = `0 0 12px ${ebcToColor(ebc)}, 0 0 4px rgba(0,0,0,0.6)`;
  }
  if (label) label.textContent = ebc > 0 ? ebcToLabel(ebc) : '—';
}

function updatePreboilDisplay(preboilSG, preboilPlato, evapPct) {
  const el = (id) => document.getElementById(id);
  const preboilOgEl = el('preboil-og-display');
  const preboilPlatoEl = el('preboil-plato-display');
  const evapRateEl = el('evap-rate-display');

  if (preboilOgEl) preboilOgEl.textContent = preboilSG > 1 ? formatSG(preboilSG) : '—';
  if (preboilPlatoEl)
    {preboilPlatoEl.textContent = preboilPlato > 0 ? `${preboilPlato.toFixed(1)} °P` : '—';}
  if (evapRateEl) evapRateEl.textContent = `${evapPct} %`;
}
