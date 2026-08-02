@echo off
setlocal
rem ------------------------------------------------------------
rem  One Molecule, Two Markets - Condition B (desktop app)
rem
rem  This script runs Condition B FROM SOURCE, which needs
rem  Node.js and a one-time download of about 200 MB.
rem
rem  If you were sent this project to test the game, do NOT use
rem  this file. Use the prebuilt executable instead:
rem      "One Molecule Two Markets 1.0.0.exe"
rem  It needs no Node.js, no install and no internet.
rem ------------------------------------------------------------
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto nonode

where npm >nul 2>nul
if errorlevel 1 goto nonode

if not exist "node_modules\electron\package.json" (
  echo.
  echo Installing dependencies. This happens once and downloads
  echo roughly 200 MB, so it needs a working internet connection.
  echo.
  call npm install
  if errorlevel 1 goto installfailed
)

call npx electron .
if errorlevel 1 goto runfailed
goto end

:nonode
echo.
echo ============================================================
echo  Node.js was not found on this computer.
echo ============================================================
echo.
echo  Running Condition B from source requires Node.js.
echo.
echo  You probably do not want to do that. To test the game, ask
echo  for the prebuilt file instead:
echo.
echo      One Molecule Two Markets 1.0.0.exe
echo.
echo  That file is self-contained. Double-click it and the game
echo  starts. There is nothing to install.
echo.
echo  If you do need to run from source, install the LTS build
echo  of Node.js from https://nodejs.org and run this again.
echo.
pause
exit /b 1

:installfailed
echo.
echo ============================================================
echo  Dependency install failed.
echo ============================================================
echo.
echo  This is usually no internet, a proxy, or a firewall
echo  blocking the Electron download.
echo.
echo  Use the prebuilt "One Molecule Two Markets 1.0.0.exe"
echo  instead. It needs neither.
echo.
pause
exit /b 1

:runfailed
echo.
echo  The app exited with an error. If you were testing the game,
echo  use the prebuilt "One Molecule Two Markets 1.0.0.exe".
echo.
pause
exit /b 1

:end
endlocal
