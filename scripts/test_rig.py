# Para cada arma original: auto-rig + pacote de animação do tipo + export MD3 + Modo Jogo
import asyncio, subprocess, os, time, json
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8772','-d',os.path.abspath('dist')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':1600,'height':920})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8772/'); await pg.wait_for_timeout(800)
        for w in ['subgun','assault','sniper','carbine','shotgun','pistol','knife','grenade']:
            await pg.evaluate(f"CM.loadBundled('{w}')"); await pg.wait_for_timeout(700)
            await pg.evaluate("CM.goStep(4)")
            await pg.evaluate(f"CM.applyAnimBank('{w}')"); await pg.wait_for_timeout(400)
            info = await pg.evaluate("""()=>({groups:CM.S.groups.map(g=>g.name+(g.parent>=0?'→'+CM.S.groups[g.parent].name:'')+':'+Object.keys(g.keys).length), root:Object.keys(CM.S.root.keys).length, nf:CM.model.nf,
              anims:CM.S.cfg.split('\\n').filter(l=>/md3anim/.test(l)).join(' | '), toast:document.querySelector('#toast').textContent})""")
            m = await pg.evaluate("()=>{const b=CM.exportMD3(); const m=CM.parseMD3(b); return m.nf+'f '+m.surfaces.map(s=>s.name).join(',')}")
            print(w, json.dumps(info, ensure_ascii=False), m)
            # quadro do meio da recarga e do tiro
            r = await pg.evaluate("()=>{const a=CM.S.cfg.match(/gun reload\" (\\d+) (\\d+)/); return a? +a[1]+Math.floor(+a[2]*0.4):0}")
            await pg.evaluate(f"CM.setFrame({r})"); await pg.evaluate("CM.frameCamera('fps')"); await pg.wait_for_timeout(250)
            await pg.screenshot(path=f'/tmp/rig/anim_{w}.png', clip={'x':260,'y':54,'width':960,'height':810})
        print('ERR', errs[:5])
        await b.close()
asyncio.run(main()); srv.terminate()
