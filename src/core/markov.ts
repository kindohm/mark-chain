/**
 * Markov Matrix for state transitions
 * Supports dynamic number of states (4-16)
 * Probabilities are normalized automatically
 */

export type StateName = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M' | 'N' | 'O' | 'P';

export const ALL_STATES: StateName[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P'];

export interface MarkovMatrixData {
    states: StateName[];
    probabilities: Record<StateName, Record<StateName, number>>;
}

export class MarkovMatrix {
    private states: StateName[];
    private probabilities: Map<StateName, Map<StateName, number>>;

    constructor(numStates: number = 4) {
        if (numStates < 2 || numStates > 16) {
            throw new Error('Number of states must be between 2 and 16');
        }

        this.states = ALL_STATES.slice(0, numStates);
        this.probabilities = new Map();

        // Initialize all probabilities to 0
        for (const fromState of this.states) {
            const row = new Map<StateName, number>();
            for (const toState of this.states) {
                row.set(toState, 0);
            }
            this.probabilities.set(fromState, row);
        }
    }

    /**
     * Set the probability of transitioning from one state to another
     * Probabilities will be normalized, so they don't need to sum to 1.0
     */
    setProbability(fromState: StateName, toState: StateName, value: number): void {
        if (!this.states.includes(fromState)) {
            throw new Error(`Invalid from state: ${fromState}`);
        }
        if (!this.states.includes(toState)) {
            throw new Error(`Invalid to state: ${toState}`);
        }
        if (value < 0) {
            throw new Error('Probability cannot be negative');
        }

        const row = this.probabilities.get(fromState)!;
        row.set(toState, value);
    }

    /**
     * Get the probability of transitioning from one state to another
     */
    getProbability(fromState: StateName, toState: StateName): number {
        if (!this.states.includes(fromState)) {
            throw new Error(`Invalid from state: ${fromState}`);
        }
        if (!this.states.includes(toState)) {
            throw new Error(`Invalid to state: ${toState}`);
        }

        return this.probabilities.get(fromState)!.get(toState)!;
    }

    /**
     * Get the next state based on current state and probabilities
     * Uses normalized probabilities
     */
    getNextState(currentState: StateName): StateName {
        if (!this.states.includes(currentState)) {
            throw new Error(`Invalid current state: ${currentState}`);
        }

        const row = this.probabilities.get(currentState)!;
        const probabilities = Array.from(row.entries());

        // Calculate sum for normalization
        const sum = probabilities.reduce((acc, [_, prob]) => acc + prob, 0);

        // If all probabilities are 0, stay in current state
        if (sum === 0) {
            return currentState;
        }

        // Normalize and create cumulative distribution
        let cumulative = 0;
        const cumulativeProbs: [StateName, number][] = probabilities.map(([state, prob]) => {
            cumulative += prob / sum;
            return [state, cumulative];
        });

        // Random selection
        const random = Math.random();
        for (const [state, cumulativeProb] of cumulativeProbs) {
            if (random <= cumulativeProb) {
                return state;
            }
        }

        // Fallback (should never reach here)
        return currentState;
    }

    /**
     * Get all states
     */
    getStates(): StateName[] {
        return [...this.states];
    }

    /**
     * Export matrix data for serialization
     */
    toJSON(): MarkovMatrixData {
        const probabilities: Record<StateName, Record<StateName, number>> = {} as any;

        for (const fromState of this.states) {
            probabilities[fromState] = {} as any;
            const row = this.probabilities.get(fromState)!;
            for (const toState of this.states) {
                probabilities[fromState][toState] = row.get(toState)!;
            }
        }

        return {
            states: this.states,
            probabilities,
        };
    }

    /**
     * Import matrix data from serialization
     */
    static fromJSON(data: MarkovMatrixData): MarkovMatrix {
        const matrix = new MarkovMatrix(data.states.length);

        for (const fromState of data.states) {
            for (const toState of data.states) {
                matrix.setProbability(fromState, toState, data.probabilities[fromState][toState]);
            }
        }

        return matrix;
    }
}
