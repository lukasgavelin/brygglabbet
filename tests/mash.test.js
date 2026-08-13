import { describe, it, expect, beforeEach, vi } from 'vitest';
import { State, createInitialState } from '../src/state.js';
import { setupMashTab, addMashStep } from '../src/ui/mash.js';
import { MASH_PRESETS } from '../src/core/data.js';

describe('Mash UI & State Integration', () => {
  let recalculateMock;

  beforeEach(() => {
    Object.assign(State, createInitialState());
    recalculateMock = vi.fn();

    document.body.innerHTML = `
      <button id="btn-add-mash-step"></button>
      <button class="preset-btn" data-mash-preset="single_medium"></button>
      <table id="mash-table" style="display: none;">
        <tbody id="mash-body"></tbody>
      </table>
      <div id="mash-empty"></div>
      <span id="mash-total-time"></span>
      <span id="mash-step-count"></span>
      <div id="mash-timeline"></div>
    `;
  });

  it('should add a mash step and assign a numeric ID', () => {
    addMashStep({ name: 'Steg 1', type: 'Infusion', temp: 65, time: 40 }, recalculateMock);

    expect(State.mash).toHaveLength(1);
    expect(State.mash[0].name).toBe('Steg 1');
    expect(typeof State.mash[0].id).toBe('number');
    expect(recalculateMock).toHaveBeenCalledTimes(1);
  });

  it('should render mash step rows and remove a step on delete click', () => {
    addMashStep({ name: 'Steg 1', type: 'Infusion', temp: 65, time: 40 }, recalculateMock);
    addMashStep({ name: 'Steg 2', type: 'Infusion', temp: 70, time: 20 }, recalculateMock);

    expect(State.mash).toHaveLength(2);

    const tbody = document.getElementById('mash-body');
    expect(tbody.children).toHaveLength(2);

    // Get the remove button for the first step
    const removeBtn = tbody.querySelector(`[data-id="${State.mash[0].id}"][data-remove="mash"]`);
    expect(removeBtn).not.toBeNull();

    // Click remove button
    removeBtn.click();

    expect(State.mash).toHaveLength(1);
    expect(State.mash[0].name).toBe('Steg 2');
    expect(tbody.children).toHaveLength(1);
  });

  it('should load a preset and assign IDs correctly', () => {
    setupMashTab(recalculateMock);

    const presetBtn = document.querySelector('[data-mash-preset="single_medium"]');
    expect(presetBtn).not.toBeNull();

    presetBtn.click();

    const expectedPreset = MASH_PRESETS['single_medium'];
    expect(State.mash).toHaveLength(expectedPreset.steps.length);
    State.mash.forEach((step) => {
      expect(typeof step.id).toBe('number');
    });
    expect(recalculateMock).toHaveBeenCalled();
  });
});
