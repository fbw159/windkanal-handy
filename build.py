#!/usr/bin/env python3
"""Baut index.html (und sw.js) aus den Quellen in src/ – eine einzige Datei, direkt im Hauptordner (GitHub Pages)."""
import pathlib
root = pathlib.Path(__file__).parent
src = root / 'src'
luts = dict(l.strip().split('=', 1) for l in (src / 'luts.txt').read_text().splitlines() if '=' in l)
js = '\n'.join((src / f).read_text() for f in ['00_util.js', '10_shapes.js', '20_gl.js', '30_app.js'])
js = js.replace('__LUT_VEL__', luts['turbo']).replace('__LUT_PRES__', luts['coolwarm'])
css = (src / 'style.css').read_text()
page = (src / 'page.html').read_text().replace('/*__CSS__*/', css).replace('/*__JS__*/', js)
assert '</script' not in js and '</style' not in css
out = root / 'index.html'
out.write_text(page)
# Service Worker: Dateien für die Nutzung ohne Netz vorhalten; neue Fassung = neuer Speichername
import hashlib
h = hashlib.sha1(page.encode())
for f in ['sw.js', 'luts.txt']: h.update((src / f).read_bytes())
for f in ['manifest.webmanifest', 'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png']: h.update((root / f).read_bytes())
ver = h.hexdigest()[:10]
sw = (src / 'sw.js').read_text().replace('__VER__', ver)
(root / 'sw.js').write_text(sw)
print(out, len(page.encode()), 'Bytes, Fassung', ver)
