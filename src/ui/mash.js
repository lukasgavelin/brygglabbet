/**
 * Mash schedule UI component.
 */

import { State, generateId } from '../state.js';
import { MASH_PRESETS } from '../core/data.js';
import { escHtml } from './toast.js';

export function setupMashTab(recalculateCallback) {
  document.getElementById('btn-add-mash-step')?.addEventListener('click', () => {
    addMashStep(
      { name: 'Sackarifikation', type: 'Infusion', temp: 67, time: 60 },
      recalculateCallback
    );
  });

  document.querySelectorAll('.preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const preset = MASH_PRESETS[btn.dataset.preset];
      if (!preset) return;
      State.mash = preset.steps.map((s) => ({ ...s, id: generateId() }));
      renderMashTable(recalculateCallback);
      recalculateCallback();
    });
  });
}

export function addMashStep(stepData, recalculateCallback) {
  State.mash.push({ ...stepData, id: generateId() });
  renderMashTable(recalculateCallback);
  recalculateCallback();
}

export function renderMashTable(recalculateCallback) {
  const tbody = document.getElementById('mash-body');
  const empty = document.getElementById('mash-empty');
  const table = document.getElementById('mash-table');

  if (!tbody || !empty || !table) return;

  if (State.mash.length === 0) {
    table.style.display = 'none';
    empty.style.display = 'block';
    const totalTimeEl = document.getElementById('mash-total-time');
    const stepCountEl = document.getElementById('mash-step-count');
    if (totalTimeEl) totalTimeEl.textContent = '0 min';
    if (stepCountEl) stepCountEl.textContent = '0';
    renderMashTimeline([]);
    return;
  }
  table.style.display = '';
  empty.style.display = 'none';

  tbody.innerHTML = '';
  State.mash.forEach((s, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="color:var(--text-muted);font-size:0.8rem">${idx + 1}</td>
      <td class="col-name">
        <input type="text" value="${escHtml(s.name)}" placeholder="Stegnamn" data-id="${s.id}" data-field="name">
      </td>
      <td class="col-unit">
        <select data-id="${s.id}" data-field="type">
          <option ${s.type === 'Infusion' ? 'selected' : ''}>Infusion</option>
          <option ${s.type === 'Steg' ? 'selected' : ''}>Steg</option>
          <option ${s.type === 'Dekoktion' ? 'selected' : ''}>Dekoktion</option>
        </select>
      </td>
      <td class="col-value">
        <input type="number" inputmode="decimal" value="${s.temp}" min="20" max="100" step="1" data-id="${s.id}" data-field="temp">
      </td>
      <td class="col-value">
        <input type="number" inputmode="decimal" value="${s.time}" min="0" max="240" step="5" data-id="${s.id}" data-field="time">
      </td>
      <td class="col-action">
        <button class="btn btn-danger btn-icon" data-remove="mash" data-id="${s.id}" title="Ta bort">✕</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('input, select').forEach((el) => {
    el.addEventListener('input', (e) => onMashInputChange(e, recalculateCallback));
    el.addEventListener('change', (e) => onMashInputChange(e, recalculateCallback));
  });
  tbody.querySelectorAll('[data-remove="mash"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      State.mash = State.mash.filter((item) => item.id !== id);
      renderMashTable(recalculateCallback);
      recalculateCallback();
    });
  });

  const totalTime = State.mash.reduce((s, step) => s + (step.time || 0), 0);
  const totalTimeEl = document.getElementById('mash-total-time');
  const stepCountEl = document.getElementById('mash-step-count');

  if (totalTimeEl) totalTimeEl.textContent = `${totalTime} min`;
  if (stepCountEl) stepCountEl.textContent = `${State.mash.length}`;
  renderMashTimeline(State.mash);
}

function onMashInputChange(e, recalculateCallback) {
  const id = parseInt(e.target.dataset.id);
  const field = e.target.dataset.field;
  const s = State.mash.find((item) => item.id === id);
  if (!s) return;
  s[field] =
    field === 'name' || field === 'type' ? e.target.value : parseFloat(e.target.value) || 0;

  const totalTime = State.mash.reduce((acc, step) => acc + (step.time || 0), 0);
  const totalTimeEl = document.getElementById('mash-total-time');
  if (totalTimeEl) totalTimeEl.textContent = `${totalTime} min`;
  renderMashTimeline(State.mash);
  recalculateCallback();
}

function renderMashTimeline(steps) {
  const el = document.getElementById('mash-timeline');
  if (!el) return;
  const totalTime = steps.reduce((s, step) => s + (step.time || 0), 0);
  if (totalTime === 0 || steps.length === 0) {
    el.innerHTML = '';
    return;
  }
  const COLORS = ['#6b3210', '#8b4a18', '#a85a1c', '#c47024', '#d9832a', '#e09640'];
  el.innerHTML = steps
    .map((s, i) => {
      const pct = Math.round((s.time / totalTime) * 100);
      const col = COLORS[i % COLORS.length];
      return `<div class="mash-step-bar" style="flex:${s.time};background:${col}" title="${s.name}: ${s.temp}°C × ${s.time} min">
      ${pct > 8 ? `${s.temp}°C` : ''}
    </div>`;
    })
    .join('');
}
