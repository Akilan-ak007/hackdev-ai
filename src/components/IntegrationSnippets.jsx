import React, { useState } from 'react';
import { Code, Copy, Check, Info } from 'lucide-react';

export default function IntegrationSnippets() {
  const [activeTab, setActiveTab] = useState('js');
  const [copied, setCopied] = useState(false);

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const snippets = {
    js: {
      title: 'JavaScript / Node.js',
      description: 'Route requests through the local telemetry proxy (default: port 5001) to automatically track metrics.',
      code: `// Route your hackathon client requests through HackDev Proxy
const generateResponse = async (prompt) => {
  const response = await fetch('http://localhost:5001/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama3.2:latest',
      messages: [{ role: 'user', content: prompt }],
      stream: true // Proxy supports streaming & calculates live latency
    }),
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value, { stream: true });
    // Parse the NDJSON lines from Ollama
    const lines = chunk.split('\\n');
    for (const line of lines) {
      if (line.trim()) {
        const json = JSON.parse(line);
        if (json.message?.content) {
          process.stdout.write(json.message.content);
        }
      }
    }
  }
};

generateResponse("Explain quantum physics in 2 sentences.");`
    },
    python: {
      title: 'Python requests',
      description: 'Send chat completions via requests to the proxy server to log prompts and tokens.',
      code: `import requests
import json
import sys

# Send requests through HackDev Telemetry Proxy
url = "http://localhost:5001/api/chat"
headers = {"Content-Type": "application/json"}
payload = {
    "model": "llama3.2:latest",
    "messages": [{"role": "user", "content": "Write a 3-word slogan for a hackathon AI tool."}],
    "stream": True
}

response = requests.post(url, headers=headers, json=payload, stream=True)

for line in response.iter_lines():
    if line:
        decoded_line = line.decode('utf-8')
        try:
            data = json.loads(decoded_line)
            content = data.get("message", {}).get("content", "")
            sys.stdout.write(content)
            sys.stdout.flush()
        except json.JSONDecodeError:
            pass
print() # Add newline at end`
    },
    curl: {
      title: 'cURL Terminal Command',
      description: 'Test your local proxy endpoint directly using a simple cURL command in your terminal.',
      code: `curl -X POST http://localhost:5001/api/chat \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "llama3.2:latest",
    "messages": [
      {
        "role": "user",
        "content": "Why is local AI useful in hackathons?"
      }
    ],
    "stream": false
  }'`
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-blue)' }} className="glow-text-blue">
          <Code size={22} />
          Developer Integration Snippets
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '6px' }}>
          Connect your custom hackathon backend/scripts to this dashboard instantly.
        </p>
      </div>

      <div style={{ backgroundColor: 'rgba(0, 180, 216, 0.05)', border: '1px solid rgba(0, 180, 216, 0.15)', padding: '12px 16px', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', gap: '12px', color: '#93c5fd' }}>
        <Info size={28} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          To log metrics to this dashboard, developers run the local proxy server (`node server.js`) and send requests to `http://localhost:5001/api/chat` instead of Ollama directly. The proxy handles token counters and broadcasts logs to your dashboard client in real-time.
        </div>
      </div>

      {/* Code Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '4px' }}>
        {Object.keys(snippets).map((key) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              padding: '8px 16px',
              fontSize: '0.85rem',
              background: activeTab === key ? 'rgba(0, 180, 216, 0.1)' : 'transparent',
              color: activeTab === key ? 'var(--color-blue)' : 'var(--text-secondary)',
              borderBottom: activeTab === key ? '2px solid var(--color-blue)' : 'none',
              borderRadius: '6px 6px 0 0',
              fontWeight: activeTab === key ? '600' : '400',
            }}
          >
            {snippets[key].title}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          {snippets[activeTab].description}
        </p>

        <div style={{ position: 'relative' }}>
          <button
            onClick={() => copyCode(snippets[activeTab].code)}
            className="btn-secondary"
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              padding: '6px 12px',
              fontSize: '0.75rem',
              display: 'flex',
              gap: '4px',
              alignItems: 'center',
            }}
          >
            {copied ? <Check size={12} color="var(--color-green)" /> : <Copy size={12} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
          
          <pre style={{ margin: 0 }}>
            <code>{snippets[activeTab].code}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
