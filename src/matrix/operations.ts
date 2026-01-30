/**
 * Row operations for Markov chain matrix editing
 * Exact implementations from .agent/tui.md
 */

import type { Row } from './types.js';
import { normalize, clamp, EPS } from './utils.js';

/**
 * Sharpen or flatten a row using exponent method
 * @param row - probability row (assumed normalized)
 * @param alpha - >1 sharpens, <1 flattens, =1 no-op
 */
export function sharpenRow(row: Row, alpha: number): Row {
    if (Math.abs(alpha - 1) < EPS) return [...row];

    const powered = row.map((p) => Math.pow(clamp(p), alpha));
    return normalize(powered);
}

/**
 * Flatten a row toward uniform distribution using linear interpolation
 * @param row - probability row
 * @param lambda - 0..1, where 0 = no change, 1 = fully uniform
 */
export function flattenRow(row: Row, lambda: number): Row {
    const n = row.length;
    const u = 1 / n;

    const mixed = row.map((p) => (1 - lambda) * p + lambda * u);

    return normalize(mixed);
}

/**
 * Rotate a row cyclically
 * @param row - probability row
 * @param steps - integer, positive or negative
 */
export function rotateRow(row: Row, steps: number): Row {
    const n = row.length;
    const k = ((steps % n) + n) % n;

    if (k === 0) return [...row];

    return [...row.slice(n - k), ...row.slice(0, n - k)];
}

/**
 * Add minimum probability to all states (leak)
 * @param row - probability row
 * @param epsilonTotal - total mass to leak (e.g. 0.02)
 */
export function leakRow(row: Row, epsilonTotal: number): Row {
    const n = row.length;
    const leak = epsilonTotal / n;

    const leaked = row.map((p) => (1 - epsilonTotal) * p + leak);

    return normalize(leaked);
}

/**
 * Apply new off-diagonal values while locking the diagonal
 * @param row - current probability row
 * @param index - diagonal index to lock
 * @param newOffDiagonal - unnormalized values for non-diagonal elements
 */
export function applyWithLockedDiagonal(
    row: Row,
    index: number,
    newOffDiagonal: number[]
): Row {
    const d = clamp(row[index]);
    const remaining = 1 - d;

    const off = newOffDiagonal.map((v) => clamp(v));
    const offNorm = normalize(off).map((v) => v * remaining);

    const result: number[] = [];
    let k = 0;

    for (let i = 0; i < row.length; i++) {
        if (i === index) result.push(d);
        else result.push(offNorm[k++]);
    }

    return result;
}

/**
 * Adjust a single target probability in a row
 * Other probabilities are redistributed proportionally
 * @param row - current probability row
 * @param targetIndex - index of target to adjust
 * @param delta - amount to change (can be negative)
 */
export function adjustTarget(row: Row, targetIndex: number, delta: number): Row {
    const newRow = [...row];
    newRow[targetIndex] = clamp(newRow[targetIndex] + delta, 0, 1);

    return normalize(newRow);
}

/**
 * Set a specific target to an exact value
 * Other probabilities are redistributed proportionally
 * @param row - current probability row
 * @param targetIndex - index of target to set
 * @param value - new probability value (will be clamped to 0..1)
 */
export function setTarget(row: Row, targetIndex: number, value: number): Row {
    const newRow = [...row];
    newRow[targetIndex] = clamp(value, 0, 1);

    return normalize(newRow);
}
