/**
 * Style match comparison bars in the sidebar and mobile summary screen.
 */

import { STYLES } from '../core/data.js';
import { checkStyleMatch, formatSG } from '../core/calculations.js';

export function updateStyleMatch(values, styleId) {
  const nameEl = document.getElementById('style-match-name');
  const barsEl = document.getElementById('style-bars-container');
  const mobileNameEl = document.getElementById('mobile-style-match-name');
  const mobileBarsEl = document.getElementById('mobile-style-bars-container');

  if (!styleId) {
    if (nameEl) {
      nameEl.innerHTML = `
        <div style="font-size:0.83rem; color:var(--text-muted); margin-bottom:6px;">Ingen ölstil vald</div>
        <button type="button" class="btn btn-ghost btn-sm" id="btn-jump-to-style" style="border:1px dashed var(--border); width:100%; justify-content:center; font-size:0.78rem;">
          🎯 Välj ölstil för att jämföra
        </button>
      `;
      document.getElementById('btn-jump-to-style')?.addEventListener('click', () => {
        const sec = document.getElementById('sec-equipment');
        if (sec && sec.classList.contains('collapsed')) {
          sec.classList.remove('collapsed');
        }
        const sel = document.getElementById('recipe-style');
        if (sel) {
          sel.scrollIntoView({ behavior: 'smooth', block: 'center' });
          sel.focus();
        }
      });
    }
    if (barsEl) barsEl.innerHTML = '';
    if (mobileNameEl) mobileNameEl.textContent = 'Välj en ölstil ovan';
    if (mobileBarsEl) mobileBarsEl.innerHTML = '';
    return;
  }

  const style = STYLES.find((s) => s.id === styleId);
  if (!style) {
    if (nameEl) nameEl.textContent = '—';
    if (barsEl) barsEl.innerHTML = '';
    if (mobileNameEl) mobileNameEl.textContent = '—';
    if (mobileBarsEl) mobileBarsEl.innerHTML = '';
    return;
  }

  if (nameEl) nameEl.textContent = `${style.id} – ${style.name}`;
  if (mobileNameEl) mobileNameEl.textContent = `${style.id} – ${style.name}`;

  const match = checkStyleMatch(values, style);

  const bars = [
    {
      key: 'og',
      label: 'OG',
      min: style.og_min,
      max: style.og_max,
      val: values.og,
      fmt: (v) => formatSG(v),
    },
    {
      key: 'fg',
      label: 'FG',
      min: style.fg_min,
      max: style.fg_max,
      val: values.fg,
      fmt: (v) => formatSG(v),
    },
    {
      key: 'abv',
      label: 'ABV',
      min: style.abv_min,
      max: style.abv_max,
      val: values.abv,
      fmt: (v) => `${v.toFixed(1)}%`,
    },
    {
      key: 'ibu',
      label: 'IBU',
      min: style.ibu_min,
      max: style.ibu_max,
      val: values.ibu,
      fmt: (v) => v.toFixed(0),
    },
    {
      key: 'ebc',
      label: 'EBC',
      min: style.ebc_min,
      max: style.ebc_max,
      val: values.ebc,
      fmt: (v) => v.toFixed(0),
    },
  ];

  // 1. Render Desktop bars
  if (barsEl) {
    barsEl.innerHTML = bars
      .map((b) => {
        const slack = (b.max - b.min) * 0.3;
        const vizMin = b.min - slack;
        const vizMax = b.max + slack;
        const total = vizMax - vizMin || 1;

        const rangeLeft = Math.max(0, ((b.min - vizMin) / total) * 100);
        const rangeW = Math.min(100 - rangeLeft, ((b.max - b.min) / total) * 100);
        const indLeft = Math.min(100, Math.max(0, ((b.val - vizMin) / total) * 100));
        const inRange = match.details[b.key]?.inRange;
        const cls = inRange ? 'in-range' : 'out-range';
        const indicator =
          b.val > 0 ? `<div class="style-bar-indicator ${cls}" style="left:${indLeft}%"></div>` : '';

        return `<div class="style-bar-row">
        <div class="style-bar-header">
          <span>${b.label}</span>
          <span>${b.min}–${b.max}${b.key === 'abv' ? '%' : ''} | <b>${b.val > 0 ? b.fmt(b.val) : '—'}</b></span>
        </div>
        <div class="style-bar-track">
          <div class="style-bar-range" style="left:${rangeLeft}%;width:${rangeW}%"></div>
          ${indicator}
        </div>
      </div>`;
      })
      .join('');
  }

  // 2. Render Mobile bars
  if (mobileBarsEl) {
    mobileBarsEl.innerHTML = bars
      .map((m) => {
        const inRange = m.val >= m.min && m.val <= m.max;
        const pct = Math.min(100, Math.max(0, ((m.val - m.min) / (m.max - m.min || 1)) * 100));
        const barColor = inRange ? '#10b981' : '#ef4444';

        return `
        <div class="mobile-style-row">
          <span class="lbl">${m.label}: <strong>${m.fmt(m.val)}</strong></span>
          <div class="bar-track">
            <div class="bar-fill" style="width:${pct}%; background:${barColor}"></div>
          </div>
          <span class="range">${m.fmt(m.min)} – ${m.fmt(m.max)}</span>
        </div>`;
      })
      .join('');
  }
}
