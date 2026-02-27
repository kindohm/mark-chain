import { describe, expect, it } from 'vitest';
import { applyMatrixTransform } from './transform.js';
import type { Matrix } from './types.js';

function rowSum(row: number[]): number {
    return row.reduce((acc, value) => acc + value, 0);
}

describe('applyMatrixTransform', () => {
    it('does not mutate the original matrix', () => {
        const matrix: Matrix = [
            [0.1, 0.8, 0.1],
            [0.7, 0.2, 0.1],
            [0.2, 0.2, 0.6],
        ];
        const before = matrix.map((row) => [...row]);

        void applyMatrixTransform(matrix, 'reciprocal_loops', 'positive', { amount: 0.4 });

        expect(matrix).toEqual(before);
    });

    it('keeps rows normalized after transforming', () => {
        const matrix: Matrix = [
            [0.2, 0.6, 0.2],
            [0.3, 0.3, 0.4],
            [0.5, 0.1, 0.4],
        ];
        const result = applyMatrixTransform(matrix, 'settle', 'positive', { amount: 0.6 });

        for (const row of result) {
            expect(rowSum(row)).toBeCloseTo(1, 6);
        }
    });

    it('strengthens reciprocal edges for reciprocal_loops positive', () => {
        const matrix: Matrix = [
            [0.1, 0.8, 0.1],
            [0.7, 0.2, 0.1],
            [0.2, 0.2, 0.6],
        ];
        const result = applyMatrixTransform(matrix, 'reciprocal_loops', 'positive', { amount: 0.6 });

        expect(result[0][1]).toBeGreaterThan(matrix[0][1]);
    });

    it('suppresses reciprocal edges for reciprocal_loops negative', () => {
        const matrix: Matrix = [
            [0.1, 0.8, 0.1],
            [0.7, 0.2, 0.1],
            [0.2, 0.2, 0.6],
        ];
        const result = applyMatrixTransform(matrix, 'reciprocal_loops', 'negative', { amount: 0.6 });

        expect(result[0][1]).toBeLessThan(matrix[0][1]);
    });

    it('pushes toward local cycles for cycle_inject positive', () => {
        const matrix: Matrix = [
            [0.3, 0.3, 0.4, 0],
            [0.3, 0.3, 0.4, 0],
            [0.2, 0.2, 0.2, 0.4],
            [0.2, 0.2, 0.2, 0.4],
        ];
        const result = applyMatrixTransform(matrix, 'cycle_inject', 'positive', { amount: 0.5, cycleLength: 2 });

        expect(result[0][1]).toBeGreaterThan(matrix[0][1]);
        expect(result[1][0]).toBeGreaterThan(matrix[1][0]);
    });

    it('increases self-transition weight for settle positive', () => {
        const matrix: Matrix = [
            [0.2, 0.8],
            [0.8, 0.2],
        ];
        const result = applyMatrixTransform(matrix, 'settle', 'positive', { amount: 0.8 });

        expect(result[0][0]).toBeGreaterThan(matrix[0][0]);
        expect(result[1][1]).toBeGreaterThan(matrix[1][1]);
    });
});
