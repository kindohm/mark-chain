/**
 * StabInstance — linear on/off step sequencer
 *
 * Normal mode: fires MIDI notes for "on" steps at the configured division rate.
 * Mirror mode: can fire a normal note-on or a zero-velocity note when the Drum
 * Markov chain enters configured states.
 *
 * The internal 16th-note timer is controlled by global start/stop.
 */

import { DeviceRegistry } from "../midi/DeviceRegistry.js";
import type { ServerMessage } from "../protocol.js";

const DEFAULT_NOTE = 60;
const DEFAULT_VELOCITY = 100;
const MIRROR_OFF_VELOCITY = 5;
const DEFAULT_DURATION_MS = 100;
const DEFAULT_XY_VALUE = 64;
const DEFAULT_CC3_VALUE = 64;
const DEFAULT_CC4_VALUE = 64;
const MAX_STEPS = 32;
const STAB_CONTROL_MIDI_DEVICE = "IAC Driver Bus 5";
const STAB_CONTROL_MIDI_CHANNEL = 1;
const STAB_CONTROL_CC_MAP = [
  { x: 100, y: 101, z: 102, z2: 106 }, // Stab 1 (id 0)
  { x: 103, y: 104, z: 105, z2: 107 }, // Stab 2 (id 1)
] as const;

export class StabInstance {
  readonly id: number; // 0 = Stab 1, 1 = Stab 2

  private bpm: number;
  private isEnabled: boolean = false;
  private steps: boolean[];
  private numSteps: number = 16;
  private division: number = 1; // advance pattern every N 16th notes
  private midiDevice: string;
  private channel: number = 1;
  private midiNote: number = DEFAULT_NOTE;

  // Mirror mode — fire when drum chain hits the selected state
  private mirrorEnabled: boolean = false;
  private mirrorState: number = 0;
  private mirrorOffEnabled: boolean = false;
  private mirrorOffState: number = 0;
  private x: number = DEFAULT_XY_VALUE;
  private y: number = DEFAULT_XY_VALUE;
  private cc3: number = DEFAULT_CC3_VALUE;
  private cc4: number = DEFAULT_CC4_VALUE;

  // Timer state
  private timerRunning: boolean = false;
  private tickCount: number = 0; // 16th-note ticks since start/reset
  private currentStep: number = 0; // current position in the pattern

  private registry: DeviceRegistry;
  private onStep: (() => void) | null = null;
  private onNoteFired: ((stabId: number) => void) | null = null;

  constructor(id: number, bpm: number, registry: DeviceRegistry) {
    this.id = id;
    this.bpm = bpm;
    this.steps = Array(MAX_STEPS).fill(false);
    this.midiDevice = registry.findDefaultDevice() ?? "";
    this.registry = registry;
  }

  // ── Timer control ────────────────────────────────────────────────────────

  resume(): void {
    if (this.timerRunning) return;
    this.timerRunning = true;
  }

  pause(): void {
    this.timerRunning = false;
  }

  // ── Configuration ─────────────────────────────────────────────────────────

  setEnabled(isEnabled: boolean): void {
    this.isEnabled = isEnabled;
  }

  setBpm(bpm: number): void {
    this.bpm = bpm;
  } // takes effect on next tick

  setStep(stepIndex: number, on: boolean): void {
    if (stepIndex >= 0 && stepIndex < MAX_STEPS) this.steps[stepIndex] = on;
  }

  setNumSteps(n: number): void {
    this.numSteps = Math.max(1, Math.min(MAX_STEPS, Math.round(n)));
    if (this.currentStep >= this.numSteps) this.currentStep = 0;
  }

  setDivision(division: number): void {
    this.division = Math.max(1, Math.min(16, Math.round(division)));
  }

  setMidi(config: { midiDevice?: string; channel?: number }): void {
    if (config.midiDevice !== undefined) this.midiDevice = config.midiDevice;
    if (config.channel !== undefined) {
      this.channel = Math.max(1, Math.min(16, Math.round(config.channel)));
    }
  }

  setNote(midiNote: number): void {
    this.midiNote = Math.max(0, Math.min(127, Math.round(midiNote)));
  }

  setMirror(enabled: boolean, state?: number): void {
    this.mirrorEnabled = enabled;
    if (state !== undefined) this.mirrorState = Math.max(0, Math.min(7, state));
  }

  setMirrorOff(enabled: boolean, state?: number): void {
    this.mirrorOffEnabled = enabled;
    if (state !== undefined)
      this.mirrorOffState = Math.max(0, Math.min(7, state));
  }

  setXY(config: { x?: number; y?: number }): void {
    let xChanged = false;
    let yChanged = false;

    if (config.x !== undefined) {
      const nextX = Math.max(0, Math.min(127, Math.round(config.x)));
      if (nextX !== this.x) {
        this.x = nextX;
        xChanged = true;
      }
    }

    if (config.y !== undefined) {
      const nextY = Math.max(0, Math.min(127, Math.round(config.y)));
      if (nextY !== this.y) {
        this.y = nextY;
        yChanged = true;
      }
    }

    const controlDevice = STAB_CONTROL_MIDI_DEVICE;
    const controlCc = this.getControlCcMap();
    if (xChanged)
      this.registry.sendControlChange(
        controlDevice,
        STAB_CONTROL_MIDI_CHANNEL,
        controlCc.x,
        this.x,
      );
    if (yChanged)
      this.registry.sendControlChange(
        controlDevice,
        STAB_CONTROL_MIDI_CHANNEL,
        controlCc.y,
        this.y,
      );
  }

  setCC3(value: number): void {
    const next = Math.max(0, Math.min(127, Math.round(value)));
    if (next === this.cc3) return;
    this.cc3 = next;

    const controlDevice = STAB_CONTROL_MIDI_DEVICE;
    const controlCc = this.getControlCcMap();
    this.registry.sendControlChange(
      controlDevice,
      STAB_CONTROL_MIDI_CHANNEL,
      controlCc.z,
      this.cc3,
    );
  }

  setCC4(value: number): void {
    const next = Math.max(0, Math.min(127, Math.round(value)));
    if (next === this.cc4) return;
    this.cc4 = next;

    const controlDevice = STAB_CONTROL_MIDI_DEVICE;
    const controlCc = this.getControlCcMap();
    this.registry.sendControlChange(
      controlDevice,
      STAB_CONTROL_MIDI_CHANNEL,
      controlCc.z2,
      this.cc4,
    );
  }

  // ── Mirror trigger — called by server when Markov chain transitions ───────

  onDrumStep(toState: number): void {
    if (!this.isEnabled) return;
    if (this.mirrorEnabled && toState === this.mirrorState) this.fireNote();
    if (this.mirrorOffEnabled && toState === this.mirrorOffState)
      this.fireNote(MIRROR_OFF_VELOCITY, false);
  }

  // ── Broadcast hook ────────────────────────────────────────────────────────

  onStepEvent(cb: () => void): void {
    this.onStep = cb;
  }

  onNoteFiredEvent(cb: (stabId: number) => void): void {
    this.onNoteFired = cb;
  }

  toUpdateMessage(): ServerMessage {
    return {
      type: "stab_update",
      stabId: this.id,
      isEnabled: this.isEnabled,
      steps: [...this.steps],
      numSteps: this.numSteps,
      division: this.division,
      midiDevice: this.midiDevice,
      channel: this.channel,
      midiNote: this.midiNote,
      midiDevices: ["rest", ...this.registry.getAvailableDevices()],
      currentStep: this.currentStep,
      mirrorEnabled: this.mirrorEnabled,
      mirrorState: this.mirrorState,
      mirrorOffEnabled: this.mirrorOffEnabled,
      mirrorOffState: this.mirrorOffState,
      x: this.x,
      y: this.y,
      cc3: this.cc3,
      cc4: this.cc4,
    };
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private tick(): void {
    if (!this.timerRunning) return;
    this.tickCount++;

    // Advance the pattern step every `division` 16th-note ticks
    if (this.tickCount % this.division === 0) {
      this.currentStep = (this.currentStep + 1) % this.numSteps;

      // Fire note if: enabled, not in mirror mode, and this step is on
      if (
        this.isEnabled &&
        !this.mirrorEnabled &&
        this.steps[this.currentStep]
      ) {
        this.fireNote();
      }
    }

    if (this.onStep) this.onStep();
  }

  private fireNote(
    velocity: number = DEFAULT_VELOCITY,
    emitTrigger: boolean = true,
  ): void {
    if (!this.midiDevice || this.midiDevice === "rest") return;
    this.registry.sendNote(
      this.midiDevice,
      this.channel,
      this.midiNote,
      Math.max(0, Math.min(127, Math.round(velocity))),
      DEFAULT_DURATION_MS,
    );
    if (emitTrigger && this.onNoteFired) this.onNoteFired(this.id);
  }

  tick16th(): void {
    this.tick();
  }

  private getControlCcMap(): (typeof STAB_CONTROL_CC_MAP)[number] {
    return STAB_CONTROL_CC_MAP[this.id] ?? STAB_CONTROL_CC_MAP[0];
  }
}
