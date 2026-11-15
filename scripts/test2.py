import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':1600,'height':920}, accept_downloads=True)
        errs=[]
        pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
        await pg.goto('file://' + __import__('os').path.abspath('dist/index.html') + '#demo'); await pg.wait_for_timeout(2500)
        # preset + madeira em peças via clique 3D com ferramenta material
        await pg.click('[data-preset="mp40"]'); await pg.wait_for_timeout(400)
        await pg.click('.mat[data-mat="nogueira"]')
        await pg.mouse.click(560, 600); await pg.wait_for_timeout(300)   # cabo / coronha?
        await pg.click('.mat[data-mat="baquelite"]')
        await pg.mouse.click(770, 560); await pg.wait_for_timeout(300)
        # pintar
        await pg.click('[data-tool="brush"]')
        await pg.mouse.move(650,450); await pg.mouse.down()
        for i in range(20): await pg.mouse.move(650+i*8,450+i*2)
        await pg.mouse.up()
        # seleção pra ver overlay
        await pg.click('[data-tool="nav"]'); await pg.mouse.click(900, 420); await pg.wait_for_timeout(500)
        await pg.screenshot(path='/tmp/t1.png')
        await pg.click('.tabs button[data-tab="tabAnim"]'); await pg.wait_for_timeout(200)
        await pg.screenshot(path='/tmp/t2.png')
        async with pg.expect_download() as d:
            await pg.click('#btnZip')
        dl = await d.value; await dl.save_as('/tmp/out.zip')
        async with pg.expect_download() as d:
            await pg.click('#btnSave')
        dl = await d.value; await dl.save_as('/tmp/proj.cubemaker')
        # reabrir projeto
        await pg.set_input_files('#openFiles','/tmp/proj.cubemaker'); await pg.wait_for_timeout(2500)
        print(await pg.evaluate("()=>({mats:CM.S.islandMat.map(m=>m.size), nf:CM.model.nf})"))
        await pg.screenshot(path='/tmp/t3.png')
        print('ERRORS', errs)
        await b.close()
asyncio.run(main())
