import React, { useState, useEffect, useRef } from 'react';
import { Activity, Cpu, Terminal, Code, Laptop, Zap } from 'lucide-react';
import Dashboard from './components/Dashboard';
import Playground from './components/Playground';
import TunnelHelper from './components/TunnelHelper';
import IntegrationSnippets from './components/IntegrationSnippets';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Tunnel and Connection State
  const [tunnelUrl, setTunnelUrl] = useState(() => {
    return localStorage.getItem('hackdev_tunnel_url') || '';
  });
  const [models, setModels] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState(() => {
    const saved = localStorage.getItem('hackdev_connection_status');
    return saved ? JSON.parse(saved) : { status: 'disconnected', modelCount: 0, message: '' };
  });

  // Telemetry logs and aggregate metrics
  const [logs, setLogs] = useState(() => {
    const saved = localStorage.getItem('hackdev_logs');
    return saved ? JSON.parse(saved) : [];
  });
  const [metrics, setMetrics] = useState(() => {
    const saved = localStorage.getItem('hackdev_metrics');
    return saved ? JSON.parse(saved) : {
      totalRequests: 0,
      successRate: 100,
      avgLatencyMs: 0,
      avgTokensPerSec: 0,
      totalTokens: 0
    };
  });

  const [isWsConnected, setIsWsConnected] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(true); // Default to true so it looks great right away!
  
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Sync state to LocalStorage
  useEffect(() => {
    localStorage.setItem('hackdev_tunnel_url', tunnelUrl);
  }, [tunnelUrl]);

  useEffect(() => {
    localStorage.setItem('hackdev_connection_status', JSON.stringify(connectionStatus));
  }, [connectionStatus]);

  useEffect(() => {
    localStorage.setItem('hackdev_logs', JSON.stringify(logs));
  }, [logs]);

  useEffect(() => {
    localStorage.setItem('hackdev_metrics', JSON.stringify(metrics));
  }, [metrics]);

  // Connect to Local Telemetry Server via WebSocket
  useEffect(() => {
    const connectWebSocket = () => {
      console.log('Connecting to local telemetry server WebSocket...');
      
      const ws = new WebSocket('ws://localhost:5001');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket Connection Opened!');
        setIsWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          
          if (payload.type === 'init') {
            // Seed from proxy memory
            if (payload.logs && payload.logs.length > 0) {
              setLogs(payload.logs);
            }
            if (payload.metrics) {
              setMetrics(payload.metrics);
            }
            setIsDemoMode(false); // Telemetry active, disable demo data
          } else if (payload.type === 'request_logged') {
            setLogs(prev => {
              const updated = [payload.log, ...prev].slice(0, 100);
              return updated;
            });
            setMetrics(payload.metrics);
            setIsDemoMode(false);
          } else if (payload.type === 'reset') {
            setLogs([]);
            setMetrics({
              totalRequests: 0,
              successRate: 100,
              avgLatencyMs: 0,
              avgTokensPerSec: 0,
              totalTokens: 0
            });
          }
        } catch (err) {
          console.error('Error parsing WS message:', err);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket Connection Closed. Retrying in 5s...');
        setIsWsConnected(false);
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000);
      };

      ws.onerror = (err) => {
        console.error('WebSocket Error:', err);
        ws.close();
      };
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, []);

  // Proactively fetch models list if we have a saved tunnel or if local proxy is active
  useEffect(() => {
    const fetchModels = async () => {
      const baseUrl = isWsConnected ? 'http://localhost:5001' : tunnelUrl;
      if (!baseUrl) return;
      try {
        const response = await fetch(`${baseUrl}/api/tags`, {
          headers: {
            'ngrok-skip-browser-warning': 'true',
            'bypass-tunnel-reminder': 'true'
          }
        });
        if (response.ok) {
          const data = await response.json();
          if (data && data.models) {
            setModels(data.models);
            setConnectionStatus({
              status: 'connected',
              modelCount: data.models.length,
              message: ''
            });
          }
        } else {
          throw new Error(`HTTP Error ${response.status}`);
        }
      } catch (err) {
        console.log('Failed to fetch initial models:', err.message);
        // Only set error status if we tried to connect to a user-defined tunnel
        if (!isWsConnected && tunnelUrl) {
          setConnectionStatus({
            status: 'error',
            modelCount: 0,
            message: err.message
          });
        }
      }
    };
    fetchModels();
  }, [tunnelUrl, isWsConnected]);

  // Handlers for Local Standalone Mode Logging (when proxy server is off)
  const handleNewLocalLog = (newLog) => {
    setLogs(prevLogs => {
      const updatedLogs = [newLog, ...prevLogs].slice(0, 100);
      
      // Re-calculate local metrics
      const successfulLogs = updatedLogs.filter(l => l.success);
      const totalRequests = updatedLogs.length;
      const successRate = totalRequests > 0 
        ? Math.round((successfulLogs.length / totalRequests) * 1000) / 10 
        : 100;
      
      const totalLatency = successfulLogs.reduce((sum, l) => sum + l.latencyMs, 0);
      const avgLatencyMs = successfulLogs.length > 0 ? Math.round(totalLatency / successfulLogs.length) : 0;

      const totalTokens = successfulLogs.reduce((sum, l) => sum + l.totalTokens, 0);
      
      const logsWithSpeed = successfulLogs.filter(l => l.tokensPerSec > 0);
      const totalSpeed = logsWithSpeed.reduce((sum, l) => sum + l.tokensPerSec, 0);
      const avgTokensPerSec = logsWithSpeed.length > 0 
        ? Math.round((totalSpeed / logsWithSpeed.length) * 10) / 10 
        : 0;

      setMetrics({
        totalRequests,
        successRate,
        avgLatencyMs,
        avgTokensPerSec,
        totalTokens
      });

      return updatedLogs;
    });

    setIsDemoMode(false); // Turn off demo data when local logs arrive
  };

  const handleResetMetrics = async () => {
    // If proxy server is connected, send a reset command
    if (isWsConnected) {
      try {
        await fetch('http://localhost:5001/api/reset', { method: 'POST' });
      } catch (e) {
        console.error('Failed to reset proxy metrics server:', e);
      }
    } else {
      // Local clean up
      setLogs([]);
      setMetrics({
        totalRequests: 0,
        successRate: 100,
        avgLatencyMs: 0,
        avgTokensPerSec: 0,
        totalTokens: 0
      });
      localStorage.removeItem('hackdev_logs');
      localStorage.removeItem('hackdev_metrics');
    }
  };

  const handleConnectionSuccess = (fetchedModels) => {
    setModels(fetchedModels);
    setConnectionStatus({
      status: 'connected',
      modelCount: fetchedModels.length,
      message: ''
    });
    // Go to playground once connected
    setActiveTab('playground');
  };

  const handleConnectionError = (errorMessage) => {
    setConnectionStatus({
      status: 'error',
      modelCount: 0,
      message: errorMessage
    });
  };

  const toggleDemoMode = () => {
    setIsDemoMode(!isDemoMode);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Top Navbar */}
      <header className="glass-panel" style={{ margin: '16px 24px 0', padding: '12px 24px', borderRadius: '12px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
        
        {/* Brand Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ 
            width: '36px', 
            height: '36px', 
            borderRadius: '10px', 
            background: 'linear-gradient(135deg, var(--color-purple), var(--color-pink))', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(157, 78, 221, 0.4)'
          }}>
            <Zap size={18} color="white" />
          </div>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.5px', color: 'white' }}>
              HackDev AI <span style={{ color: 'var(--color-purple)' }}>Gateway</span>
            </h1>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '-2px' }}>
              Local LLM Telemetry & Metrics
            </span>
          </div>
        </div>

        {/* Tab Links */}
        <nav style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button 
            onClick={() => setActiveTab('dashboard')} 
            className={activeTab === 'dashboard' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '8px 16px', fontSize: '0.85rem', borderRadius: '6px' }}
          >
            <Activity size={14} /> Dashboard
          </button>
          
          <button 
            onClick={() => setActiveTab('playground')} 
            className={activeTab === 'playground' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '8px 16px', fontSize: '0.85rem', borderRadius: '6px' }}
          >
            <Cpu size={14} /> Playground
          </button>

          <button 
            onClick={() => setActiveTab('tunnel')} 
            className={activeTab === 'tunnel' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '8px 16px', fontSize: '0.85rem', borderRadius: '6px' }}
          >
            <Terminal size={14} /> SSH Tunneling
          </button>

          <button 
            onClick={() => setActiveTab('docs')} 
            className={activeTab === 'docs' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '8px 16px', fontSize: '0.85rem', borderRadius: '6px' }}
          >
            <Code size={14} /> Integration API
          </button>
        </nav>

        {/* Local Ollama Status Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ 
              width: '6px', 
              height: '6px', 
              borderRadius: '50%', 
              backgroundColor: connectionStatus.status === 'connected' ? 'var(--color-green)' : 'var(--text-muted)'
            }} className={connectionStatus.status === 'connected' ? 'pulse-active' : ''} />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Ollama Link: {connectionStatus.status === 'connected' ? 'ACTIVE' : 'OFFLINE'}
            </span>
          </div>
          {connectionStatus.status === 'connected' && (
            <span className="badge badge-purple" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
              {models.length} Models
            </span>
          )}
        </div>
      </header>

      {/* Main Body Grid */}
      <main style={{ flex: 1 }}>
        <div className="dashboard-grid">
          
          {/* Main Workspace Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {activeTab === 'dashboard' && (
              <Dashboard 
                logs={logs} 
                metrics={metrics} 
                isWsConnected={isWsConnected}
                onResetMetrics={handleResetMetrics}
                toggleDemoMode={toggleDemoMode}
                isDemoMode={isDemoMode}
              />
            )}
            
            {activeTab === 'playground' && (
              <Playground 
                tunnelUrl={tunnelUrl} 
                models={models} 
                isWsConnected={isWsConnected}
                onNewLocalLog={handleNewLocalLog}
              />
            )}

            {activeTab === 'tunnel' && (
              <TunnelHelper 
                tunnelUrl={tunnelUrl} 
                setTunnelUrl={setTunnelUrl}
                onConnectionSuccess={handleConnectionSuccess}
                onConnectionError={handleConnectionError}
                connectionStatus={connectionStatus}
              />
            )}

            {activeTab === 'docs' && (
              <IntegrationSnippets />
            )}
          </div>

          {/* Quick Stats / Info Sidebar Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Project Tunnel Info Panel */}
            <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Laptop size={16} style={{ color: 'var(--color-purple)' }} />
                Gateway Target Info
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Local Endpoint:</span>
                  <code style={{ color: 'var(--text-primary)' }}>http://localhost:11434</code>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Proxy server:</span>
                  <code style={{ color: 'var(--text-primary)' }}>http://localhost:5001</code>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>SSH Tunnel Endpoint:</span>
                  <code style={{ 
                    color: tunnelUrl ? 'var(--color-green)' : 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontSize: '0.75rem',
                    background: 'rgba(0,0,0,0.2)',
                    padding: '4px 6px',
                    borderRadius: '4px',
                    marginTop: '2px'
                  }}>
                    {tunnelUrl || 'None Set'}
                  </code>
                </div>
              </div>
            </div>

            {/* Quick Tips */}
            <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(157, 78, 221, 0.02)' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 600, color: 'var(--color-purple)' }}>
                🚀 Hackathon Tips
              </h3>
              
              <ul style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <li>
                  <strong>Always Stream:</strong> Streaming responses are essential to prevent HTTP request timeouts in serverless functions (like Vercel).
                </li>
                <li>
                  <strong>Zero Server Costs:</strong> Running local models means your hackathon project costs exactly $0.00 for inference, leaving you free to test without token limits!
                </li>
                <li>
                  <strong>SSH Tunnel Stability:</strong> Keep your terminal tunnel active. If your tunnel disconnects, just re-run the ssh command in your terminal and update the new link here.
                </li>
              </ul>
            </div>

          </div>

        </div>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border-color)', padding: '16px 24px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '40px' }}>
        HackDev AI Dashboard • Created for Hackathon developers integrating Agentic AI • Powered by Ollama
      </footer>
    </div>
  );
}
