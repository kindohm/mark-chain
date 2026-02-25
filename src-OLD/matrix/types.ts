/**
 * Core types for the Markov chain matrix system
 */

/**
 * A single row of probabilities that must sum to 1.0
 */
export type Row = number[];

/**
 * A 2D matrix where each row is a probability distribution
 * Matrix[i][j] = probability of transitioning from state i to state j
 */
export type Matrix = Row[];

/**
 * Configuration for the matrix system
 */
export interface MatrixConfig {
    /** Number of states in the Markov chain */
    numStates: number;
}

/**
 * Complete state of the matrix system
 */
export interface MatrixState {
    /** The transition probability matrix */
    matrix: Matrix;
    /** Currently selected state index for editing */
    selectedStateIndex: number;
    /** Whether the diagonal is locked for the current state */
    lockDiagonal: boolean;
    /** Number of states */
    numStates: number;
}

/**
 * Row operation types
 */
export type RowOperationType =
    | 'sharpen'
    | 'flatten'
    | 'rotate'
    | 'leak'
    | 'setTarget'
    | 'reset'
    | 'randomize'
    | 'randomizeAll';

/**
 * Base interface for row operations
 */
export interface RowOperation {
    type: RowOperationType;
}

/**
 * Sharpen operation - concentrates probability toward max
 */
export interface SharpenOperation extends RowOperation {
    type: 'sharpen';
    /** Alpha value > 1 sharpens, < 1 flattens */
    alpha: number;
}

/**
 * Flatten operation - moves toward uniform distribution
 */
export interface FlattenOperation extends RowOperation {
    type: 'flatten';
    /** Lambda 0..1, where 1 = fully uniform */
    lambda: number;
}

/**
 * Rotate operation - cyclic shift of probabilities
 */
export interface RotateOperation extends RowOperation {
    type: 'rotate';
    /** Number of steps to rotate (positive or negative) */
    steps: number;
}

/**
 * Leak operation - ensure minimum probability for all states
 */
export interface LeakOperation extends RowOperation {
    type: 'leak';
    /** Total mass to leak (e.g., 0.02) */
    epsilonTotal: number;
}

/**
 * Set target operation - adjust a specific target probability
 */
export interface SetTargetOperation extends RowOperation {
    type: 'setTarget';
    /** Target state index */
    targetIndex: number;
    /** Delta to apply to probability */
    delta: number;
}

/**
 * Reset operation - reset row to uniform distribution
 */
export interface ResetOperation extends RowOperation {
    type: 'reset';
}

/**
 * Randomize operation - generate random probabilities
 */
export interface RandomizeOperation extends RowOperation {
    type: 'randomize';
}

/**
 * Randomize all operation - randomize all rows in the matrix
 */
export interface RandomizeAllOperation extends RowOperation {
    type: 'randomizeAll';
}

/**
 * Union type of all row operations
 */
export type AnyRowOperation =
    | SharpenOperation
    | FlattenOperation
    | RotateOperation
    | LeakOperation
    | SetTargetOperation
    | ResetOperation
    | RandomizeOperation
    | RandomizeAllOperation;
