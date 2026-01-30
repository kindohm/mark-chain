/**
 * REPL interface
 */

import repl from 'repl';
import chalk from 'chalk';
import { CommandHandler } from './commands.js';
import type { MarkovMatrix } from '../core/markov.js';
import type { Sequencer } from '../core/sequencer.js';
import type { MidiHandler } from '../midi/midi.js';
import type { ConfigManager } from '../config/config.js';

export class ReplInterface {
    private commandHandler: CommandHandler;
    private replServer: repl.REPLServer | null;

    constructor(
        matrix: MarkovMatrix,
        sequencer: Sequencer,
        midi: MidiHandler,
        config: ConfigManager
    ) {
        this.commandHandler = new CommandHandler(matrix, sequencer, midi, config);
        this.replServer = null;
    }

    /**
     * Start the REPL
     */
    start(): void {
        console.log(chalk.cyan.bold('\n╔═══════════════════════════════════════╗'));
        console.log(chalk.cyan.bold('║   mark-chain MIDI Markov Sequencer   ║'));
        console.log(chalk.cyan.bold('╚═══════════════════════════════════════╝\n'));
        console.log(chalk.yellow('Type .help for available commands\n'));

        this.replServer = repl.start({
            prompt: chalk.green('mark-chain> '),
            eval: this.evaluate.bind(this),
            ignoreUndefined: true,
            useGlobal: false,
        });

        // Define custom commands to override built-in REPL commands
        this.defineCommands();

        this.replServer.on('exit', () => {
            console.log(chalk.cyan('\nGoodbye!\n'));
            process.exit(0);
        });
    }

    /**
     * Define custom REPL commands
     */
    private defineCommands(): void {
        if (!this.replServer) return;

        // Override .help
        this.replServer.defineCommand('help', {
            help: 'Display mark-chain commands',
            action: () => {
                console.log(this.commandHandler.help());
                this.replServer!.displayPrompt();
            },
        });

        // .start command
        this.replServer.defineCommand('start', {
            help: 'Start the sequencer',
            action: () => {
                console.log(this.commandHandler.start());
                this.replServer!.displayPrompt();
            },
        });

        // .stop command
        this.replServer.defineCommand('stop', {
            help: 'Stop the sequencer',
            action: () => {
                console.log(this.commandHandler.stop());
                this.replServer!.displayPrompt();
            },
        });

        // .tempo command
        this.replServer.defineCommand('tempo', {
            help: 'Set tempo in BPM',
            action: (bpm: string) => {
                if (!bpm.trim()) {
                    console.log(chalk.red('✗ Usage: .tempo <bpm>'));
                } else {
                    console.log(this.commandHandler.tempo(bpm));
                }
                this.replServer!.displayPrompt();
            },
        });

        // .set command
        this.replServer.defineCommand('set', {
            help: 'Set transition probability',
            action: (args: string) => {
                const parts = args.trim().split(/\s+/);
                if (parts.length < 3) {
                    console.log(chalk.red('✗ Usage: .set <from> <to> <probability>'));
                } else {
                    console.log(this.commandHandler.set(parts[0], parts[1], parts[2]));
                }
                this.replServer!.displayPrompt();
            },
        });

        // .show command
        this.replServer.defineCommand('show', {
            help: 'Display current matrix',
            action: () => {
                console.log(this.commandHandler.show());
                this.replServer!.displayPrompt();
            },
        });

        // .state command
        this.replServer.defineCommand('state', {
            help: 'Show current state',
            action: () => {
                console.log(this.commandHandler.state());
                this.replServer!.displayPrompt();
            },
        });

        // .config command
        this.replServer.defineCommand('config', {
            help: 'Enter configuration wizard',
            action: async () => {
                const result = await this.commandHandler.configure();
                console.log(result);
                this.replServer!.displayPrompt();
            },
        });

        // .learn command
        this.replServer.defineCommand('learn', {
            help: 'Enter MIDI learning mode (use: npm start -- --learn)',
            action: () => {
                console.log(chalk.yellow('\n⚠ MIDI learning mode has moved to a standalone mode.'));
                console.log(chalk.cyan('To learn MIDI CC mappings, restart the app with:'));
                console.log(chalk.green('  npm start -- --learn\n'));
                this.replServer!.displayPrompt();
            },
        });
    }

    /**
     * Evaluate REPL input
     */
    private async evaluate(
        cmd: string,
        _context: any,
        _filename: string,
        callback: (err: Error | null, result?: any) => void
    ): Promise<void> {
        const trimmed = cmd.trim();

        // Ignore empty input
        if (!trimmed) {
            callback(null);
            return;
        }

        // Unknown input (non-command)
        callback(null, chalk.yellow('Unknown command. Type .help for available commands.'));
    }
}
