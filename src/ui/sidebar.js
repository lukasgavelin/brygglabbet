/**
 * Sidebar calculations and stats view component.
 */

import { State } from '../state.js';
import {
  computeRecipeMetrics,
  calculateWaterProfile,
  formatSG,
  ebcToColor,
  ebcToLabel,
} from '../core/calculations.js';
import { renderFermentablesTable } from './fermentables.js';
import { renderHopsTable } from './hops.js';
import { renderWaterPanel } from './water.js';
import { updateStyleMatch } from './styleMatch.js';
import { renderWaterRequirementCard } from './equipment.js';
import { updateAccordionBadges } from './tabs.js';
import { updateMobileUI } from './mobile/mobileApp.js';
import { autosaveSession } from './recipes.js';

function safeRun(label, fn) {
  try {
    fn();
  } catch (err) {
    console.error(`[recalculate] Fel i "${label}":`, err);
  }
}

export function recalculate() {
  const m = computeRecipeMetrics(State);
  const { og: sg, plato, fg: fg_sg, fgPlato: fg_plato, abv, ibu, ebc, bugu, volumes } = m;
  const apparentAtt = m.apparentAttenuation;
  const evapPct = m.evaporationPct.toFixed(1);

  const waterResult = calculateWaterProfile(
    State.water.base,
    State.water.salts,
    State.water.volume
  );

  State.recipe.boilVolume = volumes.boilVolume;

  safeRun('SidebarStats', () => updateSidebarStats({
    sg,
    plato,
    fg_sg,
    fg_plato,
    abv,
    ibu,
    ebc,
    bugu,
    apparentAtt,
  }));
  safeRun('PreboilDisplay', () => updatePreboilDisplay(m.preboilSG, m.preboilPlato, evapPct));
  safeRun('StyleMatch', () => updateStyleMatch({ og: sg, fg: fg_sg, ibu, ebc, abv }, State.recipe.styleId));
  safeRun('FermentablesTable', () => renderFermentablesTable(recalculate));
  safeRun('HopsTable', () => renderHopsTable(recalculate));
  safeRun('WaterPanel', () => renderWaterPanel(waterResult));
  safeRun('WaterRequirement', () => renderWaterRequirementCard(volumes));
  safeRun('AccordionBadges', () => updateAccordionBadges());
  safeRun('RecipeReadiness', () => updateRecipeReadinessCard(m));
  safeRun('MobileUI', () => updateMobileUI(recalculate));
  safeRun('Autosave', () => autosaveSession());
}

function updateSidebarStats({ sg, plato, fg_sg, fg_plato, abv, ibu, ebc, bugu, apparentAtt }) {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('updated');
    el.textContent = val;
    void el.offsetWidth;
    el.classList.add('updated');
  };

  set('sb-og', plato > 0 ? `${plato.toFixed(1)} °P` : '—');
  set('sb-og-sg', sg > 1 ? formatSG(sg) : '—');
  set('sb-fg', fg_plato > 0 ? `${fg_plato.toFixed(1)} °P` : '—');
  set('sb-fg-sg', fg_sg > 1 ? formatSG(fg_sg) : '—');
  set('sb-abv', abv > 0 ? `${abv.toFixed(1)} %` : '—');
  set('sb-ibu', ibu > 0 ? ibu.toFixed(1) : '—');
  set('sb-ebc', ebc > 0 ? `${ebc.toFixed(0)} EBC` : '—');
  set('sb-bugu', bugu > 0 ? bugu.toFixed(2) : '—');

  const buguBadge = document.getElementById('sb-bugu-badge');
  if (buguBadge) {
    if (bugu > 0) {
      buguBadge.style.display = 'inline-block';
      if (bugu < 0.40) {
        buguBadge.textContent = 'Maltfokuserad';
        buguBadge.style.background = 'rgba(217, 119, 6, 0.15)';
        buguBadge.style.color = '#f59e0b';
      } else if (bugu <= 0.65) {
        buguBadge.textContent = 'Balanserad';
        buguBadge.style.background = 'rgba(16, 185, 129, 0.15)';
        buguBadge.style.color = '#10b981';
      } else if (bugu <= 0.85) {
        buguBadge.textContent = 'Humlig';
        buguBadge.style.background = 'rgba(249, 115, 22, 0.15)';
        buguBadge.style.color = '#f97316';
      } else {
        buguBadge.textContent = 'Mycket bitter';
        buguBadge.style.background = 'rgba(239, 68, 68, 0.15)';
        buguBadge.style.color = '#ef4444';
      }
    } else {
      buguBadge.style.display = 'none';
    }
  }

  set('sb-attenuation', apparentAtt > 0 ? `${apparentAtt.toFixed(0)} %` : '—');

  const totalMalt = State.fermentables.reduce((s, f) => s + (f.amount || 0), 0);
  set('sb-total-malt', `${totalMalt.toFixed(2)} kg`);

  const swatch = document.getElementById('sb-ebc-swatch');
  const label = document.getElementById('sb-ebc-label');
  if (swatch && ebc > 0) {
    swatch.style.background = ebcToColor(ebc);
    swatch.style.boxShadow = `0 0 12px ${ebcToColor(ebc)}, 0 0 4px rgba(0,0,0,0.6)`;
  }
  if (label) label.textContent = ebc > 0 ? ebcToLabel(ebc) : '—';

  // Uppdatera mobil flytande snabbknapp (FAB)
  const fabSummary = document.getElementById('fab-summary');
  if (fabSummary) {
    const ogStr = sg > 1 ? formatSG(sg) : '—';
    const abvStr = abv > 0 ? `${abv.toFixed(1)}%` : '—';
    const ibuStr = ibu > 0 ? `${ibu.toFixed(0)} IBU` : '—';
    fabSummary.textContent = `${ogStr} • ${abvStr} • ${ibuStr}`;
  }
}

export function setupMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const toggleBtn = document.getElementById('btn-toggle-sidebar');
  const closeBtn = document.getElementById('btn-close-sidebar');
  const fab = document.getElementById('mobile-stats-fab');

  const openSidebar = () => {
    sidebar?.classList.add('open');
    backdrop?.classList.add('active');
  };

  const closeSidebar = () => {
    sidebar?.classList.remove('open');
    backdrop?.classList.remove('active');
  };

  toggleBtn?.addEventListener('click', openSidebar);
  fab?.addEventListener('click', openSidebar);
  closeBtn?.addEventListener('click', closeSidebar);
  backdrop?.addEventListener('click', closeSidebar);
}

function updatePreboilDisplay(preboilSG, preboilPlato, evapPct) {
  const el = (id) => document.getElementById(id);
  const preboilOgEl = el('preboil-og-display');
  const preboilPlatoEl = el('preboil-plato-display');
  const evapRateEl = el('evap-rate-display');

  if (preboilOgEl) preboilOgEl.textContent = preboilSG > 1 ? formatSG(preboilSG) : '—';
  if (preboilPlatoEl)
    {preboilPlatoEl.textContent = preboilPlato > 0 ? `${preboilPlato.toFixed(1)} °P` : '—';}
  if (evapRateEl) evapRateEl.textContent = `${evapPct} %`;
}

/**
 * Updates the Recipe Readiness CTA card dynamically based on recipe composition.
 * Ensures the app accurately displays whether the recipe is empty, missing hops/malt,
 * or ready to brew.
 * @param {object} [metrics] - Computed recipe metrics
 */
export function updateRecipeReadinessCard(_metrics) {
  const totalMaltKg = State.fermentables.reduce((s, f) => s + (f.amount || 0), 0);
  const totalHopsG = State.hops.reduce((s, h) => s + (h.amount || 0), 0);

  let state = 'ready';
  let icon = '🍺';
  let title = 'Receptet är klart – Dags att brygga!';
  let mobileTitle = 'Receptet är klart!';
  let desc = 'Starta det interaktiva bryggdagsläget med integrerade timers, aktiva humlelarm och steg-för-steg-guidning.';
  let btnText = 'Starta Bryggdagsläget →';
  let isHero = true;

  if (totalMaltKg === 0 && totalHopsG === 0) {
    state = 'empty';
    icon = '🌾';
    title = 'Receptet är tomt';
    mobileTitle = 'Receptet är tomt';
    desc = 'Lägg till malt och humle i receptet för att beräkna alkoholstyrka, beska och vattenmängd innan du brygger.';
    btnText = 'Starta Bryggdagsläget ändå →';
    isHero = false;
  } else if (totalMaltKg === 0) {
    state = 'missing-malt';
    icon = '🌾';
    title = 'Receptet saknar malt eller extrakt';
    mobileTitle = 'Receptet saknar malt';
    desc = 'Du har humle men ingen malt eller jäsbart socker. Lägg till basmalt för att ge ölet stamvörtstyrka.';
    btnText = 'Starta Bryggdagsläget ändå →';
    isHero = false;
  } else if (totalHopsG === 0) {
    state = 'missing-hops';
    icon = '🌿';
    title = 'Receptet saknar humle';
    mobileTitle = 'Receptet saknar humle';
    desc = `Du har ${totalMaltKg.toFixed(1)} kg malt i receptet, men inga humlegivor tillagda än. Lägg till humle för beska och arom.`;
    btnText = 'Starta Bryggdagsläget →';
    isHero = true;
  }

  // Update Mobile Card
  const mobileCard = document.getElementById('mobile-ready-card');
  const mobileIcon = document.getElementById('mobile-ready-icon');
  const mobileTitleEl = document.getElementById('mobile-ready-title');
  const mobileDescEl = document.getElementById('mobile-ready-desc');
  const mobileBtn = document.getElementById('mobile-btn-start-brewday');

  if (mobileCard) {
    mobileCard.dataset.readinessState = state;
    mobileCard.classList.toggle('is-empty', !isHero);
  }
  if (mobileIcon) mobileIcon.textContent = icon;
  if (mobileTitleEl) mobileTitleEl.textContent = mobileTitle;
  if (mobileDescEl) mobileDescEl.textContent = desc;
  if (mobileBtn) {
    mobileBtn.innerHTML = `<span class="quick-icon">${icon}</span> ${btnText}`;
    mobileBtn.className = isHero ? 'mobile-btn-hero' : 'mobile-btn-subtle';
  }

  // Update Desktop Card
  const deskCard = document.getElementById('ready-to-brew-card');
  const deskIcon = document.getElementById('ready-to-brew-icon');
  const deskTitleEl = document.getElementById('ready-to-brew-title');
  const deskDescEl = document.getElementById('ready-to-brew-desc');
  const deskBtn = document.getElementById('cta-btn-start-brewday');

  if (deskCard) {
    deskCard.dataset.readinessState = state;
    deskCard.classList.toggle('is-empty', !isHero);
  }
  if (deskIcon) deskIcon.textContent = icon;
  if (deskTitleEl) deskTitleEl.textContent = title;
  if (deskDescEl) deskDescEl.textContent = desc;
  if (deskBtn) {
    deskBtn.innerHTML = `<span class="quick-icon">${icon}</span> ${btnText}`;
    deskBtn.classList.toggle('btn-hero-brewday', isHero);
    deskBtn.classList.toggle('btn-secondary', !isHero);
  }
}
