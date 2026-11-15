// CUBE MAKER — editor de armas para AssaultCube
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import JSZip from 'jszip';
import { parseMD3, buildMD3, computeIslands, parseCfg } from './md3.js';
import { MATS, MAT_ORDER, fbm } from './materials.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const D2R = Math.PI / 180;
const VERSION = '0.2.0';

// ---------------------------------------------------------------- estado
let model = null;          // MD3 parseado
let skins = [];            // uma skin por superfície
let meshes = [];           // malhas three.js por superfície
const S = {
  weapon: 'subgun', cfg: '', frame: 0, playing: false, animIdx: -1, fps: 12,
  tool: 'nav', mat: 'acoOxidado', brush: { color: '#5a3a1e', size: 18, opacity: 0.6, hard: 0.4 },
  global: { wear: 0.35, age: 0.25, dirt: 0.25, bright: 0, contrast: 1 },
  islandMat: [],           // por superfície: Map(ilha -> chave do material)
  groups: [], gi: -1,      // grupos de peças
  sel: { si: -1, isl: new Set() },
  tagOffset: [0, 0, 0], editSkin: 0, showTag: true, showWire: true,
  originalMD3: null, modifiedSkins: new Set(), skinFiles: []
};
const undoStack = [], redoStack = [];

// ---------------------------------------------------------------- utilidades
function toast(msg, kind = '') {
  const t = $('#toast'); t.textContent = msg; t.className = 'show ' + kind;
  clearTimeout(toast._t); toast._t = setTimeout(() => t.className = '', 2600);
}
function b64ToBuf(b) { const s = atob(b); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; }
function bufToB64(buf) { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
function loadImage(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Imagem inválida')); i.src = src; }); }
function dataURLtoBlob(u) {
  const [h, b] = u.split(','); const mime = (h.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
  return new Blob([b64ToBuf(b)], { type: mime });
}
function fileToDataURL(f) { return new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); }); }
function download(name, blob) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const baseName = p => p.split(/[\\/]/).pop().toLowerCase();

// ---------------------------------------------------------------- 3D
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.35;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b1d17);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.12;
scene.add(new THREE.HemisphereLight(0xf2eee2, 0x3a382e, 1.6));
scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const sun = new THREE.DirectionalLight(0xfff4e2, 2.4); sun.position.set(30, 50, 40); scene.add(sun);
const rim = new THREE.DirectionalLight(0xdfe4ea, 0.9); rim.position.set(-40, 10, -30); scene.add(rim);
const fill = new THREE.DirectionalLight(0xfff8ee, 0.8); fill.position.set(0, -30, 30); scene.add(fill);
const grid = new THREE.GridHelper(120, 24, 0x4a4c3a, 0x2c2e24); grid.position.y = -25; scene.add(grid);
const root = new THREE.Group(); root.rotation.x = -Math.PI / 2; scene.add(root); // MD3 é Z para cima
const tagMarker = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff8a1e, depthTest: false }));
tagMarker.renderOrder = 10; root.add(tagMarker);
const pivotMarker = new THREE.Mesh(new THREE.OctahedronGeometry(0.7), new THREE.MeshBasicMaterial({ color: 0x8fd16a, wireframe: true, depthTest: false }));
pivotMarker.renderOrder = 11; root.add(pivotMarker);

function resize() {
  const r = canvas.parentElement.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / Math.max(1, r.height); camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas.parentElement);

function frameCamera(mode = 'orbit') {
  if (!model) return;
  const box = new THREE.Box3();
  meshes.forEach(m => { m.geometry.computeBoundingBox(); const b = m.geometry.boundingBox.clone().applyMatrix4(root.matrixWorld); box.union(b); });
  const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3()).length();
  grid.visible = mode !== 'fps';
  if (mode === 'fps') {           // câmera na posição do olho do jogador (origem do MD3)
    camera.fov = 65; camera.updateProjectionMatrix();
    camera.position.set(0, 0, 0.01); controls.target.set(0, 0, -12);
  } else {
    camera.fov = 45; camera.updateProjectionMatrix();
    const dirs = { orbit: [1, 0.55, 0.9], side: [1, 0, 0], top: [0, 1, 0.0001], front: [0, 0.05, -1] };
    const d = new THREE.Vector3(...(dirs[mode] || dirs.orbit)).normalize();
    camera.position.copy(c).addScaledVector(d, sz * 1.15); controls.target.copy(c);
  }
  controls.update();
}

// ---------------------------------------------------------------- carregamento do modelo
async function loadWeapon({ md3Buf, cfgText, skinImages, weaponName, project, skinSources }) {
  const m = parseMD3(md3Buf);
  m.surfaces.forEach(computeIslands);
  meshes.forEach(x => { root.remove(x); x.geometry.dispose(); x.material.dispose(); });
  skins.forEach(sk => sk.texture && sk.texture.dispose());
  model = m; meshes = []; skins = [];
  S.originalMD3 = md3Buf; S.cfg = cfgText || defaultCfg(m); S.weapon = weaponName || S.weapon;
  S.originalCfg = cfgText || null; S.skinSources = skinSources || [];
  S.islandMat = m.surfaces.map(() => new Map()); S.groups = []; S.gi = -1; S.sel = { si: -1, isl: new Set() };
  S.tagOffset = [0, 0, 0]; S.frame = 0; S.modifiedSkins = new Set(); undoStack.length = 0; redoStack.length = 0;
  const cfg = parseCfg(S.cfg);
  S.skinFiles = m.surfaces.map(s => cfg.skins[s.name] || (s.name === 'weapon' ? 'skin_weapon.jpg' : 'skin_' + s.name + '.jpg'));
  for (let i = 0; i < m.surfaces.length; i++) {
    const img = skinImages[i] || await placeholderSkin();
    skins.push(makeSkin(i, img));
  }
  m.surfaces.forEach((s, i) => meshes.push(makeMesh(i)));
  S.editSkin = Math.max(0, m.surfaces.findIndex(s => s.name === 'weapon'));
  if (project) applyProject(project);
  else skins.forEach((_, i) => composite(i));
  $('#weaponName').value = S.weapon; $('#cfgText').value = S.cfg;
  updateAll(); frameCamera('orbit');
  $('#empty').style.display = 'none';
  toast(`Carregado: ${S.weapon} — ${m.surfaces.length} partes, ${m.nf} quadros`, 'ok');
}
function defaultCfg(m) {
  const lines = ['md3load tris_high.md3'];
  m.surfaces.forEach(s => lines.push(`md3skin ${s.name} ${s.name === 'hands' ? '../knife/skin_hands.jpg' : 'skin_' + s.name + '.jpg'}`));
  lines.push('md3anim "gun idle" 0 1', `md3anim "gun shoot" ${Math.min(8, m.nf - 1)} ${Math.max(1, m.nf - 8)}`, 'md3anim "gun reload" 0 1', 'md3emit tag_muzzle HUDMUZZLEFLASH 50 55');
  return lines.join('\n') + '\n';
}
async function placeholderSkin() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const x = c.getContext('2d'); x.fillStyle = '#6b6b63'; x.fillRect(0, 0, 256, 256); return c;
}

// ---------------------------------------------------------------- skins
function makeSkin(si, img) {
  const S_ = model.surfaces[si];
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const mk = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const orig = mk(), base = mk(), overlay = mk(), result = mk();
  const octx = orig.getContext('2d', { willReadFrequently: true }); octx.drawImage(img, 0, 0, w, h);
  const origData = octx.getImageData(0, 0, w, h);
  // mapa de ilhas por pixel
  const id = new Int32Array(w * h).fill(-1);
  for (let t = 0; t < S_.ntri; t++) {
    const a = S_.tris[t * 3], b = S_.tris[t * 3 + 1], c = S_.tris[t * 3 + 2], isl = S_.island[a];
    const x0 = S_.st[a * 2] * w, y0 = S_.st[a * 2 + 1] * h, x1 = S_.st[b * 2] * w, y1 = S_.st[b * 2 + 1] * h, x2 = S_.st[c * 2] * w, y2 = S_.st[c * 2 + 1] * h;
    const area = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0); if (Math.abs(area) < 1e-9) continue;
    const minX = clamp(Math.floor(Math.min(x0, x1, x2)), 0, w - 1), maxX = clamp(Math.ceil(Math.max(x0, x1, x2)), 0, w - 1);
    const minY = clamp(Math.floor(Math.min(y0, y1, y2)), 0, h - 1), maxY = clamp(Math.ceil(Math.max(y0, y1, y2)), 0, h - 1);
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0 = ((x2 - x1) * (py - y1) - (y2 - y1) * (px - x1)) / area;
      const w1 = ((x0 - x2) * (py - y2) - (y0 - y2) * (px - x2)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 >= -0.001 && w1 >= -0.001 && w2 >= -0.001) id[y * w + x] = isl;
    }
  }
  for (let pass = 0; pass < 3; pass++) {            // dilata para cobrir costuras
    const prev = id.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (prev[i] >= 0) continue;
      const n = (x > 0 && prev[i - 1] >= 0) ? prev[i - 1] : (x < w - 1 && prev[i + 1] >= 0) ? prev[i + 1] : (y > 0 && prev[i - w] >= 0) ? prev[i - w] : (y < h - 1 && prev[i + w] >= 0) ? prev[i + w] : -1;
      if (n >= 0) id[i] = n;
    }
  }
  // distância até a borda da ilha (para desgaste)
  const border = new Uint8Array(w * h).fill(255), q = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, v = id[i]; if (v < 0) continue;
    if ((x > 0 && id[i - 1] !== v) || (x < w - 1 && id[i + 1] !== v) || (y > 0 && id[i - w] !== v) || (y < h - 1 && id[i + w] !== v)) { border[i] = 0; q.push(i); }
  }
  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi], d = border[i]; if (d >= 6) continue;
    const x = i % w;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
      if (j < 0 || j >= w * h || id[j] !== id[i] || border[j] <= d + 1) continue;
      border[j] = d + 1; q.push(j);
    }
  }
  // luminância média por ilha + orientação (veio da madeira)
  const sum = new Float64Array(S_.nIsl), cnt = new Float64Array(S_.nIsl);
  const D = origData.data;
  for (let i = 0; i < w * h; i++) { const v = id[i]; if (v < 0) continue; sum[v] += (0.299 * D[i * 4] + 0.587 * D[i * 4 + 1] + 0.114 * D[i * 4 + 2]) / 255; cnt[v]++; }
  const mean = new Float32Array(S_.nIsl); for (let i = 0; i < S_.nIsl; i++) mean[i] = Math.max(0.035, cnt[i] ? sum[i] / cnt[i] : 0.2);
  const dir = new Uint8Array(S_.nIsl);
  for (let i = 0; i < S_.nIsl; i++) {
    let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
    S_.islVerts[i].forEach(v => { mnx = Math.min(mnx, S_.st[v * 2] * w); mxx = Math.max(mxx, S_.st[v * 2] * w); mny = Math.min(mny, S_.st[v * 2 + 1] * h); mxy = Math.max(mxy, S_.st[v * 2 + 1] * h); });
    dir[i] = (mxy - mny) > (mxx - mnx) ? 1 : 0;
  }
  // ruídos pré-calculados
  const noise = new Float32Array(w * h), fine = new Float32Array(w * h);
  const seed = si * 97.3;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { noise[y * w + x] = fbm(x / 70 + seed, y / 70); fine[y * w + x] = fbm(x / 6 + 31 + seed, y / 6 + 17); }
  const texture = new THREE.CanvasTexture(result);
  texture.flipY = false; texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  return { si, w, h, orig, origData, base, overlay, result, id, border, mean, dir, noise, fine, texture };
}

function patternFactor(m, sk, i, x, y, isl) {
  switch (m.p) {
    case 'wood': {
      const a = sk.dir[isl] ? y : x, b = sk.dir[isl] ? x : y;
      return 0.84 + 0.17 * Math.sin(b * 0.32 + fbm(a * 0.006 + isl, b * 0.035) * 11) + 0.16 * (fbm(a * 0.025, b * 0.5 + isl) - 0.5);
    }
    case 'metal': return 0.94 + 0.12 * (sk.fine[i] - 0.5) + 0.06 * (sk.noise[i] - 0.5);
    case 'bakelite': return 0.9 + 0.25 * (fbm(x * 0.04, y * 0.04 + 9) - 0.5) + 0.06 * (sk.fine[i] - 0.5);
    case 'paint': return 0.95 + 0.1 * (sk.noise[i] - 0.5) + 0.05 * (sk.fine[i] - 0.5);
    case 'leather': return 0.86 + 0.28 * (sk.fine[i] - 0.5) + 0.1 * (sk.noise[i] - 0.5);
    case 'cloth': return 0.9 + 0.08 * (((x + y) & 3) < 2 ? 1 : -1) + 0.1 * (sk.fine[i] - 0.5);
    default: return 1;
  }
}

function composite(si) {
  const sk = skins[si]; if (!sk) return;
  const { w, h } = sk, O = sk.origData.data, mats = S.islandMat[si], G = S.global;
  const ctx = sk.base.getContext('2d');
  const out = ctx.createImageData(w, h), D = out.data;
  const matOf = []; mats.forEach((k, isl) => matOf[isl] = MATS[k]);
  const C = G.contrast, B = G.bright * 255;
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i++) {
    const j = i * 4; let r = O[j], g = O[j + 1], b = O[j + 2];
    const isl = sk.id[i], m = isl >= 0 ? matOf[isl] : null;
    if (m) {
      const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      let k = Math.pow(Math.min(L / sk.mean[isl], 3.2), 0.85) * patternFactor(m, sk, i, x, y, isl);
      r = m.c[0] * k; g = m.c[1] * k; b = m.c[2] * k;
      if (G.wear > 0 && m.wear) {                       // bordas gastas mostrando metal claro / madeira gasta
        const bd = sk.border[i];
        if (bd < 4) {
          const f = clamp(G.wear * m.wear * (1 - bd / 4) * (0.55 + 0.9 * sk.fine[i]), 0, 1);
          const t = m.wearColor || [168, 166, 158];
          r += (t[0] * k - r) * f; g += (t[1] * k - g) * f; b += (t[2] * k - b) * f;
        }
      }
    }
    if (G.age > 0) {                                    // envelhecimento: dessatura e puxa para sépia
      const gr = 0.3 * r + 0.59 * g + 0.11 * b, a = G.age * 0.65;
      r += (gr * 1.08 + 6 - r) * a; g += (gr * 0.97 + 2 - g) * a; b += (gr * 0.78 - b) * a;
    }
    if (G.dirt > 0) {                                   // sujeira e manchas
      const mul = 1 - G.dirt * (0.45 * Math.pow(sk.noise[i], 2.2) + 0.12 * sk.fine[i]);
      r = r * mul + G.dirt * 6; g = g * mul + G.dirt * 5; b = b * mul + G.dirt * 2;
    }
    r = (r - 128) * C + 128 + B; g = (g - 128) * C + 128 + B; b = (b - 128) * C + 128 + B;
    D[j] = r; D[j + 1] = g; D[j + 2] = b; D[j + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  refreshResult(si);
}
function refreshResult(si) {
  const sk = skins[si]; const ctx = sk.result.getContext('2d', { willReadFrequently: true });
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(sk.base, 0, 0); ctx.drawImage(sk.overlay, 0, 0);
  sk.texture.needsUpdate = true;
  if (si === S.editSkin) draw2D();
}
let compositeQueued = new Set();
function queueComposite(si) {
  if (si === undefined) skins.forEach((_, i) => compositeQueued.add(i)); else compositeQueued.add(si);
  if (queueComposite.raf) return;
  queueComposite.raf = requestAnimationFrame(() => { queueComposite.raf = 0; compositeQueued.forEach(composite); compositeQueued.clear(); });
}

// ---------------------------------------------------------------- malhas
function makeMesh(si) {
  const s = model.surfaces[si];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(s.nv * 3), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(s.nv * 3), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(s.st, 2));
  const col = new Float32Array(s.nv * 3).fill(1);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(new Uint32Array(s.tris), 1));
  const mat = new THREE.MeshStandardMaterial({ map: skins[si].texture, vertexColors: true, roughness: 0.62, metalness: 0.18, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat); mesh.userData.si = si;
  root.add(mesh);
  const mkOv = color => {
    const g2 = new THREE.BufferGeometry();
    g2.setAttribute('position', geo.attributes.position); g2.setIndex([]);
    const o = new THREE.Mesh(g2, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.38, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide }));
    o.raycast = () => {}; mesh.add(o); return o;
  };
  mesh.userData.selOv = mkOv(0xff9a3c); mesh.userData.grpOv = mkOv(0x8fd16a);
  const wire = new THREE.LineSegments(new THREE.WireframeGeometry(geo), new THREE.LineBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.0, depthTest: true }));
  mesh.userData.wire = wire;
  return mesh;
}

// grupos: vértice -> grupo
function vertexGroups(si) {
  const s = model.surfaces[si], vg = new Int32Array(s.nv).fill(-1);
  S.groups.forEach((g, gi) => { if (g.si !== si) return; g.isl.forEach(isl => s.islVerts[isl].forEach(v => vg[v] = gi)); });
  return vg;
}
function interpKey(g, f) {
  const ks = Object.keys(g.keys).map(Number).sort((a, b) => a - b);
  if (!ks.length) return null;
  if (f <= ks[0]) return g.keys[ks[0]];
  if (f >= ks[ks.length - 1]) return g.keys[ks[ks.length - 1]];
  for (let i = 0; i < ks.length - 1; i++) if (f >= ks[i] && f <= ks[i + 1]) {
    const a = g.keys[ks[i]], b = g.keys[ks[i + 1]], t = (f - ks[i]) / (ks[i + 1] - ks[i]);
    const e = t * t * (3 - 2 * t);                         // suavização
    return { t: a.t.map((v, k) => v + (b.t[k] - v) * e), r: a.r.map((v, k) => v + (b.r[k] - v) * e) };
  }
  return null;
}
function groupMatrix(g, f) {
  const p = new THREE.Vector3(...g.pivot), t = new THREE.Vector3(...g.t);
  let M = new THREE.Matrix4().makeTranslation(p.x + t.x, p.y + t.y, p.z + t.z)
    .multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(g.r[0] * D2R, g.r[1] * D2R, g.r[2] * D2R)))
    .multiply(new THREE.Matrix4().makeScale(g.s[0], g.s[1], g.s[2]))
    .multiply(new THREE.Matrix4().makeTranslation(-p.x, -p.y, -p.z));
  const k = interpKey(g, f);
  if (k) {
    const c = p.clone().add(t);
    const A = new THREE.Matrix4().makeTranslation(c.x + k.t[0], c.y + k.t[1], c.z + k.t[2])
      .multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(k.r[0] * D2R, k.r[1] * D2R, k.r[2] * D2R)))
      .multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z));
    M = A.multiply(M);
  }
  return M;
}
function computeSurface(si, f) {
  const s = model.surfaces[si], vg = vertexGroups(si);
  const P = new Float32Array(s.pos[f]), N = new Float32Array(s.nrm[f]), moved = new Uint8Array(s.nv);
  const mats = S.groups.map(g => { if (g.si !== si) return null; const M = groupMatrix(g, f); return { M, N: new THREE.Matrix3().getNormalMatrix(M), id: M.equals(new THREE.Matrix4()) }; });
  const v3 = new THREE.Vector3();
  for (let v = 0; v < s.nv; v++) {
    const gi = vg[v]; if (gi < 0 || !mats[gi] || mats[gi].id) continue;
    v3.set(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]).applyMatrix4(mats[gi].M); P[v * 3] = v3.x; P[v * 3 + 1] = v3.y; P[v * 3 + 2] = v3.z;
    v3.set(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]).applyMatrix3(mats[gi].N).normalize(); N[v * 3] = v3.x; N[v * 3 + 1] = v3.y; N[v * 3 + 2] = v3.z;
    moved[v] = 1;
  }
  return { P, N, moved };
}
function visibleTris(si) {
  const s = model.surfaces[si], hidden = new Set();
  S.groups.forEach(g => { if (g.si === si && g.hidden) g.isl.forEach(i => hidden.add(i)); });
  if (!hidden.size) return s.tris;
  const out = [];
  for (let t = 0; t < s.ntri; t++) if (!hidden.has(s.island[s.tris[t * 3]])) out.push(s.tris[t * 3], s.tris[t * 3 + 1], s.tris[t * 3 + 2]);
  return new Int32Array(out);
}
function updateGeometry() {
  if (!model) return;
  meshes.forEach((mesh, si) => {
    const { P, N } = computeSurface(si, S.frame);
    const g = mesh.geometry;
    g.attributes.position.array.set(P); g.attributes.position.needsUpdate = true;
    g.attributes.normal.array.set(N); g.attributes.normal.needsUpdate = true;
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(visibleTris(si)), 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    mesh.visible = !model.surfaces[si].hiddenView;
  });
  // tag (boca do cano)
  if (model.tagNames.length) {
    const tg = model.tags[Math.min(S.frame, model.tags.length - 1)][0];
    tagMarker.position.set(tg.origin[0] + S.tagOffset[0], tg.origin[1] + S.tagOffset[1], tg.origin[2] + S.tagOffset[2]);
    tagMarker.visible = S.showTag;
  } else tagMarker.visible = false;
  const g = S.groups[S.gi];
  pivotMarker.visible = !!g && S.showTag;
  if (g) pivotMarker.position.set(g.pivot[0] + g.t[0], g.pivot[1] + g.t[1], g.pivot[2] + g.t[2]);
  updateColors();
}
function updateColors() {
  meshes.forEach((mesh, si) => {
    const s = model.surfaces[si], gsel = S.groups[S.gi];
    const idx = set => { const out = []; set.forEach(i => s.islTris[i].forEach(t => out.push(s.tris[t * 3], s.tris[t * 3 + 1], s.tris[t * 3 + 2]))); return out; };
    const selSet = S.sel.si === si ? S.sel.isl : new Set();
    const grpSet = gsel && gsel.si === si && !gsel.hidden ? new Set([...gsel.isl].filter(i => !selSet.has(i))) : new Set();
    mesh.userData.selOv.geometry.setIndex(idx(selSet));
    mesh.userData.grpOv.geometry.setIndex(idx(grpSet));
    mesh.userData.selOv.visible = S.showTag || true; mesh.userData.grpOv.visible = S.showTag;
  });
}

// ---------------------------------------------------------------- desfazer
function snapshot(label) {
  undoStack.push(captureState(label)); if (undoStack.length > 30) undoStack.shift(); redoStack.length = 0;
}
function captureState(label) {
  return {
    label,
    islandMat: S.islandMat.map(m => new Map(m)),
    groups: JSON.parse(JSON.stringify(S.groups.map(g => ({ ...g, isl: [...g.isl] })))),
    gi: S.gi, global: { ...S.global }, tagOffset: [...S.tagOffset],
    overlays: skins.map(sk => sk.overlay.getContext('2d').getImageData(0, 0, sk.w, sk.h)),
    nf: model.nf
  };
}
function restoreState(st) {
  S.islandMat = st.islandMat; S.groups = st.groups.map(g => ({ ...g, isl: new Set(g.isl) })); S.gi = st.gi;
  S.global = st.global; S.tagOffset = st.tagOffset;
  if (st.nf !== model.nf) setFrameCount(st.nf, true);
  skins.forEach((sk, i) => sk.overlay.getContext('2d').putImageData(st.overlays[i], 0, 0));
  skins.forEach((_, i) => composite(i)); updateAll();
}
function undo() { if (!undoStack.length || !model) return; redoStack.push(captureState('redo')); const st = undoStack.pop(); restoreState(st); toast('Desfeito: ' + st.label); }
function redo() { if (!redoStack.length || !model) return; undoStack.push(captureState('undo')); restoreState(redoStack.pop()); toast('Refeito'); }

// ---------------------------------------------------------------- seleção e materiais
function selectIsland(si, isl, { add = false, piece = false } = {}) {
  const s = model.surfaces[si];
  const list = piece ? [...Array(s.nIsl).keys()].filter(i => s.piece[i] === s.piece[isl]) : [isl];
  if (S.sel.si !== si || !add) S.sel = { si, isl: new Set() };
  const allIn = list.every(i => S.sel.isl.has(i));
  list.forEach(i => add && allIn ? S.sel.isl.delete(i) : S.sel.isl.add(i));
  if (S.editSkin !== si) { S.editSkin = si; }
  updateSelectionUI(); updateColors(); draw2D();
}
function assignMaterial(si, islands, key) {
  snapshot('material');
  islands.forEach(i => key ? S.islandMat[si].set(i, key) : S.islandMat[si].delete(i));
  S.modifiedSkins.add(si); composite(si);
}

// ---------------------------------------------------------------- pintura
let painting = null;
function stamp(si, x, y) {
  const sk = skins[si], ctx = sk.overlay.getContext('2d', { willReadFrequently: true }), B = S.brush, r = B.size / 2;
  if (S.tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    const gr = ctx.createRadialGradient(x, y, r * B.hard, x, y, r);
    gr.addColorStop(0, `rgba(0,0,0,${B.opacity})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr;
  } else {
    ctx.globalCompositeOperation = 'source-over';
    const c = B.color, rr = parseInt(c.slice(1, 3), 16), gg = parseInt(c.slice(3, 5), 16), bb = parseInt(c.slice(5, 7), 16);
    const gr = ctx.createRadialGradient(x, y, r * B.hard, x, y, r);
    gr.addColorStop(0, `rgba(${rr},${gg},${bb},${B.opacity * 0.35})`); gr.addColorStop(1, `rgba(${rr},${gg},${bb},0)`);
    ctx.fillStyle = gr;
  }
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}
function paintTo(si, x, y) {
  if (!painting || painting.si !== si || painting.last == null) { stamp(si, x, y); painting = { si, last: [x, y] }; }
  else {
    const [lx, ly] = painting.last, d = Math.hypot(x - lx, y - ly), step = Math.max(1, S.brush.size * 0.18);
    if (d > S.brush.size * 4) { stamp(si, x, y); }        // salto (costura UV): não liga os pontos
    else for (let t = step; t <= d; t += step) stamp(si, lx + (x - lx) * t / d, ly + (y - ly) * t / d);
    painting.last = [x, y];
  }
  S.modifiedSkins.add(si); refreshResult(si);
}
function pickColor(si, x, y) {
  const d = skins[si].result.getContext('2d').getImageData(clamp(x | 0, 0, skins[si].w - 1), clamp(y | 0, 0, skins[si].h - 1), 1, 1).data;
  S.brush.color = '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('');
  $('#brushColor').value = S.brush.color; toast('Cor capturada ' + S.brush.color);
}

// ---------------------------------------------------------------- interação 3D
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function hit3D(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(meshes.filter(m => m.visible), false);
  return hits[0] || null;
}
function setTool(t) {
  S.tool = t;
  $$('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
  const paintMode = t === 'brush' || t === 'eraser';
  controls.mouseButtons = paintMode
    ? { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }
    : { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  canvas.style.cursor = paintMode ? 'crosshair' : t === 'picker' ? 'copy' : t === 'material' ? 'cell' : 'default';
  $('#brushBox').style.display = paintMode ? '' : 'none';
}
let down = null;
canvas.addEventListener('pointerdown', e => {
  if (!model) return;
  down = { x: e.clientX, y: e.clientY, b: e.button };
  if (e.button === 0 && (S.tool === 'brush' || S.tool === 'eraser')) {
    const h = hit3D(e);
    snapshot(S.tool === 'brush' ? 'pincel' : 'borracha');
    painting = { si: -1, last: null };
    if (h && h.uv) { const si = h.object.userData.si; paintTo(si, h.uv.x * skins[si].w, h.uv.y * skins[si].h); }
    canvas.setPointerCapture(e.pointerId);
  }
});
canvas.addEventListener('pointermove', e => {
  if (!model) return;
  if (painting && (e.buttons & 1)) {
    const h = hit3D(e);
    if (h && h.uv) { const si = h.object.userData.si; paintTo(si, h.uv.x * skins[si].w, h.uv.y * skins[si].h); }
    else painting.last = null;
  }
  if (S.tool === 'brush' || S.tool === 'eraser') {
    const h = hit3D(e); brushCursor(h);
  }
});
canvas.addEventListener('pointerup', e => {
  if (!model || !down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4;
  if (painting) { painting = null; down = null; return; }
  if (!moved && down.b === 0) {
    const h = hit3D(e);
    if (h) {
      const si = h.object.userData.si, isl = model.surfaces[si].island[h.face.a];
      if (S.tool === 'material') {
        const s = model.surfaces[si];
        const list = e.altKey ? [isl] : (S.sel.si === si && S.sel.isl.has(isl)) ? [...S.sel.isl] : [...Array(s.nIsl).keys()].filter(i => s.piece[i] === s.piece[isl]);
        assignMaterial(si, list, S.mat); S.editSkin = si; draw2D();
      } else if (S.tool === 'picker' && h.uv) { pickColor(h.object.userData.si, h.uv.x * skins[si].w, h.uv.y * skins[si].h); }
      else selectIsland(si, isl, { add: e.shiftKey || e.ctrlKey });
    } else if (S.tool === 'nav' && !e.shiftKey) { S.sel = { si: -1, isl: new Set() }; updateSelectionUI(); updateColors(); draw2D(); }
  }
  down = null;
});
canvas.addEventListener('dblclick', e => {
  if (!model || S.tool !== 'nav') return;
  const h = hit3D(e); if (!h) return;
  const si = h.object.userData.si; selectIsland(si, model.surfaces[si].island[h.face.a], { add: e.shiftKey, piece: true });
});
const brushRing = $('#brushRing');
function brushCursor(h) {
  if (!h || !h.uv) { brushRing.style.display = 'none'; return; }
  brushRing.style.display = 'none';
}

// ---------------------------------------------------------------- vista 2D da skin
const c2d = $('#uv2d'), x2d = c2d.getContext('2d');
let view2d = { scale: 1, ox: 0, oy: 0 };
function draw2D() {
  const sk = skins[S.editSkin];
  const W = c2d.clientWidth, H = c2d.clientHeight;
  if (c2d.width !== W * devicePixelRatio) { c2d.width = W * devicePixelRatio; c2d.height = H * devicePixelRatio; }
  x2d.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  x2d.fillStyle = '#121310'; x2d.fillRect(0, 0, W, H);
  if (!sk) return;
  const sc = Math.min(W / sk.w, H / sk.h) * view2d.scale;
  const ox = (W - sk.w * sc) / 2 + view2d.ox, oy = (H - sk.h * sc) / 2 + view2d.oy;
  view2d.cur = { sc, ox, oy };
  x2d.imageSmoothingEnabled = sc < 1;
  x2d.drawImage(sk.result, ox, oy, sk.w * sc, sk.h * sc);
  const s = model.surfaces[S.editSkin];
  const tri = (t) => { const a = s.tris[t * 3], b = s.tris[t * 3 + 1], c = s.tris[t * 3 + 2]; x2d.moveTo(ox + s.st[a * 2] * sk.w * sc, oy + s.st[a * 2 + 1] * sk.h * sc); x2d.lineTo(ox + s.st[b * 2] * sk.w * sc, oy + s.st[b * 2 + 1] * sk.h * sc); x2d.lineTo(ox + s.st[c * 2] * sk.w * sc, oy + s.st[c * 2 + 1] * sk.h * sc); x2d.closePath(); };
  if (S.showWire) {
    x2d.beginPath(); for (let t = 0; t < s.ntri; t++) tri(t);
    x2d.strokeStyle = 'rgba(230,200,120,0.28)'; x2d.lineWidth = 0.6; x2d.stroke();
  }
  if (S.sel.si === S.editSkin && S.sel.isl.size) {
    x2d.beginPath(); S.sel.isl.forEach(i => s.islTris[i].forEach(tri));
    x2d.fillStyle = 'rgba(255,150,60,0.28)'; x2d.fill(); x2d.strokeStyle = 'rgba(255,170,80,0.9)'; x2d.lineWidth = 1; x2d.stroke();
  }
  $('#skinLabel').textContent = `${s.name} · ${S.skinFiles[S.editSkin]} · ${sk.w}×${sk.h}`;
}
function uvFromEvent(e) {
  const r = c2d.getBoundingClientRect(), sk = skins[S.editSkin], v = view2d.cur; if (!v) return null;
  return [(e.clientX - r.left - v.ox) / v.sc, (e.clientY - r.top - v.oy) / v.sc, sk];
}
let pan2d = null;
c2d.addEventListener('pointerdown', e => {
  if (!model) return;
  const u = uvFromEvent(e); if (!u) return;
  const [x, y, sk] = u, si = S.editSkin;
  if (e.button === 1 || e.button === 2 || e.altKey && S.tool === 'nav') { pan2d = { x: e.clientX, y: e.clientY, ox: view2d.ox, oy: view2d.oy }; c2d.setPointerCapture(e.pointerId); return; }
  if (S.tool === 'brush' || S.tool === 'eraser') { snapshot('pincel 2D'); painting = { si, last: null }; paintTo(si, x, y); c2d.setPointerCapture(e.pointerId); return; }
  if (S.tool === 'picker') { pickColor(si, x, y); return; }
  if (x < 0 || y < 0 || x >= sk.w || y >= sk.h) return;
  const isl = sk.id[(y | 0) * sk.w + (x | 0)];
  if (isl < 0) return;
  if (S.tool === 'material') {
    const s = model.surfaces[si];
    const list = e.altKey ? [isl] : (S.sel.si === si && S.sel.isl.has(isl)) ? [...S.sel.isl] : [...Array(s.nIsl).keys()].filter(i => s.piece[i] === s.piece[isl]);
    assignMaterial(si, list, S.mat);
  } else selectIsland(si, isl, { add: e.shiftKey || e.ctrlKey, piece: e.detail >= 2 });
});
c2d.addEventListener('pointermove', e => {
  if (pan2d) { view2d.ox = pan2d.ox + e.clientX - pan2d.x; view2d.oy = pan2d.oy + e.clientY - pan2d.y; draw2D(); return; }
  if (painting && (e.buttons & 1)) { const u = uvFromEvent(e); if (u) paintTo(S.editSkin, u[0], u[1]); }
});
c2d.addEventListener('pointerup', () => { painting = null; pan2d = null; });
c2d.addEventListener('contextmenu', e => e.preventDefault());
c2d.addEventListener('wheel', e => {
  e.preventDefault(); const f = e.deltaY < 0 ? 1.15 : 1 / 1.15;
  const r = c2d.getBoundingClientRect(), mx = e.clientX - r.left - c2d.clientWidth / 2, my = e.clientY - r.top - c2d.clientHeight / 2;
  view2d.ox = mx - (mx - view2d.ox) * f; view2d.oy = my - (my - view2d.oy) * f;
  view2d.scale = clamp(view2d.scale * f, 0.5, 12); draw2D();
}, { passive: false });
$('#zoomReset').onclick = () => { view2d = { scale: 1, ox: 0, oy: 0 }; draw2D(); };
new ResizeObserver(() => draw2D()).observe(c2d);

// ---------------------------------------------------------------- grupos
function createGroup() {
  if (!S.sel.isl.size) return toast('Selecione peças primeiro (clique no modelo)', 'warn');
  snapshot('criar grupo');
  const si = S.sel.si, s = model.surfaces[si];
  S.groups.forEach(g => { if (g.si === si) S.sel.isl.forEach(i => g.isl.delete(i)); });
  const c = [0, 0, 0]; let n = 0;
  S.sel.isl.forEach(i => s.islVerts[i].forEach(v => { c[0] += s.pos[0][v * 3]; c[1] += s.pos[0][v * 3 + 1]; c[2] += s.pos[0][v * 3 + 2]; n++; }));
  const name = $('#groupName').value.trim() || `Peça ${S.groups.length + 1}`;
  S.groups.push({ name, si, isl: new Set(S.sel.isl), pivot: c.map(v => +(v / n).toFixed(2)), t: [0, 0, 0], r: [0, 0, 0], s: [1, 1, 1], hidden: false, keys: {} });
  S.gi = S.groups.length - 1; $('#groupName').value = '';
  updateAll(); toast(`Grupo "${name}" criado`, 'ok');
}
function deleteGroup(i) { snapshot('apagar grupo'); S.groups.splice(i, 1); if (S.gi >= S.groups.length) S.gi = S.groups.length - 1; updateAll(); }

// ---------------------------------------------------------------- quadros
function setFrameCount(n, silent) {
  n = clamp(n | 0, 1, 256);
  const old = model.nf; if (n === old) return;
  model.surfaces.forEach(s => {
    while (s.pos.length < n) { s.pos.push(new Float32Array(s.pos[old - 1])); s.nrm.push(new Float32Array(s.nrm[old - 1])); s.nraw.push(new Uint16Array(s.nraw[old - 1])); }
    s.pos.length = n; s.nrm.length = n; s.nraw.length = n;
  });
  while (model.frames.length < n) model.frames.push({ ...model.frames[old - 1], name: 'frame' + model.frames.length });
  model.frames.length = n;
  while (model.tags.length < n) model.tags.push(JSON.parse(JSON.stringify(model.tags[old - 1])));
  model.tags.length = n;
  model.nf = n;
  S.groups.forEach(g => Object.keys(g.keys).forEach(k => { if (+k >= n) delete g.keys[k]; }));
  S.frame = Math.min(S.frame, n - 1);
  if (!silent) { updateAll(); toast(`Modelo agora tem ${n} quadros`); }
}
function anims() { return parseCfg(S.cfg).anims; }
function playRange() {
  const a = anims()[S.animIdx];
  if (!a) return [0, model.nf - 1];
  return [clamp(a.start, 0, model.nf - 1), clamp(a.start + a.count - 1, 0, model.nf - 1)];
}
function setFrame(f) { S.frame = clamp(f, 0, model.nf - 1); updateGeometry(); updateTimeline(); updateAnimUI(); }

// ---------------------------------------------------------------- exportação
function finalModel() {
  const surfaces = model.surfaces.map((s, si) => {
    const pos = [], nrm = [], movedAny = new Uint8Array(s.nv);
    for (let f = 0; f < model.nf; f++) { const r = computeSurface(si, f); pos.push(r.P); nrm.push(r.N); r.moved.forEach((m, i) => { if (m) movedAny[i] = 1; }); }
    return { tris: visibleTris(si), pos, nrm, nraw: s.nraw, moved: movedAny };
  });
  const tags = model.tags.map(row => row.map(t => ({ origin: t.origin.map((v, k) => v + S.tagOffset[k]), axis: t.axis })));
  return { surfaces, tags };
}
function exportMD3() { return buildMD3(model, finalModel()); }
function skinBlob(si, type = 'image/jpeg') {
  return new Promise(r => skins[si].result.toBlob(r, type, 0.93));
}
function credits() {
  return `Arma modificada com CUBE MAKER v${VERSION} (cubemaker.kayquedeleon.app)\n\n` +
    `Modelo e textura originais: makkE (Markus Bekel) — AssaultCube\n` +
    `Licença: Creative Commons Attribution-NonCommercial-ShareAlike 2.5\n` +
    `http://creativecommons.org/licenses/by-nc-sa/2.5/\n\n` +
    `Este trabalho derivado é distribuído sob a mesma licença (BY-NC-SA).\n`;
}
const weaponDir = () => (S.weapon || 'arma').replace(/[^\w.-]/g, '_');
function skinPath(si) {
  const name = S.skinFiles[si], dir = `packages/models/weapons/${weaponDir()}/`;
  return name.startsWith('../') ? 'packages/models/weapons/' + name.slice(3) : dir + name;
}
// arquivos que a arma modificada ocupa no jogo
async function packageFiles() {
  const dir = `packages/models/weapons/${weaponDir()}/`;
  const out = [{ path: dir + 'tris_high.md3', data: new Blob([exportMD3()]) }, { path: dir + 'md3.cfg', data: new Blob([S.cfg]) }];
  for (let si = 0; si < skins.length; si++) {
    if (S.skinFiles[si].startsWith('../') && !S.modifiedSkins.has(si)) continue;   // não mexe em skins compartilhadas sem mudança
    out.push({ path: skinPath(si), data: await skinBlob(si, /\.png$/i.test(S.skinFiles[si]) ? 'image/png' : 'image/jpeg') });
  }
  out.push({ path: dir + 'CREDITOS_LICENCA.txt', data: new Blob([credits()]) });
  return out;
}
// cópia fiel dos arquivos originais carregados
function originalFiles() {
  const dir = `packages/models/weapons/${weaponDir()}/`;
  const out = [{ path: dir + 'tris_high.md3', data: new Blob([S.originalMD3]) }];
  if (S.originalCfg) out.push({ path: dir + 'md3.cfg', data: new Blob([S.originalCfg]) });
  skins.forEach((_, si) => { if (S.skinSources[si]) out.push({ path: skinPath(si), data: S.skinSources[si] }); });
  return out;
}
async function exportZip() {
  if (!model) return;
  const zip = new JSZip(), w = weaponDir();
  for (const f of await packageFiles()) zip.file(f.path, f.data);
  zip.file('LEIA-ME_CUBEMAKER.txt',
    `Como instalar:\n1) Extraia este zip dentro da pasta home do AssaultCube:\n   Documentos\\My Games\\AssaultCube\\v1.3\\\n` +
    `   (ou direto na pasta de instalação, fazendo backup antes)\n2) Abra o jogo — a arma "${w}" será substituída.\n\n${credits()}`);
  const blob = await zip.generateAsync({ type: 'blob' });
  download(`cubemaker_${w}.zip`, blob); toast('Pacote .zip exportado', 'ok');
}


// ---------------------------------------------------------------- instalação direta no jogo (com backup)
const KV = {
  db: null,
  open() { return this.db || (this.db = new Promise((res, rej) => { const r = indexedDB.open('cubemaker', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); })); },
  async get(k) { const db = await this.open(); return new Promise(res => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }); },
  async set(k, v) { const db = await this.open(); return new Promise(res => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = res; t.onerror = res; }); }
};
let gameDir = null, gameDirKind = '';
const BACKUP = 'cubemaker_backup';
async function initGameDir() {
  try { gameDir = await KV.get('gameDir'); if (gameDir) gameDirKind = await detectKind(gameDir); } catch (e) { gameDir = null; }
  updateGameUI();
}
async function detectKind(h) {
  const names = new Set();
  try { for await (const [n] of h.entries()) names.add(n.toLowerCase()); } catch (e) { return ''; }
  if (names.has('bin_win32') || names.has('assaultcube.bat') || names.has('bin_unix')) return 'instalação';
  if (names.has('config') || names.has('packages') || names.has('screenshots') || names.has('demos') || names.has('savedgames')) return 'home';
  return '?';
}
async function connectGameDir() {
  if (!window.showDirectoryPicker) { toast('Este navegador não grava em pastas. Use Chrome ou Edge no computador.', 'err'); return false; }
  try {
    const h = await window.showDirectoryPicker({ id: 'ac-home', mode: 'readwrite', startIn: 'documents' });
    const kind = await detectKind(h);
    gameDir = h; gameDirKind = kind; await KV.set('gameDir', h); updateGameUI();
    if (kind === '?') toast(`Pasta "${h.name}" conectada, mas não parece ser do AssaultCube. Confira: Documentos\\My Games\\AssaultCube\\v1.3`, 'warn');
    else toast(`Pasta do jogo conectada (${kind}): ${h.name}`, 'ok');
    return true;
  } catch (e) {
    if (e.name === 'AbortError') return false;
    toast(e.name === 'SecurityError' ? 'O navegador bloqueou o acesso a pastas aqui. Abra o CUBE MAKER direto em cubemaker.kayquedeleon.app.' : 'Não foi possível acessar a pasta: ' + e.message, 'err');
    return false;
  }
}
async function ensurePerm() {
  if (!gameDir && !(await connectGameDir())) return false;
  try {
    let p = await gameDir.queryPermission({ mode: 'readwrite' });
    if (p !== 'granted') p = await gameDir.requestPermission({ mode: 'readwrite' });
    return p === 'granted';
  } catch (e) { return connectGameDir(); }
}
async function dirAt(path, create) { let d = gameDir; for (const part of path.split('/').filter(Boolean)) d = await d.getDirectoryHandle(part, { create }); return d; }
const splitPath = p => { const a = p.split('/'); const n = a.pop(); return [a.join('/'), n]; };
async function readAt(path) { try { const [d, n] = splitPath(path); return await (await (await dirAt(d, false)).getFileHandle(n)).getFile(); } catch (e) { return null; } }
async function writeAt(path, data) {
  const [d, n] = splitPath(path);
  const fh = await (await dirAt(d, true)).getFileHandle(n, { create: true });
  const w = await fh.createWritable(); await w.write(data); await w.close();
}
async function removeAt(path) { try { const [d, n] = splitPath(path); await (await dirAt(d, false)).removeEntry(n); return true; } catch (e) { return false; } }
function stampNow() { const d = new Date(), z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}_${z(d.getHours())}-${z(d.getMinutes())}-${z(d.getSeconds())}`; }
async function appendLog(entry) {
  let hist = [];
  try { const f = await readAt(`${BACKUP}/historico.json`); if (f) hist = JSON.parse(await f.text()); } catch (e) { }
  hist.push(entry); await writeAt(`${BACKUP}/historico.json`, new Blob([JSON.stringify(hist, null, 2)]));
}
// guarda os originais (uma única vez por arquivo) e o que estiver no lugar antes de mexer
async function backupBefore(paths, stamp, log) {
  for (const o of originalFiles()) {
    const bp = `${BACKUP}/originais/${o.path}`;
    if (!(await readAt(bp))) { await writeAt(bp, o.data); log.originais.push(o.path); }
  }
  for (const p of paths) {
    const ex = await readAt(p);
    if (ex) { await writeAt(`${BACKUP}/${stamp}/${p}`, ex); log.backup.push(p); }
  }
}
async function installToGame() {
  if (!model) return toast('Abra uma arma primeiro', 'warn');
  if (!(await ensurePerm())) return toast('Sem permissão para gravar na pasta do jogo', 'err');
  const btn = $('#btnInstall'); btn.disabled = true; btn.textContent = 'Instalando…';
  try {
    const files = await packageFiles(), stamp = stampNow();
    const log = { acao: 'instalar', quando: new Date().toISOString(), arma: weaponDir(), pasta: gameDir.name, originais: [], backup: [], gravados: [] };
    await backupBefore(files.map(f => f.path), stamp, log);
    for (const f of files) { await writeAt(f.path, f.data); log.gravados.push(f.path); }
    if (log.backup.length) log.pastaBackup = `${BACKUP}/${stamp}`;
    await appendLog(log);
    $('#gameLast').textContent = `Última instalação: ${weaponDir()} · ${stamp.replace('_', ' ')}`;
    toast(`✔ ${weaponDir()} instalada (${files.length} arquivos). Backup em ${BACKUP}. Reinicie o mapa no jogo.`, 'ok');
  } catch (e) {
    toast('Falha ao instalar: ' + e.message + (gameDirKind === 'instalação' ? ' — a pasta de instalação pode exigir administrador; use Documentos\\My Games\\AssaultCube\\v1.3' : ''), 'err');
  } finally { btn.disabled = false; btn.textContent = 'Instalar no jogo'; }
}
async function restoreOriginal() {
  if (!model) return toast('Abra a arma que quer restaurar', 'warn');
  if (!(await ensurePerm())) return;
  const w = weaponDir();
  const ok = await confirmBox(`Restaurar a arma "${w}" ao original? A versão instalada vai para o backup antes.`);
  if (!ok) return;
  try {
    const paths = (await packageFiles()).map(f => f.path), stamp = stampNow();
    const log = { acao: 'restaurar', quando: new Date().toISOString(), arma: w, pasta: gameDir.name, originais: [], backup: [], restaurados: [], removidos: [] };
    await backupBefore(paths, stamp, log);
    for (const p of paths) {
      const orig = await readAt(`${BACKUP}/originais/${p}`);
      if (gameDirKind === 'instalação' && orig) { await writeAt(p, orig); log.restaurados.push(p); }
      else if (await removeAt(p)) log.removidos.push(p);        // pasta home: remover faz o jogo voltar ao original
    }
    await appendLog(log);
    toast(`Arma "${w}" restaurada ao original. Cópia da versão modificada em ${BACKUP}/${stamp}`, 'ok');
  } catch (e) { toast('Falha ao restaurar: ' + e.message, 'err'); }
}
function confirmBox(msg) {
  return new Promise(res => {
    const box = $('#confirm'); box.querySelector('p').textContent = msg; box.classList.add('show');
    const done = v => { box.classList.remove('show'); res(v); };
    box.querySelector('.yes').onclick = () => done(true); box.querySelector('.no').onclick = () => done(false);
  });
}
function updateGameUI() {
  const st = $('#gameStatus');
  if (!window.showDirectoryPicker) { st.innerHTML = '<span class="bad">Use Chrome ou Edge para instalar direto no jogo.</span>'; return; }
  st.innerHTML = gameDir ? `<span class="good">●</span> ${gameDir.name} <small>(${gameDirKind || 'pasta'})</small>` : '<span class="bad">●</span> Nenhuma pasta conectada';
  $('#btnGameDir').textContent = gameDir ? 'Trocar pasta' : 'Conectar pasta do jogo';
}

// ---------------------------------------------------------------- projeto
async function saveProject() {
  if (!model) return;
  const proj = {
    app: 'CUBE MAKER', version: VERSION, weapon: S.weapon, cfg: S.cfg, nf: model.nf,
    md3: bufToB64(S.originalMD3),
    skins: skins.map((sk, i) => ({ file: S.skinFiles[i], orig: sk.orig.toDataURL('image/png'), overlay: sk.overlay.toDataURL('image/png') })),
    islandMat: S.islandMat.map(m => [...m]), groups: S.groups.map(g => ({ ...g, isl: [...g.isl] })),
    global: S.global, tagOffset: S.tagOffset, modified: [...S.modifiedSkins]
  };
  download(`${S.weapon}.cubemaker`, new Blob([JSON.stringify(proj)], { type: 'application/json' }));
  toast('Projeto salvo', 'ok');
}
async function openProject(text) {
  const p = JSON.parse(text);
  if (p.app !== 'CUBE MAKER') throw new Error('Arquivo não é um projeto CUBE MAKER');
  const imgs = await Promise.all(p.skins.map(s => loadImage(s.orig)));
  const overlays = await Promise.all(p.skins.map(s => loadImage(s.overlay)));
  await loadWeapon({ md3Buf: b64ToBuf(p.md3), cfgText: p.cfg, skinImages: imgs, weaponName: p.weapon, project: { ...p, overlays } });
}
function applyProject(p) {
  if (p.nf && p.nf !== model.nf) setFrameCount(p.nf, true);
  S.islandMat = p.islandMat.map(a => new Map(a));
  S.groups = p.groups.map(g => ({ ...g, isl: new Set(g.isl), s: Array.isArray(g.s) ? g.s : [g.s, g.s, g.s] }));
  S.gi = S.groups.length ? 0 : -1;
  S.global = { ...S.global, ...p.global }; S.tagOffset = p.tagOffset || [0, 0, 0];
  S.modifiedSkins = new Set(p.modified || []);
  p.skins.forEach((s, i) => { if (s.file) S.skinFiles[i] = s.file; });
  skins.forEach((sk, i) => { if (p.overlays[i]) sk.overlay.getContext('2d').drawImage(p.overlays[i], 0, 0); composite(i); });
}

// ---------------------------------------------------------------- abrir arquivos
async function openFiles(fileList) {
  const files = [...fileList];
  const proj = files.find(f => /\.cubemaker$/i.test(f.name));
  if (proj) return openProject(await proj.text());
  const md3 = files.find(f => /\.md3$/i.test(f.name) && /tris_high/i.test(f.name)) || files.find(f => /\.md3$/i.test(f.name));
  if (!md3) {
    if (model && files.some(f => /\.(jpe?g|png)$/i.test(f.name))) return replaceSkin(files.find(f => /\.(jpe?g|png)$/i.test(f.name)));
    if (files.some(f => /\.md2$/i.test(f.name))) throw new Error('MD2 (modelo de mundo) ainda não é suportado nesta versão — abra o tris_high.md3 da arma');
    throw new Error('Nenhum .md3 encontrado. Selecione a pasta da arma ou o tris_high.md3');
  }
  const rel = md3.webkitRelativePath || '';
  const dirParts = rel.split('/'); const weaponName = dirParts.length > 1 ? dirParts[dirParts.length - 2] : (S.weapon || 'arma');
  const cfgF = files.find(f => baseName(f.name) === 'md3.cfg');
  const cfgText = cfgF ? await cfgF.text() : null;
  const m = parseMD3(await md3.arrayBuffer());
  const cfg = parseCfg(cfgText || '');
  const byName = new Map(files.map(f => [baseName(f.name), f]));
  const imgs = [], srcs = [];
  for (const s of m.surfaces) {
    const want = cfg.skins[s.name] ? baseName(cfg.skins[s.name]) : null;
    let f = want && byName.get(want);
    if (!f) f = files.find(f => /\.(jpe?g|png)$/i.test(f.name) && baseName(f.name).includes(s.name));
    if (!f && s.name === 'hands' && DEMO_HANDS) { imgs.push(await loadImage(DEMO_HANDS)); srcs.push(dataURLtoBlob(DEMO_HANDS)); continue; }
    if (!f && s.name === 'weapon') f = files.find(f => /^skin.*\.(jpe?g|png)$/i.test(baseName(f.name)) && !/hands/i.test(f.name));
    imgs.push(f ? await loadImage(await fileToDataURL(f)) : null); srcs.push(f || null);
  }
  await loadWeapon({ md3Buf: await md3.arrayBuffer(), cfgText, skinImages: imgs, weaponName, skinSources: srcs });
}
async function replaceSkin(file) {
  const img = await loadImage(await fileToDataURL(file));
  const si = S.editSkin; snapshot('trocar skin');
  skins[si].texture.dispose();
  skins[si] = makeSkin(si, img);
  meshes[si].material.map = skins[si].texture; meshes[si].material.needsUpdate = true;
  S.modifiedSkins.add(si); composite(si); toast('Skin substituída: ' + file.name, 'ok');
}
let DEMO_HANDS = null;
async function loadDemo() {
  const D = window.CM_DEMO; if (!D) return toast('Demo não incluída nesta build', 'warn');
  DEMO_HANDS = D.skinHands;
  const imgW = await loadImage(D.skinWeapon), imgH = await loadImage(D.skinHands);
  const m = parseMD3(b64ToBuf(D.md3));
  const imgs = m.surfaces.map(s => s.name === 'hands' ? imgH : imgW);
  const srcs = m.surfaces.map(s => dataURLtoBlob(s.name === 'hands' ? D.skinHands : D.skinWeapon));
  await loadWeapon({ md3Buf: b64ToBuf(D.md3), cfgText: D.cfg, skinImages: imgs, weaponName: 'subgun', skinSources: srcs });
}

// ---------------------------------------------------------------- presets WWII
const PRESETS = {
  mp40: { name: 'MP40 (aço oxidado + baquelite)', base: 'acoOxidado', global: { wear: 0.4, age: 0.2, dirt: 0.3 } },
  thompson: { name: 'Thompson (parkerizado + nogueira)', base: 'parkCinza', global: { wear: 0.35, age: 0.25, dirt: 0.25 } },
  kar98: { name: 'Kar98k (aço oxidado + faia)', base: 'acoOxidado', global: { wear: 0.45, age: 0.3, dirt: 0.3 } },
  garand: { name: 'M1 Garand (parkerizado verde)', base: 'parkVerde', global: { wear: 0.3, age: 0.2, dirt: 0.25 } },
};
function applyPreset(key) {
  if (!model) return;
  const p = PRESETS[key]; const si = model.surfaces.findIndex(s => s.name === 'weapon'); if (si < 0) return;
  snapshot('preset ' + key);
  const s = model.surfaces[si];
  for (let i = 0; i < s.nIsl; i++) if (!S.islandMat[si].has(i)) S.islandMat[si].set(i, p.base);
  Object.assign(S.global, p.global);
  S.modifiedSkins.add(si); skins.forEach((_, i) => composite(i)); updateGlobalUI();
  toast(`Preset ${p.name}: base aplicada. Agora use a ferramenta Material para a madeira/baquelite.`, 'ok');
}
function boltPreset() {
  const g = S.groups[S.gi]; if (!g) return toast('Crie/selecione um grupo (ex.: ferrolho)', 'warn');
  const a = anims().find(a => /shoot/i.test(a.name)) || { start: 0, count: model.nf };
  const dist = +$('#boltDist').value || 3, axis = $('#boltAxis').value;
  const ax = { '-y': [0, -1, 0], '+y': [0, 1, 0], '-x': [-1, 0, 0], '+x': [1, 0, 0] }[axis];
  const end = clamp(a.start + a.count - 1, 0, model.nf - 1), mid = clamp(a.start + Math.max(1, Math.round(a.count * 0.3)), 0, end);
  snapshot('animação ferrolho');
  g.keys = {};
  g.keys[a.start] = { t: [0, 0, 0], r: [0, 0, 0] };
  g.keys[mid] = { t: ax.map(v => v * dist), r: [0, 0, 0] };
  g.keys[end] = { t: [0, 0, 0], r: [0, 0, 0] };
  updateAll(); toast(`Ferrolho animado nos quadros ${a.start}–${end}`, 'ok');
}
function triggerPreset() {
  const g = S.groups[S.gi]; if (!g) return toast('Crie/selecione um grupo (ex.: gatilho)', 'warn');
  const a = anims().find(a => /shoot/i.test(a.name)) || { start: 0, count: model.nf };
  const end = clamp(a.start + a.count - 1, 0, model.nf - 1);
  snapshot('animação gatilho'); g.keys = {};
  g.keys[a.start] = { t: [0, 0, 0], r: [0, 0, 0] };
  g.keys[clamp(a.start + 1, 0, end)] = { t: [0, 0, 0], r: [-12, 0, 0] };
  g.keys[end] = { t: [0, 0, 0], r: [0, 0, 0] };
  updateAll(); toast('Gatilho animado', 'ok');
}

// ---------------------------------------------------------------- UI
function slider(container, label, min, max, step, get, set, opts = {}) {
  const row = document.createElement('div'); row.className = 'srow';
  row.innerHTML = `<label>${label}</label><input type="range" min="${min}" max="${max}" step="${step}"><input type="number" min="${min}" max="${max}" step="${step}">`;
  const [r, n] = row.querySelectorAll('input');
  const sync = () => { const v = get(); r.value = v; n.value = +(+v).toFixed(3); };
  let snapped = false;
  const apply = (v, final) => {
    if (!snapped && opts.undo) { snapshot(opts.undo); snapped = true; }
    set(+v); n.value = +(+v).toFixed(3); r.value = v; if (final) snapped = false;
  };
  r.addEventListener('input', () => apply(r.value)); r.addEventListener('change', () => { snapped = false; });
  n.addEventListener('change', () => apply(n.value, true));
  r.addEventListener('dblclick', () => apply(opts.reset ?? 0, true));
  row.sync = sync; sync(); container.appendChild(row); return row;
}
const syncers = [];
function buildStaticUI() {
  // materiais
  const grid = $('#mats');
  MAT_ORDER.forEach(k => {
    const m = MATS[k], b = document.createElement('button'); b.className = 'mat'; b.dataset.mat = k;
    b.innerHTML = `<i style="background:linear-gradient(135deg,rgb(${m.c.map(v => Math.min(255, v * 1.35) | 0)}),rgb(${m.c.map(v => v * 0.7 | 0)}))"></i><span>${m.n}</span>`;
    b.onclick = () => { S.mat = k; $$('.mat').forEach(x => x.classList.toggle('on', x === b)); if (S.tool !== 'material') setTool('material'); };
    grid.appendChild(b);
  });
  $(`.mat[data-mat="${S.mat}"]`).classList.add('on');
  // ajustes globais
  const gl = $('#globalBox');
  [['Desgaste nas bordas', 'wear', 0, 1, 0.01, 0.35], ['Envelhecimento', 'age', 0, 1, 0.01, 0.25], ['Sujeira', 'dirt', 0, 1, 0.01, 0.25], ['Brilho', 'bright', -0.4, 0.4, 0.01, 0], ['Contraste', 'contrast', 0.5, 1.8, 0.01, 1]]
    .forEach(([l, k, a, b, st, rs]) => syncers.push(slider(gl, l, a, b, st, () => S.global[k], v => { S.global[k] = v; queueComposite(); }, { undo: 'ajuste ' + l, reset: rs })));
  // pincel
  const bb = $('#brushSliders');
  slider(bb, 'Tamanho', 2, 120, 1, () => S.brush.size, v => S.brush.size = v, { reset: 18 });
  slider(bb, 'Opacidade', 0.05, 1, 0.01, () => S.brush.opacity, v => S.brush.opacity = v, { reset: 0.6 });
  slider(bb, 'Dureza', 0, 0.95, 0.01, () => S.brush.hard, v => S.brush.hard = v, { reset: 0.4 });
  $('#brushColor').oninput = e => S.brush.color = e.target.value;
  $$('.swatch').forEach(s => s.onclick = () => { S.brush.color = s.dataset.c; $('#brushColor').value = s.dataset.c; });
  // malha
  const mb = $('#meshSliders'); const G = () => S.groups[S.gi];
  const gv = (k, i, d = 0) => () => G() ? G()[k][i] : d, gs = (k, i) => v => { if (!G()) return; G()[k][i] = v; updateGeometry(); };
  ['X', 'Y', 'Z'].forEach((a, i) => syncers.push(slider(mb, 'Mover ' + a, -30, 30, 0.05, gv('t', i), gs('t', i), { undo: 'mover' })));
  ['X', 'Y', 'Z'].forEach((a, i) => syncers.push(slider(mb, 'Girar ' + a, -180, 180, 0.5, gv('r', i), gs('r', i), { undo: 'girar' })));
  ['X', 'Y', 'Z'].forEach((a, i) => syncers.push(slider(mb, 'Escala ' + a, 0.1, 3, 0.01, gv('s', i, 1), gs('s', i), { undo: 'escala', reset: 1 })));
  const pb = $('#pivotSliders');
  ['X', 'Y', 'Z'].forEach((a, i) => syncers.push(slider(pb, 'Pivô ' + a, -60, 60, 0.1, gv('pivot', i), gs('pivot', i), { undo: 'pivô' })));
  const tb = $('#tagSliders');
  ['X', 'Y', 'Z'].forEach((a, i) => syncers.push(slider(tb, 'Muzzle ' + a, -30, 30, 0.1, () => S.tagOffset[i], v => { S.tagOffset[i] = v; updateGeometry(); }, { undo: 'muzzle' })));
  // animação
  const ab = $('#keySliders');
  const kGet = (k, i) => () => { const g = G(); if (!g) return 0; const v = interpKey(g, S.frame); return v ? v[k][i] : 0; };
  const kSet = (k, i) => v => {
    const g = G(); if (!g) return;
    const cur = interpKey(g, S.frame) || { t: [0, 0, 0], r: [0, 0, 0] };
    const key = g.keys[S.frame] || { t: [...cur.t], r: [...cur.r] };
    key[k][i] = v; g.keys[S.frame] = key; updateGeometry(); updateTimeline();
  };
  ['X', 'Y', 'Z'].forEach((a, i) => syncers.push(slider(ab, 'Desloc. ' + a, -20, 20, 0.05, kGet('t', i), kSet('t', i), { undo: 'chave' })));
  ['X', 'Y', 'Z'].forEach((a, i) => syncers.push(slider(ab, 'Rotação ' + a, -180, 180, 0.5, kGet('r', i), kSet('r', i), { undo: 'chave' })));
}
function updateGlobalUI() { syncers.forEach(s => s.sync()); }

function updateSelectionUI() {
  const n = S.sel.isl.size;
  $('#selInfo').textContent = n ? `${n} ilha(s) em "${model.surfaces[S.sel.si].name}"` : 'Nada selecionado — clique no modelo';
  $('#btnGroup').disabled = !n;
}
function updateGroupsUI() {
  const ul = $('#groups'); ul.innerHTML = '';
  if (!S.groups.length) ul.innerHTML = '<li class="muted">Nenhum grupo. Selecione peças e clique em "Criar grupo".</li>';
  S.groups.forEach((g, i) => {
    const li = document.createElement('li'); li.className = i === S.gi ? 'on' : '';
    const nk = Object.keys(g.keys).length;
    li.innerHTML = `<input value="${g.name.replace(/"/g, '&quot;')}"><small>${model.surfaces[g.si].name} · ${g.isl.size} ilhas${nk ? ' · ' + nk + ' chaves' : ''}</small><button title="Mostrar/ocultar peça na exportação" class="ic">${g.hidden ? '◌' : '●'}</button><button title="Apagar grupo" class="ic">✕</button>`;
    const [inp, eye, del] = [li.querySelector('input'), ...li.querySelectorAll('button')];
    li.onclick = e => { if (e.target === inp || e.target.tagName === 'BUTTON') return; S.gi = i; updateAll(); };
    inp.onfocus = () => { if (S.gi !== i) { S.gi = i; updateGeometry(); updateMeshUI(); updateTimeline(); updateAnimUI(); $$('#groups li').forEach((x, j) => x.classList.toggle('on', j === i)); } };
    inp.onchange = () => { g.name = inp.value; };
    eye.onclick = () => { snapshot('ocultar'); g.hidden = !g.hidden; updateAll(); };
    del.onclick = () => deleteGroup(i);
    ul.appendChild(li);
  });
}
function updateMeshUI() {
  const g = S.groups[S.gi];
  $('#meshGroup').textContent = g ? `Grupo: ${g.name}` : 'Selecione ou crie um grupo';
  $('#meshSliders').classList.toggle('disabled', !g); $('#pivotSliders').classList.toggle('disabled', !g);
  $('#keySliders').classList.toggle('disabled', !g);
  syncers.forEach(s => s.sync());
}
function updateAnimUI() {
  const g = S.groups[S.gi];
  $('#animGroup').textContent = g ? `Grupo: ${g.name} · quadro ${S.frame}${g.keys[S.frame] ? ' (chave)' : ''}` : 'Selecione um grupo para animar';
  $('#frameCount').value = model ? model.nf : 16;
  syncers.forEach(s => s.sync());
}
function updateTimeline() {
  if (!model) return;
  const tl = $('#frames'); const g = S.groups[S.gi]; const [a, b] = playRange();
  if (tl.children.length !== model.nf) { tl.innerHTML = ''; for (let f = 0; f < model.nf; f++) { const d = document.createElement('button'); d.textContent = f; d.onclick = () => { S.playing = false; updatePlayBtn(); setFrame(f); }; tl.appendChild(d); } }
  [...tl.children].forEach((d, f) => { d.className = (f === S.frame ? 'cur ' : '') + (g && g.keys[f] ? 'key ' : '') + (f >= a && f <= b && S.animIdx >= 0 ? 'rng' : ''); });
  const sel = $('#animSel'), list = anims(), want = ['<option value="-1">Todos os quadros</option>', ...list.map((x, i) => `<option value="${i}">${x.name} (${x.start}–${x.start + x.count - 1})</option>`)].join('');
  if (sel.dataset.h !== want) { sel.innerHTML = want; sel.dataset.h = want; }
  sel.value = S.animIdx;
}
function updatePlayBtn() { $('#play').textContent = S.playing ? '❚❚' : '▶'; }
function updateSurfacesUI() {
  const ul = $('#surfs'); ul.innerHTML = '';
  model.surfaces.forEach((s, i) => {
    const li = document.createElement('li'); li.className = i === S.editSkin ? 'on' : '';
    li.innerHTML = `<span>${s.name}</span><small>${s.nv} vért · ${s.ntri} tri · ${S.skinFiles[i]}</small><button class="ic" title="Mostrar/ocultar na visualização">${s.hiddenView ? '◌' : '●'}</button>`;
    li.onclick = e => { if (e.target.tagName === 'BUTTON') { s.hiddenView = !s.hiddenView; updateGeometry(); updateSurfacesUI(); return; } S.editSkin = i; updateSurfacesUI(); draw2D(); };
    ul.appendChild(li);
  });
}
function updateAll() {
  if (!model) return;
  updateGeometry(); updateSelectionUI(); updateGroupsUI(); updateMeshUI(); updateAnimUI(); updateTimeline(); updateSurfacesUI(); updateGlobalUI(); draw2D();
  $('#stats').textContent = `${model.surfaces.reduce((a, s) => a + s.ntri, 0)} tri · ${model.nf} quadros · ${S.groups.length} grupos`;
}

function bindUI() {
  $$('[data-tool]').forEach(b => b.onclick = () => setTool(b.dataset.tool));
  $$('.tabs button').forEach(b => b.onclick = () => {
    $$('.tabs button').forEach(x => x.classList.toggle('on', x === b));
    $$('.tab').forEach(t => t.classList.toggle('on', t.id === b.dataset.tab));
    if (b.dataset.tab === 'tabSkin') draw2D();
  });
  $$('[data-cam]').forEach(b => b.onclick = () => frameCamera(b.dataset.cam));
  $('#openDir').onchange = e => openFiles(e.target.files).catch(err => toast(err.message, 'err'));
  $('#openFiles').onchange = e => openFiles(e.target.files).catch(err => toast(err.message, 'err'));
  $('#btnDemo').onclick = () => loadDemo().catch(err => toast(err.message, 'err'));
  $('#btnDemo2').onclick = () => loadDemo().catch(err => toast(err.message, 'err'));
  $('#weaponName').onchange = e => { S.weapon = e.target.value.trim() || 'arma'; };
  $('#btnZip').onclick = () => exportZip().catch(err => toast(err.message, 'err'));
  $('#btnInstall').onclick = () => installToGame().catch(err => toast(err.message, 'err'));
  $('#btnInstall2').onclick = () => installToGame().catch(err => toast(err.message, 'err'));
  $('#btnGameDir').onclick = () => connectGameDir();
  $('#btnRestore').onclick = () => restoreOriginal().catch(err => toast(err.message, 'err'));
  $('#btnMD3').onclick = () => model && download('tris_high.md3', new Blob([exportMD3()]));
  $('#btnSkin').onclick = async () => model && download(baseName(S.skinFiles[S.editSkin]), await skinBlob(S.editSkin, /\.png$/i.test(S.skinFiles[S.editSkin]) ? 'image/png' : 'image/jpeg'));
  $('#btnCfg').onclick = () => model && download('md3.cfg', new Blob([S.cfg]));
  $('#btnSave').onclick = () => saveProject();
  $('#btnShot').onclick = () => { renderer.render(scene, camera); canvas.toBlob(b => download(`${S.weapon}_preview.png`, b)); };
  $('#btnGroup').onclick = createGroup;
  $('#btnClearSel').onclick = () => { S.sel = { si: -1, isl: new Set() }; updateSelectionUI(); updateColors(); draw2D(); };
  $('#btnSelPiece').onclick = () => { if (!S.sel.isl.size) return; const s = model.surfaces[S.sel.si]; const ps = new Set([...S.sel.isl].map(i => s.piece[i])); for (let i = 0; i < s.nIsl; i++) if (ps.has(s.piece[i])) S.sel.isl.add(i); updateSelectionUI(); updateColors(); draw2D(); };
  $('#btnSelGroup').onclick = () => { const g = S.groups[S.gi]; if (!g) return; S.sel = { si: g.si, isl: new Set(g.isl) }; updateSelectionUI(); updateColors(); draw2D(); };
  $('#btnAddToGroup').onclick = () => { const g = S.groups[S.gi]; if (!g || S.sel.si !== g.si) return toast('Seleção e grupo precisam estar na mesma parte', 'warn'); snapshot('adicionar ao grupo'); S.groups.forEach(o => { if (o !== g && o.si === g.si) S.sel.isl.forEach(i => o.isl.delete(i)); }); S.sel.isl.forEach(i => g.isl.add(i)); updateAll(); };
  $('#btnApplySel').onclick = () => { if (!S.sel.isl.size) return toast('Selecione peças primeiro', 'warn'); assignMaterial(S.sel.si, [...S.sel.isl], S.mat); };
  $('#btnClearMatSel').onclick = () => { if (!S.sel.isl.size) return toast('Selecione peças primeiro', 'warn'); assignMaterial(S.sel.si, [...S.sel.isl], null); };
  $('#btnClearPaint').onclick = () => { if (!model) return; snapshot('limpar pintura'); const sk = skins[S.editSkin]; sk.overlay.getContext('2d').clearRect(0, 0, sk.w, sk.h); refreshResult(S.editSkin); };
  $('#btnResetSkin').onclick = () => { if (!model) return; snapshot('resetar skin'); S.islandMat[S.editSkin].clear(); const sk = skins[S.editSkin]; sk.overlay.getContext('2d').clearRect(0, 0, sk.w, sk.h); composite(S.editSkin); };
  $('#skinFile').onchange = e => e.target.files[0] && replaceSkin(e.target.files[0]).catch(err => toast(err.message, 'err'));
  $('#wireToggle').onchange = e => { S.showWire = e.target.checked; draw2D(); };
  $('#tagToggle').onchange = e => { S.showTag = e.target.checked; updateGeometry(); };
  $('#wire3d').onchange = e => meshes.forEach(m => { m.material.wireframe = e.target.checked; });
  $$('[data-preset]').forEach(b => b.onclick = () => applyPreset(b.dataset.preset));
  $('#btnBolt').onclick = boltPreset;
  $('#btnTrigger').onclick = triggerPreset;
  $('#btnDelKey').onclick = () => { const g = S.groups[S.gi]; if (!g || !g.keys[S.frame]) return; snapshot('apagar chave'); delete g.keys[S.frame]; updateAll(); };
  $('#btnClearKeys').onclick = () => { const g = S.groups[S.gi]; if (!g) return; snapshot('limpar chaves'); g.keys = {}; updateAll(); };
  $('#btnFrames').onclick = () => { if (!model) return; snapshot('quadros'); setFrameCount(+$('#frameCount').value); };
  $('#btnResetGroup').onclick = () => { const g = S.groups[S.gi]; if (!g) return; snapshot('resetar grupo'); g.t = [0, 0, 0]; g.r = [0, 0, 0]; g.s = [1, 1, 1]; updateAll(); };
  $('#cfgText').oninput = e => { S.cfg = e.target.value; updateTimeline(); };
  $('#play').onclick = () => { if (!model) return; S.playing = !S.playing; updatePlayBtn(); };
  $('#animSel').onchange = e => { S.animIdx = +e.target.value; const [a] = playRange(); setFrame(a); };
  $('#fps').onchange = e => S.fps = clamp(+e.target.value || 12, 1, 60);
  $('#prevF').onclick = () => model && setFrame(S.frame > 0 ? S.frame - 1 : model.nf - 1);
  $('#nextF').onclick = () => model && setFrame((S.frame + 1) % model.nf);
  $('#btnUndo').onclick = undo; $('#btnRedo').onclick = redo;
  $('#btnHelp').onclick = () => $('#help').classList.toggle('show');
  $('#help').onclick = e => { if (e.target.id === 'help' || e.target.classList.contains('close')) $('#help').classList.remove('show'); };
  // atalhos
  window.addEventListener('keydown', e => {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redo(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 's') { e.preventDefault(); saveProject(); return; }
    if (k === 'v') setTool('nav'); else if (k === 'm') setTool('material'); else if (k === 'b') setTool('brush'); else if (k === 'e') setTool('eraser'); else if (k === 'i') setTool('picker');
    else if (k === 'g') createGroup(); else if (k === 'f') frameCamera('orbit'); else if (k === 'p') frameCamera('fps');
    else if (k === ' ') { e.preventDefault(); S.playing = !S.playing; updatePlayBtn(); }
    else if (k === 'arrowleft') $('#prevF').click(); else if (k === 'arrowright') $('#nextF').click();
    else if (k === '[') { S.brush.size = Math.max(2, S.brush.size - 3); updateGlobalUI(); $$('#brushSliders .srow').forEach(r => r.sync()); }
    else if (k === ']') { S.brush.size = Math.min(120, S.brush.size + 3); $$('#brushSliders .srow').forEach(r => r.sync()); }
    else if (k === 'escape') $('#btnClearSel').click();
  });
  // arrastar e soltar
  const vp = $('#viewport');
  vp.addEventListener('dragover', e => { e.preventDefault(); vp.classList.add('drop'); });
  vp.addEventListener('dragleave', () => vp.classList.remove('drop'));
  vp.addEventListener('drop', async e => {
    e.preventDefault(); vp.classList.remove('drop');
    const files = await collectDropped(e.dataTransfer);
    openFiles(files).catch(err => toast(err.message, 'err'));
  });
}
async function collectDropped(dt) {
  const out = [];
  const walk = (entry, path) => new Promise(res => {
    if (entry.isFile) entry.file(f => { try { Object.defineProperty(f, 'webkitRelativePath', { value: path + f.name }); } catch (e) { } out.push(f); res(); });
    else if (entry.isDirectory) { const r = entry.createReader(); const all = []; const rd = () => r.readEntries(async es => { if (!es.length) { for (const x of all) await walk(x, path + entry.name + '/'); res(); } else { all.push(...es); rd(); } }); rd(); }
    else res();
  });
  const items = [...(dt.items || [])].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
  if (items.length) { for (const it of items) await walk(it, ''); return out; }
  return [...dt.files];
}

// ---------------------------------------------------------------- loop
let last = performance.now(), acc = 0;
function loop(now) {
  const dt = (now - last) / 1000; last = now;
  if (model && S.playing) {
    acc += dt;
    if (acc >= 1 / S.fps) {
      acc = 0; const [a, b] = playRange();
      setFrame(S.frame >= b || S.frame < a ? a : S.frame + 1);
    }
  }
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

buildStaticUI(); bindUI(); setTool('nav'); resize(); initGameDir();
camera.position.set(40, 25, 40); controls.target.set(0, 0, -10);
requestAnimationFrame(loop);
window.CM = { S, get model() { return model; }, get skins() { return skins; }, loadDemo, exportMD3, createGroup, selectIsland, assignMaterial, applyPreset, boltPreset, setFrame, frameCamera, setTool, parseMD3, undo, captureState };
if (new URLSearchParams(location.search).has('demo') || location.hash === '#demo') loadDemo();
