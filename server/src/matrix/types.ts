/**
 * Core types for the Markov chain matrix
 */

/** A single row of probability values */
export type Row = number[];

/** 2D matrix: matrix[i][j] = probability of transitioning from state i to state j */
export type Matrix = Row[];
