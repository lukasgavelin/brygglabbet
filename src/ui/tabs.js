/**
 * Accordion and Quick-Nav Handler.
 */

import { State } from '../state.js';
import { calculateEBC, calculateIBU, calculateOG } from '../core/calculations.js';
import { STYLES } from '../core/data.js';

export function setupTabNavigation() {
  // Accordion Header Toggle
  document.querySelectorAll('.accordion-header').forEach((header) => {
    header.addEventListener('click', (e) => {
      // Prevent toggling if clicked on action buttons inside header
      if (e.target.closest('button')) return;

      const card = header.closest('.accordion-card');
      if (card) {
        card.classList.toggle('collapsed');
      }
    });
  });

  // Quick Nav Jump Links
  const navBtns = document.querySelectorAll('.quick-nav-btn');
  navBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = btn.getAttribute('href')?.replace('#', '');
      const targetEl = document.getElementById(targetId);
      if (!targetEl) return;

      // Expand accordion if collapsed
      if (targetEl.classList.contains('collapsed')) {
        targetEl.classList.remove('collapsed');
      }

      // Scroll into view inside #tab-content container
      const container = document.getElementById('tab-content');
      if (container) {
        const topPos = targetEl.offsetTop - container.offsetTop - 8;
        container.scrollTo({ top: topPos, behavior: 'smooth' });
      }

      // Update active nav button
      navBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Scrollspy for quick nav buttons
  const tabContent = document.getElementById('tab-content');
  if (tabContent) {
    tabContent.addEventListener('scroll', () => {
      const sections = document.querySelectorAll('.accordion-card');
      let currentSectionId = '';
      sections.forEach((sec) => {
        const top = sec.offsetTop - tabContent.offsetTop;
        if (tabContent.scrollTop >= top - 60) {
          currentSectionId = sec.id;
        }
      });
      if (currentSectionId) {
        navBtns.forEach((b) => {
          b.classList.toggle('active', b.getAttribute('href') === `#${currentSectionId}`);
        });
      }
    });
  }
}

export function updateAccordionBadges() {
  const batchVol = State.recipe?.batchVolume || State.equipment?.batchVolume || 20;
  const eff = State.recipe?.efficiency || State.equipment?.efficiency || 75;

  // 1. Grunddata & Equipment badge
  const badgeEq = document.getElementById('badge-equipment');
  if (badgeEq) {
    const eqName = State.equipment?.name || 'Standard 30L';
    const currentStyle = STYLES.find((s) => s.id === State.recipe?.styleId);
    const stylePrefix = currentStyle ? `${currentStyle.name} • ` : '';
    badgeEq.textContent = `${stylePrefix}${eqName} (${batchVol}L @ ${eff}%)`;
  }

  // 2. Fermentables badge
  const totalMaltKg = (State.fermentables || []).reduce((s, f) => s + (f.amount || 0), 0);
  const ebcResult = calculateEBC(State.fermentables || [], batchVol);
  const badgeFerm = document.getElementById('badge-fermentables');
  if (badgeFerm) {
    badgeFerm.textContent = `${totalMaltKg.toFixed(2)} kg | ${ebcResult.ebc.toFixed(0)} EBC`;
  }

  // 3. Mash badge
  const badgeMash = document.getElementById('badge-mash');
  if (badgeMash) {
    const stepsArr = Array.isArray(State.mash) ? State.mash : [];
    const stepsCount = stepsArr.length;
    const totalTime = stepsArr.reduce((s, st) => s + (st.time || 0), 0);
    const firstTemp = stepsCount > 0 && stepsArr[0].temp ? `${stepsArr[0].temp}°C` : '';
    badgeMash.textContent = stepsCount > 0 ? `${stepsCount} steg (${totalTime} min ${firstTemp})`.trim() : 'Inga mäsksteg';
  }

  // 4. Hops badge
  const ogResult = calculateOG(State.fermentables || [], batchVol, eff);
  const ibuResult = calculateIBU(State.hops || [], ogResult.sg, batchVol);
  const totalHopsG = (State.hops || []).reduce((s, h) => s + (h.amount || 0), 0);
  const badgeHops = document.getElementById('badge-hops');
  if (badgeHops) {
    badgeHops.textContent = `${totalHopsG} g | ${ibuResult.total.toFixed(0)} IBU`;
  }

  // 5. Yeast badge
  const badgeYeast = document.getElementById('badge-yeast');
  if (badgeYeast) {
    const name = State.yeast?.name || 'Ingen jäst vald';
    const attMin = State.yeast?.attMin ?? 72;
    const attMax = State.yeast?.attMax ?? 78;
    const attMid = Math.round((attMin + attMax) / 2);
    badgeYeast.textContent = State.yeast?.name ? `${name} (${attMid}%)` : 'Ingen jäst vald';
  }

  // 6. Water badge
  const badgeWater = document.getElementById('badge-water');
  if (badgeWater) {
    const profileName = State.water?.base?.name || 'Anpassat vatten';
    const salts = State.water?.salts || {};
    const totalSalts = Object.values(salts).reduce((s, v) => s + (v || 0), 0);
    badgeWater.textContent = totalSalts > 0
      ? `${profileName} (+${totalSalts.toFixed(1)} g salter)`
      : profileName;
  }

  // 7. Recipe notes & Brewday badge
  const badgeInfo = document.getElementById('badge-recipe-info');
  if (badgeInfo) {
    badgeInfo.textContent = State.recipe?.notes?.trim() ? 'Noteringar ifyllda' : 'Redo att brygga';
  }
}
