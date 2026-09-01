@echo off
title Node Login Page
echo Installing required packages...
call npm install
if errorlevel 1 (
  echo.
  echo ERROR: npm install failed. Make sure Node.js is installed.
  pause
  exit /b 1
)
echo.
echo Starting login page...
start "" http://localhost:3000
node server.js
pause
