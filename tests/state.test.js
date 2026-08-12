import { describe, it, expect, beforeEach } from 'vitest';
import { State, createInitialState, pushHistory, undoState, redoState, canUndo, canRedo } from '../src/state.js';

describe('State Management & Undo/Redo Module', () => {
  beforeEach(() => {
    Object.assign(State, createInitialState());
  });

  it('initializes with default recipe state', () => {
    expect(State.recipe.name).toBe('Mitt nya öl');
    expect(State.recipe.batchVolume).toBe(20);
    expect(State.fermentables).toEqual([]);
  });

  it('records history snapshots and supports undo/redo', () => {
    // Save snapshot 1 before change 1
    pushHistory();
    State.recipe.name = 'Ändrat Ölnamn';

    // Save snapshot 2 before change 2
    pushHistory();
    State.recipe.batchVolume = 25;

    expect(State.recipe.batchVolume).toBe(25);
    expect(canUndo()).toBe(true);

    // Perform Undo (restores state before change 2)
    const undone = undoState();
    expect(undone).toBe(true);
    expect(State.recipe.batchVolume).toBe(20);
    expect(State.recipe.name).toBe('Ändrat Ölnamn');

    // Perform Redo
    const redone = redoState();
    expect(redone).toBe(true);
    expect(State.recipe.batchVolume).toBe(25);
  });

  it('clears redo stack upon new pushHistory', () => {
    pushHistory();
    State.recipe.name = 'Steg 1';

    undoState();
    expect(canRedo()).toBe(true);

    // New action should clear redo stack
    pushHistory();
    State.recipe.name = 'Ny väg';
    expect(canRedo()).toBe(false);
  });
});
