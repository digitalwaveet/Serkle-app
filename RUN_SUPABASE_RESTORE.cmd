@echo off
setlocal
title Serkle Supabase Database Restore

echo Serkle Supabase database restore
echo Target: fkeyentcklsuqecqgmak (eu-west-1)
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\supabase-migration\restore-database.ps1" -PoolerHost "aws-0-eu-west-1.pooler.supabase.com" -Execute
set "SERKLE_RESTORE_EXIT=%ERRORLEVEL%"

echo.
if "%SERKLE_RESTORE_EXIT%"=="0" (
  echo Restore command completed. Return to Codex and report the final message shown above.
) else (
  echo Restore command failed with exit code %SERKLE_RESTORE_EXIT%.
  echo Return to Codex with the error text above, but do not include your password.
)
echo.
pause
exit /b %SERKLE_RESTORE_EXIT%
