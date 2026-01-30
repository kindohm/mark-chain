import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Sequencer } from './sequencer.js';
import { MarkovMatrix, type StateName } from './markov.js';

describe('Sequencer', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with first state', () => {
            const matrix = new MarkovMatrix(4);
            const sequencer = new Sequencer(matrix, { tempo: 120 });

            expect(sequencer.getCurrentState()).toBe('A');
            expect(sequencer.getIsRunning()).toBe(false);
        });

        it('should set tempo from config', () => {
            const matrix = new MarkovMatrix(4);
            const sequencer = new Sequencer(matrix, { tempo: 140 });

            expect(sequencer.getTempo()).toBe(140);
        });
    });

    describe('start and stop', () => {
        it('should start the sequencer', () => {
            const matrix = new MarkovMatrix(4);
            const sequencer = new Sequencer(matrix, { tempo: 120 });

            sequencer.start();
            expect(sequencer.getIsRunning()).toBe(true);
        });

        it('should stop the sequencer', () => {
            const matrix = new MarkovMatrix(4);
            const sequencer = new Sequencer(matrix, { tempo: 120 });

            sequencer.start();
            sequencer.stop();
            expect(sequencer.getIsRunning()).toBe(false);
        });

        it('should not start twice', () => {
            const matrix = new MarkovMatrix(4);
            const onStateChange = vi.fn();
            const sequencer = new Sequencer(matrix, { tempo: 120, onStateChange });

            sequencer.start();
            sequencer.start(); // Try to start again

            // Advance time to trigger one step (16th note at 120 BPM = 125ms)
            vi.advanceTimersByTime(125);

            // Should only trigger once
            expect(onStateChange).toHaveBeenCalledTimes(1);
        });
    });

    describe('tempo', () => {
        it('should set tempo', () => {
            const matrix = new MarkovMatrix(4);
            const sequencer = new Sequencer(matrix, { tempo: 120 });

            sequencer.setTempo(140);
            expect(sequencer.getTempo()).toBe(140);
        });

        it('should throw error for invalid tempo', () => {
            const matrix = new MarkovMatrix(4);
            const sequencer = new Sequencer(matrix, { tempo: 120 });

            expect(() => sequencer.setTempo(0)).toThrow('Tempo must be positive');
            expect(() => sequencer.setTempo(-10)).toThrow('Tempo must be positive');
        });

        it('should support fractional tempo', () => {
            const matrix = new MarkovMatrix(4);
            const sequencer = new Sequencer(matrix, { tempo: 120.5 });

            expect(sequencer.getTempo()).toBe(120.5);
        });
    });

    describe('state transitions', () => {
        it('should transition states based on matrix', () => {
            const matrix = new MarkovMatrix(4);
            // Create deterministic cycle: A -> B -> C -> D -> A
            matrix.setProbability('A', 'B', 1.0);
            matrix.setProbability('B', 'C', 1.0);
            matrix.setProbability('C', 'D', 1.0);
            matrix.setProbability('D', 'A', 1.0);

            const sequencer = new Sequencer(matrix, { tempo: 120 });
            sequencer.start();

            expect(sequencer.getCurrentState()).toBe('A');

            // Advance one 16th note (125ms at 120 BPM)
            vi.advanceTimersByTime(125);
            expect(sequencer.getCurrentState()).toBe('B');

            vi.advanceTimersByTime(125);
            expect(sequencer.getCurrentState()).toBe('C');

            vi.advanceTimersByTime(125);
            expect(sequencer.getCurrentState()).toBe('D');

            vi.advanceTimersByTime(125);
            expect(sequencer.getCurrentState()).toBe('A');
        });

        it('should call onStateChange callback', () => {
            const matrix = new MarkovMatrix(4);
            matrix.setProbability('A', 'B', 1.0);

            const onStateChange = vi.fn();
            const sequencer = new Sequencer(matrix, { tempo: 120, onStateChange });

            sequencer.start();
            vi.advanceTimersByTime(125);

            expect(onStateChange).toHaveBeenCalledWith('B');
        });

        it('should respect tempo changes', () => {
            const matrix = new MarkovMatrix(4);
            matrix.setProbability('A', 'B', 1.0);

            const onStateChange = vi.fn();
            const sequencer = new Sequencer(matrix, { tempo: 120, onStateChange });

            sequencer.start();

            // At 120 BPM, 16th note interval is 125ms
            vi.advanceTimersByTime(125);
            expect(onStateChange).toHaveBeenCalledTimes(1);

            // Change to 60 BPM (250ms per 16th note)
            sequencer.setTempo(60);

            // The already-scheduled timeout will still fire at 125ms
            vi.advanceTimersByTime(125);
            expect(onStateChange).toHaveBeenCalledTimes(2);

            // Now the new tempo should be in effect (250ms)
            vi.advanceTimersByTime(250);
            expect(onStateChange).toHaveBeenCalledTimes(3);
        });

        it('should stop triggering callbacks when stopped', () => {
            const matrix = new MarkovMatrix(4);
            matrix.setProbability('A', 'B', 1.0);

            const onStateChange = vi.fn();
            const sequencer = new Sequencer(matrix, { tempo: 120, onStateChange });

            sequencer.start();
            vi.advanceTimersByTime(125);
            expect(onStateChange).toHaveBeenCalledTimes(1);

            sequencer.stop();

            // Advance more time - should not trigger
            vi.advanceTimersByTime(1000);
            expect(onStateChange).toHaveBeenCalledTimes(1); // Still 1
        });
    });
});
