# Bilder aller Darstellungen nach n Schritten (headless, langsam): Rauch, Tempo, Druck, Wirbel
import asyncio, sys
sys.path.insert(0, str(__import__('pathlib').Path(__file__).parent))
from pw import CHROME, URL
from playwright.async_api import async_playwright
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-first-run"]
shape = sys.argv[1] if len(sys.argv) > 1 else 'kreis'; steps = int(sys.argv[2]) if len(sys.argv) > 2 else 2500
vw, vh = (int(sys.argv[3]), int(sys.argv[4])) if len(sys.argv) > 4 else (390, 844)
grid = sys.argv[5] if len(sys.argv) > 5 else 'grob'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
        pg = await b.new_page(viewport={"width": vw, "height": vh}, device_scale_factor=2, is_mobile=True, has_touch=True)
        logs = []
        pg.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
        import os
        await pg.goto(f'{URL}?form={shape}&gitter={grid}' + os.environ.get('WHQS', ''))
        await pg.wait_for_timeout(800)
        await pg.evaluate("App.running = false")
        for k in range(steps // 50):
            await pg.evaluate("(() => { for (let j = 0; j < 5; j++) { WH.step(10); lbm.dye(10, Math.max(6, Math.round(lbm.ny / 22)), 0); } App.pRef = lbm.readColumnRho(2); })()")
        f = await pg.evaluate("WH.force()")
        await pg.evaluate("App.pRef = lbm.readColumnRho(2); const fr = lbm.readForce(); App.force = { n: 10, fx: fr[0] * 10, fy: fr[1] * 10, hist: [] }; updateHud();")
        H = await pg.evaluate("App.heightCells")
        U = await pg.evaluate("U_LB"); print(shape, 'cW', round(f[0] / (0.5 * U * U * H), 3), 'umax/U', round(f[2] / U, 2))
        for mode, name in enumerate(['rauch', 'tempo', 'druck', 'wirbel']):
            await pg.evaluate(f"App.mode = {mode}; document.querySelector('#modeBtn').textContent = {['\"Rauch\"','\"Tempo\"','\"Druck\"','\"Wirbel\"'][mode]}; lbm.draw({mode}, physParams(), lbm.canvas.width, lbm.canvas.height)")
            await pg.wait_for_timeout(100)
            await pg.screenshot(path=str(__import__('pathlib').Path(__file__).parent / f'vis_{shape}_{name}.png'))
        print("\n".join(logs)[:800])
        await b.close()
asyncio.run(main())
