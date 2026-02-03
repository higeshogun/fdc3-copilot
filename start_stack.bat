@echo off
title Interop Stack Launcher
echo --------------------------------------------------
echo    Starting Interop AI Stack
echo --------------------------------------------------

:: 1. Start Mock OMS App (Port 5173)
echo [1/2] Starting Mock OMS App (Port 5173)...
start "Mock App" /min cmd /k "python mock_app/serve_mock.py"

:: 2. Run Lab Startup (GPU Checks / Analyst Layer)
echo [2/2] Starting Analyst Backend...
start "Analyst Backend" cmd /k "start_lab.bat"

echo.
echo Waiting for services to initialize...
timeout /t 4 /nobreak > nul

echo Opening Workstation...
start http://localhost:5173

echo.
echo ✅ Stack Launched!
ping 127.0.0.1 -n 3 > nul
exit
