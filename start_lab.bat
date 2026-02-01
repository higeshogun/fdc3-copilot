@echo off
title Interop AI Lab - Startup Manager
echo --------------------------------------------------
echo    Starting Interop AI Lab
echo --------------------------------------------------

:: 1. External LLM Connected (llama.cpp on port 8081)
:: set OLLAMA_ORIGINS=chrome-extension://*
:: set OLLAMA_DEBUG=1

:: 2. Start Ollama (DISABLED - Using External Server)
echo [1/3] Using External LLM Server at port 8081...
:: start /min "Ollama Service" ollama serve

:: 3. Wait for Ollama to initialize (approx 5 seconds)
:: timeout /t 5 /nobreak > nul

:: 4. Verify GPU Status
echo [2/3] Verifying LLM Connectivity...
.venv\Scripts\python analyst/check_gpus.py

echo [3/3] Running Workflow Analyst (Mistral)...
:: Run connection test or actual analysis if needed (optional integration)
:: .venv\Scripts\python analyst/workflow_analyst.py --model mistral --test

:: 5. Open Chrome (Optional)
echo [3/3] Ready! Opening Chrome...
:: Note: Replace with your actual app URL if needed
:: start chrome "https://your-interop-app.com"

echo --------------------------------------------------
echo ✅ Lab is Active. Logs are being captured.
echo --------------------------------------------------
pause
