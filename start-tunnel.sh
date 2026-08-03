#!/bin/bash

# Configuration
LOCAL_PORT=5001
REMOTE_HOST="nokey@localhost.run"
LOG_FILE="/Users/akilank/Documents/dunny/tunnel.log"

echo "=== Starting Permanent localhost.run Tunnel Gateway ===" | tee -a "$LOG_FILE"
echo "Target: localhost:$LOCAL_PORT -> $REMOTE_HOST" | tee -a "$LOG_FILE"
echo "Logs will be written to: $LOG_FILE"

while true; do
  echo "[$(date)] Connecting tunnel..." >> "$LOG_FILE"
  
  # Run SSH tunnel with keep-alive parameters
  # ServerAliveInterval sends a packet every 30s to keep the socket alive
  # ServerAliveCountMax drops connection if 3 packets fail, triggering loop reconnect
  ssh -o ConnectTimeout=10 \
      -o ServerAliveInterval=30 \
      -o ServerAliveCountMax=3 \
      -o StrictHostKeyChecking=no \
      -R 80:localhost:$LOCAL_PORT \
      $REMOTE_HOST >> "$LOG_FILE" 2>&1
      
  echo "[$(date)] Tunnel connection dropped. Reconnecting in 5 seconds..." >> "$LOG_FILE"
  sleep 5
done
