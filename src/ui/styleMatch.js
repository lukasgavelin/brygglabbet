/**
 * Style match comparison bars in the sidebar.
 */

import { STYLES } from '../core/data.js';
import { checkStyleMatch, formatSG } from '../core/calculations.js';

export function updateStyleMatch(values, styleId) {
  const nameEl = document.getElementById('style-match-name');
  const barsEl = document.getElementById('style-bars-container');
  if (!nameEl || !barsEl) return;

  if (!styleId) {
    nameEl.textContent = 'Välj en stil i Recept-fliken';
    barsEl.innerHTML = '';
    return;
  }

  const style = STYLES.find((s) => s.id === styleId);
  if (!style) {
    nameEl.textContent = '—';
    barsEl.innerHTML = '';
    return;
  }

  nameEl.textContent = `${style.id} – ${style.name}`;
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
    {
      key: 'abv',
      label: 'ABV',
      min: style.abv_min,
      max: style.abv_max,
      val: values.abv,
      fmt: (v) => `${v.toFixed(1)}%`,
    },
  ];

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
