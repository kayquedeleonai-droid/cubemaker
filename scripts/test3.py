import asyncio, subprocess, os, time, sys
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8766','-d',os.path.abspath('dist')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width':1600,'height':920})
        errs=[]; pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
        await pg.goto('http://localhost:8766/'); await pg.wait_for_timeout(1200)
        await pg.screenshot(path='/tmp/p1.png')
        # todas as armas carregam
        for w in ['knife','pistol','carbine','shotgun','assault','sniper','grenade','subgun']:
            await pg.evaluate(f"CM.loadBundled('{w}')"); await pg.wait_for_timeout(1500)
            info = await pg.evaluate("()=>({w:CM.S.weapon, surfs:CM.model.surfaces.map(s=>s.name+':'+s.nIsl), nf:CM.model.nf, step:CM.S.step})")
            r = await pg.evaluate("()=>{const b=CM.exportMD3(); const m=CM.parseMD3(b); return b.byteLength+' '+m.surfaces.length}")
            print(info, r)
        await pg.screenshot(path='/tmp/p2.png')
        # textura: preset, fx, decal
        await pg.evaluate("CM.goStep(3)"); await pg.wait_for_timeout(300)
        await pg.click('[data-preset="mp40"]'); await pg.wait_for_timeout(500)
        await pg.evaluate("()=>{CM.S.fx.blood=0.6; CM.S.fx.scratches=0.5; CM.S.fx.burn=0.7; CM.S.fx.dust=0.4; CM.skins.forEach((_, i)=>{}); }")
        await pg.click('.subtabs button[data-sub="t-fx"]'); await pg.wait_for_timeout(100)
        await pg.evaluate("()=>{ document.querySelectorAll('#fxBox input[type=range]')[0].dispatchEvent(new Event('input')); }"); await pg.wait_for_timeout(1500)
        await pg.click('.subtabs button[data-sub="t-decal"]')
        await pg.click('#btnDecAdd'); await pg.mouse.click(760, 420); await pg.wait_for_timeout(800)
        print('decals', await pg.evaluate("CM.S.decals.length"))
        await pg.screenshot(path='/tmp/p3.png')
        # animação: pacote
        await pg.evaluate("CM.goStep(4)"); await pg.wait_for_timeout(300)
        # cria grupos básicos por heurística: carregador = peça mais baixa
        await pg.evaluate('''()=>{ const s=CM.model.surfaces.find(x=>x.name==='weapon'); const si=CM.model.surfaces.indexOf(s);
           const isl=[...Array(s.nIsl).keys()]; const cz=i=>{let z=0;s.islVerts[i].forEach(v=>z+=s.pos[0][v*3+2]);return z/s.islVerts[i].length};
           const low=isl.sort((a,b)=>cz(a)-cz(b))[0]; CM.selectIsland(si,low,{piece:true}); document.querySelector('#groupName').value='Carregador'; CM.createGroup();
           const top=isl.sort((a,b)=>cz(b)-cz(a))[2]; CM.selectIsland(si,top,{}); document.querySelector('#groupName').value='Ferrolho'; CM.createGroup(); }''')
        await pg.evaluate("CM.applyAnimBank('subgun')"); await pg.wait_for_timeout(800)
        print(await pg.evaluate("()=>({nf:CM.model.nf, cfg:CM.S.cfg, groups:CM.S.groups.map(g=>g.name+':'+Object.keys(g.keys).length), root:Object.keys(CM.S.root.keys).length, surfs:CM.model.surfaces.map(s=>s.name)})"))
        await pg.evaluate("CM.setFrame(30)"); await pg.wait_for_timeout(300)
        await pg.screenshot(path='/tmp/p4.png')
        r = await pg.evaluate("()=>{const b=CM.exportMD3(); const m=CM.parseMD3(b); return {bytes:b.byteLength, nf:m.nf, surfs:m.surfaces.map(s=>s.name+':'+s.nv)}}")
        print(r)
        # modo jogo
        await pg.click('#btnGame'); await pg.wait_for_timeout(700)
        await pg.mouse.move(800,450); await pg.mouse.down(); await pg.wait_for_timeout(500); await pg.mouse.up()
        await pg.wait_for_timeout(120); await pg.screenshot(path='/tmp/p5.png')
        await pg.keyboard.press('r'); await pg.wait_for_timeout(900); await pg.screenshot(path='/tmp/p6.png')
        await pg.keyboard.press('g'); await pg.wait_for_timeout(1900); await pg.screenshot(path='/tmp/p7.png')
        await pg.evaluate('document.exitPointerLock()'); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        if await pg.evaluate('CM.game.on'): await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        print('game on after esc', await pg.evaluate('CM.game.on'))
        print('step after game', await pg.evaluate("CM.S.step"))
        print('ERR', errs[:8])
        await b.close()
asyncio.run(main()); srv.terminate()
