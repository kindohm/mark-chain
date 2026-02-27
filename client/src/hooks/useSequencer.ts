import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { AnchorState, ChainState, ChainStepEvent, ClientMessage, LayerState, MixerCcLevels, OscConfig, OscDebugEvent, OscState, ServerMessage, StabState } from '../types';

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

function equalArray<T>(a: T[], b: T[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

function equalAnchorState(a: AnchorState, b: AnchorState): boolean {
    return a.isEnabled === b.isEnabled
        && a.division === b.division
        && a.bpm === b.bpm
        && a.midiDevice === b.midiDevice
        && a.channel === b.channel
        && a.stepCount === b.stepCount
        && equalArray(a.midiDevices, b.midiDevices);
}

function equalLayerState(a: LayerState, b: LayerState): boolean {
    return a.layerId === b.layerId
        && a.isEnabled === b.isEnabled
        && a.division === b.division
        && a.midiDevice === b.midiDevice
        && a.channel === b.channel
        && a.velocity === b.velocity
        && a.durationPct === b.durationPct
        && equalArray(a.midiDevices, b.midiDevices);
}

function equalStabState(a: StabState, b: StabState): boolean {
    return a.stabId === b.stabId
        && a.isEnabled === b.isEnabled
        && equalArray(a.steps, b.steps)
        && a.numSteps === b.numSteps
        && a.division === b.division
        && a.midiDevice === b.midiDevice
        && a.channel === b.channel
        && a.midiNote === b.midiNote
        && equalArray(a.midiDevices, b.midiDevices)
        && a.currentStep === b.currentStep
        && a.mirrorEnabled === b.mirrorEnabled
        && a.mirrorState === b.mirrorState
        && a.mirrorOffEnabled === b.mirrorOffEnabled
        && a.mirrorOffState === b.mirrorOffState
        && a.x === b.x
        && a.y === b.y
        && a.cc3 === b.cc3
        && a.cc4 === b.cc4;
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
    const [lastStep, setLastStep] = useState<ChainStepEvent | null>(null);
    const [lastOscDebugEvent, setLastOscDebugEvent] = useState<OscDebugEvent | null>(null);
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
                    numStates: msg.numStates, isEnabled: msg.isEnabled, isRunning: msg.isRunning, currentState: msg.currentState,
                    stepCount: msg.stepCount, stateMidi: msg.stateMidi, midiDevices: msg.midiDevices,
                    velocityMin: msg.velocityMin,
                    matrixTransforms: msg.matrixTransforms,
                });
                return next;
            });
        }
        if (msg.type === 'anchor_update') {
            const next: AnchorState = {
                isEnabled: msg.isEnabled, division: msg.division, bpm: msg.bpm,
                midiDevice: msg.midiDevice, channel: msg.channel, midiDevices: msg.midiDevices, stepCount: msg.stepCount
            };
            setAnchor(prev => (prev && equalAnchorState(prev, next) ? prev : next));
        }
        if (msg.type === 'step') {
            setLastStep(msg);
            setChains(prev => {
                const chain = prev.get(msg.chainId);
                if (!chain) return prev;
                const next = new Map(prev);
                next.set(msg.chainId, {
                    ...chain,
                    currentState: msg.toState,
                    stepCount: msg.step,
                });
                return next;
            });
        }
        if (msg.type === 'stab_update') {
            setStabs(prev => {
                const nextStab: StabState = {
                    stabId: msg.stabId, isEnabled: msg.isEnabled, steps: msg.steps,
                    numSteps: msg.numSteps, division: msg.division, midiDevice: msg.midiDevice,
                    channel: msg.channel, midiNote: msg.midiNote, midiDevices: msg.midiDevices,
                    currentStep: msg.currentStep, mirrorEnabled: msg.mirrorEnabled, mirrorState: msg.mirrorState,
                    mirrorOffEnabled: msg.mirrorOffEnabled, mirrorOffState: msg.mirrorOffState,
                    x: msg.x, y: msg.y, cc3: msg.cc3, cc4: msg.cc4
                };
                const prevStab = prev.get(msg.stabId);
                if (prevStab && equalStabState(prevStab, nextStab)) return prev;
                const next = new Map(prev);
                next.set(msg.stabId, nextStab);
                return next;
            });
        }
        if (msg.type === 'layer_update') {
            setLayers(prev => {
                const nextLayer: LayerState = {
                    layerId: msg.layerId, isEnabled: msg.isEnabled, division: msg.division,
                    midiDevice: msg.midiDevice, channel: msg.channel, velocity: msg.velocity,
                    durationPct: msg.durationPct, midiDevices: msg.midiDevices
                };
                const prevLayer = prev.get(msg.layerId);
                if (prevLayer && equalLayerState(prevLayer, nextLayer)) return prev;
                const next = new Map(prev);
                next.set(msg.layerId, nextLayer);
                return next;
            });
        }
        if (msg.type === 'mixer_update') {
            setMixer(prev => (
                prev.drums === msg.levels.drums
                && prev.anchor === msg.levels.anchor
                && prev.stab1 === msg.levels.stab1
                && prev.stab2 === msg.levels.stab2
                && prev.layer1 === msg.levels.layer1
                && prev.layer2 === msg.levels.layer2
            ) ? prev : msg.levels);
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
            setLastOscDebugEvent(msg.event);
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

    const chainsArray = useMemo(() => [...chains.values()], [chains]);
    const stabsArray = useMemo(() => [...stabs.values()], [stabs]);
    const layersArray = useMemo(() => [...layers.values()], [layers]);

    return {
        chains: chainsArray,
        anchor,
        stabs: stabsArray,
        layers: layersArray,
        mixer,
        osc,
        connected,
        lastStep,
        lastOscDebugEvent,
        sendMessage,
    };
}
