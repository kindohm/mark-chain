/**
 * Application entry point
 */

import { MarkovMatrix } from './core/markov.js';
import { Sequencer } from './core/sequencer.js';
import { MidiHandler } from './midi/midi.js';
import { ConfigManager } from './config/config.js';
import { ReplInterface } from './repl/repl.js';
import { runLearnMode } from './learn/learn-mode.js';
import chalk from 'chalk';

async function main() {
    try {
        // Check for --learn flag
        const isLearnMode = process.argv.includes('--learn');

        if (isLearnMode) {
            await runLearnMode();
            process.exit(0);
        }

        // Normal REPL mode
        // Initialize configuration
        const config = new ConfigManager();

        // Load or initialize matrix
        const matrixData = config.getMatrix();
        const matrix = MarkovMatrix.fromJSON(matrixData);

        // Initialize MIDI
        let midiDevice = config.getMidiDevice();
        if (!midiDevice) {
            const defaultDevice = MidiHandler.findDefaultDevice();
            if (defaultDevice) {
                midiDevice = defaultDevice;
                config.setMidiDevice(defaultDevice);
                console.log(chalk.green(`✓ Auto-detected MIDI device: ${defaultDevice}`));
            } else {
                console.log(chalk.yellow('⚠ No MIDI device found. Run .config to set up MIDI.'));
                midiDevice = 'Virtual'; // Fallback
            }
        }

        const midiConfig = {
            deviceName: midiDevice,
            stateChannelMap: config.getStateChannelMap(),
            defaultNote: config.getDefaultNote(),
        };

        const midi = new MidiHandler(midiConfig);

        // Try to open MIDI output
        try {
            midi.openOutput();
            console.log(chalk.green(`✓ MIDI output opened: ${midiDevice}`));
        } catch (error) {
            console.log(chalk.yellow(`⚠ Could not open MIDI output: ${(error as Error).message}`));
        }

        // Load CC mappings
        const ccMappings = config.getCCMappings();
        for (const mapping of ccMappings) {
            midi.addCCMapping(mapping);
        }

        // Start MIDI CC control if we have mappings
        if (ccMappings.length > 0) {
            const inputDevice = MidiHandler.findTwisterDevice() || midiDevice;

            // Debounced matrix display
            let displayTimeout: NodeJS.Timeout | null = null;
            const debouncedDisplay = () => {
                if (displayTimeout) {
                    clearTimeout(displayTimeout);
                }
                displayTimeout = setTimeout(() => {
                    // Display matrix
                    const states = matrix.getStates();
                    const data = matrix.toJSON();

                    console.log(chalk.cyan('\nMarkov Matrix:\n'));

                    // Header
                    const header = '     ' + states.map(s => {
                        const isRest = s === states[states.length - 1];
                        return isRest ? `${s}*`.padEnd(6) : s.padEnd(6);
                    }).join('');
                    console.log(header);
                    console.log('     ' + '─'.repeat(states.length * 6));

                    // Rows
                    for (const fromState of states) {
                        const row = fromState + ' │  ' + states.map(toState => {
                            const prob = data.probabilities[fromState][toState] || 0;
                            return prob.toFixed(2).padEnd(6);
                        }).join('');
                        console.log(row);
                    }
                    console.log('');
                }, 500);
            };

            try {
                midi.startCCControl(inputDevice, matrix, debouncedDisplay);
                console.log(chalk.green(`✓ MIDI CC control enabled on: ${inputDevice}`));
            } catch (error) {
                console.log(chalk.yellow(`⚠ Could not enable MIDI CC control: ${(error as Error).message}`));
            }
        }

        // Initialize sequencer
        const tempo = config.getTempo();
        const sequencer = new Sequencer(matrix, {
            tempo,
            onStateChange: (state) => {
                try {
                    // The last state is always a rest state - don't play a note
                    const states = matrix.getStates();
                    const lastState = states[states.length - 1];

                    if (state !== lastState) {
                        midi.sendNote(state);
                    }
                } catch (error) {
                    // Silently ignore MIDI errors during playback
                }
            },
        });

        // Start REPL
        const replInterface = new ReplInterface(matrix, sequencer, midi, config);
        replInterface.start();

        // Graceful shutdown
        process.on('SIGINT', () => {
            console.log(chalk.cyan('\n\nShutting down...'));
            sequencer.stop();
            midi.stopCCControl();
            midi.close();
            process.exit(0);
        });

    } catch (error) {
        console.error(chalk.red(`✗ Fatal error: ${(error as Error).message}`));
        process.exit(1);
    }
}

main();
