/**
 * Target list component - displays all target probabilities for current state
 */

import React from 'react';
import { Box, Text } from 'ink';
import { TargetRow } from './TargetRow.js';
import { colors } from '../styles/colors.js';
import type { Row } from '../../matrix/types.js';
import { calculateEntropy } from '../../matrix/utils.js';

interface TargetListProps {
    row: Row;
    selectedState: number;
    focusedTarget: number;
    lockDiagonal: boolean;
    numStates: number;
}

export const TargetList: React.FC<TargetListProps> = ({
    row,
    selectedState,
    focusedTarget,
    lockDiagonal,
    numStates,
}) => {
    const entropy = calculateEntropy(row);
    const rowSum = row.reduce((a, b) => a + b, 0);
    const stateLabel = 'ABCDEFGHIJKLMNOP'[selectedState];

    return (
        <Box flexDirection="column" borderStyle="round" borderColor={colors.focused} paddingX={1} flexShrink={0}>
            <Box marginBottom={1}>
                <Text bold color={colors.text}>
                    OUTGOING TRANSITIONS FROM STATE {stateLabel}
                </Text>
                <Text color={colors.textDim}> (sum: {rowSum.toFixed(3)}, entropy: {entropy.toFixed(2)} bits)</Text>
            </Box>

            <Box marginBottom={1} minHeight={1}>
                <Text color={colors.info}>
                    Use ↑↓ to navigate, ←→ to adjust probability
                </Text>
            </Box>

            <Box flexDirection="column" marginBottom={1}>
                {row.map((probability, index) => (
                    <TargetRow
                        key={index}
                        targetIndex={index}
                        probability={probability}
                        focused={index === focusedTarget}
                        isSelf={index === selectedState}
                        numStates={numStates}
                    />
                ))}
            </Box>

            <Box>
                <Text>Lock self-transition: </Text>
                <Text color={lockDiagonal ? colors.success : colors.inactive} bold>
                    [{lockDiagonal ? 'X' : ' '}]
                </Text>
            </Box>
        </Box>
    );
};
