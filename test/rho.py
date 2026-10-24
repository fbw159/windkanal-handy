import asyncio, sys
sys.path.insert(0, str(__import__('pathlib').Path(__file__).parent))
from pw import CHROME, URL
from playwright.async_api import async_playwright
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-first-run"]
shape = sys.argv[1] if len(sys.argv) > 1 else 'kaefer'; steps = int(sys.argv[2]) if len(sys.argv) > 2 else 1500
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
        pg = await b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1)
        await pg.goto(f'{URL}?form={shape}&gitter=grob')
        await pg.wait_for_timeout(800)
        await pg.evaluate("App.running = false")
        for k in range(steps // 100):
            await pg.evaluate("WH.step(100)")
            r = await pg.evaluate("""(() => { const gl = lbm.gl, cur = lbm.sets[lbm.parity]; gl.bindFramebuffer(gl.FRAMEBUFFER, cur.f); gl.readBuffer(gl.COLOR_ATTACHMENT2);
              const fl = new Float32Array(lbm.nx * lbm.ny * 4); gl.readPixels(0, 0, lbm.nx, lbm.ny, gl.RGBA, gl.FLOAT, fl);
              const col = (x) => { let s = 0, n = 0; for (let y = 0; y < lbm.ny; y++) { s += fl[(y * lbm.nx + x) * 4 + 1]; n++; } return +(s / n).toFixed(4); };
              let mean = 0, mn = 1, mx = -1; for (let i = 0; i < fl.length; i += 4) { const v = fl[i + 1]; mean += v; if (v < mn) mn = v; if (v > mx) mx = v; }
              return { steps: lbm.steps, mean: +(mean / (fl.length / 4)).toFixed(4), min: +mn.toFixed(3), max: +mx.toFixed(3), x0: col(0), x1: col(1), x5: col(5), xmid: col(lbm.nx >> 1), xend: col(lbm.nx - 2), xlast: col(lbm.nx - 1) }; })()""")
            print(r)
        await b.close()
asyncio.run(main())
