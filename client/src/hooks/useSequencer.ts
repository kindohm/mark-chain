import { useEffect, useRef, useState, useCallback } from 'react';
import type { AnchorState, ChainState, ClientMessage, LayerState, MixerCcLevels, OscConfig, OscState, ServerMessage, StabState } from '../types';

const WS_URL = 'ws://localhost:3000';
const RECONNECT_DELAY_MS = 2000;
const OSC_CONFIG_STORAGE_KEY = 'mark-chain-osc-config';
const OSC_DEBUG_LOG_LIMIT = 200;

function loadSavedOscConfig(): Partial<OscConfig> | null {
    try {
        const raw = localStorage.getItem(OSC_CONFIG_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<OscConfig>;
        return {
            ...(typeof parsed.enabled === 'boolean' ? { enabled: parsed.enabled } : {}),
            ...(typeof parsed.rootAddress === 'string' ? { rootAddress: parsed.rootAddress } : {}),
            ...(typeof parsed.host === 'string' ? { host: parsed.host } : {}),
            ...(typeof parsed.port === 'number' && Number.isFinite(parsed.port) ? { port: parsed.port } : {}),
            ...(typeof parsed.drumMidiDevice === 'string' ? { drumMidiDevice: parsed.drumMidiDevice } : {}),
        };
    } catch {
        return null;
    }
}

function persistOscConfig(config: OscConfig): void {
    try {
        localStorage.setItem(OSC_CONFIG_STORAGE_KEY, JSON.stringify(config));
    } catch { }
}

function mergeOscConfig(base: OscConfig, override: Partial<OscConfig>): OscConfig {
    return {
        ...base,
        ...override,
    };
}

function equalOscConfig(a: OscConfig, b: OscConfig): boolean {
    return a.enabled === b.enabled
        && a.rootAddress === b.rootAddress
        && a.host === b.host
        && a.port === b.port
        && a.drumMidiDevice === b.drumMidiDevice;
}

export function useSequencer() {
    const [chains, setChains] = useState<Map<string, ChainState>>(new Map());
    const [anchor, setAnchor] = useState<AnchorState | null>(null);
    const [stabs, setStabs] = useState<Map<number, StabState>>(new Map());
    const [layers, setLayers] = useState<Map<number, LayerState>>(new Map());
    const [mixer, setMixer] = useState<MixerCcLevels>({
        drums: 0.8,
        anchor: 0.8,
        stab1: 0.8,
        stab2: 0.8,
        layer1: 0.8,
        layer2: 0.8,
    });
    const [osc, setOsc] = useState<OscState | null>(null);
    const [connected, setConnected] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const savedOscConfigRef = useRef<Partial<OscConfig> | null>(null);
    const oscHydratedForConnectionRef = useRef(false);
    const pendingOscApplyRef = useRef<OscConfig | null>(null);

    if (savedOscConfigRef.current === null) {
        savedOscConfigRef.current = loadSavedOscConfig();
    }

    const connect = useCallback(() => {
        if (wsRef.current) wsRef.current.close();
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
            setConnected(true);
            oscHydratedForConnectionRef.current = false;
            pendingOscApplyRef.current = null;
            if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null; }
        };
        ws.onclose = () => {
            setConnected(false);
            reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
        };
        ws.onerror = () => { ws.close(); };
        ws.onmessage = (event) => {
            try { handleMessage(JSON.parse(event.data as string) as ServerMessage); }
            catch { console.warn('Failed to parse server message:', event.data); }
        };
    }, []);

    function handleMessage(msg: ServerMessage) {
        if (msg.type === 'state_update') {
            setChains(prev => {
                const next = new Map(prev);
                next.set(msg.chainId, {
                    chainId: msg.chainId, name: msg.name, matrix: msg.matrix, bpm: msg.bpm,
                    numStates: msg.numStates, isRunning: msg.isRunning, currentState: msg.currentState,
                    stepCount: msg.stepCount, stateMidi: msg.stateMidi, midiDevices: msg.midiDevices,
                    velocityMin: msg.velocityMin,
                });
                return next;
            });
        }
        if (msg.type === 'anchor_update') {
            setAnchor({
                isEnabled: msg.isEnabled, division: msg.division, bpm: msg.bpm,
                midiDevice: msg.midiDevice, channel: msg.channel, midiDevices: msg.midiDevices, stepCount: msg.stepCount
            });
        }
        if (msg.type === 'stab_update') {
            setStabs(prev => {
                const next = new Map(prev);
                next.set(msg.stabId, {
                    stabId: msg.stabId, isEnabled: msg.isEnabled, steps: msg.steps,
                    numSteps: msg.numSteps, division: msg.division, midiDevice: msg.midiDevice,
                    channel: msg.channel, midiNote: msg.midiNote, midiDevices: msg.midiDevices,
                    currentStep: msg.currentStep, mirrorEnabled: msg.mirrorEnabled, mirrorState: msg.mirrorState,
                    x: msg.x, y: msg.y, cc3: msg.cc3
                });
                return next;
            });
        }
        if (msg.type === 'layer_update') {
            setLayers(prev => {
                const next = new Map(prev);
                next.set(msg.layerId, {
                    layerId: msg.layerId, isEnabled: msg.isEnabled, division: msg.division,
                    midiDevice: msg.midiDevice, channel: msg.channel, velocity: msg.velocity,
                    durationPct: msg.durationPct, midiDevices: msg.midiDevices
                });
                return next;
            });
        }
        if (msg.type === 'mixer_update') {
            setMixer(msg.levels);
        }
        if (msg.type === 'osc_config_update') {
            if (!oscHydratedForConnectionRef.current) {
                oscHydratedForConnectionRef.current = true;
                const saved = savedOscConfigRef.current;
                if (saved) {
                    const merged = mergeOscConfig(msg.config, saved);
                    if (!equalOscConfig(merged, msg.config)) {
                        pendingOscApplyRef.current = merged;
                        if (wsRef.current?.readyState === WebSocket.OPEN) {
                            wsRef.current.send(JSON.stringify({ type: 'set_osc_config', config: merged } satisfies ClientMessage));
                        }
                    }
                }
            }

            setOsc(prev => ({
                config: msg.config,
                midiDevices: msg.midiDevices,
                debugLog: prev?.debugLog ?? [],
            }));

            if (pendingOscApplyRef.current && equalOscConfig(msg.config, pendingOscApplyRef.current)) {
                pendingOscApplyRef.current = null;
            }
            if (!pendingOscApplyRef.current) {
                persistOscConfig(msg.config);
            }
        }
        if (msg.type === 'osc_debug_snapshot') {
            setOsc(prev => ({
                config: prev?.config ?? {
                    enabled: false,
                    rootAddress: '/mark',
                    host: '',
                    port: 8000,
                    drumMidiDevice: '',
                },
                midiDevices: prev?.midiDevices ?? [],
                debugLog: msg.events.slice(-OSC_DEBUG_LOG_LIMIT),
            }));
        }
        if (msg.type === 'osc_debug_event') {
            setOsc(prev => ({
                config: prev?.config ?? {
                    enabled: false,
                    rootAddress: '/mark',
                    host: '',
                    port: 8000,
                    drumMidiDevice: '',
                },
                midiDevices: prev?.midiDevices ?? [],
                debugLog: [...(prev?.debugLog ?? []), msg.event].slice(-OSC_DEBUG_LOG_LIMIT),
            }));
        }
    }

    const sendMessage = useCallback((msg: ClientMessage) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(msg));
    }, []);

    useEffect(() => {
        connect();
        return () => {
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
            wsRef.current?.close();
        };
    }, [connect]);

    return {
        chains: [...chains.values()],
        anchor,
        stabs: [...stabs.values()],
        layers: [...layers.values()],
        mixer,
        osc,
        connected,
        sendMessage,
    };
}
