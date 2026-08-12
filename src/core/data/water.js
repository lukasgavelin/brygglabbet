/**
 * Water profiles and salt ions database.
 */

export const WATER_PROFILES = [
  { name: 'Stockholm (Mälaren - Lovö/Norsborg)', ca: 17, mg: 3, na: 14, cl: 20, so4: 20, hco3: 65 },
  { name: 'Göteborg (Göta Älv / Alelyckan)', ca: 10, mg: 2, na: 10, cl: 15, so4: 10, hco3: 40 },
  { name: 'Malmö / Lund (Sydvatten - Vomb)', ca: 32, mg: 7, na: 18, cl: 30, so4: 30, hco3: 120 },
  { name: 'Uppsala (Kalkrikt grundvatten)', ca: 75, mg: 12, na: 25, cl: 40, so4: 45, hco3: 240 },
  { name: 'Norrland / Kiruna (Fjällvatten)', ca: 5, mg: 1, na: 2, cl: 3, so4: 5, hco3: 15 },
  { name: 'Gotland / Visby (Kalksten/Hårt)', ca: 90, mg: 15, na: 35, cl: 60, so4: 50, hco3: 280 },
  { name: 'Örebro (Svartån/Vättern)', ca: 22, mg: 4, na: 12, cl: 18, so4: 22, hco3: 80 },
  { name: 'Pilsen (Tjeckien)', ca: 7, mg: 3, na: 2, cl: 5, so4: 5, hco3: 25 },
  { name: 'München (Bayern)', ca: 75, mg: 18, na: 2, cl: 2, so4: 5, hco3: 295 },
  { name: 'Burton-on-Trent (England)', ca: 352, mg: 24, na: 44, cl: 16, so4: 820, hco3: 320 },
  { name: 'Destillerat / RO-vatten', ca: 0, mg: 0, na: 0, cl: 0, so4: 0, hco3: 0 },
];

export const SALT_IONS = {
  gypsum: { ca: 232.8, mg: 0, na: 0, cl: 0, so4: 557.9, hco3: 0 }, // CaSO4·2H2O
  calciumChloride: { ca: 272.6, mg: 0, na: 0, cl: 483.4, so4: 0, hco3: 0 }, // CaCl2·2H2O
  epsomSalt: { ca: 0, mg: 98.6, na: 0, cl: 0, so4: 389.7, hco3: 0 }, // MgSO4·7H2O
  tableSalt: { ca: 0, mg: 0, na: 393.5, cl: 606.5, so4: 0, hco3: 0 }, // NaCl
  chalk: { ca: 400.5, mg: 0, na: 0, cl: 0, so4: 0, hco3: 1200 }, // CaCO3
  bakingSoda: { ca: 0, mg: 0, na: 273.4, cl: 0, so4: 0, hco3: 724.0 }, // NaHCO3
};
