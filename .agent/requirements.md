This document details the requirements for the mark-chain application.

## Overview

The `mark-chain` application is a NodeJS REPL application that sequences 
a MIDI synthesizer in real time using Markov chains and probability. 
The application holds sequencer state, Markov matrix chain state, 
and schedules MIDI events. 

An example 4-state Markov matrix, each state has 100% probability of
transitioning to the next state in the sequence A -> B -> C -> D -> A.

A row is the set of probabilities for transitioning from a given state (row name) to
a target state (column name).

  
    A    B    C    D
    ---- ---- ---- ----
A | 0.00 1.00 0.00 0.00
B | 0.00 0.00 1.00 0.00
C | 0.00 0.00 0.00 1.00
D | 1.00 0.00 0.00 0.00

Another example where each state has 50% probability of transitioning
to the next state and 50% probability of transitioning to the previous state

    A    B    C    D
    ---- ---- ---- ----
A | 0.00 0.50 0.00 0.50
B | 0.50 0.00 0.50 0.00
C | 0.00 0.50 0.00 0.50
D | 0.50 0.00 0.50 0.00

The application holds the state of this matrix, and the current state.



Probabilities are normalized, so that each row does not have to sum to 1.00. 
Thus, this matrix is valid:

    A    B    C    D
    ---- ---- ---- ----
A | 0.00 1.00 0.00 2.00
B | 1.00 0.00 2.00 0.00
C | 0.00 1.00 0.00 2.00
D | 1.00 0.00 2.00 0.00

Each row adds up to 3.00, but the relative probabilities are the same as the
previous example. 

A user interface might limit the user to only enter values between 0 and 1, but the
application should handle the normalization internally.

### Plan for a dynamic number of states

The examples above just use four states. However, in practice there may be as many as 16 states
Plan the coding logic to be flexible for any number of states.

## Matrix editing

Matrix editing will be done from an external MIDI controller. State transition
probabilities will be mapped to MIDI control change messages from the MIDI controller.

### MIDI "learning"

The app should include a `.learn` command that allows the application to listen for
an incoming MIDI control change message for a given state transition probability. 

The `.learn` command should be a guided interface in the app, where the app shows
all transition probabilities one at a time and lets the user select the MIDI control
change message for each probability. The app listens for the incoming message, then 
assigns it to the probability.

Each probability would be associated with a MIDI device, channel, and control change
number.

Using local storage, the app should remember the MIDI control change messages
for each transition probability. When the app starts up, it should load the last
saved configuration.

## Application State

The application holds the following state:
- current state
- markov matrix
- sequencer state

## Markov Matrix

The markov matrix is a 2D array of probabilities.

## Sequencer State

The sequencer state is a 1D array of notes. 

## REPL

The application is a REPL that allows the user to interact with the application.

## Commands

The following commands are available:

- .start: start the sequencer
- .stop: stop the sequencer
- .tempo: set the tempo in BPM (may be fractional)
- .help: print a help message
- .exit: exit the application
- .learn: enter learning mode, allowing the user to select the MIDI device and channel for each state transition probability. the sequencer should not be running in this mode.
- .config: enter configuration mode, allowing the user to select the MIDI device and channel for each state

Will also need commands for the following:

- changing an individual proability in the matrix

### CONCERN

How do we present an effective user interface in a REPL for modifying the matrix
easily? Could it be done with a text-based table that can be edited in place in the REPL?

## MIDI

The application should use an open source MIDI library to send MIDI events.

### Mapping of Matrix state to MIDI notes

Each state in the matrix corresponds to a MIDI channel on a given MIDI device.

This should be configurable, but a list of sensible defaults would be:

State A -> MIDI channel 1
State B -> MIDI channel 2
State C -> MIDI channel 3
State D -> MIDI channel 4
State E 

### Default MIDI device

Choose the device that has the text "RYTM" or "Rytm" in its name.

### Default MIDI note

Always play MIDI note "36". 


## Config

When the user types the `.config` command, the application should enter configuration mode.
In configuration mode, the application should display the current configuration and allow the user to modify it. 
The application should probably present a guided "wizard" set of steps to configure the application. 

## Appearance

If the NodeJS REPL supports colors, use the `chalk` library to color the output.


## TypeScript

The application should be written in TypeScript.


## Vitest

The application should use Vitest for testing.

## Node.js

The application should be written in Node.js.

