import HeadlessSlider from './HeadlessSlider';
import type { ClientMessage, MixerCcLevels, MixerTarget } from '../types';

interface MixerPanelProps {
    mixer: MixerCcLevels;
    onMessage: (msg: ClientMessage) => void;
}

const MIXER_ROWS: Array<{ key: MixerTarget; label: string }> = [
    { key: 'drums', label: 'Drums' },
    { key: 'stab1', label: 'Stab 1' },
    { key: 'stab2', label: 'Stab 2' },
    { key: 'layer1', label: 'Layer 1' },
    { key: 'layer2', label: 'Layer 2' },
];

export default function MixerPanel({ mixer, onMessage }: MixerPanelProps) {
    const sendCcLevel = (target: MixerTarget, value: number) => {
        onMessage({ type: 'set_mixer_cc_level', target, value });
    };

    return (
        <div className="mixer-panel">
            <div className="mixer-grid">
                {MIXER_ROWS.map(({ key, label }) => (
                    <div key={key} className="mixer-strip">
                        <div className="mixer-strip__label">{label}</div>
                        <div className="mixer-strip__slider">
                            <HeadlessSlider
                                ariaLabel={`${label} mixer CC level ${mixer[key].toFixed(2)}`}
                                value={mixer[key]}
                                min={0}
                                max={1}
                                step={0.01}
                                onChange={(value) => sendCcLevel(key, value)}
                            />
                        </div>
                        <div className="mixer-strip__value">{mixer[key].toFixed(2)}</div>
                    </div>
                ))}
            </div>
            <div className="anchor-step-info">
                Sends mixer CC on IAC Driver Bus 5 when sliders move
            </div>
        </div>
    );
}
