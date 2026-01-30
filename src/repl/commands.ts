/**
 * REPL command handlers
 */

import chalk from 'chalk';
import type { StateName } from '../core/markov.js';
import type { MarkovMatrix } from '../core/markov.js';
import type { Sequencer } from '../core/sequencer.js';
import { MidiHandler } from '../midi/midi.js';
import type { ConfigManager } from '../config/config.js';
import * as readline from 'readline';

export class CommandHandler {
    private matrix: MarkovMatrix;
    private sequencer: Sequencer;
    private midi: MidiHandler;
    private configManager: ConfigManager;

    constructor(
        matrix: MarkovMatrix,
        sequencer: Sequencer,
        midi: MidiHandler,
        config: ConfigManager
    ) {
        this.matrix = matrix;
        this.sequencer = sequencer;
        this.midi = midi;
        this.configManager = config;
    }

    /**
     * Handle .help command
     */
    help(): string {
        return chalk.cyan(`
mark-chain MIDI Markov Chain Sequencer

Available commands:
  ${chalk.yellow('.start')}              - Start the sequencer
  ${chalk.yellow('.stop')}               - Stop the sequencer
  ${chalk.yellow('.tempo <bpm>')}        - Set tempo in BPM (supports fractional values)
  ${chalk.yellow('.set <from> <to> <p>')} - Set transition probability
  ${chalk.yellow('.show')}               - Display current matrix
  ${chalk.yellow('.state')}              - Show current state
  ${chalk.yellow('.config')}             - Enter configuration wizard
  ${chalk.yellow('.help')}               - Display this help message
  ${chalk.yellow('.exit')}               - Exit the application

MIDI Learning:
  To learn MIDI CC mappings, restart with: ${chalk.green('npm start -- --learn')}

Examples:
  .tempo 140.5
  .set A B 0.75
  .set B C 1.0
`);
    }

    /**
     * Handle .start command
     */
    start(): string {
        if (this.sequencer.getIsRunning()) {
            return chalk.yellow('Sequencer is already running');
        }

        this.sequencer.start();
        return chalk.green(`✓ Sequencer started at ${this.sequencer.getTempo()} BPM`);
    }

    /**
     * Handle .stop command
     */
    stop(): string {
        if (!this.sequencer.getIsRunning()) {
            return chalk.yellow('Sequencer is not running');
        }

        this.sequencer.stop();
        return chalk.green('✓ Sequencer stopped');
    }

    /**
     * Handle .tempo command
     */
    tempo(bpm: string): string {
        const tempo = parseFloat(bpm);

        if (isNaN(tempo) || tempo <= 0) {
            return chalk.red('✗ Invalid tempo. Must be a positive number.');
        }

        this.sequencer.setTempo(tempo);
        this.configManager.setTempo(tempo);

        return chalk.green(`✓ Tempo set to ${tempo} BPM`);
    }

    /**
     * Handle .set command
     */
    set(fromState: string, toState: string, probability: string): string {
        const from = fromState.toUpperCase() as StateName;
        const to = toState.toUpperCase() as StateName;
        const prob = parseFloat(probability);

        if (isNaN(prob) || prob < 0) {
            return chalk.red('✗ Invalid probability. Must be a non-negative number.');
        }

        try {
            this.matrix.setProbability(from, to, prob);
            this.configManager.setMatrix(this.matrix.toJSON());
            return chalk.green(`✓ Set P(${from} → ${to}) = ${prob}`);
        } catch (error) {
            return chalk.red(`✗ ${(error as Error).message}`);
        }
    }

    /**
     * Handle .show command
     */
    show(): string {
        const states = this.matrix.getStates();
        const data = this.matrix.toJSON();
        const lastState = states[states.length - 1];

        // Build header
        let output = chalk.cyan('\nMarkov Matrix:\n\n');
        output += '     ';
        for (const state of states) {
            const label = state === lastState ? `${state}*` : state;
            output += chalk.yellow(label.padEnd(6));
        }
        output += '\n';
        output += '     ' + '─'.repeat(states.length * 6) + '\n';

        // Build rows
        for (const fromState of states) {
            const rowLabel = fromState === lastState ? `${fromState}*` : fromState;
            output += chalk.yellow(rowLabel) + ' │  ';
            for (const toState of states) {
                const prob = data.probabilities[fromState][toState];
                const formatted = prob.toFixed(2).padEnd(6);
                output += prob > 0 ? chalk.green(formatted) : chalk.dim(formatted);
            }
            output += '\n';
        }

        output += chalk.dim('\n* = rest state (no MIDI output)\n');

        return output;
    }

    /**
     * Handle .state command
     */
    state(): string {
        const current = this.sequencer.getCurrentState();
        const running = this.sequencer.getIsRunning();
        const tempo = this.sequencer.getTempo();

        // Check if current state is the rest state (last state)
        const states = this.matrix.getStates();
        const lastState = states[states.length - 1];
        const isRest = current === lastState;

        return chalk.cyan(`
Current State: ${chalk.yellow(current)}${isRest ? chalk.dim(' (rest)') : ''}
Status: ${running ? chalk.green('Running') : chalk.red('Stopped')}
Tempo: ${chalk.yellow(tempo + ' BPM')}
`);
    }

    /**
     * Handle .config command (wizard)
     */
    async configure(): Promise<string> {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        const question = (prompt: string): Promise<string> => {
            return new Promise((resolve) => {
                rl.question(prompt, resolve);
            });
        };

        try {
            console.log(chalk.cyan('\n=== Configuration Wizard ===\n'));

            // Show available devices
            const devices = MidiHandler.getOutputDevices();
            console.log(chalk.yellow('Available MIDI devices:'));
            devices.forEach((device, index) => {
                console.log(`  ${index + 1}. ${device}`);
            });

            const deviceIndex = await question(chalk.cyan('\nSelect device number (or press Enter for default): '));

            if (deviceIndex.trim()) {
                const index = parseInt(deviceIndex) - 1;
                if (index >= 0 && index < devices.length) {
                    this.configManager.setMidiDevice(devices[index]);
                    console.log(chalk.green(`✓ MIDI device set to: ${devices[index]}`));
                }
            }

            const noteInput = await question(chalk.cyan('Default MIDI note (current: 36): '));
            if (noteInput.trim()) {
                const note = parseInt(noteInput);
                if (!isNaN(note) && note >= 0 && note <= 127) {
                    this.configManager.setDefaultNote(note);
                    console.log(chalk.green(`✓ Default note set to: ${note}`));
                }
            }

            rl.close();
            return chalk.green('\n✓ Configuration saved');
        } catch (error) {
            rl.close();
            return chalk.red(`✗ Configuration failed: ${(error as Error).message}`);
        }
    }

    /**
     * Handle .learn command (MIDI learning mode)
     */
    async learn(): Promise<string> {
        if (this.sequencer.getIsRunning()) {
            return chalk.red('✗ Please stop the sequencer before entering learning mode');
        }

        try {
            console.log(chalk.cyan('\n=== MIDI Learning Mode ===\n'));
            console.log(chalk.yellow('Press Ctrl+C to exit learning mode\n'));

            // Try to find Twister device first, fall back to configured device
            let inputDevice = MidiHandler.findTwisterDevice();
            if (inputDevice) {
                console.log(chalk.green(`✓ Using Twister device for input: ${inputDevice}\n`));
            } else {
                inputDevice = this.configManager.getMidiDevice();
                if (!inputDevice) {
                    return chalk.red('✗ No MIDI device configured and no Twister found. Run .config first.');
                }
                console.log(chalk.yellow(`⚠ Twister not found, using configured device: ${inputDevice}\n`));
            }

            this.midi.openInput(inputDevice);

            const states = this.matrix.getStates();

            // Learn CC for each transition
            for (const fromState of states) {
                for (const toState of states) {
                    console.log(chalk.cyan(`\nLearning: ${fromState} → ${toState}`));
                    console.log(chalk.yellow('Move a control on your MIDI controller...'));

                    const ccData = await new Promise<{ channel: number; cc: number }>((resolve) => {
                        this.midi.onCC((dev, channel, cc, value) => {
                            console.log(chalk.green(`✓ Learned: Channel ${channel}, CC ${cc}`));
                            this.midi.removeAllCCListeners();
                            resolve({ channel, cc });
                        });
                    });

                    this.configManager.addCCMapping({
                        fromState,
                        toState,
                        device: inputDevice,
                        channel: ccData.channel,
                        cc: ccData.cc,
                    });

                    // Wait for user to press Enter before continuing
                    await new Promise<void>((resolve) => {
                        process.stdout.write(chalk.dim('Press Enter to continue...'));
                        const onData = (data: Buffer) => {
                            if (data.toString().includes('\n')) {
                                process.stdin.removeListener('data', onData);
                                resolve();
                            }
                        };
                        process.stdin.on('data', onData);
                    });
                }
            }

            // Clean up MIDI input
            this.midi.removeAllCCListeners();
            this.midi.closeInput();

            return chalk.green('\n✓ MIDI learning complete');
        } catch (error) {
            // Clean up on error
            this.midi.removeAllCCListeners();
            try {
                this.midi.closeInput();
            } catch (e) {
                // Ignore close errors
            }
            return chalk.red(`✗ Learning failed: ${(error as Error).message}`);
        }
    }
}
