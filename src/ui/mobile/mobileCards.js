/**
 * Mobile Card View Renderer for Fermentables and Hops.
 * Replaces table view on mobile with thumb-friendly card components.
 */

import { State } from '../../state.js';
import { calculateOG, calculateEBC, calculateIBU, ebcToColor } from '../../core/calculations.js';
import { escHtml } from '../toast.js';

export function renderMobileFermentablesCards(recalculateCallback) {
  const container = document.getElementById('mobile-fermentables-list');
  const empty = document.getElementById('mobile-fermentables-empty');

  if (!container) return;

  if (State.fermentables.length === 0) {
    container.style.display = 'none';
    if (empty) empty.style.display = 'block';
    return;
  }
  container.style.display = 'flex';
  if (empty) empty.style.display = 'none';

  const ogResult = calculateOG(
    State.fermentables,
    State.recipe.batchVolume,
    State.recipe.efficiency
  );
  const ebcResult = calculateEBC(State.fermentables, State.recipe.batchVolume);
  const totalKg = State.fermentables.reduce((s, f) => s + (f.amount || 0), 0);

  container.innerHTML = '';

  State.fermentables.forEach((f, idx) => {
    const pct = totalKg > 0 ? ((f.amount / totalKg) * 100).toFixed(1) : '0.0';
    const gu = ogResult.guPerFermentable[idx]?.toFixed(1) ?? '—';
    const ebcContrib = ebcResult.perFermentable[idx]?.toFixed(1) ?? '—';
    const dotColor = ebcToColor(f.ebc);

    const card = document.createElement('div');
    card.className = 'mobile-card';
    card.innerHTML = `
      <div class="mobile-card-header">
        <div class="mobile-card-title">
          <span class="ebc-dot" style="background:${dotColor}"></span>
          <input type="text" class="mobile-input-name" value="${escHtml(f.name)}" placeholder="Maltnamn..." data-id="${f.id}" data-field="name">
        </div>
        <button class="btn btn-danger btn-icon btn-sm" data-remove="fermentable" data-id="${f.id}" title="Ta bort">✕</button>
      </div>

      <div class="mobile-card-body">
        <div class="mobile-field-group">
          <label class="mobile-field-label">Mängd (kg)</label>
          <div class="mobile-stepper">
            <button class="stepper-btn" data-step="amount" data-dir="-1" data-id="${f.id}">–</button>
            <input type="number" inputmode="decimal" class="stepper-input" value="${f.amount}" min="0" step="0.05" data-id="${f.id}" data-field="amount">
            <button class="stepper-btn" data-step="amount" data-dir="1" data-id="${f.id}">+</button>
          </div>
        </div>

        <div class="mobile-field-group">
          <label class="mobile-field-label">Färg (EBC)</label>
          <div class="mobile-stepper">
            <button class="stepper-btn" data-step="ebc" data-dir="-1" data-id="${f.id}">–</button>
            <input type="number" inputmode="decimal" class="stepper-input" value="${f.ebc}" min="0" step="1" data-id="${f.id}" data-field="ebc">
            <button class="stepper-btn" data-step="ebc" data-dir="1" data-id="${f.id}">+</button>
          </div>
        </div>
      </div>

      <div class="mobile-card-footer">
        <span class="mobile-meta-tag">Andel: <strong>${pct}%</strong></span>
        <span class="mobile-meta-tag">OG-bidrag: <strong>+${gu}</strong></span>
        <span class="mobile-meta-tag">EBC: <strong>${ebcContrib}</strong></span>
      </div>
    `;

    container.appendChild(card);
  });

  // Attach input listeners
  container.querySelectorAll('input').forEach((inp) => {
    inp.addEventListener('change', (e) => {
      const id = parseInt(e.target.dataset.id);
      const field = e.target.dataset.field;
      const item = State.fermentables.find((f) => f.id === id);
      if (item) {
        item[field] = field === 'name' ? e.target.value : parseFloat(e.target.value) || 0;
        recalculateCallback();
      }
    });
  });

  // Attach stepper buttons listeners
  container.querySelectorAll('.stepper-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      const stepType = btn.dataset.step;
      const dir = parseFloat(btn.dataset.dir);
      const item = State.fermentables.find((f) => f.id === id);
      if (!item) return;

      if (stepType === 'amount') {
        const step = item.amount >= 1 ? 0.25 : 0.05;
        item.amount = Math.max(0, Math.round((item.amount + dir * step) * 100) / 100);
      } else if (stepType === 'ebc') {
        const step = item.ebc >= 50 ? 5 : 1;
        item.ebc = Math.max(0, Math.round(item.ebc + dir * step));
      }
      recalculateCallback();
    });
  });

  // Remove buttons
  container.querySelectorAll('[data-remove="fermentable"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      State.fermentables = State.fermentables.filter((f) => f.id !== id);
      recalculateCallback();
    });
  });
}

export function renderMobileHopsCards(recalculateCallback) {
  const container = document.getElementById('mobile-hops-list');
  const empty = document.getElementById('mobile-hops-empty');

  if (!container) return;

  if (State.hops.length === 0) {
    container.style.display = 'none';
    if (empty) empty.style.display = 'block';
    return;
  }
  container.style.display = 'flex';
  if (empty) empty.style.display = 'none';

  const ogResult = calculateOG(
    State.fermentables,
    State.recipe.batchVolume,
    State.recipe.efficiency
  );
  const ibuResult = calculateIBU(State.hops, ogResult.sg, State.recipe.batchVolume);

  container.innerHTML = '';

  State.hops.forEach((h, idx) => {
    const ibuContrib = ibuResult.perHop[idx]?.toFixed(1) ?? '0.0';

    const card = document.createElement('div');
    card.className = 'mobile-card';
    card.innerHTML = `
      <div class="mobile-card-header">
        <div class="mobile-card-title">
          <span class="hop-icon">🌿</span>
          <input type="text" class="mobile-input-name" value="${escHtml(h.name)}" placeholder="Humlenamn..." data-id="${h.id}" data-field="name">
        </div>
        <button class="btn btn-danger btn-icon btn-sm" data-remove="hop" data-id="${h.id}" title="Ta bort">✕</button>
      </div>

      <div class="mobile-card-body">
        <div class="mobile-field-group">
          <label class="mobile-field-label">Mängd (g)</label>
          <div class="mobile-stepper">
            <button class="stepper-btn" data-step="amount" data-dir="-1" data-id="${h.id}">–</button>
            <input type="number" inputmode="decimal" class="stepper-input" value="${h.amount}" min="0" step="1" data-id="${h.id}" data-field="amount">
            <button class="stepper-btn" data-step="amount" data-dir="1" data-id="${h.id}">+</button>
          </div>
        </div>

        <div class="mobile-field-group">
          <label class="mobile-field-label">Alfa-syra (%)</label>
          <div class="mobile-stepper">
            <button class="stepper-btn" data-step="alpha" data-dir="-1" data-id="${h.id}">–</button>
            <input type="number" inputmode="decimal" class="stepper-input" value="${h.alpha}" min="0" max="30" step="0.1" data-id="${h.id}" data-field="alpha">
            <button class="stepper-btn" data-step="alpha" data-dir="1" data-id="${h.id}">+</button>
          </div>
        </div>
      </div>

      <div class="mobile-card-row">
        <div class="mobile-field-group">
          <label class="mobile-field-label">Användning</label>
          <select class="mobile-select" data-id="${h.id}" data-field="use">
            <option value="kok" ${h.use === 'kok' ? 'selected' : ''}>Kok</option>
            <option value="whirlpool" ${h.use === 'whirlpool' ? 'selected' : ''}>Whirlpool</option>
            <option value="torrhumle" ${h.use === 'torrhumle' ? 'selected' : ''}>Torrhumle</option>
          </select>
        </div>

        <div class="mobile-field-group">
          <label class="mobile-field-label">Kocktid (min)</label>
          <div class="mobile-stepper">
            <button class="stepper-btn" data-step="time" data-dir="-1" data-id="${h.id}" ${h.use === 'torrhumle' ? 'disabled' : ''}>–</button>
            <input type="number" inputmode="decimal" class="stepper-input" value="${h.time}" min="0" max="300" step="5" data-id="${h.id}" data-field="time" ${h.use === 'torrhumle' ? 'disabled' : ''}>
            <button class="stepper-btn" data-step="time" data-dir="1" data-id="${h.id}" ${h.use === 'torrhumle' ? 'disabled' : ''}>+</button>
          </div>
        </div>
      </div>

      <div class="mobile-card-footer">
        <span class="mobile-meta-tag">Form: <strong>${h.form || 'Pellets'}</strong></span>
        <span class="mobile-meta-tag">IBU-bidrag: <strong>${h.use === 'torrhumle' ? '0.0' : ibuContrib} IBU</strong></span>
      </div>
    `;

    container.appendChild(card);
  });

  // Attach input listeners
  container.querySelectorAll('input, select').forEach((el) => {
    el.addEventListener('change', (e) => {
      const id = parseInt(e.target.dataset.id);
      const field = e.target.dataset.field;
      const item = State.hops.find((h) => h.id === id);
      if (item) {
        const val =
          field === 'name' || field === 'form' || field === 'use'
            ? e.target.value
            : parseFloat(e.target.value) || 0;
        item[field] = val;
        recalculateCallback();
      }
    });
  });

  // Attach stepper buttons listeners
  container.querySelectorAll('.stepper-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      const stepType = btn.dataset.step;
      const dir = parseFloat(btn.dataset.dir);
      const item = State.hops.find((h) => h.id === id);
      if (!item) return;

      if (stepType === 'amount') {
        const step = item.amount >= 50 ? 10 : 5;
        item.amount = Math.max(0, Math.round(item.amount + dir * step));
      } else if (stepType === 'alpha') {
        item.alpha = Math.max(0, Math.round((item.alpha + dir * 0.5) * 10) / 10);
      } else if (stepType === 'time') {
        item.time = Math.max(0, Math.round(item.time + dir * 5));
      }
      recalculateCallback();
    });
  });

  // Remove buttons
  container.querySelectorAll('[data-remove="hop"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      State.hops = State.hops.filter((h) => h.id !== id);
      recalculateCallback();
    });
  });
}
