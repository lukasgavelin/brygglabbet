import { describe, it, expect } from 'vitest';
import {
  sgToPlato,
  platoToSG,
  formatSG,
  formatPlato,
  calculateOG,
  calculatePreboilGravity,
  calculateFG,
  calculateABV,
  calculateApparentAttenuation,
  tinsethUtilization,
  calculateIBU,
  calculateEBC,
  ebcToColor,
  ebcToLabel,
  calculateBUGU,
  calculateWaterProfile,
  calculateResidualAlkalinity,
  estimateMashPH,
  chlorideSulfateBalance,
  checkStyleMatch,
} from '../src/core/calculations.js';

describe('Brewing Calculations Module', () => {
  describe('SG <-> Plato Conversions', () => {
    it('converts SG 1.050 to ~12.39 °Plato', () => {
      const plato = sgToPlato(1.05);
      expect(plato).toBeGreaterThan(12.0);
      expect(plato).toBeLessThan(13.0);
    });

    it('roundtrip converts Plato -> SG -> Plato', () => {
      const originalPlato = 12.5;
      const sg = platoToSG(originalPlato);
      const backPlato = sgToPlato(sg);
      expect(backPlato).toBeCloseTo(originalPlato, 1);
    });

    it('handles boundary values (SG <= 1.0, Plato <= 0)', () => {
      expect(sgToPlato(1.0)).toBe(0);
      expect(sgToPlato(0.99)).toBe(0);
      expect(platoToSG(0)).toBe(1.0);
      expect(platoToSG(-5)).toBe(1.0);
    });

    it('formats SG and Plato strings correctly', () => {
      expect(formatSG(1.05)).toBe('1.050');
      expect(formatPlato(12.34)).toBe('12.3 °P');
    });
  });

  describe('calculateOG & Pre-boil Gravity', () => {
    it('returns default SG 1.000 for empty fermentables or 0 volume', () => {
      expect(calculateOG([], 20, 75).sg).toBe(1.0);
      expect(calculateOG([{ amount: 5, yield: 78 }], 0, 75).sg).toBe(1.0);
    });

    it('calculates expected OG for 4 kg Pale Malt (78% yield) in 20L at 75% efficiency', () => {
      const fermentables = [{ amount: 4, yield: 78, type: 'base' }];
      const result = calculateOG(fermentables, 20, 75);
      // Expected GU = (4 * 0.78 * 384 * 0.75) / 20 = 44.928 -> SG 1.045
      expect(result.sg).toBeCloseTo(1.045, 2);
      expect(result.plato).toBeGreaterThan(11);
    });

    it('does not apply mash efficiency to simple sugars (type = sugar)', () => {
      const sugar = [{ amount: 1, yield: 100, type: 'sugar' }];
      const resHighEff = calculateOG(sugar, 20, 90);
      const resLowEff = calculateOG(sugar, 20, 50);
      expect(resHighEff.sg).toBe(resLowEff.sg);
    });

    it('calculates pre-boil gravity based on volume dilution', () => {
      const targetOG = 1.05; // 50 GU
      const preboilSG = calculatePreboilGravity(targetOG, 20, 25);
      // Preboil GU = 50 * 20 / 25 = 40 GU -> 1.040
      expect(preboilSG).toBeCloseTo(1.04, 3);
    });
  });

  describe('FG, ABV and Attenuation', () => {
    it('calculates expected FG for 75% attenuation', () => {
      const fg = calculateFG(1.05, 75);
      expect(fg).toBeLessThan(1.05);
      expect(fg).toBeGreaterThan(1.008);
      expect(fg).toBeLessThan(1.016);
    });

    it('calculates correct ABV for OG 1.050 and FG 1.010', () => {
      const abv = calculateABV(1.05, 1.01);
      // (1.050 - 1.010) * 131.25 = 5.25%
      expect(abv).toBeCloseTo(5.25, 2);
    });

    it('calculates apparent attenuation correctly', () => {
      const att = calculateApparentAttenuation(1.05, 1.01);
      // (1.050 - 1.010) / 0.050 = 80%
      expect(att).toBeCloseTo(80, 1);
    });
  });

  describe('IBU & Tinseth Utilization', () => {
    it('calculates 0 IBU for empty hop list or 0 boil time', () => {
      expect(calculateIBU([], 1.05, 20).total).toBe(0);
      expect(tinsethUtilization(1.05, 0)).toBe(0);
    });

    it('returns 0 IBU for dry hop additions', () => {
      const hops = [{ amount: 50, alpha: 12, time: 0, use: 'torrhumle' }];
      const res = calculateIBU(hops, 1.05, 20);
      expect(res.total).toBe(0);
    });

    it('calculates positive IBUs for 25g Magnum (12% alpha) boiled 60 min', () => {
      const hops = [{ amount: 25, alpha: 12, time: 60, form: 'pellets', use: 'kok' }];
      const res = calculateIBU(hops, 1.05, 20);
      expect(res.total).toBeGreaterThan(30);
      expect(res.total).toBeLessThan(50);
    });
  });

  describe('EBC Color Calculation & Labels', () => {
    it('returns 0 EBC for empty fermentables', () => {
      expect(calculateEBC([], 20).ebc).toBe(0);
    });

    it('calculates color for 4kg Pale (5 EBC) + 0.3kg Crystal (120 EBC)', () => {
      const grainBill = [
        { amount: 4, ebc: 5 },
        { amount: 0.3, ebc: 120 },
      ];
      const res = calculateEBC(grainBill, 20);
      expect(res.ebc).toBeGreaterThan(8);
    });

    it('converts EBC to valid RGB color string', () => {
      const color = ebcToColor(12);
      expect(color).toMatch(/^rgb\(\d+,\d+,\d+\)$/);
    });

    it('returns descriptive color labels in Swedish', () => {
      expect(ebcToLabel(3)).toBe('Halmgul');
      expect(ebcToLabel(20)).toBe('Amber');
      expect(ebcToLabel(200)).toBe('Svart');
    });
  });

  describe('BU:GU Ratio', () => {
    it('calculates BU:GU for 35 IBU and 1.050 OG', () => {
      const bugu = calculateBUGU(35, 1.05);
      // 35 / 50 = 0.70
      expect(bugu).toBeCloseTo(0.7, 2);
    });
  });

  describe('Water Chemistry', () => {
    it('returns base water profile when no salts are added', () => {
      const base = { ca: 50, mg: 10, na: 20, cl: 50, so4: 50, hco3: 100 };
      const res = calculateWaterProfile(base, {}, 25);
      expect(res.ca).toBe(50);
      expect(res.so4).toBe(50);
    });

    it('adds calcium and sulfate ions when gypsum (CaSO4) is added', () => {
      const base = { ca: 10, mg: 0, na: 0, cl: 0, so4: 10, hco3: 0 };
      const salts = { gypsum: 2.5 }; // 2.5g in 25L -> 0.1g/L
      const res = calculateWaterProfile(base, salts, 25);
      expect(res.ca).toBeGreaterThan(10);
      expect(res.so4).toBeGreaterThan(10);
    });

    it('calculates Residual Alkalinity', () => {
      const profile = { ca: 70, mg: 10, na: 0, cl: 0, so4: 0, hco3: 150 };
      const ra = calculateResidualAlkalinity(profile);
      expect(typeof ra).toBe('number');
    });

    it('estimates mash pH within expected brewing range (4.5 to 6.5)', () => {
      const water = { ca: 50, mg: 10, na: 20, cl: 50, so4: 50, hco3: 100 };
      const grain = [{ amount: 4, ebc: 5 }];
      const ph = estimateMashPH(water, grain);
      expect(ph).toBeGreaterThanOrEqual(4.5);
      expect(ph).toBeLessThanOrEqual(6.5);
    });

    it('provides chloride to sulfate balance assessment', () => {
      const malty = { cl: 100, so4: 40 };
      const hoppy = { cl: 30, so4: 150 };
      expect(chlorideSulfateBalance(malty).label.toLowerCase()).toContain('malt');
      expect(chlorideSulfateBalance(hoppy).label.toLowerCase()).toContain('humle');
    });
  });

  describe('Style Matching', () => {
    it('checks recipe metrics against a style guide entry', () => {
      const mockStyle = {
        og_min: 1.045,
        og_max: 1.06,
        fg_min: 1.01,
        fg_max: 1.015,
        ibu_min: 30,
        ibu_max: 50,
        ebc_min: 6,
        ebc_max: 14,
        abv_min: 4.5,
        abv_max: 6.2,
      };

      const matchingValues = { og: 1.05, fg: 1.012, ibu: 35, ebc: 10, abv: 5.0 };
      const nonMatchingValues = { og: 1.03, fg: 1.005, ibu: 10, ebc: 2, abv: 3.0 };

      expect(checkStyleMatch(matchingValues, mockStyle).match).toBe(true);
      expect(checkStyleMatch(nonMatchingValues, mockStyle).match).toBe(false);
    });
  });
});
