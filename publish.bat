@echo off
echo ==========================================
echo      FDC3 Copilot - GitHub Publisher
echo ==========================================
echo.

echo [1/4] Git Configuration
echo Please enter your identity for the commit history.
set /p git_email="Enter your Email: "
set /p git_name="Enter your Name: "

git config --global user.email "%git_email%"
git config --global user.name "%git_name%"

echo.
echo [2/4] Initializing Repository
git init
git add .
git commit -m "Initial release of FDC3 Copilot"

echo.
echo [3/4] Remote Configuration
echo Please create a new empty repository on GitHub: https://github.com/new
echo (Do not add README or .gitignore, we have them already)
echo.
set /p repo_url="Enter the Repository URL (e.g., https://github.com/user/repo.git): "

git remote remove origin 2>nul
git remote add origin %repo_url%
git branch -M main

echo.
echo [4/4] Pushing to GitHub
echo You may be asked to sign in to GitHub in the popup window.
git push -u origin main

echo.
echo ==========================================
echo      SUCCESS! Project Published.
echo ==========================================
pause
