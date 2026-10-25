# cW einer Form headless: Schritte treiben, Kraft lesen (Mittel über das letzte Drittel)
import asyncio, sys, json
sys.path.insert(0, str(__import__('pathlib').Path(__file__).parent))
from pw import CHROME, URL
from playwright.async_api import async_playwright
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-first-run"]
shape = sys.argv[1] if len(sys.argv) > 1 else 'kreis'; steps = int(sys.argv[2]) if len(sys.argv) > 2 else 3000; grid = sys.argv[3] if len(sys.argv) > 3 else 'grob'
speed = sys.argv[4] if len(sys.argv) > 4 else '30'; shot = sys.argv[5] if len(sys.argv) > 5 else ''
recap = float(sys.argv[6]) if len(sys.argv) > 6 else 0   # Reynoldszahl erzwingen (0: wie die App)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
        pg = await b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1)
        logs = []
        pg.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
        await pg.goto(f'{URL}?form={shape}&gitter={grid}' + (f'&remax={int(recap)}' if recap else '') + __import__('os').environ.get('WHQS', ''))
        await pg.wait_for_timeout(800)
        await pg.evaluate(f"App.running = false; App.speed = {speed}; WH.setShape('{shape}')")
        if recap: await pg.evaluate(f"App.nuMin = 0.1 * App.lengthCells / {recap}")
        info = await pg.evaluate("({nx: lbm.nx, ny: lbm.ny, H: App.heightCells, L: App.lengthCells, p: physParams()})")
        print(info)
        t0 = asyncio.get_event_loop().time(); hist = []
        chunk = 100
        for k in range(steps // chunk):
            r = await pg.evaluate(f"(() => {{ WH.step({chunk}); const f = WH.force(); return f; }})()")
            hist.append(r)
        dt = asyncio.get_event_loop().time() - t0
        H = info['H']; q = 0.5 * 0.1 * 0.1 * H
        n = len(hist); tail = hist[2 * n // 3:]
        cd = sum(h[0] for h in tail) / len(tail) / q; cl = sum(h[1] for h in tail) / len(tail) / q
        umax = max(h[2] for h in hist)
        print(f"{shape}: {steps} Schritte in {dt:.0f} s ({steps/dt:.0f}/s), cW {cd:.3f} cA {cl:.3f} umax/U {umax/0.1:.2f}")
        print(' Verlauf cW:', ' '.join(f"{h[0]/q:.2f}" for h in hist[::max(1, n // 15)]))
        print(' Verlauf umax/U:', ' '.join(f"{h[2]/0.1:.2f}" for h in hist[::max(1, n // 15)]))
        if shot:
            await pg.evaluate("App.mode = 0; for (let k = 0; k < 40; k++) lbm.dye(20, 12, 0);")
            await pg.evaluate("lbm.draw(0, physParams(), lbm.canvas.width, lbm.canvas.height)")
            await pg.screenshot(path=shot)
        print("\n".join(logs)[:1000])
        await b.close()
asyncio.run(main())
