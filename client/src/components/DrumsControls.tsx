/**
 * DrumsControls — tab-specific controls for the Drums tab.
 * Current state indicator and States (numStates) input.
 */
import type { ChainState, ClientMessage } from '../types';

const STATE_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

interface DrumsControlsProps {
    chain: ChainState;
    onMessage: (msg: ClientMessage) => void;
}

export default function DrumsControls({ chain, onMessage }: DrumsControlsProps) {
    const handleNumStatesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const n = Number(e.target.value);
        if (n >= 1 && n <= 8) onMessage({ type: 'set_num_states', chainId: chain.chainId, numStates: n });
    };

    const isRest = chain.stateMidi?.[chain.currentState]?.deviceName === 'rest';
    const currentStateLabel = STATE_LABELS[chain.currentState] ?? '?';

    return (
        <div className="controls">
            <div className="control-group">
                <label className="control-label">States</label>
                <input
                    type="number"
                    className="control-input"
                    value={chain.numStates}
                    min={1}
                    max={8}
                    onChange={handleNumStatesChange}
                />
            </div>

            <div className="control-group">
                <label className="control-label">State</label>
                <div className={`state-indicator ${isRest ? 'state-indicator--rest' : ''}`}>
                    {isRest ? 'REST' : currentStateLabel}
                </div>
            </div>
        </div>
    );
}
