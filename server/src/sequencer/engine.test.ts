import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { selectNextState, bpmToMs, SequencerEngine } from './engine.js';
import type { Matrix } from '../matrix/types.js';

describe('selectNextState', () => {
    it('returns the only non-zero target', () => {
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

    it('distributes results roughly uniformly for equal probabilities', () => {
        const matrix: Matrix = [[0.25, 0.25, 0.25, 0.25]];
        const counts = [0, 0, 0, 0];
        for (let i = 0; i < 4000; i++) {
            counts[selectNextState(0, matrix)]++;
        }
        // Each should be roughly 25% — allow 10% tolerance
        for (const count of counts) {
            expect(count).toBeGreaterThan(800);
            expect(count).toBeLessThan(1200);
        }
    });

    it('falls back to last state on all-zero row', () => {
        const matrix: Matrix = [[0, 0, 0, 0]];
        expect(selectNextState(0, matrix)).toBe(3);
    });
});

describe('bpmToMs', () => {
    it('returns 125ms for 120 BPM (16th notes)', () => {
        expect(bpmToMs(120)).toBe(125);
    });

    it('returns 250ms for 60 BPM', () => {
        expect(bpmToMs(60)).toBe(250);
    });

    it('scales proportionally', () => {
        expect(bpmToMs(240)).toBe(62.5);
    });
});

describe('SequencerEngine', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const makeIdentityMatrix = (n: number): Matrix =>
        Array.from({ length: n }, (_, i) =>
            Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
        );

    it('starts and fires transition callbacks', () => {
        const matrix = makeIdentityMatrix(4);
        const engine = new SequencerEngine(matrix, { bpm: 120 });
        const callback = vi.fn();
        engine.onStateTransition(callback);

        engine.start();
        vi.advanceTimersByTime(500); // 4 steps at 125ms each
        expect(callback).toHaveBeenCalledTimes(4);
    });

    it('does not fire after stop', () => {
        const matrix = makeIdentityMatrix(4);
        const engine = new SequencerEngine(matrix, { bpm: 120 });
        const callback = vi.fn();
        engine.onStateTransition(callback);

        engine.start();
        vi.advanceTimersByTime(250); // 2 steps
        engine.stop();
        vi.advanceTimersByTime(500); // should not fire more
        expect(callback).toHaveBeenCalledTimes(2);
    });

    it('stays on same state with identity matrix', () => {
        const matrix = makeIdentityMatrix(4);
        const engine = new SequencerEngine(matrix, { bpm: 120 });
        const transitions: number[] = [];
        engine.onStateTransition((e) => transitions.push(e.toState));

        engine.start();
        vi.advanceTimersByTime(500);

        // identity matrix: always stays on state 0
        expect(transitions.every((s) => s === 0)).toBe(true);
    });

    it('does not start twice', () => {
        const matrix = makeIdentityMatrix(4);
        const engine = new SequencerEngine(matrix, { bpm: 120 });
        const callback = vi.fn();
        engine.onStateTransition(callback);

        engine.start();
        engine.start(); // second call should be a no-op
        vi.advanceTimersByTime(500);
        expect(callback).toHaveBeenCalledTimes(4);
    });

    it('increments step count', () => {
        const matrix = makeIdentityMatrix(4);
        const engine = new SequencerEngine(matrix, { bpm: 120 });
        engine.start();
        vi.advanceTimersByTime(375); // 3 steps
        expect(engine.getState().stepCount).toBe(3);
    });
});
