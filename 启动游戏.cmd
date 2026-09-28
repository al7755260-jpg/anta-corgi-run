@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if not errorlevel 1 (
  node launch.mjs
  exit /b
)
if defined NODE_HOME if exist "%NODE_HOME%\node.exe" (
  "%NODE_HOME%\node.exe" launch.mjs
  exit /b
)
echo 请先安装 Node.js 20.19 或更新版本，然后重试。
pause
