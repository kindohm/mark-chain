/**
 * Tests for matrix operations
 */

import { describe, it, expect } from 'vitest';
import {
    sharpenRow,
    flattenRow,
    rotateRow,
    leakRow,
    adjustTarget,
    setTarget,
} from './operations.js';
import { normalize, EPS } from './utils.js';

describe('Matrix Operations', () => {
    describe('normalize', () => {
        it('should normalize a row to sum to 1.0', () => {
            const row = [1, 2, 3, 4];
            const normalized = normalize(row);
            const sum = normalized.reduce((a, b) => a + b, 0);
            expect(sum).toBeCloseTo(1.0, 10);
        });

        it('should return uniform distribution for zero row', () => {
            const row = [0, 0, 0, 0];
            const normalized = normalize(row);
            expect(normalized).toEqual([0.25, 0.25, 0.25, 0.25]);
        });

        it('should preserve already normalized rows', () => {
            const row = [0.25, 0.25, 0.25, 0.25];
            const normalized = normalize(row);
            expect(normalized).toEqual(row);
        });
    });

    describe('sharpenRow', () => {
        it('should increase max probability when alpha > 1', () => {
            const row = [0.1, 0.2, 0.7];
            const sharpened = sharpenRow(row, 2);

            // Max should increase
            expect(sharpened[2]).toBeGreaterThan(row[2]);

            // Row should still sum to 1
            const sum = sharpened.reduce((a, b) => a + b, 0);
            expect(sum).toBeCloseTo(1.0, 10);
        });

        it('should return copy when alpha = 1', () => {
            const row = [0.25, 0.25, 0.25, 0.25];
            const result = sharpenRow(row, 1);
            expect(result).toEqual(row);
            expect(result).not.toBe(row); // Should be a copy
        });

        it('should flatten when alpha < 1', () => {
            const row = [0.1, 0.2, 0.7];
            const flattened = sharpenRow(row, 0.5);

            // Max should decrease
            expect(flattened[2]).toBeLessThan(row[2]);

            // Row should still sum to 1
            const sum = flattened.reduce((a, b) => a + b, 0);
            expect(sum).toBeCloseTo(1.0, 10);
        });
    });

    describe('flattenRow', () => {
        it('should move toward uniform when lambda > 0', () => {
            const row = [0.1, 0.2, 0.7];
            const flattened = flattenRow(row, 0.5);

            const uniform = 1 / 3;

            // Each value should be closer to uniform
            expect(Math.abs(flattened[0] - uniform)).toBeLessThan(Math.abs(row[0] - uniform));
            expect(Math.abs(flattened[2] - uniform)).toBeLessThan(Math.abs(row[2] - uniform));

            // Row should still sum to 1
            const sum = flattened.reduce((a, b) => a + b, 0);
            expect(sum).toBeCloseTo(1.0, 10);
        });

        it('should produce uniform distribution when lambda = 1', () => {
            const row = [0.1, 0.2, 0.7];
            const uniform = flattenRow(row, 1);

            const expected = 1 / 3;
            uniform.forEach((p) => {
                expect(p).toBeCloseTo(expected, 10);
            });
        });

        it('should not change row when lambda = 0', () => {
            const row = [0.1, 0.2, 0.7];
            const result = flattenRow(row, 0);

            result.forEach((p, i) => {
                expect(p).toBeCloseTo(row[i], 10);
            });
        });
    });

    describe('rotateRow', () => {
        it('should rotate right by positive steps', () => {
            const row = [0.1, 0.2, 0.3, 0.4];
            const rotated = rotateRow(row, 1);

            expect(rotated).toEqual([0.4, 0.1, 0.2, 0.3]);
        });

        it('should rotate left by negative steps', () => {
            const row = [0.1, 0.2, 0.3, 0.4];
            const rotated = rotateRow(row, -1);

            expect(rotated).toEqual([0.2, 0.3, 0.4, 0.1]);
        });

        it('should handle rotation by length (full cycle)', () => {
            const row = [0.1, 0.2, 0.3, 0.4];
            const rotated = rotateRow(row, 4);

            expect(rotated).toEqual(row);
        });

        it('should return copy when steps = 0', () => {
            const row = [0.1, 0.2, 0.3, 0.4];
            const result = rotateRow(row, 0);

            expect(result).toEqual(row);
            expect(result).not.toBe(row);
        });
    });

    describe('leakRow', () => {
        it('should ensure minimum probability for all states', () => {
            const row = [0.0, 0.0, 1.0];
            const leaked = leakRow(row, 0.03);

            const minExpected = 0.03 / 3;
            leaked.forEach((p) => {
                expect(p).toBeGreaterThanOrEqual(minExpected - EPS);
            });

            // Row should still sum to 1
            const sum = leaked.reduce((a, b) => a + b, 0);
            expect(sum).toBeCloseTo(1.0, 10);
        });

        it('should preserve row sum', () => {
            const row = [0.25, 0.25, 0.25, 0.25];
            const leaked = leakRow(row, 0.02);

            const sum = leaked.reduce((a, b) => a + b, 0);
            expect(sum).toBeCloseTo(1.0, 10);
        });
    });

    describe('adjustTarget', () => {
        it('should increase target probability', () => {
            const row = [0.25, 0.25, 0.25, 0.25];
            const adjusted = adjustTarget(row, 0, 0.1);

            expect(adjusted[0]).toBeGreaterThan(row[0]);

            // Row should still sum to 1
            const sum = adjusted.reduce((a, b) => a + b, 0);
            expect(sum).toBeCloseTo(1.0, 10);
        });

        it('should decrease target probability', () => {
            const row = [0.5, 0.2, 0.2, 0.1];
            const adjusted = adjustTarget(row, 0, -0.1);

            expect(adjusted[0]).toBeLessThan(row[0]);

            // Row should still sum to 1
            const sum = adjusted.reduce((a, b) => a + b, 0);
            expect(sum).toBeCloseTo(1.0, 10);
        });

        it('should clamp to valid range', () => {
            const row = [0.9, 0.05, 0.03, 0.02];
            const adjusted = adjustTarget(row, 0, 0.5);

            expect(adjusted[0]).toBeLessThanOrEqual(1.0);

            const sum = adjusted.reduce((a, b) => a + b, 0);
            expect(sum).toBeCloseTo(1.0, 10);
        });
    });

    describe('setTarget', () => {
        it('should set target to exact value', () => {
            const row = [0.25, 0.25, 0.25, 0.25];
            const result = setTarget(row, 0, 0.5);

            // After normalization, target should have increased
            expect(result[0]).toBeGreaterThan(row[0]);

            // Row should still sum to 1
            const sum = result.reduce((a, b) => a + b, 0);
            expect(sum).toBeCloseTo(1.0, 10);
        });

        it('should clamp values to 0..1', () => {
            const row = [0.25, 0.25, 0.25, 0.25];
            const result = setTarget(row, 0, 1.5);

            // Should be clamped and normalized
            const sum = result.reduce((a, b) => a + b, 0);
            expect(sum).toBeCloseTo(1.0, 10);
        });
    });
});
