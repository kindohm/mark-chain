/**
 * ChainManager — loads and manages all ChainInstance objects
 */

import { ChainInstance } from './ChainInstance.js';
import { DeviceRegistry } from '../midi/DeviceRegistry.js';
import type { ChainConfig } from '../config.js';
import type { ServerMessage } from '../protocol.js';

export class ChainManager {
    private chains: Map<string, ChainInstance> = new Map();
    private registry: DeviceRegistry;

    constructor(
        configs: ChainConfig[],
        onBroadcast: (msg: ServerMessage) => void
    ) {
        this.registry = new DeviceRegistry();

        for (const cfg of configs) {
            const instance = new ChainInstance(
                cfg.id,
                cfg.name,
                cfg.bpm ?? 120,
                this.registry
            );

            instance.onStepEvent((stepMsg) => {
                onBroadcast(stepMsg);
                onBroadcast(instance.toStateUpdateMessage());
            });

            this.chains.set(cfg.id, instance);
        }
    }

    getChain(id: string): ChainInstance | undefined {
        return this.chains.get(id);
    }

    getAllChains(): ChainInstance[] {
        return [...this.chains.values()];
    }

    getRegistry(): DeviceRegistry {
        return this.registry;
    }

    getAllStateUpdates(): ServerMessage[] {
        return this.getAllChains().map((c) => c.toStateUpdateMessage());
    }
}
