@echo off
setlocal DisableDelayedExpansion
chcp 65001 >nul
set "WORKBOOK="
set /p "WORKBOOK=Target workbook (Target.MM.xlsx in the project folder, or absolute path): "
set "TARGET_CONVERTER=%~dp0convert_target.py"
set "SR_ROOT=%~dp0..\.."
set "PYTHON=%SR_ROOT%\backend\.venv\Scripts\python.exe"
if not exist "%PYTHON%" (
  echo Backend Python not found: "%PYTHON%"
  echo Run: cd /d "%SR_ROOT%\backend" ^&^& uv sync
  set "RESULT=2"
  goto report
)
echo.
echo Validating workbook and preparing target data...
powershell -NoProfile -Command "$ErrorActionPreference = 'Stop'; try { $entered = $env:WORKBOOK; $name = [IO.Path]::GetFileName($entered); $match = [regex]::Match($name, '^Target\.(0[1-9]|1[0-2])\.xlsx$'); if (-not $match.Success) { throw 'Expected Target.MM.xlsx, with MM from 01 to 12.' }; if ($entered -cne $name -and $entered -notmatch '^(?:[A-Za-z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+[\\/])') { throw 'Use a filename or an absolute path.' }; $workbook = if ($entered -ceq $name) { Join-Path $env:SR_ROOT $name } else { $entered }; if (-not (Test-Path -LiteralPath $workbook -PathType Leaf)) { throw ('Workbook not found: ' + $workbook) }; $month = '1405/' + $match.Groups[1].Value; & $env:PYTHON $env:TARGET_CONVERTER $workbook --month $month --check; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; Write-Host 'Validation complete. Uploading target to server...'; & $env:PYTHON $env:TARGET_CONVERTER $workbook --month $month --upload root@178.252.136.184 --key (Join-Path $env:USERPROFILE '.ssh\sr_deploy') --port 2222; exit $LASTEXITCODE } catch { Write-Error $_; exit 2 }"
set "RESULT=%ERRORLEVEL%"
:report
echo.
if "%RESULT%"=="0" (echo Target published successfully.) else if "%RESULT%"=="3" (echo Target publication cancelled. Existing server file was not replaced.) else (echo Target publication failed with exit code %RESULT%. Read the message above.)
echo.
pause
exit /b %RESULT%
