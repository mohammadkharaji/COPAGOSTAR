@echo off
setlocal
set "ROOT=%~dp0"
set "PUB=%ROOT%scripts\publish_to_server.ps1"
set "WB=%ROOT%SR-1405.xlsx"
if /I "%~1"=="-CheckOnly" goto check
if not "%~1"=="" set "WB=%~f1"
if not exist "%PUB%" goto missing_script
if not exist "%WB%" goto missing_workbook

echo Sales: export current and previous Jalali months, upload and verify server sync.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PUB%" -Scope recent -SalesWorkbook "%WB%"
if errorlevel 1 goto fail
echo Sales publish completed.
exit /b 0

:check
if not "%~2"=="" set "WB=%~f2"
if not exist "%PUB%" goto missing_script
if not exist "%WB%" goto missing_workbook
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PUB%" -Scope recent -SalesWorkbook "%WB%" -CheckOnly
exit /b %errorlevel%

:missing_script
echo Publish script not found: "%PUB%"
exit /b 1
:missing_workbook
echo Sales workbook not found: "%WB%"
exit /b 1
:fail
echo Sales publish failed. Check the error above; do not assume server sync succeeded.
exit /b 1
