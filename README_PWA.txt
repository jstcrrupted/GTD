Как запустить как приложение (PWA)

1) Положите все файлы в одну папку:
   - GTD_Pro_App.html
   - manifest.json
   - sw.js
   - icons/icon-192.png
   - icons/icon-512.png

2) Запускайте через локальный сервер (важно для Service Worker):
   - Python:  python -m http.server 8000
   - Затем открыть: http://localhost:8000/GTD_Pro_App.html

3) Для установки как приложение:
   - Откройте по HTTPS (или localhost) и нажмите в Настройках: "Установить приложение"
