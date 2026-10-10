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

  it('öppnar bryggdagsläget och verifierar inmäskningstemperatur, syra, förkok och effektivitet', async () => {
    const { State } = await import('../src/state.js');
    const { closeModal } = await import('../src/ui/modals.js');

    // Öppna bryggdagsläget
    document.getElementById('btn-toggle-brewday').click();
    const brewdayView = document.getElementById('brewday-view');
    expect(brewdayView.classList.contains('hidden')).toBe(false);

    // Steg 1: Kontrollera strike-temp och syragivor
    const step1Body = brewdayView.querySelector('.brewday-step-card[data-step-idx="0"]');
    expect(step1Body.textContent).toContain('strike-temperatur');
    expect(step1Body.textContent).not.toContain('NaN');
    expect(step1Body.textContent).toContain('ml');

    // Klicka på steget Lakning & Vörtkontroll före kok (steg-kort)
    const cards = brewdayView.querySelectorAll('.brewday-step-card');
    const preboilCard = Array.from(cards).find((c) => c.textContent.includes('Vörtkontroll före kok'));
    expect(preboilCard).toBeDefined();
    preboilCard.click();

    // Testa inmatning av förkoksgravitet och volym
    const preboilGrav = document.getElementById('bd-preboil-grav');
    const preboilVol = document.getElementById('bd-preboil-vol');
    expect(preboilGrav).toBeDefined();
    preboilGrav.value = '1.040';
    preboilGrav.dispatchEvent(new Event('input', { bubbles: true }));
    preboilVol.value = '25';
    preboilVol.dispatchEvent(new Event('input', { bubbles: true }));

    const preboilResult = document.getElementById('bd-preboil-result');
    expect(preboilResult.textContent).toContain('Förväntat OG');
    expect(preboilResult.textContent).not.toContain('NaN');

    // Klicka på Kylning & Jäst
    const yeastCard = Array.from(cards).find((c) => c.textContent.includes('Kylning & Jästtillsats'));
    expect(yeastCard).toBeDefined();
    yeastCard.click();
    const activeYeastCard = document.querySelector('.brewday-step-card.brewday-step-active');
    expect(activeYeastCard).toBeDefined();
    expect(activeYeastCard.textContent).toContain('Beräknad jästmängd');
    expect(activeYeastCard.textContent).toContain('påse');

    // Testa att öppna jästverktyget via knappen i steget
    const openYeastBtn = document.getElementById('btn-open-yeast-tool-step');
    expect(openYeastBtn).toBeDefined();
    openYeastBtn.click();
    expect(document.getElementById('modal-tools').classList.contains('hidden')).toBe(false);
    expect(document.querySelector('.tools-tab[data-tool="yeast"]').classList.contains('active')).toBe(true);
    closeModal('modal-tools');

    // Klicka på Brygglogg & Slutförande
    const logCard = Array.from(document.querySelectorAll('.brewday-step-card')).find((c) => c.textContent.includes('Brygglogg'));
    expect(logCard).toBeDefined();
    logCard.click();

    // Mata in uppmätt OG och volym i jäskärlet
    const ogInput = document.getElementById('bd-measured-og');
    const volInput = document.getElementById('bd-measured-vol');
    ogInput.value = '1.060';
    ogInput.dispatchEvent(new Event('input', { bubbles: true }));
    volInput.value = '20';
    volInput.dispatchEvent(new Event('input', { bubbles: true }));

    const effResult = document.getElementById('bd-eff-result');
    expect(effResult.textContent).toContain('Faktisk brygghuseffektivitet');
    expect(effResult.textContent).not.toContain('NaN');

    // Klicka på uppdatera utrustningsprofil
    const updateEffBtn = document.getElementById('btn-update-profile-eff');
    expect(updateEffBtn).toBeDefined();
    updateEffBtn.click();
    expect(State.equipment.efficiency).toBeGreaterThan(0);

    // Återgå till receptet
    document.getElementById('btn-close-brewday-header').click();
    expect(brewdayView.classList.contains('hidden')).toBe(true);
  });

  it('genererar utskriftsvy utan fel', async () => {
    const { State } = await import('../src/state.js');
    State.hops.push({ id: 'hop-wp', name: 'Mosaic', amount: 30, alpha: 12, use: 'whirlpool', whirlpoolTemp: 85, time: 20 });
    // Simulera beforeprint
    window.dispatchEvent(new Event('beforeprint'));
    const printContainer = document.getElementById('print-container');
    expect(printContainer).toBeDefined();
    expect(printContainer.textContent).toContain('Mäskning');
    expect(printContainer.textContent).toContain('strike-temperatur');
    expect(printContainer.textContent).toContain('Whirlpool');
    expect(printContainer.textContent).toContain('Pre-boil Volym');
    expect(printContainer.textContent).not.toContain('NaN');
  });

  it('inga renderfel loggades (desktop + mobil)', () => {
    expect(renderErrors).toEqual([]);
  });
});
