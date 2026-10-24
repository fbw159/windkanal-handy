# Lange Läufe für einige Formen: Beiwerte nach dem Einschwingen (Mittel über das letzte Drittel), Verlauf alle 250 Schritte
import asyncio, sys
sys.path.insert(0, str(__import__('pathlib').Path(__file__).parent))
from pw import CHROME, URL
from playwright.async_api import async_playwright
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-first-run"]
shapes = sys.argv[1].split(','); steps = int(sys.argv[2]); grid = sys.argv[3] if len(sys.argv) > 3 else 'grob'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
        pg = await b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1)
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f'{URL}?gitter={grid}')
        await pg.wait_for_timeout(800)
        await pg.evaluate("App.running = false; App.speed = 30")
        for sid in shapes:
            await pg.evaluate(f"WH.setShape('{sid}')")
            info = await pg.evaluate("({H: App.heightCells, L: App.lengthCells, re: physParams().reGrid, nx: lbm.nx, ny: lbm.ny})")
            q = 0.5 * 0.01 * (await pg.evaluate("refLength()"))
            hist = []
            for k in range(steps // 250):
                # Mittel über die 250 Schritte (alle 10 Schritte lesen)
                r = await pg.evaluate("(() => { let fx = 0, fy = 0, um = 0; for (let j = 0; j < 25; j++) { WH.step(10); const f = WH.force(); fx += f[0]; fy += f[1]; um = Math.max(um, f[2]); } return [fx / 25, fy / 25, um]; })()")
                hist.append(r)
            tail = hist[2 * len(hist) // 3:]
            cw = sum(h[0] for h in tail) / len(tail) / q; ca = sum(h[1] for h in tail) / len(tail) / q
            umax = max(h[2] for h in hist) / 0.1
            print(f"{sid:14s} {info['nx']}x{info['ny']} H {info['H']:3d} L {info['L']:3d} Re {info['re']:5.0f}  cW {cw:6.2f} cA {ca:6.2f} umax/U {umax:4.2f}  Verlauf cW " + ' '.join(f"{h[0]/q:.2f}" for h in hist), flush=True)
            if errs: print('FEHLER', errs); errs.clear()
        await b.close()
asyncio.run(main())
