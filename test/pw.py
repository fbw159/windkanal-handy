# Pfad zum Chromium von Playwright (headless, Software-Rendering); bei Bedarf über die Umgebung setzen
import os, glob
CHROME = os.environ.get('CHROME') or (sorted(glob.glob('/opt/pw-browsers/chromium-*/chrome-linux/chrome')) or [None])[-1]
URL = 'file://' + str(__import__('pathlib').Path(__file__).resolve().parent.parent / 'index.html')
