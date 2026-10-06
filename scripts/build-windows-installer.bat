@echo off
title Build PC Bastos Harvest 2026 - Windows Desktop Installer
echo ===================================================================
echo   PC BASTOS HARVEST 2026 - WINDOWS DESKTOP INSTALLER BUILDER
echo ===================================================================
echo.
echo Building standalone Windows (.exe) installer and portable app into dist/...
npm run dist
echo.
echo Build complete! Check the dist/ folder for your installer:
echo - dist/PC Bastos Harvest 2026 Setup 1.0.0.exe (Full Windows Installer)
echo - dist/PC Bastos Harvest 2026 1.0.0.exe (Portable Windows App)
pause
