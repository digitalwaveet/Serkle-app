@echo off
setlocal
cd /d "%~dp0"
title Serkle Supabase Storage Upload
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\supabase-migration\upload-storage-backup.ps1"
set "RESULT=%ERRORLEVEL%"
echo.
if not "%RESULT%"=="0" (
  echo Storage upload stopped with exit code %RESULT%.
  echo Return to Codex with the visible error, but do not include either S3 credential.
) else (
  echo Storage upload and verification finished successfully.
)
echo.
pause
exit /b %RESULT%
