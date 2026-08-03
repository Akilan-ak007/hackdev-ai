const express = require('express');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 5001;
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';

const app = express();
app.use(cors());
app.use(express.json());

// In-memory store for session metrics & request logs
let metrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalTokens: 0,
  totalLatencyMs: 0,
  totalTokensPerSec: 0,
  tokensPerSecCount: 0,
};

const recentLogs = [];
const MAX_LOGS = 100;

// Helper to update metrics and push logs
function logRequest(logData) {
  metrics.totalRequests += 1;
  if (logData.success) {
    metrics.successfulRequests += 1;
    if (logData.totalTokens > 0) {
      metrics.totalTokens += logData.totalTokens;
    }
    if (logData.latencyMs > 0) {
      metrics.totalLatencyMs += logData.latencyMs;
    }
    if (logData.tokensPerSec > 0) {
      metrics.totalTokensPerSec += logData.tokensPerSec;
      metrics.tokensPerSecCount += 1;
    }
  } else {
    metrics.failedRequests += 1;
  }

  recentLogs.unshift(logData);
  if (recentLogs.length > MAX_LOGS) {
    recentLogs.pop();
  }

  broadcast({
    type: 'request_logged',
    log: logData,
    metrics: getSummaryMetrics(),
  });
}

function getSummaryMetrics() {
  const avgLatency = metrics.successfulRequests > 0 
    ? Math.round(metrics.totalLatencyMs / metrics.successfulRequests) 
    : 0;
  
  const avgTokensPerSec = metrics.tokensPerSecCount > 0 
    ? Math.round((metrics.totalTokensPerSec / metrics.tokensPerSecCount) * 10) / 10
    : 0;

  const successRate = metrics.totalRequests > 0 
    ? Math.round((metrics.successfulRequests / metrics.totalRequests) * 1000) / 10
    : 100;

  return {
    totalRequests: metrics.totalRequests,
    successRate,
    avgLatencyMs: avgLatency,
    avgTokensPerSec,
    totalTokens: metrics.totalTokens,
  };
}

// WebSocket server setup
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

function broadcast(data) {
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      client.send(message);
    }
  });
}

wss.on('connection', (ws) => {
  console.log('🔌 Dashboard client connected to WebSocket telemetry stream');
  // Send initial data to new connection
  ws.send(JSON.stringify({
    type: 'init',
    metrics: getSummaryMetrics(),
    logs: recentLogs,
  }));

  ws.on('close', () => {
    console.log('🔌 Dashboard client disconnected');
  });
});

// Proxy routes

// Get available models from local Ollama
app.get('/api/tags', async (req, res) => {
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/tags`);
    if (!response.ok) throw new Error(`Ollama responded with status ${response.status}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('❌ Error fetching models from Ollama:', error.message);
    res.status(502).json({ error: 'Failed to connect to local Ollama service. Make sure it is running on port 11434.' });
  }
});

// Reset metrics endpoint
app.post('/api/reset', (req, res) => {
  metrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalTokens: 0,
    totalLatencyMs: 0,
    totalTokensPerSec: 0,
    tokensPerSecCount: 0,
  };
  recentLogs.length = 0;
  broadcast({
    type: 'reset',
    metrics: getSummaryMetrics(),
    logs: [],
  });
  res.json({ success: true });
});

// Chat completion proxy route (handles streaming and non-streaming)
app.post('/api/chat', async (req, res) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(2, 9);
  const { model, messages, stream = true } = req.body;
  const promptText = messages && messages.length > 0 ? messages[messages.length - 1].content : '';

  console.log(`🤖 [${requestId}] Proxying chat request for model: ${model} (stream: ${stream})`);

  try {
    const ollamaResponse = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });

    if (!ollamaResponse.ok) {
      const errorText = await ollamaResponse.text();
      throw new Error(`Ollama error: ${ollamaResponse.status} - ${errorText}`);
    }

    if (stream) {
      res.setHeader('Content-Type', 'application/x-ndjson');
      res.setHeader('Transfer-Encoding', 'chunked');

      const reader = ollamaResponse.body.getReader();
      const decoder = new TextDecoder();
      let fullResponseText = '';
      let buffer = '';

      let completionTokens = 0;
      let promptTokens = 0;
      let evalDurationNs = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);

        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep last incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.message?.content) {
              fullResponseText += parsed.message.content;
            }
            if (parsed.done) {
              promptTokens = parsed.prompt_eval_count || 0;
              completionTokens = parsed.eval_count || 0;
              evalDurationNs = parsed.eval_duration || 0;
            }
          } catch {
            // Ignore parse errors on partial chunks
          }
        }
      }

      // Flush remaining buffer
      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer);
          if (parsed.message?.content) {
            fullResponseText += parsed.message.content;
          }
        } catch {}
      }

      const endTime = Date.now();
      const latencyMs = endTime - startTime;

      // If Ollama didn't report tokens, estimate them (1 token ~= 4 chars)
      const totalTokens = promptTokens + completionTokens || Math.round((promptText.length + fullResponseText.length) / 4);
      const genTokens = completionTokens || Math.round(fullResponseText.length / 4);
      
      // Calculate tokens per second (Ollama returns eval_duration in nanoseconds)
      const tokensPerSec = evalDurationNs > 0
        ? Math.round((genTokens / (evalDurationNs / 1e9)) * 10) / 10
        : Math.round((genTokens / (latencyMs / 1000)) * 10) / 10;

      logRequest({
        id: requestId,
        timestamp: new Date().toISOString(),
        model,
        prompt: promptText.substring(0, 100) + (promptText.length > 100 ? '...' : ''),
        response: fullResponseText.substring(0, 200) + (fullResponseText.length > 200 ? '...' : ''),
        latencyMs,
        promptTokens: promptTokens || Math.round(promptText.length / 4),
        completionTokens: genTokens,
        totalTokens,
        tokensPerSec: isFinite(tokensPerSec) && tokensPerSec > 0 ? tokensPerSec : 0,
        success: true,
      });

      res.end();
    } else {
      // Non-streaming response
      const data = await ollamaResponse.json();
      const endTime = Date.now();
      const latencyMs = endTime - startTime;
      const responseText = data.message?.content || '';

      const promptTokens = data.prompt_eval_count || Math.round(promptText.length / 4);
      const completionTokens = data.eval_count || Math.round(responseText.length / 4);
      const totalTokens = promptTokens + completionTokens;
      
      const evalDurationNs = data.eval_duration || 0;
      const tokensPerSec = evalDurationNs > 0
        ? Math.round((completionTokens / (evalDurationNs / 1e9)) * 10) / 10
        : Math.round((completionTokens / (latencyMs / 1000)) * 10) / 10;

      logRequest({
        id: requestId,
        timestamp: new Date().toISOString(),
        model,
        prompt: promptText.substring(0, 100) + (promptText.length > 100 ? '...' : ''),
        response: responseText.substring(0, 200) + (responseText.length > 200 ? '...' : ''),
        latencyMs,
        promptTokens,
        completionTokens,
        totalTokens,
        tokensPerSec: isFinite(tokensPerSec) && tokensPerSec > 0 ? tokensPerSec : 0,
        success: true,
      });

      res.json(data);
    }
  } catch (error) {
    console.error(`❌ [${requestId}] Proxy chat error:`, error.message);
    const endTime = Date.now();
    const latencyMs = endTime - startTime;

    logRequest({
      id: requestId,
      timestamp: new Date().toISOString(),
      model: model || 'unknown',
      prompt: promptText.substring(0, 100) + (promptText.length > 100 ? '...' : ''),
      response: `Error: ${error.message}`,
      latencyMs,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      tokensPerSec: 0,
      success: false,
    });

    res.status(500).json({ error: error.message });
  }
});

// Raw generation proxy route
app.post('/api/generate', async (req, res) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(2, 9);
  const { model, prompt, stream = true } = req.body;

  console.log(`🤖 [${requestId}] Proxying generation request for model: ${model} (stream: ${stream})`);

  try {
    const ollamaResponse = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });

    if (!ollamaResponse.ok) {
      const errorText = await ollamaResponse.text();
      throw new Error(`Ollama error: ${ollamaResponse.status} - ${errorText}`);
    }

    if (stream) {
      res.setHeader('Content-Type', 'application/x-ndjson');
      res.setHeader('Transfer-Encoding', 'chunked');

      const reader = ollamaResponse.body.getReader();
      const decoder = new TextDecoder();
      let fullResponseText = '';
      let buffer = '';

      let completionTokens = 0;
      let promptTokens = 0;
      let evalDurationNs = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);

        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.response) {
              fullResponseText += parsed.response;
            }
            if (parsed.done) {
              promptTokens = parsed.prompt_eval_count || 0;
              completionTokens = parsed.eval_count || 0;
              evalDurationNs = parsed.eval_duration || 0;
            }
          } catch {}
        }
      }

      const endTime = Date.now();
      const latencyMs = endTime - startTime;

      const totalTokens = promptTokens + completionTokens || Math.round((prompt.length + fullResponseText.length) / 4);
      const genTokens = completionTokens || Math.round(fullResponseText.length / 4);
      const tokensPerSec = evalDurationNs > 0
        ? Math.round((genTokens / (evalDurationNs / 1e9)) * 10) / 10
        : Math.round((genTokens / (latencyMs / 1000)) * 10) / 10;

      logRequest({
        id: requestId,
        timestamp: new Date().toISOString(),
        model,
        prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
        response: fullResponseText.substring(0, 200) + (fullResponseText.length > 200 ? '...' : ''),
        latencyMs,
        promptTokens: promptTokens || Math.round(prompt.length / 4),
        completionTokens: genTokens,
        totalTokens,
        tokensPerSec: isFinite(tokensPerSec) && tokensPerSec > 0 ? tokensPerSec : 0,
        success: true,
      });

      res.end();
    } else {
      const data = await ollamaResponse.json();
      const endTime = Date.now();
      const latencyMs = endTime - startTime;
      const responseText = data.response || '';

      const promptTokens = data.prompt_eval_count || Math.round(prompt.length / 4);
      const completionTokens = data.eval_count || Math.round(responseText.length / 4);
      const totalTokens = promptTokens + completionTokens;

      const evalDurationNs = data.eval_duration || 0;
      const tokensPerSec = evalDurationNs > 0
        ? Math.round((completionTokens / (evalDurationNs / 1e9)) * 10) / 10
        : Math.round((completionTokens / (latencyMs / 1000)) * 10) / 10;

      logRequest({
        id: requestId,
        timestamp: new Date().toISOString(),
        model,
        prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
        response: responseText.substring(0, 200) + (responseText.length > 200 ? '...' : ''),
        latencyMs,
        promptTokens,
        completionTokens,
        totalTokens,
        tokensPerSec: isFinite(tokensPerSec) && tokensPerSec > 0 ? tokensPerSec : 0,
        success: true,
      });

      res.json(data);
    }
  } catch (error) {
    console.error(`❌ [${requestId}] Proxy generate error:`, error.message);
    const endTime = Date.now();
    const latencyMs = endTime - startTime;

    logRequest({
      id: requestId,
      timestamp: new Date().toISOString(),
      model: model || 'unknown',
      prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
      response: `Error: ${error.message}`,
      latencyMs,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      tokensPerSec: 0,
      success: false,
    });

    res.status(500).json({ error: error.message });
  }
});

// Start proxy server
server.listen(PORT, () => {
  console.log(`🚀 HackDev AI Local Proxy Server is running on port ${PORT}`);
  console.log(`🔗 Proxying calls to local Ollama at ${OLLAMA_HOST}`);
  console.log(`📡 WebSocket telemetry stream active on ws://localhost:${PORT}`);
});
