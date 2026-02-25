import { describe, it, expect } from 'vitest';
import { normalizeMatrix, makeIdentityMatrix } from './normalize.js';

describe('normalizeMatrix', () => {
    it('normalizes a row that sums to more than 1', () => {
        const matrix = [[2, 2, 0, 0]];
        const result = normalizeMatrix(matrix);
        expect(result[0]).toEqual([0.5, 0.5, 0, 0]);
    });

    it('normalizes a row that sums to less than 1', () => {
        const matrix = [[0.1, 0.1, 0, 0]];
        const result = normalizeMatrix(matrix);
        expect(result[0][0]).toBeCloseTo(0.5);
        expect(result[0][1]).toBeCloseTo(0.5);
    });

    it('leaves an all-zero row unchanged', () => {
        const matrix = [[0, 0, 0, 0]];
        const result = normalizeMatrix(matrix);
        expect(result[0]).toEqual([0, 0, 0, 0]);
    });

    it('leaves an already-normalized row unchanged', () => {
        const matrix = [[0.25, 0.25, 0.25, 0.25]];
        const result = normalizeMatrix(matrix);
        for (const v of result[0]) expect(v).toBeCloseTo(0.25);
    });

    it('normalizes each row independently', () => {
        const matrix = [
            [1, 1, 0, 0],
            [0, 0, 2, 2],
        ];
        const result = normalizeMatrix(matrix);
        expect(result[0]).toEqual([0.5, 0.5, 0, 0]);
        expect(result[1]).toEqual([0, 0, 0.5, 0.5]);
    });

    it('does not mutate the original matrix', () => {
        const matrix = [[2, 2, 0, 0]];
        normalizeMatrix(matrix);
        expect(matrix[0]).toEqual([2, 2, 0, 0]);
    });
});

describe('makeIdentityMatrix', () => {
    it('creates an 8×8 identity matrix by default', () => {
        const m = makeIdentityMatrix();
        expect(m.length).toBe(8);
        for (let i = 0; i < 8; i++) {
            expect(m[i].length).toBe(8);
            for (let j = 0; j < 8; j++) {
                expect(m[i][j]).toBe(i === j ? 1 : 0);
            }
        }
    });

    it('creates a matrix of arbitrary size', () => {
        const m = makeIdentityMatrix(4);
        expect(m.length).toBe(4);
        expect(m[2][2]).toBe(1);
        expect(m[2][0]).toBe(0);
    });
});
