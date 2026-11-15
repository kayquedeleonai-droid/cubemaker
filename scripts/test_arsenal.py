# Monta todos os modelos do arsenal, exporta o MD3, gera miniaturas (assets/presets/<id>.png)
import asyncio, subprocess, os, time, base64, json, sys
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8774','-d',os.path.abspath('dist')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
THUMBS = '--thumbs' in sys.argv
async def main():
    os.makedirs('assets/presets', exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':1600,'height':920})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
        await pg.goto('http://localhost:8774/'); await pg.wait_for_timeout(800)
        ids = await pg.evaluate("CM.ARSENAL.map(a=>a.id)")
        for i in ids:
            await pg.evaluate(f"CM.loadPreset('{i}')"); await pg.wait_for_timeout(300)
            r = await pg.evaluate("""()=>{const m=CM.model, w=m.surfaces.find(s=>s.name==='weapon'); const b=CM.exportMD3(); const m2=CM.parseMD3(b);
              return {slot:CM.S.weapon, nv:w.nv, tri:w.ntri, isl:w.nIsl, groups:CM.S.groups.map(g=>g.name).join(','), nf:m2.nf, toast:document.querySelector('#toast').textContent.slice(0,60)}}""")
            print(i, json.dumps(r, ensure_ascii=False))
            if THUMBS:
                url = await pg.evaluate("CM.thumbnail(480,300,true)")
                open(f'assets/presets/{i}.png','wb').write(base64.b64decode(url.split(',')[1]))
        print('ERR', errs[:6])
        await b.close()
asyncio.run(main()); srv.terminate()
