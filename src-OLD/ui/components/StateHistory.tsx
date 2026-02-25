/**
 * State history component - displays a scrolling single-line history of played states
 */

import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../styles/colors.js';

interface StateHistoryProps {
    history: number[];
    numStates: number;
}

// Color palette for states (cycling through vibrant colors)
const STATE_COLORS = [
    '#FF6B6B', // Red
    '#4ECDC4', // Cyan
    '#45B7D1', // Blue
    '#FFA07A', // Light Salmon
    '#98D8C8', // Mint
    '#F7DC6F', // Yellow
    '#BB8FCE', // Purple
    '#85C1E2', // Sky Blue
];

export const StateHistory: React.FC<StateHistoryProps> = ({ history, numStates }) => {
    const stateLabels = 'ABCDEFGHIJKLMNOP'.split('').slice(0, numStates);

    // Show more characters to fill terminal width
    // Typical terminal is 120+ chars, minus "HISTORY: " (9 chars) = ~110 chars available
    const displayHistory = history.slice(-200);

    return (
        <Box>
            <Text color={colors.textDim}>HISTORY: </Text>
            {displayHistory.map((stateIndex, i) => {
                const label = stateLabels[stateIndex];
                const color = STATE_COLORS[stateIndex % STATE_COLORS.length];
                return (
                    <Text key={i} color={color} bold>
                        {label}
                    </Text>
                );
            })}
        </Box>
    );
};
