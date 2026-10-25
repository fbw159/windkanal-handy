# Prüffälle mit bekannter Lösung (headless, kleine Gitter):
#   poiseuille  – Kanal zwischen haftenden Wänden: Parabel und Druckabfall (prüft Zähigkeit und Wandlage)
#   st1         – Schäfer/Turek 2D-1: Zylinder im Kanal, Re 20, stationär: cW 5,57–5,59, cA 0,0104–0,0110, Δp 0,1172–0,1176 (mit U_mittel = 0,2)
#   st2         – Schäfer/Turek 2D-2: Re 100, periodisch: cW_max 3,22–3,24, cA_max 0,99–1,01, Strouhal 0,295–0,305
# Aufruf: python3 test/bench.py <fall> [schritte]
import asyncio, sys, math
sys.path.insert(0, str(__import__('pathlib').Path(__file__).parent))
from pw import CHROME, URL
from playwright.async_api import async_playwright
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-first-run"]
case = sys.argv[1]; steps = int(sys.argv[2]) if len(sys.argv) > 2 else 0

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, headless=True, args=ARGS)
        pg = await b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1)
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(URL + '?gitter=grob'); await pg.wait_for_timeout(800)
        await pg.evaluate("App.running = false")
        if case == 'poiseuille':
            import os
            ny = int(os.environ.get('NY', 34)); nu = float(os.environ.get('NU', 0.05)); csm = float(os.environ.get('CSM', 0.12))
            x0, nx, U = 8, 308, float(os.environ.get('U', 0.1))
            n = steps or 6000
            await pg.evaluate(f"WH.build({nx}, {ny}, {x0}); WH.setMask(new Uint8Array({nx * ny}), 1, 1); WH.setParams({{nu: {nu}, csm: {csm}, ground: 2, sigmaG: 0, wallFrac: 0, uin: {U}, uref: {U}}})")
            print('ny', ny, 'nu', nu, 'tau', round(0.5 + 3 * nu, 3), 'csm', csm)
            await pg.evaluate(f"WH.step({n})")
            fl = await pg.evaluate("Array.from(WH.field())")
            def u(x, y): return fl[(y * nx + x) * 4 + 2]
            def rho(x, y): return fl[(y * nx + x) * 4 + 1]
            xs = 250
            prof = [u(xs, j) for j in range(ny)]
            umean = sum(prof) / ny
            # Parabel mit Wand bei y = 0 und y = ny (Zellmitten bei j + 0.5)
            err = max(abs(prof[j] - 6 * umean * ((j + 0.5) / ny) * (1 - (j + 0.5) / ny)) for j in range(ny)) / (1.5 * umean)
            # Druckabfall zwischen x = 150 und 250 (Spaltenmittel), Theorie dp/dx = -12 nu U / H^2, rho = 3 p
            r1 = sum(rho(150, j) for j in range(ny)) / ny; r2 = sum(rho(250, j) for j in range(ny)) / ny
            grad = (r1 - r2) / 100; theo = 3 * 12 * nu * umean / ny ** 2
            print(f"Poiseuille: U_mittel {umean:.5f} (Einlass {U}), u_max/U_mittel {max(prof)/umean:.4f} (Theorie 1,5), größter Profilfehler {err*100:.2f} % von u_max, Druckgefälle {grad:.3e} (Theorie {theo:.3e}, Abweichung {(grad/theo-1)*100:+.1f} %)")
        elif case in ('st1', 'st2'):
            D = 20; x0 = 8; ny = int(round(4.1 * D)); nx = x0 + 22 * D
            xc, yc = x0 + 2 * D, 2.0 * D
            if case == 'st1': Umax, Re = 0.1, 20
            else: Umax, Re = 0.09, 100
            Umean = 2 / 3 * Umax; nu = Umean * D / Re
            mask = bytearray(nx * ny)
            for j in range(ny):
                for i in range(nx):
                    if (i + 0.5 - xc) ** 2 + (j + 0.5 - yc) ** 2 < (D / 2) ** 2: mask[j * nx + i] = 1
            import os
            inside = f"(x, y) => (x - {xc}) ** 2 + (y - {yc}) ** 2 < {(D / 2) ** 2}" if os.environ.get('TREPPE') != '1' else 'null'
            await pg.evaluate(f"WH.build({nx}, {ny}, {x0}); WH.setMask(new Uint8Array({list(mask)}), {D}, {D}, {inside}); WH.setParams({{nu: {nu}, ground: 2, inletShape: 1, sigmaG: 0, wallFrac: 0, uin: {Umax}, uref: {Umax}}})")
            print('Wand:', 'Treppe (halbe Zelle)' if inside == 'null' else 'echte Lage (Bouzidi)')
            info = await pg.evaluate("[lbm.nx, lbm.ny, lbm.x0, lbm.maskData.reduce((a,b)=>a+b,0), physParams().nu]")
            print('Gitter', info, 'U_mittel', round(Umean, 4), 'tau', round(0.5 + 3 * nu, 4))
            q = 0.5 * Umean ** 2 * D
            if case == 'st1':
                n = steps or 12000; hist = []
                for k in range(n // 500):
                    r = await pg.evaluate("(() => { WH.step(500); return WH.force(); })()")
                    hist.append(r); print(f"  {(k+1)*500:6d}: cW {r[0]/q:.4f} cA {r[1]/q:.5f} umax/Umax {r[2]/Umax:.3f}", flush=True)
                fl = await pg.evaluate("Array.from(WH.field())")
                def rho(x, y): return fl[(y * nx + x) * 4 + 1]
                xf, xb, yy = int(xc - D / 2 - 1), int(xc + D / 2), int(yc)
                dp = (rho(xf, yy) - rho(xb, yy)) / 3 / Umean ** 2   # auf rho U_mittel^2 bezogen; Benchmark: 0,1175 / 0,04 = 2,94
                print(f"Schäfer/Turek 2D-1 (Re 20): cW {hist[-1][0]/q:.3f} (Soll 5,57–5,59), cA {hist[-1][1]/q:.4f} (Soll 0,0104–0,0110), Δp/(ρU²) {dp:.3f} (Soll 2,93–2,94)")
            else:
                n = steps or 10000; sample = 4000
                await pg.evaluate(f"WH.step({n})")
                cws, cls = [], []
                for k in range(sample // 10):
                    r = await pg.evaluate("(() => { WH.step(10); return WH.force(); })()")
                    cws.append(r[0] / q); cls.append(r[1] / q)
                # Strouhal aus den Nulldurchgängen des Auftriebs
                zc = [k for k in range(1, len(cls)) if cls[k - 1] < 0 <= cls[k]]
                per = (zc[-1] - zc[0]) / (len(zc) - 1) * 10 if len(zc) > 1 else float('nan')
                St = D / (per * Umean)
                print(f"Schäfer/Turek 2D-2 (Re 100): cW_max {max(cws):.3f} (Soll 3,22–3,24), cW_mittel {sum(cws)/len(cws):.3f}, cA_max {max(cls):.3f} (Soll 0,99–1,01), cA_min {min(cls):.3f}, St {St:.3f} (Soll 0,295–0,305), Periode {per:.0f} Schritte, {len(zc)} Perioden")
        if errs: print('FEHLER', errs[:3])
        await b.close()
asyncio.run(main())
