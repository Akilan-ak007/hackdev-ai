# HackDev AI: Hackathon AI Gateway & Telemetry Dashboard

HackDev AI is a developer-focused gateway and real-time metrics dashboard designed to simplify the integration, monitoring, and staging of local LLMs (Ollama) in hackathon environments.

It solves the browser **Mixed Content block** on staging sites (like Vercel) by providing a setup assistant for secure **SSH reverse tunnels** (no software installation required) and a **local telemetry proxy** that computes response latencies, token speed, and prompt/response details.

---

## Features

- ⚡ **Interactive Playground**: Chat with local models (e.g. `llama3.2`) with streaming responses.
- 🔗 **SSH Tunneling Assistant**: Connect your local model to HTTPS deployments via `localhost.run`, `serveo.net`, or `pinggy.io`.
- 📊 **Real-time Metrics Panel**: Monitor Average Latency, Success Rate, and Token Throughput (tokens/sec) with responsive neon-styled SVG charts.
- ⚙️ **Parameter Sliders**: Tweak temperature, system prompts, and toggle **Agentic Reasoner logs** to simulate multi-step thinking.
- 🔌 **Telemetry Proxy Server**: Route requests from your hackathon scripts through port `5001` to pipe telemetry straight to the dashboard.
- 📦 **Copy-Paste Integration Code**: Tabbed templates for JavaScript (fetch), Python (requests), and cURL.

---

## Quick Start (Local Run)

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Dashboard Frontend (Vite)
```bash
npm run dev
```
The client dashboard will open at `http://localhost:5173`.

### 3. Run the Local Telemetry Proxy Server
```bash
npm run start-proxy
```
The telemetry server will launch on `http://localhost:5001`. It will connect to your local Ollama port `11434` and establish a live WebSocket stream to update the dashboard automatically.

---

## Connecting Your Local Ollama to Vercel (SSH Tunneling)

Since Vercel is served over HTTPS, the browser blocks requests to `http://localhost:11434`. You must expose Ollama securely via SSH tunneling:

### Option A: localhost.run (Recommended)
Run this command in your Mac terminal:
```bash
ssh -R 80:localhost:11434 nokey@localhost.run
```
Copy the secure `https://...lhrtunnel.link` URL from the terminal output and paste it into the **SSH Tunneling** tab of your deployed dashboard.

### Option B: serveo.net
Run this command:
```bash
ssh -R 80:localhost:11434 serveo.net
```
Copy the `https://...serveo.net` URL.

---

## Integrating Your Code (Logging Telemetry)

To capture metrics automatically from your custom hackathon scripts:
1. Make sure your local proxy is running (`npm run start-proxy`).
2. Point your scripts' Ollama endpoint to the proxy instead of Ollama directly:
   - Change `http://localhost:11434` to `http://localhost:5001`
   - Use the `/api/chat` route for chat completions.

*Code templates for JS, Python, and cURL are available in the **Integration API** tab on the dashboard.*

---

## Deploying to Vercel

You can deploy this static dashboard to Vercel in seconds:

### Via Vercel CLI (Recommended)
1. Install the Vercel CLI globally (if not already installed):
   ```bash
   npm install -g vercel
   ```
2. Run the deploy command inside this directory:
   ```bash
   vercel
   ```
   Follow the prompts (accept default settings).
3. To deploy to production:
   ```bash
   vercel --prod
   ```

### Via GitHub (Continuous Deployment)
1. Push this code to a new repository on GitHub.
2. Go to the [Vercel Dashboard](https://vercel.com).
3. Click **Import Project** and select your repository.
4. Vercel will auto-detect Vite/React settings. Click **Deploy**.
