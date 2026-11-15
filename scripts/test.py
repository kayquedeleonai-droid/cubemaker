import asyncio, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':1600,'height':920})
        errs=[]
        pg.on('console', lambda m: errs.append(m.text) if m.type in ('error','warning') else None)
        pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
        await pg.goto('file://' + __import__('os').path.abspath('dist/index.html') + '')
        await pg.wait_for_timeout(800)
        await pg.screenshot(path='/tmp/s0.png')
        await pg.click('#btnDemo2'); await pg.wait_for_timeout(2500)
        await pg.screenshot(path='/tmp/s1.png')
        r = await pg.evaluate('''() => {
          const m = CM.model; const s = m.surfaces[1];
          CM.applyPreset('mp40');
          // maior peça "piece" como madeira para testar
          const big = [...Array(s.nIsl).keys()].sort((a,b)=>s.islTris[b].length-s.islTris[a].length);
          CM.assignMaterial(1,[big[3]],'baquelite');
          CM.selectIsland(1,big[5],{piece:true});
          document.querySelector('#groupName').value='Ferrolho';
          CM.createGroup(); CM.boltPreset(); CM.setFrame(10);
          const buf = CM.exportMD3(); const m2 = CM.parseMD3(buf);
          // quadro 10 deve diferir do 0
          let d=0; const a=m2.surfaces[1].pos[0], b=m2.surfaces[1].pos[10]; for(let i=0;i<a.length;i++) d=Math.max(d,Math.abs(a[i]-b[i]));
          return {nIsl:s.nIsl, bytes:buf.byteLength, nf:m2.nf, maxMove:d, groups:CM.S.groups.length};
        }''')
        print(r)
        await pg.wait_for_timeout(800)
        await pg.screenshot(path='/tmp/s2.png')
        await pg.click('[data-cam="fps"]'); await pg.wait_for_timeout(600)
        await pg.screenshot(path='/tmp/s3.png')
        print('ERRORS:', errs[:10])
        await b.close()
asyncio.run(main())
