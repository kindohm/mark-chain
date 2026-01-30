# mark-chain

A Markov chain MIDI sequencer with a terminal UI built using Ink (React for terminals).

## Features

- **Markov Chain Sequencing**: Probabilistic state transitions for generative MIDI patterns
- **Terminal UI**: Beautiful, keyboard-driven interface built with Ink
- **Configurable States**: Support for 2-16 states (default: 4)
- **Rest State**: Last state produces rests (no MIDI output) for rhythmic variation
- **Row Operations**: Sharpen, flatten, rotate, leak, and randomize probability distributions
- **Real-time Control**: Adjust probabilities and sequencer parameters on the fly
- **MIDI Output**: Automatic device detection (prioritizes Elektron Analog Rytm)

## Installation

```bash
npm install
```

## Usage

### Basic Usage

```bash
npm run dev
```

### With Options

```bash
# 8 states at 140 BPM
npm run dev -- --states 8 --bpm 140

# Show help
npm run dev -- --help
```

### Command Line Options

- `-s, --states <number>`: Number of states (2-16, default: 4)
- `-b, --bpm <number>`: Tempo in BPM (30-300, default: 120)
- `-h, --help`: Show help message

## Keyboard Controls

### Navigation
- `1-9, 0`: Select state (A-J)
- `Tab`: Cycle focus between UI sections
- `↑↓`: Navigate targets (when focused on target list)

### Editing Probabilities
- `←→`: Adjust probability (when focused on target list)
- `Shift+←→`: Fine adjust probability

### Row Operations
- `[`: Flatten row (move toward uniform distribution)
- `]`: Sharpen row (concentrate probability)
- `,`: Rotate row left
- `.`: Rotate row right
- `L`: Toggle lock diagonal (self-transition)
- `R`: Reset row to uniform distribution
- `X`: Randomize row

### Sequencer
- `Space`: Start/Stop sequencer
- `+/-`: Adjust BPM (±10)

### Global
- `Ctrl+C`: Quit

## How It Works

### Markov Chain

The application maintains a transition matrix where each state has a probability distribution over all possible next states. For example, with 4 states (A, B, C, D):

```
    A    B    C    D
    ---- ---- ---- ----
A | 0.00 0.50 0.30 0.20
B | 0.20 0.00 0.60 0.20
C | 0.30 0.30 0.00 0.40
D | 1.00 0.00 0.00 0.00  (rest state)
```

Each row must sum to 1.0. When the sequencer is running, it transitions between states based on these probabilities.

### Rest State

The last state (e.g., State D in a 4-state system) is a **rest state** that produces no MIDI output. This allows for rhythmic variation and silence in your sequences.

### MIDI Mapping

- States 0 to N-2 map to MIDI channels 0 to N-2
- All states play MIDI note 36 (C1) by default
- The last state (N-1) produces rests (no MIDI output)
- Default device: Looks for "RYTM" or "Rytm" in device name

## Development

### Run Tests

```bash
npm test
```

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

## Project Structure

```
src/
├── matrix/           # Matrix operations and state management
│   ├── types.ts      # Type definitions
│   ├── utils.ts      # Utility functions (normalize, entropy, etc.)
│   ├── operations.ts # Row operations (sharpen, flatten, rotate, etc.)
│   └── engine.ts     # Matrix state management
├── midi/             # MIDI integration
│   ├── types.ts      # MIDI types and mapping
│   └── manager.ts    # MIDI device management
├── sequencer/        # Sequencer engine
│   ├── types.ts      # Sequencer types
│   └── engine.ts     # Markov chain sequencer
├── ui/               # Terminal UI components
│   ├── components/   # React components
│   ├── styles/       # Color scheme
│   ├── types.ts      # UI types
│   └── App.tsx       # Main app component
└── index.tsx         # Entry point
```

## Technologies

- **Node.js** + **TypeScript**
- **Ink** (React for terminals)
- **easymidi** (MIDI library)
- **Vitest** (testing)
- **ESLint** (linting)

## License

MIT
