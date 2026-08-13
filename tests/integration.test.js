import { describe, it, expect, beforeEach } from 'vitest';
import { updateAccordionBadges } from '../src/ui/tabs.js';
import { State } from '../src/state.js';

describe('updateAccordionBadges', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <span id="badge-fermentables"></span>
      <span id="badge-hops"></span>
      <span id="badge-yeast"></span>
      <span id="badge-equipment"></span>
      <span id="badge-mash"></span>
      <span id="badge-water"></span>
    `;
    State.fermentables = [{ amount: 5, ebc: 5, yield: 78 }];
    State.hops = [{ amount: 25, alpha: 5, time: 60, use: 'kok', form: 'pellets' }];
    State.recipe = { batchVolume: 20, efficiency: 75 };
  });

  it('visar rätt maltmängd i badge-fermentables', () => {
    updateAccordionBadges();
    expect(document.getElementById('badge-fermentables').textContent).toContain('5.00 kg');
  });

  it('visar positiva IBUs i badge-hops', () => {
    updateAccordionBadges();
    const text = document.getElementById('badge-hops').textContent;
    expect(text).toContain('25 g');
    expect(text).not.toContain('0 IBU');
  });
});
