@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js 24 LTS is required.
  pause
  exit /b 1
)
echo Frankie character extraction - source frames 277-404
echo The supplied Blender source will not be overwritten.
echo.
node scripts/export-frankie.mjs
if errorlevel 1 (
  echo.
  echo Extraction stopped. Please share the error shown above.
  pause
  exit /b 1
)
echo.
echo Extraction completed. Keep any preview server window open while viewing.
pause
endlocal
