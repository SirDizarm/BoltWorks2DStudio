@echo off
setlocal
title Uninstall 3D Model Studio
echo This will remove the installed 3D Model Studio from your computer.
echo.
choice /M "Do you want to continue"
if errorlevel 2 exit /b 0
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\Uninstall-3D-Model-Studio.ps1"
if errorlevel 1 (
  echo.
  echo Uninstall failed.
  pause
  exit /b 1
)
echo.
echo 3D Model Studio was uninstalled successfully.
pause
