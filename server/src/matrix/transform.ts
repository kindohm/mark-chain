import { normalizeMatrix } from './normalize.js';
import type { Matrix } from './types.js';

export type MatrixTransformAlgorithm = 'reciprocal_loops' | 'cycle_inject' | 'settle';
export type MatrixTransformPolarity = 'negative' | 'positive';
export type CycleLength = 2 | 3 | 4;

export interface MatrixTransformParams {
    amount: number;
    cycleLength?: CycleLength;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

function cloneMatrix(matrix: Matrix): Matrix {
    return matrix.map((row) => [...row]);
}

function multiplySquareMatrix(a: Matrix, b: Matrix): Matrix {
    const n = a.length;
    const out: Matrix = Array.from({ length: n }, () => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
        for (let k = 0; k < n; k++) {
            const aik = a[i][k] ?? 0;
            if (aik === 0) continue;
            for (let j = 0; j < n; j++) {
                out[i][j] += aik * (b[k][j] ?? 0);
            }
        }
    }

    return out;
}

function uniformMatrix(size: number): Matrix {
    if (size <= 0) return [];
    const value = 1 / size;
    return Array.from({ length: size }, () => Array(size).fill(value));
}

function makeCycleTemplate(size: number, cycleLength: CycleLength): Matrix {
    const template: Matrix = Array.from({ length: size }, () => Array(size).fill(0));

    for (let groupStart = 0; groupStart < size; groupStart += cycleLength) {
        const groupSize = Math.min(cycleLength, size - groupStart);

        for (let offset = 0; offset < groupSize; offset++) {
            const from = groupStart + offset;
            const to = groupStart + ((offset + 1) % groupSize);
            template[from][to] = 1;
        }
    }

    return template;
}

function applyReciprocalLoops(base: Matrix, amount: number, polarity: MatrixTransformPolarity): Matrix {
    const size = base.length;
    const next: Matrix = Array.from({ length: size }, () => Array(size).fill(0));

    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            const value = base[i][j] ?? 0;
            const reciprocal = value * (base[j][i] ?? 0);
            const delta = amount * reciprocal;
            next[i][j] = polarity === 'positive' ? value + delta : Math.max(0, value - delta);
        }
    }

    return normalizeMatrix(next);
}

function applyCycleInject(base: Matrix, amount: number, polarity: MatrixTransformPolarity, cycleLength: CycleLength): Matrix {
    const size = base.length;
    const template = makeCycleTemplate(size, cycleLength);
    const next: Matrix = Array.from({ length: size }, () => Array(size).fill(0));

    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            const value = base[i][j] ?? 0;
            if (polarity === 'positive') {
                next[i][j] = (1 - amount) * value + amount * (template[i][j] ?? 0);
            } else {
                const suppression = amount * (template[i][j] ?? 0);
                next[i][j] = value * (1 - suppression);
            }
        }
    }

    return normalizeMatrix(next);
}

function applySettle(base: Matrix, amount: number, polarity: MatrixTransformPolarity): Matrix {
    const squared = multiplySquareMatrix(base, base);
    const size = base.length;
    const settleTarget = normalizeMatrix(
        squared.map((row, i) => row.map((value, j) => value + (i === j ? 1 : 0)))
    );
    const blendTarget = polarity === 'positive' ? settleTarget : uniformMatrix(size);
    const next: Matrix = Array.from({ length: size }, () => Array(size).fill(0));

    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            next[i][j] = (1 - amount) * (base[i][j] ?? 0) + amount * (blendTarget[i][j] ?? 0);
        }
    }

    return normalizeMatrix(next);
}

export function applyMatrixTransform(
    matrix: Matrix,
    algorithm: MatrixTransformAlgorithm,
    polarity: MatrixTransformPolarity,
    params: MatrixTransformParams
): Matrix {
    if (matrix.length === 0) return [];

    const amount = clamp01(params.amount);
    if (amount === 0) return cloneMatrix(matrix);

    const normalizedBase = normalizeMatrix(cloneMatrix(matrix));

    switch (algorithm) {
        case 'reciprocal_loops':
            return applyReciprocalLoops(normalizedBase, amount, polarity);
        case 'cycle_inject':
            return applyCycleInject(normalizedBase, amount, polarity, params.cycleLength ?? 3);
        case 'settle':
            return applySettle(normalizedBase, amount, polarity);
    }
}
