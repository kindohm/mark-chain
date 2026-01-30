/**
 * Tests for sequencer engine
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SequencerEngine, selectNextState, bpmToMs } from './engine.js';
import type { Matrix } from '../matrix/types.js';

describe('Sequencer Engine', () => {
    describe('selectNextState', () => {
        it('should select state based on probabilities', () => {
            // Deterministic matrix: always go to next state
            const matrix: Matrix = [
                [0, 1, 0, 0],
                [0, 0, 1, 0],
                [0, 0, 0, 1],
                [1, 0, 0, 0],
            ];

            expect(selectNextState(0, matrix)).toBe(1);
            expect(selectNextState(1, matrix)).toBe(2);
            expect(selectNextState(2, matrix)).toBe(3);
            expect(selectNextState(3, matrix)).toBe(0);
        });

        it('should handle probabilistic transitions', () => {
            const matrix: Matrix = [
                [0.5, 0.5, 0, 0],
                [0, 0, 0.5, 0.5],
                [0, 0, 0, 1],
                [1, 0, 0, 0],
            ];

            // Run many times to test probability distribution
            const results = new Map<number, number>();
            for (let i = 0; i < 1000; i++) {
                const next = selectNextState(0, matrix);
                results.set(next, (results.get(next) || 0) + 1);
            }

            // Should only transition to states 0 or 1
            expect(results.get(0)).toBeGreaterThan(400);
            expect(results.get(0)).toBeLessThan(600);
            expect(results.get(1)).toBeGreaterThan(400);
            expect(results.get(1)).toBeLessThan(600);
            expect(results.get(2)).toBeUndefined();
            expect(results.get(3)).toBeUndefined();
        });
    });

    describe('bpmToMs', () => {
        it('should convert BPM to milliseconds correctly (sixteenth notes)', () => {
            expect(bpmToMs(60)).toBe(250); // 60 BPM = 1 beat per second, 4 sixteenth notes = 250ms each
            expect(bpmToMs(120)).toBe(125); // 120 BPM = 2 beats per second, 4 sixteenth notes = 125ms each
            expect(bpmToMs(240)).toBe(62.5); // 240 BPM = 4 beats per second, 4 sixteenth notes = 62.5ms each
        });
    });

    describe('SequencerEngine', () => {
        let engine: SequencerEngine;
        let matrix: Matrix;

        beforeEach(() => {
            matrix = [
                [0, 1, 0, 0],
                [0, 0, 1, 0],
                [0, 0, 0, 1],
                [1, 0, 0, 0],
            ];
            engine = new SequencerEngine(matrix, { bpm: 240 }); // Fast for testing
        });

        afterEach(() => {
            engine.stop();
        });

        it('should initialize with correct state', () => {
            const state = engine.getState();
            expect(state.currentState).toBe(0);
            expect(state.isRunning).toBe(false);
            expect(state.stepCount).toBe(0);
        });

        it('should transition states when running', async () => {
            const transitions: number[] = [];

            engine.onStateTransition((event) => {
                transitions.push(event.toState);
            });

            engine.start();

            // Wait for a few transitions
            await new Promise((resolve) => setTimeout(resolve, 1000));
            engine.stop();

            expect(transitions.length).toBeGreaterThan(0);
            // With deterministic matrix, should cycle through states
            expect(transitions).toContain(1);
        });

        it('should stop when requested', async () => {
            let transitionCount = 0;

            engine.onStateTransition(() => {
                transitionCount++;
            });

            engine.start();
            await new Promise((resolve) => setTimeout(resolve, 300));
            engine.stop();

            const countAtStop = transitionCount;

            // Wait a bit more
            await new Promise((resolve) => setTimeout(resolve, 300));

            // Count should not increase after stop
            expect(transitionCount).toBe(countAtStop);
        });

        it('should reset to initial state', async () => {
            engine.start();
            await new Promise((resolve) => setTimeout(resolve, 300));
            engine.reset();

            const state = engine.getState();
            expect(state.currentState).toBe(0);
            expect(state.stepCount).toBe(0);
            expect(state.isRunning).toBe(false);
        });

        it('should update matrix', () => {
            const newMatrix: Matrix = [
                [1, 0, 0, 0],
                [1, 0, 0, 0],
                [1, 0, 0, 0],
                [1, 0, 0, 0],
            ];

            engine.updateMatrix(newMatrix);
            engine.start();

            engine.onStateTransition((event) => {
                // With new matrix, should always go to state 0
                expect(event.toState).toBe(0);
            });
        });
    });
});
