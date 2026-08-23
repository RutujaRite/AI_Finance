@echo off
title Python Login Page
echo Installing required packages...
pip install -r requirements.txt
if errorlevel 1 (
  echo.
  echo ERROR: pip install failed. Make sure Python is installed.
  pause
  exit /b 1
)
echo.
echo Starting login page...
start "" http://localhost:3000
python app.py
pause
