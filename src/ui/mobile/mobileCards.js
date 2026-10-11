/**
 * Mobile Card View Renderer for Fermentables and Hops.
 * Thumb-friendly card components with in-place DOM updates (no DOM thrashing)
 * and continuous auto-repeat steppers with acceleration.
 */

import { State } from '../../state.js';
import { computeRecipeMetrics, ebcToColor } from '../../core/calculations.js';
import { escHtml } from '../toast.js';
import { setupContinuousStepperDelegation } from './mobileStepper.js';

/**
 * Renders or updates fermentable cards on mobile with zero DOM thrashing.
 * @param {Function} recalculateCallback
 */
export function renderMobileFermentablesCards(recalculateCallback) {
  const container = document.getElementById('mobile-fermentables-list');
  const empty = document.getElementById('mobile-fermentables-empty');

  if (!container) return;

  if (State.fermentables.length === 0) {
    container.style.display = 'none';
    if (empty) empty.style.display = 'block';
    container.innerHTML = '';
    return;
  }
  container.style.display = 'flex';
  if (empty) empty.style.display = 'none';

  const metrics = computeRecipeMetrics(State);
  const ogResult = { guPerFermentable: metrics.guPerFermentable };
  const ebcResult = { perFermentable: metrics.ebcPerFermentable };
  const totalKg = State.fermentables.reduce((s, f) => s + (f.amount || 0), 0);

  // Initialize delegated listeners once
  if (!container.dataset.initialized) {
    setupFermentablesDelegation(container, recalculateCallback);
    container.dataset.initialized = 'true';
  }

  // Check if we can perform an IN-PLACE update (same IDs in same order)
  const currentCards = Array.from(container.children);
  const isMatch =
    currentCards.length === State.fermentables.length &&
    currentCards.every((card, idx) => Number(card.dataset.cardId) === Number(State.fermentables[idx]?.id));

  if (isMatch) {
    // Fast path: In-place DOM update without destroying elements or losing focus
    State.fermentables.forEach((f, idx) => {
      const card = currentCards[idx];
      const pct = totalKg > 0 ? ((f.amount / totalKg) * 100).toFixed(1) : '0.0';
      const gu = ogResult.guPerFermentable[idx]?.toFixed(1) ?? '—';
      const ebcContrib = ebcResult.perFermentable[idx]?.toFixed(1) ?? '—';

      const dot = card.querySelector('.ebc-dot');
      if (dot) dot.style.background = ebcToColor(f.ebc);

      const nameInp = card.querySelector('.mobile-input-name');
      if (nameInp && document.activeElement !== nameInp && nameInp.value !== f.name) {
        nameInp.value = f.name;
      }

      const amountInp = card.querySelector('input[data-field="amount"]');
      if (amountInp && document.activeElement !== amountInp && Number(amountInp.value) !== f.amount) {
        amountInp.value = f.amount;
      }

      const ebcInp = card.querySelector('input[data-field="ebc"]');
      if (ebcInp && document.activeElement !== ebcInp && Number(ebcInp.value) !== f.ebc) {
        ebcInp.value = f.ebc;
      }

      const tagPct = card.querySelector('.tag-pct');
      if (tagPct) tagPct.textContent = `${pct}%`;

      const tagGu = card.querySelector('.tag-gu');
      if (tagGu) tagGu.textContent = `+${gu}`;

      const tagEbc = card.querySelector('.tag-ebc');
      if (tagEbc) tagEbc.textContent = ebcContrib;
    });
    return;
  }

  // Slow path: structural change (item added/removed/reordered)
  container.innerHTML = '';

  State.fermentables.forEach((f, idx) => {
    const pct = totalKg > 0 ? ((f.amount / totalKg) * 100).toFixed(1) : '0.0';
    const gu = ogResult.guPerFermentable[idx]?.toFixed(1) ?? '—';
    const ebcContrib = ebcResult.perFermentable[idx]?.toFixed(1) ?? '—';
    const dotColor = ebcToColor(f.ebc);

    const card = document.createElement('div');
    card.className = 'mobile-card';
    card.dataset.cardId = String(f.id);
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
        <span class="mobile-meta-tag">Andel: <strong class="tag-pct">${pct}%</strong></span>
        <span class="mobile-meta-tag">OG-bidrag: <strong class="tag-gu">+${gu}</strong></span>
        <span class="mobile-meta-tag">EBC: <strong class="tag-ebc">${ebcContrib}</strong></span>
      </div>
    `;

    container.appendChild(card);
  });
}

function setupFermentablesDelegation(container, recalculateCallback) {
  // 1. Direct inputs & blur/change
  container.addEventListener('change', (e) => {
    const id = parseInt(e.target.dataset.id, 10);
    const field = e.target.dataset.field;
    if (!id || !field) return;

    const item = State.fermentables.find((f) => f.id === id);
    if (item) {
      item[field] = field === 'name' ? e.target.value : parseFloat(e.target.value) || 0;
      recalculateCallback();
    }
  });

  // 2. Remove buttons
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove="fermentable"]');
    if (!btn) return;
    const id = parseInt(btn.dataset.id, 10);
    State.fermentables = State.fermentables.filter((f) => f.id !== id);
    renderMobileFermentablesCards(recalculateCallback);
    recalculateCallback();
  });

  // 3. Continuous press steppers with auto-repeat & acceleration
  setupContinuousStepperDelegation(container, (btn) => {
    const id = parseInt(btn.dataset.id, 10);
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
}

/**
 * Renders or updates hops cards on mobile with zero DOM thrashing.
 * @param {Function} recalculateCallback
 */
export function renderMobileHopsCards(recalculateCallback) {
  const container = document.getElementById('mobile-hops-list');
  const empty = document.getElementById('mobile-hops-empty');

  if (!container) return;

  if (State.hops.length === 0) {
    container.style.display = 'none';
    if (empty) empty.style.display = 'block';
    container.innerHTML = '';
    return;
  }
  container.style.display = 'flex';
  if (empty) empty.style.display = 'none';

  const metrics = computeRecipeMetrics(State);
  const ibuResult = { total: metrics.ibu, perHop: metrics.ibuPerHop };

  // Initialize delegated listeners once
  if (!container.dataset.initialized) {
    setupHopsDelegation(container, recalculateCallback);
    container.dataset.initialized = 'true';
  }

  // Check if we can perform an IN-PLACE update
  const currentCards = Array.from(container.children);
  const isMatch =
    currentCards.length === State.hops.length &&
    currentCards.every((card, idx) => {
      const h = State.hops[idx];
      return (
        Number(card.dataset.cardId) === Number(h?.id) &&
        card.dataset.hopUse === (h?.use || 'kok')
      );
    });

  if (isMatch) {
    // Fast path: In-place DOM update
    State.hops.forEach((h, idx) => {
      const card = currentCards[idx];
      const ibuContrib = ibuResult.perHop[idx]?.toFixed(1) ?? '0.0';

      const nameInp = card.querySelector('.mobile-input-name');
      if (nameInp && document.activeElement !== nameInp && nameInp.value !== h.name) {
        nameInp.value = h.name;
      }

      const amountInp = card.querySelector('input[data-field="amount"]');
      if (amountInp && document.activeElement !== amountInp && Number(amountInp.value) !== h.amount) {
        amountInp.value = h.amount;
      }

      const alphaInp = card.querySelector('input[data-field="alpha"]');
      if (alphaInp && document.activeElement !== alphaInp && Number(alphaInp.value) !== h.alpha) {
        alphaInp.value = h.alpha;
      }

      const timeInp = card.querySelector('input[data-field="time"]');
      if (timeInp && document.activeElement !== timeInp && Number(timeInp.value) !== (h.time ?? 60)) {
        timeInp.value = h.time ?? 60;
      }

      const wpTempInp = card.querySelector('input[data-field="whirlpoolTemp"]');
      if (wpTempInp && document.activeElement !== wpTempInp && Number(wpTempInp.value) !== (h.whirlpoolTemp ?? 80)) {
        wpTempInp.value = h.whirlpoolTemp ?? 80;
      }

      const dryHopDayInp = card.querySelector('input[data-field="dryHopDay"]');
      if (dryHopDayInp && document.activeElement !== dryHopDayInp && Number(dryHopDayInp.value) !== (h.dryHopDay ?? 7)) {
        dryHopDayInp.value = h.dryHopDay ?? 7;
      }

      const dryHopDaysInp = card.querySelector('input[data-field="dryHopDays"]');
      if (dryHopDaysInp && document.activeElement !== dryHopDaysInp && Number(dryHopDaysInp.value) !== (h.dryHopDays ?? 3)) {
        dryHopDaysInp.value = h.dryHopDays ?? 3;
      }

      const tagIbu = card.querySelector('.tag-ibu');
      if (tagIbu) tagIbu.textContent = `${h.use === 'torrhumle' ? '0.0' : ibuContrib} IBU`;

      const tagForm = card.querySelector('.tag-form');
      if (tagForm) tagForm.textContent = h.form === 'kottar' ? 'Kottar' : 'Pellets';
    });
    return;
  }

  // Slow path: structural change or hop use change
  container.innerHTML = '';

  State.hops.forEach((h, idx) => {
    const ibuContrib = ibuResult.perHop[idx]?.toFixed(1) ?? '0.0';

    const card = document.createElement('div');
    card.className = 'mobile-card';
    card.dataset.cardId = String(h.id);
    card.dataset.hopUse = h.use || 'kok';
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
          <label class="mobile-field-label">Form</label>
          <select class="mobile-select" data-id="${h.id}" data-field="form">
            <option value="pellets" ${h.form === 'pellets' ? 'selected' : ''}>Pellets</option>
            <option value="kottar" ${h.form === 'kottar' ? 'selected' : ''}>Kottar</option>
          </select>
        </div>
      </div>

      ${h.use === 'whirlpool' ? `
      <div class="mobile-card-row">
        <div class="mobile-field-group">
          <label class="mobile-field-label">Whirlpooltid (min)</label>
          <div class="mobile-stepper">
            <button class="stepper-btn" data-step="time" data-dir="-1" data-id="${h.id}">–</button>
            <input type="number" inputmode="decimal" class="stepper-input" value="${h.time ?? 15}" min="0" max="120" step="5" data-id="${h.id}" data-field="time">
            <button class="stepper-btn" data-step="time" data-dir="1" data-id="${h.id}">+</button>
          </div>
        </div>

        <div class="mobile-field-group">
          <label class="mobile-field-label">Temp (°C)</label>
          <div class="mobile-stepper">
            <button class="stepper-btn" data-step="whirlpoolTemp" data-dir="-1" data-id="${h.id}">–</button>
            <input type="number" inputmode="decimal" class="stepper-input" value="${h.whirlpoolTemp ?? 80}" min="40" max="100" step="1" data-id="${h.id}" data-field="whirlpoolTemp">
            <button class="stepper-btn" data-step="whirlpoolTemp" data-dir="1" data-id="${h.id}">+</button>
          </div>
        </div>
      </div>
      ` : h.use === 'torrhumle' ? `
      <div class="mobile-card-row">
        <div class="mobile-field-group">
          <label class="mobile-field-label">Tillsätt dag</label>
          <div class="mobile-stepper">
            <button class="stepper-btn" data-step="dryHopDay" data-dir="-1" data-id="${h.id}">–</button>
            <input type="number" inputmode="decimal" class="stepper-input" value="${h.dryHopDay ?? 7}" min="0" max="60" step="1" data-id="${h.id}" data-field="dryHopDay">
            <button class="stepper-btn" data-step="dryHopDay" data-dir="1" data-id="${h.id}">+</button>
          </div>
        </div>

        <div class="mobile-field-group">
          <label class="mobile-field-label">Kontakttid (dagar)</label>
          <div class="mobile-stepper">
            <button class="stepper-btn" data-step="dryHopDays" data-dir="-1" data-id="${h.id}">–</button>
            <input type="number" inputmode="decimal" class="stepper-input" value="${h.dryHopDays ?? 3}" min="1" max="30" step="1" data-id="${h.id}" data-field="dryHopDays">
            <button class="stepper-btn" data-step="dryHopDays" data-dir="1" data-id="${h.id}">+</button>
          </div>
        </div>
      </div>
      ` : `
      <div class="mobile-field-group">
        <label class="mobile-field-label">Koktid (min)</label>
        <div class="mobile-stepper">
          <button class="stepper-btn" data-step="time" data-dir="-1" data-id="${h.id}">–</button>
          <input type="number" inputmode="decimal" class="stepper-input" value="${h.time ?? 60}" min="0" max="300" step="5" data-id="${h.id}" data-field="time">
          <button class="stepper-btn" data-step="time" data-dir="1" data-id="${h.id}">+</button>
        </div>
      </div>
      `}

      <div class="mobile-card-footer">
        <span class="mobile-meta-tag">Form: <strong class="tag-form">${h.form === 'kottar' ? 'Kottar' : 'Pellets'}</strong></span>
        <span class="mobile-meta-tag">IBU-bidrag: <strong class="tag-ibu">${h.use === 'torrhumle' ? '0.0' : ibuContrib} IBU</strong></span>
      </div>
    `;

    const useSel = card.querySelector('[data-field="use"]');
    if (useSel && h.use) useSel.value = h.use;
    const formSel = card.querySelector('[data-field="form"]');
    if (formSel && h.form) formSel.value = h.form;

    container.appendChild(card);
  });
}

function setupHopsDelegation(container, recalculateCallback) {
  // 1. Direct inputs & selects
  container.addEventListener('change', (e) => {
    const id = parseInt(e.target.dataset.id, 10);
    const field = e.target.dataset.field;
    if (!id || !field) return;

    const item = State.hops.find((h) => h.id === id);
    if (item) {
      const val =
        field === 'name' || field === 'form' || field === 'use'
          ? e.target.value
          : parseFloat(e.target.value) || 0;
      item[field] = val;
      if (field === 'use') {
        renderMobileHopsCards(recalculateCallback);
      }
      recalculateCallback();
    }
  });

  // 2. Remove buttons
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove="hop"]');
    if (!btn) return;
    const id = parseInt(btn.dataset.id, 10);
    State.hops = State.hops.filter((h) => h.id !== id);
    renderMobileHopsCards(recalculateCallback);
    recalculateCallback();
  });

  // 3. Continuous press steppers
  setupContinuousStepperDelegation(container, (btn) => {
    const id = parseInt(btn.dataset.id, 10);
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
    } else if (stepType === 'whirlpoolTemp') {
      item.whirlpoolTemp = Math.min(100, Math.max(40, (item.whirlpoolTemp ?? 80) + dir * 5));
    } else if (stepType === 'dryHopDay') {
      item.dryHopDay = Math.min(60, Math.max(0, (item.dryHopDay ?? 7) + dir));
    } else if (stepType === 'dryHopDays') {
      item.dryHopDays = Math.min(30, Math.max(1, (item.dryHopDays ?? 3) + dir));
    }
    recalculateCallback();
  });
}
