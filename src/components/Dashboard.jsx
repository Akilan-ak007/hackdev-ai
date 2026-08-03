import React, { useState } from 'react';
import { Activity, Clock, Cpu, CheckCircle, RefreshCw, Layers, ListCollapse } from 'lucide-react';

export default function Dashboard({ logs, metrics, isWsConnected, onResetMetrics, toggleDemoMode, isDemoMode }) {
  const [expandedLogId, setExpandedLogId] = useState(null);

  const toggleExpandLog = (id) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  // Helper to format latency
  const formatLatency = (ms) => {
    if (ms >= 1000) {
      return `${(ms / 1000).toFixed(2)}s`;
    }
    return `${ms}ms`;
  };

  // Render SVG Chart for Latencies
  const renderLatencyChart = () => {
    // Determine data source (active logs or demo data)
    let chartData = [...logs].reverse(); // oldest first for line chart
    
    if (chartData.length === 0) {
      if (isDemoMode) {
        chartData = [
          { id: '1', model: 'llama3.2', latencyMs: 650, tokensPerSec: 42 },
          { id: '2', model: 'llama3.2', latencyMs: 1200, tokensPerSec: 38 },
          { id: '3', model: 'llama3.2', latencyMs: 850, tokensPerSec: 45 },
          { id: '4', model: 'llama3.2', latencyMs: 1450, tokensPerSec: 39 },
          { id: '5', model: 'llama3.2', latencyMs: 700, tokensPerSec: 44 },
          { id: '6', model: 'llama3.2', latencyMs: 1100, tokensPerSec: 41 },
          { id: '7', model: 'llama3.2', latencyMs: 950, tokensPerSec: 43 },
        ];
      } else {
        return (
          <div style={{ height: '180px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', gap: '8px', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
            <Activity size={24} />
            <span>Telemetry stream idle. Send queries or toggle Demo Mode.</span>
          </div>
        );
      }
    }

    // Limit to last 15 queries for legibility
    if (chartData.length > 15) {
      chartData = chartData.slice(-15);
    }

    const width = 500;
    const height = 150;
    const padding = 20;

    const maxLatency = Math.max(...chartData.map(d => d.latencyMs), 1000);
    const minLatency = 0;

    // Calculate coordinates
    const points = chartData.map((d, index) => {
      const x = padding + (index / (chartData.length - 1 || 1)) * (width - padding * 2);
      const y = height - padding - ((d.latencyMs - minLatency) / (maxLatency - minLatency)) * (height - padding * 2);
      return { x, y, ...d };
    });

    // Build SVG Path
    let linePath = '';
    let areaPath = '';

    if (points.length > 0) {
      linePath = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
      // Area path goes down to base to fill gradient
      areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;
    }

    return (
      <div style={{ position: 'relative', width: '100%' }}>
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="180px" style={{ overflow: 'visible' }}>
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-purple)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--color-purple)" stopOpacity="0.0" />
            </linearGradient>
            <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Grid lines */}
          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="rgba(255,255,255,0.03)" strokeWidth={1} />
          <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="rgba(255,255,255,0.03)" strokeWidth={1} />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />

          {/* Area under the line */}
          {areaPath && <path d={areaPath} fill="url(#areaGrad)" />}

          {/* Main Line */}
          {linePath && (
            <path 
              d={linePath} 
              fill="none" 
              stroke="var(--color-purple)" 
              strokeWidth={2.5} 
              filter="url(#neonGlow)" 
            />
          )}

          {/* Data Points */}
          {points.map((p, i) => (
            <g key={p.id || i}>
              <circle 
                cx={p.x} 
                cy={p.y} 
                r={4} 
                fill="var(--color-purple)" 
                stroke="white" 
                strokeWidth={1} 
                style={{ cursor: 'pointer' }}
              />
              {/* Tooltip on hover */}
              <title>{`${p.model}: ${formatLatency(p.latencyMs)} (${p.tokensPerSec} t/s)`}</title>
            </g>
          ))}

          {/* Axes labels */}
          <text x={padding} y={height - 4} fill="var(--text-muted)" fontSize={8}>Oldest</text>
          <text x={width - padding} y={height - 4} fill="var(--text-muted)" fontSize={8} textAnchor="end">Latest</text>
          <text x={width - padding} y={padding + 10} fill="var(--color-purple)" fontSize={8} textAnchor="end" fontWeight="bold">
            Max: {formatLatency(maxLatency)}
          </text>
        </svg>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Telemetry Status Bar */}
      <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              backgroundColor: isWsConnected ? 'var(--color-green)' : 'var(--text-muted)',
              display: 'inline-block'
            }} className={isWsConnected ? 'pulse-active' : ''} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              {isWsConnected ? 'Telemetry Proxy: ACTIVE' : 'Telemetry Proxy: OFFLINE'}
            </span>
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>|</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            ws://localhost:5001
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={toggleDemoMode} 
            className="btn-secondary" 
            style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '6px' }}
          >
            {isDemoMode ? 'Turn Off Demo Data' : 'Load Demo Data'}
          </button>
          
          <button 
            onClick={onResetMetrics}
            className="btn-secondary" 
            style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '6px', color: '#fca5a5' }}
          >
            <RefreshCw size={12} /> Reset Metrics
          </button>
        </div>
      </div>

      {/* Metrics Card Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        
        {/* Total Requests */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'rgba(157, 78, 221, 0.1)', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', color: 'var(--color-purple)' }}>
            <Layers size={20} />
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Queries</span>
            <span style={{ display: 'block', fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
              {isDemoMode && metrics.totalRequests === 0 ? 34 : metrics.totalRequests}
            </span>
          </div>
        </div>

        {/* Avg Latency */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'rgba(0, 180, 216, 0.1)', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', color: 'var(--color-blue)' }}>
            <Clock size={20} />
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Avg Latency</span>
            <span style={{ display: 'block', fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
              {isDemoMode && metrics.avgLatencyMs === 0 ? '980ms' : formatLatency(metrics.avgLatencyMs)}
            </span>
          </div>
        </div>

        {/* Success Rate */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'rgba(0, 245, 212, 0.1)', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', color: 'var(--color-green)' }}>
            <CheckCircle size={20} />
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Success Rate</span>
            <span style={{ display: 'block', fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
              {isDemoMode && metrics.totalRequests === 0 ? '100%' : `${metrics.successRate}%`}
            </span>
          </div>
        </div>

        {/* Speed (tokens/sec) */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'rgba(255, 0, 127, 0.1)', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', color: 'var(--color-pink)' }}>
            <Cpu size={20} />
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Avg Throughput</span>
            <span style={{ display: 'block', fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
              {isDemoMode && metrics.avgTokensPerSec === 0 ? '41.2 t/s' : `${metrics.avgTokensPerSec} t/s`}
            </span>
          </div>
        </div>

      </div>

      {/* Latency History Chart Container */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600 }}>Latency Timeline</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Hover points for query stats</span>
        </div>
        {renderLatencyChart()}
      </div>

      {/* Live Stream Terminal Logs */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ListCollapse size={18} />
            Telemetry Stream Console
          </h3>
          <span className="badge badge-purple" style={{ fontSize: '0.7rem' }}>
            {logs.length} Requests logged
          </span>
        </div>

        {/* Logs Table */}
        <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px' }}>Model</th>
                <th style={{ padding: '12px 16px' }}>Prompt Preview</th>
                <th style={{ padding: '12px 16px' }}>Latency</th>
                <th style={{ padding: '12px 16px' }}>Tokens</th>
                <th style={{ padding: '12px 16px' }}>Speed</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Payload</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No telemetry events captured yet. Run requests from the Playground or run the integration script.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <React.Fragment key={log.id}>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: expandedLogId === log.id ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <span className={`badge ${log.success ? 'badge-green' : 'badge-red'}`}>
                          {log.success ? 'Success' : 'Failed'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--text-primary)' }}>{log.model}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.prompt}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--color-blue)' }}>{formatLatency(log.latencyMs)}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{log.totalTokens}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--color-pink)' }}>{log.tokensPerSec} t/s</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button 
                          onClick={() => toggleExpandLog(log.id)}
                          className="btn-secondary" 
                          style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: '4px' }}
                        >
                          {expandedLogId === log.id ? 'Hide' : 'Inspect'}
                        </button>
                      </td>
                    </tr>
                    
                    {expandedLogId === log.id && (
                      <tr style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
                        <td colSpan="7" style={{ padding: '16px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                              <strong style={{ fontSize: '0.8rem', color: 'var(--color-purple)', display: 'block', marginBottom: '6px' }}>Prompt Payload</strong>
                              <div style={{ padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', maxHeight: '150px', overflowY: 'auto' }}>
                                {log.prompt}
                              </div>
                            </div>
                            <div>
                              <strong style={{ fontSize: '0.8rem', color: 'var(--color-green)', display: 'block', marginBottom: '6px' }}>Response Payload</strong>
                              <div style={{ padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', maxHeight: '150px', overflowY: 'auto' }}>
                                {log.response}
                              </div>
                            </div>
                          </div>
                          
                          <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            <span><strong>Logged At:</strong> {new Date(log.timestamp).toLocaleString()}</span>
                            <span>|</span>
                            <span><strong>Prompt Tokens:</strong> {log.promptTokens}</span>
                            <span>|</span>
                            <span><strong>Completion Tokens:</strong> {log.completionTokens}</span>
                            <span>|</span>
                            <span><strong>Local Host Savings:</strong> $0.00 (100% Free Local GPU run!)</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
