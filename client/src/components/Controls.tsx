/**
 * Controls — right-side sidebar, always visible.
 * Start/Stop, BPM, Step counter.
 */
import type { ChainState, ClientMessage } from '../types';

interface ControlsProps {
    chain: ChainState;
    onMessage: (msg: ClientMessage) => void;
}

export default function Controls({ chain, onMessage }: ControlsProps) {
    const handleBpmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const bpm = Number(e.target.value);
        if (bpm > 0) onMessage({ type: 'set_bpm', chainId: chain.chainId, bpm });
    };

    const handleStartStop = () => {
        onMessage({ type: chain.isRunning ? 'stop' : 'start', chainId: chain.chainId });
    };

    return (
        <div className="controls">
            <button
                className={`btn-start-stop ${chain.isRunning ? 'btn-stop' : 'btn-start'}`}
                onClick={handleStartStop}
            >
                {chain.isRunning ? '⏹ Stop' : '▶ Start'}
            </button>

            <div className="control-group">
                <label className="control-label">BPM</label>
                <input
                    type="number"
                    className="control-input"
                    value={chain.bpm}
                    min={20}
                    max={300}
                    onChange={handleBpmChange}
                />
            </div>

            <div className="control-group">
                <label className="control-label">Step</label>
                <div className="step-counter">{chain.stepCount}</div>
            </div>
        </div>
    );
}
