# Renderiza cada arma com as peças coloridas e numeradas (para montar o auto-rig)
import asyncio, subprocess, os, time, base64, json, sys
from playwright.async_api import async_playwright
srv = subprocess.Popen(['python3','-m','http.server','8771','-d',os.path.abspath('dist')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
JS = r'''async ([w, view]) => {
  await CM.loadBundled(w);
  const {THREE, meshes, renderer, scene, root, grid, tagMarker, pivotMarker} = CM._i;
  const m = CM.model, out = [], W = 1400, H = 820;
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  const cam = new THREE.PerspectiveCamera(28, W / H, 0.1, 2000);
  grid.visible = tagMarker.visible = pivotMarker.visible = false; scene.background = new THREE.Color(0x101010);
  const tmp = [];
  const box = new THREE.Box3(); meshes.forEach(x => { x.geometry.computeBoundingBox(); box.union(x.geometry.boundingBox.clone().applyMatrix4(root.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3()), dim = box.getSize(new THREE.Vector3());
  const dirs = { right: [1, 0.15, 0.05], left: [-1, 0.15, 0.05], top: [0.15, 1, 0.02], front: [0.2, 0.15, -1] };
  const d = new THREE.Vector3(...dirs[view]).normalize();
  const dist = Math.max(dim.x, dim.y, dim.z) / 2 / Math.tan(14 * Math.PI / 180) * 1.05;
  cam.position.copy(c).addScaledVector(d, dist); cam.lookAt(c); cam.updateMatrixWorld();
  const labels = [];
  m.surfaces.forEach((s, si) => {
    const pieces = [...new Set(s.piece)];
    pieces.forEach((p, k) => {
      const isl = [...Array(s.nIsl).keys()].filter(i => s.piece[i] === p);
      const idx = []; isl.forEach(i => s.islTris[i].forEach(t => idx.push(s.tris[t*3], s.tris[t*3+1], s.tris[t*3+2])));
      const g = new THREE.BufferGeometry(); g.setAttribute('position', meshes[si].geometry.attributes.position); g.setIndex(idx);
      const hue = (k * 0.618 + si * 0.33) % 1;
      const o = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(hue, 0.85, s.name === 'hands' ? 0.35 : 0.55), side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 }));
      meshes[si].add(o); tmp.push(o);
      let cx = 0, cy = 0, cz = 0, n = 0, mn = [1e9,1e9,1e9], mx = [-1e9,-1e9,-1e9];
      isl.forEach(i => s.islVerts[i].forEach(v => { const P = s.pos[0]; cx += P[v*3]; cy += P[v*3+1]; cz += P[v*3+2]; n++; for (let q=0;q<3;q++){mn[q]=Math.min(mn[q],P[v*3+q]);mx[q]=Math.max(mx[q],P[v*3+q]);} }));
      const ctr = [cx/n, cy/n, cz/n];
      const sp = new THREE.Vector3(ctr[0], ctr[1], ctr[2]).applyMatrix4(root.matrixWorld).project(cam);
      const label = (s.name === 'hands' ? 'H' : s.name === 'weapon' ? '' : s.name[0]+'_') + k;
      labels.push({ label, x: (sp.x + 1) / 2 * W, y: (1 - sp.y) / 2 * H, hue });
      out.push({ surf: s.name, si, k, piece: p, islands: isl, tris: idx.length / 3, c: ctr.map(v => +v.toFixed(1)), min: mn.map(v=>+v.toFixed(1)), max: mx.map(v=>+v.toFixed(1)) });
    });
  });
  renderer.render(scene, cam);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
  x.drawImage(renderer.domElement, 0, 0); x.font = 'bold 15px monospace'; x.textAlign = 'center';
  labels.forEach(l => { x.fillStyle = 'rgba(0,0,0,0.7)'; x.fillRect(l.x - 14, l.y - 10, 28, 18); x.fillStyle = '#fff'; x.fillText(l.label, l.x, l.y + 4); });
  tmp.forEach(o => o.parent.remove(o));
  return { img: cv.toDataURL('image/png'), pieces: out };
}'''
async def main():
    ws = sys.argv[1].split(','); views = sys.argv[2].split(',')
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':1400,'height':900})
        await pg.goto('http://localhost:8771/'); await pg.wait_for_timeout(800)
        for w in ws:
            for v in views:
                r = await pg.evaluate(JS, [w, v])
                open(f'/tmp/rig/{w}_{v}.png','wb').write(base64.b64decode(r['img'].split(',')[1]))
            json.dump(r['pieces'], open(f'/tmp/rig/{w}.json','w'))
            print(w, len(r['pieces']))
        await b.close()
asyncio.run(main()); srv.terminate()
