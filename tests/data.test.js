import { describe, it, expect } from 'vitest';
import {
  MALTS,
  HOPS,
  YEASTS,
  STYLES,
  WATER_PROFILES,
  SALT_IONS,
  MASH_PRESETS,
  EQUIPMENT_PROFILES,
  PRESET_RECIPES,
} from '../src/core/data.js';

describe('Data Module Integrity Checks', () => {
  it('contains valid malt entries with non-empty names, positive yield, and non-negative EBC', () => {
    expect(MALTS.length).toBeGreaterThan(25);
    MALTS.forEach((m) => {
      expect(m.name).toBeTruthy();
      expect(m.yield).toBeGreaterThan(0);
      expect(m.yield).toBeLessThanOrEqual(100);
      expect(m.ebc).toBeGreaterThanOrEqual(0);
    });
  });

  it('contains popular international and Nordic maltsters (Weyermann, Castle, Crisp, Simpson, Viking, Warbro)', () => {
    expect(MALTS.some((m) => m.name.includes('Weyermann'))).toBe(true);
    expect(MALTS.some((m) => m.name.includes('Viking'))).toBe(true);
    expect(MALTS.some((m) => m.name.includes('Crisp') || m.name.includes('Simpson'))).toBe(true);
    expect(MALTS.some((m) => m.name.includes('Warbro'))).toBe(true);
  });

  it('contains valid hop entries with non-empty names and valid alpha ranges', () => {
    expect(HOPS.length).toBeGreaterThan(20);
    HOPS.forEach((h) => {
      expect(h.name).toBeTruthy();
      expect(h.alpha_min).toBeGreaterThan(0);
      expect(h.alpha_max).toBeGreaterThanOrEqual(h.alpha_min);
    });
  });

  it('contains popular aroma, bittering, and heritage hop varieties', () => {
    expect(HOPS.some((h) => h.name === 'Citra')).toBe(true);
    expect(HOPS.some((h) => h.name === 'Mosaic')).toBe(true);
    expect(HOPS.some((h) => h.name === 'Simcoe')).toBe(true);
    expect(HOPS.some((h) => h.name === 'Saaz')).toBe(true);
    expect(HOPS.some((h) => h.name.includes('Korsta'))).toBe(true);
  });

  it('contains valid yeast entries with reasonable attenuation and temperature bounds', () => {
    expect(YEASTS.length).toBeGreaterThan(12);
    YEASTS.forEach((y) => {
      expect(y.name).toBeTruthy();
      expect(y.att_min).toBeGreaterThan(40);
      expect(y.att_max).toBeLessThanOrEqual(100);
      expect(y.temp_min).toBeGreaterThanOrEqual(0);
      expect(y.temp_max).toBeGreaterThan(y.temp_min);
    });
  });

  it('contains Kveik yeast strains that withstand high fermentation temperatures', () => {
    const kveikStrains = YEASTS.filter((y) => y.name.toLowerCase().includes('kveik'));
    expect(kveikStrains.length).toBeGreaterThanOrEqual(3);
    expect(kveikStrains.some((y) => y.temp_max >= 35)).toBe(true);
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

  it('contains municipal and classic water profiles and salt ion data', () => {
    expect(WATER_PROFILES.length).toBeGreaterThan(5);
    expect(WATER_PROFILES.some((w) => w.name.includes('Stockholm'))).toBe(true);
    expect(WATER_PROFILES.some((w) => w.name.includes('Göteborg'))).toBe(true);
    expect(WATER_PROFILES.some((w) => w.name.includes('Malmö'))).toBe(true);
    expect(WATER_PROFILES.some((w) => w.name.includes('Gotland'))).toBe(true);
    expect(Object.keys(SALT_IONS).length).toBe(6);
    expect(MASH_PRESETS.single_infusion).toBeDefined();
  });

  it('contains popular homebrew equipment profiles (Grainfather, Brewtools, BrewZilla, Igloo Cooler, BIAB, Köksbryggning)', () => {
    expect(EQUIPMENT_PROFILES.length).toBeGreaterThanOrEqual(10);
    expect(EQUIPMENT_PROFILES.some((e) => e.name.includes('Grainfather'))).toBe(true);
    expect(EQUIPMENT_PROFILES.some((e) => e.name.includes('Brewtools'))).toBe(true);
    expect(EQUIPMENT_PROFILES.some((e) => e.name.includes('BrewZilla'))).toBe(true);
    expect(EQUIPMENT_PROFILES.some((e) => e.name.includes('Kylväska'))).toBe(true);
    expect(EQUIPMENT_PROFILES.some((e) => e.name.includes('BIAB'))).toBe(true);
  });

  it('contains practical, high-demand preset recipes', () => {
    expect(PRESET_RECIPES.length).toBeGreaterThanOrEqual(6);
    expect(PRESET_RECIPES.some((r) => r.id === 'hazy_neipa')).toBe(true);
    expect(PRESET_RECIPES.some((r) => r.id === 'west_coast_ipa')).toBe(true);
    expect(PRESET_RECIPES.some((r) => r.id === 'klassisk_pilsner')).toBe(true);
    expect(PRESET_RECIPES.some((r) => r.id === 'choklad_porter')).toBe(true);
    expect(PRESET_RECIPES.some((r) => r.id === 'hefeweizen')).toBe(true);
    expect(PRESET_RECIPES.some((r) => r.id === 'gotlandsdricka')).toBe(true);
  });
});
