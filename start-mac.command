#!/bin/bash
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Chưa cài Node.js. Tải tại https://nodejs.org rồi chạy lại."; read; exit 1; }
(sleep 1; open http://localhost:3000) &
node server.js
