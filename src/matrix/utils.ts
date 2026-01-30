/**
 * Core utility functions for matrix operations
 * These implement the exact algorithms from .agent/tui.md
 */

import type { Row } from './types.js';

/** Floating point tolerance for comparisons */
export const EPS = 1e-12;

/**
 * Normalize a row so it sums to 1.0
 * If the row sum is too small, returns uniform distribution
 */
export function normalize(row: Row): Row {
    const sum = row.reduce((a, b) => a + b, 0);
    if (sum < EPS) {
        const v = 1 / row.length;
        return row.map(() => v);
    }
    return row.map((v) => v / sum);
}

/**
 * Clamp a value between min and max
 */
export function clamp(v: number, min = 0, max = 1): number {
    return Math.max(min, Math.min(max, v));
}

/**
 * Create a uniform distribution row
 */
export function createUniformRow(length: number): Row {
    const value = 1 / length;
    return Array(length).fill(value);
}

/**
 * Create a random row with normalized probabilities
 */
export function createRandomRow(length: number): Row {
    const random = Array.from({ length }, () => Math.random());
    return normalize(random);
}

/**
 * Create a random row that favors the last state
 * The last state gets a random value between 0.85 and 1.0
 * Other states get random values between 0 and 1.0
 */
export function createRandomRowWithFavoredLast(length: number): Row {
    const random = Array.from({ length }, (_, i) => {
        if (i === length - 1) {
            // Last state: random between 0.85 and 1.0 for very strong convergence
            return 0.85 + Math.random() * 0.15;
        }
        return Math.random();
    });
    return normalize(random);
}

/**
 * Create a sharpened random row where the last state is guaranteed to have the highest probability
 * @param length - number of states
 * @param sharpenAlpha - sharpening factor to apply
 */
export function createSharpenedRowWithMaxLast(length: number, sharpenAlpha: number): Row {
    // First create a random row
    const random = Array.from({ length }, () => Math.random());
    const normalized = normalize(random);

    // Apply sharpening
    const sharpened = normalized.map((p) => Math.pow(clamp(p), sharpenAlpha));
    const sharpenedNormalized = normalize(sharpened);

    // Find the current maximum value (excluding the last state)
    let maxValue = 0;
    for (let i = 0; i < length - 1; i++) {
        if (sharpenedNormalized[i] > maxValue) {
            maxValue = sharpenedNormalized[i];
        }
    }

    // Set the last state to be significantly higher than the max
    // Use a value between maxValue + 0.2 and maxValue + 0.4 (before normalization)
    const result = [...sharpenedNormalized];
    result[length - 1] = maxValue + 0.2 + Math.random() * 0.2;

    return normalize(result);
}

/**
 * Calculate Shannon entropy of a probability distribution
 * Returns value in bits
 */
export function calculateEntropy(row: Row): number {
    let entropy = 0;
    for (const p of row) {
        if (p > EPS) {
            entropy -= p * Math.log2(p);
        }
    }
    return entropy;
}

/**
 * Find the index and value of the maximum probability in a row
 */
export function findMaxProbability(row: Row): { index: number; value: number } {
    let maxIndex = 0;
    let maxValue = row[0];
    for (let i = 1; i < row.length; i++) {
        if (row[i] > maxValue) {
            maxValue = row[i];
            maxIndex = i;
        }
    }
    return { index: maxIndex, value: maxValue };
}
