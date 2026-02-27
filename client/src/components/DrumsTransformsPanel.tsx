import { useEffect, useState } from 'react';
import type {
    ChainState,
    ClientMessage,
    CycleLength,
    MatrixTransformAlgorithm,
    MatrixTransformPolarity,
} from '../types';

interface DrumsTransformsPanelProps {
    chain: ChainState;
    onMessage: (msg: ClientMessage) => void;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export default function DrumsTransformsPanel({ chain, onMessage }: DrumsTransformsPanelProps) {
    const [reciprocalAmount, setReciprocalAmount] = useState(chain.matrixTransforms.reciprocalLoops.amount);
    const [cycleInjectAmount, setCycleInjectAmount] = useState(chain.matrixTransforms.cycleInject.amount);
    const [cycleLength, setCycleLength] = useState<CycleLength>(chain.matrixTransforms.cycleInject.cycleLength);
    const [settleAmount, setSettleAmount] = useState(chain.matrixTransforms.settle.amount);

    useEffect(() => {
        setReciprocalAmount(chain.matrixTransforms.reciprocalLoops.amount);
        setCycleInjectAmount(chain.matrixTransforms.cycleInject.amount);
        setCycleLength(chain.matrixTransforms.cycleInject.cycleLength);
        setSettleAmount(chain.matrixTransforms.settle.amount);
    }, [chain.matrixTransforms]);

    const handleTransform = (algorithm: MatrixTransformAlgorithm, polarity: MatrixTransformPolarity) => {
        const amount = algorithm === 'reciprocal_loops'
            ? reciprocalAmount
            : algorithm === 'cycle_inject'
                ? cycleInjectAmount
                : settleAmount;

        onMessage({
            type: 'apply_matrix_transform',
            chainId: chain.chainId,
            algorithm,
            polarity,
            amount,
            ...(algorithm === 'cycle_inject' ? { cycleLength } : {}),
        });
    };

    return (
        <div className="controls drums-transforms-panel">
            <div className="control-label">Transforms</div>
            <div className="drums-transforms-stack">
                <div className="drums-transform-card">
                    <div className="drums-transform-header">
                        <span className="drums-transform-name">Reciprocal Loops</span>
                        <div className="drums-transform-buttons">
                            <button type="button" className="drums-shift-btn" onClick={() => handleTransform('reciprocal_loops', 'negative')}>-</button>
                            <button type="button" className="drums-shift-btn" onClick={() => handleTransform('reciprocal_loops', 'positive')}>+</button>
                        </div>
                    </div>
                    <div className="drums-transform-slider-row">
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={reciprocalAmount}
                            onChange={(event) => setReciprocalAmount(clamp01(Number(event.target.value)))}
                        />
                        <span className="drums-transform-amount">{reciprocalAmount.toFixed(2)}</span>
                    </div>
                </div>

                <div className="drums-transform-card">
                    <div className="drums-transform-header">
                        <span className="drums-transform-name">Cycle Inject</span>
                        <div className="drums-transform-buttons">
                            <button type="button" className="drums-shift-btn" onClick={() => handleTransform('cycle_inject', 'negative')}>-</button>
                            <button type="button" className="drums-shift-btn" onClick={() => handleTransform('cycle_inject', 'positive')}>+</button>
                        </div>
                    </div>
                    <div className="drums-transform-slider-row">
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={cycleInjectAmount}
                            onChange={(event) => setCycleInjectAmount(clamp01(Number(event.target.value)))}
                        />
                        <span className="drums-transform-amount">{cycleInjectAmount.toFixed(2)}</span>
                    </div>
                    <div className="drums-transform-cycle-row">
                        <label className="control-label" htmlFor={`cycle-length-${chain.chainId}`}>Cycle</label>
                        <select
                            id={`cycle-length-${chain.chainId}`}
                            className="control-input"
                            value={cycleLength}
                            onChange={(event) => setCycleLength(Number(event.target.value) as CycleLength)}
                        >
                            <option value={2}>2</option>
                            <option value={3}>3</option>
                            <option value={4}>4</option>
                        </select>
                    </div>
                </div>

                <div className="drums-transform-card">
                    <div className="drums-transform-header">
                        <span className="drums-transform-name">Settle</span>
                        <div className="drums-transform-buttons">
                            <button type="button" className="drums-shift-btn" onClick={() => handleTransform('settle', 'negative')}>-</button>
                            <button type="button" className="drums-shift-btn" onClick={() => handleTransform('settle', 'positive')}>+</button>
                        </div>
                    </div>
                    <div className="drums-transform-slider-row">
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={settleAmount}
                            onChange={(event) => setSettleAmount(clamp01(Number(event.target.value)))}
                        />
                        <span className="drums-transform-amount">{settleAmount.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
