/**
 * Share QR & Serverless Sync UI Controller.
 * Handles the QR code modal and parses incoming recipe URLs on startup.
 */

import { State } from '../state.js';
import {
  generateRecipeShareUrl,
  generateQrCodeSvg,
  decodeRecipeFromHash,
} from '../core/recipeSharing.js';
import { openModal } from './modals.js';
import { showToast } from './toast.js';
import { applyState } from '../state.js';
import { syncUIFromState } from './recipes.js';
import { toggleBrewdayView } from './brewday.js';

let activeShareMode = 'brew';

/**
 * Opens the Share / QR Code modal, generates URL and renders crisp offline SVG QR code.
 * @param {'brew'|'recipe'} [defaultMode='brew']
 */
export async function openShareQrModal(defaultMode = 'brew') {
  activeShareMode = defaultMode;

  const brewRadio = document.getElementById('share-mode-brew');
  const recipeRadio = document.getElementById('share-mode-recipe');
  if (brewRadio && recipeRadio) {
    brewRadio.checked = defaultMode === 'brew';
    recipeRadio.checked = defaultMode === 'recipe';
  }

  await renderCurrentQr();
  openModal('modal-share-qr');
}

/**
 * Regenerates the share link and SVG QR code for the active mode.
 */
async function renderCurrentQr() {
  const container = document.getElementById('share-qr-container');
  const input = document.getElementById('share-url-input');
  if (!container || !input) return;

  container.innerHTML = '<span style="color:#666; font-size:0.85rem;">Genererar QR-kod...</span>';

  try {
    const url = generateRecipeShareUrl(State, activeShareMode);
    input.value = url;

    const svg = await generateQrCodeSvg(url);
    container.innerHTML = svg;
  } catch (err) {
    console.error('[shareQr] Fel vid QR-generering:', err);
    container.innerHTML = '<span style="color:var(--danger,#ef4444); font-size:0.85rem;">Kunde inte generera QR-kod</span>';
  }
}

/**
 * Wires up mode selection radios and copy-to-clipboard button.
 */
export function setupShareQrModal() {
  // Mode selection
  document.querySelectorAll('input[name="share-target-mode"]').forEach((radio) => {
    radio.addEventListener('change', async (e) => {
      activeShareMode = e.target.value;
      await renderCurrentQr();
    });
  });

  // Copy link button
  document.getElementById('btn-copy-share-url')?.addEventListener('click', async () => {
    const input = document.getElementById('share-url-input');
    if (!input || !input.value) return;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(input.value);
      } else {
        input.select();
        document.execCommand('copy');
      }
      showToast('📋 Receptlänk kopierad till urklipp!', 'success');
    } catch {
      input.select();
      showToast('⚠️ Markera och kopiera länken manuellt', 'info');
    }
  });

  // Connect triggers across the app
  document.getElementById('btn-share-qr')?.addEventListener('click', () => openShareQrModal('brew'));
  document.getElementById('btn-share-qr-menu')?.addEventListener('click', () => openShareQrModal('brew'));
  document.getElementById('mobile-menu-share-qr')?.addEventListener('click', () => openShareQrModal('brew'));
  document.getElementById('cta-btn-share-qr')?.addEventListener('click', () => openShareQrModal('brew'));
  document.getElementById('mobile-btn-share-qr')?.addEventListener('click', () => openShareQrModal('brew'));
}

/**
 * Checks if the current window location contains an incoming recipe hash (#brew=... or #recipe=...).
 * If found, restores state and seamlessly switches to the requested view.
 * @param {Function} recalculateCallback
 * @returns {boolean} True if an incoming recipe was imported
 */
export function handleIncomingShareHash(recalculateCallback) {
  if (typeof window === 'undefined') return false;

  const hash = window.location.hash;
  if (!hash || (!hash.startsWith('#brew=') && !hash.startsWith('#recipe='))) {
    return false;
  }

  const result = decodeRecipeFromHash(hash);
  if (!result || !result.state) {
    showToast('⚠️ Kunde inte läsa in receptet från länken', 'error');
    return false;
  }

  // 1. Apply imported state
  applyState(State, result.state);

  // 2. Clear hash from URL to avoid re-triggering on reload
  try {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  } catch {
    // ignore
  }

  // 3. Update application UI
  syncUIFromState(recalculateCallback);

  showToast(`🍺 Recept "${State.recipe.name}" inläst via delad QR-länk!`, 'success', 5000);

  // 4. Auto-launch Brew Day Mode if link was created in brew mode
  if (result.mode === 'brew') {
    // Allow DOM to settle before opening brewday view
    setTimeout(() => {
      toggleBrewdayView(recalculateCallback);
    }, 100);
  }

  return true;
}
