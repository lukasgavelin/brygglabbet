// ============================================================
//  app.js  –  Bryggkalkylatorns applikationslogik
//  State-hantering, UI-uppdateringar, CRUD, spara/ladda
// ============================================================

// ----------------------------------------------------------
//  APP STATE
// ----------------------------------------------------------
const State = {
  recipe: {
    name:        'Mitt nya öl',
    styleId:     '',
    batchVolume: 20,
    boilVolume:  25,
    boilTime:    60,
    efficiency:  75,
    notes:       '',
  },
  fermentables: [],
  hops:         [],
  yeast: {
    name:    '',
    lab:     '',
    type:    'ale',
    attMin:  72,
    attMax:  78,
    tempMin: 18,
    tempMax: 22,
    notes:   '',
  },
  mash: [],
  water: {
    volume: 25,
    base:   { ca: 50, mg: 10, na: 20, cl: 50, so4: 50, hco3: 100 },
    salts:  { gypsum: 0, calciumChloride: 0, epsomSalt: 0, tableSalt: 0, chalk: 0, bakingSoda: 0 },
  },
};

let nextId = 1;
const newId = () => nextId++;

// ----------------------------------------------------------
//  INIT
// ----------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  populateStyleSelector();
  populateWaterProfileSelector();
  populateYeastSelector();
  setupTabNavigation();
  setupHeaderButtons();
  setupRecipeTab();
  setupFermentablesTab();
  setupHopsTab();
  setupYeastTab();
  setupMashTab();
  setupWaterTab();
  setupSidebarButtons();
  setupModalClose();
  // Starta med ett exempelrecept
  loadDefaultRecipe();
  recalculate();
});

// ----------------------------------------------------------
//  FLIK-NAVIGATION
// ----------------------------------------------------------
function setupTabNavigation() {
  const tabs = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      panels.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const target = document.getElementById('tab-' + btn.dataset.tab);
      if (target) target.classList.add('active');
    });
  });
}

// ----------------------------------------------------------
//  HEADER-KNAPPAR
// ----------------------------------------------------------
function setupHeaderButtons() {
  document.getElementById('recipe-name-input').addEventListener('input', e => {
    State.recipe.name = e.target.value;
  });
  document.getElementById('btn-new').addEventListener('click', newRecipe);
  document.getElementById('btn-open').addEventListener('click', openRecipeModal);
  document.getElementById('btn-save').addEventListener('click', saveRecipe);
}

// ----------------------------------------------------------
//  RECEPT-FLIK
// ----------------------------------------------------------
function setupRecipeTab() {
  const ids = ['batch-volume','boil-volume','boil-time','efficiency','att-min','att-max'];
  ids.forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      syncRecipeFromUI();
      recalculate();
    });
  });
  document.getElementById('recipe-notes')?.addEventListener('input', e => {
    State.recipe.notes = e.target.value;
  });
  document.getElementById('recipe-style')?.addEventListener('change', e => {
    State.recipe.styleId = e.target.value;
    recalculate();
  });
}

function syncRecipeFromUI() {
  State.recipe.batchVolume = parseFloat(document.getElementById('batch-volume').value) || 20;
  State.recipe.boilVolume  = parseFloat(document.getElementById('boil-volume').value)  || 25;
  State.recipe.boilTime    = parseFloat(document.getElementById('boil-time').value)    || 60;
  State.recipe.efficiency  = parseFloat(document.getElementById('efficiency').value)   || 75;
  State.yeast.attMin       = parseFloat(document.getElementById('att-min').value)      || 72;
  State.yeast.attMax       = parseFloat(document.getElementById('att-max').value)      || 78;
}

// ----------------------------------------------------------
//  MALT-FLIK (Fermentables)
// ----------------------------------------------------------
function setupFermentablesTab() {
  document.getElementById('btn-add-fermentable').addEventListener('click', openFermentableModal);
  document.getElementById('fermentable-search').addEventListener('input', e => {
    filterModalList('fermentable-list', e.target.value);
  });
}

function renderFermentablesTable() {
  const tbody = document.getElementById('fermentables-body');
  const empty = document.getElementById('fermentables-empty');
  const table = document.getElementById('fermentables-table');

  if (State.fermentables.length === 0) {
    table.style.display = 'none';
    empty.style.display = 'block';
    updateFermentableTotals([]);
    return;
  }
  table.style.display = '';
  empty.style.display = 'none';

  // Beräkna resultat
  const ogResult = calculateOG(State.fermentables, State.recipe.batchVolume, State.recipe.efficiency);
  const ebcResult = calculateEBC(State.fermentables, State.recipe.batchVolume);
  const totalKg = State.fermentables.reduce((s, f) => s + (f.amount || 0), 0);

  tbody.innerHTML = '';
  State.fermentables.forEach((f, idx) => {
    const pct = totalKg > 0 ? (f.amount / totalKg * 100).toFixed(1) : '0.0';
    const gu  = ogResult.guPerFermentable[idx]?.toFixed(1) ?? '—';
    const ebcContrib = ebcResult.perFermentable[idx]?.toFixed(1) ?? '—';
    const dotColor = ebcToColor(f.ebc);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-name">
        <div style="display:flex;align-items:center">
          <span class="ebc-dot" style="background:${dotColor}"></span>
          <input type="text" value="${escHtml(f.name)}" placeholder="Maltnamn" data-id="${f.id}" data-field="name">
        </div>
      </td>
      <td class="col-amount">
        <input type="number" value="${f.amount}" min="0" step="0.05" data-id="${f.id}" data-field="amount">
      </td>
      <td class="col-value">
        <input type="number" value="${f.ebc}" min="0" max="2000" step="1" data-id="${f.id}" data-field="ebc">
      </td>
      <td class="col-value">
        <input type="number" value="${f.yield}" min="0" max="100" step="0.5" data-id="${f.id}" data-field="yield">
      </td>
      <td class="col-result">${pct}%</td>
      <td class="col-result">${gu}</td>
      <td class="col-result">${ebcContrib}</td>
      <td class="col-action">
        <button class="btn btn-danger btn-icon" data-remove="fermentable" data-id="${f.id}" title="Ta bort">✕</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Input-events i tabellen
  tbody.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('change', onFermentableInputChange);
  });
  tbody.querySelectorAll('[data-remove="fermentable"]').forEach(btn => {
    btn.addEventListener('click', () => removeFermentable(parseInt(btn.dataset.id)));
  });

  updateFermentableTotals(ogResult);
}

function onFermentableInputChange(e) {
  const id = parseInt(e.target.dataset.id);
  const field = e.target.dataset.field;
  const f = State.fermentables.find(f => f.id === id);
  if (!f) return;
  const val = field === 'name' ? e.target.value : parseFloat(e.target.value) || 0;
  f[field] = val;
  // Uppdatera EBC-punkt live
  if (field === 'ebc') {
    const dot = e.target.closest('tr')?.querySelector('.ebc-dot');
    if (dot) dot.style.background = ebcToColor(val);
  }
  recalculate();
}

function removeFermentable(id) {
  State.fermentables = State.fermentables.filter(f => f.id !== id);
  renderFermentablesTable();
  recalculate();
}

function updateFermentableTotals(ogResult) {
  const totalKg = State.fermentables.reduce((s, f) => s + (f.amount || 0), 0);
  const totalGU = typeof ogResult === 'object' && ogResult?.guPerFermentable
    ? ogResult.guPerFermentable.reduce((s, v) => s + v, 0)
    : 0;
  document.getElementById('fermentables-total-kg').textContent = totalKg.toFixed(2) + ' kg';
  document.getElementById('fermentables-total-gu').textContent = totalGU.toFixed(1) + ' GU';
}

// ----------------------------------------------------------
//  HUMLE-FLIK
// ----------------------------------------------------------
function setupHopsTab() {
  document.getElementById('btn-add-hop').addEventListener('click', openHopModal);
  document.getElementById('hop-search').addEventListener('input', e => {
    filterModalList('hop-list', e.target.value);
  });
}

function renderHopsTable() {
  const tbody = document.getElementById('hops-body');
  const empty = document.getElementById('hops-empty');
  const table = document.getElementById('hops-table');

  if (State.hops.length === 0) {
    table.style.display = 'none';
    empty.style.display = 'block';
    document.getElementById('hops-total-g').textContent   = '0 g';
    document.getElementById('hops-total-ibu').textContent = '0 IBU';
    return;
  }
  table.style.display = '';
  empty.style.display = 'none';

  const ogResult = calculateOG(State.fermentables, State.recipe.batchVolume, State.recipe.efficiency);
  const ibuResult = calculateIBU(State.hops, ogResult.sg, State.recipe.batchVolume);

  tbody.innerHTML = '';
  State.hops.forEach((h, idx) => {
    const ibuContrib = ibuResult.perHop[idx]?.toFixed(1) ?? '—';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-name">
        <input type="text" value="${escHtml(h.name)}" placeholder="Humlenamn" data-id="${h.id}" data-field="name">
      </td>
      <td class="col-amount">
        <input type="number" value="${h.amount}" min="0" step="1" data-id="${h.id}" data-field="amount">
      </td>
      <td class="col-value">
        <input type="number" value="${h.alpha}" min="0" max="30" step="0.1" data-id="${h.id}" data-field="alpha">
      </td>
      <td class="col-value">
        <input type="number" value="${h.time}" min="0" max="300" step="5" data-id="${h.id}" data-field="time" ${h.use === 'torrhumle' ? 'disabled' : ''}>
      </td>
      <td class="col-unit">
        <select data-id="${h.id}" data-field="form">
          <option value="pellets"  ${h.form === 'pellets'  ? 'selected' : ''}>Pellets</option>
          <option value="kottar"   ${h.form === 'kottar'   ? 'selected' : ''}>Kottar</option>
        </select>
      </td>
      <td class="col-unit">
        <select data-id="${h.id}" data-field="use">
          <option value="kok"       ${h.use === 'kok'       ? 'selected' : ''}>Kok</option>
          <option value="whirlpool" ${h.use === 'whirlpool' ? 'selected' : ''}>Whirlpool</option>
          <option value="torrhumle" ${h.use === 'torrhumle' ? 'selected' : ''}>Torrhumle</option>
        </select>
      </td>
      <td class="col-result">${h.use === 'torrhumle' ? '<span class="text-muted">0.0</span>' : ibuContrib}</td>
      <td class="col-action">
        <button class="btn btn-danger btn-icon" data-remove="hop" data-id="${h.id}" title="Ta bort">✕</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('change', onHopInputChange);
  });
  tbody.querySelectorAll('[data-remove="hop"]').forEach(btn => {
    btn.addEventListener('click', () => removeHop(parseInt(btn.dataset.id)));
  });

  const totalG   = State.hops.reduce((s, h) => s + (h.amount || 0), 0);
  document.getElementById('hops-total-g').textContent   = totalG.toFixed(0) + ' g';
  document.getElementById('hops-total-ibu').textContent = ibuResult.total.toFixed(1) + ' IBU';
}

function onHopInputChange(e) {
  const id = parseInt(e.target.dataset.id);
  const field = e.target.dataset.field;
  const h = State.hops.find(h => h.id === id);
  if (!h) return;
  const val = (field === 'name' || field === 'form' || field === 'use')
    ? e.target.value
    : parseFloat(e.target.value) || 0;
  h[field] = val;
  // Inaktivera tid-input vid torrhumle
  if (field === 'use') {
    const row = e.target.closest('tr');
    const timeInput = row?.querySelector('[data-field="time"]');
    if (timeInput) timeInput.disabled = val === 'torrhumle';
  }
  recalculate();
}

function removeHop(id) {
  State.hops = State.hops.filter(h => h.id !== id);
  renderHopsTable();
  recalculate();
}

// ----------------------------------------------------------
//  JÄST-FLIK
// ----------------------------------------------------------
function setupYeastTab() {
  document.getElementById('yeast-select').addEventListener('change', e => {
    const y = YEASTS.find(y => y.name === e.target.value);
    if (!y) return;
    State.yeast = {
      name: y.name, lab: y.lab, type: y.type,
      attMin: y.att_min, attMax: y.att_max,
      tempMin: y.temp_min, tempMax: y.temp_max,
      notes: State.yeast.notes,
    };
    syncYeastToUI();
    // Visa beskrivning
    const card = document.getElementById('yeast-desc-card');
    const text = document.getElementById('yeast-desc-text');
    card.style.display = y.desc ? '' : 'none';
    text.textContent = y.desc || '';
    recalculate();
  });

  ['yeast-name','yeast-lab'].forEach(id => {
    document.getElementById(id).addEventListener('input', e => {
      const field = id === 'yeast-name' ? 'name' : 'lab';
      State.yeast[field] = e.target.value;
    });
  });
  document.getElementById('yeast-type').addEventListener('change', e => { State.yeast.type = e.target.value; });
  document.getElementById('yeast-att-min').addEventListener('input', e => {
    State.yeast.attMin = parseFloat(e.target.value) || 72;
    // Synkronisera med receptflik
    const el = document.getElementById('att-min');
    if (el) el.value = State.yeast.attMin;
    recalculate();
  });
  document.getElementById('yeast-att-max').addEventListener('input', e => {
    State.yeast.attMax = parseFloat(e.target.value) || 78;
    const el = document.getElementById('att-max');
    if (el) el.value = State.yeast.attMax;
    recalculate();
  });
  document.getElementById('yeast-temp-min').addEventListener('input', e => { State.yeast.tempMin = parseFloat(e.target.value) || 18; });
  document.getElementById('yeast-temp-max').addEventListener('input', e => { State.yeast.tempMax = parseFloat(e.target.value) || 22; });
  document.getElementById('yeast-notes').addEventListener('input',   e => { State.yeast.notes = e.target.value; });
}

function syncYeastToUI() {
  document.getElementById('yeast-name').value    = State.yeast.name    || '';
  document.getElementById('yeast-lab').value     = State.yeast.lab     || '';
  document.getElementById('yeast-type').value    = State.yeast.type    || 'ale';
  document.getElementById('yeast-att-min').value = State.yeast.attMin  || 72;
  document.getElementById('yeast-att-max').value = State.yeast.attMax  || 78;
  document.getElementById('yeast-temp-min').value= State.yeast.tempMin || 18;
  document.getElementById('yeast-temp-max').value= State.yeast.tempMax || 22;
  document.getElementById('yeast-notes').value   = State.yeast.notes   || '';
  // Synkronisera attenuation till receptfliken
  document.getElementById('att-min').value = State.yeast.attMin || 72;
  document.getElementById('att-max').value = State.yeast.attMax || 78;
}

// ----------------------------------------------------------
//  MÄSK-FLIK
// ----------------------------------------------------------
function setupMashTab() {
  document.getElementById('btn-add-mash-step').addEventListener('click', () => {
    addMashStep({ name: 'Sackarifikation', type: 'Infusion', temp: 67, time: 60 });
  });

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = MASH_PRESETS[btn.dataset.preset];
      if (!preset) return;
      State.mash = preset.steps.map(s => ({ ...s, id: newId() }));
      renderMashTable();
      recalculate();
    });
  });
}

function addMashStep(stepData) {
  State.mash.push({ ...stepData, id: newId() });
  renderMashTable();
  recalculate();
}

function renderMashTable() {
  const tbody = document.getElementById('mash-body');
  const empty = document.getElementById('mash-empty');
  const table = document.getElementById('mash-table');

  if (State.mash.length === 0) {
    table.style.display = 'none';
    empty.style.display = 'block';
    document.getElementById('mash-total-time').textContent = '0 min';
    document.getElementById('mash-step-count').textContent = '0';
    renderMashTimeline([]);
    return;
  }
  table.style.display = '';
  empty.style.display = 'none';

  tbody.innerHTML = '';
  const STEP_COLORS = ['#8b4a14','#a85a18','#c4711e','#d98424','#e09540','#e8a85a'];

  State.mash.forEach((s, idx) => {
    const tr = document.createElement('tr');
    const color = STEP_COLORS[idx % STEP_COLORS.length];
    tr.innerHTML = `
      <td style="color:var(--text-muted);font-size:0.8rem">${idx + 1}</td>
      <td class="col-name">
        <input type="text" value="${escHtml(s.name)}" placeholder="Stegnamn" data-id="${s.id}" data-field="name">
      </td>
      <td class="col-unit">
        <select data-id="${s.id}" data-field="type">
          <option ${s.type==='Infusion'  ?'selected':''}>Infusion</option>
          <option ${s.type==='Steg'      ?'selected':''}>Steg</option>
          <option ${s.type==='Dekoktion' ?'selected':''}>Dekoktion</option>
        </select>
      </td>
      <td class="col-value">
        <input type="number" value="${s.temp}" min="20" max="100" step="1" data-id="${s.id}" data-field="temp">
      </td>
      <td class="col-value">
        <input type="number" value="${s.time}" min="0" max="240" step="5" data-id="${s.id}" data-field="time">
      </td>
      <td class="col-action">
        <button class="btn btn-danger btn-icon" data-remove="mash" data-id="${s.id}" title="Ta bort">✕</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('change', onMashInputChange);
  });
  tbody.querySelectorAll('[data-remove="mash"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      State.mash = State.mash.filter(s => s.id !== id);
      renderMashTable();
      recalculate();
    });
  });

  const totalTime = State.mash.reduce((s, step) => s + (step.time || 0), 0);
  document.getElementById('mash-total-time').textContent = totalTime + ' min';
  document.getElementById('mash-step-count').textContent = State.mash.length;
  renderMashTimeline(State.mash);
}

function onMashInputChange(e) {
  const id = parseInt(e.target.dataset.id);
  const field = e.target.dataset.field;
  const s = State.mash.find(s => s.id === id);
  if (!s) return;
  s[field] = (field === 'name' || field === 'type') ? e.target.value : parseFloat(e.target.value) || 0;
  const totalTime = State.mash.reduce((s, step) => s + (step.time || 0), 0);
  document.getElementById('mash-total-time').textContent = totalTime + ' min';
  renderMashTimeline(State.mash);
}

function renderMashTimeline(steps) {
  const el = document.getElementById('mash-timeline');
  if (!el) return;
  const totalTime = steps.reduce((s, step) => s + (step.time || 0), 0);
  if (totalTime === 0 || steps.length === 0) { el.innerHTML = ''; return; }
  const COLORS = ['#6b3210','#8b4a18','#a85a1c','#c47024','#d9832a','#e09640'];
  el.innerHTML = steps.map((s, i) => {
    const pct = Math.round((s.time / totalTime) * 100);
    const col = COLORS[i % COLORS.length];
    return `<div class="mash-step-bar" style="flex:${s.time};background:${col}" title="${s.name}: ${s.temp}°C × ${s.time} min">
      ${pct > 8 ? `${s.temp}°C` : ''}
    </div>`;
  }).join('');
}

// ----------------------------------------------------------
//  VATTEN-FLIK
// ----------------------------------------------------------
function setupWaterTab() {
  const baseIds = ['w-ca','w-mg','w-na','w-cl','w-so4','w-hco3'];
  const saltIds = ['s-gypsum','s-cacl2','s-epsom','s-salt','s-chalk','s-baking-soda'];

  baseIds.forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => { syncWaterFromUI(); recalculate(); });
  });
  saltIds.forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => { syncWaterFromUI(); recalculate(); });
  });
  document.getElementById('w-volume')?.addEventListener('input', () => { syncWaterFromUI(); recalculate(); });

  document.getElementById('water-profile-select')?.addEventListener('change', e => {
    const profile = WATER_PROFILES.find(p => p.name === e.target.value);
    if (!profile) return;
    State.water.base = { ca: profile.ca, mg: profile.mg, na: profile.na, cl: profile.cl, so4: profile.so4, hco3: profile.hco3 };
    syncWaterToUI();
    recalculate();
  });
}

function syncWaterFromUI() {
  State.water.base = {
    ca:   parseFloat(document.getElementById('w-ca').value)   || 0,
    mg:   parseFloat(document.getElementById('w-mg').value)   || 0,
    na:   parseFloat(document.getElementById('w-na').value)   || 0,
    cl:   parseFloat(document.getElementById('w-cl').value)   || 0,
    so4:  parseFloat(document.getElementById('w-so4').value)  || 0,
    hco3: parseFloat(document.getElementById('w-hco3').value) || 0,
  };
  State.water.salts = {
    gypsum:          parseFloat(document.getElementById('s-gypsum').value)       || 0,
    calciumChloride: parseFloat(document.getElementById('s-cacl2').value)        || 0,
    epsomSalt:       parseFloat(document.getElementById('s-epsom').value)        || 0,
    tableSalt:       parseFloat(document.getElementById('s-salt').value)         || 0,
    chalk:           parseFloat(document.getElementById('s-chalk').value)        || 0,
    bakingSoda:      parseFloat(document.getElementById('s-baking-soda').value)  || 0,
  };
  State.water.volume = parseFloat(document.getElementById('w-volume').value) || 25;
}

function syncWaterToUI() {
  const b = State.water.base;
  document.getElementById('w-ca').value   = b.ca;
  document.getElementById('w-mg').value   = b.mg;
  document.getElementById('w-na').value   = b.na;
  document.getElementById('w-cl').value   = b.cl;
  document.getElementById('w-so4').value  = b.so4;
  document.getElementById('w-hco3').value = b.hco3;
}

function renderWaterPanel(waterResult) {
  const ions = ['ca','mg','na','cl','so4','hco3'];
  const b = State.water.base;

  ions.forEach(ion => {
    const baseVal = b[ion] || 0;
    const resVal  = waterResult[ion] || 0;
    const saltVal = Math.round((resVal - baseVal) * 10) / 10;
    const el = id => document.getElementById(id);
    el(`wt-base-${ion}`)?.setAttribute && (el(`wt-base-${ion}`).textContent = baseVal.toFixed(1));
    el(`wt-salt-${ion}`)?.setAttribute && (el(`wt-salt-${ion}`).textContent = saltVal >= 0 ? '+' + saltVal.toFixed(1) : saltVal.toFixed(1));
    el(`wt-res-${ion}`)?.setAttribute  && (el(`wt-res-${ion}`).textContent  = resVal.toFixed(1));
  });

  // RA
  const ra = calculateResidualAlkalinity(waterResult);
  const raEl = document.getElementById('w-ra-value');
  if (raEl) raEl.textContent = ra.toFixed(0) + ' ppm CaCO₃';
  const raLabel = document.getElementById('w-ra-label');
  if (raLabel) {
    if      (ra < -150) raLabel.textContent = 'Mycket låg – passar hoppy lagers';
    else if (ra < -50)  raLabel.textContent = 'Låg – passar ljust öl, IPA';
    else if (ra < 50)   raLabel.textContent = 'Neutral – allround';
    else if (ra < 150)  raLabel.textContent = 'Måttlig – passar amber/porter';
    else                raLabel.textContent = 'Hög – passar dunkla öl';
  }
  // RA gauge: range -200 to +200 → 0% to 100%
  const raPct = Math.min(100, Math.max(0, (ra + 200) / 400 * 100));
  const raFill = document.getElementById('w-ra-fill');
  const raNeedle = document.getElementById('w-ra-needle');
  if (raFill)   raFill.style.width = raPct + '%';
  if (raNeedle) raNeedle.style.left = raPct + '%';

  // pH
  const ph = estimateMashPH(waterResult, State.fermentables);
  const phEl = document.getElementById('w-ph-value');
  if (phEl) phEl.textContent = ph.toFixed(2);
  const phLabel = document.getElementById('w-ph-label');
  if (phLabel) {
    if (ph < 5.0)      phLabel.textContent = '⚠️ För lågt – kan ge syrlig smak';
    else if (ph < 5.2) phLabel.textContent = 'Lågt – passar rostat öl';
    else if (ph < 5.5) phLabel.textContent = '✓ Optimalt för de flesta öl';
    else if (ph < 5.7) phLabel.textContent = 'Lite högt – försök sänka med syra';
    else               phLabel.textContent = '⚠️ För högt – kan ge mjuk smak';
  }
  const phPct = Math.min(100, Math.max(0, (ph - 4.5) / 2.0 * 100));
  const phFill = document.getElementById('w-ph-fill');
  const phNeedle = document.getElementById('w-ph-needle');
  if (phFill) {
    const good = ph >= 5.2 && ph <= 5.5;
    phFill.style.background = good ? 'var(--success)' : (ph < 5.2 ? 'var(--info)' : 'var(--warning)');
    phFill.style.width = phPct + '%';
  }
  if (phNeedle) phNeedle.style.left = phPct + '%';

  // Cl:SO4 ratio
  const bal = chlorideSulfateBalance(waterResult);
  const ratioEl = document.getElementById('w-ratio-value');
  if (ratioEl) ratioEl.textContent = bal.ratio.toFixed(2);
  const ratioLabel = document.getElementById('w-ratio-label');
  if (ratioLabel) { ratioLabel.textContent = bal.label; ratioLabel.style.color = bal.color; }
  const ratioPct = Math.min(100, Math.max(0, bal.ratio / 2 * 100));
  const ratioFill = document.getElementById('w-ratio-fill');
  if (ratioFill) { ratioFill.style.width = ratioPct + '%'; ratioFill.style.background = bal.color; }
}

// ----------------------------------------------------------
//  BERÄKNA & UPPDATERA SIDEBAR
// ----------------------------------------------------------
function recalculate() {
  // OG
  const ogResult = calculateOG(State.fermentables, State.recipe.batchVolume, State.recipe.efficiency);
  const sg = ogResult.sg;
  const plato = ogResult.plato;

  // FG (genomsnitt av min/max attenuation)
  const attMid = (State.yeast.attMin + State.yeast.attMax) / 2;
  const fg_sg = calculateFG(sg, attMid);
  const fg_plato = sgToPlato(fg_sg);

  // ABV
  const abv = calculateABV(sg, fg_sg);

  // IBU
  const ibuResult = calculateIBU(State.hops, sg, State.recipe.batchVolume);

  // EBC
  const ebcResult = calculateEBC(State.fermentables, State.recipe.batchVolume);
  const ebc = ebcResult.ebc;

  // BU:GU
  const bugu = calculateBUGU(ibuResult.total, sg);

  // Attenuation
  const apparentAtt = calculateApparentAttenuation(sg, fg_sg);

  // Preboil
  const preboilSG = calculatePreboilGravity(sg, State.recipe.batchVolume, State.recipe.boilVolume);
  const preboilPlato = sgToPlato(preboilSG);
  const evapPct = State.recipe.boilVolume > 0
    ? ((State.recipe.boilVolume - State.recipe.batchVolume) / State.recipe.boilVolume * 100).toFixed(1)
    : '0.0';

  // Vatten
  const waterResult = calculateWaterProfile(State.water.base, State.water.salts, State.water.volume);

  // Uppdatera UI
  updateSidebar({ sg, plato, fg_sg, fg_plato, abv, ibu: ibuResult.total, ebc, bugu, apparentAtt });
  updatePreboilDisplay(preboilSG, preboilPlato, evapPct);
  updateStyleMatch({ og: sg, fg: fg_sg, ibu: ibuResult.total, ebc, abv });
  renderFermentablesTable();
  renderHopsTable();
  renderWaterPanel(waterResult);
}

function updateSidebar({ sg, plato, fg_sg, fg_plato, abv, ibu, ebc, bugu, apparentAtt }) {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('updated');
    el.textContent = val;
    void el.offsetWidth; // reflow
    el.classList.add('updated');
  };

  set('sb-og',         plato > 0 ? plato.toFixed(1) + ' °P' : '—');
  set('sb-og-sg',      sg    > 1 ? formatSG(sg) : '—');
  set('sb-fg',         fg_plato > 0 ? fg_plato.toFixed(1) + ' °P' : '—');
  set('sb-fg-sg',      fg_sg > 1 ? formatSG(fg_sg) : '—');
  set('sb-abv',        abv > 0 ? abv.toFixed(1) + ' %' : '—');
  set('sb-ibu',        ibu > 0 ? ibu.toFixed(1) : '—');
  set('sb-ebc',        ebc > 0 ? ebc.toFixed(0) + ' EBC' : '—');
  set('sb-bugu',       bugu > 0 ? bugu.toFixed(2) : '—');
  set('sb-attenuation',apparentAtt > 0 ? apparentAtt.toFixed(0) + ' %' : '—');

  const totalMalt = State.fermentables.reduce((s, f) => s + (f.amount || 0), 0);
  set('sb-total-malt', totalMalt.toFixed(2) + ' kg');

  // EBC swatch
  const swatch = document.getElementById('sb-ebc-swatch');
  const label  = document.getElementById('sb-ebc-label');
  if (swatch && ebc > 0) {
    swatch.style.background   = ebcToColor(ebc);
    swatch.style.boxShadow    = `0 0 12px ${ebcToColor(ebc)}, 0 0 4px rgba(0,0,0,0.6)`;
  }
  if (label) label.textContent = ebc > 0 ? ebcToLabel(ebc) : '—';
}

function updatePreboilDisplay(preboilSG, preboilPlato, evapPct) {
  const el = id => document.getElementById(id);
  if (el('preboil-og-display'))    el('preboil-og-display').textContent    = preboilSG > 1 ? formatSG(preboilSG) : '—';
  if (el('preboil-plato-display')) el('preboil-plato-display').textContent = preboilPlato > 0 ? preboilPlato.toFixed(1) + ' °P' : '—';
  if (el('evap-rate-display'))     el('evap-rate-display').textContent     = evapPct + ' %';
}

// ----------------------------------------------------------
//  STILMATCHNING I SIDEBAR
// ----------------------------------------------------------
function updateStyleMatch(values) {
  const styleId = State.recipe.styleId;
  const nameEl  = document.getElementById('style-match-name');
  const barsEl  = document.getElementById('style-bars-container');

  if (!styleId) {
    nameEl.textContent = 'Välj en stil i Recept-fliken';
    barsEl.innerHTML   = '';
    return;
  }

  const style = STYLES.find(s => s.id === styleId);
  if (!style) { nameEl.textContent = '—'; barsEl.innerHTML = ''; return; }

  nameEl.textContent = `${style.id} – ${style.name}`;
  const match = checkStyleMatch(values, style);

  const bars = [
    { key: 'og',  label: 'OG',  min: style.og_min, max: style.og_max, val: values.og,  fmt: v => formatSG(v),           unit: '' },
    { key: 'ibu', label: 'IBU', min: style.ibu_min, max: style.ibu_max, val: values.ibu, fmt: v => v.toFixed(0),          unit: '' },
    { key: 'ebc', label: 'EBC', min: style.ebc_min, max: style.ebc_max, val: values.ebc, fmt: v => v.toFixed(0),          unit: '' },
    { key: 'abv', label: 'ABV', min: style.abv_min, max: style.abv_max, val: values.abv, fmt: v => v.toFixed(1) + '%',    unit: '' },
  ];

  // Lägg till ett 10% slack runt min/max för visual range
  barsEl.innerHTML = bars.map(b => {
    const slack = (b.max - b.min) * 0.3;
    const vizMin = b.min - slack;
    const vizMax = b.max + slack;
    const total  = vizMax - vizMin || 1;

    const rangeLeft = Math.max(0, (b.min - vizMin) / total * 100);
    const rangeW    = Math.min(100 - rangeLeft, (b.max - b.min) / total * 100);
    const indLeft   = Math.min(100, Math.max(0, (b.val - vizMin) / total * 100));
    const inRange   = match.details[b.key]?.inRange;
    const cls       = inRange ? 'in-range' : 'out-range';
    const indicator = b.val > 0 ? `<div class="style-bar-indicator ${cls}" style="left:${indLeft}%"></div>` : '';

    return `<div class="style-bar-row">
      <div class="style-bar-header">
        <span>${b.label}</span>
        <span>${b.min}–${b.max}${b.key === 'abv' ? '%' : ''} | <b>${b.val > 0 ? b.fmt(b.val) : '—'}</b></span>
      </div>
      <div class="style-bar-track">
        <div class="style-bar-range" style="left:${rangeLeft}%;width:${rangeW}%"></div>
        ${indicator}
      </div>
    </div>`;
  }).join('');
}

// ----------------------------------------------------------
//  MODAL: VÄLJ MALT
// ----------------------------------------------------------
function openFermentableModal() {
  const list = document.getElementById('fermentable-list');
  document.getElementById('fermentable-search').value = '';
  list.innerHTML = '';

  const groups = [...new Set(MALTS.map(m => m.type))];
  const typeLabels = { base: 'Basmalter', cara: 'Karamelmalter', roasted: 'Rostade malter', adjunct: 'Adjunkter', sugar: 'Socker & Extrakt' };

  groups.forEach(type => {
    const header = document.createElement('div');
    header.className = 'section-label';
    header.style.cssText = 'padding:8px 12px 4px; border-top:1px solid var(--border-subtle)';
    header.textContent = typeLabels[type] || type;
    list.appendChild(header);

    MALTS.filter(m => m.type === type).forEach(malt => {
      const item = document.createElement('div');
      item.className = 'modal-item';
      item.dataset.searchText = malt.name.toLowerCase();
      item.innerHTML = `
        <span class="ebc-dot" style="background:${ebcToColor(malt.ebc)};flex-shrink:0"></span>
        <div>
          <div class="item-name">${escHtml(malt.name)}</div>
          <div class="item-sub">${escHtml(malt.desc || '')}</div>
        </div>
        <div class="item-badge">${malt.ebc} EBC · ${malt.yield}%</div>
      `;
      item.addEventListener('click', () => {
        addFermentable(malt);
        closeModal('modal-fermentable');
      });
      list.appendChild(item);
    });
  });

  openModal('modal-fermentable');
}

function addFermentable(malt) {
  State.fermentables.push({
    id:     newId(),
    name:   malt.name,
    amount: 1.0,
    ebc:    malt.ebc,
    yield:  malt.yield,
    type:   malt.type,
  });
  renderFermentablesTable();
  recalculate();
}

// ----------------------------------------------------------
//  MODAL: VÄLJ HUMLE
// ----------------------------------------------------------
function openHopModal() {
  const list = document.getElementById('hop-list');
  document.getElementById('hop-search').value = '';
  list.innerHTML = '';

  const origins = [...new Set(HOPS.map(h => h.origin))].sort();
  origins.forEach(origin => {
    const header = document.createElement('div');
    header.className = 'section-label';
    header.style.cssText = 'padding:8px 12px 4px; border-top:1px solid var(--border-subtle)';
    header.textContent = `Ursprung: ${origin}`;
    list.appendChild(header);

    HOPS.filter(h => h.origin === origin).forEach(hop => {
      const item = document.createElement('div');
      item.className = 'modal-item';
      item.dataset.searchText = hop.name.toLowerCase();
      item.innerHTML = `
        <div>
          <div class="item-name">${escHtml(hop.name)}</div>
          <div class="item-sub">${escHtml(hop.desc || '')}</div>
        </div>
        <div class="item-badge">α ${hop.alpha_min}–${hop.alpha_max}%</div>
      `;
      item.addEventListener('click', () => {
        addHop(hop);
        closeModal('modal-hop');
      });
      list.appendChild(item);
    });
  });

  openModal('modal-hop');
}

function addHop(hop) {
  const alphaDefault = ((hop.alpha_min + hop.alpha_max) / 2);
  State.hops.push({
    id:     newId(),
    name:   hop.name,
    amount: 25,
    alpha:  Math.round(alphaDefault * 10) / 10,
    time:   60,
    form:   'pellets',
    use:    'kok',
  });
  renderHopsTable();
  recalculate();
}

// ----------------------------------------------------------
//  MODAL-FILTRERING
// ----------------------------------------------------------
function filterModalList(listId, query) {
  const q = query.toLowerCase().trim();
  const list = document.getElementById(listId);
  if (!list) return;
  list.querySelectorAll('.modal-item').forEach(item => {
    const match = !q || (item.dataset.searchText || '').includes(q);
    item.style.display = match ? '' : 'none';
  });
  // Dölj kategorisektioner om alla items i dem är gömda
  list.querySelectorAll('.section-label').forEach(label => {
    let next = label.nextElementSibling;
    let hasVisible = false;
    while (next && !next.classList.contains('section-label')) {
      if (next.style.display !== 'none') hasVisible = true;
      next = next.nextElementSibling;
    }
    label.style.display = hasVisible ? '' : 'none';
  });
}

// ----------------------------------------------------------
//  MODAL UTILS
// ----------------------------------------------------------
function openModal(id) { document.getElementById(id)?.classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id)?.classList.add('hidden'); }

function setupModalClose() {
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });
}

// ----------------------------------------------------------
//  POPULERA DROPDOWN-LISTOR
// ----------------------------------------------------------
function populateStyleSelector() {
  const sel = document.getElementById('recipe-style');
  if (!sel) return;

  const categories = [...new Set(STYLES.map(s => s.category))];
  categories.forEach(cat => {
    const group = document.createElement('optgroup');
    group.label = cat;
    STYLES.filter(s => s.category === cat).forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `${s.id} – ${s.name}`;
      group.appendChild(opt);
    });
    sel.appendChild(group);
  });
}

function populateWaterProfileSelector() {
  const sel = document.getElementById('water-profile-select');
  if (!sel) return;
  WATER_PROFILES.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.name;
    opt.textContent = p.name;
    sel.appendChild(opt);
  });
}

function populateYeastSelector() {
  const sel = document.getElementById('yeast-select');
  if (!sel) return;
  const types = { ale: 'Ale', lager: 'Lager', wheat: 'Vete', belgian: 'Belgisk', wild: 'Vild' };
  const grouped = {};
  YEASTS.forEach(y => {
    if (!grouped[y.type]) grouped[y.type] = [];
    grouped[y.type].push(y);
  });
  Object.keys(grouped).forEach(type => {
    const group = document.createElement('optgroup');
    group.label = types[type] || type;
    grouped[type].forEach(y => {
      const opt = document.createElement('option');
      opt.value = y.name;
      opt.textContent = `${y.name} (${y.lab})`;
      group.appendChild(opt);
    });
    sel.appendChild(group);
  });
}

// ----------------------------------------------------------
//  SPARA / LADDA RECEPT
// ----------------------------------------------------------
function saveRecipe() {
  const name = document.getElementById('recipe-name-input').value.trim() || 'Namnlöst recept';
  State.recipe.name = name;
  const all = getSavedRecipes();
  all[name] = JSON.parse(JSON.stringify(State));
  localStorage.setItem('brew_recipes', JSON.stringify(all));
  showToast('💾 Recept sparat: ' + name, 'success');
}

function getSavedRecipes() {
  try { return JSON.parse(localStorage.getItem('brew_recipes') || '{}'); }
  catch { return {}; }
}

function newRecipe() {
  if (!confirm('Skapa ett nytt recept? Osparade ändringar försvinner.')) return;
  Object.assign(State, {
    recipe:       { name: 'Nytt recept', styleId: '', batchVolume: 20, boilVolume: 25, boilTime: 60, efficiency: 75, notes: '' },
    fermentables: [],
    hops:         [],
    yeast:        { name: '', lab: '', type: 'ale', attMin: 72, attMax: 78, tempMin: 18, tempMax: 22, notes: '' },
    mash:         [],
    water:        { volume: 25, base: { ca: 50, mg: 10, na: 20, cl: 50, so4: 50, hco3: 100 }, salts: { gypsum:0, calciumChloride:0, epsomSalt:0, tableSalt:0, chalk:0, bakingSoda:0 } },
  });
  syncUIFromState();
  recalculate();
}

function openRecipeModal() {
  const all = getSavedRecipes();
  const list = document.getElementById('recipes-list');
  const noMsg = document.getElementById('no-recipes-msg');
  list.innerHTML = '';
  const keys = Object.keys(all);
  if (keys.length === 0) {
    noMsg.style.display = '';
  } else {
    noMsg.style.display = 'none';
    keys.forEach(name => {
      const r = all[name];
      const og = r.fermentables?.length > 0
        ? formatSG(calculateOG(r.fermentables, r.recipe?.batchVolume || 20, r.recipe?.efficiency || 75).sg)
        : '—';
      const div = document.createElement('div');
      div.className = 'recipe-list-item';
      div.innerHTML = `
        <div style="flex:1; cursor:pointer">
          <div class="recipe-name">${escHtml(name)}</div>
          <div class="recipe-meta">${r.recipe?.batchVolume || '?'}L · OG ${og} · ${r.fermentables?.length || 0} malter · ${r.hops?.length || 0} humle</div>
        </div>
        <div class="recipe-list-actions">
          <button class="btn btn-secondary btn-sm" data-load="${escHtml(name)}">Ladda</button>
          <button class="btn btn-danger btn-sm" data-delete="${escHtml(name)}">✕</button>
        </div>
      `;
      div.querySelector('[data-load]').addEventListener('click', () => {
        loadRecipe(name);
        closeModal('modal-recipes');
      });
      div.querySelector('[data-delete]').addEventListener('click', e => {
        e.stopPropagation();
        if (confirm(`Ta bort "${name}"?`)) {
          delete all[name];
          localStorage.setItem('brew_recipes', JSON.stringify(all));
          div.remove();
          if (Object.keys(all).length === 0) noMsg.style.display = '';
        }
      });
      list.appendChild(div);
    });
  }
  openModal('modal-recipes');
}

function loadRecipe(name) {
  const all = getSavedRecipes();
  const saved = all[name];
  if (!saved) return;
  Object.assign(State, JSON.parse(JSON.stringify(saved)));
  // Återställ ID-räknaren
  let maxId = 0;
  [...State.fermentables, ...State.hops, ...State.mash].forEach(x => {
    if (x.id && x.id > maxId) maxId = x.id;
  });
  nextId = maxId + 1;
  syncUIFromState();
  recalculate();
  showToast('📂 Recept laddat: ' + name, 'success');
}

function syncUIFromState() {
  document.getElementById('recipe-name-input').value = State.recipe.name || '';
  document.getElementById('batch-volume').value = State.recipe.batchVolume || 20;
  document.getElementById('boil-volume').value  = State.recipe.boilVolume  || 25;
  document.getElementById('boil-time').value    = State.recipe.boilTime    || 60;
  document.getElementById('efficiency').value   = State.recipe.efficiency  || 75;
  document.getElementById('att-min').value      = State.yeast.attMin       || 72;
  document.getElementById('att-max').value      = State.yeast.attMax       || 78;
  document.getElementById('recipe-notes').value = State.recipe.notes       || '';
  document.getElementById('recipe-style').value = State.recipe.styleId     || '';
  syncYeastToUI();
  syncWaterToUI();
  renderMashTable();
}

// ----------------------------------------------------------
//  EXPORT / IMPORT JSON
// ----------------------------------------------------------
function setupSidebarButtons() {
  document.getElementById('sb-btn-save')?.addEventListener('click',   saveRecipe);
  document.getElementById('sb-btn-export')?.addEventListener('click', exportJSON);
  document.getElementById('sb-btn-import')?.addEventListener('click', () => {
    document.getElementById('import-file-input').click();
  });
  document.getElementById('import-file-input')?.addEventListener('change', importJSON);
}

function exportJSON() {
  const name = State.recipe.name || 'recept';
  const data = JSON.stringify(State, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${name.replace(/[^a-z0-9åäö]/gi, '_')}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📤 Recept exporterat som JSON', 'success');
}

function importJSON(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = evt => {
    try {
      const data = JSON.parse(evt.target.result);
      Object.assign(State, data);
      syncUIFromState();
      recalculate();
      showToast('📥 Recept importerat: ' + (State.recipe.name || 'Okänt'), 'success');
    } catch {
      showToast('⚠️ Ogiltig JSON-fil', 'error');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
}

// ----------------------------------------------------------
//  STANDARD-RECEPT (visas vid start)
// ----------------------------------------------------------
function loadDefaultRecipe() {
  State.recipe = { name: 'Gyllene Pale Ale', styleId: '18B', batchVolume: 20, boilVolume: 25, boilTime: 60, efficiency: 75, notes: 'Exempel-recept – en fruktig och fräsch Pale Ale.' };
  State.fermentables = [
    { id: newId(), name: 'Pale Malt (2-rad)',  amount: 4.2,  ebc: 5,   yield: 78, type: 'base'  },
    { id: newId(), name: 'Crystal 60 / Cara 60',amount:0.3, ebc: 120, yield: 70, type: 'cara'  },
    { id: newId(), name: 'Caramünchen I',       amount: 0.2,  ebc: 50,  yield: 70, type: 'cara'  },
  ];
  State.hops = [
    { id: newId(), name: 'Magnum',    amount: 20, alpha: 12.0, time: 60, form: 'pellets', use: 'kok' },
    { id: newId(), name: 'Cascade',   amount: 20, alpha: 5.5,  time: 15, form: 'pellets', use: 'kok' },
    { id: newId(), name: 'Amarillo',  amount: 25, alpha: 9.5,  time: 5,  form: 'pellets', use: 'kok' },
    { id: newId(), name: 'Citra',     amount: 30, alpha: 12.0, time: 0,  form: 'pellets', use: 'torrhumle' },
  ];
  State.yeast = { name: 'Safale US-05', lab: 'Fermentis', type: 'ale', attMin: 73, attMax: 77, tempMin: 15, tempMax: 22, notes: '' };
  State.mash  = [
    { id: newId(), name: 'Sackarifikation', type: 'Infusion', temp: 67, time: 60 },
    { id: newId(), name: 'Avmäskning',      type: 'Steg',     temp: 78, time: 10 },
  ];
  State.water = {
    volume: 25,
    base:   { ca: 50, mg: 10, na: 20, cl: 50, so4: 80, hco3: 100 },
    salts:  { gypsum: 3, calciumChloride: 0, epsomSalt: 0, tableSalt: 0, chalk: 0, bakingSoda: 0 },
  };
  syncUIFromState();
  renderMashTable();
}

// ----------------------------------------------------------
//  TOAST-NOTIFIERINGAR
// ----------------------------------------------------------
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ----------------------------------------------------------
//  HJÄLPFUNKTIONER
// ----------------------------------------------------------
function escHtml(str) {
  return String(str || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}
