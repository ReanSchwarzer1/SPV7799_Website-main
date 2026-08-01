@echo off
rem ------------------------------------------------------------
rem  One Molecule, Two Markets - Condition B (desktop app)
rem  Launches the Electron app. First run needs: npm install
rem ------------------------------------------------------------
cd /d "%~dp0"
if not exist "node_modules\electron" (
  echo Installing dependencies, one time only...
  call npm install
)
call npx electron .
