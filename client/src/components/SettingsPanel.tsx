import type { AudioInputDevice } from "../hooks/useAudioInputFft";

interface SettingsPanelProps {
  devices: AudioInputDevice[];
  selectedDeviceId: string;
  selectedChannel: number;
  isRunning: boolean;
  statusText: string;
  isFftEnabled: boolean;
  onDeviceChange: (deviceId: string) => void;
  onChannelChange: (channel: number) => void;
  onToggleEnabled: (enabled: boolean) => void;
  onRefreshDevices: () => void;
  onStart: () => void;
  onStop: () => void;
}

export default function SettingsPanel({
  devices,
  selectedDeviceId,
  selectedChannel,
  isRunning,
  statusText,
  isFftEnabled,
  onDeviceChange,
  onChannelChange,
  onToggleEnabled,
  onRefreshDevices,
  onStart,
  onStop,
}: SettingsPanelProps) {
  return (
    <section className="settings-panel">
      <h2 className="settings-panel__title">Audio Input FFT</h2>
      <p className="settings-panel__desc">
        Select an input source and channel for the header spectrum view.
      </p>

      <div className="settings-panel__row">
        <label className="anchor-field">
          <span className="control-label">FFT Visualization</span>
          <button
            type="button"
            className={`anchor-toggle ${isFftEnabled ? "anchor-toggle--on" : "anchor-toggle--off"}`}
            onClick={() => onToggleEnabled(!isFftEnabled)}
          >
            {isFftEnabled ? "Enabled" : "Disabled"}
          </button>
        </label>
      </div>

      <div className="settings-panel__row">
        <label className="anchor-field anchor-field--device">
          <span className="control-label">Input Device</span>
          <select
            className="row-midi-select anchor-select"
            value={selectedDeviceId}
            onChange={(event) => onDeviceChange(event.target.value)}
            disabled={!isFftEnabled}
          >
            <option value="default">System default</option>
            {devices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.label}
              </option>
            ))}
          </select>
        </label>

        <label className="anchor-field">
          <span className="control-label">Input Channel</span>
          <input
            className="row-midi-channel"
            type="number"
            min={1}
            max={16}
            value={selectedChannel}
            onChange={(event) => onChannelChange(Number(event.target.value))}
            disabled={!isFftEnabled}
          />
        </label>
      </div>

      <div className="settings-panel__actions">
        <button
          className="settings-btn"
          type="button"
          onClick={onRefreshDevices}
          disabled={!isFftEnabled}
        >
          Refresh Devices
        </button>
        {!isRunning ? (
          <button
            className="settings-btn settings-btn--primary"
            type="button"
            onClick={onStart}
            disabled={!isFftEnabled}
          >
            Start Monitor
          </button>
        ) : (
          <button className="settings-btn settings-btn--primary" type="button" onClick={onStop}>
            Stop Monitor
          </button>
        )}
      </div>

      <div className="settings-panel__status">Status: {statusText}</div>
    </section>
  );
}
