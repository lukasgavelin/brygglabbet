/**
 * Water chemistry UI component.
 */

import { State } from '../state.js';
import { WATER_PROFILES } from '../core/data.js';
import {
  calculateResidualAlkalinity,
  estimateMashPH,
  chlorideSulfateBalance,
} from '../core/calculations.js';

export function setupWaterTab(recalculateCallback) {
  const baseIds = [
    'w-base-ca', 'w-ca',
    'w-base-mg', 'w-mg',
    'w-base-na', 'w-na',
    'w-base-cl', 'w-cl',
    'w-base-so4', 'w-so4',
    'w-base-hco3', 'w-hco3',
  ];

  const saltIds = [
    'w-salt-gypsum', 's-gypsum', 'salt-gypsum',
    'w-salt-cacl2', 's-cacl2', 'salt-cacl2',
    'w-salt-epsom', 's-epsom', 'salt-epsom',
    'w-salt-nacl', 's-salt', 'salt-nacl',
    'w-salt-chalk', 's-chalk', 'salt-caco3',
    'w-salt-baking', 's-baking-soda', 'salt-nahco3',
  ];

  baseIds.forEach((id) => {
    document.getElementById(id)?.addEventListener('input', () => {
      syncWaterFromUI();
      recalculateCallback();
    });
  });

  saltIds.forEach((id) => {
    document.getElementById(id)?.addEventListener('input', () => {
      syncWaterFromUI();
      recalculateCallback();
    });
  });

  const volIds = ['water-total-volume', 'w-volume'];
  volIds.forEach((id) => {
    document.getElementById(id)?.addEventListener('input', () => {
      syncWaterFromUI();
      recalculateCallback();
    });
  });

  const selIds = ['water-profile-preset', 'water-profile-select'];
  selIds.forEach((id) => {
    const sel = document.getElementById(id);
    sel?.addEventListener('change', (e) => {
      const profile = WATER_PROFILES.find((p) => p.name === e.target.value);
      if (!profile) return;
      State.water.base = {
        ca: profile.ca,
        mg: profile.mg,
        na: profile.na,
        cl: profile.cl,
        so4: profile.so4,
        hco3: profile.hco3,
      };
      syncWaterToUI();
      recalculateCallback();
    });
  });
}

export function populateWaterProfileSelector() {
  const selIds = ['water-profile-preset', 'water-profile-select'];
  selIds.forEach((id) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '<option value="">— Anpassad profil (Svenska städer / RO) —</option>';
    WATER_PROFILES.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.name;
      opt.textContent = p.name;
      sel.appendChild(opt);
    });
  });
}

function getNumVal(ids, fallback = 0) {
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) {
      const val = parseFloat(el.value);
      if (!isNaN(val)) return val;
    }
  }
  return fallback;
}

function syncWaterFromUI() {
  State.water.base = {
    ca: getNumVal(['w-base-ca', 'w-ca'], 0),
    mg: getNumVal(['w-base-mg', 'w-mg'], 0),
    na: getNumVal(['w-base-na', 'w-na'], 0),
    cl: getNumVal(['w-base-cl', 'w-cl'], 0),
    so4: getNumVal(['w-base-so4', 'w-so4'], 0),
    hco3: getNumVal(['w-base-hco3', 'w-hco3'], 0),
  };

  State.water.salts = {
    gypsum: getNumVal(['w-salt-gypsum', 's-gypsum', 'salt-gypsum'], 0),
    calciumChloride: getNumVal(['w-salt-cacl2', 's-cacl2', 'salt-cacl2'], 0),
    epsomSalt: getNumVal(['w-salt-epsom', 's-epsom', 'salt-epsom'], 0),
    tableSalt: getNumVal(['w-salt-nacl', 's-salt', 'salt-nacl'], 0),
    chalk: getNumVal(['w-salt-chalk', 's-chalk', 'salt-caco3'], 0),
    bakingSoda: getNumVal(['w-salt-baking', 's-baking-soda', 'salt-nahco3'], 0),
  };

  State.water.volume = getNumVal(['water-total-volume', 'w-volume'], 25);
}

export function syncWaterToUI() {
  const b = State.water.base || {};
  const s = State.water.salts || {};

  const setVal = (ids, val) => {
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = val ?? 0;
    });
  };

  setVal(['w-base-ca', 'w-ca'], b.ca);
  setVal(['w-base-mg', 'w-mg'], b.mg);
  setVal(['w-base-na', 'w-na'], b.na);
  setVal(['w-base-cl', 'w-cl'], b.cl);
  setVal(['w-base-so4', 'w-so4'], b.so4);
  setVal(['w-base-hco3', 'w-hco3'], b.hco3);

  setVal(['w-salt-gypsum', 's-gypsum', 'salt-gypsum'], s.gypsum);
  setVal(['w-salt-cacl2', 's-cacl2', 'salt-cacl2'], s.calciumChloride);
  setVal(['w-salt-epsom', 's-epsom', 'salt-epsom'], s.epsomSalt);
  setVal(['w-salt-nacl', 's-salt', 'salt-nacl'], s.tableSalt);
  setVal(['w-salt-chalk', 's-chalk', 'salt-caco3'], s.chalk);
  setVal(['w-salt-baking', 's-baking-soda', 'salt-nahco3'], s.bakingSoda);

  setVal(['water-total-volume', 'w-volume'], State.water.volume || 25);
}

export function renderWaterPanel(waterResult) {
  const ions = ['ca', 'mg', 'na', 'cl', 'so4', 'hco3'];
  const b = State.water.base || {};

  ions.forEach((ion) => {
    const baseVal = b[ion] || 0;
    const resVal = waterResult[ion] || 0;
    const saltVal = Math.round((resVal - baseVal) * 10) / 10;
    const el = (id) => document.getElementById(id);

    const baseEl = el(`wt-base-${ion}`);
    const saltEl = el(`wt-salt-${ion}`);
    const resEl = el(`wt-res-${ion}`) || el(`w-res-${ion}`);

    if (baseEl) baseEl.textContent = baseVal.toFixed(1);
    if (saltEl) saltEl.textContent = saltVal >= 0 ? `+${saltVal.toFixed(1)}` : saltVal.toFixed(1);
    if (resEl) resEl.textContent = `${resVal.toFixed(0)} ppm`;
  });

  // RA
  const ra = calculateResidualAlkalinity(waterResult);
  const raEl = document.getElementById('w-ra-value');
  if (raEl) raEl.textContent = `${ra.toFixed(0)} ppm CaCO₃`;

  const raLabel = document.getElementById('w-ra-label');
  if (raLabel) {
    if (ra < -150) raLabel.textContent = 'Mycket låg – passar hoppy lagers';
    else if (ra < -50) raLabel.textContent = 'Låg – passar ljust öl, IPA';
    else if (ra < 50) raLabel.textContent = 'Neutral – allround';
    else if (ra < 150) raLabel.textContent = 'Måttlig – passar amber/porter';
    else raLabel.textContent = 'Hög – passar dunkla öl';
  }

  const raPct = Math.min(100, Math.max(0, ((ra + 200) / 400) * 100));
  const raFill = document.getElementById('w-ra-fill');
  const raNeedle = document.getElementById('w-ra-needle');
  if (raFill) raFill.style.width = `${raPct}%`;
  if (raNeedle) raNeedle.style.left = `${raPct}%`;

  // pH
  const ph = estimateMashPH(waterResult, State.fermentables);
  const phEl = document.getElementById('w-ph-value');
  if (phEl) phEl.textContent = ph.toFixed(2);

  const phLabel = document.getElementById('w-ph-label');
  if (phLabel) {
    if (ph < 5.0) phLabel.textContent = '⚠️ För lågt – kan ge syrlig smak';
    else if (ph < 5.2) phLabel.textContent = 'Lågt – passar rostat öl';
    else if (ph < 5.5) phLabel.textContent = '✓ Optimalt för de flesta öl';
    else if (ph < 5.7) phLabel.textContent = 'Lite högt – försök sänka med syra';
    else phLabel.textContent = '⚠️ För högt – kan ge mjuk smak';
  }

  const phPct = Math.min(100, Math.max(0, ((ph - 4.5) / 2.0) * 100));
  const phFill = document.getElementById('w-ph-fill');
  const phNeedle = document.getElementById('w-ph-needle');
  if (phFill) {
    const good = ph >= 5.2 && ph <= 5.5;
    phFill.style.background = good ? 'var(--success)' : ph < 5.2 ? 'var(--info)' : 'var(--warning)';
    phFill.style.width = `${phPct}%`;
  }
  if (phNeedle) phNeedle.style.left = `${phPct}%`;

  // Cl:SO4 ratio
  const bal = chlorideSulfateBalance(waterResult);
  const ratioEl = document.getElementById('w-ratio-value') || document.getElementById('w-res-ratio');
  if (ratioEl) ratioEl.textContent = `${bal.ratio.toFixed(1)} (${bal.label})`;

  const ratioLabel = document.getElementById('w-ratio-label');
  if (ratioLabel) {
    ratioLabel.textContent = bal.label;
    ratioLabel.style.color = bal.color;
  }
  const ratioPct = Math.min(100, Math.max(0, (bal.ratio / 2) * 100));
  const ratioFill = document.getElementById('w-ratio-fill');
  if (ratioFill) {
    ratioFill.style.width = `${ratioPct}%`;
    ratioFill.style.background = bal.color;
  }
}
