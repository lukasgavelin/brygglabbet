/**
 * Continuous Press (Auto-Repeat) Stepper Utility for Mobile Touch & Pointer Events.
 * Handles both standard single taps/clicks (including programmatic click & keyboard)
 * and smooth acceleration when holding down + or - buttons on touchscreens.
 */

/**
 * Attaches a continuous auto-repeat listener to a container using event delegation.
 * @param {HTMLElement} container - The parent container element
 * @param {Function} stepCallback - (btn, isFirstStep) => void
 * @returns {Function} Cleanup function to remove listeners
 */
export function setupContinuousStepperDelegation(container, stepCallback) {
  if (!container) return () => {};

  let activeTimer = null;
  let activeInterval = null;
  let activeBtn = null;
  let didRepeat = false;
  let tickCount = 0;

  function stopRepeat() {
    if (activeTimer) {
      clearTimeout(activeTimer);
      activeTimer = null;
    }
    if (activeInterval) {
      clearInterval(activeInterval);
      activeInterval = null;
    }
    if (activeBtn) {
      activeBtn.classList.remove('stepper-active');
      activeBtn = null;
    }
  }

  function handlePointerDown(e) {
    const btn = e.target.closest('.stepper-btn');
    if (!btn || e.button > 0) return; // Only primary pointer

    stopRepeat();
    activeBtn = btn;
    didRepeat = false;
    tickCount = 0;
    btn.classList.add('stepper-active');

    activeTimer = setTimeout(() => {
      didRepeat = true;
      let intervalMs = 95;

      const runInterval = () => {
        if (!activeBtn) return;
        tickCount++;
        stepCallback(activeBtn, false);

        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          try {
            navigator.vibrate(6);
          } catch {
            // Ignore vibration errors
          }
        }

        if (tickCount > 6 && intervalMs > 45) {
          intervalMs = Math.max(40, intervalMs - 10);
          clearInterval(activeInterval);
          activeInterval = setInterval(runInterval, intervalMs);
        }
      };

      runInterval();
      activeInterval = setInterval(runInterval, intervalMs);
    }, 320);
  }

  function handleClick(e) {
    const btn = e.target.closest('.stepper-btn');
    if (!btn) return;

    if (didRepeat) {
      // Suppress trailing click after long-press repetition
      didRepeat = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Standard tap / click / keyboard Space/Enter / programmatic click()
    stepCallback(btn, true);

    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(6);
      } catch {
        // Ignore vibration errors
      }
    }
  }

  container.addEventListener('pointerdown', handlePointerDown);
  container.addEventListener('click', handleClick);
  window.addEventListener('pointerup', stopRepeat);
  window.addEventListener('pointercancel', stopRepeat);

  return () => {
    container.removeEventListener('pointerdown', handlePointerDown);
    container.removeEventListener('click', handleClick);
    window.removeEventListener('pointerup', stopRepeat);
    window.removeEventListener('pointercancel', stopRepeat);
    stopRepeat();
  };
}
