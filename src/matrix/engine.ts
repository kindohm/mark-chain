/**
 * Matrix engine - manages matrix state and applies operations
 */

import type { Matrix, MatrixState, AnyRowOperation } from './types.js';
import {
    sharpenRow,
    flattenRow,
    rotateRow,
    leakRow,
    adjustTarget,
    applyWithLockedDiagonal,
} from './operations.js';
import { createUniformRow, createRandomRow, createSharpenedRowWithMaxLast } from './utils.js';

/**
 * Create initial matrix state with uniform distributions
 */
export function createInitialMatrix(numStates: number): MatrixState {
    const matrix: Matrix = [];
    for (let i = 0; i < numStates; i++) {
        matrix.push(createUniformRow(numStates));
    }

    return {
        matrix,
        selectedStateIndex: 0,
        lockDiagonal: false,
        numStates,
    };
}

/**
 * Apply a row operation to the currently selected state
 */
export function applyRowOperation(
    state: MatrixState,
    operation: AnyRowOperation
): MatrixState {
    const { matrix, selectedStateIndex, lockDiagonal } = state;
    const currentRow = matrix[selectedStateIndex];
    let newRow: number[];

    // For operations that should respect diagonal lock
    const shouldLockDiagonal = lockDiagonal &&
        (operation.type === 'sharpen' ||
            operation.type === 'flatten' ||
            operation.type === 'rotate' ||
            operation.type === 'leak');

    if (shouldLockDiagonal) {
        // Extract off-diagonal elements (all except self-transition)
        const offDiagonal: number[] = [];
        for (let i = 0; i < currentRow.length; i++) {
            if (i !== selectedStateIndex) {
                offDiagonal.push(currentRow[i]);
            }
        }

        // Apply operation to off-diagonal elements only
        let transformedOffDiagonal: number[];
        switch (operation.type) {
            case 'sharpen':
                transformedOffDiagonal = sharpenRow(offDiagonal, operation.alpha);
                break;
            case 'flatten':
                transformedOffDiagonal = flattenRow(offDiagonal, operation.lambda);
                break;
            case 'rotate':
                transformedOffDiagonal = rotateRow(offDiagonal, operation.steps);
                break;
            case 'leak':
                transformedOffDiagonal = leakRow(offDiagonal, operation.epsilonTotal);
                break;
            default:
                transformedOffDiagonal = offDiagonal;
        }

        // Reconstruct row with locked diagonal
        newRow = applyWithLockedDiagonal(currentRow, selectedStateIndex, transformedOffDiagonal);
    } else {
        // Normal operation without diagonal lock
        switch (operation.type) {
            case 'sharpen':
                newRow = sharpenRow(currentRow, operation.alpha);
                break;

            case 'flatten':
                newRow = flattenRow(currentRow, operation.lambda);
                break;

            case 'rotate':
                newRow = rotateRow(currentRow, operation.steps);
                break;

            case 'leak':
                newRow = leakRow(currentRow, operation.epsilonTotal);
                break;

            case 'setTarget':
                newRow = adjustTarget(currentRow, operation.targetIndex, operation.delta);
                break;

            case 'reset':
                newRow = createUniformRow(state.numStates);
                break;

            case 'randomize':
                newRow = createRandomRow(state.numStates);
                break;

            case 'randomizeAll':
                // Randomize all rows in the matrix with sharpening
                // Ensure the last state (rest state) always has the highest probability
                const randomMatrix = state.matrix.map(() => {
                    return createSharpenedRowWithMaxLast(state.numStates, 4.0);
                });
                return {
                    ...state,
                    matrix: randomMatrix,
                };

            default:
                // TypeScript should ensure this never happens
                return state;
        }
    }

    // Create new matrix with updated row
    const newMatrix = matrix.map((row, i) =>
        i === selectedStateIndex ? newRow : row
    );

    return {
        ...state,
        matrix: newMatrix,
    };
}

/**
 * Select a different state for editing
 */
export function selectState(
    state: MatrixState,
    stateIndex: number
): MatrixState {
    if (stateIndex < 0 || stateIndex >= state.numStates) {
        return state;
    }

    return {
        ...state,
        selectedStateIndex: stateIndex,
    };
}

/**
 * Toggle diagonal lock
 */
export function toggleDiagonalLock(state: MatrixState): MatrixState {
    return {
        ...state,
        lockDiagonal: !state.lockDiagonal,
    };
}

/**
 * Set a specific row in the matrix
 */
export function setRow(
    state: MatrixState,
    rowIndex: number,
    row: number[]
): MatrixState {
    if (rowIndex < 0 || rowIndex >= state.numStates) {
        return state;
    }

    const newMatrix = state.matrix.map((r, i) => (i === rowIndex ? row : r));

    return {
        ...state,
        matrix: newMatrix,
    };
}
