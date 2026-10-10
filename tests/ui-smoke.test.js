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

  it('hanterar jässchema och torrhumlingsinmatning i receptet', async () => {
    const { State } = await import('../src/state.js');
    const { renderHopsTable } = await import('../src/ui/hops.js');
    const { recalculate } = await import('../src/ui/sidebar.js');
    renderHopsTable(recalculate);

    // Torrhumlingsfält i humletabellen
    const dryHopRow = Array.from(document.querySelectorAll('#hops-body tr')).find((tr) =>
      tr.querySelector('[data-field="use"]')?.value === 'torrhumle'
    );
    expect(dryHopRow).toBeDefined();
    const dayInput = dryHopRow.querySelector('[data-field="dryHopDay"]');
    const daysInput = dryHopRow.querySelector('[data-field="dryHopDays"]');
    expect(dayInput).toBeDefined();
    expect(daysInput).toBeDefined();
    dayInput.value = '5';
    dayInput.dispatchEvent(new Event('input', { bubbles: true }));
    expect(State.hops.find((h) => h.use === 'torrhumle').dryHopDay).toBe(5);

    // Jässchema i jästsektionen
    const fermProfile = document.getElementById('ferm-profile');
    const fermColdCrash = document.getElementById('ferm-coldcrash');
    const fermSummary = document.getElementById('ferm-schedule-summary');
    expect(fermProfile).toBeDefined();
    expect(fermColdCrash).toBeDefined();
    expect(fermSummary).toBeDefined();

    fermProfile.value = 'lager';
    fermProfile.dispatchEvent(new Event('change', { bubbles: true }));
    fermColdCrash.checked = true;
    fermColdCrash.dispatchEvent(new Event('change', { bubbles: true }));

    expect(fermSummary.textContent).toContain('Diacetyl');
    expect(fermSummary.textContent).toContain('Kallagring');
    expect(fermSummary.textContent).toContain('Kallkrasch');
    expect(fermSummary.textContent).not.toContain('NaN');
  });

  it('öppnar Mina bryggningar och hanterar batch, mätningar, buteljering och betyg', async () => {
    const batchesView = document.getElementById('batches-view');
    expect(batchesView).toBeDefined();

    // Öppna Mina bryggningar
    document.getElementById('btn-batches').click();
    expect(batchesView.classList.contains('hidden')).toBe(false);

    // Skapa batch från aktuellt recept
    const createBtn = document.getElementById('btn-create-batch-current') || document.getElementById('btn-create-first-batch');
    expect(createBtn).toBeDefined();
    createBtn.click();

    // Ska öppna detaljvyn direkt
    expect(document.querySelector('.batch-detail-title')).toBeDefined();
    expect(batchesView.textContent).toContain('Planerade vs Faktiska Värden');
    expect(batchesView.textContent).toContain('Jässchema & Tidslinje');

    // Lägg till en gravitetsmätning
    const rdVal = document.getElementById('rd-val');
    rdVal.value = '1.012';
    rdVal.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('btn-add-reading').click();

    expect(batchesView.textContent).toContain('1.012');
    expect(batchesView.textContent).not.toContain('NaN');

    // Testa buteljeringssektionen
    const btlVols = document.getElementById('btl-vols');
    btlVols.value = '2.5';
    btlVols.dispatchEvent(new Event('input', { bubbles: true }));
    expect(document.getElementById('btl-sugar-result').textContent).toContain('Beräknad sockergiva');
    document.getElementById('btn-save-bottling').click();

    // Sätt betyg och smaknoteringar
    const star5 = document.querySelector('.batch-star[data-star="5"]');
    expect(star5).toBeDefined();
    star5.click();
    expect(document.getElementById('star-score-text').textContent).toContain('5 av 5');

    const tastingArea = document.getElementById('batch-tasting-notes');
    tastingArea.value = 'Fantastisk arom, krispig beska och fin skumkrona!';
    document.getElementById('btn-save-tasting').click();

    // Gå tillbaka till listan
    document.getElementById('btn-back-to-list').click();
    expect(document.querySelector('.batches-grid')).toBeDefined();
    expect(batchesView.textContent).toContain('West Coast IPA');

    // Stäng Mina bryggningar
    document.getElementById('btn-close-batches').click();
    expect(batchesView.classList.contains('hidden')).toBe(true);

    // Receptets brygg-badge ska nu synas
    const brewBadge = document.getElementById('recipe-brew-badge');
    expect(brewBadge.classList.contains('hidden')).toBe(false);
    expect(brewBadge.textContent).toContain('Bryggd 1 gång');
  });

  it('stödjer mobilparitet: mäskkvot, salter, vattenvolym, mäsk-pH, humlekort och batchåtkomst', async () => {
    const { State } = await import('../src/state.js');
    const { recalculate } = await import('../src/ui/sidebar.js');

    // Växla till mobilläge
    document.getElementById('btn-switch-to-mobile').click();
    const mobileApp = document.getElementById('mobile-app-view');
    expect(mobileApp.classList.contains('view-hidden')).toBe(false);
    expect(document.body.classList.contains('mobile-mode')).toBe(true);

    // 1. Mäskkvot i mobilläge
    const prevMashRatio = State.equipment.mashRatio || 3.0;
    const mashPlusBtn = document.querySelector('.stepper-btn[data-eq-loss="mashRatio"][data-dir="0.2"]');
    expect(mashPlusBtn).toBeDefined();
    mashPlusBtn.click();
    expect(State.equipment.mashRatio).toBeCloseTo(prevMashRatio + 0.2, 2);

    // 2. Vattenvolym och salter i mobilläge
    const waterVolInp = document.getElementById('mobile-water-volume');
    expect(waterVolInp).toBeDefined();
    waterVolInp.value = '28';
    waterVolInp.dispatchEvent(new Event('input', { bubbles: true }));
    expect(State.water.volume).toBe(28);

    const prevCacl2 = State.water.salts.calciumChloride || 0;
    const cacl2PlusBtn = document.querySelector('.stepper-btn[data-salt="calciumChloride"][data-dir="1"]');
    expect(cacl2PlusBtn).toBeDefined();
    cacl2PlusBtn.click();
    expect(State.water.salts.calciumChloride).toBeCloseTo(prevCacl2 + 0.5, 1);

    // 3. Mobil Mäsk-pH & syra
    recalculate();
    const mobilePhVal = document.getElementById('mobile-w-ph-value');
    expect(mobilePhVal.textContent).toMatch(/^\d\.\d\d$/);

    const mobileAcidCb = document.getElementById('mobile-acid-enabled');
    mobileAcidCb.checked = true;
    mobileAcidCb.dispatchEvent(new Event('change', { bubbles: true }));
    const mobileAcidTarget = document.getElementById('mobile-acid-target-ph');
    mobileAcidTarget.value = '5.3';
    mobileAcidTarget.dispatchEvent(new Event('input', { bubbles: true }));
    recalculate();

    expect(State.water.acid.enabled).toBe(true);
    expect(State.water.acid.targetPH).toBe(5.3);
    const mobileAcidRes = document.getElementById('mobile-acid-result');
    expect(mobileAcidRes.textContent).toContain('ml');
    expect(mobileAcidRes.textContent).not.toContain('NaN');

    // 4. Jäsningsprofil i mobilläge
    const mobileFermProf = document.getElementById('mobile-ferm-profile');
    const mobileFermCold = document.getElementById('mobile-ferm-coldcrash');
    const mobileFermSum = document.getElementById('mobile-ferm-schedule-summary');
    expect(mobileFermProf).toBeDefined();
    expect(mobileFermCold).toBeDefined();
    expect(mobileFermSum).toBeDefined();

    mobileFermProf.value = 'kveik';
    mobileFermProf.dispatchEvent(new Event('change', { bubbles: true }));
    expect(mobileFermSum.textContent).toContain('33°C');

    mobileFermCold.checked = true;
    mobileFermCold.dispatchEvent(new Event('change', { bubbles: true }));
    expect(mobileFermSum.textContent).toContain('Kallkrasch');

    // 5. Mobil humlekort med whirlpool & torrhumling
    const hop = State.hops[0];
    expect(hop).toBeDefined();
    hop.use = 'whirlpool';
    hop.whirlpoolTemp = 82;
    recalculate();

    const wpTempInp = document.querySelector('#mobile-hops-list [data-field="whirlpoolTemp"]');
    expect(wpTempInp).toBeDefined();
    expect(Number(wpTempInp.value)).toBe(82);

    hop.use = 'torrhumle';
    hop.dryHopDay = 4;
    hop.dryHopDays = 4;
    recalculate();

    const dhDayInp = document.querySelector('#mobile-hops-list [data-field="dryHopDay"]');
    const dhDaysInp = document.querySelector('#mobile-hops-list [data-field="dryHopDays"]');
    expect(dhDayInp).toBeDefined();
    expect(dhDaysInp).toBeDefined();
    expect(Number(dhDayInp.value)).toBe(4);
    expect(Number(dhDaysInp.value)).toBe(4);

    // 6. Mobil batchåtkomst via knapp i Screen 5 och återgång till mobilläge
    const mobileBatchesBtn = document.getElementById('mobile-btn-batches');
    expect(mobileBatchesBtn).toBeDefined();
    mobileBatchesBtn.click();

    const batchesView = document.getElementById('batches-view');
    expect(batchesView.classList.contains('hidden')).toBe(false);
    expect(mobileApp.classList.contains('view-hidden')).toBe(true);

    // Stäng batches och bekräfta att vi återvänder till mobilläget
    document.getElementById('btn-close-batches').click();
    expect(batchesView.classList.contains('hidden')).toBe(true);
    expect(mobileApp.classList.contains('view-hidden')).toBe(false);

    // Återställ till desktopläge
    document.getElementById('btn-switch-to-desktop').click();
    expect(document.body.classList.contains('mobile-mode')).toBe(false);
  });

  it('verifierar UI-förbättringar: toggle-all, BU:GU-badge, stilmatchning med FG, och kveik-val', async () => {
    const { recalculate } = await import('../src/ui/sidebar.js');

    // 1. Toggle all accordions
    const toggleBtn = document.getElementById('btn-toggle-all-accordions');
    expect(toggleBtn).toBeDefined();
    toggleBtn.click();
    const allCollapsedAfter = Array.from(document.querySelectorAll('.accordion-card')).every((c) =>
      c.classList.contains('collapsed')
    );
    expect(allCollapsedAfter).toBe(true);

    toggleBtn.click();
    const anyCollapsedAfter = Array.from(document.querySelectorAll('.accordion-card')).some((c) =>
      c.classList.contains('collapsed')
    );
    expect(anyCollapsedAfter).toBe(false);

    // 2. BU:GU-badge
    recalculate();
    const buguBadge = document.getElementById('sb-bugu-badge');
    expect(buguBadge).toBeDefined();
    expect(buguBadge.style.display).not.toBe('none');
    expect(['Balanserad', 'Humlig', 'Maltfokuserad', 'Mycket bitter']).toContain(buguBadge.textContent);

    // 3. Stilmatchning med FG
    const styleBars = document.getElementById('style-bars-container');
    expect(styleBars.textContent).toContain('FG');
    expect(styleBars.textContent).toContain('OG');
    expect(styleBars.textContent).toContain('IBU');

    // 4. Kveik-option value
    const yeastSelect = document.getElementById('yeast-type');
    const kveikOpt = Array.from(yeastSelect.options).find((o) => o.textContent === 'Kveik');
    expect(kveikOpt.value).toBe('kveik');
  });

  it('inga renderfel loggades (desktop + mobil)', () => {
    expect(renderErrors).toEqual([]);
  });
});
