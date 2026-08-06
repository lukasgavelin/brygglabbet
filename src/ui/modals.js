/**
 * Modal dialogs and ingredient picker UI component.
 */

import { MALTS, HOPS } from '../core/data.js';
import { ebcToColor } from '../core/calculations.js';
import { addFermentable } from './fermentables.js';
import { addHop } from './hops.js';
import { escHtml } from './toast.js';

export function openModal(id) {
  document.getElementById(id)?.classList.remove('hidden');
}

export function closeModal(id) {
  document.getElementById(id)?.classList.add('hidden');
}

export function setupModalClose() {
  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });
  document.querySelectorAll('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });
}

export function openFermentableModal(recalculateCallback) {
  const list = document.getElementById('fermentable-list');
  const searchInput = document.getElementById('fermentable-search');
  if (!list || !searchInput) return;

  searchInput.value = '';
  list.innerHTML = '';

  const groups = [...new Set(MALTS.map((m) => m.type))];
  const typeLabels = {
    base: 'Basmalter',
    cara: 'Karamelmalter',
    roasted: 'Rostade malter',
    adjunct: 'Adjunkter',
    sugar: 'Socker & Extrakt',
  };

  groups.forEach((type) => {
    const header = document.createElement('div');
    header.className = 'section-label';
    header.style.cssText = 'padding:8px 12px 4px; border-top:1px solid var(--border-subtle)';
    header.textContent = typeLabels[type] || type;
    list.appendChild(header);

    MALTS.filter((m) => m.type === type).forEach((malt) => {
      const item = document.createElement('div');
      item.className = 'modal-item';
      item.dataset.searchText = `${malt.name} ${malt.desc || ''}`.toLowerCase();
      item.innerHTML = `
        <span class="ebc-dot" style="background:${ebcToColor(malt.ebc)};flex-shrink:0"></span>
        <div>
          <div class="item-name">${escHtml(malt.name)}</div>
          <div class="item-sub">${escHtml(malt.desc || '')}</div>
        </div>
        <div class="item-badge">${malt.ebc} EBC · ${malt.yield}%</div>
      `;
      item.addEventListener('click', () => {
        addFermentable(malt, recalculateCallback);
        closeModal('modal-fermentable');
      });
      list.appendChild(item);
    });
  });

  openModal('modal-fermentable');
}

export function openHopModal(recalculateCallback) {
  const list = document.getElementById('hop-list');
  const searchInput = document.getElementById('hop-search');
  if (!list || !searchInput) return;

  searchInput.value = '';
  list.innerHTML = '';

  const origins = [...new Set(HOPS.map((h) => h.origin))].sort();
  origins.forEach((origin) => {
    const header = document.createElement('div');
    header.className = 'section-label';
    header.style.cssText = 'padding:8px 12px 4px; border-top:1px solid var(--border-subtle)';
    header.textContent = `Ursprung: ${origin}`;
    list.appendChild(header);

    HOPS.filter((h) => h.origin === origin).forEach((hop) => {
      const item = document.createElement('div');
      item.className = 'modal-item';
      item.dataset.searchText = `${hop.name} ${hop.desc || ''}`.toLowerCase();
      item.innerHTML = `
        <div>
          <div class="item-name">${escHtml(hop.name)}</div>
          <div class="item-sub">${escHtml(hop.desc || '')}</div>
        </div>
        <div class="item-badge">α ${hop.alpha_min}–${hop.alpha_max}%</div>
      `;
      item.addEventListener('click', () => {
        addHop(hop, recalculateCallback);
        closeModal('modal-hop');
      });
      list.appendChild(item);
    });
  });

  openModal('modal-hop');
}

export function filterModalList(listId, query) {
  const q = query.toLowerCase().trim();
  const list = document.getElementById(listId);
  if (!list) return;

  list.querySelectorAll('.modal-item').forEach((item) => {
    const match = !q || (item.dataset.searchText || '').includes(q);
    item.style.display = match ? '' : 'none';
  });

  list.querySelectorAll('.section-label').forEach((label) => {
    let next = label.nextElementSibling;
    let hasVisible = false;
    while (next && !next.classList.contains('section-label')) {
      if (next.style.display !== 'none') hasVisible = true;
      next = next.nextElementSibling;
    }
    label.style.display = hasVisible ? '' : 'none';
  });
}
