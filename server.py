#!/usr/bin/env python3
"""Static file server + local categorize fallback."""

import json
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

from categorize import categorize

ROOT = Path(__file__).parent.resolve()
PORT = 5173


class KinshoutHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_POST(self):
        if self.path == "/api/categorize":
            self._handle_categorize()
            return
        self.send_error(404)

    def _handle_categorize(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode("utf-8") if length else "{}"
        try:
            data = json.loads(body)
            text = data.get("text", "")
        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON")
            return

        result = categorize(text)
        self._json_response(200, result)

    def _json_response(self, status: int, data: dict):
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self):
        if self.path == "/api/categorize":
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()
            return
        super().do_OPTIONS()

    def log_message(self, format, *args):
        if "/api/" in (args[0] if args else ""):
            super().log_message(format, *args)


if __name__ == "__main__":
    server = HTTPServer(("", PORT), KinshoutHandler)
    print(f"Kinshout → http://127.0.0.1:{PORT}")
    print("  POST /api/categorize — AI categorization (local fallback)")
    server.serve_forever()
