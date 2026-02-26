import { describe, expect, it } from 'vitest';
import { shiftMatrix } from './shift.js';
import type { Matrix } from './types.js';

const base: Matrix = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
];

describe('shiftMatrix', () => {
    it('shifts rows down with wraparound', () => {
        expect(shiftMatrix(base, 'down')).toEqual([
            [7, 8, 9],
            [1, 2, 3],
            [4, 5, 6],
        ]);
    });

    it('shifts rows up with wraparound', () => {
        expect(shiftMatrix(base, 'up')).toEqual([
            [4, 5, 6],
            [7, 8, 9],
            [1, 2, 3],
        ]);
    });

    it('shifts each row right with wraparound', () => {
        expect(shiftMatrix(base, 'right')).toEqual([
            [3, 1, 2],
            [6, 4, 5],
            [9, 7, 8],
        ]);
    });

    it('shifts each row left with wraparound', () => {
        expect(shiftMatrix(base, 'left')).toEqual([
            [2, 3, 1],
            [5, 6, 4],
            [8, 9, 7],
        ]);
    });

    it('snake-shifts right across row boundaries', () => {
        expect(shiftMatrix(base, 'snake')).toEqual([
            [9, 1, 2],
            [3, 4, 5],
            [6, 7, 8],
        ]);
    });

    it('reverse-snake-shifts left across row boundaries', () => {
        expect(shiftMatrix(base, 'reverse_snake')).toEqual([
            [2, 3, 4],
            [5, 6, 7],
            [8, 9, 1],
        ]);
    });

    it('does not mutate the original matrix', () => {
        const copy = base.map((row) => [...row]);
        void shiftMatrix(copy, 'snake');
        expect(copy).toEqual(base);
    });
});

