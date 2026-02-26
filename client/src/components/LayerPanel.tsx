/**
 * LayerPanel — UI for a Layer voice (Layer 1 or Layer 2)
 *
 * Controls: On/Off toggle, Division (1–256), Device, Channel,
 *           Velocity knob (ArcDial 0.0–1.0),
 *           Duration % knob (ArcDial 0.01–1.0)
 */
import ArcDial from './ArcDial';
import type { ClientMessage, LayerState } from '../types';

interface LayerPanelProps {
    layer: LayerState;
    onMessage: (msg: ClientMessage) => void;
}

export default function LayerPanel({ layer, onMessage }: LayerPanelProps) {
    const { layerId } = layer;
    const send = (msg: ClientMessage) => onMessage(msg);

    const handleToggle = () =>
        send({ type: 'set_layer_enabled', layerId, isEnabled: !layer.isEnabled });

    const handleDivision = (e: React.ChangeEvent<HTMLInputElement>) => {
        const n = Number(e.target.value);
        if (n >= 1 && n <= 256) send({ type: 'set_layer_division', layerId, division: n });
    };

    const handleDevice = (e: React.ChangeEvent<HTMLSelectElement>) =>
        send({ type: 'set_layer_midi', layerId, midiDevice: e.target.value });

    const handleChannel = (e: React.ChangeEvent<HTMLInputElement>) => {
        const n = Number(e.target.value);
        if (n >= 1 && n <= 16) send({ type: 'set_layer_midi', layerId, channel: n });
    };

    const handleVelocity = (v: number) =>
        send({ type: 'set_layer_velocity', layerId, velocity: v });

    const handleDurationPct = (v: number) =>
        send({ type: 'set_layer_duration_pct', layerId, durationPct: Math.max(0.01, v) });

    // Derived display values
    // Interval in seconds at current BPM (shown for user reference)
    // durationPct as pct string
    const durationPctDisplay = `${Math.round(layer.durationPct * 100)}%`;
    const velocityDisplay = layer.velocity.toFixed(2);

    return (
        <div className="anchor-panel">
            {/* Row 1: toggle + division + device + channel */}
            <div className="anchor-row">
                <div className="anchor-field">
                    <label className="control-label">On / Off</label>
                    <button
                        className={`anchor-toggle ${layer.isEnabled ? 'anchor-toggle--on' : 'anchor-toggle--off'}`}
                        onClick={handleToggle}
                    >
                        {layer.isEnabled ? '● On' : '○ Off'}
                    </button>
                </div>

                <div className="anchor-field">
                    <label className="control-label">Division</label>
                    <input
                        type="number"
                        className="control-input"
                        value={layer.division}
                        min={1}
                        max={256}
                        onChange={handleDivision}
                    />
                </div>

                <div className="anchor-field anchor-field--device">
                    <label className="control-label">Device</label>
                    <select className="row-midi-select anchor-select" value={layer.midiDevice} onChange={handleDevice}>
                        {layer.midiDevices.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                </div>

                <div className="anchor-field">
                    <label className="control-label">Channel</label>
                    <input
                        type="number"
                        className="control-input"
                        value={layer.channel}
                        min={1}
                        max={16}
                        onChange={handleChannel}
                    />
                </div>
            </div>

            {/* Row 2: Velocity knob + Duration knob */}
            <div className="anchor-row">
                <div className="layer-knob-group">
                    <label className="control-label">Velocity</label>
                    <ArcDial value={layer.velocity} size={64} onChange={handleVelocity} />
                    <div className="layer-knob-value">{velocityDisplay}</div>
                </div>

                <div className="layer-knob-group">
                    <label className="control-label">Duration</label>
                    <ArcDial value={layer.durationPct} size={64} onChange={handleDurationPct} />
                    <div className="layer-knob-value">{durationPctDisplay}</div>
                </div>
            </div>
        </div>
    );
}
