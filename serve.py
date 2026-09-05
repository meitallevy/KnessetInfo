#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
מגיש את האתר מקומית, לבדיקה לפני העלאה.

    python3 serve.py            ואז פתחי http://localhost:8000
    python3 serve.py --port 9000

תומך בבקשות Range, מה ש-http.server הרגיל לא עושה. זה נדרש אם
בעתיד נעבור לטעינה חלקית של ה-DB במקום הורדה מלאה — וגם מאפשר
לדפדפן לחדש הורדה שנקטעה.

מהטלפון: הריצי, ואז גשי מהמחשב לכתובת ה-IP שתודפס.
"""
import argparse, http.server, os, re, socket, socketserver, sys

MIME = {".db": "application/octet-stream", ".json": "application/json",
        ".html": "text/html; charset=utf-8", ".md": "text/markdown; charset=utf-8"}


class H(http.server.SimpleHTTPRequestHandler):
    def guess_type(self, path):
        return MIME.get(os.path.splitext(path)[1], super().guess_type(path))

    def end_headers(self):
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def send_head(self):
        """כמו המקורי, אבל מכבד Range."""
        rng = self.headers.get("Range")
        if not rng:
            return super().send_head()
        path = self.translate_path(self.path)
        if os.path.isdir(path) or not os.path.exists(path):
            return super().send_head()
        m = re.match(r"bytes=(\d*)-(\d*)", rng)
        if not m:
            return super().send_head()
        size = os.path.getsize(path)
        a, b = m.group(1), m.group(2)
        if a == "":                       # bytes=-N — הסוף
            start, end = max(0, size - int(b)), size - 1
        else:
            start = int(a)
            end = int(b) if b else size - 1
        end = min(end, size - 1)
        if start > end:
            self.send_error(416); return None
        f = open(path, "rb"); f.seek(start)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        self._left = end - start + 1
        return f

    def copyfile(self, src, dst):
        left = getattr(self, "_left", None)
        if left is None:
            return super().copyfile(src, dst)
        while left > 0:
            chunk = src.read(min(65536, left))
            if not chunk: break
            dst.write(chunk); left -= len(chunk)

    def log_message(self, fmt, *a):
        s = fmt % a
        if " 200 " in s or " 206 " in s or "304" in s:
            return                         # רק שגיאות
        sys.stderr.write("  " + s + "\n")


def my_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80)); ip = s.getsockname()[0]; s.close()
        return ip
    except Exception:
        return None


class Srv(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8000)
    a = ap.parse_args()
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    missing = [f for f in ("index.html", "knesset_web.db") if not os.path.exists(f)]
    if missing:
        sys.exit("חסרים קבצים: " + ", ".join(missing) +
                 "\nהריצי מתוך התיקייה שבה יושב index.html.")

    ip = my_ip()
    print(f"""
מדד הכנסת רץ.

  במכשיר הזה:   http://localhost:{a.port}
""" + (f"  ברשת המקומית: http://{ip}:{a.port}\n" if ip else "") + """
Ctrl+C לעצירה.
""")
    try:
        Srv(("", a.port), H).serve_forever()
    except KeyboardInterrupt:
        print("נעצר.")
