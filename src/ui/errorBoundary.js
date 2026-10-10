/**
 * Global Error Boundary & Crash Recovery Module.
 * Catches uncaught runtime exceptions and unhandled promise rejections,
 * preserves current work via autosave, filters out extension noise,
 * and presents actionable recovery controls (undo, reload, copy report).
 */

import { State, undoState } from '../state.js';
import { autosaveSession, syncUIFromState } from './recipes.js';
import { recalculate } from './sidebar.js';
import { escHtml } from './toast.js';

let lastErrorTimestamp = 0;
let lastErrorMessage = '';
let isErrorBoundaryActive = false;

/**
 * Determines whether an error is likely noise from browser extensions or benign DOM observers.
 * @param {string} message
 * @param {string} [stack]
 * @returns {boolean}
 */
export function isIgnorableError(message = '', stack = '') {
  const combined = `${message} ${stack}`.toLowerCase();

  // ResizeObserver benign loop notification in Chromium / Firefox
  if (combined.includes('resizeobserver loop')) return true;

  // Browser extensions (Chrome, Firefox, Safari)
  if (
    combined.includes('chrome-extension://') ||
    combined.includes('moz-extension://') ||
    combined.includes('safari-extension://')
  ) {
    return true;
  }

  // Cross-origin generic script errors with zero actionable information
  if (message === 'Script error.' && !stack) return true;

  return false;
}

/**
 * Formats a debug report with error details and application state.
 * @param {Error|string} err
 * @returns {string}
 */
export function generateErrorReport(err) {
  const time = new Date().toISOString();
  const msg = err?.message || String(err);
  const stack = err?.stack || 'Ingen stacktrace tillgänglig';
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A';
  let stateSnippet = 'N/A';
  try {
    stateSnippet = JSON.stringify({
      recipe: State?.recipe?.name,
      fermentablesCount: State?.fermentables?.length,
      hopsCount: State?.hops?.length,
      mashCount: State?.mash?.length,
    });
  } catch {
    // ignore
  }

  return `--- BRYGGLABBET FELRAPPORT ---
Tid: ${time}
Fel: ${msg}
User Agent: ${ua}
Tillstånd: ${stateSnippet}

Stack:
${stack}
-----------------------------`;
}

/**
 * Renders or updates the persistent crash recovery banner in the UI.
 * @param {string} errorMessage
 * @param {string} fullReport
 */
function displayRecoveryBanner(errorMessage, fullReport) {
  if (typeof document === 'undefined') return;

  let container = document.getElementById('brygglabbet-error-boundary');
  if (!container) {
    container = document.createElement('div');
    container.id = 'brygglabbet-error-boundary';
    container.setAttribute('role', 'alert');
    container.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      max-width: 440px;
      width: calc(100% - 48px);
      background: var(--bg-card, #231b14);
      border: 2px solid var(--danger, #ef4444);
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6);
      border-radius: 12px;
      padding: 16px 20px;
      color: var(--text-main, #f3ede2);
      z-index: 999999;
      font-family: inherit;
      animation: fadeInError 0.25s ease-out;
    `;
    document.body.appendChild(container);
  }

  const shortMsg = errorMessage.length > 120 ? `${errorMessage.slice(0, 120)}...` : errorMessage;

  container.innerHTML = `
    <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:8px;">
      <div style="font-weight:700; font-size:1rem; color:var(--danger, #ef4444); display:flex; align-items:center; gap:6px;">
        <span>⚠️</span>
        <span>Ett oväntat fel uppstod</span>
      </div>
      <button id="error-boundary-close" style="background:none; border:none; color:var(--text-muted, #9e9185); cursor:pointer; font-size:1.2rem; padding:0 4px;" title="Stäng meddelande">✕</button>
    </div>
    <div style="font-size:0.85rem; color:var(--text-muted, #9e9185); margin-bottom:12px; word-break:break-word;">
      ${escHtml(shortMsg)}
    </div>
    <div style="display:flex; flex-wrap:wrap; gap:8px;">
      <button id="error-boundary-undo" class="btn btn-sm btn-primary" style="flex:1; min-width:110px;">
        ↩️ Ångra
      </button>
      <button id="error-boundary-reload" class="btn btn-sm btn-secondary" style="flex:1; min-width:90px;">
        🔄 Ladda om
      </button>
      <button id="error-boundary-copy" class="btn btn-sm btn-ghost" style="padding:4px 8px; font-size:0.8rem;" title="Kopiera felrapport för felsökning">
        📋 Kopiera fel
      </button>
    </div>
  `;

  container.querySelector('#error-boundary-close')?.addEventListener('click', () => {
    container.remove();
  });

  container.querySelector('#error-boundary-undo')?.addEventListener('click', () => {
    try {
      undoState(() => {
        syncUIFromState(recalculate);
      });
      container.remove();
    } catch (e) {
      console.error('[ErrorBoundary] Kunde inte ångra:', e);
    }
  });

  container.querySelector('#error-boundary-reload')?.addEventListener('click', () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  });

  container.querySelector('#error-boundary-copy')?.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(fullReport).then(() => {
        btn.textContent = '✅ Kopierat!';
        setTimeout(() => {
          btn.textContent = '📋 Kopiera fel';
        }, 2000);
      }).catch(() => {
        btn.textContent = '⚠️ Kunde ej kopiera';
      });
    }
  });
}

/**
 * Handles an uncaught exception or rejection.
 * @param {Error|*} err
 * @param {string} source
 */
export function handleUncaughtError(err, source = 'error') {
  try {
    const msg = err?.message || String(err || 'Okänt fel');
    const stack = err?.stack || '';

    if (isIgnorableError(msg, stack)) {
      return;
    }

    const now = Date.now();
    // Throttle identical notifications to avoid loop cascades
    if (now - lastErrorTimestamp < 4000 && lastErrorMessage === msg) {
      return;
    }
    lastErrorTimestamp = now;
    lastErrorMessage = msg;

    console.error(`[Brygglabbet ErrorBoundary - ${source}]:`, err);

    // Defensive autosave so unsaved work isn't lost on reload
    try {
      autosaveSession();
    } catch {
      // ignore secondary errors in autosave
    }

    const report = generateErrorReport(err);
    displayRecoveryBanner(msg, report);
  } catch (secondaryError) {
    console.error('[ErrorBoundary fatal error]:', secondaryError);
  }
}

/**
 * Initializes the global error boundary handlers.
 */
export function initErrorBoundary() {
  if (isErrorBoundaryActive || typeof window === 'undefined') return;
  isErrorBoundaryActive = true;

  window.addEventListener('error', (event) => {
    handleUncaughtError(event.error || event.message, 'window.onerror');
  });

  window.addEventListener('unhandledrejection', (event) => {
    handleUncaughtError(event.reason, 'window.unhandledrejection');
  });
}
