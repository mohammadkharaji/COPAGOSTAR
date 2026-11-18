@echo off
setlocal
chcp 65001 >nul
set "WORKBOOK=%~1"
if "%WORKBOOK%"=="" set /p WORKBOOK=Path to Product.xlsx:
if not exist "%WORKBOOK%" (
  echo Workbook not found: "%WORKBOOK%"
  pause
  exit /b 1
)
python "%~dp0convert_product.py" "%WORKBOOK%" --check
if errorlevel 1 goto end
python "%~dp0convert_product.py" "%WORKBOOK%" --dry-run
if errorlevel 1 goto end
choice /M "Write product.tsv locally"
if errorlevel 2 goto end
set /p SERVER=Server to upload to (e.g. root@178.252.136.184, empty = local only):
if not "%SERVER%"=="" goto remote
python "%~dp0convert_product.py" "%WORKBOOK%"
goto end

:remote
set /p PORT=SSH port (Enter = 2222):
if "%PORT%"=="" set "PORT=2222"
python "%~dp0convert_product.py" "%WORKBOOK%" --upload "%SERVER%" --key "%USERPROFILE%\.ssh\sr_deploy" --port %PORT%

:end
pause
