@echo off
title Stop Interop Stack
echo --------------------------------------------------
echo    Stopping Interop AI Stack
echo --------------------------------------------------

echo Killing Mock OMS App...
taskkill /FI "WINDOWTITLE eq Mock App*" /T /F 2>nul
if %errorlevel% neq 0 echo   (Not running or already stopped)

echo Killing Analyst Backend...
taskkill /FI "WINDOWTITLE eq Analyst Backend*" /T /F 2>nul
if %errorlevel% neq 0 echo   (Not running or already stopped)

echo.
echo ✅ Stack Stopped.
timeout /t 2 /nobreak > nul
