/**
 * Sequencer controls component
 */

import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../styles/colors.js';

interface SequencerControlsProps {
    isRunning: boolean;
    bpm: number;
    stepCount: number;
    focused: boolean;
}

export const SequencerControls: React.FC<SequencerControlsProps> = ({
    isRunning,
    bpm,
    stepCount,
    focused,
}) => {
    return (
        <Box
            flexDirection="column"
            borderStyle="round"
            borderColor={focused ? colors.focused : colors.inactive}
            paddingX={1}
            marginTop={1}
        >
            <Box marginBottom={1}>
                <Text bold color={colors.text}>
                    SEQUENCER
                </Text>
            </Box>

            <Box marginBottom={1} minHeight={1}>
                <Text color={focused ? colors.info : colors.inactive} dimColor={!focused}>
                    Space Start/Stop  + - Adjust BPM
                </Text>
            </Box>

            <Box flexDirection="column">
                <Box>
                    <Text>Status: </Text>
                    <Text color={isRunning ? colors.success : colors.inactive} bold>
                        {isRunning ? '▶ RUNNING' : '■ STOPPED'}
                    </Text>
                </Box>
                <Box>
                    <Text>BPM: </Text>
                    <Text color={colors.text} bold>
                        {bpm}
                    </Text>
                </Box>
                <Box>
                    <Text>Steps: </Text>
                    <Text color={colors.textDim}>{stepCount}</Text>
                </Box>
            </Box>
        </Box>
    );
};
