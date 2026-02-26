import dgram from 'node:dgram';

export interface OscConfig {
    enabled: boolean;
    rootAddress: string;
    host: string;
    port: number;
    drumMidiDevice: string;
}

export type OscDebugSource = 'drums' | 'stab1' | 'stab2';
export type OscDebugStatus = 'sent' | 'skipped' | 'error';

export interface OscDebugEvent {
    id: number;
    timestamp: number;
    source: OscDebugSource;
    address: string;
    args: number[];
    status: OscDebugStatus;
    reason?: string;
    midiDevice?: string;
    channel?: number;
}

interface SendOscPacket {
    host: string;
    port: number;
    address: string;
    intArg: number;
}

export interface DrumTrigger {
    deviceName: string;
    channel: number; // 1-indexed
}

const DEFAULT_PORT = 8000;
const DEBUG_LOG_LIMIT = 200;

const DRUM_CHANNEL_TO_NAME: Record<number, 'kick1' | 'kick2' | 'snare1' | 'snare2' | 'perc1' | 'perc2' | 'perc3' | 'perc4'> = {
    3: 'kick1',
    4: 'snare1',
    1: 'kick2',
    2: 'snare2',
    7: 'perc1',
    8: 'perc2',
    5: 'perc3',
    6: 'perc4',
};

export function normalizeOscRootAddress(input: string): string {
    const trimmed = (input ?? '').trim();
    if (!trimmed) return '/mark';
    const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    const collapsed = withLeading.replace(/\/+/g, '/');
    const noTrailing = collapsed.length > 1 ? collapsed.replace(/\/+$/, '') : collapsed;
    return noTrailing || '/mark';
}

export function buildOscAddress(rootAddress: string, leaf: string): string {
    return `${normalizeOscRootAddress(rootAddress)}/${leaf}`;
}

export function mapDrumChannelToOscName(channel: number): string | null {
    return DRUM_CHANNEL_TO_NAME[channel] ?? null;
}

function pad4(buf: Buffer): Buffer {
    const padLen = (4 - (buf.length % 4)) % 4;
    if (padLen === 0) return buf;
    return Buffer.concat([buf, Buffer.alloc(padLen)]);
}

function oscString(value: string): Buffer {
    return pad4(Buffer.from(`${value}\0`, 'utf8'));
}

function oscInt32(value: number): Buffer {
    const buf = Buffer.alloc(4);
    buf.writeInt32BE(Math.trunc(value), 0);
    return buf;
}

export function encodeOscIntMessage(address: string, intArg: number): Buffer {
    return Buffer.concat([
        oscString(address),
        oscString(',i'),
        oscInt32(intArg),
    ]);
}

export class OscForwarder {
    private config: OscConfig = {
        enabled: false,
        rootAddress: '/mark',
        host: '',
        port: DEFAULT_PORT,
        drumMidiDevice: '',
    };
    private debugLog: OscDebugEvent[] = [];
    private debugId = 0;
    private readonly socket = dgram.createSocket('udp4');
    private readonly onDebugEvent: (event: OscDebugEvent) => void;
    private readonly getAvailableMidiDevices: () => string[];
    private readonly sendPacket: (packet: SendOscPacket) => Promise<void>;

    constructor(opts: {
        onDebugEvent: (event: OscDebugEvent) => void;
        getAvailableMidiDevices: () => string[];
        sendPacket?: (packet: SendOscPacket) => Promise<void>;
    }) {
        this.onDebugEvent = opts.onDebugEvent;
        this.getAvailableMidiDevices = opts.getAvailableMidiDevices;
        this.sendPacket = opts.sendPacket ?? ((packet) => this.sendUdpPacket(packet));
    }

    getConfig(): OscConfig {
        return { ...this.config };
    }

    getDebugLog(): OscDebugEvent[] {
        return [...this.debugLog];
    }

    setConfig(next: Partial<OscConfig>): OscConfig {
        const merged = { ...this.config, ...next };
        const parsedPort = Number(merged.port);
        this.config = {
            enabled: Boolean(merged.enabled),
            rootAddress: normalizeOscRootAddress(merged.rootAddress),
            host: (merged.host ?? '').trim(),
            port: Number.isFinite(parsedPort) ? Math.max(1, Math.min(65535, Math.round(parsedPort))) : DEFAULT_PORT,
            drumMidiDevice: (merged.drumMidiDevice ?? '').trim(),
        };

        if (!this.config.drumMidiDevice) {
            this.config.drumMidiDevice = this.pickDefaultDrumMidiDevice();
        }

        return this.getConfig();
    }

    hydrateDefaults(): OscConfig {
        return this.setConfig({});
    }

    async forwardStab(stabId: number): Promise<void> {
        const leaf = stabId === 0 ? 'stab1' : stabId === 1 ? 'stab2' : null;
        if (!leaf) return;
        await this.forward({
            source: leaf as OscDebugSource,
            leaf,
        });
    }

    async forwardDrum(trigger: DrumTrigger): Promise<void> {
        const selectedDevice = this.config.drumMidiDevice;
        if (!selectedDevice) {
            this.pushDebug({
                source: 'drums',
                address: buildOscAddress(this.config.rootAddress, 'drums'),
                args: [1],
                status: 'skipped',
                reason: 'No drum MIDI device selected',
                midiDevice: trigger.deviceName,
                channel: trigger.channel,
            });
            return;
        }

        const available = this.getAvailableMidiDevices();
        if (!available.includes(selectedDevice)) {
            this.pushDebug({
                source: 'drums',
                address: buildOscAddress(this.config.rootAddress, 'drums'),
                args: [1],
                status: 'skipped',
                reason: `Selected drum MIDI device unavailable: ${selectedDevice}`,
                midiDevice: trigger.deviceName,
                channel: trigger.channel,
            });
            return;
        }

        if (trigger.deviceName !== selectedDevice) return;

        const leaf = mapDrumChannelToOscName(trigger.channel);
        if (!leaf) return;

        await this.forward({
            source: 'drums',
            leaf,
            midiDevice: trigger.deviceName,
            channel: trigger.channel,
        });
    }

    private pickDefaultDrumMidiDevice(): string {
        const available = this.getAvailableMidiDevices();
        return available.find((name) => name.toLowerCase().includes('rytm')) ?? available[0] ?? '';
    }

    private async forward(params: {
        source: OscDebugSource;
        leaf: string;
        midiDevice?: string;
        channel?: number;
    }): Promise<void> {
        const address = buildOscAddress(this.config.rootAddress, params.leaf);
        const args = [1];

        if (!this.config.enabled) {
            this.pushDebug({
                source: params.source,
                address,
                args,
                status: 'skipped',
                reason: 'OSC disabled',
                midiDevice: params.midiDevice,
                channel: params.channel,
            });
            return;
        }

        if (!this.config.host || !this.config.port) {
            this.pushDebug({
                source: params.source,
                address,
                args,
                status: 'skipped',
                reason: 'OSC destination host/port not configured',
                midiDevice: params.midiDevice,
                channel: params.channel,
            });
            return;
        }

        try {
            await this.sendPacket({
                host: this.config.host,
                port: this.config.port,
                address,
                intArg: 1,
            });
            this.pushDebug({
                source: params.source,
                address,
                args,
                status: 'sent',
                midiDevice: params.midiDevice,
                channel: params.channel,
            });
        } catch (err) {
            this.pushDebug({
                source: params.source,
                address,
                args,
                status: 'error',
                reason: err instanceof Error ? err.message : String(err),
                midiDevice: params.midiDevice,
                channel: params.channel,
            });
        }
    }

    private sendUdpPacket(packet: SendOscPacket): Promise<void> {
        const buffer = encodeOscIntMessage(packet.address, packet.intArg);
        return new Promise((resolve, reject) => {
            this.socket.send(buffer, packet.port, packet.host, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    private pushDebug(event: Omit<OscDebugEvent, 'id' | 'timestamp'>): void {
        const full: OscDebugEvent = {
            ...event,
            id: ++this.debugId,
            timestamp: Date.now(),
        };
        this.debugLog = [...this.debugLog, full].slice(-DEBUG_LOG_LIMIT);
        this.onDebugEvent(full);
    }
}
