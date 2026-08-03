import React, { useState } from 'react';
import { Terminal, Copy, Check, Wifi, WifiOff, ShieldAlert, Sparkles } from 'lucide-react';

export default function TunnelHelper({ tunnelUrl, setTunnelUrl, onConnectionSuccess, onConnectionError, connectionStatus }) {
  const [copiedText, setCopiedText] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(''), 2000);
  };

  const handleTestConnection = async () => {
    if (!tunnelUrl) return;
    setIsTesting(true);
    
    // Clean up URL (strip trailing slash)
    const formattedUrl = tunnelUrl.trim().replace(/\/$/, '');
    setTunnelUrl(formattedUrl);

    try {
      // Direct request to the tunnel URL
      const response = await fetch(`${formattedUrl}/api/tags`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
      }
      
      const data = await response.json();
      if (data && data.models) {
        onConnectionSuccess(data.models);
      } else {
        throw new Error('Invalid response structure from Ollama API');
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      onConnectionError(error.message);
    } finally {
      setIsTesting(false);
    }
  };

  const sshLocalhostRun = 'ssh -R 80:localhost:11434 nokey@localhost.run';
  const sshServeo = 'ssh -R 80:localhost:11434 serveo.net';
  const sshPinggy = 'ssh -p 443 -R 0:localhost:11434 qr@pinggy.io';

  return (
    <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-purple)' }} className="glow-text-purple">
          <Terminal size={22} />
          SSH Tunneling Gateway
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '6px' }}>
          Connect your local Ollama LLM to your Vercel deployment with zero local software installation.
        </p>
      </div>

      <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', padding: '12px 16px', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', gap: '12px', color: '#fca5a5' }}>
        <ShieldAlert size={28} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <strong style={{ display: 'block', marginBottom: '2px', color: '#ef4444' }}>Vercel HTTPS Requirement</strong>
          Browsers block deployed HTTPS sites (Vercel) from requesting unencrypted HTTP local ports (`http://localhost:11434`) due to Mixed Content restrictions. Exposing it via a secure SSH tunnel creates an `https://` proxy instantly.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
          Step 1: Choose a Tunneling Provider & Run Command in your Mac Terminal
        </label>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* localhost.run Card */}
          <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>1. localhost.run (Recommended)</span>
              <button 
                onClick={() => copyToClipboard(sshLocalhostRun, 'lh')} 
                className="btn-secondary" 
                style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: '4px' }}
              >
                {copiedText === 'lh' ? <Check size={12} color="var(--color-green)" /> : <Copy size={12} />}
                {copiedText === 'lh' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <code style={{ display: 'block', padding: '8px', backgroundColor: 'var(--bg-deep)', borderRadius: '6px', fontSize: '0.8rem', color: '#a78bfa', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {sshLocalhostRun}
            </code>
            <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              SSH key auth happens automatically. Look for the output `https://...lhrtunnel.link` in your terminal.
            </span>
          </div>

          {/* serveo.net Card */}
          <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>2. serveo.net (Alternative)</span>
              <button 
                onClick={() => copyToClipboard(sshServeo, 'serveo')} 
                className="btn-secondary" 
                style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: '4px' }}
              >
                {copiedText === 'serveo' ? <Check size={12} color="var(--color-green)" /> : <Copy size={12} />}
                {copiedText === 'serveo' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <code style={{ display: 'block', padding: '8px', backgroundColor: 'var(--bg-deep)', borderRadius: '6px', fontSize: '0.8rem', color: '#a78bfa', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {sshServeo}
            </code>
            <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Creates an `https://...serveo.net` link. Fast connection, no CLI download required.
            </span>
          </div>

          {/* pinggy.io Card */}
          <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>3. pinggy.io (Fast & Beautiful)</span>
              <button 
                onClick={() => copyToClipboard(sshPinggy, 'pinggy')} 
                className="btn-secondary" 
                style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: '4px' }}
              >
                {copiedText === 'pinggy' ? <Check size={12} color="var(--color-green)" /> : <Copy size={12} />}
                {copiedText === 'pinggy' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <code style={{ display: 'block', padding: '8px', backgroundColor: 'var(--bg-deep)', borderRadius: '6px', fontSize: '0.8rem', color: '#a78bfa', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {sshPinggy}
            </code>
            <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Uses Pinggy SSH reverse tunneling. Includes real-time connection telemetry outputs inside your shell terminal.
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
        <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
          Step 2: Enter Exposed SSH Tunnel URL
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input 
            type="text" 
            placeholder="e.g. https://xxxxxx.lhrtunnel.link" 
            value={tunnelUrl}
            onChange={(e) => setTunnelUrl(e.target.value)}
            style={{ fontSize: '0.9rem' }}
          />
          <button 
            onClick={handleTestConnection} 
            disabled={isTesting || !tunnelUrl}
            className="btn-primary" 
            style={{ flexShrink: 0, padding: '10px 16px', fontSize: '0.85rem' }}
          >
            {isTesting ? 'Testing...' : 'Connect'}
          </button>
        </div>

        {/* Connection Status Banner */}
        {connectionStatus.status !== 'disconnected' && (
          <div style={{ 
            marginTop: '8px', 
            padding: '10px 12px', 
            borderRadius: '6px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            fontSize: '0.8rem',
            backgroundColor: connectionStatus.status === 'connected' ? 'rgba(0, 245, 212, 0.06)' : 'rgba(239, 68, 68, 0.06)',
            border: `1px solid ${connectionStatus.status === 'connected' ? 'rgba(0, 245, 212, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
            color: connectionStatus.status === 'connected' ? 'var(--color-green)' : '#fca5a5'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {connectionStatus.status === 'connected' ? (
                <>
                  <Wifi size={14} className="pulse-active" style={{ color: 'var(--color-green)', borderRadius: '50%' }} />
                  <span>CONNECTED to Ollama! Exposing {connectionStatus.modelCount} model(s)</span>
                </>
              ) : (
                <>
                  <WifiOff size={14} />
                  <span>CONNECTION ERROR: {connectionStatus.message}</span>
                </>
              )}
            </div>
            
            {connectionStatus.status === 'connected' && (
              <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>
                <Sparkles size={10} /> Active
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
