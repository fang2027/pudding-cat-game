@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js 24 LTS is required.
  pause
  exit /b 1
)
if not exist "node_modules\vite\bin\vite.js" (
  echo Run npm ci in this project folder first.
  pause
  exit /b 1
)
echo Pudding Cat - game preview
echo Keep this window open while playing. Press Ctrl+C to stop.
echo URL: http://127.0.0.1:5173/
node "node_modules\vite\bin\vite.js" --host 127.0.0.1 --port 5173 --strictPort --open /
if errorlevel 1 (
  echo.
  echo If port 5173 is already in use, open http://127.0.0.1:5173/ in your browser.
  pause
  exit /b 1
)
endlocal
