# Kraft feiner aufgelöst: nach Aufwärmen alle 10 Schritte lesen
import asyncio, sys
sys.path.insert(0, str(__import__('pathlib').Path(__file__).parent))
from pw import CHROME, URL
from playwright.async_api import async_playwright
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-first-run"]
shape = sys.argv[1]; warm = int(sys.argv[2]); n = int(sys.argv[3]); recap = float(sys.argv[4]) if len(sys.argv) > 4 else 0; angle = float(sys.argv[5]) if len(sys.argv) > 5 else 0
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
        pg = await b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1)
        await pg.goto(f'{URL}?form={shape}&gitter=grob')
        await pg.wait_for_timeout(800)
        await pg.evaluate(f"App.running = false; App.speed = 30; WH.setShape('{shape}')")
        if recap: await pg.evaluate(f"App.nuMin = 0.1 * App.lengthCells / {recap}")
        if angle: await pg.evaluate(f"App.angle = {angle}; const r = rasterShape(App.shape, lbm.nx, lbm.ny, App.angle); lbm.setMask(r.m); App.heightCells = r.height; App.lengthCells = r.length; restart(); App.nuMin = {recap} ? 0.1 * App.lengthCells / {recap} : 0;")
        H = await pg.evaluate("App.heightCells"); q = 0.5 * 0.01 * H
        await pg.evaluate(f"WH.step({warm})")
        out = []
        for k in range(n):
            r = await pg.evaluate("(() => { WH.step(10); return WH.force(); })()")
            out.append((r[0] / q, r[1] / q, r[2] / 0.1))
        print(shape, 'cW:', ' '.join(f"{a:.2f}" for a, _, _ in out))
        print(shape, 'cA:', ' '.join(f"{c:.2f}" for _, c, _ in out))
        import statistics as st
        print(f"Mittel cW {st.mean(a for a,_,_ in out):.3f} ± {st.pstdev(a for a,_,_ in out):.3f}, cA {st.mean(c for _,c,_ in out):.3f}, umax/U {max(u for _,_,u in out):.2f}")
        await b.close()
asyncio.run(main())
