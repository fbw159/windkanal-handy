# Alle Formen nacheinander: Stabilität (umax) und Beiwerte nach n Schritten
import asyncio, sys, json
sys.path.insert(0, str(__import__('pathlib').Path(__file__).parent))
from pw import CHROME, URL
from playwright.async_api import async_playwright
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-first-run"]
part, nparts, steps = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3])
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
        pg = await b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1)
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto('file://' + str(__import__('pathlib').Path(__file__).resolve().parent.parent / 'index.html') + '?gitter=grob')
        await pg.wait_for_timeout(800)
        ids = await pg.evaluate("WH.SHAPES.map(s => s.id)")
        await pg.evaluate("App.running = false; App.speed = 30")
        for i, sid in enumerate(ids):
            if i % nparts != part: continue
            await pg.evaluate(f"WH.setShape('{sid}')")
            info = await pg.evaluate("({H: App.heightCells, L: App.lengthCells, re: physParams().reGrid, ground: physParams().ground})")
            q = 0.5 * 0.01 * (await pg.evaluate("refLength()"))
            hist = []
            for k in range(steps // 250):
                r = await pg.evaluate("(() => { WH.step(250); return WH.force(); })()")
                hist.append(r)
            tail = hist[len(hist) // 2:]
            cw = sum(h[0] for h in tail) / len(tail) / q; ca = sum(h[1] for h in tail) / len(tail) / q
            umax = max(h[2] for h in hist) / 0.1
            flag = ' !!' if not (umax < 3.0) else ''
            print(f"{sid:14s} H {info['H']:3d} L {info['L']:3d} Re {info['re']:5.0f} {'Boden' if info['ground'] else '     '}  cW {cw:6.2f} cA {ca:6.2f} umax/U {umax:4.2f}{flag}  Verlauf cW " + ' '.join(f"{h[0]/q:.2f}" for h in hist), flush=True)
            if errs: print('FEHLER', errs); errs.clear()
        await b.close()
asyncio.run(main())
