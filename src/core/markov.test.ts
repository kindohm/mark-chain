import { describe, it, expect } from 'vitest';
import { MarkovMatrix, type StateName } from './markov.js';

describe('MarkovMatrix', () => {
    describe('constructor', () => {
        it('should create a matrix with 4 states by default', () => {
            const matrix = new MarkovMatrix();
            expect(matrix.getStates()).toEqual(['A', 'B', 'C', 'D']);
        });

        it('should create a matrix with specified number of states', () => {
            const matrix = new MarkovMatrix(8);
            expect(matrix.getStates()).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
        });

        it('should throw error for invalid number of states', () => {
            expect(() => new MarkovMatrix(1)).toThrow('Number of states must be between 2 and 16');
            expect(() => new MarkovMatrix(17)).toThrow('Number of states must be between 2 and 16');
        });

        it('should initialize all probabilities to 0', () => {
            const matrix = new MarkovMatrix(3);
            expect(matrix.getProbability('A', 'A')).toBe(0);
            expect(matrix.getProbability('A', 'B')).toBe(0);
            expect(matrix.getProbability('B', 'C')).toBe(0);
        });
    });

    describe('setProbability and getProbability', () => {
        it('should set and get probabilities', () => {
            const matrix = new MarkovMatrix(4);
            matrix.setProbability('A', 'B', 0.5);
            expect(matrix.getProbability('A', 'B')).toBe(0.5);
        });

        it('should throw error for invalid states', () => {
            const matrix = new MarkovMatrix(4);
            expect(() => matrix.setProbability('E' as StateName, 'A', 0.5)).toThrow('Invalid from state: E');
            expect(() => matrix.setProbability('A', 'E' as StateName, 0.5)).toThrow('Invalid to state: E');
            expect(() => matrix.getProbability('E' as StateName, 'A')).toThrow('Invalid from state: E');
        });

        it('should throw error for negative probabilities', () => {
            const matrix = new MarkovMatrix(4);
            expect(() => matrix.setProbability('A', 'B', -0.5)).toThrow('Probability cannot be negative');
        });
    });

    describe('getNextState', () => {
        it('should return current state when all probabilities are 0', () => {
            const matrix = new MarkovMatrix(4);
            expect(matrix.getNextState('A')).toBe('A');
            expect(matrix.getNextState('B')).toBe('B');
        });

        it('should always transition to state with 100% probability', () => {
            const matrix = new MarkovMatrix(4);
            matrix.setProbability('A', 'B', 1.0);

            // Test multiple times to ensure consistency
            for (let i = 0; i < 10; i++) {
                expect(matrix.getNextState('A')).toBe('B');
            }
        });

        it('should handle normalized probabilities (row sums to 3.0)', () => {
            const matrix = new MarkovMatrix(4);
            // Set probabilities that sum to 3.0 but have same relative weights as 0.33/0.67
            matrix.setProbability('A', 'B', 1.0);
            matrix.setProbability('A', 'D', 2.0);

            const results = new Set<StateName>();
            for (let i = 0; i < 100; i++) {
                results.add(matrix.getNextState('A'));
            }

            // Should only transition to B or D (not A or C)
            expect(results.has('A')).toBe(false);
            expect(results.has('C')).toBe(false);
            expect(results.has('B') || results.has('D')).toBe(true);
        });

        it('should create a deterministic cycle A -> B -> C -> D -> A', () => {
            const matrix = new MarkovMatrix(4);
            matrix.setProbability('A', 'B', 1.0);
            matrix.setProbability('B', 'C', 1.0);
            matrix.setProbability('C', 'D', 1.0);
            matrix.setProbability('D', 'A', 1.0);

            let state: StateName = 'A';
            state = matrix.getNextState(state);
            expect(state).toBe('B');
            state = matrix.getNextState(state);
            expect(state).toBe('C');
            state = matrix.getNextState(state);
            expect(state).toBe('D');
            state = matrix.getNextState(state);
            expect(state).toBe('A');
        });

        it('should throw error for invalid current state', () => {
            const matrix = new MarkovMatrix(4);
            expect(() => matrix.getNextState('E' as StateName)).toThrow('Invalid current state: E');
        });
    });

    describe('toJSON and fromJSON', () => {
        it('should serialize and deserialize matrix', () => {
            const matrix = new MarkovMatrix(4);
            matrix.setProbability('A', 'B', 0.5);
            matrix.setProbability('B', 'C', 0.75);
            matrix.setProbability('C', 'D', 1.0);

            const json = matrix.toJSON();
            const restored = MarkovMatrix.fromJSON(json);

            expect(restored.getStates()).toEqual(matrix.getStates());
            expect(restored.getProbability('A', 'B')).toBe(0.5);
            expect(restored.getProbability('B', 'C')).toBe(0.75);
            expect(restored.getProbability('C', 'D')).toBe(1.0);
        });

        it('should preserve all probabilities during serialization', () => {
            const matrix = new MarkovMatrix(3);
            matrix.setProbability('A', 'A', 0.1);
            matrix.setProbability('A', 'B', 0.2);
            matrix.setProbability('A', 'C', 0.3);
            matrix.setProbability('B', 'A', 0.4);
            matrix.setProbability('B', 'B', 0.5);
            matrix.setProbability('B', 'C', 0.6);

            const json = matrix.toJSON();
            const restored = MarkovMatrix.fromJSON(json);

            expect(restored.getProbability('A', 'A')).toBe(0.1);
            expect(restored.getProbability('A', 'B')).toBe(0.2);
            expect(restored.getProbability('A', 'C')).toBe(0.3);
            expect(restored.getProbability('B', 'A')).toBe(0.4);
            expect(restored.getProbability('B', 'B')).toBe(0.5);
            expect(restored.getProbability('B', 'C')).toBe(0.6);
        });
    });
});
