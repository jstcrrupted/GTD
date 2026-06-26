Как запустить как приложение (PWA)

1) Положите все файлы в одну папку:
   - index.html
   - css/styles.css
   - js/ (модули приложения: app.js и остальные)
   - manifest.json
   - sw.js
   - icons/icon-192.png
   - icons/icon-512.png

2) Запускайте через локальный сервер (важно для Service Worker и ES-модулей):
   - Python:  python -m http.server 8000
   - Затем открыть: http://localhost:8000/ (или http://localhost:8000/index.html)

3) Для установки как приложение:
   - Откройте по HTTPS (или localhost) и нажмите в Настройках: "Установить приложение"
