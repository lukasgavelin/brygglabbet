import { describe, it, expect, beforeEach, vi } from 'vitest';
import { State, createInitialState, applyState } from '../src/state.js';
import {
  serializeRecipePayload,
  deserializeRecipePayload,
  encodeRecipeToHash,
  decodeRecipeFromHash,
  generateRecipeShareUrl,
  generateQrCodeSvg,
} from '../src/core/recipeSharing.js';
import {
  openShareQrModal,
  setupShareQrModal,
  handleIncomingShareHash,
} from '../src/ui/shareQr.js';
import { mountModals } from '../src/ui/templates/modalsTemplate.js';

describe('Serverlös Receptdelning & QR-kod Synk (Sprint 3)', () => {
  let sampleRecipeState;

  beforeEach(() => {
    Object.assign(State, createInitialState());

    sampleRecipeState = {
      recipe: {
        name: 'Gyllene Garage-IPA',
        batchVolume: 21,
        boilVolume: 26,
        boilTime: 60,
        efficiency: 78,
        styleId: '18A',
        notes: 'Torrhumlas dag 5 med Citra & Mosaic',
        carbonationVols: 2.5,
        fermentation: { profile: 'ale', coldCrash: true },
      },
      equipment: {
        id: 'gf-g30',
        name: 'Grainfather G30',
        batchVolume: 21,
        efficiency: 78,
        boilOffRate: 2.8,
        kettleLoss: 1.5,
        grainAbsorption: 0.95,
        mashRatio: 3.2,
      },
      fermentables: [
        { id: 1, name: 'Pilsnermalt', amount: 4.8, ebc: 3.5, type: 'base' },
        { id: 2, name: 'Carapils', amount: 0.4, ebc: 5.0, type: 'cara' },
      ],
      hops: [
        { id: 1, name: 'Magnum', amount: 20, alpha: 13.5, time: 60, use: 'kok' },
        { id: 2, name: 'Citra', amount: 50, alpha: 12.0, time: 15, use: 'whirlpool', whirlpoolTemp: 82 },
        { id: 3, name: 'Mosaic', amount: 60, alpha: 11.5, time: 0, use: 'torrhumle', dryHopDay: 5, dryHopDays: 4 },
      ],
      yeast: {
        name: 'US-05',
        lab: 'Fermentis',
        type: 'ale',
        attMin: 74,
        attMax: 82,
      },
      mash: [
        { id: 1, name: 'Försockring', temp: 66, time: 60, type: 'Infusion' },
        { id: 2, name: 'Utmäskning', temp: 76, time: 10, type: 'Temperature' },
      ],
      water: {
        base: { name: 'Stockholm', ca: 40, mg: 5, na: 10, cl: 15, so4: 25, hco3: 70 },
        salts: { gypsum: 3.5, calciumChloride: 2.0, epsomSalt: 0, tableSalt: 0 },
        volume: 28,
        acid: { enabled: true, type: 'lactic:80', targetPH: 5.3, treatSparge: true },
      },
    };
  });

  describe('Komprimering & Serialisering (recipeSharing.js)', () => {
    it('serialiserar och deserialiserar receptdata utan dataförlust', () => {
      const payload = serializeRecipePayload(sampleRecipeState);
      const restored = deserializeRecipePayload(payload);

      expect(restored.recipe.name).toBe('Gyllene Garage-IPA');
      expect(restored.recipe.batchVolume).toBe(21);
      expect(restored.recipe.efficiency).toBe(78);
      expect(restored.fermentables.length).toBe(2);
      expect(restored.fermentables[0].name).toBe('Pilsnermalt');
      expect(restored.hops.length).toBe(3);
      expect(restored.hops[1].whirlpoolTemp).toBe(82);
      expect(restored.hops[2].dryHopDay).toBe(5);
      expect(restored.mash.length).toBe(2);
      expect(restored.water.salts.gypsum).toBe(3.5);
      expect(restored.water.acid.enabled).toBe(true);
      expect(restored.equipment.name).toBe('Grainfather G30');
    });

    it('kodar till en url-säker hash och avkodar korrekt (#brew och #recipe)', () => {
      // 1. Brew-mode hash
      const brewHash = encodeRecipeToHash(sampleRecipeState, 'brew');
      expect(brewHash.startsWith('#brew=')).toBe(true);
      expect(brewHash.length).toBeLessThan(1200); // Komprimerad URL-säker payload

      const decodedBrew = decodeRecipeFromHash(brewHash);
      expect(decodedBrew).not.toBeNull();
      expect(decodedBrew.mode).toBe('brew');
      expect(decodedBrew.state.recipe.name).toBe('Gyllene Garage-IPA');

      // 2. Recipe-mode hash
      const recipeHash = encodeRecipeToHash(sampleRecipeState, 'recipe');
      expect(recipeHash.startsWith('#recipe=')).toBe(true);

      const decodedRecipe = decodeRecipeFromHash(recipeHash);
      expect(decodedRecipe).not.toBeNull();
      expect(decodedRecipe.mode).toBe('recipe');
      expect(decodedRecipe.state.recipe.name).toBe('Gyllene Garage-IPA');
    });

    it('genererar fullständig delningslänk med rätt bas-URL', () => {
      const url = generateRecipeShareUrl(sampleRecipeState, 'brew', 'https://brygglabbet.app/');
      expect(url.startsWith('https://brygglabbet.app/#brew=')).toBe(true);
    });

    it('hanterar ogiltiga eller skadade hash-strängar utan att krascha', () => {
      expect(decodeRecipeFromHash('')).toBeNull();
      expect(decodeRecipeFromHash('#')).toBeNull();
      expect(decodeRecipeFromHash('#invalid=corrupt_data_12345')).toBeNull();
      expect(decodeRecipeFromHash('#brew=corrupt_lz_payload!@#$%')).toBeNull();
    });

    it('genererar offline SVG QR-kod med ren vektorgrafik', async () => {
      const shareUrl = generateRecipeShareUrl(sampleRecipeState, 'brew', 'https://brygglabbet.app/');
      const svg = await generateQrCodeSvg(shareUrl);

      expect(typeof svg).toBe('string');
      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
      expect(svg).toContain('viewBox');
      expect(svg).toContain('<path');
    });
  });

  describe('UI & Inkommande Länkhantering (shareQr.js)', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="desktop-app-view">
          <input type="text" id="recipe-name-input" value="">
          <button id="btn-share-qr">Mobil / QR</button>
        </div>
        <div id="modals-root"></div>
      `;
      mountModals();
      setupShareQrModal();
    });

    it('öppnar QR-modalen och renderar SVG-grafik och länk', async () => {
      applyState(State, sampleRecipeState);

      await openShareQrModal('brew');

      const modal = document.getElementById('modal-share-qr');
      expect(modal.classList.contains('hidden')).toBe(false);

      const qrContainer = document.getElementById('share-qr-container');
      expect(qrContainer.innerHTML).toContain('<svg');

      const urlInput = document.getElementById('share-url-input');
      expect(urlInput.value).toContain('#brew=');
      expect(urlInput.value).toContain(window.location.origin);
    });

    it('växlar URL och QR vid byte mellan Bryggdagsläge och Receptredigerare', async () => {
      applyState(State, sampleRecipeState);
      await openShareQrModal('brew');

      const recipeRadio = document.getElementById('share-mode-recipe');
      recipeRadio.checked = true;
      recipeRadio.dispatchEvent(new Event('change', { bubbles: true }));

      // Wait for async render
      await new Promise((r) => setTimeout(r, 50));

      const urlInput = document.getElementById('share-url-input');
      expect(urlInput.value).toContain('#recipe=');
    });

    it('läser in inkommande hash, uppdaterar State och rensar URL-hashen', () => {
      const hash = encodeRecipeToHash(sampleRecipeState, 'recipe');
      window.location.hash = hash;

      const recalcSpy = vi.fn();
      const loaded = handleIncomingShareHash(recalcSpy);

      expect(loaded).toBe(true);
      expect(State.recipe.name).toBe('Gyllene Garage-IPA');
      expect(State.hops.length).toBe(3);
      expect(State.hops[1].name).toBe('Citra');
      expect(recalcSpy).toHaveBeenCalled();
      expect(window.location.hash).toBe('');
    });
  });
});
