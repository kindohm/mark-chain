import { useEffect, useRef, useState, useCallback } from 'react';
import type { ChainState, ClientMessage, ServerMessage } from '../types';

const WS_URL = 'ws://localhost:3000';
const RECONNECT_DELAY_MS = 2000;

export function useSequencer() {
    const [chains, setChains] = useState<Map<string, ChainState>>(new Map());
    const [connected, setConnected] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const connect = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close();
        }

        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
            setConnected(true);
            if (reconnectTimer.current) {
                clearTimeout(reconnectTimer.current);
                reconnectTimer.current = null;
            }
        };

        ws.onclose = () => {
            setConnected(false);
            reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
        };

        ws.onerror = () => {
            ws.close();
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data as string) as ServerMessage;
                handleMessage(msg);
            } catch {
                console.warn('Failed to parse server message:', event.data);
            }
        };
    }, []);

    function handleMessage(msg: ServerMessage) {
        if (msg.type === 'state_update') {
            setChains((prev) => {
                const next = new Map(prev);
                next.set(msg.chainId, {
                    chainId: msg.chainId,
                    name: msg.name,
                    matrix: msg.matrix,
                    bpm: msg.bpm,
                    numStates: msg.numStates,
                    isRunning: msg.isRunning,
                    currentState: msg.currentState,
                    stepCount: msg.stepCount,
                    stateMidi: msg.stateMidi,
                    midiDevices: msg.midiDevices,
                });
                return next;
            });
        }
        // `step` messages update currentState and stepCount via the follow-up state_update
        // the server always broadcasts a state_update after each step
    }

    const sendMessage = useCallback((msg: ClientMessage) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(msg));
        }
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
        connected,
        sendMessage,
    };
}
