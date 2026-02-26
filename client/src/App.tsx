import { useState } from 'react';
import { useSequencer } from './hooks/useSequencer';
import KnobGrid from './components/KnobGrid';
import Controls from './components/Controls';
import DrumsControls from './components/DrumsControls';
import AnchorPanel from './components/AnchorPanel';
import type { ClientMessage } from './types';

type Tab = 'drums' | 'anchor';

export default function App() {
  const { chains, anchor, connected, sendMessage } = useSequencer();
  const [activeTab, setActiveTab] = useState<Tab>('drums');

  // v2 ships with a single chain; use the first one
  const chain = chains[0] ?? null;

  const handleMessage = (msg: ClientMessage) => sendMessage(msg);

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <h1 className="app-title">mark-chain</h1>
        <div className={`connection-badge ${connected ? 'connected' : 'disconnected'}`}>
          {connected ? '● connected' : '○ connecting…'}
        </div>
      </header>

      {/* Global controls — always visible */}
      {chain ? (
        <Controls chain={chain} onMessage={handleMessage} />
      ) : (
        <div className="loading">{connected ? 'Loading…' : 'Connecting to server…'}</div>
      )}

      {/* Tab bar */}
      <div className="tab-bar">
        <button
          className={`tab ${activeTab === 'drums' ? 'tab--active' : ''}`}
          onClick={() => setActiveTab('drums')}
        >
          Drums
        </button>
        <button
          className={`tab ${activeTab === 'anchor' ? 'tab--active' : ''}`}
          onClick={() => setActiveTab('anchor')}
        >
          Anchor
        </button>
      </div>

      {/* Tab content */}
      <main className="app-main">
        {activeTab === 'drums' && chain && (
          <>
            <DrumsControls chain={chain} onMessage={handleMessage} />
            <KnobGrid chain={chain} onMessage={handleMessage} />
          </>
        )}

        {activeTab === 'anchor' && (
          anchor
            ? <AnchorPanel anchor={anchor} onMessage={handleMessage} />
            : <div className="loading">Loading anchor…</div>
        )}
      </main>
    </div>
  );
}
