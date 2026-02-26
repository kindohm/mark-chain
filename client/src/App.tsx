import { useState } from 'react';
import { useSequencer } from './hooks/useSequencer';
import KnobGrid from './components/KnobGrid';
import Controls from './components/Controls';
import AnchorPanel from './components/AnchorPanel';
import StabPanel from './components/StabPanel';
import type { ClientMessage } from './types';

type Tab = 'drums' | 'anchor' | 'stab1' | 'stab2';

export default function App() {
  const { chains, anchor, stabs, connected, sendMessage } = useSequencer();
  const [activeTab, setActiveTab] = useState<Tab>('drums');

  const chain = chains[0] ?? null;
  const stab0 = stabs.find(s => s.stabId === 0) ?? null;
  const stab1 = stabs.find(s => s.stabId === 1) ?? null;

  const handleMessage = (msg: ClientMessage) => sendMessage(msg);

  const TABS: { id: Tab; label: string }[] = [
    { id: 'drums', label: 'Drums' },
    { id: 'anchor', label: 'Anchor' },
    { id: 'stab1', label: 'Stab 1' },
    { id: 'stab2', label: 'Stab 2' },
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
        </main>

        <aside className="app-right">
          {chain
            ? <Controls chain={chain} onMessage={handleMessage} />
            : <div className="loading">{connected ? 'Loading…' : 'Connecting…'}</div>
          }
        </aside>
      </div>
    </div>
  );
}
