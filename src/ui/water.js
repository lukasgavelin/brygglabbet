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
  const baseIds = ['w-ca', 'w-mg', 'w-na', 'w-cl', 'w-so4', 'w-hco3'];
  const saltIds = ['s-gypsum', 's-cacl2', 's-epsom', 's-salt', 's-chalk', 's-baking-soda'];

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

  document.getElementById('w-volume')?.addEventListener('input', () => {
    syncWaterFromUI();
    recalculateCallback();
  });

  document.getElementById('water-profile-select')?.addEventListener('change', (e) => {
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
}

export function populateWaterProfileSelector() {
  const sel = document.getElementById('water-profile-select');
  if (!sel) return;
  WATER_PROFILES.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.name;
    opt.textContent = p.name;
    sel.appendChild(opt);
  });
}

function syncWaterFromUI() {
  State.water.base = {
    ca: parseFloat(document.getElementById('w-ca')?.value) || 0,
    mg: parseFloat(document.getElementById('w-mg')?.value) || 0,
    na: parseFloat(document.getElementById('w-na')?.value) || 0,
    cl: parseFloat(document.getElementById('w-cl')?.value) || 0,
    so4: parseFloat(document.getElementById('w-so4')?.value) || 0,
    hco3: parseFloat(document.getElementById('w-hco3')?.value) || 0,
  };
  State.water.salts = {
    gypsum: parseFloat(document.getElementById('s-gypsum')?.value) || 0,
    calciumChloride: parseFloat(document.getElementById('s-cacl2')?.value) || 0,
    epsomSalt: parseFloat(document.getElementById('s-epsom')?.value) || 0,
    tableSalt: parseFloat(document.getElementById('s-salt')?.value) || 0,
    chalk: parseFloat(document.getElementById('s-chalk')?.value) || 0,
    bakingSoda: parseFloat(document.getElementById('s-baking-soda')?.value) || 0,
  };
  State.water.volume = parseFloat(document.getElementById('w-volume')?.value) || 25;
}

export function syncWaterToUI() {
  const b = State.water.base;
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };
  setVal('w-ca', b.ca);
  setVal('w-mg', b.mg);
  setVal('w-na', b.na);
  setVal('w-cl', b.cl);
  setVal('w-so4', b.so4);
  setVal('w-hco3', b.hco3);
}

export function renderWaterPanel(waterResult) {
  const ions = ['ca', 'mg', 'na', 'cl', 'so4', 'hco3'];
  const b = State.water.base;

  ions.forEach((ion) => {
    const baseVal = b[ion] || 0;
    const resVal = waterResult[ion] || 0;
    const saltVal = Math.round((resVal - baseVal) * 10) / 10;
    const el = (id) => document.getElementById(id);

    const baseEl = el(`wt-base-${ion}`);
    const saltEl = el(`wt-salt-${ion}`);
    const resEl = el(`wt-res-${ion}`);

    if (baseEl) baseEl.textContent = baseVal.toFixed(1);
    if (saltEl) saltEl.textContent = saltVal >= 0 ? `+${saltVal.toFixed(1)}` : saltVal.toFixed(1);
    if (resEl) resEl.textContent = resVal.toFixed(1);
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
  const ratioEl = document.getElementById('w-ratio-value');
  if (ratioEl) ratioEl.textContent = bal.ratio.toFixed(2);

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
