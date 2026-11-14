@echo off
TITLE NR QR Print Shop Server
cd /d "%~dp0"
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
start "Pinggy Tunnel" cmd /k "ssh -p 443 -o StrictHostKeyChecking=no -R0:127.0.0.1:5000 a.pinggy.io"
node server.js
pause
