# Monta todos os mapmodels, exporta (tris.md3 + skin + md3.cfg), confere tamanho e gera miniaturas (assets/props/<id>.png)
import asyncio, subprocess, os, time, base64, json, sys
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8776','-d',os.path.abspath('dist')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
THUMBS = '--thumbs' in sys.argv
ONLY = [a for a in sys.argv[1:] if not a.startswith('--')]
async def main():
    os.makedirs('assets/props', exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':1600,'height':920})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
        await pg.goto('http://localhost:8776/'); await pg.wait_for_timeout(800)
        ids = ONLY or await pg.evaluate("CM.PROPS.map(a=>a.id)")
        for i in ids:
            t0 = time.time()
            await pg.evaluate(f"CM.loadProp('{i}')"); await pg.wait_for_timeout(200)
            r = await pg.evaluate("""async()=>{const m=CM.model, s=m.surfaces[0]; const files=await CM.packageFiles(); const md3=files.find(f=>/tris\\.md3$/.test(f.path));
              const m2=CM.parseMD3(await md3.data.arrayBuffer()); let mx=0; m2.surfaces[0].pos.forEach(P=>{for(const v of P) mx=Math.max(mx,Math.abs(v))});
              return {tri:s.ntri, isl:s.nIsl, nf:m2.nf, maxc:+mx.toFixed(1), dims:CM.S.prop.dims, mm:CM.S.prop.mm, groups:CM.S.groups.map(g=>g.name).join(','), files:files.map(f=>f.path.split('/').pop()).join(','), texK:+CM.S.texK.toFixed(2)}}""")
            print(i, f'{time.time()-t0:.1f}s', json.dumps(r, ensure_ascii=False))
            if THUMBS:
                url = await pg.evaluate("CM.thumbnail(480,300,true)")
                open(f'assets/props/{i}.png','wb').write(base64.b64decode(url.split(',')[1]))
        print('ERR', errs[:8])
        await b.close()
asyncio.run(main()); srv.terminate()
