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



### Plan for a dynamic number of states

The examples above just use four states. However, in practice there may be as many as 16 states
Plan the coding logic to be flexible for any number of states.

## Matrix editing

Matrix editing will be done using a Terminal UI. Please reference the `.agent/tui.md` file for more information.


## MIDI

The application should use an open source MIDI library to send MIDI events.

### Mapping of Matrix state to MIDI notes

Each state in the matrix corresponds to a MIDI channel on a given MIDI device.

This should be configurable, but a list of sensible defaults would be:

State A -> MIDI channel 1
State B -> MIDI channel 2
State C -> MIDI channel 3
State D -> MIDI channel 4
...
State J -> MIDI channel 10
State K -> rest / no MIDI event

### Default MIDI device

Choose the device that has the text "RYTM" or "Rytm" in its name.

### Default MIDI note

Always play MIDI note "36". 


## Aesthetics

Use colors to color the terminal UI. This could be done with the `chalk` library, 
or another library that might be more appropriate for the Ink framework.


## TypeScript

The application should be written in TypeScript.


## Vitest

The application should use Vitest for testing.

## Node.js

The application should be written in Node.js.

