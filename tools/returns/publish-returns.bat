@echo off
setlocal
chcp 65001 >nul
set "WORKBOOK=%~1"
if "%WORKBOOK%"=="" set /p WORKBOOK=Path to daily returns workbook:
if not exist "%WORKBOOK%" (
  echo Workbook not found: "%WORKBOOK%"
  pause
  exit /b 1
)
python "%~dp0convert_returns.py" "%WORKBOOK%" --check
if errorlevel 1 goto end
python "%~dp0convert_returns.py" "%WORKBOOK%" --dry-run
if errorlevel 1 goto end
choice /M "Write the delta file locally (state is updated)"
if errorlevel 2 goto end
set /p SERVER=Server to upload to (e.g. root@194.5.205.59, empty = local only):
if "%SERVER%"=="" (
  python "%~dp0convert_returns.py" "%WORKBOOK%"
) else (
  python "%~dp0convert_returns.py" "%WORKBOOK%" --upload "%SERVER%" --key "%USERPROFILE%\.ssh\sr_deploy"
)
:end
pause
