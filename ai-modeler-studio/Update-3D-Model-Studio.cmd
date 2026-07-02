@echo off
setlocal
title Update 3D Model Studio
echo Updating 3D Model Studio...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\Install-3D-Model-Studio.ps1"
if errorlevel 1 (
  echo.
  echo Update failed.
  pause
  exit /b 1
)
echo.
echo 3D Model Studio updated successfully.
pause
