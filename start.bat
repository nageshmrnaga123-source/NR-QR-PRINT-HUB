@echo off
TITLE NR QR Print Shop Server
cd /d "%~dp0"

:: Close any process already using port 3000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
)

:: Install dependencies if node_modules is missing
IF NOT EXIST "node_modules" (
    call npm install
)

:: Start Pinggy tunnel using built-in SSH (no npx needed)
start "Pinggy Tunnel" cmd /k "ssh -p 443 -o StrictHostKeyChecking=no -R0:localhost:3000 a.pinggy.io"

:: Run the Node.js server
node server.js
