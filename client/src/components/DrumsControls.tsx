/**
 * DrumsControls — tab-specific controls for the Drums tab.
 * Current state indicator and States (numStates) input.
 */
import type { ChainState, ClientMessage, MatrixShiftAlgorithm } from '../types';

const STATE_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

interface DrumsControlsProps {
    chain: ChainState;
    onMessage: (msg: ClientMessage) => void;
}

export default function DrumsControls({ chain, onMessage }: DrumsControlsProps) {
    const handleShift = (algorithm: MatrixShiftAlgorithm) => {
        onMessage({ type: 'shift_matrix', chainId: chain.chainId, algorithm });
    };

    const handleEnabledToggle = () => {
        onMessage({ type: 'set_chain_enabled', chainId: chain.chainId, isEnabled: !chain.isEnabled });
    };

    const handleNumStatesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const n = Number(e.target.value);
        if (n >= 1 && n <= 8) onMessage({ type: 'set_num_states', chainId: chain.chainId, numStates: n });
    };

    const isRest = chain.stateMidi?.[chain.currentState]?.deviceName === 'rest';
    const currentStateLabel = STATE_LABELS[chain.currentState] ?? '?';

    return (
        <div className="controls drums-controls">
            <div className="drums-controls-row">
                <div className="control-group">
                    <label className="control-label">Drums</label>
                    <button
                        type="button"
                        className={`anchor-toggle drums-toggle-btn ${chain.isEnabled ? 'anchor-toggle--on' : 'anchor-toggle--off'}`}
                        onClick={handleEnabledToggle}
                    >
                        {chain.isEnabled ? 'On' : 'Off'}
                    </button>
                </div>

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

                <div className="control-group drums-shift-group">
                    <label className="control-label">Shift</label>
                    <div className="drums-shift-buttons">
                        <button type="button" className="drums-shift-btn" onClick={() => handleShift('up')}>Up</button>
                        <button type="button" className="drums-shift-btn" onClick={() => handleShift('down')}>Down</button>
                        <button type="button" className="drums-shift-btn" onClick={() => handleShift('left')}>Left</button>
                        <button type="button" className="drums-shift-btn" onClick={() => handleShift('right')}>Right</button>
                        <button type="button" className="drums-shift-btn" onClick={() => handleShift('snake')}>Snake</button>
                        <button type="button" className="drums-shift-btn" onClick={() => handleShift('reverse_snake')}>Rev Snake</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
