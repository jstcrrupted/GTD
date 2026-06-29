# Dev static server with no-store caching, so edited files are always served fresh.
# Usage: py tools/devserver.py [port]
import http.server, socketserver, sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8126

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        super().end_headers()

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('', PORT), Handler) as httpd:
    print(f'devserver on http://localhost:{PORT}')
    httpd.serve_forever()
