/**
 * Main App component
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { StateSelector } from './components/StateSelector.js';
import { TargetList } from './components/TargetList.js';
import { StateHistory } from './components/StateHistory.js';
import { colors } from './styles/colors.js';
import type { MatrixState } from '../matrix/types.js';
import {
    createInitialMatrix,
    applyRowOperation,
    selectState,
    toggleDiagonalLock,
} from '../matrix/engine.js';
import { SequencerEngine } from '../sequencer/engine.js';
import { MidiManager } from '../midi/manager.js';
import { isRestState } from '../midi/types.js';

interface AppProps {
    numStates?: number;
    bpm?: number;
}

export const App: React.FC<AppProps> = ({ numStates = 4, bpm = 120 }) => {
    const { exit } = useApp();

    // Matrix state
    const [matrixState, setMatrixState] = useState<MatrixState>(() =>
        createInitialMatrix(numStates)
    );

    // UI state
    const [focusedTarget, setFocusedTarget] = useState(0);

    // Sequencer state
    const [sequencerState, setSequencerState] = useState({
        isRunning: false,
        bpm,
        stepCount: 0,
        currentState: 0,
    });

    // State history (keep last 500 states)
    const [stateHistory, setStateHistory] = useState<number[]>([]);

    // Initialize engines
    const [sequencer] = useState(() => {
        const seq = new SequencerEngine(matrixState.matrix, { bpm, numStates });
        seq.onStateTransition((event) => {
            setSequencerState((prev) => ({
                ...prev,
                stepCount: event.step,
                currentState: event.toState,
            }));
            // Add to history (exclude rest states, keep last 500)
            if (!isRestState(event.toState, numStates)) {
                setStateHistory((prev) => {
                    const newHistory = [...prev, event.toState];
                    return newHistory.slice(-500);
                });
            }
            // Send MIDI note
            midiManager.sendNoteForState(event.toState);
        });
        return seq;
    });

    const [midiManager] = useState(() => {
        const midi = new MidiManager({ numStates });
        midi.connectDefault();
        return midi;
    });

    // Update sequencer when matrix changes
    useEffect(() => {
        sequencer.updateMatrix(matrixState.matrix);
    }, [matrixState.matrix, sequencer]);

    // Keyboard input handling
    useInput((input, key) => {
        // Global keys
        if (key.ctrl && input === 'c') {
            sequencer.stop();
            midiManager.disconnect();
            exit();
            return;
        }



        // Global sequencer controls
        if (input === ' ') {
            if (sequencerState.isRunning) {
                sequencer.stop();
                setSequencerState((prev) => ({ ...prev, isRunning: false }));
            } else {
                sequencer.start();
                setSequencerState((prev) => ({ ...prev, isRunning: true }));
            }
            return;
        }

        if (input === '+' || input === '=') {
            const newBpm = Math.min(300, sequencerState.bpm + 10);
            sequencer.updateConfig({ bpm: newBpm });
            setSequencerState((prev) => ({ ...prev, bpm: newBpm }));
            return;
        }

        if (input === '-' || input === '_') {
            const newBpm = Math.max(30, sequencerState.bpm - 10);
            sequencer.updateConfig({ bpm: newBpm });
            setSequencerState((prev) => ({ ...prev, bpm: newBpm }));
            return;
        }

        // State selection (1-9, 0)
        const numKey = parseInt(input);
        if (!isNaN(numKey)) {
            const stateIndex = numKey === 0 ? 9 : numKey - 1;
            if (stateIndex < numStates) {
                setMatrixState(selectState(matrixState, stateIndex));
                setFocusedTarget(0);
            }
            return;
        }

        // Arrow keys for target navigation and adjustment
        if (key.upArrow) {
            setFocusedTarget((prev) => Math.max(0, prev - 1));
            return;
        }
        if (key.downArrow) {
            setFocusedTarget((prev) => Math.min(numStates - 1, prev + 1));
            return;
        }
        if (key.leftArrow) {
            setMatrixState(
                applyRowOperation(matrixState, {
                    type: 'setTarget',
                    targetIndex: focusedTarget,
                    delta: key.shift ? -0.01 : -0.05,
                })
            );
            return;
        }
        if (key.rightArrow) {
            setMatrixState(
                applyRowOperation(matrixState, {
                    type: 'setTarget',
                    targetIndex: focusedTarget,
                    delta: key.shift ? 0.01 : 0.05,
                })
            );
            return;
        }

        // Global row operations
        if (input === '[') {
            setMatrixState(applyRowOperation(matrixState, { type: 'flatten', lambda: 0.1 }));
            return;
        }
        if (input === ']') {
            setMatrixState(applyRowOperation(matrixState, { type: 'sharpen', alpha: 1.2 }));
            return;
        }
        if (input === ',') {
            setMatrixState(applyRowOperation(matrixState, { type: 'rotate', steps: -1 }));
            return;
        }
        if (input === '.') {
            setMatrixState(applyRowOperation(matrixState, { type: 'rotate', steps: 1 }));
            return;
        }
        if (input === 'l' || input === 'L') {
            setMatrixState(toggleDiagonalLock(matrixState));
            return;
        }
        if (input === 'r' || input === 'R') {
            setMatrixState(applyRowOperation(matrixState, { type: 'reset' }));
            return;
        }
        if (input === 'x' || input === 'X') {
            if (key.shift) {
                // Shift+x: Uber-randomize - randomize all rows and tempo
                setMatrixState(applyRowOperation(matrixState, { type: 'randomizeAll' }));
                const randomBpm = Math.floor(Math.random() * (220 - 90 + 1)) + 90;
                sequencer.updateConfig({ bpm: randomBpm });
                setSequencerState((prev) => ({ ...prev, bpm: randomBpm }));
            } else {
                // x: Regular randomize - randomize current row only
                setMatrixState(applyRowOperation(matrixState, { type: 'randomize' }));
            }
            return;
        }
    });

    const currentRow = matrixState.matrix[matrixState.selectedStateIndex];

    return (
        <Box flexDirection="column" padding={1}>
            <Box marginBottom={1} justifyContent="space-between">
                <Text bold color={colors.primary}>
                    ♪ MARK-CHAIN - Markov MIDI Sequencer
                </Text>
                <Box gap={2}>
                    <Text color={sequencerState.isRunning ? colors.success : colors.inactive} bold>
                        {sequencerState.isRunning ? '▶ RUNNING' : '■ STOPPED'}
                    </Text>
                    <Text>
                        <Text color={colors.text} bold>{sequencerState.bpm}</Text>
                        <Text color={colors.textDim}> BPM</Text>
                    </Text>
                    <Text color={colors.textDim}>
                        Steps: {sequencerState.stepCount}
                    </Text>
                </Box>
            </Box>

            <Box marginBottom={1}>
                <StateHistory
                    history={stateHistory}
                    numStates={numStates}
                />
            </Box>

            <StateSelector
                numStates={numStates}
                selectedState={matrixState.selectedStateIndex}
                currentPlayingState={sequencerState.currentState}
            />

            <TargetList
                row={currentRow}
                selectedState={matrixState.selectedStateIndex}
                focusedTarget={focusedTarget}
                lockDiagonal={matrixState.lockDiagonal}
                numStates={numStates}
            />

            <Box marginTop={1} borderStyle="single" borderColor={colors.textDim} paddingX={1}>
                <Text color={colors.textDim}>
                    Space: start/stop | +/-: BPM | ↑↓←→: navigate/adjust | [ ] sharpen/flatten | , . rotate | L lock | R reset | X randomize | Shift+X uber-randomize | Ctrl+C: quit
                </Text>
            </Box>
        </Box>
    );
};
