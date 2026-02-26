import { describe, expect, it, vi } from 'vitest';
import { OscForwarder, buildOscAddress, mapDrumChannelToOscName, normalizeOscRootAddress } from './OscForwarder.js';

describe('OSC address helpers', () => {
    it('normalizes root address', () => {
        expect(normalizeOscRootAddress('mark')).toBe('/mark');
        expect(normalizeOscRootAddress('/mark/')).toBe('/mark');
        expect(normalizeOscRootAddress('///mark//sub//')).toBe('/mark/sub');
        expect(buildOscAddress('/mark/', 'kick1')).toBe('/mark/kick1');
    });

    it('maps drum channels to OSC names', () => {
        expect(mapDrumChannelToOscName(3)).toBe('kick1');
        expect(mapDrumChannelToOscName(4)).toBe('snare1');
        expect(mapDrumChannelToOscName(1)).toBe('kick2');
        expect(mapDrumChannelToOscName(2)).toBe('snare2');
        expect(mapDrumChannelToOscName(7)).toBe('perc1');
        expect(mapDrumChannelToOscName(8)).toBe('perc2');
        expect(mapDrumChannelToOscName(5)).toBe('perc3');
        expect(mapDrumChannelToOscName(6)).toBe('perc4');
        expect(mapDrumChannelToOscName(16)).toBeNull();
    });
});

describe('OscForwarder', () => {
    it('defaults drum MIDI device to first rytm match', () => {
        const forwarder = new OscForwarder({
            onDebugEvent: () => { },
            getAvailableMidiDevices: () => ['foo', 'Analog Rytm MKII', 'bar'],
            sendPacket: async () => { },
        });
        forwarder.hydrateDefaults();
        expect(forwarder.getConfig().drumMidiDevice).toBe('Analog Rytm MKII');
    });

    it('skips and logs when selected drum device is unavailable', async () => {
        const debug: string[] = [];
        const sendPacket = vi.fn(async () => { });
        const forwarder = new OscForwarder({
            onDebugEvent: (event) => debug.push(`${event.status}:${event.reason ?? ''}`),
            getAvailableMidiDevices: () => ['Some Other Device'],
            sendPacket,
        });
        forwarder.setConfig({
            enabled: true,
            host: '127.0.0.1',
            port: 9000,
            drumMidiDevice: 'RYTM Device',
        });

        await forwarder.forwardDrum({ deviceName: 'RYTM Device', channel: 3 });

        expect(sendPacket).not.toHaveBeenCalled();
        expect(debug[0]).toContain('skipped');
        expect(debug[0]).toContain('unavailable');
    });

    it('sends OSC on mapped drum channel and stab triggers', async () => {
        const packets: Array<{ address: string; host: string; port: number; intArg: number }> = [];
        const forwarder = new OscForwarder({
            onDebugEvent: () => { },
            getAvailableMidiDevices: () => ['RYTM Device'],
            sendPacket: async (packet) => { packets.push(packet); },
        });
        forwarder.setConfig({
            enabled: true,
            rootAddress: '/mark',
            host: '127.0.0.1',
            port: 9000,
            drumMidiDevice: 'RYTM Device',
        });

        await forwarder.forwardDrum({ deviceName: 'RYTM Device', channel: 3 });
        await forwarder.forwardStab(1);

        expect(packets.map((p) => p.address)).toEqual(['/mark/kick1', '/mark/stab2']);
        expect(packets.every((p) => p.intArg === 1)).toBe(true);
    });
});
