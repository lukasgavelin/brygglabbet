/**
 * Modal dialogs and ingredient picker UI component.
 */

import { MALTS, HOPS } from '../core/data.js';
import { ebcToColor } from '../core/calculations.js';
import { addFermentable } from './fermentables.js';
import { addHop } from './hops.js';
import { escHtml } from './toast.js';
import { mountModals } from './templates/modalsTemplate.js';

export function openModal(id) {
  mountModals();
  document.getElementById(id)?.classList.remove('hidden');
}

export function closeModal(id) {
  document.getElementById(id)?.classList.add('hidden');
}

/**
 * Displays an in-app confirm modal returning a Promise that resolves to true or false.
 * Ersätter blockerande window.confirm med en tillgänglig Amber UI-dialog.
 * @param {object} [options]
 * @param {string} [options.title='Bekräfta']
 * @param {string} [options.message='Är du säker på att du vill fortsätta?']
 * @param {string} [options.confirmText='Bekräfta']
 * @param {string} [options.cancelText='Avbryt']
 * @param {boolean} [options.danger=false]
 * @returns {Promise<boolean>}
 */
export function showConfirmDialog({
  title = 'Bekräfta',
  message = 'Är du säker på att du vill fortsätta?',
  confirmText = 'Bekräfta',
  cancelText = 'Avbryt',
  danger = false,
} = {}) {
  mountModals();
  const modal = document.getElementById('modal-confirm');
  if (!modal) {
    return Promise.resolve(typeof window !== 'undefined' && window.confirm ? window.confirm(message) : true);
  }

  const titleEl = document.getElementById('confirm-dialog-title');
  const msgEl = document.getElementById('confirm-dialog-message');
  const okBtn = document.getElementById('btn-confirm-ok');
  const cancelBtn = document.getElementById('btn-confirm-cancel');
  const closeBtn = document.getElementById('btn-confirm-close');

  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;
  if (okBtn) {
    okBtn.textContent = confirmText;
    okBtn.className = danger ? 'btn btn-danger' : 'btn btn-primary';
  }
  if (cancelBtn) cancelBtn.textContent = cancelText;

  openModal('modal-confirm');
  okBtn?.focus();

  return new Promise((resolve) => {
    let resolved = false;

    const cleanup = () => {
      resolved = true;
      closeModal('modal-confirm');
      okBtn?.removeEventListener('click', onOk);
      cancelBtn?.removeEventListener('click', onCancel);
      closeBtn?.removeEventListener('click', onCancel);
      modal.removeEventListener('click', onOverlay);
      window.removeEventListener('keydown', onKeyDown);
    };

    const onOk = (e) => {
      e?.preventDefault?.();
      if (resolved) return;
      cleanup();
      resolve(true);
    };

    const onCancel = (e) => {
      e?.preventDefault?.();
      if (resolved) return;
      cleanup();
      resolve(false);
    };

    const onOverlay = (e) => {
      if (e.target === modal) onCancel(e);
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCancel(e);
      } else if (e.key === 'Enter' && document.activeElement === okBtn) {
        onOk(e);
      }
    };

    okBtn?.addEventListener('click', onOk);
    cancelBtn?.addEventListener('click', onCancel);
    closeBtn?.addEventListener('click', onCancel);
    modal.addEventListener('click', onOverlay);
    window.addEventListener('keydown', onKeyDown);
  });
}

export function setupModalClose() {
  mountModals();
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
    base: 'Basmalt',
    cara: 'Karamellmalt & Kristallmalt',
    roasted: 'Rostad malt',
    adjunct: 'Adjunkter & Flingor',
    sugar: 'Socker, Maltextrakt & Tillsatser',
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
