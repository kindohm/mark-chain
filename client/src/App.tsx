import { useState } from 'react';
import { useSequencer } from './hooks/useSequencer';
import KnobGrid from './components/KnobGrid';
import Controls from './components/Controls';
import AnchorPanel from './components/AnchorPanel';
import StabPanel from './components/StabPanel';
import LayerPanel from './components/LayerPanel';
import Presets from './components/Presets';
import type { ClientMessage } from './types';

type Tab = 'drums' | 'anchor' | 'stab1' | 'stab2' | 'layer1' | 'layer2';

export default function App() {
  const { chains, anchor, stabs, layers, connected, sendMessage } = useSequencer();
  const [activeTab, setActiveTab] = useState<Tab>('drums');

  const chain = chains[0] ?? null;
  const stab0 = stabs.find(s => s.stabId === 0) ?? null;
  const stab1 = stabs.find(s => s.stabId === 1) ?? null;
  const layer0 = layers.find(l => l.layerId === 0) ?? null;
  const layer1 = layers.find(l => l.layerId === 1) ?? null;

  const handleMessage = (msg: ClientMessage) => sendMessage(msg);

  const TABS: { id: Tab; label: string }[] = [
    { id: 'drums', label: 'Drums' },
    { id: 'anchor', label: 'Anchor' },
    { id: 'stab1', label: 'Stab 1' },
    { id: 'stab2', label: 'Stab 2' },
    { id: 'layer1', label: 'Layer 1' },
    { id: 'layer2', label: 'Layer 2' },
  ];

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">mark-chain</h1>
        <div className={`connection-badge ${connected ? 'connected' : 'disconnected'}`}>
          {connected ? '● connected' : '○ connecting…'}
        </div>
      </header>

      {/* Tab bar — full width, above the two-column body */}
      <div className="tab-bar">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tab ${activeTab === t.id ? 'tab--active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Two-column body: left = tab content, right = global controls */}
      <div className="app-body">
        <main className="app-main">
          {activeTab === 'drums' && chain && (
            <KnobGrid chain={chain} onMessage={handleMessage} />
          )}
          {activeTab === 'anchor' && (
            anchor
              ? <AnchorPanel anchor={anchor} onMessage={handleMessage} />
              : <div className="loading">Loading anchor…</div>
          )}
          {activeTab === 'stab1' && (
            stab0
              ? <StabPanel stab={stab0} chain={chain} onMessage={handleMessage} />
              : <div className="loading">Loading stab 1…</div>
          )}
          {activeTab === 'stab2' && (
            stab1
              ? <StabPanel stab={stab1} chain={chain} onMessage={handleMessage} />
              : <div className="loading">Loading stab 2…</div>
          )}
          {activeTab === 'layer1' && (
            layer0
              ? <LayerPanel layer={layer0} onMessage={handleMessage} />
              : <div className="loading">Loading layer 1…</div>
          )}
          {activeTab === 'layer2' && (
            layer1
              ? <LayerPanel layer={layer1} onMessage={handleMessage} />
              : <div className="loading">Loading layer 2…</div>
          )}
        </main>

        <aside className="app-right">
          {chain
            ? <Controls chain={chain} onMessage={handleMessage} />
            : <div className="loading">{connected ? 'Loading…' : 'Connecting…'}</div>
          }
          <Presets
            chain={chain}
            anchor={anchor}
            stabs={stabs}
            layers={layers}
            sendMessage={sendMessage}
          />
        </aside>
      </div>
    </div>
  );
}
