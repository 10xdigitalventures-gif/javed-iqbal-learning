@echo off
REM ============================================================
REM  start-server.bat  -  boots the whole platform on Windows.
REM  Called automatically by Task Scheduler at system startup,
REM  and can also be double-clicked to start manually.
REM ============================================================

SET PROJECT_ROOT=E:\Programs\javed-iqbal-learning-platform\consultant-platform
cd /d "%PROJECT_ROOT%"

echo [start-server] %DATE% %TIME% booting platform... >> "%PROJECT_ROOT%\logs\startup.log"

REM --- Start / restore all PM2 services (backend, web, marketplace, watcher) ---
call pm2 resurrect
call pm2 start ecosystem.config.js
call pm2 save

REM --- Start Nginx if it is not already running ---
tasklist /FI "IMAGENAME eq nginx.exe" | find /I "nginx.exe" >nul
if errorlevel 1 (
    echo [start-server] starting nginx >> "%PROJECT_ROOT%\logs\startup.log"
    start "" /d C:\nginx C:\nginx\nginx.exe
) else (
    echo [start-server] reloading nginx >> "%PROJECT_ROOT%\logs\startup.log"
    C:\nginx\nginx.exe -s reload
)

echo [start-server] done. >> "%PROJECT_ROOT%\logs\startup.log"
