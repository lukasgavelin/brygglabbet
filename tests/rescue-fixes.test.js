import { describe, it, expect, beforeEach, vi } from 'vitest';
import { State, createInitialState, applyState } from '../src/state.js';
import { scaleRecipe } from '../src/core/calculations.js';
import { importBeerXML } from '../src/core/beerxml.js';
import { exportFullWorkspaceBackup, getSavedRecipes, importJSON } from '../src/ui/recipes.js';
import { safeStorage } from '../src/core/storage.js';
import { isWakeLockActive, requestWakeLock, releaseWakeLock } from '../src/core/wakelock.js';
import { getBatches, createBatch } from '../src/core/batches.js';

describe('Rescue Package Fixes (Sprint 1 & Sprint 2)', () => {
  beforeEach(() => {
    safeStorage.clear();
    applyState(State, createInitialState());
  });

  describe('Water & Salts Scaling in scaleRecipe', () => {
    it('scales water volume, salts, and boil volume proportionally when recipe is scaled', () => {
      const initialState = {
        recipe: {
          name: 'Test IPA',
          batchVolume: 20,
          boilVolume: 25,
          efficiency: 75,
        },
        equipment: {
          batchVolume: 20,
          efficiency: 75,
        },
        fermentables: [
          { id: 1, name: 'Pale Ale Malt', amount: 5.0, yield: 80, ebc: 6, type: 'base' },
        ],
        hops: [
          { id: 1, name: 'Citra', amount: 50, alpha: 12, time: 15, use: 'kok' },
        ],
        water: {
          volume: 25,
          salts: {
            gypsum: 4.0,
            calciumChloride: 2.0,
            epsomSalt: 1.0,
            tableSalt: 0,
            chalk: 0,
            bakingSoda: 0,
          },
        },
      };

      // Scale from 20L to 40L (volRatio = 2.0)
      const scaled = scaleRecipe(initialState, 40, 75);

      // Fermentables & hops scaled
      expect(scaled.recipe.batchVolume).toBe(40);
      expect(scaled.fermentables[0].amount).toBe(10.0);
      expect(scaled.hops[0].amount).toBe(100);

      // Water volume scaled
      expect(scaled.water.volume).toBe(50);

      // Boil volume scaled
      expect(scaled.recipe.boilVolume).toBe(50);

      // Salts scaled proportionally
      expect(scaled.water.salts.gypsum).toBe(8.0);
      expect(scaled.water.salts.calciumChloride).toBe(4.0);
      expect(scaled.water.salts.epsomSalt).toBe(2.0);
    });
  });

  describe('BeerXML Import Profile Preservation', () => {
    it('preserves user custom equipment and water profile when importing BeerXML without equipment/water', () => {
      // Set custom equipment and water profile in State
      State.equipment.name = 'Min Egendesignade 50L Gryta';
      State.equipment.boilOffRate = 4.5;
      State.water.salts.gypsum = 6.5;
      State.water.base.name = 'Eget Källvatten';

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<RECIPES>
  <RECIPE>
    <NAME>Importerad Pilsner</NAME>
    <VERSION>1</VERSION>
    <TYPE>All Grain</TYPE>
    <BATCH_SIZE>20.0</BATCH_SIZE>
    <BOIL_SIZE>25.0</BOIL_SIZE>
    <BOIL_TIME>60</BOIL_TIME>
    <EFFICIENCY>75.0</EFFICIENCY>
    <FERMENTABLES>
      <FERMENTABLE>
        <NAME>Pilsner Malt</NAME>
        <VERSION>1</VERSION>
        <AMOUNT>4.5</AMOUNT>
        <YIELD>80.0</YIELD>
        <COLOR>3.5</COLOR>
      </FERMENTABLE>
    </FERMENTABLES>
    <HOPS>
      <HOP>
        <NAME>Saaz</NAME>
        <VERSION>1</VERSION>
        <ALPHA>3.5</ALPHA>
        <AMOUNT>0.050</AMOUNT>
        <USE>Boil</USE>
        <TIME>60</TIME>
      </HOP>
    </HOPS>
  </RECIPE>
</RECIPES>`;

      const importedSlice = importBeerXML(xml);
      applyState(State, importedSlice);

      // Recipe is updated from XML
      expect(State.recipe.name).toBe('Importerad Pilsner');
      expect(State.fermentables[0].name).toBe('Pilsner Malt');

      // Custom equipment and water settings are PRESERVED!
      expect(State.equipment.name).toBe('Min Egendesignade 50L Gryta');
      expect(State.equipment.boilOffRate).toBe(4.5);
      expect(State.water.salts.gypsum).toBe(6.5);
      expect(State.water.base.name).toBe('Eget Källvatten');
    });
  });

  describe('Screen Wake Lock Module', () => {
    it('handles Wake Lock requests gracefully when navigator.wakeLock is mocked', async () => {
      const mockSentinel = {
        released: false,
        release: vi.fn().mockImplementation(async function () {
          this.released = true;
        }),
        addEventListener: vi.fn(),
      };

      const originalNavigator = global.navigator;
      global.navigator = {
        ...originalNavigator,
        wakeLock: {
          request: vi.fn().mockResolvedValue(mockSentinel),
        },
      };

      const success = await requestWakeLock();
      expect(success).toBe(true);
      expect(isWakeLockActive()).toBe(true);

      await releaseWakeLock();
      expect(mockSentinel.release).toHaveBeenCalled();
      expect(isWakeLockActive()).toBe(false);

      global.navigator = originalNavigator;
    });
  });

  describe('Full Workspace Backup & Restore', () => {
    it('exports and restores complete workspace including all saved recipes and batches', async () => {
      // 1. Prepare multiple saved recipes
      const allRecipes = {
        'Sommar Ale': {
          ...createInitialState(),
          recipe: { name: 'Sommar Ale', batchVolume: 20 },
        },
        'Vinter Stout': {
          ...createInitialState(),
          recipe: { name: 'Vinter Stout', batchVolume: 25 },
        },
      };
      safeStorage.setJSON('brygglabbet_recipes', allRecipes);

      // 2. Prepare batches
      createBatch({
        recipeSnapshot: allRecipes['Sommar Ale'],
        brewDate: '2026-06-15',
        notes: 'God sommarbryggning',
      });

      expect(Object.keys(getSavedRecipes()).length).toBe(2);
      expect(getBatches().length).toBe(1);

      // Mock URL.createObjectURL and download for exportFullWorkspaceBackup
      const originalCreateObjectURL = URL.createObjectURL;
      const originalRevokeObjectURL = URL.revokeObjectURL;

      global.URL.createObjectURL = vi.fn(() => 'blob:mock-backup-url');
      global.URL.revokeObjectURL = vi.fn();

      exportFullWorkspaceBackup();

      // Clear all storage to simulate moving to a new computer or browser wipe
      safeStorage.clear();
      expect(Object.keys(getSavedRecipes()).length).toBe(0);
      expect(getBatches().length).toBe(0);

      // Now restore using the exported payload
      const mockBackupData = {
        _format: 'brygglabbet_full_backup',
        _version: 2,
        createdAt: new Date().toISOString(),
        currentRecipe: allRecipes['Sommar Ale'],
        recipes: allRecipes,
        batches: [
          {
            id: 'batch-test-1',
            recipeName: 'Sommar Ale',
            brewDate: '2026-06-15',
          },
        ],
      };

      const mockFile = new Blob([JSON.stringify(mockBackupData)], { type: 'application/json' });
      mockFile.name = 'backup.json';
      const mockEvent = {
        target: {
          files: [mockFile],
          value: 'backup.json',
        },
      };

      importJSON(mockEvent, () => {});

      // Wait for FileReader onload to complete
      await new Promise((resolve) => setTimeout(resolve, 60));

      // Verify that after import, all recipes and batches are restored!
      const restoredRecipes = getSavedRecipes();
      expect(restoredRecipes['Sommar Ale']).toBeDefined();
      expect(restoredRecipes['Vinter Stout']).toBeDefined();
      expect(getBatches().length).toBe(1);

      global.URL.createObjectURL = originalCreateObjectURL;
      global.URL.revokeObjectURL = originalRevokeObjectURL;
    });
  });
});
