import { useState } from 'react';
import { useSequencer } from './hooks/useSequencer';
import KnobGrid from './components/KnobGrid';
import Controls from './components/Controls';
import type { ClientMessage } from './types';

export default function App() {
  const { chains, connected, sendMessage } = useSequencer();
  const [activeChainId, setActiveChainId] = useState<string | null>(null);

  // Default to first chain once loaded
  const activeChain =
    chains.find((c) => c.chainId === activeChainId) ?? chains[0] ?? null;

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

      {/* Tab bar — one tab per chain */}
      {chains.length > 1 && (
        <div className="tab-bar">
          {chains.map((c) => (
            <button
              key={c.chainId}
              className={`tab ${activeChain?.chainId === c.chainId ? 'tab--active' : ''}`}
              onClick={() => setActiveChainId(c.chainId)}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Main content */}
      {activeChain ? (
        <main className="app-main">
          <Controls chain={activeChain} onMessage={handleMessage} />
          <KnobGrid chain={activeChain} onMessage={handleMessage} />
        </main>
      ) : (
        <div className="loading">
          {connected ? 'Loading state…' : 'Connecting to server…'}
        </div>
      )}
    </div>
  );
}
