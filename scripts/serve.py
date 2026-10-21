#!/usr/bin/env python3
"""Lokalni predogled strani brez predpomnjenja: python3 scripts/serve.py [vrata]"""
import functools
import http.server
import os
import sys

SITE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "site")


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
print("http://127.0.0.1:%d" % port)
http.server.ThreadingHTTPServer(("127.0.0.1", port), functools.partial(NoCache, directory=SITE)).serve_forever()
