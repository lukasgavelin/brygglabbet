/**
 * Yeast tab UI component.
 */

import { State } from '../state.js';
import { YEASTS } from '../core/data.js';

export function setupYeastTab(recalculateCallback) {
  const yeastSelect = document.getElementById('yeast-select');
  if (yeastSelect) {
    yeastSelect.addEventListener('change', (e) => {
      const y = YEASTS.find((item) => item.name === e.target.value);
      if (!y) return;
      State.yeast = {
        name: y.name,
        lab: y.lab,
        type: y.type,
        attMin: y.att_min,
        attMax: y.att_max,
        tempMin: y.temp_min,
        tempMax: y.temp_max,
        notes: State.yeast.notes,
      };
      syncYeastToUI();

      const card = document.getElementById('yeast-desc-card');
      const text = document.getElementById('yeast-desc-text');
      if (card && text) {
        card.style.display = y.desc ? '' : 'none';
        text.textContent = y.desc || '';
      }
      recalculateCallback();
    });
  }

  ['yeast-name', 'yeast-lab'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', (e) => {
      const field = id === 'yeast-name' ? 'name' : 'lab';
      State.yeast[field] = e.target.value;
      recalculateCallback();
    });
  });

  document.getElementById('yeast-type')?.addEventListener('change', (e) => {
    State.yeast.type = e.target.value;
    recalculateCallback();
  });

  document.getElementById('yeast-att-min')?.addEventListener('input', (e) => {
    State.yeast.attMin = parseFloat(e.target.value) || 72;
    const el = document.getElementById('att-min');
    if (el) el.value = State.yeast.attMin;
    recalculateCallback();
  });

  document.getElementById('yeast-att-max')?.addEventListener('input', (e) => {
    State.yeast.attMax = parseFloat(e.target.value) || 78;
    const el = document.getElementById('att-max');
    if (el) el.value = State.yeast.attMax;
    recalculateCallback();
  });

  document.getElementById('yeast-temp-min')?.addEventListener('input', (e) => {
    State.yeast.tempMin = parseFloat(e.target.value) || 18;
  });
  document.getElementById('yeast-temp-max')?.addEventListener('input', (e) => {
    State.yeast.tempMax = parseFloat(e.target.value) || 22;
  });
  document.getElementById('yeast-notes')?.addEventListener('input', (e) => {
    State.yeast.notes = e.target.value;
  });
}

export function syncYeastToUI() {
  const nameEl = document.getElementById('yeast-name');
  const labEl = document.getElementById('yeast-lab');
  const typeEl = document.getElementById('yeast-type');
  const attMinEl = document.getElementById('yeast-att-min');
  const attMaxEl = document.getElementById('yeast-att-max');
  const tempMinEl = document.getElementById('yeast-temp-min');
  const tempMaxEl = document.getElementById('yeast-temp-max');
  const notesEl = document.getElementById('yeast-notes');

  if (nameEl) nameEl.value = State.yeast.name || '';
  if (labEl) labEl.value = State.yeast.lab || '';
  if (typeEl) typeEl.value = State.yeast.type || 'ale';
  if (attMinEl) attMinEl.value = State.yeast.attMin || 72;
  if (attMaxEl) attMaxEl.value = State.yeast.attMax || 78;
  if (tempMinEl) tempMinEl.value = State.yeast.tempMin || 18;
  if (tempMaxEl) tempMaxEl.value = State.yeast.tempMax || 22;
  if (notesEl) notesEl.value = State.yeast.notes || '';

  const recipeAttMin = document.getElementById('att-min');
  const recipeAttMax = document.getElementById('att-max');
  if (recipeAttMin) recipeAttMin.value = State.yeast.attMin || 72;
  if (recipeAttMax) recipeAttMax.value = State.yeast.attMax || 78;
}

export function populateYeastSelector() {
  const sel = document.getElementById('yeast-select');
  if (!sel) return;

  const types = { ale: 'Ale', lager: 'Lager', wheat: 'Vete', belgian: 'Belgisk', wild: 'Vild' };
  const grouped = {};
  YEASTS.forEach((y) => {
    if (!grouped[y.type]) grouped[y.type] = [];
    grouped[y.type].push(y);
  });

  Object.keys(grouped).forEach((type) => {
    const group = document.createElement('optgroup');
    group.label = types[type] || type;
    grouped[type].forEach((y) => {
      const opt = document.createElement('option');
      opt.value = y.name;
      opt.textContent = `${y.name} (${y.lab})`;
      group.appendChild(opt);
    });
    sel.appendChild(group);
  });
}
