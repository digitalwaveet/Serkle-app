@echo off
setlocal
title Serkle Supabase Post-Data Resume

echo Serkle Supabase post-data restore resume
echo This does not reinsert table rows.
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\supabase-migration\resume-post-data.ps1"
set "SERKLE_RESUME_EXIT=%ERRORLEVEL%"

echo.
if "%SERKLE_RESUME_EXIT%"=="0" (
  echo Post-data resume command completed.
) else (
  echo Post-data resume failed with exit code %SERKLE_RESUME_EXIT%.
  echo Return to Codex with the error text above, but do not include your password.
)
echo.
pause
exit /b %SERKLE_RESUME_EXIT%
