# Arena: entra no Modo Jogo, anda, mira num bot, atira até abater; screenshots
import asyncio, subprocess, os, time, math
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8781','-d',os.path.abspath('dist')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width':1400,'height':860})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
        await pg.goto('http://localhost:8781/'); await pg.wait_for_timeout(800)
        await pg.evaluate("CM.loadPreset('stg44')"); await pg.wait_for_timeout(400); await pg.evaluate("CM.goStep(4)")
        await pg.click('#btnGame'); await pg.wait_for_timeout(800)
        await pg.screenshot(path='/tmp/a1.png')
        await pg.keyboard.down('w'); await pg.wait_for_timeout(900); await pg.keyboard.up('w')
        print('pos after W', await pg.evaluate("CM.game._G.pos.toArray().map(v=>v.toFixed(1))"), 'bots', await pg.evaluate("CM.game._bots().length"))
        for attempt in range(6):
            await pg.evaluate("""()=>{const G=CM.game._G, b=CM.game._bots().find(b=>!b.dead); const p=b.g.position; G.pos.set(p.x, 0, p.z+45);
               const dx=p.x-G.pos.x, dz=p.z-G.pos.z; G.yaw=Math.atan2(-dx,-dz); G.pitch=-0.05; b.target=b.g.position.clone(); }""")
            await pg.wait_for_timeout(150)
            await pg.mouse.move(700,430); await pg.mouse.down(); await pg.wait_for_timeout(700); await pg.mouse.up(); await pg.wait_for_timeout(200)
            if await pg.evaluate("CM.game._G.kills"): break
        await pg.wait_for_timeout(250)
        await pg.screenshot(path='/tmp/a2.png')
        print('kills', await pg.evaluate("CM.game._G.kills"), 'hp', await pg.evaluate("CM.game._G.hp"), 'deaths', await pg.evaluate("CM.game._G.deaths"))
        await pg.wait_for_timeout(2500); await pg.screenshot(path='/tmp/a3.png')
        print('ERR', errs[:5])
        await b.close()
asyncio.run(main()); srv.terminate()
