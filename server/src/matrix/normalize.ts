import type { Matrix } from './types.js';

/**
 * Normalize a matrix so each row sums to 1.0.
 * Rows that sum to 0 are left unchanged (no transitions defined).
 */
export function normalizeMatrix(matrix: Matrix): Matrix {
    return matrix.map((row) => {
        const sum = row.reduce((acc, v) => acc + v, 0);
        if (sum === 0) return [...row];
        return row.map((v) => v / sum);
    });
}

/**
 * Build an 8×8 identity matrix (diagonal = 1.0, all others 0.0).
 */
export function makeIdentityMatrix(size: number = 8): Matrix {
    return Array.from({ length: size }, (_, i) =>
        Array.from({ length: size }, (_, j) => (i === j ? 1 : 0))
    );
}

/**
 * Build a sequential matrix where each state transitions 100% to the next.
 * A→B→C→…→last→A (wraps around).
 * Used as the default initial state per the spec.
 */
export function makeSequentialMatrix(size: number = 8): Matrix {
    return Array.from({ length: size }, (_, i) =>
        Array.from({ length: size }, (_, j) => (j === (i + 1) % size ? 1 : 0))
    );
}
