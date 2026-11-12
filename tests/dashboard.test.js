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
          <div class="header-recipe-controls hidden" id="header-recipe-controls">
            <input type="text" id="recipe-name-input" value="Mitt nya öl">
            <button id="btn-toggle-brewday">Bryggdag</button>
            <button id="btn-save">Spara</button>
            <button id="btn-batches" style="display:none;"></button>
          </div>
          <div class="header-hub-controls" id="header-hub-controls">
            <button id="btn-hub-header-tools">Bryggverktyg</button>
            <button id="btn-switch-to-mobile-header">Mobilvy</button>
          </div>
          <div class="header-actions">
            <button id="btn-header-menu">Meny</button>
            <button id="btn-switch-to-mobile"></button>
          </div>
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

  it('manages contextual header controls when switching views', () => {
    setupDashboard(vi.fn());

    const recipeControls = document.getElementById('header-recipe-controls');
    const hubControls = document.getElementById('header-hub-controls');

    // On hub view: recipe controls hidden, hub controls visible
    expect(getActiveDesktopView()).toBe('hub');
    expect(recipeControls.classList.contains('hidden')).toBe(true);
    expect(hubControls.classList.contains('hidden')).toBe(false);

    // On recipe view: recipe controls visible, hub controls hidden
    switchDesktopView('recipe');
    expect(getActiveDesktopView()).toBe('recipe');
    expect(recipeControls.classList.contains('hidden')).toBe(false);
    expect(hubControls.classList.contains('hidden')).toBe(true);

    // On batches view: both hidden
    switchDesktopView('batches');
    expect(getActiveDesktopView()).toBe('batches');
    expect(recipeControls.classList.contains('hidden')).toBe(true);
    expect(hubControls.classList.contains('hidden')).toBe(true);
  });

  it('renders 3-zone cockpit with spotlight, telemetry and grouped tools', () => {
    setupDashboard(vi.fn());
    renderDashboard();

    const dashboardEl = document.getElementById('dashboard-view');

    // Verify 3 distinct zone headers
    const zoneTags = Array.from(dashboardEl.querySelectorAll('.hub-zone-tag')).map((el) => el.textContent);
    expect(zoneTags).toEqual(['Zon 1', 'Zon 2', 'Zon 3']);

    // Zon 1 Spotlight
    const spotlightCard = dashboardEl.querySelector('#hub-card-active-recipe');
    expect(spotlightCard).not.toBeNull();
    expect(spotlightCard.textContent).toContain('Test IPA');
    expect(dashboardEl.querySelector('.hub-spotlight-metrics')).not.toBeNull();

    // Quick tags
    const quickTags = dashboardEl.querySelectorAll('.hub-tag[data-preset]');
    expect(quickTags.length).toBeGreaterThanOrEqual(4);

    // Zon 2 Active batches & Tilt
    expect(dashboardEl.querySelector('#hub-btn-all-batches')).not.toBeNull();
    expect(dashboardEl.querySelector('#hub-tilt-panel')).not.toBeNull();

    // Zon 3 Archive & Grouped Tools
    expect(dashboardEl.querySelector('#hub-btn-manage-recipes')).not.toBeNull();
    expect(dashboardEl.querySelector('#hub-btn-all-tools')).not.toBeNull();
    expect(dashboardEl.querySelector('#hub-tool-carb')).not.toBeNull();
    expect(dashboardEl.querySelector('#hub-tool-refrac')).not.toBeNull();
    expect(dashboardEl.querySelector('#hub-tool-yeast')).not.toBeNull();
    expect(dashboardEl.querySelector('#hub-tool-strike')).not.toBeNull();
  });

  it('clicking a preset quicktag loads the preset and routes to recipe view', () => {
    const recalcSpy = vi.fn();
    setupDashboard(recalcSpy);
    renderDashboard();

    const pilsnerTag = document.querySelector('.hub-tag[data-preset="klassisk_pilsner"]');
    expect(pilsnerTag).not.toBeNull();

    pilsnerTag.click();

    expect(getActiveDesktopView()).toBe('recipe');
    expect(State.recipe.name).toBe('Klassisk Lager / Pilsner');
    expect(recalcSpy).toHaveBeenCalled();
  });
});
