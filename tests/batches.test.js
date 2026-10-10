import { describe, it, expect, beforeEach } from 'vitest';
import {
  formatDateISO,
  addDays,
  diffDays,
  calculateFermentationSchedule,
  createBatch,
  getBatches,
  getBatchById,
  deleteBatch,
  getBatchesForRecipe,
  addReadingToBatch,
  deleteReadingFromBatch,
  updateBottling,
  getReminders,
  generateBatchICS,
  importBatches,
  BATCHES_STORAGE_KEY,
} from '../src/core/batches.js';

describe('Core Batches & Fermentation Schedules', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Datum- och tidsfunktioner', () => {
    it('formaterar och adderar dagar korrekt', () => {
      expect(formatDateISO(new Date(2026, 9, 10))).toBe('2026-10-10');
      expect(addDays('2026-10-10', 5)).toBe('2026-10-15');
      expect(addDays('2026-10-28', 5)).toBe('2026-11-02');
      expect(diffDays('2026-10-10', '2026-10-15')).toBe(5);
      expect(diffDays('2026-10-15', '2026-10-10')).toBe(-5);
    });
  });

  describe('calculateFermentationSchedule', () => {
    it('genererar standard jässchema för ale med torrhumling', () => {
      const schedule = calculateFermentationSchedule({
        brewDate: '2026-10-10',
        yeastType: 'ale',
        coldCrash: true,
        hops: [
          { id: 1, name: 'Citra', amount: 50, use: 'torrhumle', dryHopDay: 7, dryHopDays: 3 },
        ],
      });

      expect(schedule.fermentationPlan).toHaveLength(2); // Primär + Kallkrasch
      expect(schedule.fermentationPlan[0].name).toBe('Primärjäsning');
      expect(schedule.fermentationPlan[0].startDate).toBe('2026-10-10');
      expect(schedule.fermentationPlan[0].endDate).toBe('2026-10-22');
      expect(schedule.fermentationPlan[0].tempC).toBe(19);

      expect(schedule.fermentationPlan[1].name).toBe('Kallkrasch');
      expect(schedule.fermentationPlan[1].startDate).toBe('2026-10-22');
      expect(schedule.fermentationPlan[1].endDate).toBe('2026-10-24');
      expect(schedule.fermentationPlan[1].tempC).toBe(3);

      expect(schedule.dryHopSchedule).toHaveLength(1);
      expect(schedule.dryHopSchedule[0].hopName).toBe('Citra');
      expect(schedule.dryHopSchedule[0].addDate).toBe('2026-10-17'); // 10 + 7
      expect(schedule.dryHopSchedule[0].removeDate).toBe('2026-10-20'); // 17 + 3
    });

    it('genererar standardschema för lager (primär, diacetyl, lagering)', () => {
      const schedule = calculateFermentationSchedule({
        brewDate: '2026-10-01',
        yeastType: 'lager',
        coldCrash: false,
      });

      expect(schedule.fermentationPlan).toHaveLength(3);
      expect(schedule.fermentationPlan[0].name).toContain('Primär');
      expect(schedule.fermentationPlan[1].name).toContain('Diacetyl');
      expect(schedule.fermentationPlan[2].name).toContain('Kallagring');
    });

    it('genererar snabbt schema för kveik', () => {
      const schedule = calculateFermentationSchedule({
        brewDate: '2026-10-01',
        yeastType: 'kveik',
      });

      expect(schedule.fermentationPlan[0].tempC).toBe(33);
      expect(schedule.fermentationPlan[0].days).toBe(4);
    });
  });

  describe('createBatch och Batch CRUD', () => {
    const mockRecipe = {
      recipe: { id: 'rec-1', name: 'West Coast IPA', batchVolume: 20, efficiency: 75 },
      equipment: { efficiency: 75 },
      fermentables: [
        { id: 1, name: 'Pale Ale Malt', amount: 5.0, yield: 80, ebc: 6 },
      ],
      hops: [
        { id: 1, name: 'Centennial', amount: 30, alpha: 10, time: 60, use: 'kok' },
        { id: 2, name: 'Simcoe', amount: 40, alpha: 13, time: 0, use: 'torrhumle', dryHopDay: 6, dryHopDays: 4 },
      ],
      yeast: { name: 'US-05', type: 'ale' },
    };

    it('skapar och sparar en ny batch med beräknad faktisk effektivitet', () => {
      const batch = createBatch({
        recipeSnapshot: mockRecipe,
        measured: {
          og: '1.055',
          fermenterVol: '19.5',
          mashPH: '5.35',
          preboilSG: '1.046',
          preboilVol: '24',
        },
        brewDate: '2026-10-10',
        notes: 'Bra mäskning, bra utbyte.',
      });

      expect(batch.id).toMatch(/^batch-/);
      expect(batch.recipeName).toBe('West Coast IPA');
      expect(batch.status).toBe('jäser');
      expect(batch.efficiency).toBeGreaterThan(60);
      expect(batch.efficiency).toBeLessThan(85);

      const all = getBatches();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe(batch.id);

      const found = getBatchById(batch.id);
      expect(found).not.toBeNull();
      expect(found.recipeName).toBe('West Coast IPA');

      const matching = getBatchesForRecipe('rec-1');
      expect(matching).toHaveLength(1);
    });

    it('lägger till och tar bort mätningar samt beräknar FG och ABV', () => {
      const batch = createBatch({
        recipeSnapshot: mockRecipe,
        measured: { og: '1.060', fermenterVol: '20' },
        brewDate: '2026-10-01',
      });

      // Mätning 1: hydrometer
      addReadingToBatch(batch.id, {
        date: '2026-10-05',
        sg: 1.025,
        tempC: 20,
        isHydrometer: true,
        note: 'Halvvägs',
      });

      let updated = getBatchById(batch.id);
      expect(updated.readings).toHaveLength(1);
      expect(updated.fg).toBe(1.025);
      expect(updated.abv).toBeGreaterThan(4.0);

      // Mätning 2: refraktometer i Brix (1.060 OG motsvarar ca 14.7 °Brix)
      // En slutavläsning på ca 7.2 °Brix motsvarar ca FG 1.012
      addReadingToBatch(batch.id, {
        date: '2026-10-12',
        brix: 7.2,
        wcf: 1.0,
        note: 'Slutprov med refraktometer',
      });

      updated = getBatchById(batch.id);
      expect(updated.readings).toHaveLength(2);
      expect(updated.fg).toBeLessThan(1.016);
      expect(updated.fg).toBeGreaterThan(1.008);
      expect(updated.abv).toBeGreaterThan(6.0);
      expect(updated.attenuation).toBeGreaterThan(70);

      // Ta bort första mätningen
      deleteReadingFromBatch(batch.id, updated.readings[0].id);
      updated = getBatchById(batch.id);
      expect(updated.readings).toHaveLength(1);
    });

    it('uppdaterar buteljeringsdata och ändrar status till konditioneras', () => {
      const batch = createBatch({
        recipeSnapshot: mockRecipe,
        measured: { og: '1.050', fermenterVol: '20' },
      });

      updateBottling(batch.id, {
        date: '2026-10-24',
        method: 'flaska',
        sugarType: 'sucrose',
        sugarG: 120,
        sugarGPerL: 6.0,
        vols: 2.4,
        tempC: 20,
        volumeL: 20,
      });

      const updated = getBatchById(batch.id);
      expect(updated.status).toBe('konditioneras');
      expect(updated.bottling.sugarG).toBe(120);
      expect(updated.bottling.sugarGPerL).toBe(6.0);
    });

    it('raderar en batch', () => {
      const batch = createBatch({ recipeSnapshot: mockRecipe });
      expect(getBatches()).toHaveLength(1);
      const res = deleteBatch(batch.id);
      expect(res).toBe(true);
      expect(getBatches()).toHaveLength(0);
    });
  });

  describe('Påminnelser och iCalendar (.ics)', () => {
    const mockRecipe = {
      recipe: { name: 'Galaxy Pale Ale', batchVolume: 20 },
      equipment: { efficiency: 75 },
      fermentables: [{ name: 'Pale Ale', amount: 4, yieldPct: 80 }],
      hops: [
        { id: 1, name: 'Galaxy', amount: 50, use: 'torrhumle', dryHopDay: 5, dryHopDays: 3 },
      ],
      yeast: { name: 'US-05', type: 'ale' },
    };

    it('hittar relevanta påminnelser baserat på dagens datum', () => {
      const batch = createBatch({
        recipeSnapshot: mockRecipe,
        brewDate: '2026-10-10',
      });

      // På bryggdagen
      const remindersBrew = getReminders(batch, '2026-10-10');
      expect(remindersBrew.length).toBeGreaterThan(0);

      // På torrhumlingsdagen 2026-10-15
      const remindersDH = getReminders(batch, '2026-10-15');
      const todayDH = remindersDH.find((r) => r.isToday);
      expect(todayDH).toBeDefined();
      expect(todayDH.text).toContain('Galaxy');
    });

    it('genererar en giltig RFC 5545 .ics kalenderfil', () => {
      const batch = createBatch({
        recipeSnapshot: mockRecipe,
        brewDate: '2026-10-10',
      });

      const ics = generateBatchICS(batch);
      expect(ics).toContain('BEGIN:VCALENDAR');
      expect(ics).toContain('VERSION:2.0');
      expect(ics).toContain('PRODID:-//Brygglabbet//Hembryggning//SV');
      expect(ics).toContain('BEGIN:VEVENT');
      expect(ics).toContain('SUMMARY:[Brygglabbet] Bryggdag: Galaxy Pale Ale');
      expect(ics).toContain('SUMMARY:[Brygglabbet] Jäsning: Primärjäsning (19°C)');
      expect(ics).toContain('SUMMARY:[Brygglabbet] Tillsätt torrhumle: 50 g Galaxy');
      expect(ics).toContain('SUMMARY:[Brygglabbet] Avlägsna torrhumle: 50 g Galaxy');
      expect(ics).toContain('END:VCALENDAR');
      expect(ics).toContain('\r\n');
    });
  });

  describe('importBatches', () => {
    it('slår ihop batcher på id och bevarar nyaste uppdatering', () => {
      const batch1 = {
        id: 'b-1',
        recipeName: 'Öl 1',
        brewDate: '2026-10-01',
        updatedAt: '2026-10-01T12:00:00Z',
      };
      const batch2 = {
        id: 'b-2',
        recipeName: 'Öl 2',
        brewDate: '2026-10-05',
        updatedAt: '2026-10-05T12:00:00Z',
      };
      localStorage.setItem(BATCHES_STORAGE_KEY, JSON.stringify([batch1]));

      const imported = [
        {
          id: 'b-1',
          recipeName: 'Öl 1 Uppdaterad',
          brewDate: '2026-10-01',
          updatedAt: '2026-10-02T12:00:00Z',
        },
        batch2,
      ];

      const merged = importBatches(imported);
      expect(merged).toHaveLength(2);
      const b1 = merged.find((b) => b.id === 'b-1');
      expect(b1.recipeName).toBe('Öl 1 Uppdaterad');
    });
  });
});
