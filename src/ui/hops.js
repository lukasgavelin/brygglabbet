/**
 * Hops table UI handlers.
 */

import { State, generateId } from '../state.js';
import { computeRecipeMetrics } from '../core/calculations.js';
import { escHtml } from './toast.js';

export function renderHopsTable(recalculateCallback) {
  const tbody = document.getElementById('hops-body');
  const empty = document.getElementById('hops-empty');
  const table = document.getElementById('hops-table');

  if (!tbody || !empty || !table) return;

  if (State.hops.length === 0) {
    table.style.display = 'none';
    empty.style.display = 'block';
    const gEl = document.getElementById('hops-total-g');
    const ibuEl = document.getElementById('hops-total-ibu');
    if (gEl) gEl.textContent = '0 g';
    if (ibuEl) ibuEl.textContent = '0 IBU';
    return;
  }
  table.style.display = '';
  empty.style.display = 'none';

  const metrics = computeRecipeMetrics(State);
  const ibuResult = { total: metrics.ibu, perHop: metrics.ibuPerHop };

  tbody.innerHTML = '';
  State.hops.forEach((h, idx) => {
    const ibuContrib = ibuResult.perHop[idx]?.toFixed(1) ?? '—';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-name">
        <input type="text" value="${escHtml(h.name)}" placeholder="Humlenamn" data-id="${h.id}" data-field="name">
      </td>
      <td class="col-amount">
        <input type="number" inputmode="decimal" value="${h.amount}" min="0" step="1" data-id="${h.id}" data-field="amount">
      </td>
      <td class="col-value">
        <input type="number" inputmode="decimal" value="${h.alpha}" min="0" max="30" step="0.1" data-id="${h.id}" data-field="alpha">
      </td>
      <td class="col-value">
        ${h.use === 'torrhumle' ? `
        <div class="hop-dryhop-inputs" style="display:flex; gap:3px; align-items:center;" title="Tillsätt dag X i jäsningen, låt ligga i Y dagar">
          <span style="font-size:0.75rem; color:var(--text-secondary)">dag</span>
          <input type="number" inputmode="decimal" value="${h.dryHopDay ?? 7}" min="0" max="60" step="1" data-id="${h.id}" data-field="dryHopDay" style="width:45px; padding:2px 4px; text-align:center;">
          <span style="font-size:0.75rem; color:var(--text-secondary)">i</span>
          <input type="number" inputmode="decimal" value="${h.dryHopDays ?? 3}" min="1" max="30" step="1" data-id="${h.id}" data-field="dryHopDays" style="width:45px; padding:2px 4px; text-align:center;">
          <span style="font-size:0.75rem; color:var(--text-secondary)">d</span>
        </div>` : `
        <input type="number" inputmode="decimal" value="${h.time}" min="0" max="300" step="5" data-id="${h.id}" data-field="time" title="${h.use === 'whirlpool' ? 'Whirlpooltid (min)' : 'Koktid (min)'}">
        ${h.use === 'whirlpool' ? `
        <div class="hop-wp-temp" title="Whirlpooltemperatur – lägre temp ger mindre beska">
          <input type="number" inputmode="decimal" value="${h.whirlpoolTemp ?? 80}" min="40" max="100" step="1" data-id="${h.id}" data-field="whirlpoolTemp"><span>°C</span>
        </div>` : ''}`}
      </td>
      <td class="col-unit">
        <select data-id="${h.id}" data-field="form">
          <option value="pellets" ${h.form === 'pellets' ? 'selected' : ''}>Pellets</option>
          <option value="kottar"  ${h.form === 'kottar' ? 'selected' : ''}>Kottar</option>
        </select>
      </td>
      <td class="col-unit">
        <select data-id="${h.id}" data-field="use">
          <option value="kok"       ${h.use === 'kok' ? 'selected' : ''}>Kok</option>
          <option value="whirlpool" ${h.use === 'whirlpool' ? 'selected' : ''}>Whirlpool</option>
          <option value="torrhumle" ${h.use === 'torrhumle' ? 'selected' : ''}>Torrhumle</option>
        </select>
      </td>
      <td class="col-result">${h.use === 'torrhumle' ? '<span class="text-muted">0.0</span>' : ibuContrib}</td>
      <td class="col-action">
        <button class="btn btn-danger btn-icon" data-remove="hop" data-id="${h.id}" title="Ta bort">✕</button>
      </td>
    `;
    const formSel = tr.querySelector('[data-field="form"]');
    if (formSel && h.form) formSel.value = h.form;
    const useSel = tr.querySelector('[data-field="use"]');
    if (useSel && h.use) useSel.value = h.use;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('input').forEach((el) => {
    el.addEventListener('input', (e) => onHopInputChange(e, recalculateCallback));
    el.addEventListener('change', (e) => onHopInputChange(e, recalculateCallback));
  });
  tbody.querySelectorAll('select').forEach((el) => {
    el.addEventListener('change', (e) => onHopInputChange(e, recalculateCallback));
  });
  tbody.querySelectorAll('[data-remove="hop"]').forEach((btn) => {
    btn.addEventListener('click', () => removeHop(parseInt(btn.dataset.id, 10), recalculateCallback));
  });

  const totalG = State.hops.reduce((s, h) => s + (h.amount || 0), 0);
  const totalGEl = document.getElementById('hops-total-g');
  const totalIbuEl = document.getElementById('hops-total-ibu');

  if (totalGEl) totalGEl.textContent = `${totalG.toFixed(0)} g`;
  if (totalIbuEl) totalIbuEl.textContent = `${ibuResult.total.toFixed(1)} IBU`;
}

function onHopInputChange(e, recalculateCallback) {
  const id = parseInt(e.target.dataset.id, 10);
  const field = e.target.dataset.field;
  const h = State.hops.find((item) => item.id === id);
  if (!h) return;

  const val =
    field === 'name' || field === 'form' || field === 'use'
      ? e.target.value
      : field === 'whirlpoolTemp'
        ? (Number.isFinite(parseFloat(e.target.value)) ? parseFloat(e.target.value) : 80)
        : parseFloat(e.target.value) || 0;
  h[field] = val;

  if (field === 'use') {
    renderHopsTable(recalculateCallback);
  }
  recalculateCallback();
}

function removeHop(id, recalculateCallback) {
  State.hops = State.hops.filter((h) => h.id !== id);
  renderHopsTable(recalculateCallback);
  recalculateCallback();
}

export function addHop(hop, recalculateCallback) {
  const alphaDefault = (hop.alpha_min + hop.alpha_max) / 2;
  State.hops.push({
    id: generateId(),
    name: hop.name,
    amount: 25,
    alpha: Math.round(alphaDefault * 10) / 10,
    time: 60,
    form: 'pellets',
    use: 'kok',
    whirlpoolTemp: 80,
    dryHopDay: 7,
    dryHopDays: 3,
  });
  renderHopsTable(recalculateCallback);
  recalculateCallback();
}
