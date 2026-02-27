import type { ChainState, ClientMessage, MatrixShiftAlgorithm } from '../types';

interface DrumsShiftPanelProps {
    chain: ChainState;
    onMessage: (msg: ClientMessage) => void;
}

export default function DrumsShiftPanel({ chain, onMessage }: DrumsShiftPanelProps) {
    const handleShift = (algorithm: MatrixShiftAlgorithm) => {
        onMessage({ type: 'shift_matrix', chainId: chain.chainId, algorithm });
    };

    return (
        <div className="controls drums-shift-panel">
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
    );
}
