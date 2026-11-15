# Testa o módulo de personagens: python3 scripts/test_char.py "C:/.../AssaultCube/packages/models/playermodels"
import asyncio, subprocess, os, time, glob
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8776','-d',os.path.abspath('dist')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
import sys
PM = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('AC_PLAYERMODELS', '')  # pasta playermodels do SEU AssaultCube (o modelo não é versionado: licença de uso pessoal)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':1600,'height':920})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
        await pg.goto('http://localhost:8776/'); await pg.wait_for_timeout(800)
        await pg.screenshot(path='/tmp/c0.png')
        files=[f for f in glob.glob(PM+'/**/*', recursive=True) if os.path.isfile(f)]
        await pg.set_input_files('#openChar', [PM])
        await pg.wait_for_timeout(3000)
        print(await pg.evaluate("()=>({mode:CM.S.mode, step:CM.S.step, nf:CM.model&&CM.model.nf, toast:document.querySelector('#toast').textContent})"))
        await pg.evaluate("CM.applyUniform('wehrmacht')"); await pg.wait_for_timeout(1500)
        await pg.evaluate("CM.addInsignia('nome')"); await pg.evaluate("CM.addInsignia('numero')"); await pg.wait_for_timeout(500)
        await pg.evaluate("CM.frameCamera('front')"); await pg.wait_for_timeout(300)
        await pg.screenshot(path='/tmp/c1.png')
        for u in ['usarmy','poilu','rkkawinter']:
            await pg.evaluate(f"CM.applyUniform('{u}')"); await pg.wait_for_timeout(1300)
            await pg.screenshot(path=f'/tmp/c_{u}.png', clip={'x':260,'y':54,'width':960,'height':810})
        await pg.evaluate("CM.goStep(4)"); await pg.wait_for_timeout(300)
        await pg.evaluate("()=>{CM.S.animIdx=1; CM.setFrame(42)}"); await pg.wait_for_timeout(300)
        await pg.screenshot(path='/tmp/c2.png')
        await pg.evaluate("CM.goStep(5)"); await pg.wait_for_timeout(300)
        await pg.screenshot(path='/tmp/c3.png')
        print(await pg.evaluate("CM.charTarget()"))
        print('ERR', errs[:5])
        await b.close()
asyncio.run(main()); srv.terminate()
