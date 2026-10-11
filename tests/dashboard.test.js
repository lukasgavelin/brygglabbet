import { describe, it, expect, vi, beforeEach } from 'vitest';
import { State } from '../src/state.js';
import {
  setupDashboard,
  switchDesktopView,
  getActiveDesktopView,
  renderDashboard,
  isDirectRecipeModeEnabled,
  setDirectRecipeMode,
} from '../src/ui/dashboard.js';
import { safeStorage, safeSessionStorage } from '../src/core/storage.js';

describe('Desktop Start-Hubb & Navigation (dashboard.js)', () => {
  beforeEach(() => {
    safeStorage.clear();
    safeSessionStorage.clear();

    document.body.innerHTML = `
      <div id="desktop-app-view">
        <header id="app-header">
          <div class="header-logo" id="header-logo">
            <h1>Brygglabbet</h1>
          </div>
          <nav class="desktop-nav-bar" id="desktop-nav-bar">
            <button class="desktop-nav-btn active" id="nav-btn-hub" data-nav-view="hub">Översikt</button>
            <button class="desktop-nav-btn" id="nav-btn-recipe" data-nav-view="recipe">Recept</button>
            <button class="desktop-nav-btn" id="nav-btn-batches" data-nav-view="batches">Mina bryggningar</button>
            <button class="desktop-nav-btn" id="nav-btn-brewday" data-nav-view="brewday">Bryggdag</button>
          </nav>
        </header>
        <div id="dashboard-view" class="dashboard-view"></div>
        <div id="app-body" class="hidden">
          <div id="tab-content">
            <section id="sec-equipment"></section>
          </div>
        </div>
      </div>
      <div id="mobile-app-view" class="view-hidden"></div>
      <div id="batches-view" class="hidden"></div>
      <div id="brewday-view" class="hidden"></div>
      <div id="modals-root"></div>
    `;

    State.recipe = {
      name: 'Test IPA',
      styleId: '21A',
      batchVolume: 20,
      efficiency: 75,
      notes: '',
    };
    State.fermentables = [{ id: 1, name: 'Pilsnermalt', amount: 5, yield: 80, ebc: 4, type: 'base' }];
    State.hops = [{ id: 1, name: 'Citra', amount: 30, alpha: 12, time: 15, use: 'kok' }];
    State.mash = [{ id: 1, name: 'Försockring', temp: 67, time: 60 }];
    State.water = { volume: 25, salts: {} };
  });

  it('initializes in hub view by default and renders dashboard', () => {
    const recalcSpy = vi.fn();
    setupDashboard(recalcSpy);

    expect(getActiveDesktopView()).toBe('hub');
    const dashboardEl = document.getElementById('dashboard-view');
    const appBody = document.getElementById('app-body');

    expect(dashboardEl.classList.contains('hidden')).toBe(false);
    expect(appBody.classList.contains('hidden')).toBe(true);

    const hubBtn = document.getElementById('nav-btn-hub');
    expect(hubBtn.classList.contains('active')).toBe(true);

    // Verify hero and cards rendered
    expect(dashboardEl.querySelector('.hub-hero-title')).not.toBeNull();
    expect(dashboardEl.querySelector('#hub-card-new-recipe')).not.toBeNull();
    expect(dashboardEl.querySelector('#hub-card-active-recipe')).not.toBeNull();
  });

  it('switches to recipe view and back to hub view', () => {
    const recalcSpy = vi.fn();
    setupDashboard(recalcSpy);

    // Switch to recipe
    switchDesktopView('recipe');
    expect(getActiveDesktopView()).toBe('recipe');

    const dashboardEl = document.getElementById('dashboard-view');
    const appBody = document.getElementById('app-body');
    const recipeBtn = document.getElementById('nav-btn-recipe');
    const hubBtn = document.getElementById('nav-btn-hub');

    expect(dashboardEl.classList.contains('hidden')).toBe(true);
    expect(appBody.classList.contains('hidden')).toBe(false);
    expect(recipeBtn.classList.contains('active')).toBe(true);
    expect(hubBtn.classList.contains('active')).toBe(false);

    // Switch back to hub
    switchDesktopView('hub');
    expect(getActiveDesktopView()).toBe('hub');
    expect(dashboardEl.classList.contains('hidden')).toBe(false);
    expect(appBody.classList.contains('hidden')).toBe(true);
    expect(hubBtn.classList.contains('active')).toBe(true);
  });

  it('respects direct recipe mode preference in safeStorage', () => {
    expect(isDirectRecipeModeEnabled()).toBe(false);
    setDirectRecipeMode(true);
    expect(isDirectRecipeModeEnabled()).toBe(true);

    setupDashboard(vi.fn());
    expect(getActiveDesktopView()).toBe('recipe');

    const appBody = document.getElementById('app-body');
    expect(appBody.classList.contains('hidden')).toBe(false);
  });

  it('clicking active recipe card switches to recipe view', () => {
    setupDashboard(vi.fn());
    renderDashboard();

    const activeCard = document.getElementById('hub-card-active-recipe');
    expect(activeCard).not.toBeNull();

    activeCard.click();
    expect(getActiveDesktopView()).toBe('recipe');
  });

  it('renders Tilt Hydrometer panel on the hub', () => {
    setupDashboard(vi.fn());
    renderDashboard();

    const tiltPanel = document.getElementById('hub-tilt-panel');
    expect(tiltPanel).not.toBeNull();
    expect(document.getElementById('hub-btn-tilt-scan')).not.toBeNull();
    expect(document.getElementById('hub-btn-tilt-demo')).not.toBeNull();
  });

  it('clicking header logo navigates back to hub', () => {
    setupDashboard(vi.fn());
    switchDesktopView('recipe');
    expect(getActiveDesktopView()).toBe('recipe');

    document.getElementById('header-logo').click();
    expect(getActiveDesktopView()).toBe('hub');
  });
});
