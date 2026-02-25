/**
 * Tests for matrix engine with lock diagonal feature
 */

import { describe, it, expect } from 'vitest';
import {
    createInitialMatrix,
    applyRowOperation,
    toggleDiagonalLock
} from './engine.js';

describe('Matrix Engine - Lock Diagonal', () => {
    it('should preserve diagonal when lock is enabled for sharpen', () => {
        const state = createInitialMatrix(4);

        // Set a specific diagonal value
        state.matrix[0] = [0.4, 0.2, 0.2, 0.2]; // State A has 0.4 self-transition

        // Enable lock
        const lockedState = toggleDiagonalLock(state);
        expect(lockedState.lockDiagonal).toBe(true);

        // Apply sharpen operation
        const result = applyRowOperation(lockedState, { type: 'sharpen', alpha: 1.5 });

        // Diagonal should be preserved
        expect(result.matrix[0][0]).toBeCloseTo(0.4, 5);

        // Row should still sum to 1
        const sum = result.matrix[0].reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1.0, 5);
    });

    it('should preserve diagonal when lock is enabled for flatten', () => {
        const state = createInitialMatrix(4);

        // Set a specific diagonal value
        state.matrix[1] = [0.1, 0.6, 0.2, 0.1]; // State B has 0.6 self-transition
        state.selectedStateIndex = 1;

        // Enable lock
        const lockedState = toggleDiagonalLock(state);

        // Apply flatten operation
        const result = applyRowOperation(lockedState, { type: 'flatten', lambda: 0.5 });

        // Diagonal should be preserved
        expect(result.matrix[1][1]).toBeCloseTo(0.6, 5);

        // Row should still sum to 1
        const sum = result.matrix[1].reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1.0, 5);
    });

    it('should preserve diagonal when lock is enabled for rotate', () => {
        const state = createInitialMatrix(4);

        // Set a specific diagonal value
        state.matrix[2] = [0.3, 0.1, 0.5, 0.1]; // State C has 0.5 self-transition
        state.selectedStateIndex = 2;

        // Enable lock
        const lockedState = toggleDiagonalLock(state);

        // Apply rotate operation
        const result = applyRowOperation(lockedState, { type: 'rotate', steps: 1 });

        // Diagonal should be preserved
        expect(result.matrix[2][2]).toBeCloseTo(0.5, 5);

        // Row should still sum to 1
        const sum = result.matrix[2].reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1.0, 5);
    });

    it('should preserve diagonal when lock is enabled for leak', () => {
        const state = createInitialMatrix(4);

        // Set a specific diagonal value
        state.matrix[0] = [0.7, 0.1, 0.1, 0.1]; // State A has 0.7 self-transition

        // Enable lock
        const lockedState = toggleDiagonalLock(state);

        // Apply leak operation
        const result = applyRowOperation(lockedState, { type: 'leak', epsilonTotal: 0.1 });

        // Diagonal should be preserved
        expect(result.matrix[0][0]).toBeCloseTo(0.7, 5);

        // Row should still sum to 1
        const sum = result.matrix[0].reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1.0, 5);
    });

    it('should NOT preserve diagonal when lock is disabled', () => {
        const state = createInitialMatrix(4);

        // Set a specific diagonal value
        state.matrix[0] = [0.4, 0.2, 0.2, 0.2]; // State A has 0.4 self-transition

        // Lock is disabled by default
        expect(state.lockDiagonal).toBe(false);

        // Apply sharpen operation
        const result = applyRowOperation(state, { type: 'sharpen', alpha: 2.0 });

        // Diagonal should have changed (sharpened)
        expect(result.matrix[0][0]).not.toBeCloseTo(0.4, 5);

        // Row should still sum to 1
        const sum = result.matrix[0].reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1.0, 5);
    });

    it('should allow setTarget to modify diagonal even when locked', () => {
        const state = createInitialMatrix(4);

        // Set a specific diagonal value
        state.matrix[0] = [0.4, 0.2, 0.2, 0.2]; // State A has 0.4 self-transition

        // Enable lock
        const lockedState = toggleDiagonalLock(state);

        // Apply setTarget to the diagonal itself
        const result = applyRowOperation(lockedState, {
            type: 'setTarget',
            targetIndex: 0,
            delta: 0.1
        });

        // Diagonal should have changed (setTarget is not affected by lock)
        expect(result.matrix[0][0]).not.toBeCloseTo(0.4, 5);

        // Row should still sum to 1
        const sum = result.matrix[0].reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1.0, 5);
    });

    it('should preserve diagonal across multiple operations when locked', () => {
        let state = createInitialMatrix(4);

        // Set a specific diagonal value
        state.matrix[0] = [0.5, 0.2, 0.2, 0.1]; // State A has 0.5 self-transition

        // Enable lock
        state = toggleDiagonalLock(state);

        // Apply multiple operations
        state = applyRowOperation(state, { type: 'sharpen', alpha: 1.5 });
        state = applyRowOperation(state, { type: 'flatten', lambda: 0.3 });
        state = applyRowOperation(state, { type: 'rotate', steps: 1 });

        // Diagonal should still be preserved
        expect(state.matrix[0][0]).toBeCloseTo(0.5, 5);

        // Row should still sum to 1
        const sum = state.matrix[0].reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1.0, 5);
    });
});
