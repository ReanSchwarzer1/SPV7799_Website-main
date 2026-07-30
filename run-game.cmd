@echo off
rem ------------------------------------------------------------
rem  One Molecule, Two Markets - gamified version launcher
rem  Starts a local server (needed for the 3D scenes) and opens
rem  the game in the default browser. Requires Node.js.
rem  Keep this window open while playing; close it to stop.
rem ------------------------------------------------------------
cd /d "%~dp0"
echo Starting the local server for the gamified site...
start /b cmd /c "timeout /t 2 >nul & start http://localhost:3210/index-gamified.html"
npx -y serve -l 3210 .
