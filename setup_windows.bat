@echo off
setlocal
title Interop Trader - Windows Setup

echo ==========================================
echo    Interop Trader - Windows Setup
echo ==========================================

:: 1. Check for Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH.
    echo Please install Python 3.10+ and try again.
    pause
    exit /b 1
)

:: 2. Create Virtual Environment
if not exist ".venv" (
    echo [1/4] Creating virtual environment...
    python -m venv .venv
) else (
    echo [1/4] Virtual environment already exists.
)

:: 3. Install Dependencies
echo [2/4] Installing dependencies...
.venv\Scripts\pip install -r analyst\requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b 1
)

:: 4. Extension Configuration
echo.
echo [3/4] Native Messaging Host Configuration
echo ------------------------------------------
echo Please enter the Chrome Extension ID.
echo (Found in chrome://extensions after loading the 'extension' folder)
set /p EXT_ID="Extension ID: "

if "%EXT_ID%"=="" (
    echo [ERROR] Extension ID is required.
    pause
    exit /b 1
)

:: Use Python to generate JSON and Reg files safely
echo Generating configuration files...
.venv\Scripts\python -c "import json; import os; import sys; cwd = os.getcwd().replace('\\', '\\\\'); json_path = os.path.join(cwd, 'analyst', 'host', 'com.interop.ai.lab.json').replace('\\', '\\\\'); host_json = {'name': 'com.interop.ai.lab', 'description': 'FDC3 Session Analyst Host', 'path': 'host.bat', 'type': 'stdio', 'allowed_origins': [f'chrome-extension://{sys.argv[1]}/']}; open('analyst/host/com.interop.ai.lab.json', 'w').write(json.dumps(host_json, indent=4)); reg_content = 'Windows Registry Editor Version 5.00\n\n[HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts\com.interop.ai.lab]\n@=\"' + json_path + '\"\n'; open('analyst/install_host.reg', 'w').write(reg_content);" %EXT_ID%

if %errorlevel% neq 0 (
    echo [ERROR] Failed to generate configuration files.
    pause
    exit /b 1
)

:: 5. Register Host
echo [4/4] Registering Native Messaging Host...
reg import analyst\install_host.reg
if %errorlevel% neq 0 (
    echo [ERROR] Failed to update Registry.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo    Setup Complete!
echo ==========================================
echo 1. Open 'extension/manifest.json' and verify 'allowed_origins' if needed (usually handled by ID check).
echo 2. Run 'start_lab.bat' to start the backend.
echo.
pause
