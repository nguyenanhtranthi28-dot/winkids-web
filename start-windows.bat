@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul || (echo Chua cai Node.js. Tai tai https://nodejs.org roi chay lai file nay. & pause & exit /b)
start "" http://localhost:3000
node server.js
pause
