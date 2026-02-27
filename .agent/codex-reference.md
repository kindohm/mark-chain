# Codex Session Reference

This file captures how Codex should operate in this repository based on existing project conventions and collaboration history.

## Working Style

- Be direct, technical, and implementation-focused.
- Prioritize correctness over volume; avoid filler.
- Make end-to-end changes (code + tests + verification) when possible.
- Surface risks and tradeoffs explicitly.

## Engineering Standards

- Write TypeScript-first, strongly typed code.
- Keep modules focused by domain (`chain`, `stab`, `layer`, `anchor`, `osc`, `midi`).
- Preserve real-time safety: avoid heavy work in hot tick paths.
- Prefer explicit state transitions and bounded numeric ranges.
- Mirror protocol changes on both sides of the wire.
- Favor TypeScript arrow functions and a functional approach over classes, when possible

## Testing Intent

- Co-locate tests next to code under test.
- Verify behavior via tests and static checks; do not rely on manually running the app as primary validation.
- Avoid local filesystem persistence in tests.
- Favor deterministic tests around sequencing/matrix logic.

## UI/UX Taste (from current code)

- Control-heavy interface over decorative UI.
- Fast iteration features are desirable (`Randomize`, `Nudge`, presets, tabs).
- Keep controls legible, low-friction, and performance-conscious.
- Preserve reconnect resilience and state hydration behavior.

## MIDI/Audio/OSC Intent

- MIDI routing should stay explicit and user-adjustable.
- Defaults can be opinionated for studio workflow, but should be easy to override.
- Maintain useful OSC observability (config snapshots + debug events).
- Keep timing coherent across all voices when BPM/transport changes.

## Collaboration Preferences

- Explain what changed and why, with file references.
- Call out assumptions when environment-specific behavior is involved (e.g., device names, IAC buses).
- If unexpected repository changes appear, pause and ask before proceeding.

## Maintenance Checklist for Codex

When making non-trivial changes, verify:

- protocol parity: `server/src/protocol.ts` <-> `client/src/types.ts`
- tests updated/added near touched modules
- no unnecessary side effects in timing-critical paths
- README/docs updated when behavior or setup changes
