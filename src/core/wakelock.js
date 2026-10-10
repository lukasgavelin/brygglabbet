/**
 * Screen Wake Lock API manager.
 * Prevents screen from sleeping during active brewing sessions and countdown timers.
 * Automatically re-acquires lock upon tab refocus (visibilitychange).
 */

let wakeLockSentinel = null;
let isRequestedExplicitly = false;

/**
 * Checks whether the Wake Lock API is supported by the current browser.
 * @returns {boolean}
 */
export function isWakeLockSupported() {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

/**
 * Checks whether the screen wake lock is currently active.
 * @returns {boolean}
 */
export function isWakeLockActive() {
  return wakeLockSentinel !== null && !wakeLockSentinel.released;
}

/**
 * Requests a screen wake lock to keep the device awake.
 * @returns {Promise<boolean>} Success status
 */
export async function requestWakeLock() {
  isRequestedExplicitly = true;
  if (!isWakeLockSupported()) return false;

  try {
    if (wakeLockSentinel && !wakeLockSentinel.released) {
      return true;
    }
    wakeLockSentinel = await navigator.wakeLock.request('screen');
    wakeLockSentinel.addEventListener('release', () => {
      wakeLockSentinel = null;
    });
    return true;
  } catch (err) {
    console.warn('[WakeLock] Kunde inte aktivera skärmlås:', err);
    return false;
  }
}

/**
 * Releases the active screen wake lock.
 * @returns {Promise<void>}
 */
export async function releaseWakeLock() {
  isRequestedExplicitly = false;
  if (wakeLockSentinel) {
    try {
      await wakeLockSentinel.release();
    } catch {
      // Ignore release error
    } finally {
      wakeLockSentinel = null;
    }
  }
}

// Automatically re-request wake lock if tab becomes visible again while brew day is active
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && isRequestedExplicitly) {
      await requestWakeLock();
    }
  });
}
