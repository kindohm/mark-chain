import type { Matrix } from './types.js';

export type MatrixShiftAlgorithm =
    | 'up'
    | 'down'
    | 'left'
    | 'right'
    | 'snake'
    | 'reverse_snake';

function rotate<T>(items: T[], amount: number): T[] {
    const len = items.length;
    if (len === 0) return [];
    const offset = ((amount % len) + len) % len;
    if (offset === 0) return [...items];
    return [...items.slice(len - offset), ...items.slice(0, len - offset)];
}

export function shiftMatrix(matrix: Matrix, algorithm: MatrixShiftAlgorithm): Matrix {
    if (matrix.length === 0) return [];

    switch (algorithm) {
        case 'down':
            return rotate(matrix.map((row) => [...row]), 1);
        case 'up':
            return rotate(matrix.map((row) => [...row]), -1);
        case 'right':
            return matrix.map((row) => rotate(row, 1));
        case 'left':
            return matrix.map((row) => rotate(row, -1));
        case 'snake': {
            const widths = matrix.map((row) => row.length);
            const flat = rotate(matrix.flat(), 1);
            let cursor = 0;
            return widths.map((width) => {
                const nextRow = flat.slice(cursor, cursor + width);
                cursor += width;
                return nextRow;
            });
        }
        case 'reverse_snake': {
            const widths = matrix.map((row) => row.length);
            const flat = rotate(matrix.flat(), -1);
            let cursor = 0;
            return widths.map((width) => {
                const nextRow = flat.slice(cursor, cursor + width);
                cursor += width;
                return nextRow;
            });
        }
    }
}

