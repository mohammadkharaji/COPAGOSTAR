@echo off
setlocal
set "ROOT=%~dp0"
set "PUB=%ROOT%scripts\publish_to_server.ps1"
set "WB="
for %%F in ("%ROOT%40614*.xlsx") do if not defined WB if exist "%%~fF" set "WB=%%~fF"
if /I "%~1"=="-CheckOnly" goto check
if not "%~1"=="" set "WB=%~f1"
if not exist "%PUB%" goto missing_script
if not exist "%WB%" goto missing_workbook

echo Returns: convert, upload with SHA-256 checks, wait for sr-sync, then commit state.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PUB%" -ReturnsOnly -ReturnsWorkbook "%WB%"
if errorlevel 1 goto fail
echo Returns publish completed.
exit /b 0

:check
if not "%~2"=="" set "WB=%~f2"
if not exist "%PUB%" goto missing_script
if not exist "%WB%" goto missing_workbook
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PUB%" -ReturnsOnly -ReturnsWorkbook "%WB%" -CheckOnly
exit /b %errorlevel%

:missing_script
echo Publish script not found: "%PUB%"
exit /b 1
:missing_workbook
echo Returns workbook not found: "%WB%"
exit /b 1
:fail
echo Returns publish failed. State was not committed unless server sync succeeded.
exit /b 1
