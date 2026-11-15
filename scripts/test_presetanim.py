# Cada modelo do arsenal abre com a animação de fábrica: confere chaves, clipes e exporta
import asyncio, subprocess, os, time, json
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8777','-d',os.path.abspath('dist')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':1600,'height':920})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
        await pg.goto('http://localhost:8777/'); await pg.wait_for_timeout(800)
        for i in await pg.evaluate("CM.ARSENAL.map(a=>a.id)"):
            await pg.evaluate(f"CM.loadPreset('{i}')"); await pg.wait_for_timeout(250)
            r = await pg.evaluate("""()=>{const g=CM.S.groups.filter(g=>Object.keys(g.keys).length).map(g=>g.name+':'+Object.keys(g.keys).length).join(' ');
               const a=CM.S.cfg.split('\\n').filter(l=>/md3anim/.test(l)).map(l=>l.replace('md3anim ','')).join('|'); const m=CM.parseMD3(CM.exportMD3());
               return {anim:CM.S.presetAnimName, groups:g, root:Object.keys(CM.S.root.keys).length, clips:a, nf:m.nf, surfs:m.surfaces.map(s=>s.name).join(',')}}""")
            print(i, json.dumps(r, ensure_ascii=False))
        print('ERR', errs[:5])
        await b.close()
asyncio.run(main()); srv.terminate()
