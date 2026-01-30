/**
 * State selector component - displays and allows selection of states
 */

import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../styles/colors.js';

interface StateSelectorProps {
    numStates: number;
    selectedState: number;
    currentPlayingState?: number;
    focused?: boolean;
}

export const StateSelector: React.FC<StateSelectorProps> = ({
    numStates,
    selectedState,
    currentPlayingState,
    focused,
}) => {
    const stateLabels = 'ABCDEFGHIJKLMNOP'.split('').slice(0, numStates);

    return (
        <Box flexDirection="column" marginBottom={1}>
            <Box marginBottom={1}>
                <Text bold color={focused ? colors.focused : colors.text}>
                    STATE SELECT {focused && '(use 1-9, 0 keys)'}
                </Text>
            </Box>
            <Box>
                <Text>
                    {stateLabels.map((label, index) => {
                        const isSelected = index === selectedState;
                        const isPlaying = index === currentPlayingState;
                        const isRest = index === numStates - 1;

                        let color: string = colors.inactive;
                        if (isPlaying) color = colors.active;
                        else if (isSelected) color = colors.focused;

                        return (
                            <Text
                                key={index}
                                bold={isSelected || isPlaying}
                                color={color}
                                inverse={isSelected}
                            >
                                [{label}]{isRest ? ' (rest)' : ''}
                            </Text>
                        );
                    })}
                </Text>
            </Box>
        </Box>
    );
};
