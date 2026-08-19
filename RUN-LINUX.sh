#!/bin/bash
set -e
echo "Installing required packages..."
npm install
echo "Starting login page..."
( sleep 2; xdg-open http://localhost:3000 >/dev/null 2>&1 || true ) &
node server.js
