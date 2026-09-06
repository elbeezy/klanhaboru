@echo off
rem Runs the SZEM4 tests. Double-click this file.
rem
rem The tests read scripts/SZEM4.js over HTTP, which a browser refuses to do
rem from a plain file on disk, so this serves the repository on a local port
rem first and then opens the page. Close this window when you are done.

cd /d "%~dp0.."

echo Starting a local server on port 8765...
start "" "http://localhost:8765/tests/"
echo.
echo   Test page: http://localhost:8765/tests/
echo   Press Ctrl+C or close this window to stop.
echo.
echo   Nothing opened? Another program may already be using port 8765.
echo   Open run.cmd in Notepad and change 8765 to another number, in both places.
echo.

python -m http.server 8765
