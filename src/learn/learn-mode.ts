/**
 * MIDI learning mode - standalone mode for learning CC mappings
 */

import chalk from 'chalk';
import { MidiHandler } from '../midi/midi.js';
import { ConfigManager } from '../config/config.js';
import { MarkovMatrix } from '../core/markov.js';
import * as readline from 'readline';

export async function runLearnMode(): Promise<void> {
    console.log(chalk.cyan.bold('\n╔═══════════════════════════════════════╗'));
    console.log(chalk.cyan.bold('║   mark-chain MIDI Learning Mode      ║'));
    console.log(chalk.cyan.bold('╚═══════════════════════════════════════╝\n'));

    const config = new ConfigManager();
    const matrixData = config.getMatrix();
    const matrix = MarkovMatrix.fromJSON(matrixData);

    // Try to find Twister device first, fall back to configured device
    let inputDevice = MidiHandler.findTwisterDevice();
    if (inputDevice) {
        console.log(chalk.green(`✓ Using Twister device for input: ${inputDevice}\n`));
    } else {
        inputDevice = config.getMidiDevice();
        if (!inputDevice) {
            console.log(chalk.red('✗ No MIDI device configured and no Twister found.'));
            console.log(chalk.yellow('Please run the app without --learn and use .config first.\n'));
            process.exit(1);
        }
        console.log(chalk.yellow(`⚠ Twister not found, using configured device: ${inputDevice}\n`));
    }

    const midiConfig = {
        deviceName: inputDevice,
        stateChannelMap: config.getStateChannelMap(),
        defaultNote: config.getDefaultNote(),
    };

    const midi = new MidiHandler(midiConfig);

    try {
        midi.openInput(inputDevice);
    } catch (error) {
        console.log(chalk.red(`✗ Failed to open MIDI input: ${(error as Error).message}\n`));
        process.exit(1);
    }

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    const question = (prompt: string): Promise<string> => {
        return new Promise((resolve) => {
            rl.question(prompt, resolve);
        });
    };

    const states = matrix.getStates();
    let learnedCount = 0;
    const totalMappings = states.length * states.length;

    console.log(chalk.cyan(`Learning ${totalMappings} CC mappings for ${states.length} states...\n`));
    console.log(chalk.yellow('Press Ctrl+C to exit at any time\n'));

    try {
        // Learn CC for each transition
        for (const fromState of states) {
            for (const toState of states) {
                learnedCount++;
                console.log(chalk.cyan(`\n[${learnedCount}/${totalMappings}] Learning: ${fromState} → ${toState}`));
                console.log(chalk.yellow('Move a control on your MIDI controller...'));

                const ccData = await new Promise<{ channel: number; cc: number }>((resolve) => {
                    midi.onCC((dev, channel, cc, value) => {
                        console.log(chalk.green(`✓ Learned: Channel ${channel}, CC ${cc}`));
                        midi.removeAllCCListeners();
                        resolve({ channel, cc });
                    });
                });

                config.addCCMapping({
                    fromState,
                    toState,
                    device: inputDevice,
                    channel: ccData.channel,
                    cc: ccData.cc,
                });

                // Wait for user to press Enter before continuing (except for last one)
                if (learnedCount < totalMappings) {
                    await question(chalk.dim('Press Enter to continue...'));
                }
            }
        }

        console.log(chalk.green.bold('\n✓ MIDI learning complete!'));
        console.log(chalk.cyan(`\nLearned ${totalMappings} CC mappings.`));
        console.log(chalk.cyan(`Configuration saved to: ${chalk.yellow('~/.mark-chain/input-config.json')}\n`));

    } catch (error) {
        console.log(chalk.red(`\n✗ Learning failed: ${(error as Error).message}\n`));
    } finally {
        midi.removeAllCCListeners();
        midi.closeInput();
        rl.close();
    }
}
