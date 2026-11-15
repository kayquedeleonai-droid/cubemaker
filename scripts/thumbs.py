# Gera assets/weapons/<arma>/thumb.png renderizando cada arma no próprio CUBE MAKER
import asyncio, subprocess, os, time, base64
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8768','-d',os.path.abspath('dist')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':1400,'height':900})
        await pg.goto('http://localhost:8768/'); await pg.wait_for_timeout(800)
        for w in ['knife','pistol','carbine','shotgun','subgun','assault','sniper','grenade']:
            await pg.evaluate(f"CM.loadBundled('{w}')"); await pg.wait_for_timeout(800)
            url = await pg.evaluate("CM.thumbnail()")
            open(f'assets/weapons/{w}/thumb.png','wb').write(base64.b64decode(url.split(',')[1]))
            print(w, 'ok')
        await b.close()
asyncio.run(main()); srv.terminate()
