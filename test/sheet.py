# Kontaktbogen aller Formen als PNG (headless Chromium)
import asyncio, sys, re
sys.path.insert(0, str(__import__('pathlib').Path(__file__).parent))
from pw import CHROME
from playwright.async_api import async_playwright
src = open(str(__import__('pathlib').Path(__file__).resolve().parent.parent / 'src' / '10_shapes.js'), encoding='utf-8').read()
html = f"""<!doctype html><html><body style="margin:0;background:#0b1016;color:#e6ebf0;font:12px sans-serif">
<div id=g style="display:grid;grid-template-columns:repeat(6,220px);gap:6px;padding:8px"></div>
<script>{src}
const g = document.getElementById('g');
for (const s of SHAPES) {{
  const d = document.createElement('div');
  d.innerHTML = `<svg width="220" height="110" viewBox="-10 -5 220 110" style="background:#141c24;border-radius:6px"><line x1="-10" y1="100" x2="210" y2="100" stroke="#3a4a5a"/><path d="${{s.path}}" fill="#c9d1da"/></svg><div style="padding:2px 6px">${{s.name}}<span style="color:#8e9cab"> ${{s.id}} ${{s.ground ? '· Boden' : ''}}</span></div>`;
  g.appendChild(d);
}}
</script></body></html>"""
open('' + str(__import__('pathlib').Path(__file__).parent) + '/sheet.html', 'w', encoding='utf-8').write(html)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, headless=True)
        pg = await b.new_page(viewport={"width": 1380, "height": 1400})
        await pg.goto('file://' + str(__import__('pathlib').Path(__file__).parent) + '/sheet.html')
        await pg.screenshot(path='' + str(__import__('pathlib').Path(__file__).parent) + '/sheet.png', full_page=True)
        await b.close()
asyncio.run(main())
print('ok')
