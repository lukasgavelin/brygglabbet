import { describe, it, expect, beforeEach, vi } from 'vitest';
import { State, createInitialState } from '../src/state.js';
import { mountModals } from '../src/ui/templates/modalsTemplate.js';
import { mountMobileAppView } from '../src/ui/mobile/mobileTemplate.js';
import { setupSyncBridge, syncInputsFromState } from '../src/ui/syncBridge.js';
import { updateStyleMatch } from '../src/ui/styleMatch.js';
import { populateEquipmentSelector } from '../src/ui/equipment.js';
import { populateWaterProfileSelector } from '../src/ui/water.js';
import { populateYeastSelector } from '../src/ui/yeast.js';

describe('Arkitektur & Modularisering: index.html & Desktop-Mobil Sanering', () => {
  beforeEach(() => {
    Object.assign(State, createInitialState());
    document.body.innerHTML = `
      <div id="desktop-app-view">
        <input type="text" id="recipe-name-input" value="">
        <input type="number" id="batch-volume" value="20">
        <input type="number" id="boil-volume" value="25">
        <input type="number" id="boil-time" value="60">
        <input type="number" id="efficiency" value="75">
        <select id="recipe-style"></select>
        <select id="equipment-preset"></select>
        <select id="water-profile-preset"></select>
        <select id="yeast-select"></select>
        <div id="style-match-name"></div>
        <div id="style-bars-container"></div>
      </div>
      <div id="mobile-app-view" class="view-hidden"></div>
      <div id="modals-root"></div>
    `;
  });

  describe('Template Modularisering', () => {
    it('genererar och monterar alla 7 modaler i #modals-root', () => {
      expect(document.getElementById('modal-tools')).toBeNull();
      mountModals();

      expect(document.getElementById('modal-fermentable')).not.toBeNull();
      expect(document.getElementById('modal-hop')).not.toBeNull();
      expect(document.getElementById('modal-recipes')).not.toBeNull();
      expect(document.getElementById('modal-preset-recipes')).not.toBeNull();
      expect(document.getElementById('modal-scale-recipe')).not.toBeNull();
      expect(document.getElementById('modal-swe-info')).not.toBeNull();
      expect(document.getElementById('modal-tools')).not.toBeNull();
      expect(document.getElementById('modal-share-qr')).not.toBeNull();
    });

    it('mountModals är idempotent och duplicerar inte noder', () => {
      mountModals();
      const firstCount = document.querySelectorAll('.modal-overlay').length;
      expect(firstCount).toBe(8);

      mountModals();
      const secondCount = document.querySelectorAll('.modal-overlay').length;
      expect(secondCount).toBe(8);
    });

    it('genererar och monterar mobilvyn i #mobile-app-view', () => {
      expect(document.getElementById('mobile-batch-volume')).toBeNull();
      mountMobileAppView();

      expect(document.getElementById('mobile-recipe-name')).not.toBeNull();
      expect(document.getElementById('mobile-batch-volume')).not.toBeNull();
      expect(document.getElementById('mobile-boil-volume')).not.toBeNull();
      expect(document.getElementById('mobile-equipment-preset')).not.toBeNull();
      expect(document.getElementById('mobile-screen-container')).not.toBeNull();
      expect(document.querySelector('.mobile-bottom-nav')).not.toBeNull();
    });

    it('mountMobileAppView är idempotent', () => {
      mountMobileAppView();
      const firstChildCount = document.getElementById('mobile-app-view').children.length;
      mountMobileAppView();
      const secondChildCount = document.getElementById('mobile-app-view').children.length;
      expect(secondChildCount).toBe(firstChildCount);
    });
  });

  describe('Unifierad Selector Population (Desktop + Mobil)', () => {
    beforeEach(() => {
      mountMobileAppView();
    });

    it('populerar utrustningsprofiler på både desktop och mobil samtidigt', () => {
      populateEquipmentSelector();
      const desktopSel = document.getElementById('equipment-preset');
      const mobileSel = document.getElementById('mobile-equipment-preset');

      expect(desktopSel.options.length).toBeGreaterThan(3);
      expect(mobileSel.options.length).toBe(desktopSel.options.length);
      expect(mobileSel.options[0].value).toBe(desktopSel.options[0].value);
    });

    it('populerar vattenprofiler på både desktop och mobil samtidigt', () => {
      populateWaterProfileSelector();
      const desktopSel = document.getElementById('water-profile-preset');
      const mobileSel = document.getElementById('mobile-water-preset');

      expect(desktopSel.options.length).toBeGreaterThan(4);
      expect(mobileSel.options.length).toBe(desktopSel.options.length);
      expect(mobileSel.options[1].value).toContain('Stockholm');
    });

    it('populerar jästval på både desktop och mobil samtidigt', () => {
      populateYeastSelector();
      const desktopSel = document.getElementById('yeast-select');
      const mobileSel = document.getElementById('mobile-yeast-select');

      expect(desktopSel.querySelectorAll('option').length).toBeGreaterThan(10);
      expect(mobileSel.querySelectorAll('option').length).toBe(desktopSel.querySelectorAll('option').length);
    });
  });

  describe('SyncBridge: Dubbelriktad synkronisering och State-konsistens', () => {
    let recalcSpy;

    beforeEach(() => {
      mountModals();
      mountMobileAppView();
      recalcSpy = vi.fn();
      setupSyncBridge(recalcSpy);
    });

    it('synkar ändringar från desktop till mobil och uppdaterar State', () => {
      const desktopInp = document.getElementById('batch-volume');
      const mobileInp = document.getElementById('mobile-batch-volume');

      desktopInp.value = '28.5';
      desktopInp.dispatchEvent(new Event('input', { bubbles: true }));

      expect(State.recipe.batchVolume).toBe(28.5);
      expect(mobileInp.value).toBe('28.5');
      expect(recalcSpy).toHaveBeenCalled();
    });

    it('synkar ändringar från mobil till desktop och uppdaterar State', () => {
      const desktopInp = document.getElementById('batch-volume');
      const mobileInp = document.getElementById('mobile-batch-volume');

      mobileInp.value = '15';
      mobileInp.dispatchEvent(new Event('input', { bubbles: true }));

      expect(State.recipe.batchVolume).toBe(15);
      expect(desktopInp.value).toBe('15');
      expect(recalcSpy).toHaveBeenCalled();
    });

    it('hanterar delegerade utrustningsförlust-steppers på mobilvyn', () => {
      State.equipment = { boilOffRate: 3.0, kettleLoss: 2.0, grainAbsorption: 0.96, mashRatio: 3.0 };
      const boilOffPlusBtn = document.querySelector('.stepper-btn[data-eq-loss="boilOffRate"][data-dir="0.5"]');

      expect(boilOffPlusBtn).not.toBeNull();
      boilOffPlusBtn.click();

      expect(State.equipment.boilOffRate).toBeCloseTo(3.5, 2);
      expect(recalcSpy).toHaveBeenCalled();
    });

    it('hanterar delegerade salt-steppers och direkta inmatningar på mobilvyn', () => {
      State.water.salts = { gypsum: 2.0, calciumChloride: 1.0, epsomSalt: 0, tableSalt: 0 };
      const gypsumMinusBtn = document.querySelector('.stepper-btn[data-salt="gypsum"][data-dir="-1"]');

      expect(gypsumMinusBtn).not.toBeNull();
      gypsumMinusBtn.click();

      expect(State.water.salts.gypsum).toBeCloseTo(1.5, 1);
      expect(recalcSpy).toHaveBeenCalled();

      // Direkt saltinmatning
      const cacl2Inp = document.getElementById('mobile-salt-calciumChloride');
      cacl2Inp.value = '4.5';
      cacl2Inp.dispatchEvent(new Event('input', { bubbles: true }));

      expect(State.water.salts.calciumChloride).toBe(4.5);
      expect(recalcSpy).toHaveBeenCalled();
    });

    it('syncInputsFromState uppdaterar alla fält från State utan att störa aktivt element', () => {
      State.recipe.name = 'Humlekraft APA';
      State.recipe.batchVolume = 22;
      State.recipe.notes = 'Testnotering';

      syncInputsFromState();

      expect(document.getElementById('recipe-name-input').value).toBe('Humlekraft APA');
      expect(document.getElementById('mobile-recipe-name').value).toBe('Humlekraft APA');
      expect(document.getElementById('batch-volume').value).toBe('22');
      expect(document.getElementById('mobile-batch-volume').value).toBe('22');
      expect(document.getElementById('mobile-recipe-notes').value).toBe('Testnotering');
    });
  });

  describe('Unifierad Style Matching', () => {
    beforeEach(() => {
      mountMobileAppView();
    });

    it('uppdaterar både desktop- och mobil-stilmatchningsgrafer synkront', () => {
      const mockMetrics = {
        og: 1.055,
        fg: 1.012,
        abv: 5.6,
        ibu: 42,
        ebc: 14,
      };

      updateStyleMatch(mockMetrics, '18B'); // American Pale Ale

      const desktopBars = document.getElementById('style-bars-container');
      const mobileBars = document.getElementById('mobile-style-bars-container');

      expect(desktopBars.textContent).toContain('OG');
      expect(desktopBars.textContent).toContain('IBU');
      expect(mobileBars.textContent).toContain('OG');
      expect(mobileBars.textContent).toContain('IBU');

      expect(document.getElementById('style-match-name').textContent).toContain('American Pale Ale');
      expect(document.getElementById('mobile-style-match-name').textContent).toContain('American Pale Ale');
    });
  });
});
