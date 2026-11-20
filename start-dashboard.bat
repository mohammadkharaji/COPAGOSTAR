@echo off
setlocal
set "ROOT=%~dp0"
set "PY=%ROOT%backend\.venv\Scripts\python.exe"

if exist "%LOCALAPPDATA%\hermes\node\node.exe" (
  set "PATH=%LOCALAPPDATA%\hermes\node;%PATH%"
)
if exist "%USERPROFILE%\.bun\bin\bun.exe" (
  set "PATH=%USERPROFILE%\.bun\bin;%PATH%"
)

if exist "%ROOT%auth.local.bat" call "%ROOT%auth.local.bat"

if not exist "%PY%" (
  echo Backend environment not found: %PY%
  echo Run once: cd /d "%ROOT%backend" ^&^& uv sync
  pause
  exit /b 1
)

if not exist "%ROOT%frontend\node_modules" (
  echo Installing frontend packages, first run only...
  pushd "%ROOT%frontend"
  call npm install
  popd
)

netstat -ano | findstr ":8000 " | findstr LISTENING >nul && (
  echo Backend already running on port 8000, skipping.
) || (
  start "SR Backend" /D "%ROOT%backend" cmd /k ""%PY%" -m uvicorn app.api:app --port 8000"
)

netstat -ano | findstr ":5173 " | findstr LISTENING >nul && (
  echo Frontend already running on port 5173, skipping.
) || (
  start "SR Frontend" /D "%ROOT%frontend" cmd /k "npm run dev"
)

start "SR Sync Watcher" /D "%ROOT%" cmd /k ""%PY%" -X utf8 scripts\sync.py"

echo Waiting for servers...
timeout /t 5 /nobreak >nul
start "" "http://127.0.0.1:5173"
exit /b 0
