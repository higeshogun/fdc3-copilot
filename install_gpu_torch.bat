@echo off
setlocal
title Installing PyTorch with CUDA Support

echo ==========================================
echo    Installing PyTorch (CUDA 12.4)
echo ==========================================

:: Activate venv
if not exist ".venv" (
    echo [ERROR] Virtual environment not found. Please run setup_windows.bat first.
    pause
    exit /b 1
)

echo [1/2] Uninstalling existing torch packages...
.venv\Scripts\pip uninstall -y torch torchvision torchaudio

echo.
echo [2/2] Installing PyTorch with CUDA 12.4...
.venv\Scripts\pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124

if %errorlevel% neq 0 (
    echo [ERROR] Installation failed.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo    Installation Complete!
echo ==========================================
pause
