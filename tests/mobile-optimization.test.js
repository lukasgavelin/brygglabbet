/**
 * Test Suite: Mobile Optimization & Ergonomics.
 * Tests touch gesture swipe navigation, in-place DOM updates (zero thrashing),
 * continuous press auto-repeat steppers, and mobile viewport/safe-area configuration.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { State, createInitialState } from '../src/state.js';
import { mountMobileAppView } from '../src/ui/mobile/mobileTemplate.js';
import {
  setupMobileNav,
  switchToScreen,
  MOBILE_SCREEN_ORDER,
} from '../src/ui/mobile/mobileNav.js';
import {
  renderMobileFermentablesCards,
  renderMobileHopsCards,
} from '../src/ui/mobile/mobileCards.js';
import { setupContinuousStepperDelegation } from '../src/ui/mobile/mobileStepper.js';
import fs from 'fs';
import path from 'path';

describe('Mobiloptimering & Touch-ergonomi', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="desktop-app-view"></div>
      <div id="mobile-app-view"></div>
    `;
    Object.assign(State, createInitialState());
    mountMobileAppView();
    setupMobileNav();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Skärmnavigering & Swipe-gester (mobileNav.js)', () => {
    it('definierar 5 mobila skärmar i rätt ordningsföljd', () => {
      expect(MOBILE_SCREEN_ORDER).toEqual([
        'mobile-screen-recipe',
        'mobile-screen-malt',
        'mobile-screen-hops',
        'mobile-screen-yeast',
        'mobile-screen-brew',
      ]);
    });

    it('switchToScreen aktiverar målskärmen och dess bottenknapp med animationsklasser', () => {
      const maltScreen = document.getElementById('mobile-screen-malt');
      const recipeScreen = document.getElementById('mobile-screen-recipe');
      const maltNavBtn = document.querySelector('.mobile-nav-btn[data-screen="mobile-screen-malt"]');

      expect(recipeScreen.classList.contains('active')).toBe(true);
      expect(maltScreen.classList.contains('active')).toBe(false);

      // Växla framåt till malt
      switchToScreen('mobile-screen-malt', 'next');

      expect(maltScreen.classList.contains('active')).toBe(true);
      expect(maltScreen.classList.contains('slide-in-right')).toBe(true);
      expect(recipeScreen.classList.contains('active')).toBe(false);
      expect(maltNavBtn.classList.contains('active')).toBe(true);

      // Växla bakåt till profil
      switchToScreen('mobile-screen-recipe', 'prev');
      expect(recipeScreen.classList.contains('active')).toBe(true);
      expect(recipeScreen.classList.contains('slide-in-left')).toBe(true);
      expect(maltScreen.classList.contains('active')).toBe(false);
    });

    it('reagerar på horisontell touch-swipe mellan flikar', () => {
      const container = document.getElementById('mobile-screen-container');
      expect(container).not.toBeNull();

      // Utgångsläge: Screen 1 (recipe) aktiv
      expect(document.getElementById('mobile-screen-recipe').classList.contains('active')).toBe(true);

      // Simulera swipe vänster (startX: 200 -> endX: 100, deltaX: -100)
      const touchStart = new Event('touchstart');
      touchStart.touches = [{ clientX: 200, clientY: 150 }];
      container.dispatchEvent(touchStart);

      const touchEnd = new Event('touchend');
      touchEnd.changedTouches = [{ clientX: 100, clientY: 155 }];
      container.dispatchEvent(touchEnd);

      // Ska ha växlat till Screen 2 (malt)
      expect(document.getElementById('mobile-screen-malt').classList.contains('active')).toBe(true);
      expect(document.getElementById('mobile-screen-recipe').classList.contains('active')).toBe(false);

      // Simulera swipe höger (startX: 100 -> endX: 220, deltaX: +120)
      const touchStartRight = new Event('touchstart');
      touchStartRight.touches = [{ clientX: 100, clientY: 150 }];
      container.dispatchEvent(touchStartRight);

      const touchEndRight = new Event('touchend');
      touchEndRight.changedTouches = [{ clientX: 220, clientY: 152 }];
      container.dispatchEvent(touchEndRight);

      // Ska ha växlat tillbaka till Screen 1 (recipe)
      expect(document.getElementById('mobile-screen-recipe').classList.contains('active')).toBe(true);
    });

    it('ignorerar vertikal scroll (vertikalt dominant drag)', () => {
      const container = document.getElementById('mobile-screen-container');

      // Simulera vertikal scroll (deltaX: -30, deltaY: -200)
      const touchStart = new Event('touchstart');
      touchStart.touches = [{ clientX: 150, clientY: 300 }];
      container.dispatchEvent(touchStart);

      const touchEnd = new Event('touchend');
      touchEnd.changedTouches = [{ clientX: 120, clientY: 100 }];
      container.dispatchEvent(touchEnd);

      // Ska fortfarande vara på Screen 1
      expect(document.getElementById('mobile-screen-recipe').classList.contains('active')).toBe(true);
    });
  });

  describe('2. In-place DOM Updates (Zero DOM Thrashing)', () => {
    it('återanvänder befintliga kortnoder vid värdeuppdateringar istället för att återskapa DOM:en', () => {
      State.fermentables = [
        { id: 101, name: 'Pilsnermalt', amount: 5.0, ebc: 4, type: 'base' },
        { id: 102, name: 'Carapils', amount: 0.5, ebc: 5, type: 'cara' },
      ];

      const recalcSpy = vi.fn();
      renderMobileFermentablesCards(recalcSpy);

      const container = document.getElementById('mobile-fermentables-list');
      expect(container.children.length).toBe(2);

      const card1 = container.children[0];
      const card2 = container.children[1];

      // Ändra ett värde i State
      State.fermentables[0].amount = 5.5;

      // Kör rendering igen
      renderMobileFermentablesCards(recalcSpy);

      // Noder ska bevara samma minnesreferens (inte återskapade via innerHTML = '')
      expect(container.children[0]).toBe(card1);
      expect(container.children[1]).toBe(card2);

      // Mängdfältet i första kortet ska ha uppdaterats in-place
      const amountInp = card1.querySelector('input[data-field="amount"]');
      expect(Number(amountInp.value)).toBe(5.5);
    });

    it('humlekort uppdateras in-place vid värdeändring utan att förstöra DOM:en', () => {
      State.hops = [
        { id: 201, name: 'Citra', amount: 30, alpha: 12.5, time: 15, use: 'kok' },
      ];

      const recalcSpy = vi.fn();
      renderMobileHopsCards(recalcSpy);

      const container = document.getElementById('mobile-hops-list');
      const initialCard = container.children[0];

      // Ändra mängd och kalla renderMobileHopsCards
      State.hops[0].amount = 40;
      renderMobileHopsCards(recalcSpy);

      // Samma nod ska ha bevarats
      expect(container.children[0]).toBe(initialCard);
      const amountInp = initialCard.querySelector('input[data-field="amount"]');
      expect(Number(amountInp.value)).toBe(40);
    });
  });

  describe('3. Auto-Repeat Steppers (mobileStepper.js)', () => {
    it('triggar omedelbart vid klick och repeterar vid långtryck', () => {
      vi.useFakeTimers();

      const testContainer = document.createElement('div');
      testContainer.innerHTML = `
        <button class="stepper-btn" data-step="amount" data-dir="1" data-id="1">+</button>
      `;
      document.body.appendChild(testContainer);

      const stepSpy = vi.fn();
      const cleanup = setupContinuousStepperDelegation(testContainer, stepSpy);

      const btn = testContainer.querySelector('.stepper-btn');

      // 1. Enkelt snabbt klick
      btn.click();
      expect(stepSpy).toHaveBeenCalledTimes(1);
      expect(stepSpy).toHaveBeenLastCalledWith(btn, true);

      // 2. Långtryck: pointerdown -> vänta 320ms -> repetering börjar
      stepSpy.mockClear();
      const pDown = new MouseEvent('pointerdown', { bubbles: true, button: 0 });
      btn.dispatchEvent(pDown);

      expect(stepSpy).not.toHaveBeenCalled();

      // Hoppa 325ms framåt
      vi.advanceTimersByTime(325);
      expect(stepSpy).toHaveBeenCalledTimes(1);
      expect(stepSpy).toHaveBeenLastCalledWith(btn, false);

      // Hoppa ytterligare 200ms
      vi.advanceTimersByTime(200);
      expect(stepSpy.mock.calls.length).toBeGreaterThan(1);

      // Släpp tangenten (pointerup)
      window.dispatchEvent(new Event('pointerup'));
      const callsAtRelease = stepSpy.mock.calls.length;

      // Efter pointerup ska repeteringen ha stoppats
      vi.advanceTimersByTime(200);
      expect(stepSpy.mock.calls.length).toBe(callsAtRelease);

      cleanup();
      vi.useRealTimers();
    });
  });

  describe('4. Mobil Viewport & Safe-Area CSS Integritet', () => {
    it('index.html inkluderar viewport-fit=cover för kant-till-kant på iOS/Android', () => {
      const htmlPath = path.resolve(__dirname, '../index.html');
      const html = fs.readFileSync(htmlPath, 'utf-8');
      expect(html).toContain('viewport-fit=cover');
    });

    it('style.css har safe-area insets och 44px minsta touch-yta för steppers', () => {
      const cssPath = path.resolve(__dirname, '../style.css');
      const css = fs.readFileSync(cssPath, 'utf-8');

      expect(css).toContain('safe-area-inset-top');
      expect(css).toContain('safe-area-inset-bottom');
      expect(css).toContain('touch-action: manipulation');
      expect(css).toContain('min-width: 44px');
      expect(css).toContain('min-height: 44px');
    });
  });
});
