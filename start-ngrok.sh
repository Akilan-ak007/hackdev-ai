#!/bin/bash

# Configuration
LOCAL_PORT=5001
STATIC_DOMAIN="YOUR_STATIC_DOMAIN.ngrok-free.app" # e.g. akilan-ollama.ngrok-free.app
LOG_FILE="/Users/akilank/Documents/dunny/ngrok-tunnel.log"

echo "=== Starting Permanent ngrok Static Domain Tunnel ===" | tee -a "$LOG_FILE"
echo "Target: localhost:$LOCAL_PORT -> https://$STATIC_DOMAIN" | tee -a "$LOG_FILE"

# Run ngrok with auto-reconnect configurations
while true; do
  echo "[$(date)] Connecting ngrok static tunnel..." >> "$LOG_FILE"
  
  # npx ngrok triggers the tunnel and forwards to port 5001 using the domain
  npx ngrok http --url="$STATIC_DOMAIN" $LOCAL_PORT >> "$LOG_FILE" 2>&1
  
  echo "[$(date)] ngrok disconnected. Reconnecting in 5 seconds..." >> "$LOG_FILE"
  sleep 5
done
