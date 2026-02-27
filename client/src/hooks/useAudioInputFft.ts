import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface AudioInputDevice {
  id: string;
  label: string;
}

const DEVICE_STORAGE_KEY = "mark-chain-audio-input-device";
const CHANNEL_STORAGE_KEY = "mark-chain-audio-input-channel";
const DEFAULT_DEVICE_ID = "default";
const MAX_SPLIT_CHANNELS = 16;

const clampChannel = (value: number) => {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(MAX_SPLIT_CHANNELS, Math.round(value)));
};

const getStoredChannel = () => {
  if (typeof window === "undefined") return 1;
  const raw = Number(window.localStorage.getItem(CHANNEL_STORAGE_KEY));
  return clampChannel(raw);
};

const getStoredDevice = () => {
  if (typeof window === "undefined") return DEFAULT_DEVICE_ID;
  return window.localStorage.getItem(DEVICE_STORAGE_KEY) ?? DEFAULT_DEVICE_ID;
};

export function useAudioInputFft(enabled: boolean) {
  const [devices, setDevices] = useState<AudioInputDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(getStoredDevice);
  const [selectedChannel, setSelectedChannel] = useState<number>(getStoredChannel);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [detectedChannelCount, setDetectedChannelCount] = useState<number | null>(
    null,
  );
  const [sourceChannelCount, setSourceChannelCount] = useState<number | null>(null);
  const [effectiveChannel, setEffectiveChannel] = useState<number | null>(null);
  const [usingMixedFallback, setUsingMixedFallback] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const splitterRef = useRef<ChannelSplitterNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const refreshDevices = useCallback(async () => {
    if (!enabled) return;
    if (!("mediaDevices" in navigator)) return;
    const all = await navigator.mediaDevices.enumerateDevices();
    const inputs = all
      .filter((device) => device.kind === "audioinput")
      .map((device, index) => ({
        id: device.deviceId,
        label: device.label || `Input ${index + 1}`,
      }));
    setDevices(inputs);
  }, [enabled]);

  const stop = useCallback(() => {
    splitterRef.current?.disconnect();
    sourceRef.current?.disconnect();
    analyserRef.current?.disconnect();

    splitterRef.current = null;
    sourceRef.current = null;
    analyserRef.current = null;
    setAnalyser(null);
    setDetectedChannelCount(null);
    setSourceChannelCount(null);
    setEffectiveChannel(null);
    setUsingMixedFallback(false);

    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    void audioContextRef.current?.close();
    audioContextRef.current = null;
    setIsRunning(false);
  }, []);

  const start = useCallback(async () => {
    if (!enabled) return;
    if (!("mediaDevices" in navigator) || !("AudioContext" in window)) {
      setError("Audio input monitoring is not supported in this browser.");
      return;
    }

    setError(null);
    stop();

    try {
      const baseAudioConstraints: MediaTrackConstraints =
        selectedDeviceId === DEFAULT_DEVICE_ID
          ? {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
            }
          : {
              deviceId: { exact: selectedDeviceId },
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
            };
      const preferredChannels = Math.max(2, clampChannel(selectedChannel));
      let stream: MediaStream;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            ...baseAudioConstraints,
            channelCount: {
              ideal: preferredChannels,
              min: 1,
            },
          },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: baseAudioConstraints,
        });
      }

      const track = stream.getAudioTracks()[0] ?? null;
      if (track?.applyConstraints) {
        try {
          await track.applyConstraints({
            channelCount: preferredChannels,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          });
        } catch {
          // Ignore: some browsers reject channelCount constraints.
        }
      }

      const context = new AudioContext();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.85;

      const trackReportedChannels = Math.max(
        1,
        Math.round(track?.getSettings().channelCount ?? 1),
      );
      const actualSourceChannels = Math.max(1, Math.round(source.channelCount || 1));
      const splitterOutputs = Math.max(
        MAX_SPLIT_CHANNELS,
        actualSourceChannels,
        selectedChannel,
      );
      const splitter = context.createChannelSplitter(splitterOutputs);
      source.connect(splitter);

      const channelIndex = clampChannel(selectedChannel) - 1;
      const channelIsAvailable = channelIndex < actualSourceChannels;
      if (channelIsAvailable) {
        splitter.connect(analyser, channelIndex, 0);
        setEffectiveChannel(channelIndex + 1);
        setUsingMixedFallback(false);
      } else {
        // Browser exposed fewer channels than requested; use a mixed feed
        // so the user still gets a live visualization.
        source.connect(analyser);
        setEffectiveChannel(null);
        setUsingMixedFallback(true);
      }
      setDetectedChannelCount(trackReportedChannels);
      setSourceChannelCount(actualSourceChannels);

      if (context.state === "suspended") {
        await context.resume();
      }

      audioContextRef.current = context;
      streamRef.current = stream;
      sourceRef.current = source;
      splitterRef.current = splitter;
      analyserRef.current = analyser;
      setAnalyser(analyser);
      setIsRunning(true);

      await refreshDevices();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to start audio input.";
      setError(message);
      stop();
    }
  }, [enabled, refreshDevices, selectedChannel, selectedDeviceId, stop]);

  useEffect(() => {
    window.localStorage.setItem(DEVICE_STORAGE_KEY, selectedDeviceId);
  }, [selectedDeviceId]);

  useEffect(() => {
    window.localStorage.setItem(CHANNEL_STORAGE_KEY, String(selectedChannel));
  }, [selectedChannel]);

  useEffect(() => {
    if (!enabled) return;
    const initialRefreshTimer = window.setTimeout(() => {
      void refreshDevices();
    }, 0);

    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.addEventListener) {
      return () => {
        window.clearTimeout(initialRefreshTimer);
      };
    }

    const handleDeviceChange = () => {
      void refreshDevices();
    };

    mediaDevices.addEventListener("devicechange", handleDeviceChange);

    return () => {
      window.clearTimeout(initialRefreshTimer);
      mediaDevices.removeEventListener("devicechange", handleDeviceChange);
    };
  }, [enabled, refreshDevices]);

  useEffect(() => {
    if (enabled) return;
    stop();
    setError(null);
  }, [enabled, stop]);

  useEffect(() => stop, [stop]);

  const statusText = useMemo(() => {
    if (!enabled) return "Disabled";
    if (error) return `Error: ${error}`;
      if (isRunning) {
        if (usingMixedFallback) {
          const detected = detectedChannelCount ?? 1;
          const sourceDetected = sourceChannelCount ?? 1;
          const forcedStereo =
            selectedChannel > 2 && sourceDetected <= 2
              ? " Browser limited input to stereo."
              : "";
          return `Listening (mix fallback): requested ch ${selectedChannel}, track reports ${detected}, source exposes ${sourceDetected}.${forcedStereo}`;
        }

      const detected = detectedChannelCount ?? 1;
      const sourceDetected = sourceChannelCount ?? 1;
      return `Listening on channel ${effectiveChannel ?? selectedChannel} (track ${detected}, source ${sourceDetected}).`;
    }
    return "Stopped";
  }, [
    detectedChannelCount,
    effectiveChannel,
    error,
    isRunning,
    selectedChannel,
    sourceChannelCount,
    usingMixedFallback,
    enabled,
  ]);

  return {
    analyser,
    devices,
    selectedDeviceId,
    selectedChannel,
    isRunning,
    error,
    statusText,
    setSelectedDeviceId,
    setSelectedChannel: (channel: number) => setSelectedChannel(clampChannel(channel)),
    refreshDevices,
    start,
    stop,
  };
}
