# Testa "Instalar no jogo" simulando a pasta do jogo com o OPFS do navegador
import asyncio, subprocess, os, time
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8765','-d',os.path.abspath('dist')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
LIST = '''async () => { const out=[]; const walk=async(d,p)=>{for await (const [n,h] of d.entries()){ if(h.kind==='file'){const f=await h.getFile(); out.push(p+n+' '+f.size);} else await walk(h,p+n+'/');}}; await walk(await navigator.storage.getDirectory(),''); return out.sort(); }'''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':1600,'height':920})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("window.showDirectoryPicker = async () => { const r = await navigator.storage.getDirectory(); const d = await r.getDirectoryHandle('v1.3',{create:true}); await d.getDirectoryHandle('config',{create:true}); return d; };")
        await pg.goto('http://localhost:8765/#demo'); await pg.wait_for_timeout(2500)
        await pg.click('#btnGameDir'); await pg.wait_for_timeout(500)
        print('status:', await pg.inner_text('#gameStatus'))
        async def wait_toast(txt):
            await pg.wait_for_function("t => document.querySelector('#toast').textContent.includes(t)", arg=txt, timeout=60000)
            print('toast:', await pg.inner_text('#toast'))
        await pg.click('#btnInstall'); await wait_toast('instalada')
        await pg.evaluate("document.querySelector('#toast').textContent=''")
        await pg.click('[data-preset="mp40"]'); await pg.wait_for_timeout(300)
        await pg.click('#btnInstall2'); await wait_toast('instalada')
        for l in await pg.evaluate(LIST): print('  ', l)
        await pg.screenshot(path='/tmp/i1.png')
        await pg.click('#btnRestore'); await pg.wait_for_timeout(300); await pg.click('#confirm .yes'); await wait_toast('restaurada')
        files = await pg.evaluate(LIST); print('after restore weapon files:', [l for l in files if l.startswith('v1.3/packages')])
        print('ERR', errs)
        await b.close()
asyncio.run(main()); srv.terminate()
