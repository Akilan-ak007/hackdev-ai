import React, { useState, useRef, useEffect } from 'react';
import { Send, Trash2, Cpu, Settings, Terminal } from 'lucide-react';

export default function Playground({ tunnelUrl, models, isWsConnected, onNewLocalLog }) {
  const [selectedModel, setSelectedModel] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '👋 Hello! I am your local Ollama instance exposed via your SSH tunnel. Select a model on the right and ask me anything!' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Settings State
  const [temperature, setTemperature] = useState(0.7);
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful, hackathon-optimized AI assistant running locally.');
  const [isAgentMode, setIsAgentMode] = useState(true);
  const [agentSteps, setAgentSteps] = useState([]);

  const messagesEndRef = useRef(null);

  // Set default model once loaded
  useEffect(() => {
    if (models.length > 0 && !selectedModel) {
      setSelectedModel(models[0].name);
    }
  }, [models, selectedModel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, agentSteps]);

  // Simulate agent reasoning steps
  const runAgentSteps = async () => {
    setAgentSteps([]);
    const steps = [
      { id: 1, type: 'plan', text: 'Analyzing query intent and identifying target parameters...', status: 'running' },
      { id: 2, type: 'tool', text: 'Scanning local repository/workspace index...', status: 'pending' },
      { id: 3, type: 'tool', text: 'Injecting prompt safety configurations...', status: 'pending' }
    ];

    setAgentSteps([...steps]);
    await new Promise(r => setTimeout(r, 600));

    steps[0].status = 'done';
    steps[1].status = 'running';
    steps[1].text = 'Found active models! Query routing to ' + selectedModel;
    setAgentSteps([...steps]);
    await new Promise(r => setTimeout(r, 700));

    steps[1].status = 'done';
    steps[2].status = 'running';
    setAgentSteps([...steps]);
    await new Promise(r => setTimeout(r, 500));

    steps[2].status = 'done';
    setAgentSteps([...steps]);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isGenerating) return;

    if (!selectedModel) {
      alert('Please connect to Ollama and select a model first!');
      return;
    }

    const userText = inputValue;
    setInputValue('');
    setIsGenerating(true);

    const userMessage = { role: 'user', content: userText };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    // Placeholder message for assistant stream
    const assistantMessagePlaceholder = { role: 'assistant', content: '' };
    setMessages([...updatedMessages, assistantMessagePlaceholder]);

    if (isAgentMode) {
      await runAgentSteps();
    }

    // Determine target API endpoint
    // If telemetry proxy server (WebSockets) is active, route through localhost proxy to log metrics.
    // Otherwise, route directly to the SSH tunnel URL.
    const isProxyActive = isWsConnected; 
    const baseUrl = isProxyActive ? 'http://localhost:5001' : tunnelUrl;
    const endpoint = `${baseUrl}/api/chat`;

    const startTime = Date.now();
    let responseText = '';

    try {
      // Build request body matching Ollama parameters
      const requestBody = {
        model: selectedModel,
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          ...updatedMessages.filter(m => m.content)
        ],
        stream: true,
        options: {
          temperature: parseFloat(temperature),
        }
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          'bypass-tunnel-reminder': 'true'
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate response: HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Hold onto partial line

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.message?.content) {
              responseText += parsed.message.content;
              
              // Update assistant message in real-time
              setMessages(prev => {
                const copy = [...prev];
                copy[copy.length - 1].content = responseText;
                return copy;
              });
            }
          } catch {
            // Ignore JSON parse errors on partial streams
          }
        }
      }

      // Finalize text if anything is left in buffer
      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer);
          if (parsed.message?.content) {
            responseText += parsed.message.content;
            setMessages(prev => {
              const copy = [...prev];
              copy[copy.length - 1].content = responseText;
              return copy;
            });
          }
        } catch {}
      }

      const endTime = Date.now();
      const latencyMs = endTime - startTime;

      // In standalone mode (connecting directly to tunnelUrl), the proxy is bypasses.
      // We manually generate a local log event so the UI updates metrics for direct playground usage!
      if (!isProxyActive) {
        const genTokens = Math.round(responseText.length / 4);
        const promptTokens = Math.round(userText.length / 4);
        const totalTokens = promptTokens + genTokens;
        const tokensPerSec = Math.round((genTokens / (latencyMs / 1000)) * 10) / 10;

        onNewLocalLog({
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toISOString(),
          model: selectedModel,
          prompt: userText.substring(0, 100) + (userText.length > 100 ? '...' : ''),
          response: responseText.substring(0, 200) + (responseText.length > 200 ? '...' : ''),
          latencyMs,
          promptTokens,
          completionTokens: genTokens,
          totalTokens,
          tokensPerSec: isFinite(tokensPerSec) ? tokensPerSec : 0,
          success: true
        });
      }

    } catch (error) {
      console.error('Playground generation error:', error);
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1].content = `⚠️ Error generating response: ${error.message}. Please verify Ollama is running and the tunnel URL is correct.`;
        return copy;
      });
      
      if (!isProxyActive) {
        onNewLocalLog({
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toISOString(),
          model: selectedModel,
          prompt: userText.substring(0, 100) + (userText.length > 100 ? '...' : ''),
          response: `Error: ${error.message}`,
          latencyMs: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          tokensPerSec: 0,
          success: false
        });
      }
    } finally {
      setIsGenerating(false);
      setAgentSteps([]);
    }
  };

  const clearChat = () => {
    setMessages([
      { role: 'assistant', content: '🧹 Chat history cleared. Ready for your next query!' }
    ]);
    setAgentSteps([]);
  };

  const activeModelDetails = models.find(m => m.name === selectedModel);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', height: 'calc(100vh - 120px)', minHeight: '600px' }}>
      
      {/* Playground Layout Container */}
      <div style={{ display: 'flex', gap: '20px', height: '100%' }}>
        
        {/* Left Pane: Chat Window */}
        <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0' }}>
          
          {/* Header */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Cpu size={20} style={{ color: 'var(--color-purple)' }} />
              <div>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, display: 'block' }}>Local LLM Playground</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {isWsConnected ? 'Routing via Telemetry Proxy (Port 5001)' : 'Routing Direct to Tunnel Endpoint'}
                </span>
              </div>
            </div>
            
            <button 
              onClick={clearChat}
              className="btn-secondary" 
              style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '6px' }}
            >
              <Trash2 size={12} /> Clear Chat
            </button>
          </div>

          {/* Messages Area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {messages.map((msg, index) => (
              <div 
                key={index} 
                className="animate-slide-up"
                style={{ 
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '75%',
                  backgroundColor: msg.role === 'user' ? 'rgba(157, 78, 221, 0.15)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${msg.role === 'user' ? 'rgba(157, 78, 221, 0.3)' : 'var(--border-color)'}`,
                  borderRadius: '12px',
                  padding: '12px 16px',
                  fontSize: '0.9rem',
                  color: 'var(--text-primary)'
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.75rem', color: msg.role === 'user' ? 'var(--color-purple)' : 'var(--color-green)', marginBottom: '4px' }}>
                  {msg.role === 'user' ? 'You' : (selectedModel ? selectedModel.split(':')[0].toUpperCase() : 'OLLAMA')}
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>
                  {msg.content}
                  {isGenerating && index === messages.length - 1 && msg.content === '' && (
                    <span className="terminal-cursor"></span>
                  )}
                </div>
              </div>
            ))}
            
            {/* Agent steps display */}
            {agentSteps.length > 0 && (
              <div style={{ alignSelf: 'flex-start', width: '75%', padding: '12px 16px', background: 'rgba(9,11,16,0.9)', border: '1px solid var(--color-green)', borderRadius: '12px', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-green)', fontWeight: 'bold', marginBottom: '8px' }}>
                  <Terminal size={14} className="pulse-active" />
                  <span>Agent Execution Chain</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {agentSteps.map(step => (
                    <div key={step.id} style={{ display: 'flex', gap: '8px', color: step.status === 'done' ? 'var(--text-muted)' : step.status === 'running' ? 'var(--color-green)' : 'var(--text-muted)' }}>
                      <span>
                        {step.status === 'done' ? '✓' : step.status === 'running' ? '⚡' : '○'}
                      </span>
                      <span style={{ textDecoration: step.status === 'done' ? 'line-through' : 'none' }}>
                        {step.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form onSubmit={handleSendMessage} style={{ padding: '16px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '10px', backgroundColor: 'rgba(0,0,0,0.1)' }}>
            <textarea
              placeholder={selectedModel ? `Message ${selectedModel.split(':')[0]}...` : 'Select a model and connect a tunnel to start...'}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isGenerating || !selectedModel}
              style={{ resize: 'none', height: '48px', padding: '10px 14px', flex: 1, borderRadius: '8px' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
            />
            <button 
              type="submit" 
              disabled={isGenerating || !inputValue.trim() || !selectedModel}
              className="btn-primary" 
              style={{ width: '48px', height: '48px', padding: '0', flexShrink: 0, borderRadius: '8px' }}
            >
              <Send size={18} />
            </button>
          </form>

        </div>

        {/* Right Pane: Settings & Model Specs Drawer */}
        <div className="glass-panel" style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px', overflowY: 'auto' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={18} />
              Session Parameters
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px' }}>
              Fine-tune the model parameters.
            </p>
          </div>

          {/* Model Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Active Ollama Model</label>
            <select 
              value={selectedModel} 
              onChange={(e) => setSelectedModel(e.target.value)}
              style={{ fontSize: '0.85rem' }}
            >
              {models.length === 0 ? (
                <option value="">No models detected</option>
              ) : (
                models.map((model) => (
                  <option key={model.name} value={model.name}>
                    {model.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Temperature Slider */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
              <label style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Temperature</label>
              <span style={{ color: 'var(--color-purple)', fontWeight: 'bold' }}>{temperature}</span>
            </div>
            <input 
              type="range" 
              min="0.0" 
              max="1.5" 
              step="0.1" 
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              style={{ accentColor: 'var(--color-purple)' }}
            />
          </div>

          {/* Toggle Agent Mode */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Agentic Thoughts</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Simulate reasoning logs</span>
            </div>
            <input 
              type="checkbox" 
              checked={isAgentMode} 
              onChange={(e) => setIsAgentMode(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: 'var(--color-green)' }}
            />
          </div>

          {/* System Prompt TextArea */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>System Prompt</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              style={{ height: '80px', fontSize: '0.8rem', resize: 'none' }}
              placeholder="e.g. You are a code generator..."
            />
          </div>

          {/* Active Model Specs */}
          {activeModelDetails && (
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.75rem' }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Model Specifications</span>
              <div style={{ padding: '10px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Family:</span>
                  <span style={{ fontWeight: 500 }}>{activeModelDetails.details?.family || 'llama'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Parameters:</span>
                  <span style={{ fontWeight: 500 }}>{activeModelDetails.details?.parameter_size || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Quantization:</span>
                  <span style={{ fontWeight: 500 }}>{activeModelDetails.details?.quantization_level || 'Q4_K_M'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Disk Size:</span>
                  <span style={{ fontWeight: 500 }}>{(activeModelDetails.size / (1024 * 1024 * 1024)).toFixed(2)} GB</span>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
