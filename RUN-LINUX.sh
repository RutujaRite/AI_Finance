#!/bin/bash
set -e
echo "Installing required packages..."
pip install -r requirements.txt
echo "Starting login page..."
( sleep 2; xdg-open http://localhost:3000 >/dev/null 2>&1 || true ) &
python3 app.py
