#!/usr/bin/env node

/**
 * Main entry point for mark-chain
 */

import React from 'react';
import { render } from 'ink';
import { App } from './ui/App.js';

// Parse command line arguments
const args = process.argv.slice(2);
let numStates = 4;
let bpm = 120;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--states' || args[i] === '-s') {
        numStates = parseInt(args[i + 1]);
        i++;
    } else if (args[i] === '--bpm' || args[i] === '-b') {
        bpm = parseInt(args[i + 1]);
        i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
        console.log(`
mark-chain - Markov MIDI Sequencer

Usage: mark-chain [options]

Options:
  -s, --states <number>  Number of states (default: 4)
  -b, --bpm <number>     Tempo in BPM (default: 120)
  -h, --help             Show this help message

Keyboard Controls:
  1-9, 0        Select state
  Tab           Cycle focus between sections
  ↑↓            Navigate targets (when focused on target list)
  ←→            Adjust probability (when focused on target list)
  [ ]           Flatten / Sharpen row
  , .           Rotate row left / right
  L             Toggle lock diagonal
  R             Reset row to uniform
  X             Randomize row
  Space         Start/Stop sequencer
  + -           Adjust BPM
  Ctrl+C        Quit
    `);
        process.exit(0);
    }
}

// Validate arguments
if (numStates < 2 || numStates > 16) {
    console.error('Error: Number of states must be between 2 and 16');
    process.exit(1);
}

if (bpm < 30 || bpm > 300) {
    console.error('Error: BPM must be between 30 and 300');
    process.exit(1);
}

// Render the app
render(<App numStates={numStates} bpm={bpm} />);
