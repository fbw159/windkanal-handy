# Druck an einigen Stellen über die Zeit (alle 10 Schritte) – zeigt Wellen im Kanal
import asyncio, sys
sys.path.insert(0, str(__import__('pathlib').Path(__file__).parent))
from pw import CHROME, URL
from playwright.async_api import async_playwright
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-first-run"]
shape = sys.argv[1]; warm = int(sys.argv[2]); n = int(sys.argv[3]); recap = float(sys.argv[4]) if len(sys.argv) > 4 else 0
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
        pg = await b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1)
        await pg.goto(f'{URL}?form={shape}&gitter=grob')
        await pg.wait_for_timeout(800)
        await pg.evaluate(f"App.running = false; App.speed = 30; WH.setShape('{shape}')")
        if recap: await pg.evaluate(f"App.nuMin = 0.1 * App.lengthCells / {recap}")
        await pg.evaluate(f"WH.step({warm})")
        rows = []
        for k in range(n):
            r = await pg.evaluate("""(() => { WH.step(10); const gl = lbm.gl, cur = lbm.sets[lbm.parity]; gl.bindFramebuffer(gl.FRAMEBUFFER, cur.f); gl.readBuffer(gl.COLOR_ATTACHMENT2);
              const fl = new Float32Array(lbm.nx * lbm.ny * 4); gl.readPixels(0, 0, lbm.nx, lbm.ny, gl.RGBA, gl.FLOAT, fl);
              const at = (x, y) => fl[(y * lbm.nx + x) * 4 + 1] / 0.015;   // in Staudrücken (3·0.5·U²)
              const ym = lbm.ny >> 1, x0 = lbm.x0;
              let mean = 0; for (let i = 1; i < fl.length; i += 4) mean += fl[i]; mean /= fl.length / 4;
              return [at(2, ym), at(x0 + 5, ym), at(x0 + 40, ym), at(x0 + 40, 5), at(lbm.nx - 40, ym), at(lbm.nx - 3, ym), mean / 0.015]; })()""")
            rows.append(r)
        names = ['x=2', 'x0+5', 'x0+40 mitte', 'x0+40 unten', 'Ende-40', 'Ende-3', 'Mittel']
        for i, nm in enumerate(names): print(f"{nm:12s}", ' '.join(f"{r[i]:6.2f}" for r in rows))
        await b.close()
asyncio.run(main())
