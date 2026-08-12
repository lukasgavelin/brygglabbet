/**
 * Touch-friendly Stepper Control Module (+ / - step buttons).
 * Enhances numeric input-group elements with touch-friendly step buttons.
 */

/**
 * Initializes stepper (+ / -) behavior on all numeric input groups.
 * @param {Function} recalculateCallback - Callback to trigger recalculation on step
 */
export function setupInputSteppers(recalculateCallback) {
  const groups = document.querySelectorAll('.input-group');

  groups.forEach((group) => {
    const input = group.querySelector('input[type="number"]');
    if (!input || group.dataset.stepperInitialized === 'true') return;

    group.dataset.stepperInitialized = 'true';

    // Create minus button
    const btnMinus = document.createElement('button');
    btnMinus.type = 'button';
    btnMinus.className = 'stepper-btn stepper-minus';
    btnMinus.ariaLabel = 'Minska värde';
    btnMinus.innerHTML = '−';

    // Create plus button
    const btnPlus = document.createElement('button');
    btnPlus.type = 'button';
    btnPlus.className = 'stepper-btn stepper-plus';
    btnPlus.ariaLabel = 'Öka värde';
    btnPlus.innerHTML = '＋';

    // Insert minus before input if not already present
    if (!group.querySelector('.stepper-minus')) {
      group.insertBefore(btnMinus, input);
    }

    // Append plus button at end of input group if not already present
    if (!group.querySelector('.stepper-plus')) {
      group.appendChild(btnPlus);
    }

    const stepValue = () => {
      const rawStep = parseFloat(input.getAttribute('step')) || 1;
      return rawStep;
    };

    const handleStep = (direction) => {
      const step = stepValue();
      const currentVal = parseFloat(input.value) || 0;
      const min = input.hasAttribute('min') ? parseFloat(input.getAttribute('min')) : -Infinity;
      const max = input.hasAttribute('max') ? parseFloat(input.getAttribute('max')) : Infinity;

      let newVal = currentVal + direction * step;
      if (newVal < min) newVal = min;
      if (newVal > max) newVal = max;

      // Format decimal places based on step
      const decimals = step.toString().split('.')[1]?.length || 0;
      input.value = decimals > 0 ? newVal.toFixed(decimals) : newVal.toString();

      // Trigger input & change events for live recalculation
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));

      if (typeof recalculateCallback === 'function') {
        recalculateCallback();
      }
    };

    btnMinus.addEventListener('click', (e) => {
      e.preventDefault();
      handleStep(-1);
    });

    btnPlus.addEventListener('click', (e) => {
      e.preventDefault();
      handleStep(1);
    });
  });
}
