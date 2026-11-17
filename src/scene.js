// CUBE MAKER — Cena (diorama): monte composições com os mapmodels, mova, gire e exporte a lista para o mapa.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildPreset } from './geo.js';
import { MATS } from './materials.js';
import { PROPS, PROP_CATS } from './props.js';

const K = 0.05;                                       // mm → unidades MD3 (o mesmo dos mapmodels)
const cache = new Map();
function propMesh(def) {
  if (cache.has(def.id)) return cache.get(def.id).clone();
  const v = Object.fromEntries(Object.entries(def.vars || {}).map(([k, o]) => [k, o.v]));
  const Bp = buildPreset({ build: () => def.build(v) }, { W: 256, H: 256, ground: true });
  const n = Bp.pos.length / 3, mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], Bp.pos[i * 3 + k]); mx[k] = Math.max(mx[k], Bp.pos[i * 3 + k]); }
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), nrm = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    // Z-cima (MD3) → Y-cima (three): (x, y, z) → (x, z, -y)
    const x = (Bp.pos[i * 3] - (mn[0] + mx[0]) / 2) * K, y = (Bp.pos[i * 3 + 1] - (mn[1] + mx[1]) / 2) * K, z = (Bp.pos[i * 3 + 2] - mn[2]) * K;
    pos.set([x, z, -y], i * 3); nrm.set([Bp.nrm[i * 3], Bp.nrm[i * 3 + 2], -Bp.nrm[i * 3 + 1]], i * 3);
    const m = MATS[Bp.parts[Bp.vpart[i]].mat] || { c: [150, 150, 150] }, a = Bp.ao ? 0.35 + 0.65 * Bp.ao[i] : 1;
    col.set(m.c.map(c => Math.pow(c / 255, 2.2) * a), i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const idx = new Uint32Array(Bp.tris.length); for (let t = 0; t < Bp.tris.length; t += 3) { idx[t] = Bp.tris[t]; idx[t + 1] = Bp.tris[t + 2]; idx[t + 2] = Bp.tris[t + 1]; }
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05 }));
  mesh.castShadow = mesh.receiveShadow = true;
  const o = new THREE.Group(); o.add(mesh); o.userData.def = def;
  cache.set(def.id, o); return o.clone();
}

export function createScene({ toast, download }) {
  let root = null, renderer, scene, camera, controls, raf = 0, items = [], sel = null, placing = null, ghost = null, drag = false;
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  const SAVE = 'cubemaker_cena';
  function build() {
    root = document.createElement('div'); root.id = 'sceneView';
    root.innerHTML = `<aside class="scpal"><h3>Cena · diorama</h3><p class="hint">Clique num modelo e depois no chão. Arraste para mover · <b>Q/E</b> gira · <b>D</b> duplica · <b>Del</b> apaga · <b>Esc</b> solta.</p><input id="scFind" placeholder="Buscar…"><div id="scList"></div></aside>
      <div class="scmain"><canvas id="scCanvas"></canvas><div class="scbar"><button class="btn sm" id="scClear">Limpar</button><button class="btn sm" id="scSave">Salvar</button><button class="btn sm" id="scLoad">Abrir salvo</button><button class="btn sm primary" id="scExport">Exportar para o mapa</button><button class="btn sm" id="scClose">Fechar ✕</button><span id="scInfo" class="muted"></span></div></div>`;
    document.body.appendChild(root);
    const cv = root.querySelector('#scCanvas');
    renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true }); renderer.shadowMap.enabled = true; renderer.outputColorSpace = THREE.SRGBColorSpace;
    scene = new THREE.Scene(); scene.background = new THREE.Color(0x15161a); scene.fog = new THREE.Fog(0x15161a, 900, 2600);
    camera = new THREE.PerspectiveCamera(50, 1, 1, 6000); camera.position.set(420, 380, 520);
    controls = new OrbitControls(camera, cv); controls.target.set(0, 30, 0); controls.maxPolarAngle = Math.PI * 0.49;
    scene.add(new THREE.HemisphereLight(0xc8d0e0, 0x3a3226, 0.9));
    const sun = new THREE.DirectionalLight(0xfff1dc, 1.6); sun.position.set(400, 700, 250); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -900, right: 900, top: 900, bottom: -900, far: 2500 }); scene.add(sun);
    const gm = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshStandardMaterial({ color: 0x4a4334, roughness: 1 })); gm.rotation.x = -Math.PI / 2; gm.receiveShadow = true; scene.add(gm);
    const grid = new THREE.GridHelper(2000, 40, 0x6b6050, 0x3e3830); grid.position.y = 0.2; scene.add(grid);       // 1 quadrado = 50 unidades ≈ 1 m
    // lista de modelos
    const list = root.querySelector('#scList');
    const fill = q => {
      list.innerHTML = '';
      Object.entries(PROP_CATS).filter(([k]) => k !== 'item').forEach(([k, n]) => {
        const ps = PROPS.filter(p => p.cat === k && (!q || (p.n + ' ' + p.d).toLowerCase().includes(q))); if (!ps.length) return;
        const h = document.createElement('h4'); h.textContent = n; list.appendChild(h);
        ps.forEach(p => { const b = document.createElement('button'); b.className = 'scitem'; b.innerHTML = `<i style="background-image:url(props/${p.id}.png)"></i><span>${p.n}</span>`; b.onclick = () => startPlace(p); list.appendChild(b); });
      });
    };
    fill(''); root.querySelector('#scFind').oninput = e => fill(e.target.value.toLowerCase());
    cv.addEventListener('pointermove', onMove); cv.addEventListener('pointerdown', onDown); window.addEventListener('pointerup', () => { if (drag) { drag = false; controls.enabled = true; } });
    window.addEventListener('keydown', onKey);
    root.querySelector('#scClose').onclick = close;
    root.querySelector('#scClear').onclick = () => { items.forEach(o => scene.remove(o)); items = []; select(null); info(); };
    root.querySelector('#scSave').onclick = () => { try { localStorage.setItem(SAVE, JSON.stringify(serialize())); toast('Cena salva neste navegador', 'ok'); } catch (e) { toast('Não deu para salvar: ' + e.message, 'err'); } };
    root.querySelector('#scLoad').onclick = () => { try { const d = JSON.parse(localStorage.getItem(SAVE) || 'null'); if (!d) return toast('Nenhuma cena salva', 'warn'); load(d); } catch (e) { toast('Cena salva inválida', 'err'); } };
    root.querySelector('#scExport').onclick = exportMap;
    new ResizeObserver(resize).observe(cv.parentElement);
  }
  function resize() { const p = root.querySelector('.scmain'), w = p.clientWidth, h = p.clientHeight - 44; renderer.setSize(w, h, false); renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px'; camera.aspect = w / h; camera.updateProjectionMatrix(); }
  function pick(e) { const r = renderer.domElement.getBoundingClientRect(); mouse.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(mouse, camera); }
  function groundAt(e) { pick(e); const p = new THREE.Vector3(); return ray.ray.intersectPlane(ground, p) ? p : null; }
  const snap = v => Math.round(v / 5) * 5;
  function startPlace(def) {
    if (ghost) scene.remove(ghost);
    try { ghost = propMesh(def); } catch (e) { return toast('Falha ao montar ' + def.n + ': ' + e.message, 'err'); }
    ghost.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.55; } });
    placing = def; scene.add(ghost); select(null);
  }
  function onMove(e) {
    const p = groundAt(e); if (!p) return;
    if (ghost) ghost.position.set(snap(p.x), 0, snap(p.z));
    if (drag && sel) { sel.position.set(snap(p.x - sel.userData.off.x), 0, snap(p.z - sel.userData.off.z)); info(); }
  }
  function onDown(e) {
    if (e.button !== 0) return;
    if (placing && ghost) {
      const o = propMesh(placing); o.position.copy(ghost.position); o.rotation.y = ghost.rotation.y; scene.add(o); items.push(o); select(o);
      if (!e.shiftKey) { scene.remove(ghost); ghost = null; placing = null; }
      info(); return;
    }
    pick(e); const hit = ray.intersectObjects(items, true)[0];
    if (hit) { let o = hit.object; while (o.parent && !items.includes(o)) o = o.parent; select(o); const p = groundAt(e); o.userData.off = p ? p.clone().sub(o.position) : new THREE.Vector3(); drag = true; controls.enabled = false; }
    else select(null);
  }
  function select(o) {
    if (sel) sel.traverse(m => { if (m.isMesh) m.material.emissive && m.material.emissive.setHex(0); });
    sel = o;
    if (sel) sel.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.emissive.setHex(0x3a1620); } });
    info();
  }
  function onKey(e) {
    if (!root || root.style.display === 'none' || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    const t = sel || ghost; if (!t && e.key !== 'Escape') return;
    if (e.key === 'q' || e.key === 'Q') t.rotation.y += Math.PI / 12;
    else if (e.key === 'e' || e.key === 'E') t.rotation.y -= Math.PI / 12;
    else if ((e.key === 'Delete' || e.key === 'Backspace') && sel) { scene.remove(sel); items = items.filter(x => x !== sel); select(null); }
    else if ((e.key === 'd' || e.key === 'D') && sel) { const o = propMesh(sel.userData.def); o.position.copy(sel.position).add(new THREE.Vector3(40, 0, 40)); o.rotation.y = sel.rotation.y; scene.add(o); items.push(o); select(o); }
    else if (e.key === 'Escape') { if (ghost) scene.remove(ghost); ghost = null; placing = null; select(null); }
    else return;
    e.preventDefault(); info();
  }
  // AC: X/Y no chão (em cubos), yaw em graus; 1 cubo ≈ 16 unidades MD3 (≈ 32 cm)
  const toAC = o => ({ id: o.userData.def.id, x: +(o.position.x / 16).toFixed(1), y: +(-o.position.z / 16).toFixed(1), yaw: Math.round(((o.rotation.y * 180 / Math.PI) % 360 + 360) % 360) });
  function serialize() { return { v: 1, items: items.map(o => ({ id: o.userData.def.id, p: o.position.toArray(), r: o.rotation.y })) }; }
  function load(d) {
    items.forEach(o => scene.remove(o)); items = [];
    d.items.forEach(it => { const def = PROPS.find(p => p.id === it.id); if (!def) return; const o = propMesh(def); o.position.fromArray(it.p); o.rotation.y = it.r; scene.add(o); items.push(o); });
    select(null); info();
  }
  function info() {
    const n = items.length, ids = new Set(items.map(o => o.userData.def.id));
    root.querySelector('#scInfo').textContent = `${n} objetos · ${ids.size} modelos diferentes` + (sel ? ` · selecionado: ${sel.userData.def.n} (${(sel.position.x / 50).toFixed(1)} m, ${(-sel.position.z / 50).toFixed(1)} m, ${Math.round(sel.rotation.y * 180 / Math.PI) % 360}°)` : '');
  }
  function exportMap() {
    if (!items.length) return toast('A cena está vazia', 'warn');
    const ids = [...new Set(items.map(o => o.userData.def.id))];
    const defs = ids.map(id => PROPS.find(p => p.id === id));
    const lines = defs.map((d, i) => `mapmodel ${d.mm || '1 3 0 0'} "cubemaker/${d.id}"\t// ${i} — ${d.n}`).join('\n');
    const place = items.map(o => { const a = toAC(o); return `${String(ids.indexOf(a.id)).padStart(3)}  ${a.x.toFixed(1).padStart(7)} ${a.y.toFixed(1).padStart(7)} ${String(a.yaw).padStart(4)}°   ${PROPS.find(p => p.id === a.id).n}`; }).join('\n');
    const txt = `// CUBE MAKER — cena com ${items.length} objetos\n// 1) Instale cada mapmodel abaixo pelo CUBE MAKER (Mapmodels → Instalar no jogo).\n// 2) Cole estas linhas no FIM do .cfg do seu mapa (packages/maps/<mapa>.cfg).\n//    Os números mudam se o mapa já tiver mapmodels: some a quantidade que já existe.\n\n${lines}\n\n// Posições (relativas ao centro da cena, em cubos do AC; 1 cubo ≈ 32 cm) e giro:\n// nº   X       Y      giro   modelo\n${place.split('\n').map(l => '// ' + l).join('\n')}\n// No editor: vá até a posição, mire no chão e use /newent mapmodel <nº> <giro>.\n`;
    download('cena_cubemaker.cfg', new Blob([txt], { type: 'text/plain' }));
    // planta vista de cima
    renderer.render(scene, camera);
    const top = new THREE.OrthographicCamera(-700, 700, 700, -700, 1, 4000); const b = new THREE.Box3(); items.forEach(o => b.expandByObject(o));
    const c = b.getCenter(new THREE.Vector3()), s = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) / 2 + 80;
    Object.assign(top, { left: -s, right: s, top: s, bottom: -s }); top.position.set(c.x, 2000, c.z); top.up.set(0, 0, -1); top.lookAt(c.x, 0, c.z); top.updateProjectionMatrix();
    const W = 1400, prev = new THREE.Vector2(); renderer.getSize(prev); renderer.setSize(W, W, false); renderer.render(scene, top);
    const shot = document.createElement('canvas'); shot.width = shot.height = W; const x = shot.getContext('2d'); x.drawImage(renderer.domElement, 0, 0, W, W);
    x.font = 'bold 22px sans-serif'; x.textAlign = 'center';
    items.forEach(o => { const v = o.position.clone().project(top); const px = (v.x + 1) / 2 * W, py = (1 - v.y) / 2 * W, n = ids.indexOf(o.userData.def.id); x.fillStyle = '#000a'; x.beginPath(); x.arc(px, py, 16, 0, 7); x.fill(); x.fillStyle = '#ff9fb0'; x.fillText(n, px, py + 8); });
    renderer.setSize(prev.x, prev.y, false); resize();
    shot.toBlob(bl => download('cena_planta.png', bl));
    toast('Exportado: cena_cubemaker.cfg (linhas do mapa + posições) e cena_planta.png', 'ok');
  }
  function loop() { raf = requestAnimationFrame(loop); controls.update(); renderer.render(scene, camera); }
  function open() { if (!root) build(); root.style.display = ''; resize(); cancelAnimationFrame(raf); loop(); info(); }
  function close() { root.style.display = 'none'; cancelAnimationFrame(raf); }
  return { open, close, get items() { return items; }, load, serialize, _place: (id, x, z, r = 0) => { const def = PROPS.find(p => p.id === id); const o = propMesh(def); o.position.set(x, 0, z); o.rotation.y = r; scene.add(o); items.push(o); info(); return o; }, exportMap };
}
