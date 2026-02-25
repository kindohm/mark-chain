/**
 * Row operations panel - controls for row-level operations
 */

import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../styles/colors.js';

interface RowOpsPanelProps {
    focused: boolean;
    lockDiagonal: boolean;
}

export const RowOpsPanel: React.FC<RowOpsPanelProps> = ({
    focused,
    lockDiagonal,
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
                    ROW OPERATIONS
                </Text>
            </Box>

            <Box flexDirection="column" marginBottom={1} minHeight={2}>
                <Text color={focused ? colors.info : colors.inactive} dimColor={!focused}>
                    [ ] Flatten  [ ] Sharpen  , . Rotate  L Lock diagonal
                </Text>
                <Text color={focused ? colors.info : colors.inactive} dimColor={!focused}>
                    R Reset  X Randomize
                </Text>
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
