# Forja: cria cada família, muda opções, exporta e confere animação
import asyncio, subprocess, os, time, json, base64
from playwright.async_api import async_playwright
from PIL import Image
srv = subprocess.Popen(['python3','-m','http.server','8782','-d',os.path.abspath('dist')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':1600,'height':920})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
        await pg.goto('http://localhost:8782/'); await pg.wait_for_timeout(800)
        await pg.screenshot(path='/tmp/f0.png')
        shots=[]
        variants = [('pistol',{}),('smg',{}),('smg',{'mag':'tambor','stock':'madeira','fore':'vertical','wood':'nogueira'}),('assault',{}),('assault',{'era':'moderno','stock':'polimero','sight':'pontovermelho','muzzle':'supressor','mag':'reto','magLen':150}),('bolt',{}),('bolt',{'era':'ww1','sight':'ferro','bayonet':'sim','barrel':480}),('semi',{}),('shotgun',{}),('smg',{'mag':'lateral','stock':'esqueleto','jacket':'sim'})]
        for fam, ov in variants:
            await pg.evaluate(f"""async()=>{{ await CM.startForge('{fam}'); Object.assign(CM.S.forge.p, {json.dumps(ov)}); await CM.loadPreset(CM.forgeDef(CM.S.forge.fam, CM.S.forge.p, 'teste')); }}""")
            await pg.wait_for_timeout(400)
            r = await pg.evaluate("""()=>{const m=CM.parseMD3(CM.exportMD3()); return {slot:CM.S.weapon, anim:CM.S.presetAnimName, groups:CM.S.groups.filter(g=>Object.keys(g.keys).length).map(g=>g.name).join(','), nf:m.nf, tri:m.surfaces.reduce((a,s)=>a+s.ntri,0)}}""")
            print(fam, json.dumps(ov), json.dumps(r, ensure_ascii=False))
            url = await pg.evaluate("CM.thumbnail(400,250,true)")
            pth=f'/tmp/forge_{len(shots)}.png'; open(pth,'wb').write(base64.b64decode(url.split(',')[1])); shots.append(pth)
        await pg.screenshot(path='/tmp/f1.png')
        print('ERR', errs[:5])
        await b.close()
    o=Image.new('RGB',(400*5,250*2))
    for i,pth in enumerate(shots): o.paste(Image.open(pth),((i%5)*400,(i//5)*250))
    o.save('/tmp/forge_mont.png')
asyncio.run(main()); srv.terminate()
