/**
 * Accordion and Quick-Nav Handler.
 */

import { State } from '../state.js';
import { calculateEBC, calculateIBU, calculateOG } from '../core/calculations.js';

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
  // 1. Fermentables badge
  const totalMaltKg = State.fermentables.reduce((s, f) => s + (f.amount || 0), 0);
  const ebcResult = calculateEBC(State.fermentables, State.recipe.batchVolume);
  const badgeFerm = document.getElementById('badge-fermentables');
  if (badgeFerm) {
    badgeFerm.textContent = `${totalMaltKg.toFixed(2)} kg | ${ebcResult.ebc.toFixed(0)} EBC`;
  }

  // 2. Hops badge
  const ogResult = calculateOG(State.fermentables, State.recipe.batchVolume, State.recipe.efficiency);
  const ibuResult = calculateIBU(State.hops, ogResult.sg, State.recipe.batchVolume);
  const totalHopsG = State.hops.reduce((s, h) => s + (h.amount || 0), 0);
  const badgeHops = document.getElementById('badge-hops');
  if (badgeHops) {
    badgeHops.textContent = `${totalHopsG} g | ${ibuResult.total.toFixed(0)} IBU`;
  }

  // 3. Yeast badge
  const badgeYeast = document.getElementById('badge-yeast');
  if (badgeYeast) {
    const name = State.yeast.name || 'Ej vald';
    const attMid = Math.round((State.yeast.attMin + State.yeast.attMax) / 2);
    badgeYeast.textContent = `${name} (${attMid}%)`;
  }

  // 4. Equipment badge
  const badgeEq = document.getElementById('badge-equipment');
  if (badgeEq) {
    badgeEq.textContent = `${State.recipe.batchVolume}L @ ${State.recipe.efficiency}%`;
  }

  // 5. Mash badge
  const badgeMash = document.getElementById('badge-mash');
  if (badgeMash) {
    const stepsCount = State.mash.steps ? State.mash.steps.length : 0;
    const totalTime = State.mash.steps ? State.mash.steps.reduce((s, st) => s + (st.time || 0), 0) : 0;
    badgeMash.textContent = `${totalTime} min | ${stepsCount} steg`;
  }

  // 6. Water badge
  const badgeWater = document.getElementById('badge-water');
  if (badgeWater) {
    const profileName = State.water.base?.name || 'Basvatten';
    badgeWater.textContent = profileName;
  }
}
