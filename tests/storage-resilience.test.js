import { describe, it, expect, beforeEach, vi } from 'vitest';
import { normalizeState, applyState, createInitialState } from '../src/state.js';
import { safeStorage, safeSessionStorage, onQuotaExceeded } from '../src/core/storage.js';
import { isIgnorableError, generateErrorReport } from '../src/ui/errorBoundary.js';
import { normalizeBatch } from '../src/core/batches.js';
import fs from 'node:fs';
import path from 'node:path';

describe('Storage & State Resilience (Robustness)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('normalizeState', () => {
    it('hanterar null, undefined och tomt objekt med trygga standardvärden', () => {
      const fromNull = normalizeState(null);
      const fromUndefined = normalizeState(undefined);
      const fromEmpty = normalizeState({});

      expect(fromNull.recipe.name).toBe('Mitt nya öl');
      expect(fromNull.equipment.batchVolume).toBe(20);
      expect(fromNull.water.acid.enabled).toBe(false);
      expect(fromUndefined.recipe.fermentation.profile).toBe('auto');
      expect(fromEmpty.fermentables).toEqual([]);
      expect(fromEmpty.hops).toEqual([]);
      expect(fromEmpty.mash).toEqual([]);
    });

    it('översätter gamla fältnamn (mashThickness -> mashRatio, cacl2 -> calciumChloride)', () => {
      const legacyState = {
        recipe: { name: 'Gammalt Recept' },
        equipment: {
          mashThickness: 2.8, // gammalt namn
        },
        water: {
          salts: {
            cacl2: 2.5,
            epsom: 1.5,
            nacl: 0.8,
            caco3: 1.2,
            nahco3: 0.5,
          },
        },
      };

      const normalized = normalizeState(legacyState);
      expect(normalized.equipment.mashRatio).toBe(2.8);
      expect(normalized.water.salts.calciumChloride).toBe(2.5);
      expect(normalized.water.salts.epsomSalt).toBe(1.5);
      expect(normalized.water.salts.tableSalt).toBe(0.8);
      expect(normalized.water.salts.chalk).toBe(1.2);
      expect(normalized.water.salts.bakingSoda).toBe(0.5);
    });

    it('saniterar felaktiga värden och NaN', () => {
      const corruptState = {
        recipe: {
          name: '   ',
          batchVolume: 'inte ett nummer',
          efficiency: 150, // för högt
        },
        equipment: {
          boilOffRate: -5, // negativt
        },
        fermentables: [
          { name: '', amount: 'ogiltig', yield: 110, ebc: -2 },
        ],
        hops: [
          { name: 'Humle utan tid', amount: 50, alpha: 'fem', time: -10, use: 'ogiltig' },
        ],
      };

      const normalized = normalizeState(corruptState);
      expect(normalized.recipe.name).toBe('Mitt nya öl');
      expect(normalized.recipe.batchVolume).toBe(20);
      expect(normalized.recipe.efficiency).toBe(100); // clamped
      expect(normalized.equipment.boilOffRate).toBe(0); // non-negative

      expect(normalized.fermentables[0].name).toBe('Malt 1');
      expect(normalized.fermentables[0].amount).toBe(0);
      expect(normalized.fermentables[0].yield).toBe(100);
      expect(normalized.fermentables[0].ebc).toBe(0);

      expect(normalized.hops[0].alpha).toBe(5);
      expect(normalized.hops[0].time).toBe(0);
      expect(normalized.hops[0].use).toBe('kok');
    });

    it('applyState uppdaterar target i-place och garanterar alla fält', () => {
      const target = createInitialState();
      const partial = {
        recipe: { name: 'Nytt IPA' },
        fermentables: [{ name: 'Pilsnermalt', amount: 5, yield: 80, ebc: 4 }],
      };

      applyState(target, partial);
      expect(target.recipe.name).toBe('Nytt IPA');
      expect(target.recipe.fermentation).toBeDefined();
      expect(target.water.acid.targetPH).toBe(5.4);
      expect(target.fermentables).toHaveLength(1);
    });
  });

  describe('normalizeBatch', () => {
    it('hanterar saknade fält i äldre batcher och bevarar buteljeringsdata', () => {
      const raw = {
        recipeName: 'Test Batch',
        measured: { og: '1.055' },
        bottling: {
          sugarG: 130,
          vols: 2.5,
        },
      };

      const batch = normalizeBatch(raw);
      expect(batch.recipeName).toBe('Test Batch');
      expect(batch.measured.sampleTempC).toBe(20);
      expect(batch.bottling.sugarG).toBe(130);
      expect(batch.bottling.vols).toBe(2.5);
      expect(batch.status).toBe('jäser');
      expect(batch.readings).toEqual([]);
    });
  });

  describe('safeStorage & safeSessionStorage', () => {
    it('läser och skriver data korrekt med getJSON / setJSON', () => {
      const payload = { test: 123, list: ['a', 'b'] };
      safeStorage.setJSON('test_key', payload);

      const retrieved = safeStorage.getJSON('test_key');
      expect(retrieved).toEqual(payload);

      safeStorage.removeItem('test_key');
      expect(safeStorage.getJSON('test_key')).toBeNull();
      expect(safeStorage.getJSON('test_key', 'fallback')).toBe('fallback');
    });

    it('returnerar fallback vid skadad JSON utan att krascha', () => {
      localStorage.setItem('corrupt_json', '{ inte giltig json');
      const res = safeStorage.getJSON('corrupt_json', { ok: false });
      expect(res).toEqual({ ok: false });
    });

    it('aktiverar fallback och triggar onQuotaExceeded vid QuotaExceededError', () => {
      const quotaListener = vi.fn();
      onQuotaExceeded(quotaListener);

      const setItemSpy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
        const err = new Error('Quota exceeded');
        err.name = 'QuotaExceededError';
        throw err;
      });

      const writeResult = safeStorage.setItem('quota_test', 'stor data');
      expect(writeResult).toBe(false);
      expect(quotaListener).toHaveBeenCalled();

      // In-memory fallback fungerar ändå
      expect(safeStorage.getItem('quota_test')).toBe('stor data');

      setItemSpy.mockRestore();
    });

    it('safeSessionStorage hanterar normal och felaktig data', () => {
      safeSessionStorage.setJSON('sess_key', { a: 1 });
      expect(safeSessionStorage.getJSON('sess_key')).toEqual({ a: 1 });
      safeSessionStorage.removeItem('sess_key');
      expect(safeSessionStorage.getJSON('sess_key', null)).toBeNull();
    });
  });

  describe('ErrorBoundary Helpers', () => {
    it('filtrerar bort browser extension-fel och ResizeObserver-brus', () => {
      expect(isIgnorableError('ResizeObserver loop completed with undelivered notifications.')).toBe(true);
      expect(isIgnorableError('Error in extension', 'chrome-extension://abcdef/script.js')).toBe(true);
      expect(isIgnorableError('Extension context invalidated', 'moz-extension://1234/')).toBe(true);
      expect(isIgnorableError('Script error.', '')).toBe(true);

      // Verkliga app-fel ska INTE ignoreras
      expect(isIgnorableError('Cannot read properties of undefined (reading "recipe")', 'at calculateOG (calculations.js:42)')).toBe(false);
    });

    it('skapar en strukturerad felrapport med stacktrace och tillståndssnapshot', () => {
      const err = new Error('Testfel i beräkning');
      const report = generateErrorReport(err);

      expect(report).toContain('--- BRYGGLABBET FELRAPPORT ---');
      expect(report).toContain('Testfel i beräkning');
      expect(report).toContain('Tillstånd:');
      expect(report).toContain('Stack:');
    });
  });

  describe('PWA Manifest & Service Worker Assets', () => {
    it('public/manifest.webmanifest är giltig JSON med nödvändiga PWA-fält', () => {
      const manifestPath = path.resolve(process.cwd(), 'public/manifest.webmanifest');
      expect(fs.existsSync(manifestPath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      expect(content.name).toContain('Brygglabbet');
      expect(content.short_name).toBe('Brygglabbet');
      expect(content.display).toBe('standalone');
      expect(content.icons).toBeInstanceOf(Array);
      expect(content.icons.length).toBeGreaterThanOrEqual(1);
    });

    it('public/sw.js finns och innehåller precache-lista samt event listeners', () => {
      const swPath = path.resolve(process.cwd(), 'public/sw.js');
      expect(fs.existsSync(swPath)).toBe(true);

      const swCode = fs.readFileSync(swPath, 'utf8');
      expect(swCode).toContain('brygglabbet-cache-');
      expect(swCode).toContain('addEventListener(\'install\'');
      expect(swCode).toContain('addEventListener(\'activate\'');
      expect(swCode).toContain('addEventListener(\'fetch\'');
    });
  });
});
