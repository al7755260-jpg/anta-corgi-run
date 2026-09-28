@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell -NoProfile -Command "$pidPath = Join-Path (Get-Location) '.game-server.pid'; if (Test-Path -LiteralPath $pidPath) { $gamePid = [int](Get-Content -LiteralPath $pidPath); $gameProcess = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $gamePid); if ($gameProcess -and $gameProcess.CommandLine -like '*server.mjs*' -and $gameProcess.CommandLine -like ('*' + (Get-Location).Path + '*')) { Stop-Process -Id $gamePid; Remove-Item -LiteralPath $pidPath } }"
