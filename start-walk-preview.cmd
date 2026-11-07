@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 24 LTS, then run this file again.
  pause
  exit /b 1
)
if not exist "node_modules\vite\bin\vite.js" (
  echo Dependencies are missing. Run npm ci in this project folder first.
  pause
  exit /b 1
)
if not exist "source_assets\pudding-walk.html" (
  echo The walk preview page is missing from this project folder.
  pause
  exit /b 1
)

echo Pudding Cat - walk preview
echo URL: http://127.0.0.1:5173/source_assets/pudding-walk.html
echo Keep this window open while viewing the preview.
echo Close this window or press Ctrl+C to stop the server.
echo.

set "PUDDING_PREVIEW_OPEN=--open /source_assets/pudding-walk.html"
if /I "%~1"=="--no-open" set "PUDDING_PREVIEW_OPEN="
node "node_modules\vite\bin\vite.js" --host 127.0.0.1 --port 5173 --strictPort %PUDDING_PREVIEW_OPEN%
if errorlevel 1 (
  echo.
  echo Preview could not start. If port 5173 is in use, close the other preview server first.
  pause
  exit /b 1
)
endlocal
