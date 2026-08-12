import { describe, it, expect, beforeEach } from 'vitest';
import { State, createInitialState } from '../src/state.js';
import { loadPresetRecipe, openPresetRecipesModal } from '../src/ui/recipes.js';
import { PRESET_RECIPES } from '../src/core/data.js';

describe('Recipe Presets', () => {
  beforeEach(() => {
    Object.assign(State, createInitialState());
    document.body.innerHTML = `
      <div id="modal-preset-recipes" class="hidden">
        <div id="preset-recipes-list"></div>
      </div>
      <input id="recipe-name-input" />
      <input id="batch-volume" />
      <input id="boil-volume" />
      <input id="boil-time" />
      <input id="efficiency" />
      <input id="att-min" />
      <input id="att-max" />
      <textarea id="recipe-notes"></textarea>
      <select id="recipe-style"></select>
    `;
  });

  it('loads preset recipe without throwing ReferenceError', () => {
    const preset = PRESET_RECIPES[0];
    expect(() => loadPresetRecipe(preset.id, () => {})).not.toThrow();
    expect(State.recipe.name).toBe(preset.recipe.name);
    expect(State.fermentables.length).toBe(preset.fermentables.length);
    expect(State.hops.length).toBe(preset.hops.length);
  });

  it('populates preset recipes list modal and responds to click', () => {
    const mockRecalculate = vitest.fn();
    openPresetRecipesModal(mockRecalculate);

    const container = document.getElementById('preset-recipes-list');
    expect(container.children.length).toBe(PRESET_RECIPES.length);

    const firstCard = container.querySelector('.preset-recipe-card');
    const button = firstCard.querySelector('.btn-load-preset');

    button.click();

    expect(State.recipe.name).toBe(PRESET_RECIPES[0].recipe.name);
  });
});
