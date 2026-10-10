import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Smoke test: boots the full app against the real index.html and exercises the
 * brewing tools modal and the mash pH/acid card.
 */
describe('UI smoke: bryggverktyg & mäsk-pH', () => {
  const renderErrors = [];

  beforeAll(async () => {
    const origError = console.error;
    console.error = (...args) => {
      if (String(args[0]).includes('[recalculate]')) renderErrors.push(args.join(' '));
      else origError(...args);
    };
    const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
    const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)[1].replace(/<script[\s\S]*?<\/script>/gi, '');
    document.body.innerHTML = body;
    window.scrollTo = () => {};
    await import('../src/main.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    const { loadPresetRecipe } = await import('../src/ui/recipes.js');
    const { PRESET_RECIPES } = await import('../src/core/data.js');
    const { recalculate } = await import('../src/ui/sidebar.js');
    loadPresetRecipe(PRESET_RECIPES.find((r) => /West Coast/i.test(r.name)).id, recalculate);
  });

  it('öppnar verktygsmodalen och renderar alla flikar utan fel', async () => {
    const { State } = await import('../src/state.js');
    document.getElementById('btn-tools').click();
    expect(document.getElementById('modal-tools').classList.contains('hidden')).toBe(false);

    for (const tab of ['carb', 'refrac', 'hydro', 'yeast', 'strike']) {
      document.querySelector(`.tools-tab[data-tool="${tab}"]`).click();
      const text = document.getElementById('tools-body').textContent;
      expect(text).not.toContain('NaN');
      expect(text).not.toContain('undefined');
    }

    // Kolsyra: ändrat mål sparas i receptet
    document.querySelector('.tools-tab[data-tool="carb"]').click();
    const vols = document.getElementById('carb-vols');
    vols.value = '2.6';
    vols.dispatchEvent(new Event('input', { bubbles: true }));
    expect(State.recipe.carbonationVols).toBe(2.6);
    expect(document.getElementById('carb-result-bottle').textContent).toMatch(/\d+ g/);
    expect(document.getElementById('carb-result-keg').textContent).toContain('bar');
  });

  it('visar mäsk-pH och syraförslag', async () => {
    const { State } = await import('../src/state.js');
    const { recalculate } = await import('../src/ui/sidebar.js');
    recalculate();
    expect(document.getElementById('w-ph-value').textContent).toMatch(/^\d\.\d\d$/);

    const cb = document.getElementById('acid-enabled');
    cb.checked = true;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
    const target = document.getElementById('acid-target-ph');
    target.value = '5.0';
    target.dispatchEvent(new Event('input', { bubbles: true }));
    recalculate();

    expect(State.water.acid.enabled).toBe(true);
    expect(document.getElementById('acid-controls').classList.contains('hidden')).toBe(false);
    const result = document.getElementById('acid-result').textContent;
    expect(result).toContain('ml');
    expect(result).not.toContain('NaN');
  });

  it('inga renderfel loggades (desktop + mobil)', () => {
    expect(renderErrors).toEqual([]);
  });
});
