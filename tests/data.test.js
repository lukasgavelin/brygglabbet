import { describe, it, expect } from 'vitest';
import {
  MALTS,
  HOPS,
  YEASTS,
  STYLES,
  WATER_PROFILES,
  SALT_IONS,
  MASH_PRESETS,
} from '../src/core/data.js';

describe('Data Module Integrity Checks', () => {
  it('contains valid malt entries with non-empty names, positive yield, and non-negative EBC', () => {
    expect(MALTS.length).toBeGreaterThan(20);
    MALTS.forEach((m) => {
      expect(m.name).toBeTruthy();
      expect(m.yield).toBeGreaterThan(0);
      expect(m.yield).toBeLessThanOrEqual(100);
      expect(m.ebc).toBeGreaterThanOrEqual(0);
    });
  });

  it('contains valid hop entries with non-empty names and valid alpha ranges', () => {
    expect(HOPS.length).toBeGreaterThan(15);
    HOPS.forEach((h) => {
      expect(h.name).toBeTruthy();
      expect(h.alpha_min).toBeGreaterThan(0);
      expect(h.alpha_max).toBeGreaterThanOrEqual(h.alpha_min);
    });
  });

  it('contains valid yeast entries with reasonable attenuation and temperature bounds', () => {
    expect(YEASTS.length).toBeGreaterThan(10);
    YEASTS.forEach((y) => {
      expect(y.name).toBeTruthy();
      expect(y.att_min).toBeGreaterThan(40);
      expect(y.att_max).toBeLessThanOrEqual(100);
      expect(y.temp_min).toBeGreaterThanOrEqual(0);
      expect(y.temp_max).toBeGreaterThan(y.temp_min);
    });
  });

  it('contains BJCP styles with valid min/max ranges', () => {
    expect(STYLES.length).toBeGreaterThan(20);
    STYLES.forEach((s) => {
      expect(s.id).toBeTruthy();
      expect(s.og_max).toBeGreaterThanOrEqual(s.og_min);
      expect(s.fg_max).toBeGreaterThanOrEqual(s.fg_min);
      expect(s.ibu_max).toBeGreaterThanOrEqual(s.ibu_min);
      expect(s.ebc_max).toBeGreaterThanOrEqual(s.ebc_min);
      expect(s.abv_max).toBeGreaterThanOrEqual(s.abv_min);
    });
  });

  it('contains water profiles and salt ion data', () => {
    expect(WATER_PROFILES.length).toBeGreaterThan(5);
    expect(Object.keys(SALT_IONS).length).toBe(6);
    expect(MASH_PRESETS.single_infusion).toBeDefined();
  });
});
