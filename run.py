from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os, webbrowser
root=Path(__file__).parent/'frontend'; os.chdir(root)
url='http://127.0.0.1:8000'; print('Open:',url); webbrowser.open(url)
ThreadingHTTPServer(('127.0.0.1',8000),SimpleHTTPRequestHandler).serve_forever()
