import asyncio, sys
sys.path.insert(0, str(__import__('pathlib').Path(__file__).parent))
from pw import CHROME
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, headless=True)
        for size in (180, 192, 512):
            pg = await b.new_page(viewport={"width": size, "height": size}, device_scale_factor=1)
            svg = open(str(__import__('pathlib').Path(__file__).resolve().parent.parent / 'icon.svg')).read().replace('<svg ', f'<svg width="{size}" height="{size}" ')
            await pg.set_content(f'<html><body style="margin:0;background:transparent">{svg}</body></html>')
            await pg.wait_for_timeout(300)
            await pg.screenshot(path=str(__import__('pathlib').Path(__file__).resolve().parent.parent / f'icon-{size}.png'), omit_background=True)
            await pg.close()
        await b.close()
asyncio.run(main())
print('ok')
