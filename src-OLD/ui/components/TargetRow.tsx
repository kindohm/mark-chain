/**
 * Target row component - displays a single probability bar
 */

import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../styles/colors.js';

interface TargetRowProps {
    targetIndex: number;
    probability: number;
    focused: boolean;
    isSelf: boolean;
    numStates: number;
}

export const TargetRow: React.FC<TargetRowProps> = ({
    targetIndex,
    probability,
    focused,
    isSelf,
    numStates,
}) => {
    const label = 'ABCDEFGHIJKLMNOP'[targetIndex];
    const barWidth = 30;
    const filledWidth = Math.round(probability * barWidth);
    const emptyWidth = barWidth - filledWidth;

    const barColor = isSelf ? colors.barSelf : colors.barFilled;
    const isRest = targetIndex === numStates - 1;

    return (
        <Box>
            <Text color={focused ? colors.focused : colors.text}>
                {focused ? '▶ ' : '  '}
            </Text>
            <Text color={focused ? colors.focused : colors.text} bold={focused}>
                [{label}]
            </Text>
            <Text> </Text>
            <Text dimColor={!focused}>{probability.toFixed(3)}</Text>
            <Text>  </Text>
            <Text color={barColor}>{'█'.repeat(filledWidth)}</Text>
            <Text color={colors.barEmpty}>{'░'.repeat(emptyWidth)}</Text>
            {isSelf && <Text color={colors.textDim}> (self)</Text>}
            {isRest && <Text color={colors.textDim}> (rest)</Text>}
        </Box>
    );
};
