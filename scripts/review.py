# Revisão visual: para cada modelo, quadros-chave de cada clipe na VISÃO FPS (o que o jogador vê)
# uso: python3 scripts/review.py mk2,mp40   → /tmp/review/<id>.png
import asyncio, subprocess, os, time, sys
from playwright.async_api import async_playwright
from PIL import Image, ImageDraw
srv = subprocess.Popen(['python3','-m','http.server','8779','-d',os.path.abspath('dist')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
os.makedirs('/tmp/review', exist_ok=True)
async def main():
    ids = sys.argv[1].split(',')
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':1280,'height':800})
        await pg.goto('http://localhost:8779/'); await pg.wait_for_timeout(800)
        for i in ids:
            if i.startswith('ac:'): await pg.evaluate(f"CM.loadBundled('{i[3:]}')")
            else: await pg.evaluate(f"CM.loadPreset('{i}')")
            await pg.wait_for_timeout(300)
            await pg.evaluate("()=>{CM.S.showTag=false; CM.S.gi=-1; CM.goStep(4); document.body.classList.add('gaming'); CM._i.grid.visible=false; CM._i.resize();}")
            await pg.wait_for_timeout(200)
            await pg.evaluate("CM.frameCamera('fps')")
            bb = await pg.evaluate("()=>{const r=document.querySelector('#gl').getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}}"); box = {'x': bb['x']+bb['width']*0.35, 'y': bb['y']+bb['height']*0.3, 'width': bb['width']*0.65, 'height': bb['height']*0.7}
            clips = await pg.evaluate("()=>{const a=CM.S.cfg?[]:[]; return (CM.model.md2?[]:(window.CM.S.cfg.split('\\n').filter(l=>/md3anim/.test(l)).map(l=>{const m=l.match(/\"([^\"]+)\"\\s+(\\d+)\\s+(\\d+)/); return m?[m[1],+m[2],+m[3]]:null}).filter(Boolean)))}")
            shots=[]
            for name, st, cnt in clips:
                if cnt <= 1: continue
                fr = sorted(set([st + round(k*(cnt-1)/5) for k in range(6)]))
                for f in fr:
                    await pg.evaluate(f"CM.setFrame({f})"); await pg.wait_for_timeout(80)
                    pth=f'/tmp/review/_{i}_{f}.png'.replace(':','_'); await pg.screenshot(path=pth, clip=box); shots.append((pth, f'{name} f{f}'))
            if not shots:
                await pg.evaluate("CM.setFrame(0)"); pth=f'/tmp/review/_{i}_0.png'.replace(':','_'); await pg.screenshot(path=pth, clip=box); shots.append((pth,'idle'))
            W,H=320,200; cols=6; o=Image.new('RGB',(W*cols,H*((len(shots)+cols-1)//cols)),(0,0,0)); d=ImageDraw.Draw(o)
            for k,(pth,lab) in enumerate(shots): o.paste(Image.open(pth).resize((W,H)),((k%cols)*W,(k//cols)*H)); d.text(((k%cols)*W+6,(k//cols)*H+4),f'{i} {lab}',fill=(255,120,140))
            o.save(f'/tmp/review/{i.replace(":","_")}.png'); print(i, len(shots))
        await b.close()
asyncio.run(main()); srv.terminate()
