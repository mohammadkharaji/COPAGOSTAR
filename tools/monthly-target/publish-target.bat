@echo off
setlocal
chcp 65001 >nul
set /p MONTH=Target month (YYYY/MM, e.g. 1405/07): 
set /p SERVER=Server (e.g. root@194.5.205.59): 
set "WORKBOOK=%~dp0Target.xlsx"
if not exist "%WORKBOOK%" set /p WORKBOOK=Full path to Target.xlsx: 
python "%~dp0convert_target.py" "%WORKBOOK%" --month "%MONTH%" --check
if errorlevel 1 goto end
choice /M "Upload this target to the server"
if errorlevel 2 goto end
python "%~dp0convert_target.py" "%WORKBOOK%" --month "%MONTH%" --upload "%SERVER%" --key "%USERPROFILE%\.ssh\sr_deploy"
:end
pause
