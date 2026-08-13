/**
 * Fermentables (grain bill) table UI handlers.
 */

import { State, generateId } from '../state.js';
import { calculateOG, calculateEBC, ebcToColor } from '../core/calculations.js';
import { escHtml } from './toast.js';

export function renderFermentablesTable(recalculateCallback) {
  const tbody = document.getElementById('fermentables-body');
  const empty = document.getElementById('fermentables-empty');
  const table = document.getElementById('fermentables-table');

  if (!tbody || !empty || !table) return;

  if (State.fermentables.length === 0) {
    table.style.display = 'none';
    empty.style.display = 'block';
    updateFermentableTotals([]);
    return;
  }
  table.style.display = '';
  empty.style.display = 'none';

  const ogResult = calculateOG(
    State.fermentables,
    State.recipe.batchVolume,
    State.recipe.efficiency
  );
  const ebcResult = calculateEBC(State.fermentables, State.recipe.batchVolume);
  const totalKg = State.fermentables.reduce((s, f) => s + (f.amount || 0), 0);

  tbody.innerHTML = '';
  State.fermentables.forEach((f, idx) => {
    const pct = totalKg > 0 ? ((f.amount / totalKg) * 100).toFixed(1) : '0.0';
    const gu = ogResult.guPerFermentable[idx]?.toFixed(1) ?? '—';
    const ebcContrib = ebcResult.perFermentable[idx]?.toFixed(1) ?? '—';
    const dotColor = ebcToColor(f.ebc);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-name">
        <div style="display:flex;align-items:center">
          <span class="ebc-dot" style="background:${dotColor}"></span>
          <input type="text" value="${escHtml(f.name)}" placeholder="Malt- eller råvarunamn" data-id="${f.id}" data-field="name">
        </div>
      </td>
      <td class="col-amount">
        <input type="number" inputmode="decimal" value="${f.amount}" min="0" step="0.05" data-id="${f.id}" data-field="amount">
      </td>
      <td class="col-value">
        <input type="number" inputmode="decimal" value="${f.ebc}" min="0" max="2000" step="1" data-id="${f.id}" data-field="ebc">
      </td>
      <td class="col-value">
        <input type="number" inputmode="decimal" value="${f.yield}" min="0" max="100" step="0.5" data-id="${f.id}" data-field="yield">
      </td>
      <td class="col-result">${pct}%</td>
      <td class="col-result">${gu}</td>
      <td class="col-result">${ebcContrib}</td>
      <td class="col-action">
        <button class="btn btn-danger btn-icon" data-remove="fermentable" data-id="${f.id}" title="Ta bort">✕</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('input').forEach((inp) => {
    inp.addEventListener('input', (e) => onFermentableInputChange(e, recalculateCallback));
    inp.addEventListener('change', (e) => onFermentableInputChange(e, recalculateCallback));
  });
  tbody.querySelectorAll('[data-remove="fermentable"]').forEach((btn) => {
    btn.addEventListener('click', () =>
      removeFermentable(parseInt(btn.dataset.id), recalculateCallback)
    );
  });

  updateFermentableTotals(ogResult);
}

function onFermentableInputChange(e, recalculateCallback) {
  const id = parseInt(e.target.dataset.id);
  const field = e.target.dataset.field;
  const f = State.fermentables.find((item) => item.id === id);
  if (!f) return;
  const val = field === 'name' ? e.target.value : parseFloat(e.target.value) || 0;
  f[field] = val;

  if (field === 'ebc') {
    const dot = e.target.closest('tr')?.querySelector('.ebc-dot');
    if (dot) dot.style.background = ebcToColor(val);
  }
  recalculateCallback();
}

function removeFermentable(id, recalculateCallback) {
  State.fermentables = State.fermentables.filter((f) => f.id !== id);
  renderFermentablesTable(recalculateCallback);
  recalculateCallback();
}

export function addFermentable(malt, recalculateCallback) {
  State.fermentables.push({
    id: generateId(),
    name: malt.name,
    amount: 1.0,
    ebc: malt.ebc,
    yield: malt.yield,
    type: malt.type,
  });
  renderFermentablesTable(recalculateCallback);
  recalculateCallback();
}

function updateFermentableTotals(ogResult) {
  const totalKg = State.fermentables.reduce((s, f) => s + (f.amount || 0), 0);
  const totalGU =
    typeof ogResult === 'object' && ogResult?.guPerFermentable
      ? ogResult.guPerFermentable.reduce((s, v) => s + v, 0)
      : 0;

  const totalKgEl = document.getElementById('fermentables-total-kg');
  const totalGuEl = document.getElementById('fermentables-total-gu');

  if (totalKgEl) totalKgEl.textContent = `${totalKg.toFixed(2)} kg`;
  if (totalGuEl) totalGuEl.textContent = `${totalGU.toFixed(1)} GU`;
}
