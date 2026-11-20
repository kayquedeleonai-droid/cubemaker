// CUBE MAKER — editor de armas para AssaultCube
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import JSZip from 'jszip';
import { createGame } from './game.js';
import { ARSENAL, buildPreset, atlasCanvas, FORGE_FAMILIES, FORGE_OPTIONS, forgeDef } from './presets.js';
import { PROPS, PROP_CATS, propDef } from './props.js';
import { readExternal, importParts, guessMat } from './importer.js';
import { createScene } from './scene.js';
import { packTexts, slugify, fmtSize, BRAND, cfWhoami, cfConnect, cfPublishPost } from './publish.js';
import { buildGear, gearFrame, writePlayerMD2 } from './chargear.js';
import { soundPreset, renderShot, renderReload, toOgg, play, soundNames, SR } from './sfx.js';
import { parseMD3, parseMD2, buildMD3, buildMD2, computeIslands, parseCfg, encodeNormal } from './md3.js';
import { MATS, MAT_ORDER, fbm, TEX, CATS, registerImageTexture } from './materials.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const D2R = Math.PI / 180;
const VERSION = '0.2.0';

// ---------------------------------------------------------------- estado
let model = null;          // MD3 parseado
let skins = [];            // uma skin por superfície
let meshes = [];           // malhas three.js por superfície
const S = {
  weapon: 'subgun', cfg: '', frame: 0, playing: false, animIdx: -1, fps: 25,
  tool: 'nav', mat: 'nogueira', brush: { color: '#5a3a1e', size: 18, opacity: 0.6, hard: 0.4 },
  global: { wear: 0.35, age: 0.25, dirt: 0.25, bright: 0, contrast: 1, detail: 1 },
  islandMat: [],           // por superfície: Map(ilha -> chave do material)
  groups: [], gi: -1,      // grupos de peças
  sel: { si: -1, isl: new Set() },
  tagOffset: [0, 0, 0], editSkin: 0, showTag: true, showWire: true,
  root: { name: 'Arma inteira', pivot: [0, 0, 0], keys: {} }, animRoot: false, prims: [], gameFps: 25,
  fx: { cavity: 0.35, scratches: 0, rust: 0, dust: 0, burn: 0, blood: 0, seed: 3 },
  decals: [], di: -1, decalPending: false, step: 1, matCat: 'metal',
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
const hash2 = (x, y) => { let h = Math.imul(x | 0, 2246822519) ^ Math.imul(y | 0, 3266489917); h = Math.imul(h ^ (h >>> 15), 668265263); return ((h ^ (h >>> 13)) >>> 0) / 4294967295; };
const baseName = p => p.split(/[\\/]/).pop().toLowerCase();

// ---------------------------------------------------------------- 3D
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.35;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x18191d);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 9000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.12;
scene.add(new THREE.HemisphereLight(0xf2eee2, 0x3a382e, 1.6));
scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const sun = new THREE.DirectionalLight(0xfff4e2, 2.4); sun.position.set(30, 50, 40); scene.add(sun);
const rim = new THREE.DirectionalLight(0xdfe4ea, 0.9); rim.position.set(-40, 10, -30); scene.add(rim);
const fill = new THREE.DirectionalLight(0xfff8ee, 0.8); fill.position.set(0, -30, 30); scene.add(fill);
const grid = new THREE.GridHelper(120, 24, 0x45464f, 0x2a2b31); grid.position.y = -25; scene.add(grid);
const root = new THREE.Group(); root.rotation.x = -Math.PI / 2; scene.add(root); // MD3 é Z para cima
const tagMarker = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 12), new THREE.MeshBasicMaterial({ color: 0xe0607a, depthTest: false }));
tagMarker.renderOrder = 10; root.add(tagMarker);
const pivotMarker = new THREE.Mesh(new THREE.OctahedronGeometry(0.7), new THREE.MeshBasicMaterial({ color: 0x8fd16a, wireframe: true, depthTest: false }));
pivotMarker.renderOrder = 11; root.add(pivotMarker);
// referência de escala para mapmodels: soldado de 1,80 m (≈ 90 unidades MD3)
const refMan = new THREE.Group(); {
  const m = new THREE.MeshStandardMaterial({ color: 0x8a8f99, transparent: true, opacity: 0.32, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(11, 38, 4, 10), m); body.position.y = 50; refMan.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(7.5, 12, 10), m); head.position.y = 82; refMan.add(head);
  [-1, 1].forEach(s => { const leg = new THREE.Mesh(new THREE.CapsuleGeometry(5, 32, 3, 8), m); leg.position.set(s * 5.5, 21, 0); refMan.add(leg); });
  refMan.visible = false; scene.add(refMan);
}

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
  if (S.mode === 'prop') { grid.position.y = 0; grid.scale.setScalar(Math.max(1, sz / 90)); } else { grid.position.y = -25; grid.scale.setScalar(1); }
  refMan.visible = S.mode === 'prop' && S.showRef !== false;
  if (refMan.visible) { refMan.position.set(box.max.x + 25, 0, 0); box.expandByObject(refMan); }
  if (mode === 'fps') {           // câmera na posição do olho do jogador (origem do MD3)
    camera.fov = 65; camera.updateProjectionMatrix();
    camera.position.set(0, 0, 0.01); controls.target.set(0, 0, -12);
  } else {
    camera.fov = 45; camera.updateProjectionMatrix();
    const dirs = { thumb: [1, 0.2, 0.25], orbit: [1, 0.55, 0.9], side: [1, 0, 0], top: [0, 1, 0.0001], front: [0, 0.05, -1] };
    const d = new THREE.Vector3(...(dirs[mode] || dirs.orbit)).normalize();
    camera.position.copy(c).addScaledVector(d, sz * (mode === 'thumb' ? 0.85 : 1.15)); controls.target.copy(c); camera.lookAt(c);
  }
  controls.update();
}

// ---------------------------------------------------------------- carregamento do modelo
async function loadWeapon({ md3Buf, cfgText, skinImages, weaponName, project, skinSources, origin, modelObj }) {
  const m = modelObj || parseMD3(md3Buf);
  S.mode = m.md2 ? 'char' : 'weapon'; document.body.dataset.mode = S.mode; if (!m.md2) S.char = null;
  m.surfaces.forEach(computeIslands);
  meshes.forEach(x => { root.remove(x); x.geometry.dispose(); x.material.dispose(); });
  skins.forEach(sk => sk.texture && sk.texture.dispose());
  model = m; m.nfOrig = m.nf; meshes = []; skins = [];
  S.originalMD3 = md3Buf; S.cfg = (cfgText || defaultCfg(m)).replace(/\r\n/g, '\n'); S.weapon = weaponName || S.weapon;
  S.global.detail = 1;
  S.originalCfg = cfgText || null; S.skinSources = skinSources || []; S.acOriginal = origin || null; S.preset = null; S.presetM = null; S.rigid = null; S.forge = null;
  S.islandMat = m.surfaces.map(() => new Map()); S.groups = []; S.gi = -1; S.sel = { si: -1, isl: new Set() };
  S.tagOffset = [0, 0, 0]; S.frame = 0; S.modifiedSkins = new Set(); undoStack.length = 0; redoStack.length = 0;
  S.prims = []; S.animRoot = false; S.decals = []; S.di = -1; S.texK = 1; S.prop = null;
  { // pivô da arma inteira: perto do punho (centro da parte "weapon", um pouco abaixo)
    const ws = m.surfaces.find(x => x.name === 'weapon') || m.surfaces[0], P = ws.pos[0], c = [0, 0, 0];
    for (let i = 0; i < P.length; i += 3) { c[0] += P[i]; c[1] += P[i + 1]; c[2] += P[i + 2]; }
    S.root = { name: 'Arma inteira', pivot: c.map(v => +(v / (P.length / 3)).toFixed(2)), keys: {} };
  }
  { // nomes de partes repetidos (ex.: carabina): renomeia para exportar uma skin para cada
    const seen = new Set();
    m.surfaces.forEach(s => {
      if (!seen.has(s.name)) { seen.add(s.name); return; }
      const base = s.name; let k = 2; while (seen.has(base + '_' + k)) k++;
      s.name = base + '_' + k; seen.add(s.name);
      const src = parseCfg(S.cfg).skins[base] || 'skin_' + base + '.jpg';
      const file = src.replace(/(\.\w+)$/, '_' + k + '$1').replace(/^.*\//, '');
      S.cfg = S.cfg.replace(/\n?$/, '\n') + `md3skin ${s.name} ${file}\n`;
    });
  }
  const cfg = parseCfg(S.cfg);
  S.skinFiles = m.surfaces.map(s => cfg.skins[s.name] || (s.name === 'weapon' ? 'skin_weapon.jpg' : 'skin_' + s.name + '.jpg'));
  for (let i = 0; i < m.surfaces.length; i++) {
    const img = skinImages[i] || await placeholderSkin();
    skins.push(makeSkin(i, img));
  }
  m.surfaces.forEach((s, i) => meshes.push(makeMesh(i)));
  S.editSkin = Math.max(0, m.surfaces.findIndex(s => s.name === 'weapon'));
  if (project) { (project.prims || []).forEach(p => addPrimitive(p, { silent: true, noGroup: true })); applyProject(project); }
  else skins.forEach((_, i) => composite(i));
  $('#weaponName').value = S.weapon; $('#cfgText').value = S.cfg;
  if (!project && !m.md2) applyRig({ silent: true });
  updateAll(); frameCamera('orbit');
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
  const id = new Int32Array(w * h).fill(-1), pos3 = new Float32Array(w * h * 3), nrm3 = new Float32Array(w * h * 3);
  const P0 = S_.pos[0], N0 = S_.nrm[0];
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
      if (w0 >= -0.001 && w1 >= -0.001 && w2 >= -0.001) {
        const i = y * w + x; id[i] = isl;
        for (let k = 0; k < 3; k++) { pos3[i * 3 + k] = w0 * P0[a * 3 + k] + w1 * P0[b * 3 + k] + w2 * P0[c * 3 + k]; nrm3[i * 3 + k] = w0 * N0[a * 3 + k] + w1 * N0[b * 3 + k] + w2 * N0[c * 3 + k]; }
      }
    }
  }
  for (let pass = 0; pass < 3; pass++) {            // dilata para cobrir costuras
    const prev = id.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (prev[i] >= 0) continue;
      const j = (x > 0 && prev[i - 1] >= 0) ? i - 1 : (x < w - 1 && prev[i + 1] >= 0) ? i + 1 : (y > 0 && prev[i - w] >= 0) ? i - w : (y < h - 1 && prev[i + w] >= 0) ? i + w : -1;
      if (j >= 0) { id[i] = prev[j]; for (let k = 0; k < 3; k++) { pos3[i * 3 + k] = pos3[j * 3 + k]; nrm3[i * 3 + k] = nrm3[j * 3 + k]; } }
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
  const dir = new Uint8Array(S_.nIsl), mirror = new Uint8Array(S_.nIsl), area = new Float64Array(S_.nIsl);
  let tot = 0;
  for (let t = 0; t < S_.ntri; t++) {
    const a = S_.tris[t * 3], b = S_.tris[t * 3 + 1], c = S_.tris[t * 3 + 2];
    const ar = (S_.st[b * 2] - S_.st[a * 2]) * (S_.st[c * 2 + 1] - S_.st[a * 2 + 1]) - (S_.st[b * 2 + 1] - S_.st[a * 2 + 1]) * (S_.st[c * 2] - S_.st[a * 2]);
    area[S_.island[a]] += ar; tot += ar;
  }
  for (let i = 0; i < S_.nIsl; i++) mirror[i] = Math.sign(area[i]) !== Math.sign(tot) && area[i] !== 0 ? 1 : 0;
  for (let i = 0; i < S_.nIsl; i++) {
    let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
    S_.islVerts[i].forEach(v => { mnx = Math.min(mnx, S_.st[v * 2] * w); mxx = Math.max(mxx, S_.st[v * 2] * w); mny = Math.min(mny, S_.st[v * 2 + 1] * h); mxy = Math.max(mxy, S_.st[v * 2 + 1] * h); });
    dir[i] = (mxy - mny) > (mxx - mnx) ? 1 : 0;
  }
  // ruídos pré-calculados
  const noise = new Float32Array(w * h), fine = new Float32Array(w * h), noise2 = new Float32Array(w * h), scr = new Float32Array(w * h);
  const seed = si * 97.3;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    noise[i] = fbm(x / 70 + seed, y / 70); fine[i] = fbm(x / 6 + 31 + seed, y / 6 + 17); noise2[i] = fbm(x / 22 + 7 + seed, y / 22 + 3);
    // arranhões: duas famílias de riscos finos em ângulos diferentes
    for (const [ca, sa, sp, ln] of [[0.906, 0.423, 7, 34], [0.259, -0.966, 11, 22]]) {
      const u = x * ca + y * sa, v = -x * sa + y * ca, row = Math.floor(v / sp), seg = Math.floor((u + row * 13.7) / ln);
      const off = hash2(row, seg + 99) * sp, d = Math.abs(v - row * sp - off);
      if (d < 0.6) scr[i] = Math.max(scr[i], hash2(row, seg) * (1 - d));
    }
  }
  const texture = new THREE.CanvasTexture(result);
  texture.flipY = false; texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  return { si, w, h, orig, origData, base, overlay, result, id, border, mean, dir, mirror, noise, fine, noise2, scr, pos3, nrm3, texture, edge: img && img.edgeMap && img.edgeMap.length === w * h ? img.edgeMap : null };
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
  const C = G.contrast, B = G.bright * 255, muz = model.tagNames.length ? muzzle() : null, tk = S.texK || 1;
  KIT = S.mode === 'char' && S.char && S.char.kit && si === 0 ? kitSetup(sk) : null;
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i++) {
    const j = i * 4; let r = O[j], g = O[j + 1], b = O[j + 2];
    const isl = sk.id[i], m = isl >= 0 ? matOf[isl] : null;
    if (m) {
      const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      let k = Math.pow(Math.min(L / sk.mean[isl], 3.2), 0.85); k = 1 + (k - 1) * (G.detail ?? 1);
      if (m.tex) { const c = TEX[m.tex](x * tk, y * tk, m); k *= 0.95 + 0.1 * sk.fine[i]; r = c[0] * k; g = c[1] * k; b = c[2] * k; }
      else { k *= patternFactor(m, sk, i, x * tk, y * tk, isl); r = m.c[0] * k; g = m.c[1] * k; b = m.c[2] * k; }
      if (G.wear > 0 && m.wear) {                       // bordas gastas mostrando metal claro / madeira gasta
        const bd = sk.border[i], bw = sk.w > 1500 ? 6 : 4, ef = sk.edge ? sk.edge[i] / 255 : 1;
        if (bd < bw && ef > 0.02) {
          const f = clamp(G.wear * m.wear * (1 - bd / bw) * (0.55 + 0.9 * sk.fine[i]) * (sk.edge ? 0.4 + 1.4 * ef : 1), 0, 1);
          const t = m.wearColor || [168, 166, 158];
          r += (t[0] * k - r) * f; g += (t[1] * k - g) * f; b += (t[2] * k - b) * f;
        }
      }
    }
    if (KIT && si === 0 && isl >= 0) {                  // equipamento pintado do soldado (cinto, suspensórios, bolsos, capacete…)
      const f = kitAt(sk, i, isl, O[j], O[j + 1], O[j + 2]);
      if (f) {
        const mm = MATS[f[0]] || MATS.lona, L = (0.299 * O[j] + 0.587 * O[j + 1] + 0.114 * O[j + 2]) / 255;
        let kk = Math.pow(Math.min(L / sk.mean[isl], 3), 0.8); kk = (f[3] ? 0.92 + 0.16 * sk.fine[i] : 1 + (kk - 1) * 0.5) * f[1];
        let c; if (mm.tex) c = TEX[mm.tex](x * tk, y * tk, mm); else { const q = patternFactor(mm, sk, i, x * tk, y * tk, isl); c = [mm.c[0] * q, mm.c[1] * q, mm.c[2] * q]; }
        const a = f[2] ?? 1; r += (c[0] * kk - r) * a; g += (c[1] * kk - g) * a; b += (c[2] * kk - b) * a;
      }
    }
    if (isl >= 0) {                                     // camadas procedurais (estilo Substance)
      const F = S.fx, L0 = (0.299 * O[j] + 0.587 * O[j + 1] + 0.114 * O[j + 2]) / 255;
      if (F.cavity > 0) { const c = clamp((0.8 - L0 / sk.mean[isl]) * 1.6, 0, 1) * F.cavity; r = r * (1 - 0.6 * c) + 16 * c; g = g * (1 - 0.6 * c) + 12 * c; b = b * (1 - 0.6 * c) + 8 * c; }
      if (F.scratches > 0 && sk.scr[i] > 1 - F.scratches * 0.32) { const t = (0.3 + 0.35 * sk.scr[i]) * Math.min(1, F.scratches * 2.5); r += (200 - r) * t; g += (198 - g) * t; b += (190 - b) * t; }
      if (F.rust > 0) { const t = clamp((sk.noise2[i] * (0.7 + 0.6 * sk.fine[i]) - (1 - F.rust * 0.6)) * 4, 0, 1); if (t > 0) { const q = 0.7 + 0.5 * sk.fine[i]; r += (128 * q - r) * t; g += (60 * q - g) * t; b += (26 * q - b) * t; } }
      if (F.dust > 0) { const nz = sk.nrm3[i * 3 + 2], t = clamp(nz * 1.3, 0, 1) * F.dust * (0.25 + 0.75 * Math.pow(sk.noise[i], 1.5)) * 0.85; r += (156 - r) * t; g += (138 - g) * t; b += (106 - b) * t; }
      if (F.burn > 0 && muz) { const dx = sk.pos3[i * 3] - muz[0], dy = sk.pos3[i * 3 + 1] - muz[1], dz = sk.pos3[i * 3 + 2] - muz[2]; const t = Math.pow(clamp(1 - Math.sqrt(dx * dx + dy * dy + dz * dz) / (4 + F.burn * 16), 0, 1), 1.4) * (0.55 + 0.45 * sk.fine[i]); r += (20 - r) * t; g += (18 - g) * t; b += (16 - b) * t; }
      if (F.blood > 0) {
        const n = fbm(x * 0.011 + F.seed, y * 0.011 - F.seed);
        let t = clamp((n + 0.12 * sk.fine[i] - (1.02 - F.blood * 0.42)) * 9, 0, 1);
        const gx = Math.floor(x / 13), gy = Math.floor(y / 13), hh = hash2(gx + F.seed * 7, gy);
        if (hh > 1 - F.blood * 0.35) { const dx = x - gx * 13 - 6.5, dy = y - gy * 13 - 6.5, rr = 1.2 + hash2(gy, gx) * 3 * F.blood; if (dx * dx + dy * dy < rr * rr) t = Math.max(t, 0.92); }
        if (t > 0) { const e = 0.75 + 0.5 * sk.fine[i]; r += (118 * e - r) * t; g += (10 * e - g) * t; b += (14 * e - b) * t; }
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
  ctx.drawImage(sk.base, 0, 0); drawDecals(si, ctx); ctx.drawImage(sk.overlay, 0, 0);
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
// ---- curvas (easing) por quadro-chave: a curva da chave define como se chega nela
const EASE = {
  smooth: t => t * t * (3 - 2 * t),
  linear: t => t,
  out: t => 1 - Math.pow(1 - t, 3),                                       // impacto: rápido e freia
  in: t => t * t * t,                                                     // acelera
  spring: t => t >= 1 ? 1 : 1 - Math.exp(-6 * t) * Math.cos(t * Math.PI * 3), // mola (passa e volta)
  back: t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  step: t => t >= 1 ? 1 : 0,                                              // degrau (aparece/some)
};
function interpKey(g, f) {
  const ks = Object.keys(g.keys).map(Number).sort((a, b) => a - b);
  if (!ks.length) return null;
  const norm = k => ({ t: k.t, r: k.r, s: k.s ?? 1 });
  if (f <= ks[0]) return norm(g.keys[ks[0]]);
  if (f >= ks[ks.length - 1]) return norm(g.keys[ks[ks.length - 1]]);
  for (let i = 0; i < ks.length - 1; i++) if (f >= ks[i] && f <= ks[i + 1]) {
    const a = g.keys[ks[i]], b = g.keys[ks[i + 1]], t = (f - ks[i]) / (ks[i + 1] - ks[i]);
    const e = (EASE[b.e] || EASE.smooth)(t);
    const as = a.s ?? 1, bs = b.s ?? 1;
    return { t: a.t.map((v, k) => v + (b.t[k] - v) * e), r: a.r.map((v, k) => v + (b.r[k] - v) * e), s: (b.e === 'step' ? (t >= 1 ? bs : as) : as + (bs - as) * e) };
  }
  return null;
}
const I4 = new THREE.Matrix4();
function animMatrix(track, f, c) {
  const k = interpKey(track, f); if (!k) return null;
  const s = Math.max(1e-4, k.s);
  return new THREE.Matrix4().makeTranslation(c[0] + k.t[0], c[1] + k.t[1], c[2] + k.t[2])
    .multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(k.r[0] * D2R, k.r[1] * D2R, k.r[2] * D2R)))
    .multiply(new THREE.Matrix4().makeScale(s, s, s))
    .multiply(new THREE.Matrix4().makeTranslation(-c[0], -c[1], -c[2]));
}
const center = g => [g.pivot[0] + g.t[0], g.pivot[1] + g.t[1], g.pivot[2] + g.t[2]];
// animação do grupo + dos "pais" (ex.: mão que segura o carregador)
function animChain(gi, f, depth = 0) {
  const g = S.groups[gi]; let M = animMatrix(g, f, center(g)) || new THREE.Matrix4();
  const p = g.parent ?? -1;
  if (p >= 0 && p !== gi && depth < 8 && S.groups[p]) M = animChain(p, f, depth + 1).multiply(M);
  return M;
}
function staticMatrix(g) {
  const p = g.pivot;
  return new THREE.Matrix4().makeTranslation(p[0] + g.t[0], p[1] + g.t[1], p[2] + g.t[2])
    .multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(g.r[0] * D2R, g.r[1] * D2R, g.r[2] * D2R)))
    .multiply(new THREE.Matrix4().makeScale(g.s[0], g.s[1], g.s[2]))
    .multiply(new THREE.Matrix4().makeTranslation(-p[0], -p[1], -p[2]));
}
function groupMatrix(g, f, gi = S.groups.indexOf(g)) { return animChain(gi, f).multiply(staticMatrix(g)); }
function rootMatrix(f) { return animMatrix(S.root, f, S.root.pivot); }
function computeSurface(si, f) {
  const s = model.surfaces[si], vg = vertexGroups(si);
  const P = new Float32Array(s.pos[f]), N = new Float32Array(s.nrm[f]), moved = new Uint8Array(s.nv);
  const R = rootMatrix(f);
  const mats = S.groups.map((g, gi) => {
    if (g.si !== si) return null;
    let M = groupMatrix(g, f, gi);
    if (S.rigid && S.rigid[f] && s.name === 'weapon') {      // anima no espaço da peça que já se move (granada/faca na mão)
      const F = new THREE.Matrix4().fromArray(S.rigid[f]); M = F.clone().multiply(M).multiply(F.clone().invert());
    }
    if (R) M = R.clone().multiply(M);
    return { M, N: new THREE.Matrix3().getNormalMatrix(M), id: M.equals(I4) };
  });
  const rootM = R ? { M: R, N: new THREE.Matrix3().getNormalMatrix(R), id: R.equals(I4) } : null;
  const v3 = new THREE.Vector3();
  for (let v = 0; v < s.nv; v++) {
    const gi = vg[v], m = gi >= 0 ? mats[gi] : rootM;
    if (!m || m.id) continue;
    v3.set(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]).applyMatrix4(m.M); P[v * 3] = v3.x; P[v * 3 + 1] = v3.y; P[v * 3 + 2] = v3.z;
    v3.set(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]).applyMatrix3(m.N).normalize(); N[v * 3] = v3.x; N[v * 3 + 1] = v3.y; N[v * 3 + 2] = v3.z;
    moved[v] = 1;
  }
  return { P, N, moved };
}
// tag (boca do cano) acompanha a animação da arma inteira
function tagAt(f, ti = 0) {
  const tg = model.tags[Math.min(f, model.tags.length - 1)][ti];
  const o = new THREE.Vector3(tg.origin[0] + S.tagOffset[0], tg.origin[1] + S.tagOffset[1], tg.origin[2] + S.tagOffset[2]);
  const R = rootMatrix(f); if (!R) return { origin: o.toArray(), axis: tg.axis };
  o.applyMatrix4(R);
  const m3 = new THREE.Matrix3().setFromMatrix4(R), ax = tg.axis.slice();
  for (let i = 0; i < 3; i++) { const v = new THREE.Vector3(ax[i * 3], ax[i * 3 + 1], ax[i * 3 + 2]).applyMatrix3(m3).normalize(); ax[i * 3] = v.x; ax[i * 3 + 1] = v.y; ax[i * 3 + 2] = v.z; }
  return { origin: o.toArray(), axis: ax };
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
  if (gearMesh && GEAR) { const g = gearMesh.geometry; g.attributes.position.array.set(gearFrame(GEAR, S.frame)); g.attributes.position.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere(); }
  // tag (boca do cano)
  if (model.tagNames.length) {
    tagMarker.position.fromArray(tagAt(S.frame).origin);
    tagMarker.visible = S.showTag && !S.gaming;
  } else tagMarker.visible = false;
  const g = animTarget();
  pivotMarker.visible = !!g && S.showTag && !S.gaming;
  if (g) {
    const c = g === S.root ? g.pivot : center(g), v = new THREE.Vector3(...c);
    if (g !== S.root) { const Rm = rootMatrix(S.frame); const M = animChain(S.gi, S.frame); v.applyMatrix4(M); if (Rm) v.applyMatrix4(Rm); }
    pivotMarker.position.copy(v);
  }
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
    mesh.userData.selOv.visible = !S.gaming; mesh.userData.grpOv.visible = S.showTag && !S.gaming;
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
    gi: S.gi, global: { ...S.global }, fx: { ...S.fx }, decals: JSON.parse(JSON.stringify(S.decals)), tagOffset: [...S.tagOffset], root: JSON.parse(JSON.stringify(S.root)), nSurf: model.surfaces.length, prims: JSON.parse(JSON.stringify(S.prims)), animRoot: S.animRoot,
    overlays: skins.map(sk => sk.overlay.getContext('2d').getImageData(0, 0, sk.w, sk.h)),
    nf: model.nf
  };
}
function restoreState(st) {
  S.islandMat = st.islandMat; S.groups = st.groups.map(g => ({ ...g, isl: new Set(g.isl) })); S.gi = st.gi;
  S.global = st.global; S.fx = st.fx; S.decals = st.decals; S.tagOffset = st.tagOffset; S.root = st.root; S.animRoot = st.animRoot;
  if (st.nSurf < model.surfaces.length) removeSurfacesFrom(st.nSurf);
  S.prims = st.prims;
  if (st.nf !== model.nf) setFrameCount(st.nf, true);
  skins.forEach((sk, i) => st.overlays[i] && sk.overlay.getContext('2d').putImageData(st.overlays[i], 0, 0));
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
      } else if (S.tool === 'decal' && h.uv) { placeDecal(si, h.uv.x * skins[si].w, h.uv.y * skins[si].h); S.editSkin = si; draw2D(); }
      else if (S.tool === 'picker' && h.uv) { pickColor(h.object.userData.si, h.uv.x * skins[si].w, h.uv.y * skins[si].h); }
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

function brushCursor(h) {

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
  if (S.tool === 'decal') { placeDecal(si, x, y); return; }
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
    while (s.pos.length < n) { s.pos.push(new Float32Array(s.pos[0])); s.nrm.push(new Float32Array(s.nrm[0])); s.nraw.push(new Uint16Array(s.nraw[0])); }
    s.pos.length = n; s.nrm.length = n; s.nraw.length = n;
  });
  while (model.frames.length < n) model.frames.push({ ...model.frames[0], name: 'frame' + model.frames.length });
  model.frames.length = n;
  while (model.tags.length < n) model.tags.push(JSON.parse(JSON.stringify(model.tags[0])));
  model.tags.length = n;
  model.nf = n;
  S.groups.forEach(g => Object.keys(g.keys).forEach(k => { if (+k >= n) delete g.keys[k]; }));
  S.frame = Math.min(S.frame, n - 1);
  if (!silent) { updateAll(); toast(`Modelo agora tem ${n} quadros`); }
}
function anims() { return model && model.md2 ? model.md2Anims : parseCfg(S.cfg).anims; }
function playRange() {
  const a = anims()[S.animIdx];
  if (!a) return [0, model.nf - 1];
  return [clamp(a.start, 0, model.nf - 1), clamp(a.start + a.count - 1, 0, model.nf - 1)];
}
function setFrame(f) { S.frame = clamp(f, 0, model.nf - 1); updateGeometry(); updateTimeline(); updateAnimUI(); }


// ================================================================ MOTOR DE ANIMAÇÃO
function animTarget() { return S.animRoot ? S.root : S.groups[S.gi]; }
function clip(re) {
  const a = anims().find(x => re.test(x.name));
  if (!a) return null;
  const s = clamp(a.start, 0, model.nf - 1), e = clamp(a.start + a.count - 1, 0, model.nf - 1);
  return [s, e];
}
const Z3 = () => [0, 0, 0];
function setKey(track, f, k) { track.keys[f] = { t: k.t || Z3(), r: k.r || Z3(), s: k.s ?? 1, e: k.e || 'smooth' }; }
function clearKeys(track, a, b) { Object.keys(track.keys).forEach(k => { if (+k >= a && +k <= b) delete track.keys[k]; }); }
function groupByName(re) { return S.groups.findIndex(g => re.test(g.name)); }

// ---- primitivas (peças novas exportadas dentro do MD3)
function primGeometry(kind, size) {
  // cilindro ao longo de +Y (frente da arma) — raio, comprimento
  const pos = [], uv = [], tris = [];
  if (kind === 'box') {
    const [w, l, h] = size, hx = w / 2, hy = l / 2, hz = h / 2;
    const faces = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, -1, 0], [0, 0, 1]], [[0, 1, 0], [-1, 0, 0], [0, 0, 1]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [1, 0, 0], [0, -1, 0]]];
    faces.forEach(([n, u, v], fi) => {
      const base = pos.length / 3;
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        pos.push(n[0] * hx + u[0] * a * hx + v[0] * b * hx, n[1] * hy + u[1] * a * hy + v[1] * b * hy, n[2] * hz + u[2] * a * hz + v[2] * b * hz);
        uv.push((fi % 3) / 3 + (a + 1) / 6.2 + 0.005, Math.floor(fi / 3) / 2 + (1 - b) / 4.2 + 0.005);
      }
      tris.push(base, base + 1, base + 2, base, base + 2, base + 3);
    });
    return { pos, uv, tris };
  }
  const [r, L] = size, n = 10, tip = kind === 'bullet';
  for (let i = 0; i <= n; i++) {
    const a = i / n * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    pos.push(c * r, -L / 2, s * r, c * r, L / 2 * (tip ? 0.55 : 1), s * r);
    uv.push(i / n, 0.72, i / n, 0.02);
  }
  for (let i = 0; i < n; i++) { const a = i * 2; tris.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const capB = pos.length / 3; pos.push(0, -L / 2, 0); uv.push(0.25, 0.86);
  const capT = pos.length / 3; pos.push(0, L / 2, 0); uv.push(0.75, 0.86);
  for (let i = 0; i <= n; i++) {
    const a = i / n * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    pos.push(c * r, -L / 2, s * r); uv.push(0.25 + c * 0.12, 0.86 + s * 0.12);
    pos.push(c * r * (tip ? 0.15 : 1), L / 2, s * r * (tip ? 0.15 : 1)); uv.push(0.75 + c * 0.12, 0.86 + s * 0.12);
  }
  const ring = capT + 1;
  for (let i = 0; i < n; i++) { const a = ring + i * 2; tris.push(capB, a, a + 2, capT, a + 3, a + 1); }
  return { pos, uv, tris };
}
const PRIM_DEFAULTS = {
  shell: { kind: 'cyl', size: [0.42, 1.5], mat: 'latao', label: 'Estojo' },
  bullet: { kind: 'bullet', size: [0.3, 1.6], mat: 'cobre', label: 'Projétil' },
  tracer: { kind: 'cyl', size: [0.14, 7], mat: 'tracer', label: 'Traçante' },
  pin: { kind: 'cyl', size: [0.12, 2.2], mat: 'acoGasto', label: 'Pino' },
  mag: { kind: 'box', size: [1.4, 3, 7], mat: 'acoOxidado', label: 'Carregador' },
  box: { kind: 'box', size: [2, 2, 2], mat: 'acoOxidado', label: 'Caixa' },
  cyl: { kind: 'cyl', size: [0.6, 8], mat: 'acoOxidado', label: 'Cilindro' },
};
function addPrimitive(spec, { silent = false, noGroup = false } = {}) {
  const d = PRIM_DEFAULTS[spec.type] || PRIM_DEFAULTS.box;
  spec = { type: spec.type, size: spec.size || d.size, pos: spec.pos || [0, 0, 0], rot: spec.rot || [0, 0, 0], mat: spec.mat || d.mat, name: spec.name };
  if (!spec.name) { let i = 1, base = spec.type; spec.name = base; while (model.surfaces.some(x => x.name === spec.name)) spec.name = base + (++i); }
  const G = primGeometry(d.kind, spec.size);
  const rot = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(spec.rot[0] * D2R, spec.rot[1] * D2R, spec.rot[2] * D2R));
  const nv = G.pos.length / 3, P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), NR = new Uint16Array(nv);
  const v = new THREE.Vector3();
  for (let i = 0; i < nv; i++) {
    v.set(G.pos[i * 3], G.pos[i * 3 + 1], G.pos[i * 3 + 2]);
    const n = new THREE.Vector3(v.x, d.kind === 'box' ? v.y : 0, v.z).normalize(); if (d.kind === 'box') n.set(Math.sign(v.x) * (Math.abs(v.x) >= spec.size[0] / 2 - 1e-6 ? 1 : 0), Math.sign(v.y) * (Math.abs(v.y) >= spec.size[1] / 2 - 1e-6 ? 1 : 0), Math.sign(v.z) * (Math.abs(v.z) >= spec.size[2] / 2 - 1e-6 ? 1 : 0)).normalize();
    v.applyMatrix4(rot).add(new THREE.Vector3(...spec.pos)); n.applyMatrix4(new THREE.Matrix4().extractRotation(rot));
    P.set([v.x, v.y, v.z], i * 3); N.set([n.x, n.y, n.z], i * 3); NR[i] = encodeNormal(n.x, n.y, n.z);
  }
  const surf = { name: spec.name, flags: 0, nv, ntri: G.tris.length / 3, shaders: [{ name: 'skin_' + spec.name + '.jpg', index: 0 }], tris: new Int32Array(G.tris), st: new Float32Array(G.uv), pos: [], nrm: [], nraw: [], generated: true };
  for (let f = 0; f < model.nf; f++) { surf.pos.push(new Float32Array(P)); surf.nrm.push(new Float32Array(N)); surf.nraw.push(new Uint16Array(NR)); }
  computeIslands(surf);
  model.surfaces.push(surf); const si = model.surfaces.length - 1;
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const cx = cv.getContext('2d'); cx.fillStyle = '#7f7f7f'; cx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 300; i++) { cx.fillStyle = `rgba(${Math.random() < .5 ? 0 : 255},${Math.random() < .5 ? 0 : 255},${Math.random() < .5 ? 0 : 255},0.0)`; }
  cx.fillStyle = 'rgba(0,0,0,0.25)'; cx.fillRect(0, 0.7 * 128, 128, 3); // aro do estojo
  skins.push(makeSkin(si, cv));
  S.islandMat.push(new Map([...Array(surf.nIsl).keys()].map(i => [i, spec.mat])));
  S.skinFiles.push('skin_' + spec.name + '.jpg'); S.skinSources.push(null); S.modifiedSkins.add(si);
  meshes.push(makeMesh(si)); composite(si);
  if (!new RegExp('md3skin\\s+' + spec.name + '\\b').test(S.cfg)) {
    const lines = S.cfg.split('\n'); let at = -1; lines.forEach((l, i) => { if (/^\s*md3skin/i.test(l)) at = i; });
    lines.splice(at + 1, 0, `md3skin ${spec.name} skin_${spec.name}.jpg`); S.cfg = lines.join('\n'); $('#cfgText').value = S.cfg;
  }
  S.prims.push(spec);
  let gi = -1;
  if (!noGroup) {
    S.groups.push({ name: (d.label) + (spec.name.match(/\d+$/) ? ' ' + spec.name.match(/\d+$/)[0] : ''), si, isl: new Set([...Array(surf.nIsl).keys()]), pivot: [...spec.pos], t: Z3(), r: Z3(), s: [1, 1, 1], hidden: false, keys: {}, parent: -1, prim: true });
    gi = S.groups.length - 1;
  }
  if (!silent) { updateAll(); toast(`Peça "${spec.name}" criada`, 'ok'); }
  return { si, gi };
}
function removeSurfacesFrom(n) {
  while (model.surfaces.length > n) {
    const si = model.surfaces.length - 1, m = meshes.pop();
    root.remove(m); m.geometry.dispose(); m.material.dispose();
    const sk = skins.pop(); sk.texture.dispose();
    model.surfaces.pop(); S.islandMat.pop(); S.skinFiles.pop(); S.skinSources.pop(); S.modifiedSkins.delete(si);
    S.groups = S.groups.filter(g => g.si < n);
  }
  S.editSkin = Math.min(S.editSkin, model.surfaces.length - 1);
}
function defaultPort() {
  const bi = groupByName(/ferrolho|bolt/i);
  if (bi >= 0) { const c = center(S.groups[bi]); return [c[0] + 1.6, c[1], c[2] + 1.2]; }
  const t = model.tagNames.length ? model.tags[0][0].origin : [4, 25, -6];
  return [t[0] + 0.8, t[1] - 15, t[2] + 2.2];
}
// direção/ponto em milímetros do modelo do arsenal → unidades do MD3 (usa a base do slot)
function presetDir(x, y, z) {
  if (!S.presetM) return [x * 0.044, y * 0.044, z * 0.044];
  const M = new THREE.Matrix4().fromArray(S.presetM), v = new THREE.Vector3(x, y, z).transformDirection(M).multiplyScalar(Math.hypot(x, y, z) * M.getMaxScaleOnAxis());
  return [v.x, v.y, v.z].map(q => +q.toFixed(3));
}
function presetPoint(x, y, z) { return S.presetM ? new THREE.Vector3(x, y, z).applyMatrix4(new THREE.Matrix4().fromArray(S.presetM)).toArray() : [...S.root.pivot]; }
function muzzle() { const t = model.tagNames.length ? model.tags[0][0].origin : [4, 30, -6]; return [t[0] + S.tagOffset[0], t[1] + S.tagOffset[1], t[2] + S.tagOffset[2]]; }

// ---- montador de clipes: organiza idle / tiro / recarga e escreve md3anim
function assembleClips(nIdle, nShoot, nReload) {
  nIdle = clamp(nIdle | 0, 1, 64); nShoot = clamp(nShoot | 0, 1, 64); nReload = clamp(nReload | 0, 1, 128);
  snapshot('montar clipes');
  if (hasBakedAnim()) {               // quadros originais já animados: não embaralha, só acrescenta a recarga no fim
    const rl = clip(/reload/i);
    if ((rl && rl[1] > rl[0]) || nReload <= 1) { updateAll(); return; }
    const start = model.nf; setFrameCount(model.nf + nReload, true);
    const lines = S.cfg.split('\n').filter(l => !/^\s*md3anim\s+"gun reload"/i.test(l));
    let at = -1; lines.forEach((l, i) => { if (/^\s*md3anim/i.test(l)) at = i; });
    lines.splice(at + 1, 0, `md3anim "gun reload" ${start} ${nReload}`);
    S.cfg = lines.join('\n'); $('#cfgText').value = S.cfg;
    updateAll(); toast(`Animação original preservada · recarga nova nos quadros ${start}–${start + nReload - 1}`, 'ok'); return;
  }
  const old = { idle: clip(/idle/i), shoot: clip(/shoot/i), reload: clip(/reload/i) };
  const nw = { idle: [0, nIdle - 1], shoot: [nIdle, nIdle + nShoot - 1], reload: [nIdle + nShoot, nIdle + nShoot + nReload - 1] };
  // remapeia chaves já existentes para os novos intervalos (proporcional)
  const remap = f => {
    for (const k of ['shoot', 'reload', 'idle']) {
      const o = old[k]; if (!o || f < o[0] || f > o[1]) continue;
      const t = o[1] > o[0] ? (f - o[0]) / (o[1] - o[0]) : 0; return Math.round(nw[k][0] + t * (nw[k][1] - nw[k][0]));
    }
    return Math.min(f, nIdle + nShoot + nReload - 1);
  };
  [S.root, ...S.groups].forEach(tr => { const nk = {}; Object.keys(tr.keys).forEach(k => nk[remap(+k)] = tr.keys[k]); tr.keys = nk; });
  setFrameCount(nIdle + nShoot + nReload, true);
  const keep = S.cfg.split('\n').filter(l => !/^\s*md3anim\s+"gun (idle|shoot|reload)"/i.test(l));
  let at = -1; keep.forEach((l, i) => { if (/^\s*md3(skin|load)/i.test(l)) at = i; });
  keep.splice(at + 1, 0, `md3anim "gun idle" 0 ${nIdle}`, `md3anim "gun shoot" ${nIdle} ${nShoot}`, `md3anim "gun reload" ${nIdle + nShoot} ${nReload}`);
  S.cfg = keep.join('\n'); $('#cfgText').value = S.cfg;
  updateAll(); toast(`Clipes: idle 0–${nIdle - 1} · tiro ${nIdle}–${nIdle + nShoot - 1} · recarga ${nIdle + nShoot}–${nIdle + nShoot + nReload - 1}`, 'ok');
}

// ---- geradores
const GEN = {
  recoil({ kick = 2.2, rise = 6, side = 1, snap = 0.5 } = {}) {
    const c = clip(/shoot/i); if (!c) return toast('Sem clipe "gun shoot" no md3.cfg', 'warn');
    const [a, b] = c; if (b - a < 2) return toast('O clipe de tiro precisa de pelo menos 3 quadros. Use "Montar clipes".', 'warn');
    clearKeys(S.root, a, b);
    const sd = (Math.random() * 2 - 1) * side;
    setKey(S.root, a, {});
    setKey(S.root, a + 1, { t: [sd * 0.4, -kick, kick * 0.25], r: [rise, sd * 2, sd * 1.5], e: 'out' });
    const mid = Math.min(b - 1, a + 1 + Math.max(1, Math.round((b - a) * snap)));
    if (mid > a + 1) setKey(S.root, mid, { t: [sd * 0.1, kick * 0.12, -kick * 0.05], r: [-rise * 0.15, 0, 0], e: 'smooth' });
    setKey(S.root, b, { e: 'spring' });
  },
  bolt({ dist = 3, axis = '-y' } = {}) {
    const gi = groupByName(/ferrolho|bolt/i) >= 0 ? groupByName(/ferrolho|bolt/i) : S.gi;
    const g = S.groups[gi]; if (!g) return toast('Crie um grupo chamado "Ferrolho"', 'warn');
    const c = clip(/shoot/i) || [0, model.nf - 1]; const [a, b] = c;
    const ax = { '-y': [0, -1, 0], '+y': [0, 1, 0], '-x': [-1, 0, 0], '+x': [1, 0, 0], '-z': [0, 0, -1], '+z': [0, 0, 1] }[axis];
    clearKeys(g, a, b);
    setKey(g, a, {}); setKey(g, Math.min(b, a + Math.max(1, Math.round((b - a) * 0.3))), { t: ax.map(v => v * dist), e: 'out' }); setKey(g, b, { e: 'smooth' });
  },
  trigger({ quiet = false } = {}) {
    const g = S.groups[groupByName(/gatilho|trigger/i)]; if (!g) return quiet ? undefined : toast('Crie um grupo chamado "Gatilho"', 'warn');
    const [a, b] = clip(/shoot/i) || [0, model.nf - 1];
    clearKeys(g, a, b); setKey(g, a, {}); setKey(g, Math.min(b, a + 1), { r: [-14, 0, 0], e: 'out' }); setKey(g, b, {});
  },
  reload({ tilt = 22, drop = 14, dropAxis = '-z', handFollows = true, boltPull = 3, spin = 0 } = {}) {
    const c = clip(/reload/i); if (!c) return toast('Sem clipe "gun reload". Use "Montar clipes".', 'warn');
    const [a, b] = c, L = b - a; if (L < 12) return toast('A recarga precisa de pelo menos 13 quadros. Use "Montar clipes".', 'warn');
    const F = p => a + Math.round(p * L);
    const ax = { '-z': [0, 0, -1], '-x': [-1, 0, 0], '+x': [1, 0, 0], '-y': [0, -1, 0] }[dropAxis] || [0, 0, -1];
    const off = k => ax.map(v => v * drop * k);
    // arma inteira: inclina para mostrar o carregador
    clearKeys(S.root, a, b);
    setKey(S.root, a, {});
    setKey(S.root, F(0.14), { t: [-1.6, 0.5, 2.8], r: [12, tilt, -6], e: 'smooth' });
    setKey(S.root, F(0.42), { t: [-1.8, 0.4, 2.6], r: [11, tilt + 4, -6], e: 'smooth' });
    setKey(S.root, F(0.74), { t: [-1.5, 0.6, 2.9], r: [13, tilt - 3, -5], e: 'smooth' });
    setKey(S.root, F(0.77), { t: [-1.5, 0.9, 3.1], r: [14.5, tilt - 3, -5], e: 'out' });   // "clique" do carregador
    setKey(S.root, F(0.86), { t: [0.6, -0.8, 0.6], r: [4, tilt * 0.5, -2], e: 'smooth' });
    setKey(S.root, b, { e: 'back' });
    // carregador sai, some, volta novo e encaixa
    const mi = groupByName(/carregador|mag|pente/i);
    if (mi >= 0) {
      const g = S.groups[mi]; clearKeys(g, a, b);
      setKey(g, a, {}); setKey(g, F(0.16), {});
      setKey(g, F(0.24), { t: off(0.18), e: 'in' });
      setKey(g, F(0.36), { t: off(1), r: [spin, 0, 8], e: 'in' });
      setKey(g, F(0.38), { t: off(1), r: [0, 0, 8], s: 0, e: 'step' });
      setKey(g, F(0.5), { t: off(1.1), s: 0, e: 'step' });
      setKey(g, F(0.52), { t: off(1.1), r: [0, 0, -6], s: 1, e: 'step' });
      setKey(g, F(0.66), { t: off(0.22), e: 'out' });
      setKey(g, F(0.74), { t: off(0.08), e: 'smooth' });
      setKey(g, F(0.77), { e: 'out' });
      const hi = groupByName(/m[ãa]o|hand/i);
      if (handFollows && hi >= 0 && hi !== mi) S.groups[hi].parent = mi;
    }
    const bi = groupByName(/ferrolho|bolt/i);
    if (bi >= 0 && boltPull) {
      const g = S.groups[bi]; clearKeys(g, a, b);
      setKey(g, F(0.8), {}); setKey(g, F(0.86), { t: [0, -boltPull, 0], e: 'out' }); setKey(g, F(0.93), { e: 'spring' });
    }
    return { mag: mi >= 0, bolt: bi >= 0 };
  },
  shell({ size = 1, toRight = true, at = 0 } = {}) {
    const c = clip(/shoot/i); if (!c) return toast('Sem clipe "gun shoot"', 'warn');
    const [a0, b0] = c, L0 = b0 - a0; if (L0 < 3) return toast('O clipe de tiro precisa de pelo menos 4 quadros. Use "Montar clipes".', 'warn');
    const a = a0 + Math.round(at * L0), b = Math.min(b0, a + Math.max(3, Math.round(L0 * (at ? 0.4 : 1))));
    let gi = S.groups.findIndex(g => g.prim && /estojo/i.test(g.name));
    if (gi < 0) gi = addPrimitive({ type: 'shell', pos: defaultPort(), size: [0.42 * size, 1.5 * size], rot: [0, 0, 90] }, { silent: true }).gi;
    const g = S.groups[gi], sx = toRight ? 1 : -1;
    g.keys = {};
    setKey(g, a, { s: 0 });
    setKey(g, a + 1, { s: 1, e: 'step' });
    setKey(g, a + Math.max(2, Math.round((b - a) * 0.45)), { t: [6 * sx, 0.6, 3.2], r: [160, 40, 220 * sx], e: 'out' });
    setKey(g, b - 1, { t: [13 * sx, -0.8, -3], r: [380, 90, 520 * sx], e: 'in' });
    setKey(g, b, { t: [13 * sx, -0.8, -3], s: 0, e: 'step' });
    return gi;
  },
  // ---- específicos dos modelos do arsenal
  pinPull({ style = 'ring' } = {}) {          // tirar o pino / tampa / cordão (clipe "gun shoot")
    const g = S.groups[groupByName(/^pino$/i)]; if (!g) return;
    const [a, b] = clip(/shoot/i) || [0, model.nf - 1], L = b - a, F = p => a + Math.round(p * L);
    const d = (x, y, z) => presetDir(x, y, z);
    g.keys = {}; setKey(g, a, {});
    if (style === 'cap') {                     // desenrosca e puxa o cordão
      setKey(g, F(0.25), { r: [0, 0, 300], e: 'linear' }); setKey(g, F(0.45), { r: [0, 0, 600], t: d(0, -8, 0), e: 'linear' });
      setKey(g, F(0.7), { r: [0, 0, 640], t: d(0, -60, -20), e: 'out' }); setKey(g, F(0.85), { r: [90, 0, 700], t: d(10, -90, -140), e: 'in' });
      setKey(g, F(0.9), { t: d(10, -90, -140), s: 0, e: 'step' });
    } else if (style === 'slide') {             // RGD-33: trava desliza
      setKey(g, F(0.3), { t: d(0, -14, 0), e: 'out' }); setKey(g, b, { t: d(0, -14, 0) });
    } else {                                    // argola/alça: puxa para fora e joga longe
      setKey(g, F(0.2), { t: d(4, 2, 0) }); setKey(g, F(0.45), { t: d(30, 6, 4), r: [0, 0, 40], e: 'out' });
      setKey(g, F(0.75), { t: d(80, -40, -120), r: [200, 90, 220], e: 'in' }); setKey(g, F(0.8), { t: d(80, -40, -120), s: 0, e: 'step' });
    }
  },
  spoon() {                                     // a alavanca voa quando a granada é solta (clipe "gun throw")
    const g = S.groups[groupByName(/^alavanca$/i)]; if (!g) return;
    const c = clip(/throw/i) || clip(/shoot/i); if (!c) return; const [a, b] = c, L = b - a, F = p => a + Math.round(p * L);
    g.keys = {}; setKey(g, a, {}); setKey(g, F(0.45), {});
    setKey(g, F(0.6), { t: presetDir(10, 30, 40), r: [-90, 0, 60], e: 'out' }); setKey(g, F(0.85), { t: presetDir(30, -40, 160), r: [-400, 0, 200], e: 'in' });
    setKey(g, F(0.9), { t: presetDir(30, -40, 160), s: 0, e: 'step' });
  },
  beltReload() {                                // MG 42: abre a tampa, troca o cofre/fita, fecha com tapa
    const c = clip(/reload/i); if (!c) return; const [a, b] = c, L = b - a, F = p => a + Math.round(p * L);
    clearKeys(S.root, a, b); setKey(S.root, a, {}); setKey(S.root, F(0.12), { t: [0.8, -1.2, 1.2], r: [8, 18, -10] }); setKey(S.root, F(0.85), { t: [0.8, -1.2, 1.2], r: [10, 16, -10] }); setKey(S.root, b, { e: 'back' });
    const tp = S.groups[groupByName(/^tampa$/i)];
    if (tp) { clearKeys(tp, a, b); setKey(tp, F(0.15), {}); setKey(tp, F(0.28), { r: [-75, 0, 0], e: 'out' }); setKey(tp, F(0.7), { r: [-75, 0, 0] }); setKey(tp, F(0.8), { e: 'back' }); }
    const g = S.groups[groupByName(/^carregador$/i)];
    if (g) { clearKeys(g, a, b); setKey(g, F(0.28), {}); setKey(g, F(0.42), { t: [-3, 0, -5], r: [0, 0, 20], e: 'in' }); setKey(g, F(0.55), { t: [-3, 0, -5], r: [0, 0, 20] }); setKey(g, F(0.68), { e: 'out' }); }
  },
  panReload() {                                 // Lewis: tira o prato de cima, gira e encaixa outro
    const c = clip(/reload/i); if (!c) return; const [a, b] = c, L = b - a, F = p => a + Math.round(p * L);
    clearKeys(S.root, a, b); setKey(S.root, a, {}); setKey(S.root, F(0.12), { t: [0, -1, -1], r: [-14, 10, 0] }); setKey(S.root, F(0.85), { t: [0, -1, -1], r: [-14, 8, 0] }); setKey(S.root, b, { e: 'back' });
    const g = S.groups[groupByName(/^carregador$/i)]; if (!g) return;
    clearKeys(g, a, b); setKey(g, F(0.15), {}); setKey(g, F(0.32), { t: [2, 0, 6], r: [0, 0, 120], e: 'out' }); setKey(g, F(0.5), { t: [6, 0, 10], r: [0, 0, 200], e: 'in' });
    setKey(g, F(0.62), { t: [2, 0, 6], r: [0, 0, 300] }); setKey(g, F(0.76), { r: [0, 0, 360], e: 'out' }); setKey(g, b, { r: [0, 0, 360] });
  },
  rockReload() {                                // Chauchat: o carregador em meia-lua sai girando para a frente
    const c = clip(/reload/i); if (!c) return; const [a, b] = c, L = b - a, F = p => a + Math.round(p * L);
    clearKeys(S.root, a, b); setKey(S.root, a, {}); setKey(S.root, F(0.12), { t: [1, 0, 1.4], r: [-6, -22, 6] }); setKey(S.root, F(0.85), { t: [1, 0, 1.4], r: [-6, -20, 6] }); setKey(S.root, b, { e: 'back' });
    const g = S.groups[groupByName(/^carregador$/i)]; if (!g) return;
    clearKeys(g, a, b); setKey(g, F(0.18), {}); setKey(g, F(0.3), { r: [-35, 0, 0], e: 'out' }); setKey(g, F(0.42), { t: [0, 2, -8], r: [-50, 0, 0], e: 'in' });
    setKey(g, F(0.56), { t: [0, 2, -8], r: [-50, 0, 0] }); setKey(g, F(0.68), { r: [-35, 0, 0], e: 'out' }); setKey(g, F(0.78), { e: 'spring' });
  },
  toggle({ lift = 70 } = {}) {                 // Luger: a articulação sobe e volta
    const g = S.groups[groupByName(/^ferrolho$/i)]; if (!g) return;
    const [a, b] = clip(/shoot/i) || [0, model.nf - 1];
    clearKeys(g, a, b); setKey(g, a, {}); setKey(g, Math.min(b, a + 1), { r: [lift, 0, 0], t: [0, -0.8, 0.3], e: 'out' }); setKey(g, Math.min(b, a + 3), { e: 'spring' });
  },
  hammer() {                                    // revólver: o cão bate
    const g = S.groups[groupByName(/^ferrolho$/i)]; if (!g) return;
    const [a, b] = clip(/shoot/i) || [0, model.nf - 1];
    clearKeys(g, a, b); setKey(g, a, { r: [-35, 0, 0] }); setKey(g, Math.min(b, a + 1), { e: 'out' }); setKey(g, b, { r: [-35, 0, 0], e: 'smooth' });
  },
  revolverReload() {                            // tambor gira rápido (municiador) e a arma inclina
    const c = clip(/reload/i); if (!c) return; const [a, b] = c, L = b - a, F = p => a + Math.round(p * L);
    clearKeys(S.root, a, b); setKey(S.root, a, {}); setKey(S.root, F(0.15), { t: [1.5, -1, 1.5], r: [10, 35, -8] }); setKey(S.root, F(0.8), { t: [1.5, -1, 1.5], r: [12, 32, -8] }); setKey(S.root, b, { e: 'back' });
    const g = S.groups[groupByName(/^tambor$/i)]; if (!g) return;
    clearKeys(g, a, b); setKey(g, a, {}); setKey(g, F(0.2), {}); setKey(g, F(0.55), { r: [0, 720, 0], e: 'linear' }); setKey(g, F(0.75), { r: [0, 1080, 0], e: 'out' }); setKey(g, b, { r: [0, 1080, 0] });
  },
  stripper() {                                  // pente de lâminas empurrado por cima (Kar98k, Mosin, Garand…)
    const c = clip(/reload/i); if (!c) return; const [a, b] = c, L = b - a, F = p => a + Math.round(p * L);
    let gi = S.groups.findIndex(g => /^pente$/i.test(g.name));
    if (gi < 0) { const pos = presetPoint(0, -10, 26); gi = addPrimitive({ type: 'box', name: 'clip', size: [0.3, 1.5, 1.1], pos, mat: 'latao' }, { silent: true }).gi; S.groups[gi].name = 'Pente'; }
    clearKeys(S.root, a, b); setKey(S.root, a, {}); setKey(S.root, F(0.15), { t: [-1.4, 0, 2.2], r: [10, 18, -4] }); setKey(S.root, F(0.75), { t: [-1.3, 0, 2.1], r: [10, 16, -4] }); setKey(S.root, b, { e: 'back' });
    const g = S.groups[gi]; g.keys = {};
    setKey(g, a, { s: 0 }); setKey(g, F(0.3), { t: presetDir(0, 0, 70), s: 0 });
    setKey(g, F(0.32), { t: presetDir(0, 0, 70), s: 1, e: 'step' }); setKey(g, F(0.45), { t: presetDir(0, 0, 25), e: 'out' });
    setKey(g, F(0.62), { t: presetDir(0, 0, 0), e: 'in' }); setKey(g, F(0.66), { t: presetDir(0, 0, 0), s: 0, e: 'step' });
  },
  shellLoad({ count = 4 } = {}) {               // escopeta: cartuchos entrando um a um por baixo
    const c = clip(/reload/i); if (!c) return; const [a, b] = c, L = b - a, F = p => a + Math.round(p * L);
    let gi = S.groups.findIndex(g => /^cartucho$/i.test(g.name));
    if (gi < 0) { const pos = presetPoint(0, 20, -36); gi = addPrimitive({ type: 'cyl', name: 'shell12', size: [0.4, 1.6], pos, mat: 'tintaVermelha' }, { silent: true }).gi; S.groups[gi].name = 'Cartucho'; }
    const g = S.groups[gi]; g.keys = {}; setKey(g, a, { s: 0 });
    for (let i = 0; i < count; i++) {
      const p0 = 0.18 + i * (0.62 / count), p1 = p0 + 0.5 / count * 0.55;
      setKey(g, F(p0), { t: presetDir(-30, -20, -80), r: [30, 0, 0], s: 0 });
      setKey(g, F(p0) + 1, { t: presetDir(-30, -20, -80), r: [30, 0, 0], s: 1, e: 'step' });
      setKey(g, F(p1), { t: presetDir(0, 10, 0), e: 'out' });
      setKey(g, F(p1) + 1, { t: presetDir(0, 10, 0), s: 0, e: 'step' });
    }
    clearKeys(S.root, a, b); setKey(S.root, a, {}); setKey(S.root, F(0.12), { t: [0.5, -1, 1], r: [6, -28, 6] }); setKey(S.root, F(0.82), { t: [0.5, -1, 1], r: [6, -26, 6] }); setKey(S.root, b, { e: 'back' });
  },
  tambor({ deg = 51.4, quiet = true } = {}) {
    const g = S.groups[groupByName(/^tambor$/i)]; if (!g) return quiet ? undefined : toast('Sem grupo "Tambor"', 'warn');
    const [a, b] = clip(/shoot/i) || [0, model.nf - 1];
    clearKeys(g, a, b); setKey(g, a, {}); setKey(g, Math.min(b, a + 2), { rot: undefined, r: [0, deg, 0], e: 'out' }); setKey(g, b, { r: [0, deg, 0] });
  },
  pump({ dist = 4.5 } = {}) {
    const g = S.groups[groupByName(/telha|pump|bomba|guarda/i)]; if (!g) return toast('Crie um grupo chamado "Telha" (a parte que desliza)', 'warn');
    const [a, b] = clip(/shoot/i) || [0, model.nf - 1], L = b - a, F = p => a + Math.round(p * L);
    clearKeys(g, a, b);
    setKey(g, a, {}); setKey(g, F(0.32), {});
    setKey(g, F(0.5), { t: [0, -dist, 0], e: 'out' }); setKey(g, F(0.56), { t: [0, -dist, 0] });
    setKey(g, F(0.74), { e: 'out' });
    setKey(S.root, F(0.32), {}); setKey(S.root, F(0.5), { t: [0, -0.6, -0.3], r: [-3, 0, 2], e: 'out' }); setKey(S.root, F(0.74), { r: [1, 0, 0], e: 'out' }); setKey(S.root, b, { e: 'smooth' });
  },
  boltAction({ lift = 65, pull = 4.5 } = {}) {
    const gi = groupByName(/ferrolho|bolt/i); const g = S.groups[gi]; if (!g) return toast('Crie um grupo chamado "Ferrolho" (a alavanca)', 'warn');
    const [a, b] = clip(/shoot/i) || [0, model.nf - 1], L = b - a, F = p => a + Math.round(p * L);
    if (L < 10) return toast('Ferrolho manual precisa de pelo menos 11 quadros no tiro', 'warn');
    clearKeys(g, a, b);
    setKey(g, a, {}); setKey(g, F(0.3), {});
    setKey(g, F(0.42), { r: [0, lift, 0], e: 'out' });               // levanta a alavanca
    setKey(g, F(0.55), { t: [0, -pull, 0], r: [0, lift, 0], e: 'out' }); // puxa
    setKey(g, F(0.62), { t: [0, -pull, 0], r: [0, lift, 0] });
    setKey(g, F(0.74), { r: [0, lift, 0], e: 'out' });                // empurra
    setKey(g, F(0.84), { e: 'out' });                                 // abaixa
    setKey(S.root, F(0.25), {}); setKey(S.root, F(0.4), { t: [-1.2, -0.6, 1.6], r: [6, 22, 2] }); setKey(S.root, F(0.78), { t: [-1.1, -0.4, 1.4], r: [5, 20, 2] }); setKey(S.root, b, { e: 'smooth' });
  },
  knife({ reach = hasBakedAnim() ? 0.35 : 1 } = {}) {
    const [a, b] = clip(/shoot/i) || [0, model.nf - 1], L = b - a, F = p => a + Math.round(p * L);
    if (L < 5) return toast('O golpe precisa de pelo menos 6 quadros', 'warn');
    clearKeys(S.root, a, b);
    setKey(S.root, a, {});
    setKey(S.root, F(0.3), { t: [3, -4, 2.5], r: [12, 0, 35], e: 'smooth' });
    setKey(S.root, F(0.55), { t: [-3, 11 * reach, -1.5], r: [-18, 10, -45], e: 'out' });
    setKey(S.root, b, { e: 'smooth' });
  },
  tracer({ dist = 80 } = {}) {
    const c = clip(/shoot/i); if (!c) return;
    const [a, b] = c; if (b - a < 2) return toast('O clipe de tiro precisa de pelo menos 3 quadros', 'warn');
    let gi = S.groups.findIndex(g => g.prim && /traçante|tracer/i.test(g.name));
    const m = muzzle();
    if (gi < 0) gi = addPrimitive({ type: 'tracer', pos: [m[0], m[1] + 4, m[2]] }, { silent: true }).gi;
    const g = S.groups[gi]; g.keys = {};
    setKey(g, a, { s: 0 });
    setKey(g, a + 1, { s: 1, e: 'step' });
    setKey(g, a + 2, { t: [0, dist, 0], e: 'linear' });
    setKey(g, a + 3 <= b ? a + 3 : b, { t: [0, dist, 0], s: 0, e: 'step' });
    return gi;
  },
  grenade({ power = 1, rootMotion = !hasBakedAnim() } = {}) {
    const c = clip(/shoot/i) || [0, model.nf - 1]; const [a, b] = c, L = b - a;
    if (L < 8) return toast('Arremesso precisa de pelo menos 9 quadros no "gun shoot". Use "Montar clipes".', 'warn');
    const F = p => a + Math.round(p * L);
    let pi = groupByName(/pino|pin/i);
    if (pi < 0) { const m = S.groups.length; pi = addPrimitive({ type: 'pin', pos: [S.root.pivot[0] + 1.2, S.root.pivot[1] + 2, S.root.pivot[2] + 3], rot: [0, 0, 90] }, { silent: true }).gi; S.groups[pi].name = 'Pino'; }
    const pin = S.groups[pi]; pin.keys = {};
    setKey(pin, a, {}); setKey(pin, F(0.08), {});
    setKey(pin, F(0.22), { t: [5, -1, 2], r: [0, 0, 70], e: 'out' });
    setKey(pin, F(0.32), { t: [8, -3, -10], r: [90, 0, 200], e: 'in' });
    setKey(pin, F(0.34), { t: [8, -3, -10], s: 0, e: 'step' });
    if (!rootMotion) return;
    clearKeys(S.root, a, b);
    setKey(S.root, a, {});
    setKey(S.root, F(0.2), { t: [0.5, -1.5, 1], r: [6, 0, -4] });
    setKey(S.root, F(0.5), { t: [3, -9 * power, 7], r: [38, 6, -14], e: 'smooth' });       // braço para trás
    setKey(S.root, F(0.66), { t: [-1, 16 * power, 3], r: [-40, -4, 10], e: 'out' });      // arremesso
    setKey(S.root, F(0.68), { t: [-1, 16 * power, 3], r: [-40, -4, 10], s: 0, e: 'step' }); // soltou: some
    setKey(S.root, F(0.9), { t: [0, 0, -14], s: 0, e: 'step' });
    setKey(S.root, F(0.92), { t: [0, 0, -14], s: 1, e: 'step' });                          // nova granada sobe
    setKey(S.root, b, { e: 'out' });
  },
  idle({ amount = 1 } = {}) {
    const c = clip(/idle/i); if (!c) return; const [a, b] = c;
    if (b - a < 3) return toast('O idle precisa de pelo menos 4 quadros para respirar. Use "Montar clipes".', 'warn');
    clearKeys(S.root, a, b);
    setKey(S.root, a, {});
    setKey(S.root, a + Math.round((b - a) / 2), { t: [0.15 * amount, 0, -0.35 * amount], r: [-0.8 * amount, 0, 0.6 * amount] });
    setKey(S.root, b, {});
  },
};

// ---- animação de fábrica de cada modelo do arsenal
function presetAnim(def) {
  const id = def.id, slot = def.slot;
  if (def.forge) {
    const p = def.forge.p, side = p.mag === 'lateral', drum = p.mag === 'tambor', boxMag = ['reto', 'curvo', 'tambor', 'lateral'].includes(p.mag);
    const reload = boxMag ? ['reload', { tilt: side ? 12 : 22, dropAxis: side ? '-x' : '-z', drop: side ? 12 : 15, spin: drum ? 90 : 0 }] : slot === 'shotgun' ? ['shellLoad', { count: 4 }] : ['stripper'];
    if (slot === 'pistol') return { clips: [1, 6, 36], steps: [['recoil', { kick: 1.8, rise: 10, snap: 0.4 }], ['bolt', { dist: 2.2 }], ['trigger', { quiet: true }], ['shell', { size: 0.8 }], ['reload', { tilt: 30, drop: 10 }]], n: 'slide, cápsula e carregador' };
    if (slot === 'sniper') return { clips: [1, 30, 48], steps: [['recoil', { kick: 4, rise: 12, side: 0.5, snap: 0.2 }], ['boltAction', {}], ['trigger', { quiet: true }], ['shell', { at: 0.5 }], boxMag ? ['reload', { tilt: 18, boltPull: 0, dropAxis: side ? '-x' : '-z' }] : ['stripper']], n: 'ferrolho manual, cápsula e recarga' };
    if (slot === 'shotgun') return { clips: [1, 26, 44], steps: [['recoil', { kick: 5, rise: 14, snap: 0.15 }], ['pump', {}], ['trigger', { quiet: true }], ['shell', { at: 0.45, size: 1.4 }], ['shellLoad', { count: 4 }]], n: 'impacto, pump, cápsula e cartuchos' };
    const auto = slot === 'subgun' || slot === 'assault';
    return { clips: slot === 'carbine' ? [1, 10, 44] : [1, 8, slot === 'assault' ? 48 : 44], steps: [['recoil', { kick: slot === 'subgun' ? 1.6 : slot === 'assault' ? 2.2 : 2.8, rise: slot === 'carbine' ? 8 : 5, side: 0.9 }], ['bolt', { dist: 2.8 }], ['trigger', { quiet: true }], ['shell', {}], ...(auto ? [['tracer', {}]] : []), reload], n: 'recuo, ferrolho, cápsula' + (auto ? ', traçante' : '') + ' e recarga' };
  }
  if (slot === 'grenade') return { clips: null, steps: [['pinPull', { style: /stiel|eihand/.test(id) ? 'cap' : id === 'rgd33' ? 'slide' : 'ring' }], ['spoon', {}]], n: 'pino + alavanca' };
  if (slot === 'knife') return { clips: null, steps: [], n: 'golpe original' };
  if (slot === 'pistol') {
    if (/webley|nagant/.test(id)) return { clips: [1, 6, 40], steps: [['recoil', { kick: 2.2, rise: 14, snap: 0.4 }], ['hammer'], ['trigger', { quiet: true }], ['tambor', {}], ['revolverReload']], n: 'cão, tambor e municiador' };
    return { clips: [1, 6, 36], steps: [['recoil', { kick: 1.8, rise: 10, snap: 0.4 }], id === 'luger' ? ['toggle'] : ['bolt', { dist: id === 'c96' ? 1.4 : 2.2 }], ['trigger', { quiet: true }], ['shell', { size: 0.8 }], ['reload', { tilt: 30, drop: id === 'c96' ? 0 : 10 }]], n: id === 'luger' ? 'articulação, cápsula e carregador' : 'slide, cápsula e carregador' };
  }
  if (slot === 'subgun') {
    const side = /sten|mp18/.test(id), drum = /thompson|ppsh/.test(id);
    return { clips: [1, 8, 44], steps: [['recoil', { kick: 1.6, rise: 4, side: 0.8 }], ['bolt', { dist: 2.5 }], ['trigger', { quiet: true }], ['shell', {}], ['tracer', {}], ['reload', { tilt: side ? 12 : 22, dropAxis: side ? '-x' : '-z', drop: side ? 12 : drum ? 12 : 16, spin: drum ? 90 : 0 }]], n: 'recuo, ferrolho, cápsula, traçante e recarga' };
  }
  if (id === 'mg42' || id === 'lewis' || id === 'chauchat') return { clips: [1, 8, 56], steps: [['recoil', { kick: 3, rise: id === 'mg42' ? 4 : 6, side: id === 'mg42' ? 1.6 : 1 }], ['bolt', { dist: 3 }], ['trigger', { quiet: true }], ['shell', {}], ['tracer', {}], [id === 'mg42' ? 'beltReload' : id === 'lewis' ? 'panReload' : 'rockReload', {}]], n: id === 'mg42' ? 'recuo, cápsula, traçante e troca de fita com a tampa abrindo' : id === 'lewis' ? 'recuo, cápsula, traçante e troca do prato girando' : 'recuo, cápsula, traçante e carregador em meia-lua saindo para a frente' };
  if (slot === 'assault') return { clips: [1, 8, 48], steps: [['recoil', { kick: /bar1918|mg42|lewis|chauchat/.test(id) ? 3 : 2.2, rise: id === 'mg42' ? 4 : 6, side: id === 'mg42' ? 1.6 : 1 }], ['bolt', { dist: 3 }], ['trigger', { quiet: true }], ['shell', {}], ['tracer', {}], ['reload', { tilt: id === 'fg42' ? 12 : id === 'lewis' ? 10 : 26, dropAxis: id === 'fg42' ? '-x' : '-z', spin: id === 'lewis' ? 90 : 0 }]], n: 'recuo, ferrolho, cápsula, traçante e recarga' };
  if (slot === 'sniper') return { clips: [1, 30, 48], steps: [['recoil', { kick: 4, rise: 12, side: 0.5, snap: 0.2 }], ['boltAction', {}], ['trigger', { quiet: true }], ['shell', { at: 0.5 }], id === 'enfield4' ? ['reload', { tilt: 18, boltPull: 0 }] : ['stripper']], n: 'ferrolho manual, cápsula e ' + (id === 'enfield4' ? 'carregador' : 'pente de lâminas') };
  if (slot === 'carbine') {
    if (id === 'smle') return { clips: [1, 30, 48], steps: [['recoil', { kick: 3.5, rise: 11, snap: 0.2 }], ['boltAction', { lift: 55, pull: 4 }], ['trigger', { quiet: true }], ['shell', { at: 0.5 }], ['stripper']], n: 'ferrolho manual e pente de lâminas' };
    return { clips: [1, 10, 44], steps: [['recoil', { kick: 2.8, rise: 8 }], ['bolt', { dist: 3.2 }], ['trigger', { quiet: true }], ['shell', {}], id === 'garand' ? ['stripper'] : ['reload', { tilt: 20 }]], n: id === 'garand' ? 'ferrolho, cápsula e clipe en-bloc' : 'ferrolho, cápsula e carregador' };
  }
  if (slot === 'shotgun') return { clips: [1, 26, 44], steps: [['recoil', { kick: 5, rise: 14, snap: 0.15 }], ['pump', {}], ['trigger', { quiet: true }], ['shell', { at: 0.45, size: 1.4 }], ['shellLoad', { count: 4 }]], n: 'impacto, pump, cápsula e cartuchos' };
  return null;
}
function applyPresetAnim(def, silent) {
  const P = presetAnim(def); if (!P) return;
  if (!silent) snapshot('animação ' + def.n);
  const u = undoStack.length;
  if (P.clips) assembleClips(...P.clips);
  undoStack.length = u;
  P.steps.forEach(([g, o]) => GEN[g] && GEN[g](o || {}));
  S.presetAnimName = P.n;
  if (!silent) { updateAll(); toast(`Animação de fábrica: ${P.n}`, 'ok'); }
}

// ---- banco de animações por tipo de arma
const ANIM_BANK = {
  subgun:  { n: 'SMG (MP40 · Thompson · PPSh)', clips: [1, 8, 44], needs: 'Ferrolho, Carregador, Mão (opcional)', steps: [['recoil', { kick: 1.6, rise: 4, side: 0.8 }], ['bolt', { dist: 2.5 }], ['trigger', { quiet: true }], ['shell', {}], ['tracer', {}], ['reload', { tilt: 22 }]] },
  assault: { n: 'Fuzil de assalto (StG 44)', clips: [1, 8, 48], needs: 'Ferrolho, Carregador', steps: [['recoil', { kick: 2.2, rise: 6, side: 1 }], ['bolt', { dist: 3 }], ['trigger', { quiet: true }], ['shell', {}], ['tracer', {}], ['reload', { tilt: 26 }]] },
  carbine: { n: 'Carabina (M1 Carbine · Garand)', clips: [1, 10, 44], needs: 'Ferrolho, Carregador', steps: [['recoil', { kick: 2.8, rise: 8 }], ['bolt', { dist: 3.2 }], ['shell', {}], ['reload', { tilt: 20 }]] },
  sniper:  { n: 'Sniper de ferrolho (Kar98k · Mosin)', clips: [1, 30, 48], needs: 'Ferrolho (alavanca), Carregador', steps: [['recoil', { kick: 4, rise: 12, side: 0.5, snap: 0.2 }], ['boltAction', {}], ['shell', { at: 0.5 }], ['reload', { tilt: 18, boltPull: 0 }]] },
  shotgun: { n: 'Escopeta pump (Winchester 1897)', clips: [1, 26, 44], needs: 'Telha (pump)', steps: [['recoil', { kick: 5, rise: 14, snap: 0.15 }], ['pump', {}], ['shell', { at: 0.45, size: 1.6 }], ['reload', { tilt: 16, drop: 0 }]] },
  pistol:  { n: 'Pistola (Luger · Colt 1911)', clips: [1, 6, 36], needs: 'Ferrolho (slide), Carregador', steps: [['recoil', { kick: 1.8, rise: 10, snap: 0.4 }], ['bolt', { dist: 2.2 }], ['trigger', { quiet: true }], ['tambor', {}], ['shell', { size: 0.8 }], ['reload', { tilt: 30, drop: 10 }]] },
  grenade: { n: 'Granada (pino + arremesso)', clips: [1, 26, 1], needs: 'Pino (criado sozinho se faltar)', steps: [['grenade', {}]] },
  knife:   { n: 'Faca / baioneta (golpe)', clips: [1, 12, 1], needs: '—', steps: [['knife', {}]] },
};
function applyAnimBank(key) {
  if (!model) return;
  const P = ANIM_BANK[key]; snapshot('pacote ' + P.n);
  const u = undoStack.length;
  assembleClips(...P.clips); undoStack.length = u;     // um único desfazer para o pacote
  P.steps.forEach(([g, o]) => GEN[g](o));
  updateAll();
  const miss = P.needs.split(',').map(x => x.trim()).filter(x => x && x !== '—' && !/opcional|criado/.test(x)).map(x => x.split(' ')[0]).filter(n => groupByName(new RegExp('^' + n.slice(0, 5), 'i')) < 0);
  toast(`Pacote "${P.n}" aplicado.` + (miss.length ? ` Faltam grupos: ${miss.join(', ')} — crie e aplique de novo.` : ''), miss.length ? 'warn' : 'ok');
}
// minhas animações (salvas no navegador)
function myAnims() { try { return JSON.parse(localStorage.getItem('cm_anims') || '[]'); } catch (e) { return []; } }
function saveMyAnim(name) {
  if (!model) return;
  const counts = ['idle', 'shoot', 'reload'].map(n => { const c = clip(new RegExp(n, 'i')); return c ? c[1] - c[0] + 1 : 1; });
  const entry = {
    name: name || `${S.weapon} ${new Date().toLocaleDateString()}`, weapon: S.weapon, clips: counts,
    root: S.root.keys, groups: S.groups.filter(g => Object.keys(g.keys).length).map(g => ({ name: g.name, keys: g.keys, parent: g.parent >= 0 && S.groups[g.parent] ? S.groups[g.parent].name : null, prim: g.prim ? (S.prims.find(p => model.surfaces[g.si].name === p.name) || {}).type : null }))
  };
  const list = myAnims().filter(a => a.name !== entry.name); list.push(entry);
  try { localStorage.setItem('cm_anims', JSON.stringify(list)); toast(`Animação "${entry.name}" salva no banco`, 'ok'); } catch (e) { toast('Não foi possível salvar no navegador', 'err'); }
  updateBankUI();
}
function applyMyAnim(i) {
  const A = myAnims()[i]; if (!A || !model) return;
  snapshot('animação ' + A.name); const u = undoStack.length;
  assembleClips(...A.clips); undoStack.length = u;
  S.root.keys = JSON.parse(JSON.stringify(A.root));
  const missing = [];
  A.groups.forEach(sg => {
    let gi = S.groups.findIndex(g => g.name.toLowerCase() === sg.name.toLowerCase());
    if (gi < 0 && sg.prim) {
      const pos = sg.prim === 'shell' ? defaultPort() : sg.prim === 'tracer' ? (m => [m[0], m[1] + 4, m[2]])(muzzle()) : [...S.root.pivot];
      gi = addPrimitive({ type: sg.prim, pos, rot: sg.prim === 'tracer' ? [0, 0, 0] : [0, 0, 90] }, { silent: true }).gi; S.groups[gi].name = sg.name;
    }
    if (gi < 0) { missing.push(sg.name); return; }
    S.groups[gi].keys = JSON.parse(JSON.stringify(sg.keys));
  });
  A.groups.forEach(sg => { if (!sg.parent) return; const c = S.groups.findIndex(g => g.name === sg.name), p = S.groups.findIndex(g => g.name === sg.parent); if (c >= 0 && p >= 0) S.groups[c].parent = p; });
  updateAll(); toast(`"${A.name}" aplicada` + (missing.length ? ` · grupos não encontrados: ${missing.join(', ')}` : ''), missing.length ? 'warn' : 'ok');
}
function deleteMyAnim(i) { const l = myAnims(); l.splice(i, 1); localStorage.setItem('cm_anims', JSON.stringify(l)); updateBankUI(); }
function updatePresetAnimCard() {
  const box = $('#presetAnim'); if (!box) return;
  const def = S.preset && ARSENAL.find(a => a.id === S.preset.id);
  box.innerHTML = def ? `<div class="bankcard rec"><b>Animação de fábrica · ${def.n}</b><small>${presetAnim(def).n}</small><button class="btn sm primary">Reaplicar</button></div>` : '';
  if (def) box.querySelector('button').onclick = () => applyPresetAnim(def);
}
function updateBankUI() {
  updatePresetAnimCard();
  const ul = $('#myAnims'); if (!ul) return; ul.innerHTML = '';
  const l = myAnims();
  if (!l.length) ul.innerHTML = '<li class="muted">Nenhuma ainda. Anime e clique em "Salvar no banco".</li>';
  l.forEach((a, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${a.name.replace(/</g, '&lt;')}</span><small>${a.weapon} · ${a.clips.join('/')} quadros · ${a.groups.length} grupos</small><button class="ic" title="Aplicar">▶</button><button class="ic" title="Apagar">✕</button>`;
    const [ap, del] = li.querySelectorAll('button'); ap.onclick = () => applyMyAnim(i); del.onclick = () => deleteMyAnim(i);
    ul.appendChild(li);
  });
}

function runGen(name, opts, label) {
  if (!model) return;
  snapshot(label || name);
  const r = GEN[name](opts);
  updateAll();
  if (r !== undefined || ['recoil', 'bolt', 'trigger', 'grenade', 'idle', 'pump', 'boltAction', 'knife'].includes(name)) toast((label || name) + ' gerado', 'ok');
  return r;
}

// ---------------------------------------------------------------- exportação
function finalModel() {
  const surfaces = model.surfaces.map((s, si) => {
    const pos = [], nrm = [], movedAny = new Uint8Array(s.nv);
    for (let f = 0; f < model.nf; f++) { const r = computeSurface(si, f); pos.push(r.P); nrm.push(r.N); r.moved.forEach((m, i) => { if (m) movedAny[i] = 1; }); }
    return { tris: visibleTris(si), pos, nrm, nraw: s.nraw, moved: movedAny };
  });
  const tags = model.tags.map((row, f) => row.map((t, ti) => tagAt(f, ti)));
  return { surfaces, tags };
}
function exportMD3() { return buildMD3(model, finalModel()); }
function skinBlob(si, type = 'image/jpeg') {
  return new Promise(r => skins[si].result.toBlob(r, type, 0.93));
}
function charCredits() {
  return `Skin de personagem feita no CUBE MAKER (uso pessoal)\n\nModelo de jogador: S.A.S. de Darren "HitmanDaz[MT]" Pattenden, adaptado por makkE para o AssaultCube.\nA licença do modelo permite skins derivadas apenas para uso pessoal.\n\nSkins por apelido: ative em Configurações > Jogabilidade > Skins personalizadas de jogador.\n`;
}
function credits() {
  return `Arma modificada com CUBE MAKER v${VERSION} (cubemaker.kayquedeleon.app)\n\n` +
    (S.preset ? `Modelo da arma: ${S.preset.n} (${S.preset.c === 'Forja' ? 'criado na Forja' : S.preset.c}), modelado no CUBE MAKER\nMãos e animações originais do slot: makkE (Markus Bekel) — AssaultCube\n` : `Modelo e textura originais: makkE (Markus Bekel) — AssaultCube\n`) +
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
  if (S.mode === 'char') {
    const out = [{ path: charTarget(), data: await skinBlob(0) }, { path: 'packages/models/playermodels/custom/CUBEMAKER_LEIA-ME.txt', data: new Blob([charCredits()]) }];
    if (S.char.gear3d && GEAR && S.charMD2) out.push({ path: 'packages/models/playermodels/tris.md2', data: new Blob([await writePlayerMD2(S.charMD2, GEAR)]) });
    return out;
  }
  if (S.mode === 'prop') {
    if (S.prop.pickup) {
      const d = `packages/models/pickups/${S.prop.pickup}/`, fm = finalModel();
      return [{ path: d + 'tris.md3', data: new Blob([buildMD3(model, fm)]) }, { path: d + 'md3.cfg', data: new Blob([S.cfg]) },
        { path: d + 'skin.jpg', data: await skinBlob(0, 'image/jpeg') }, { path: d + 'CUBEMAKER_LEIA-ME.txt', data: new Blob([`${S.prop.n} — item do jogo feito no CUBE MAKER v${VERSION}.\nSubstitui o modelo "pickups/${S.prop.pickup}" (só a aparência; o efeito do item continua o mesmo).\nPara voltar ao original, apague esta pasta (na pasta home) ou use "Restaurar original" no CUBE MAKER.\n`]) }];
    }
    const d = `packages/models/mapmodels/${mapmodelPath()}/`;
    return [{ path: d + 'tris.md3', data: new Blob([exportMD3()]) }, { path: d + 'md3.cfg', data: new Blob([S.cfg]) }, { path: d + 'skin.jpg', data: await skinBlob(0, 'image/jpeg') },
      { path: d + 'CREDITOS.txt', data: new Blob([`${S.prop.n} — mapmodel criado no CUBE MAKER v${VERSION} (cubemaker.kayquedeleon.app)\n\nModelo e textura gerados proceduralmente no CUBE MAKER (obra original, livre para usar nos seus mapas).\n\nPara usar num mapa, acrescente ao .cfg do mapa (packages/maps/<mapa>.cfg):\n${mapmodelLine()}\n\nNo editor do AssaultCube, coloque com /newent mapmodel <número da linha>.\n`]) }];
  }
  const dir = `packages/models/weapons/${weaponDir()}/`;
  const out = [{ path: dir + 'tris_high.md3', data: new Blob([exportMD3()]) }, { path: dir + 'md3.cfg', data: new Blob([S.cfg]) }];
  for (let si = 0; si < skins.length; si++) {
    if (S.skinFiles[si].startsWith('../') && !S.modifiedSkins.has(si)) continue;   // não mexe em skins compartilhadas sem mudança
    out.push({ path: skinPath(si), data: await skinBlob(si, /\.png$/i.test(S.skinFiles[si]) ? 'image/png' : 'image/jpeg') });
  }
  out.push({ path: dir + 'CREDITOS_LICENCA.txt', data: new Blob([credits()]) });
  if (S.sound && S.sound.install && SLOTS[S.weapon] && !['knife', 'grenade'].includes(S.weapon)) {      // sons sintetizados da arma
    let cfgTxt = null;
    if (gameDir) for (const c of ['config/sounds.cfg', 'config/default_sounds.cfg', 'config/audio.cfg']) { const f = await readAt(c); if (f) { cfgTxt = await f.text(); break; } }
    const nm = soundNames(S.weapon, cfgTxt);
    if (nm) {
      const { shot, rel } = await soundPCM();
      out.push({ path: `packages/audio/${nm.shot}.ogg`, data: await toOgg(shot) });
      if (nm.reload) out.push({ path: `packages/audio/${nm.reload}.ogg`, data: await toOgg(rel) });
      S.sound.names = nm;
    }
  }
  return out;
}
// ================================================================ PUBLICAR NO CUBEFORGE
function cfKind() { return S.mode === 'prop' ? (S.prop && S.prop.pickup ? 'item' : 'mapmodel') : S.mode === 'char' ? 'char' : 'arma'; }
function cfDefaults() {
  const k = cfKind(), n = k === 'arma' ? ((S.preset && S.preset.n) || S.forgeName || 'Arma') : (S.prop ? S.prop.n : 'Modelo');
  const d = k === 'arma' ? ((S.presetDef && S.presetDef.d) || '') : ((S.propDef && S.propDef.d) || '');
  $('#cfName').value = n; $('#cfDesc').value = d; $('#cfDescEn').value = '';
}
function cfHowto(k) {
  if (k === 'mapmodel') return {
    pt: `1) Extraia o zip e copie a pasta "packages" para a pasta do AssaultCube (Documentos\\My Games\\AssaultCube\\v1.3 ou a pasta de instalação), juntando as pastas.\n2) No fim do .cfg do seu mapa (packages/maps/<mapa>.cfg), acrescente:\n   ${mapmodelLine()}\n3) No editor do jogo, mire no chão: /newent mapmodel <número da linha, contando do 0>`,
    en: `1) Extract the zip and copy the "packages" folder into your AssaultCube folder (Documents\\My Games\\AssaultCube\\v1.3 or the install folder), merging folders.\n2) At the end of your map's .cfg (packages/maps/<map>.cfg), add:\n   ${mapmodelLine()}\n3) In the editor, aim at the floor: /newent mapmodel <line number, counting from 0>` };
  if (k === 'item') return {
    pt: `1) Extraia o zip e copie a pasta "packages" para Documentos\\My Games\\AssaultCube\\v1.3 (a pasta home do jogo).\n2) Entre num mapa: o item "${S.prop.pickup}" aparece com o visual novo. O efeito do item não muda.\nPara desfazer, apague packages/models/pickups/${S.prop.pickup} da pasta home.`,
    en: `1) Extract the zip and copy the "packages" folder into Documents\\My Games\\AssaultCube\\v1.3 (the game's home folder).\n2) Join a map: the "${S.prop.pickup}" pickup shows the new look. Gameplay is unchanged.\nTo undo, delete packages/models/pickups/${S.prop.pickup} from the home folder.` };
  return {
    pt: `1) Faça uma cópia de segurança de packages/models/weapons/${weaponDir()} (e de packages/audio/weapon, se o pacote trouxer sons).\n2) Extraia o zip e copie a pasta "packages" para Documentos\\My Games\\AssaultCube\\v1.3 (a pasta home), juntando as pastas.\n3) Entre no jogo: a arma "${weaponDir()}" passa a usar este modelo. Para desfazer, apague os arquivos copiados da pasta home.`,
    en: `1) Back up packages/models/weapons/${weaponDir()} (and packages/audio/weapon if the pack has sounds).\n2) Extract the zip and copy the "packages" folder into Documents\\My Games\\AssaultCube\\v1.3 (the home folder), merging folders.\n3) In game, the "${weaponDir()}" weapon now uses this model. To undo, delete the copied files from the home folder.` };
}
async function cfPackage() {
  const k = cfKind();
  if (k === 'char') throw new Error('Skins e modelo dos personagens não podem ser publicados: o modelo do jogador do AssaultCube só permite uso pessoal (Darren Pattenden).');
  if (!model) throw new Error('Abra um modelo primeiro');
  const nome = $('#cfName').value.trim() || 'Modelo', descricao = $('#cfDesc').value.trim() || nome, descricao_en = $('#cfDescEn').value.trim();
  const meta = { kind: k, nome, descricao, descricao_en, anim: model.nf > 1, howto: cfHowto(k) };
  const T = packTexts(meta), files = (await packageFiles()).filter(f => !/CREDITOS\.txt$|LEIA-ME\.txt$/.test(f.path));
  const zip = new JSZip(), slug = slugify(nome), dir = `CUBEFORGE_${slug}/`;
  files.forEach(f => zip.file(dir + f.path, f.data));
  zip.file(dir + 'LEIA-ME.txt', T.pt); zip.file(dir + 'README_EN.txt', T.en); zip.file(dir + 'LICENCA.txt', T.lic);
  const shot = dataURLtoBlob(thumbnail(960, 600, true)); zip.file(dir + 'preview.png', shot);
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  if (blob.size > 25 * 1048576) throw new Error(`O pacote ficou com ${fmtSize(blob.size)}; o site aceita até 25 MB.`);
  const cat = k === 'arma' ? 'armas' : 'modelos';
  const licenca = k === 'arma' ? `${BRAND} · mãos de makkE · CC BY-NC-SA 2.5` : `${BRAND} · © ${new Date().getFullYear()} Kayque Deleon · uso livre no AC com crédito, sem revenda`;
  return { blob, shot, slug, cat, nome, descricao, descricao_en, licenca, tamanho: fmtSize(blob.size) };
}
// print menor para o card do site (limite de 2 MB)
async function cfCardImage(png) {
  try {
    const bmp = await createImageBitmap(png), c = document.createElement('canvas');
    c.width = bmp.width; c.height = bmp.height; c.getContext('2d').drawImage(bmp, 0, 0);
    const b = await new Promise(r => c.toBlob(r, 'image/webp', 0.88));
    if (b && b.size < 2e6) return [b, 'preview.webp'];
  } catch (e) { }
  return png.size < 2e6 ? [png, 'preview.png'] : [null, null];
}
// conta oficial do CubeForge
const cfKey = () => { try { return localStorage.getItem('cm_cf_key') || ''; } catch (e) { return ''; } };
function cfShowAccount(u) {
  const on = !!u;
  $('#cfWho').innerHTML = on ? `Conta: <b>@${u.username}</b> (oficial do CubeForge)` : 'Conta oficial do CubeForge: <b>não conectada</b>';
  $('#cfConnect').textContent = on ? 'Conectar de novo' : 'Conectar conta oficial';
  $('#cfLogout').hidden = !on;
  $('#cfPublish').disabled = !on;
}
async function cfUseKey(key, user) {
  const st = $('#cfStatus');
  try {
    const r = user ? { user } : await cfWhoami(key);
    try { localStorage.setItem('cm_cf_key', key); } catch (e) { }
    cfShowAccount(r.user); st.textContent = ''; return true;
  } catch (e) {
    if (e.code === 'bad_key' || e.code === 'not_official' || e.code === 'no_key') { try { localStorage.removeItem('cm_cf_key'); } catch (x) { } cfShowAccount(null); }
    st.textContent = '✖ ' + e.message; return false;
  }
}
async function cfPublish() {
  const st = $('#cfStatus'), key = cfKey();
  try {
    if (!key) throw new Error('Conecte a conta oficial do CubeForge primeiro.');
    st.textContent = 'Montando o pacote…';
    const P = await cfPackage();
    const [img, imgName] = await cfCardImage(P.shot);
    const description = [P.descricao, P.descricao_en ? 'EN: ' + P.descricao_en : '', P.licenca, 'Como instalar: veja o LEIA-ME.txt dentro do zip (README_EN.txt em inglês).'].filter(Boolean).join('\n\n').slice(0, 2000);
    st.textContent = `Enviando ${P.tamanho}…`;
    const r = await cfPublishPost({ key, category: P.cat, title: P.nome.slice(0, 80), description, file: P.blob, fileName: `CUBEFORGE_${P.slug}.zip`, image: img, imageName: imgName });
    st.innerHTML = `✔ ${r.updated ? 'Atualizado' : 'Publicado'} por <b>@${r.user}</b>: <b>${P.nome}</b> (${P.tamanho}). Já está no ar: <a href="${r.link}" target="_blank" rel="noopener">abrir no CubeForge</a>`;
    toast('Publicado no CubeForge', 'ok');
  } catch (e) {
    console.error(e); st.textContent = '✖ ' + e.message; toast(e.message, 'err');
    if (e.code === 'bad_key' || e.code === 'not_official') { try { localStorage.removeItem('cm_cf_key'); } catch (x) { } cfShowAccount(null); }
  }
}

// ================================================================ ESTÚDIO DE SOM
const reloadKind = () => S.preset && S.preset.id === 'mg42' ? 'belt' : S.weapon === 'shotgun' ? 'shells' : S.weapon === 'sniper' && !/enfield|smle/.test((S.preset || {}).id || '') ? 'stripper' : 'mag';
const reloadDur = () => { const c = (S.cfg.match(/md3anim\s+"gun reload"\s+\d+\s+(\d+)\s*(\d+)?/) || []); return c[1] ? Math.min(3, +c[1] / (+c[2] || S.fps || 25)) : 1.8; };
async function soundPCM() {
  const key = JSON.stringify([S.sound.p, reloadKind(), reloadDur()]);
  if (S.sound.cache && S.sound.cache.key === key) return S.sound.cache;
  S.sound.cache = { key, shot: await renderShot(S.sound.p), rel: await renderReload(S.sound.p, reloadDur(), reloadKind()) };
  return S.sound.cache;
}
function initSound(def) { S.sound = { p: soundPreset(def.slot, def.id), install: S.sound ? S.sound.install : true }; buildSoundUI(); }
const SOUND_LABELS = [['forca', 'Força (corpo grave)'], ['estalo', 'Estalo (brilho)'], ['eco', 'Eco / cauda'], ['mecanica', 'Mecânica (ferrolho)'], ['tom', 'Tom (calibre)'], ['dist', 'Distância']];
function buildSoundUI() {
  const box = $('#soundCtl'); if (!box) return;
  if (!S.sound) { box.innerHTML = '<p class="hint">Abra uma arma de fogo para criar o som dela.</p>'; return; }
  box.innerHTML = '';
  SOUND_LABELS.forEach(([k, n]) => {
    const row = document.createElement('div'); row.className = 'field slider';
    row.innerHTML = `<label>${n}</label><input type="range" min="0" max="1" step="0.01" value="${S.sound.p[k]}"><span>${Math.round(S.sound.p[k] * 100)}</span>`;
    const r = row.querySelector('input'); r.oninput = () => { S.sound.p[k] = +r.value; row.querySelector('span').textContent = Math.round(r.value * 100); };
    box.appendChild(row);
  });
  $('#soundInstall').checked = S.sound.install;
  $('#soundKind').textContent = { mag: 'troca de carregador', belt: 'troca de fita (tampa abrindo)', shells: 'cartucho por cartucho', stripper: 'pente de lâmina' }[reloadKind()] + ` · ${reloadDur().toFixed(1)} s`;
}
window.__cmShot = null; window.__cmReload = null;
async function armGameSounds() {
  if (!S.sound) { window.__cmShot = window.__cmReload = null; return; }
  const { shot, rel } = await soundPCM(); window.__cmShot = () => play(shot); window.__cmReload = () => play(rel);
}
// cópia fiel dos arquivos originais carregados
async function originalFiles() {
  if (S.mode === 'char') {                                   // a skin original que estava nesse caminho (se veio da pasta aberta)
    const rel = charTarget().replace('packages/models/playermodels/', ''), f = charFiles && charFiles.get(rel);
    const o = f ? [{ path: charTarget(), data: f }] : [];
    if (S.charMD2) o.push({ path: 'packages/models/playermodels/tris.md2', data: new Blob([S.charMD2]) });
    return o;
  }
  if (S.mode === 'prop') return [];                          // mapmodel novo: não substitui nada do jogo
  if (S.acOriginal && S.acOriginal.files) return S.acOriginal.files;
  if (S.preset && SLOTS[S.weapon]) {                       // projeto reaberto de um modelo do arsenal: busca os originais do slot
    try {
      const b = `weapons/${S.weapon}/`, out = [{ path: `packages/models/weapons/${S.weapon}/tris_high.md3`, data: await fetchBlob(b + 'tris_high.md3') }, { path: `packages/models/weapons/${S.weapon}/md3.cfg`, data: await fetchBlob(b + 'md3.cfg') }, { path: `packages/models/weapons/${S.weapon}/skin_weapon.jpg`, data: await fetchBlob(b + 'skin_weapon.jpg') }];
      S.acOriginal = { files: out }; return out;
    } catch (e) { return []; }
  }
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
  if (S.mode === 'char') { const blob = await zip.generateAsync({ type: 'blob' }); download('cubemaker_personagem.zip', blob); toast('Pacote .zip exportado', 'ok'); return; }
  if (S.mode === 'prop') {
    zip.file('LEIA-ME_CUBEMAKER.txt', `Como instalar o mapmodel "${S.prop.n}":\n1) Extraia este zip na pasta home do AssaultCube (Documentos\\My Games\\AssaultCube\\v1.3\\)\n   ou na pasta de instalação.\n2) No .cfg do seu mapa (packages/maps/<mapa>.cfg), acrescente no fim:\n   ${mapmodelLine()}\n3) No editor do jogo, mire no chão e use /newent mapmodel <número dessa linha, contando do 0>.\n`);
    download(`cubemaker_mapmodel_${S.prop.id}.zip`, await zip.generateAsync({ type: 'blob' })); toast('Pacote .zip do mapmodel exportado', 'ok'); return;
  }
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
  for (const o of await originalFiles()) {
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
    if (S.mode === 'char') $('#charPath').textContent = charTarget();
    const log = { acao: 'instalar', quando: new Date().toISOString(), arma: weaponDir(), pasta: gameDir.name, originais: [], backup: [], gravados: [] };
    await backupBefore(files.map(f => f.path), stamp, log);
    for (const f of files) { await writeAt(f.path, f.data); log.gravados.push(f.path); }
    if (log.backup.length) log.pastaBackup = `${BACKUP}/${stamp}`;
    await appendLog(log);
    $('#gameLast').textContent = `Última instalação: ${weaponDir()} · ${stamp.replace('_', ' ')}`;
    if (S.mode === 'prop' && S.prop.pickup) toast(`✔ Item "${S.prop.pickup}" substituído no jogo (backup em ${BACKUP}). Entre num mapa para ver.`, 'ok');
    else if (S.mode === 'prop') toast(`✔ Mapmodel instalado em packages/models/mapmodels/${mapmodelPath()}. Agora acrescente a linha ao .cfg do mapa.`, 'ok');
    else toast(`✔ ${weaponDir()} instalada (${files.length} arquivos). Backup em ${BACKUP}. Reinicie o mapa no jogo.`, 'ok');
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
    global: S.global, tagOffset: S.tagOffset, modified: [...S.modifiedSkins], root: S.root, prims: S.prims, fx: S.fx, decals: S.decals, preset: S.preset, presetM: S.presetM, rigid: S.rigid, forge: S.forge, forgeName: S.forgeName, texK: S.texK, prop: S.prop
  };
  download(`${S.weapon}.cubemaker`, new Blob([JSON.stringify(proj)], { type: 'application/json' }));
  toast('Projeto salvo', 'ok');
}
async function openProject(text) {
  const p = JSON.parse(text);
  if (p.app !== 'CUBE MAKER') throw new Error('Arquivo não é um projeto CUBE MAKER');
  const nOrig = p.skins.length - (p.prims || []).length;
  const imgs = await Promise.all(p.skins.slice(0, nOrig).map(s => loadImage(s.orig)));
  const overlays = await Promise.all(p.skins.map(s => loadImage(s.overlay)));
  await loadWeapon({ md3Buf: b64ToBuf(p.md3), cfgText: p.cfg, skinImages: imgs, weaponName: p.weapon, project: { ...p, overlays } });
}
function applyProject(p) {
  if (p.nf && p.nf !== model.nf) setFrameCount(p.nf, true);
  S.islandMat = p.islandMat.map(a => new Map(a));
  S.groups = p.groups.map(g => ({ ...g, isl: new Set(g.isl), s: Array.isArray(g.s) ? g.s : [g.s, g.s, g.s] }));
  S.gi = S.groups.length ? 0 : -1;
  S.global = { ...S.global, ...p.global }; S.tagOffset = p.tagOffset || [0, 0, 0];
  if (p.root) S.root = p.root;
  if (p.forge) { S.forge = p.forge; S.forgeName = p.forgeName; }
  if (p.preset) S.preset = p.preset; if (p.presetM) S.presetM = p.presetM; if (p.rigid) S.rigid = p.rigid;
  if (p.fx) S.fx = { ...S.fx, ...p.fx }; S.decals = p.decals || []; if (p.texK) S.texK = p.texK;
  if (p.prop) { S.prop = p.prop; S.mode = 'prop'; document.body.dataset.mode = 'prop'; }
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
    if (!f && s.name === 'hands' && await defaultHands()) { imgs.push(await loadImage(DEFAULT_HANDS)); srcs.push(dataURLtoBlob(DEFAULT_HANDS)); continue; }
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
// ---------------------------------------------------------------- armas embutidas (originais do AC)
const WEAPONS = {
  knife:   { n: 'Faca', ac: 'knife', ww2: 'Baioneta / faca de trincheira', alt: 'M3 Trench Knife · Kampfmesser 42' },
  pistol:  { n: 'Pistola', ac: 'pistol', ww2: 'Luger P08 · Colt 1911', alt: 'Walther P38 · Tokarev TT-33' },
  carbine: { n: 'Carabina', ac: 'carbine', ww2: 'M1 Carbine', alt: 'Gewehr 43 · SVT-40' },
  shotgun: { n: 'Escopeta', ac: 'shotgun', ww2: 'Winchester 1897 "Trench"', alt: 'escopeta de trincheira' },
  subgun:  { n: 'Submetralhadora', ac: 'subgun', ww2: 'MP40', alt: 'Thompson M1A1 · PPSh-41 · Sten' },
  assault: { n: 'Fuzil de assalto', ac: 'assault', ww2: 'StG 44', alt: 'BAR M1918 · FG 42' },
  sniper:  { n: 'Sniper', ac: 'sniper', ww2: 'Kar98k + ZF39', alt: 'Mosin-Nagant PU · Springfield M1903' },
  grenade: { n: 'Granada', ac: 'grenade', ww2: 'Stielhandgranate 24', alt: 'Mk 2 "abacaxi" · RGD-33' },
};
let DEFAULT_HANDS = null;
async function fetchBuf(url) { const r = await fetch(url); if (!r.ok) throw new Error('Não encontrei ' + url); return r.arrayBuffer(); }
async function fetchBlob(url) { const r = await fetch(url); if (!r.ok) throw new Error('Não encontrei ' + url); return r.blob(); }
const blobToURL = b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });
async function loadBundled(key) {
  const base = `weapons/${key}/`;
  try {
    const [md3Buf, cfgText] = await Promise.all([fetchBuf(base + 'tris_high.md3'), fetch(base + 'md3.cfg').then(r => r.ok ? r.text() : null)]);
    const m = parseMD3(md3Buf), cfg = parseCfg(cfgText || '');
    const imgs = [], srcs = [];
    for (const s of m.surfaces) {
      const rel = cfg.skins[s.name] || 'skin_weapon.jpg';
      const url = new URL(rel, new URL(base, location.href)).href;
      try { const b = await fetchBlob(url); srcs.push(b); imgs.push(await loadImage(await blobToURL(b))); }
      catch (e) { srcs.push(null); imgs.push(null); }
    }
    await loadWeapon({ md3Buf, cfgText, skinImages: imgs, weaponName: key, skinSources: srcs });
    goStep(2);
  } catch (e) {
    toast(location.protocol === 'file:' ? 'Abrindo direto do disco o navegador bloqueia os modelos embutidos. Use cubemaker.kayquedeleon.app ou "Abrir pasta de arma".' : e.message, 'err');
  }
}
async function defaultHands() {
  if (DEFAULT_HANDS) return DEFAULT_HANDS;
  try { DEFAULT_HANDS = await blobToURL(await fetchBlob('weapons/knife/skin_hands.jpg')); } catch (e) { }
  return DEFAULT_HANDS;
}
async function loadDemo() { return loadBundled('subgun'); }


// ================================================================ AUTO-RIG (armas originais do AC)
// grupos prontos por arma: peças numeradas na ordem de computeIslands (piece k), conferidas em renders
const RIGS = {
  subgun: { bytes: 103408, groups: [
    { name: 'Carregador', surf: 'weapon', pieces: [2] }, { name: 'Ferrolho', surf: 'weapon', pieces: [6] },
    { name: 'Gatilho', surf: 'weapon', pieces: [18], pivot: 'top' }, { name: 'Cano', surf: 'weapon', pieces: [15] },
    { name: 'Mão', surf: 'hands', pieces: [0], parent: 'Carregador' }] },
  assault: { bytes: 116728, groups: [
    { name: 'Carregador', surf: 'weapon', pieces: [10] }, { name: 'Ferrolho', surf: 'weapon', pieces: [9] },
    { name: 'Gatilho', surf: 'weapon', pieces: [7], pivot: 'top' }, { name: 'Cano', surf: 'weapon', pieces: [1, 15] },
    { name: 'Mão', surf: 'hands', pieces: [0], parent: 'Carregador' }] },
  sniper: { bytes: 228676, groups: [
    { name: 'Carregador', surf: 'weapon', pieces: [2] }, { name: 'Mira', surf: 'weapon', pieces: [3, 4, 5, 6, 7, 8, 9] },
    { name: 'Cano', surf: 'weapon', pieces: [0] }, { name: 'Mão', surf: 'hands', pieces: [0], parent: 'Carregador' }],
    prims: [{ type: 'cyl', name: 'bolt', group: 'Ferrolho', size: [0.3, 3.2], pos: [7.5, 11.2, -6.3], rot: [0, 0, 90], pivot: [5.5, 11.2, -6.6], mat: 'acoGasto' }] },
  carbine: { bytes: 350988, groups: [
    { name: 'Carregador', surf: 'weapon', pieces: [2] }, { name: 'Carregador B', surf: 'weapon_2', pieces: [2], parent: 'Carregador' },
    { name: 'Cano', surf: 'weapon', pieces: [0] }, { name: 'Mão', surf: 'hands', pieces: [0], parent: 'Carregador' }],
    prims: [{ type: 'box', name: 'bolt', group: 'Ferrolho', size: [0.5, 1.6, 0.55], pos: [7.6, 15.5, -6.3], mat: 'acoOxidado' }] },
  shotgun: { bytes: 82868, groups: [
    { name: 'Telha', surf: 'weapon', pieces: [11] }, { name: 'Cano', surf: 'weapon', pieces: [0] },
    { name: 'Mão', surf: 'hands', pieces: [0], parent: 'Telha' }] },
  pistol: { bytes: 86988, groups: [
    { name: 'Ferrolho', surf: 'weapon', pieces: [1, 3, 7, 8] }, { name: 'Carregador', surf: 'weapon', pieces: [2] },
    { name: 'Gatilho', surf: 'weapon', pieces: [6], pivot: 'top' }] },
  knife: { bytes: 102732, groups: [{ name: 'Lâmina', surf: 'weapon', pieces: [1] }, { name: 'Cabo', surf: 'weapon', pieces: [0, 2, 3] }] },
  grenade: { bytes: 257924, groups: [{ name: 'Pino', surf: 'weapon', pieces: [0, 4] }, { name: 'Alavanca', surf: 'weapon', pieces: [3] }] },
};
function rigFor() {
  const n = S.originalMD3 && S.originalMD3.byteLength;
  return Object.entries(RIGS).find(([k, r]) => r.bytes === n) || null;
}
function applyRig({ silent = false } = {}) {
  if (!model) return false;
  const found = rigFor(); if (!found) { if (!silent) toast('Auto-rig só conhece as 8 armas originais do AC', 'warn'); return false; }
  const [key, R] = found;
  if (!silent) snapshot('auto-rig');
  const made = [];
  R.groups.forEach(G => {
    if (groupByName(new RegExp('^' + G.name + '$', 'i')) >= 0) return;
    const si = model.surfaces.findIndex(s => s.name === G.surf); if (si < 0) return;
    const s = model.surfaces[si], order = [...new Set(s.piece)];
    const isl = new Set(); G.pieces.forEach(k => { const p = order[k]; for (let i = 0; i < s.nIsl; i++) if (s.piece[i] === p) isl.add(i); });
    if (!isl.size) return;
    S.groups.forEach(g => { if (g.si === si) isl.forEach(i => g.isl.delete(i)); });
    const c = [0, 0, 0], mx = [-1e9, -1e9, -1e9]; let n = 0;
    isl.forEach(i => s.islVerts[i].forEach(v => { for (let q = 0; q < 3; q++) { c[q] += s.pos[0][v * 3 + q]; mx[q] = Math.max(mx[q], s.pos[0][v * 3 + q]); } n++; }));
    const pivot = c.map(v => +(v / n).toFixed(2)); if (G.pivot === 'top') pivot[2] = +mx[2].toFixed(2);
    S.groups.push({ name: G.name, si, isl, pivot, t: Z3(), r: Z3(), s: [1, 1, 1], hidden: false, keys: {}, parent: -1, rig: true });
    made.push(G.name);
  });
  (R.prims || []).forEach(P => {
    if (groupByName(new RegExp('^' + P.group + '$', 'i')) >= 0) return;
    const { gi } = addPrimitive({ type: P.type, name: P.name, size: P.size, pos: P.pos, rot: P.rot || [0, 0, 0], mat: P.mat }, { silent: true });
    const g = S.groups[gi]; g.name = P.group; g.prim = false; g.rig = true; if (P.pivot) g.pivot = [...P.pivot];
    made.push(P.group + ' (peça nova)');
  });
  R.groups.forEach(G => { if (!G.parent) return; const c = groupByName(new RegExp('^' + G.name + '$', 'i')), p = groupByName(new RegExp('^' + G.parent + '$', 'i')); if (c >= 0 && p >= 0) S.groups[c].parent = p; });
  S.gi = S.groups.length ? 0 : -1;
  updateAll();
  if (!silent || made.length) toast(`Auto-rig (${key}): ${made.join(', ') || 'grupos já existiam'}`, 'ok');
  return true;
}
// a arma já vem com animação nos quadros (faca, granada, escopeta)?
function hasBakedAnim() {
  if (model.bakedCache !== undefined) return model.bakedCache;
  const n0 = model.nfOrig || model.nf;
  model.bakedCache = model.surfaces.some(s => !s.generated && s.pos.slice(1, n0).some(P => P.some((v, i) => Math.abs(v - s.pos[0][i]) > 0.05)));
  return model.bakedCache;
}


// ================================================================ ARSENAL (modelos prontos WWI/WWII)
const SLOTS = {
  subgun: { k: 0.044, T: [5.06, 12.8, -7.28] }, assault: { k: 0.044, T: [5.6, 11.4, -7.0] },
  sniper: { k: 0.044, T: [5.4, 12.0, -7.3] }, carbine: { k: 0.044, T: [5.4, 12.0, -7.2] },
  shotgun: { k: 0.044, T: [5.0, 12.5, -6.8] }, pistol: { k: 0.046, T: [5.3, 17.5, -5.6] },
  knife: { k: 0.05, A: [5.6, 14.9, -9.3], D: [-0.097, 0.009, 0.995], U: [0, 1, 0] },
  grenade: { k: 0.048, A: [4.4, 14.8, -8.8], D: [-0.04, 0.45, 0.89], U: [0, 1, 0] },
};
const SLOT_NAMES = { grenade: 'Granadas', knife: 'Facas e baionetas', pistol: 'Pistolas e revólveres', subgun: 'Submetralhadoras', assault: 'Fuzis de assalto / automáticos', sniper: 'Fuzis de ferrolho (sniper)', carbine: 'Carabinas e semiautomáticos', shotgun: 'Escopetas' };
function slotBasis(slot, m0) {
  const S0 = SLOTS[slot], V = THREE.Vector3;
  let O, Y, Zh;
  if (S0.T) {
    O = new V(...S0.T);
    const mz = m0.tagNames.length ? new V(...m0.tags[0][0].origin) : O.clone().add(new V(0, 30, 0));
    Y = mz.clone().sub(O).normalize(); Zh = new V(0, 0, 1);
  } else { O = new V(...S0.A); Y = new V(...S0.D).normalize(); Zh = new V(...S0.U); }
  const Z = Zh.clone().sub(Y.clone().multiplyScalar(Zh.dot(Y))).normalize(), X = new V().crossVectors(Y, Z).normalize();
  const M = new THREE.Matrix4().makeBasis(X.multiplyScalar(S0.k), Y.multiplyScalar(S0.k), Z.multiplyScalar(S0.k)).setPosition(O);
  return M;
}
// movimento rígido de cada quadro da arma original (faca e granada já vêm animadas)
function rigidFrames(surf) {
  const P0 = surf.pos[0], n = surf.nv, V = THREE.Vector3;
  const pt = (P, i) => new V(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
  let a = 0, b = 0, c = 0, best = 0;
  for (let i = 0; i < n; i++) { const d = pt(P0, i).distanceTo(pt(P0, a)); if (d > best) { best = d; b = i; } }
  best = 0; const A = pt(P0, a), Bv = pt(P0, b);
  for (let i = 0; i < n; i++) { const ar = new V().crossVectors(Bv.clone().sub(A), pt(P0, i).sub(A)).length(); if (ar > best) { best = ar; c = i; } }
  const basis = P => { const pa = pt(P, a), e1 = pt(P, b).sub(pa).normalize(), w = pt(P, c).sub(pa); const e2 = w.sub(e1.clone().multiplyScalar(w.dot(e1))).normalize(); return new THREE.Matrix4().makeBasis(e1, e2, new V().crossVectors(e1, e2)).setPosition(pa); };
  const B0inv = basis(P0).invert();
  return surf.pos.map(P => best < 1e-6 ? new THREE.Matrix4() : basis(P).multiply(B0inv));
}
async function loadPreset(id) {
  const def = typeof id === 'string' ? ARSENAL.find(a => a.id === id) : id; if (!def) return;
  const slot = def.slot, base = `weapons/${slot}/`;
  try {
    const [md3Buf0, cfg0] = await Promise.all([fetchBuf(base + 'tris_high.md3'), fetch(base + 'md3.cfg').then(r => r.ok ? r.text() : '')]);
    const m0 = parseMD3(md3Buf0), cfgP = parseCfg(cfg0);
    const Bp = buildPreset(def, { soft: S.soft !== false, W: S.tex2k ? 2048 : 1024, H: S.tex2k ? 1024 : 512 }), M0 = slotBasis(slot, m0), R0 = new THREE.Matrix3().getNormalMatrix(M0);
    const wIdx = m0.surfaces.findIndex(s => s.name === 'weapon'), ow = m0.surfaces[wIdx];
    const frames = rigidFrames(ow);
    const nv = Bp.pos.length / 3, v = new THREE.Vector3();
    const surf = { name: 'weapon', flags: 0, nv, ntri: Bp.tris.length / 3, shaders: ow.shaders, tris: new Int32Array(Bp.tris), st: new Float32Array(Bp.uv), pos: [], nrm: [], nraw: [] };
    frames.forEach(F => {
      const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), NR = new Uint16Array(nv), RF = new THREE.Matrix3().getNormalMatrix(F);
      for (let i = 0; i < nv; i++) {
        v.set(Bp.pos[i * 3], Bp.pos[i * 3 + 1], Bp.pos[i * 3 + 2]).applyMatrix4(M0).applyMatrix4(F); P.set([v.x, v.y, v.z], i * 3);
        v.set(Bp.nrm[i * 3], Bp.nrm[i * 3 + 1], Bp.nrm[i * 3 + 2]).applyMatrix3(R0).applyMatrix3(RF).normalize(); N.set([v.x, v.y, v.z], i * 3); NR[i] = encodeNormal(v.x, v.y, v.z);
      }
      surf.pos.push(P); surf.nrm.push(N); surf.nraw.push(NR);
    });
    const surfaces = []; let wi = -1;
    m0.surfaces.forEach((s, i) => { if (s.name === 'weapon') { if (wi < 0) { wi = surfaces.length; surfaces.push(surf); } } else surfaces.push(s); });
    const tags = m0.tags.map((row, f) => row.map(t => {
      if (!Bp.spec.muzzle) return t;
      const o = new THREE.Vector3(0, Bp.spec.muzzle, 0).applyMatrix4(M0).applyMatrix4(frames[f]);
      return { origin: o.toArray(), axis: t.axis };
    }));
    const m1 = { ...m0, surfaces, tags };
    const buf = buildMD3(m1, { surfaces: surfaces.map(s => ({ tris: s.tris, pos: s.pos, nrm: s.nrm, nraw: s.nraw })), tags });
    // skins
    const imgs = [], srcs = [], files = [{ path: `packages/models/weapons/${slot}/tris_high.md3`, data: new Blob([md3Buf0]) }, { path: `packages/models/weapons/${slot}/md3.cfg`, data: new Blob([cfg0]) }];
    for (const s of parseMD3(buf).surfaces) {
      const rel = cfgP.skins[s.name] || 'skin_weapon.jpg', url = new URL(rel, new URL(base, location.href)).href;
      const blob = await fetchBlob(url).catch(() => null);
      const path = 'packages/models/weapons/' + new URL(rel, 'http://x/' + slot + '/').pathname.slice(1);
      if (blob) files.push({ path, data: blob });
      if (s.name === 'weapon') { imgs.push(atlasCanvas(Bp)); srcs.push(null); }
      else { imgs.push(blob ? await loadImage(await blobToURL(blob)) : null); srcs.push(blob); }
    }
    await loadWeapon({ md3Buf: buf, cfgText: cfg0, skinImages: imgs, weaponName: slot, skinSources: srcs, origin: { files } });
    // materiais, grupos, mãos
    const s = model.surfaces[wi], partOfIsl = s.islVerts.map(vs => Bp.vpart[vs[0]]);
    S.islandMat[wi] = new Map(partOfIsl.map((p, i) => [i, Bp.parts[p].mat]));
    const gmap = new Map();
    partOfIsl.forEach((p, i) => { const g = Bp.parts[p].g; if (!g) return; if (!gmap.has(g)) gmap.set(g, { isl: new Set(), pivot: null }); gmap.get(g).isl.add(i); if (Bp.parts[p].pivot && !gmap.get(g).pivot) gmap.get(g).pivot = Bp.parts[p].pivot; });
    gmap.forEach((G, name) => {
      let pivot;
      if (G.pivot) pivot = new THREE.Vector3(...G.pivot).applyMatrix4(M0).applyMatrix4(frames[0]).toArray();
      else { const c = [0, 0, 0]; let n = 0; G.isl.forEach(i => s.islVerts[i].forEach(vv => { for (let q = 0; q < 3; q++) c[q] += s.pos[0][vv * 3 + q]; n++; })); pivot = c.map(x => x / n); }
      S.groups.push({ name, si: wi, isl: G.isl, pivot: pivot.map(x => +x.toFixed(2)), t: Z3(), r: Z3(), s: [1, 1, 1], hidden: false, keys: {}, parent: -1, rig: true });
    });
    const hi = model.surfaces.findIndex(x => x.name === 'hands');
    if (hi >= 0 && Bp.spec.support && ['subgun', 'assault', 'sniper', 'carbine', 'shotgun'].includes(slot)) {
      // O braço inteiro (palma + antebraço) vai junto: gira a partir do cotovelo até a palma chegar no apoio
      // da arma nova. Mover só a palma soltava a mão do pulso.
      const hs = model.surfaces[hi], order = [...new Set(hs.piece)], isl = new Set(), P0 = hs.pos[0];
      for (let i = 0; i < hs.nIsl; i++) isl.add(i);
      const palm = []; for (let i = 0; i < hs.nIsl; i++) if (hs.piece[i] === order[0]) palm.push(...hs.islVerts[i]);
      const all = []; isl.forEach(i => all.push(...hs.islVerts[i]));
      const avg = vs => { const c = new THREE.Vector3(); vs.forEach(vv => c.add(new THREE.Vector3(P0[vv * 3], P0[vv * 3 + 1], P0[vv * 3 + 2]))); return c.divideScalar(Math.max(1, vs.length)); };
      const C = avg(palm), yMin = Math.min(...all.map(vv => P0[vv * 3 + 1]));
      const E = avg(all.filter(vv => P0[vv * 3 + 1] < yMin + 2.5));          // cotovelo: ponta de trás do antebraço (fora da tela)
      const T = new THREE.Vector3(...Bp.spec.support).applyMatrix4(M0);
      const a = C.clone().sub(E), b = T.clone().sub(E), q = new THREE.Quaternion().setFromUnitVectors(a.clone().normalize(), b.clone().normalize());
      const eu = new THREE.Euler().setFromQuaternion(q), shift = b.clone().normalize().multiplyScalar(b.length() - a.length());
      const par = groupByName(slot === 'shotgun' ? /^telha$/i : /^carregador$/i);
      S.groups.push({ name: 'Mão', si: hi, isl, pivot: E.toArray().map(x => +x.toFixed(3)), t: shift.toArray().map(x => +x.toFixed(3)), r: [eu.x, eu.y, eu.z].map(x => +(x / D2R).toFixed(3)), s: [1, 1, 1], hidden: false, keys: {}, parent: par, rig: true });
    }
    S.gi = S.groups.length ? 0 : -1;
    Object.assign(S.global, { wear: def.hd ? 0.14 : 0.4, age: 0.25, dirt: 0.25 }); S.fx = { ...S.fx, cavity: 0.4, scratches: 0, rust: 0, dust: 0, burn: 0, blood: 0, ...(def.fx || {}) };
    if (def.fx && def.fx.dirt != null) S.global.dirt = def.fx.dirt;
    S.presetDef = def; S.preset = { id: def.id, n: def.n, war: def.war, c: def.c }; S.presetM = M0.toArray(); S.forge = def.forge ? JSON.parse(JSON.stringify(def.forge)) : null; S.forgeName = def.forge ? def.n : '';
    S.rigid = frames.some(F => !F.equals(new THREE.Matrix4())) ? frames.map(F => F.toArray()) : null;
    S.texK = clamp(1.2 / Bp.density, 0.4, 2.5);
    applyPresetAnim(def, true); initSound(def);
    model.surfaces.forEach((_, i) => S.modifiedSkins.add(i));
    skins.forEach((_, i) => composite(i));
    updateAll(); if (!def.forge || !S.forgeKeepCam) frameCamera('orbit'); S.forgeKeepCam = false; goStep(2); updateForgeUI();
    toast(`${def.n} pronto no lugar de "${slot}" — grupos: ${[...gmap.keys(), ...(hi >= 0 && Bp.spec.support ? ['Mão'] : [])].join(', ') || '—'}`, 'ok');
  } catch (e) {
    console.error(e);
    toast(location.protocol === 'file:' ? 'Abra pelo site (cubemaker.kayquedeleon.app) para usar o arsenal' : 'Falha ao montar o modelo: ' + e.message, 'err');
  }
}
// ================================================================ MAPMODELS (cenário, veículos, aviões…)
const MM_K = 0.05;                                   // mm → unidades MD3 (≈ 50 por metro, calibrado com os mapmodels do AC)
const propVars = (def, v = {}) => Object.fromEntries(Object.entries(def.vars || {}).map(([k, o]) => [k, v[k] ?? o.v]));
async function loadProp(id, vars, keepCam) {
  const def = typeof id === 'string' ? propDef(id) : id; if (!def) return;
  const v = propVars(def, vars);
  try {
    const Bp = buildPreset({ build: () => def.build(v) }, { W: S.tex2k ? 2048 : 1024, H: S.tex2k ? 2048 : 1024, ground: true, soft: def.cat === 'item' && def.soft !== false });
    const nv = Bp.pos.length / 3, mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (let i = 0; i < nv; i++) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], Bp.pos[i * 3 + k]); mx[k] = Math.max(mx[k], Bp.pos[i * 3 + k]); }
    const off = [-(mn[0] + mx[0]) / 2, -(mn[1] + mx[1]) / 2, -mn[2]];
    let k = MM_K; const ext = Math.max(...[0, 1].map(q => (mx[q] - mn[q]) / 2), mx[2] - mn[2]) * k;
    let scalePct = 100; if (ext > 500) { scalePct = Math.ceil(ext / 500 * 100); k = k * 100 / scalePct; }   // MD3 só guarda até ±512
    const P = new Float32Array(nv * 3), N = new Float32Array(Bp.nrm), NR = new Uint16Array(nv);
    let rad = 0;
    for (let i = 0; i < nv; i++) {
      for (let q = 0; q < 3; q++) P[i * 3 + q] = (Bp.pos[i * 3 + q] + off[q]) * k;
      NR[i] = encodeNormal(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]); rad = Math.max(rad, Math.hypot(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]));
    }
    const surf = { name: 'mapmodel', flags: 0, nv, ntri: Bp.tris.length / 3, shaders: [{ name: 'skin.jpg', index: 0 }], tris: new Int32Array(Bp.tris), st: new Float32Array(Bp.uv), pos: [P], nrm: [N], nraw: [NR] };
    const m0 = { version: 15, name: 'cubemaker_' + def.id, flags: 0, nf: 1, frames: [{ min: [0, 0, 0], max: [0, 0, 0], origin: [0, 0, 0], radius: rad, name: 'frame0' }], tagNames: [], tags: [[]], surfaces: [surf] };
    const buf = buildMD3(m0, { surfaces: [{ tris: surf.tris, pos: surf.pos, nrm: surf.nrm, nraw: surf.nraw }], tags: [[]] });
    const dm = [(mx[0] - mn[0]) / 1000, (mx[1] - mn[1]) / 1000, (mx[2] - mn[2]) / 1000];
    const mmLine = def.mm || `${Math.max(0, Math.round(Math.max(dm[0], dm[1]) / 0.6))} ${Math.max(1, Math.round(dm[2] / 0.3))} 0 0`;
    const cfg = propCfg(def, scalePct, mmLine);
    await loadWeapon({ md3Buf: buf, cfgText: cfg, skinImages: [atlasCanvas(Bp)], weaponName: 'mapmodel_' + def.id, origin: { files: [] } });
    S.mode = 'prop'; document.body.dataset.mode = 'prop'; S.propDef = def;
    S.prop = { id: def.id, n: def.n, cat: def.cat, war: def.war, pickup: def.pickup || null, vars: v, mm: mmLine, dims: dm.map(x => +x.toFixed(2)), scale: scalePct };
    S.texK = clamp(0.5 / Bp.density, 0.3, 12);
    S.root = { name: 'Modelo inteiro', pivot: [0, 0, 0], keys: {} };
    // materiais por peça e grupos animáveis
    const s = model.surfaces[0], partOfIsl = s.islVerts.map(vs => Bp.vpart[vs[0]]);
    S.islandMat[0] = new Map(partOfIsl.map((p, i) => [i, Bp.parts[p].mat]));
    S.groups = [];
    const gmap = new Map();
    partOfIsl.forEach((p, i) => { const g = Bp.parts[p].g; if (!g) return; if (!gmap.has(g)) gmap.set(g, new Set()); gmap.get(g).add(i); });
    gmap.forEach((isl, name) => {
      const c = [0, 0, 0]; let n = 0, maxY = -1e9; const verts = [];
      isl.forEach(i => s.islVerts[i].forEach(vv => { verts.push(vv); for (let q = 0; q < 3; q++) c[q] += s.pos[0][vv * 3 + q]; n++; maxY = Math.max(maxY, s.pos[0][vv * 3 + 1]); }));
      const pivot = c.map(x => x / n); if (def.anim && def.anim.pivot === 'maxY') pivot[1] = maxY;
      S.groups.push({ name, si: 0, isl, pivot: pivot.map(x => +x.toFixed(2)), t: Z3(), r: Z3(), s: [1, 1, 1], hidden: false, keys: {}, parent: -1, rig: true });
    });
    if (def.anim && def.anim.chain) S.groups.forEach((g, i) => { if (i > 0) g.parent = i - 1; });
    applyPropAnim(def);
    S.gi = S.groups.length ? 0 : -1;
    Object.assign(S.global, { wear: 0.35, age: 0.2, dirt: 0.3 });
    S.fx = { ...S.fx, cavity: 0.35, scratches: 0.15, rust: 0, dust: 0.15, burn: 0, blood: 0, ...(def.fx || {}) };
    if (def.fx && def.fx.dirt != null) S.global.dirt = def.fx.dirt;
    S.modifiedSkins.add(0); composite(0);
    updateAll(); if (!keepCam) frameCamera('orbit'); goStep(2); updatePropUI();
    toast(`${def.n} · ${dm[0].toFixed(1)} × ${dm[1].toFixed(1)} × ${dm[2].toFixed(1)} m · ${surf.ntri} triângulos`, 'ok');
  } catch (e) { console.error(e); toast('Falha ao montar o mapmodel: ' + e.message, 'err'); }
}
const ascii = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/→/g, '->').replace(/[^\x20-\x7e]/g, '');
function propCfg(def, scalePct, mmLine, nAnim = 0, fps = 0) {
  return [`// ${ascii(def.n)} - mapmodel feito no CUBE MAKER`, 'md3load tris.md3', 'md3skin mapmodel skin.jpg', ...(nAnim > 1 ? [`md3anim "mapmodel" 0 ${nAnim} ${fps}`] : []),
    ...(scalePct !== 100 ? [`mdlscale ${scalePct}`] : []), `mdlshadowdist 12`,
    `mdlattribute keywords "${{ fort: 'military', veic: 'military', aviao: 'military', art: 'military', obj: 'military', cen: 'rural', sold: 'military' }[def.cat] || 'military'}"`,
    `mdlattribute desc "${ascii(def.n).replace(/"/g, '')}"`, 'mdlattribute author cubemaker', 'mdlattribute distribution custom', `mdlattribute defaults "${mmLine}"`, ''].join('\n');
}
function applyPropAnim(def) {
  const A = def.anim;
  if (!A) { setFrameCount(1, true); return; }
  setFrameCount(A.n, true);
  Object.entries(A.groups).forEach(([name, fn]) => {
    const g = S.groups.find(x => x.name === name); if (!g) return; g.keys = {};
    for (let f = 0; f < A.n; f++) { const k = fn(f); setKey(g, f, { t: k.t, r: k.r, e: k.e || 'linear' }); }
  });
  S.cfg = S.cfg.split('\n').filter(l => !/^\s*md3anim/i.test(l)).join('\n').replace('md3skin mapmodel skin.jpg', `md3skin mapmodel skin.jpg\nmd3anim "mapmodel" 0 ${A.n} ${A.fps}`);
  $('#cfgText').value = S.cfg; S.fps = A.fps; $('#fps').value = A.fps;
}
const mapmodelPath = () => `cubemaker/${S.prop ? S.prop.id : 'modelo'}`;
const mapmodelLine = () => `mapmodel ${S.prop ? S.prop.mm : '1 3 0 0'} "${mapmodelPath()}"`;
function updatePropUI() {
  const box = $('#propBox'); if (!box) return;
  const on = S.mode === 'prop' && S.prop; box.style.display = on ? '' : 'none'; if (!on) return;
  const def = S.propDef || propDef(S.prop.id);
  $('#propTitle').textContent = def.n; $('#propDesc').textContent = def.d;
  const ctl = $('#propCtl'); ctl.innerHTML = '';
  Object.entries(def.vars || {}).forEach(([key, o]) => {
    const row = document.createElement('div'); row.className = 'field row';
    row.innerHTML = `<label style="width:90px">${o.n}</label><select>${o.o.map(([val, n]) => `<option value="${val}">${n}</option>`).join('')}</select>`;
    const se = row.querySelector('select'); se.value = S.prop.vars[key]; se.onchange = () => loadProp(def.id, { ...S.prop.vars, [key]: se.value }, true);
    ctl.appendChild(row);
  });
  const d = S.prop.dims;
  $('#propInfo').innerHTML = `${d[0]} × ${d[1]} × ${d[2]} m <small>(largura × comprimento × altura)</small><br>${model.surfaces[0].ntri} triângulos · ${model.nf > 1 ? model.nf + ' quadros animados' : 'estático'}${S.prop.scale !== 100 ? ` · mdlscale ${S.prop.scale}` : ''}`;
  $$('.mmline').forEach(e => e.textContent = S.prop.pickup ? `substitui o item "pickups/${S.prop.pickup}" do jogo` : mapmodelLine());
  document.body.classList.toggle('pickup', !!S.prop.pickup);
  $$('.mmpath').forEach(e => e.textContent = S.prop.pickup ? `packages/models/pickups/${S.prop.pickup}/ (tris.md3 + md3.cfg)` : `packages/models/mapmodels/${mapmodelPath()}/`);
}
function buildPropUI() {
  const box = $('#propGrid'); if (!box) return;
  const tabs = $('#propTabs'); tabs.innerHTML = '';
  const cats = Object.keys(PROP_CATS);
  if (!S.propCat) S.propCat = 'all';
  const tab = (k, label) => { const b = document.createElement('button'); b.textContent = label; b.className = k === S.propCat ? 'on' : ''; b.onclick = () => { S.propCat = k; buildPropUI(); }; tabs.appendChild(b); };
  tab('all', `Todos (${PROPS.length})`);
  cats.forEach(k => tab(k, `${PROP_CATS[k]} (${PROPS.filter(p => p.cat === k).length})`));
  box.innerHTML = '';
  (S.propCat === 'all' ? cats : [S.propCat]).forEach(k => {
    const list = PROPS.filter(p => p.cat === k); if (!list.length) return;
    if (S.propCat === 'all') { const h = document.createElement('h3'); h.className = 'arscat'; h.textContent = `${PROP_CATS[k]} · ${list.length}`; box.appendChild(h); }
    list.forEach(p => {
      const b = document.createElement('button'); b.className = 'wcard';
      b.innerHTML = `<div class="th" style="background-image:url(props/${p.id}.png)"></div><span class="tag war${p.war || 2}">${p.war === 1 ? '1ª GUERRA' : p.war === 2 ? '2ª GUERRA' : '1ª E 2ª GUERRA'}</span><div class="bd"><b>${p.n}</b><small>${p.pickup ? `item do jogo · pickups/${p.pickup}` : "mapmodel"}${p.anim ? ' · animado' : ''}${p.vars ? ' · variações' : ''}</small><p>${p.d}</p></div>`;
      b.onclick = () => loadProp(p.id); box.appendChild(b);
    });
  });
}
// acrescenta a linha do mapmodel ao .cfg de um mapa (com backup)
async function addPropToMap() {
  if (S.mode !== 'prop') return;
  const map = ($('#mapName').value || '').trim().replace(/\.cfg$|\.cgz$/i, ''); if (!map) return toast('Digite o nome do mapa (ex.: ac_desert)', 'warn');
  if (!(await ensurePerm())) return;
  const path = `packages/maps/${map}.cfg`, f = await readAt(path);
  if (!f) return toast(`Não achei ${path} na pasta conectada. Copie o .cfg do mapa para lá (ou conecte a pasta de instalação) e tente de novo.`, 'warn');
  let txt = await f.text(); const line = mapmodelLine();
  if (txt.includes(`"${mapmodelPath()}"`)) return toast('Esse mapmodel já está no .cfg do mapa', 'warn');
  const n = (txt.match(/^\s*mapmodel\s/gm) || []).length, stamp = stampNow();
  await writeAt(`${BACKUP}/${stamp}/${path}`, f);
  txt = txt.replace(/\s*$/, '\n') + `${line}\t\t// ${n} — CUBE MAKER\n`;
  await writeAt(path, new Blob([txt]));
  await appendLog({ acao: 'mapa', quando: new Date().toISOString(), mapa: path, linha: line, indice: n, backup: `${BACKUP}/${stamp}/${path}` });
  toast(`Adicionado ao ${map}.cfg como mapmodel nº ${n}. No editor do AC: /newent mapmodel ${n}`, 'ok');
  $('#mapIdx').textContent = `nº ${n} em ${map}.cfg · no editor: /newent mapmodel ${n}`;
}

// ================================================================ IMPORTAR (OBJ / GLB do Blender, Sketchfab…)
let IMP = null;
const IMP_SIZE = { pistol: 220, subgun: 650, assault: 950, sniper: 1100, carbine: 950, shotgun: 1000, knife: 300, grenade: 250, prop: 1500 };
async function importFile(file) {
  try {
    toast('Lendo ' + file.name + '…');
    IMP = await readExternal(file);
    // orientação inicial: maior eixo vira o comprimento (Y)
    const box = new THREE.Box3(); IMP.meshes.forEach(m => { m.geo.computeBoundingBox(); box.union(m.geo.boundingBox); });
    const sz = box.getSize(new THREE.Vector3()), rot = sz.x > sz.y ? [0, 0, 90] : [0, 0, 0];
    const target = $('#impTarget').value;
    S.imp = { rot, off: [0, 0, 0], target, size: IMP_SIZE[target] || 1500 };
    $('#impSize').value = S.imp.size; $('#impCtl').style.display = '';
    $('#impInfo').textContent = `${IMP.name}: ${IMP.meshes.length} peças, ${IMP.tris} triângulos${IMP.tris > 12000 ? ' — pesado para o AC; simplifique no Blender (Decimate) se der' : ''}`;
    await applyImport();
  } catch (e) { console.error(e); toast('Não consegui importar: ' + e.message, 'err'); }
}
async function applyImport() {
  if (!IMP) return;
  const o = S.imp, weapon = o.target !== 'prop', name = IMP.name;
  if (weapon) await loadPreset({ id: 'import', n: name, c: 'Importado', slot: o.target, war: 2, d: 'Modelo importado', hd: true, build: () => importParts(IMP, { ...o, weapon: true }) });
  else await loadProp({ id: 'import_' + name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 24), cat: 'obj', war: 0, n: name, d: 'Modelo importado — confira a escala pelo soldado de 1,80 m.', build: () => ({ parts: importParts(IMP, { ...o, weapon: false }).parts }) }, null, false);
}

// ---- Forja (UI)
let forgeT = 0;
function startForge(fam) { const F = FORGE_FAMILIES[fam]; return loadPreset(forgeDef(fam, { ...F.p }, 'Minha ' + F.n.toLowerCase())); }
function rebuildForge() {
  clearTimeout(forgeT);
  forgeT = setTimeout(() => { if (!S.forge) return; S.forgeKeepCam = true; const keepName = $('#forgeName').value || S.forgeName; loadPreset(forgeDef(S.forge.fam, S.forge.p, keepName)); }, 220);
}
function updateForgeUI() {
  const box = $('#forgeBox'); if (!box) return;
  box.style.display = S.forge ? '' : 'none'; if (!S.forge) return;
  const p = S.forge.p, F = FORGE_FAMILIES[S.forge.fam];
  $('#forgeTitle').textContent = 'Forja · ' + F.n; $('#forgeName').value = S.forgeName || '';
  const ctl = $('#forgeCtl'); ctl.innerHTML = '';
  const sel = (key, label) => { const row = document.createElement('div'); row.className = 'field row'; row.innerHTML = `<label style="width:110px">${label}</label><select>${FORGE_OPTIONS[key].map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}</select>`; const se = row.querySelector('select'); se.value = p[key]; se.onchange = () => { p[key] = se.value; rebuildForge(); }; ctl.appendChild(row); };
  const mats = (key, label, cats) => { const row = document.createElement('div'); row.className = 'field row'; row.innerHTML = `<label style="width:110px">${label}</label><select>${MAT_ORDER.filter(k => MATS[k] && cats.includes(MATS[k].cat)).map(k => `<option value="${k}">${MATS[k].n}</option>`).join('')}</select>`; const se = row.querySelector('select'); se.value = p[key]; se.onchange = () => { p[key] = se.value; rebuildForge(); }; ctl.appendChild(row); };
  sel('era', 'Época');
  const sl = document.createElement('div'); ctl.appendChild(sl);
  slider(sl, 'Cano (mm)', 60, 700, 5, () => p.barrel, v => { p.barrel = v; rebuildForge(); });
  slider(sl, 'Corpo (mm)', 120, 420, 5, () => p.body, v => { p.body = v; rebuildForge(); });
  if (S.forge.fam !== 'pistol') {
    slider(sl, 'Carregador (mm)', 20, 320, 5, () => p.magLen || 0, v => { p.magLen = v; rebuildForge(); });
    ['stock', 'mag', 'grip', 'fore', 'sight', 'muzzle', 'jacket', 'bipod', 'bayonet', 'side'].forEach(k => sel(k, { stock: 'Coronha', mag: 'Carregador', grip: 'Empunhadura', fore: 'Punho frontal', sight: 'Mira', muzzle: 'Boca', jacket: 'Camisa', bipod: 'Bipé', bayonet: 'Baioneta', side: 'Alavanca' }[k]));
  }
  mats('metal', 'Metal', ['metal']); mats('wood', 'Madeira/cabo', ['madeira', 'detalhe']);
}
function buildArsenalUI() {
  const box = $('#arsenal'); if (!box) return;
  const tabs = $('#arsenalTabs'); tabs.innerHTML = '';
  // armas primeiro; granadas e facas no fim
  const slots = ['subgun', 'assault', 'sniper', 'carbine', 'pistol', 'shotgun', 'knife', 'grenade'];
  if (!S.arsSlot) S.arsSlot = 'all';
  const tab = (k, label) => { const b = document.createElement('button'); b.textContent = label; b.className = k === S.arsSlot ? 'on' : ''; b.onclick = () => { S.arsSlot = k; buildArsenalUI(); }; tabs.appendChild(b); };
  tab('all', `Todos (${ARSENAL.length})`);
  slots.forEach(k => tab(k, SLOT_NAMES[k] + ` (${ARSENAL.filter(a => a.slot === k).length})`));
  const fb = $('#forgeFams');
  if (fb && !fb.children.length) Object.entries(FORGE_FAMILIES).forEach(([k, F]) => { const b = document.createElement('button'); b.className = 'forgecard'; b.innerHTML = `<b>${F.n}</b><small>${F.d}</small>`; b.onclick = () => startForge(k); fb.appendChild(b); });
  box.innerHTML = '';
  const card = a => {
    const b = document.createElement('button'); b.className = 'wcard';
    b.innerHTML = `<div class="th" style="background-image:url(presets/${a.id}.png)"></div><span class="tag war${a.war}">${a.war === 1 ? '1ª GUERRA' : '2ª GUERRA'}</span>${a.novo ? '<span class="tag novo">NOVO</span>' : ''}<div class="bd"><b>${a.n}</b><small>${a.c} · substitui ${a.slot}${a.hd ? ' · alta fidelidade' : ''}</small><p>${a.d}</p></div>`;
    b.onclick = () => loadPreset(a.id); return b;
  };
  (S.arsSlot === 'all' ? slots : [S.arsSlot]).forEach(k => {
    const list = ARSENAL.filter(a => a.slot === k); if (!list.length) return;
    if (S.arsSlot === 'all') { const h = document.createElement('h3'); h.className = 'arscat'; h.textContent = `${SLOT_NAMES[k]} · ${list.length}`; box.appendChild(h); }
    list.forEach(a => box.appendChild(card(a)));
  });
}


// ================================================================ PERSONAGENS (uniformes)
// regiões da skin do modelo de jogador do AC (ilhas UV, conferidas no mapa UV)
const REGIONS = {
  tunica: { n: 'Túnica / jaqueta', isl: [1, 2] }, mangas: { n: 'Mangas e mãos', isl: [18, 19, 20, 21, 22, 23, 24] },
  calca: { n: 'Calça', isl: [0, 3, 4] }, perneiras: { n: 'Perneiras / cano da bota', isl: [10, 11, 14, 15] },
  botas: { n: 'Botas', isl: [12, 13, 16, 17] }, cabeca: { n: 'Capacete / capuz', isl: [5, 8] }, rosto: { n: 'Rosto', isl: [6, 7, 9] },
};
const UNIFORMS = [
  { id: 'wehrmacht', war: 2, side: 'Eixo', n: 'Wehrmacht (Heer)', d: 'Túnica M36 feldgrau, botas de cano alto e Stahlhelm.', r: { tunica: 'feldgrauLa', mangas: 'feldgrauLa', calca: 'feldgrauEsc', perneiras: 'couroPreto', botas: 'couroPreto', cabeca: 'feldgrau' }, kit: { belt: 'couroPreto', buckle: 'acoGasto', straps: 'Y', pouches: 'mauser', pockets: 1, buttons: 'cinzaClaro', collar: 'feldgrauEsc', tabs: 'cinzaClaro', eagle: 1, helmet: 'stahl', helmetMat: 'feldgrau', pack: 'bread', packMat: 'lona', gasmask: 1, canteen: 1, legs: 'jackboot' }, team: 'cla' },
  { id: 'fallschirm', war: 2, side: 'Eixo', n: 'Fallschirmjäger', d: 'Bata de salto em camuflagem Splinter sobre o feldgrau.', r: { tunica: 'splinter', mangas: 'splinter', calca: 'feldgrauLa', perneiras: 'couroPreto', botas: 'couroPreto', cabeca: 'feldgrau' }, kit: { belt: 'couroPreto', straps: 'Y', pouches: 'bandolier', helmet: 'cap', helmetMat: 'feldgrau', eagle: 1, gasmask: 1, canteen: 1, legs: 'gaiter', legMat: 'feldgrauLa', hair: 'couroMarrom' }, team: 'cla' },
  { id: 'dak', war: 2, side: 'Eixo', n: 'Afrika Korps', d: 'Brim tropical, botas de lona e capacete areia.', r: { tunica: 'tanDAK', mangas: 'tanDAK', calca: 'tanDAK', perneiras: 'perneiraLona', botas: 'couroMarrom', cabeca: 'dunkelgelb' }, fx: { dust: 0.5 }, kit: { belt: 'lona', buckle: 'acoGasto', straps: 'Y', strapMat: 'lona', pouches: 'mauser', pouchMat: 'couroMarrom', pockets: 1, buttons: 'acoGasto', eagle: 1, helmet: 'stahl', helmetMat: 'dunkelgelb', pack: 'bread', packMat: 'lona', canteen: 1, legs: 'gaiter', legMat: 'lona' }, team: 'cla' },
  { id: 'ostfront', war: 2, side: 'Eixo', n: 'Frente Leste (inverno)', d: 'Agasalho branco de inverno, capacete caiado.', r: { tunica: 'brancoInv', mangas: 'brancoInv', calca: 'brancoInv', perneiras: 'couroPreto', botas: 'couroPreto', cabeca: 'inverno' }, fx: { dirt: 0.35 }, kit: { belt: 'couroPreto', straps: 'Y', pouches: 'mauser', helmet: 'stahl', helmetMat: 'inverno', gasmask: 1, legs: 'jackboot' }, team: 'cla' },
  { id: 'usarmy', war: 2, side: 'Aliados', n: 'US Army 1944', d: 'Jaqueta M41, calça de lã OD, perneiras de lona e capacete M1.', r: { tunica: 'khakiM41', mangas: 'khakiM41', calca: 'odLa', perneiras: 'perneiraLona', botas: 'couroMarrom', cabeca: 'oliva' }, kit: { belt: 'lona', buckle: 'acoGasto', straps: 'H', strapMat: 'lona', pouches: 'garand', pouchMat: 'lona', buttons: 'baquelite', helmet: 'm1', helmetMat: 'oliva', net: 1, strapMat2: 'lona', pack: 'haversack', packMat: 'lona', canteen: 1, canteenMat: 'lona', legs: 'gaiter', legMat: 'perneiraLona', bootMat: 'couroMarrom' }, team: 'rvsf' },
  { id: 'usmc', war: 2, side: 'Aliados', n: 'USMC Pacífico', d: 'Uniforme "frogskin" camuflado dos fuzileiros.', r: { tunica: 'frogskinT', mangas: 'frogskinT', calca: 'frogskinT', perneiras: 'perneiraLona', botas: 'couroMarrom', cabeca: 'frogskinT' }, fx: { dirt: 0.4 }, kit: { belt: 'lona', straps: 'H', strapMat: 'lona', pouches: 'garand', pouchMat: 'lona', pockets: 1, buttons: 'baquelite', helmet: 'm1', helmetMat: 'frogskinT', pack: 'haversack', packMat: 'lona', canteen: 1, canteenMat: 'lona', legs: 'anklet', legMat: 'perneiraLona' }, team: 'rvsf' },
  { id: 'british', war: 2, side: 'Aliados', n: 'Exército Britânico', d: 'Battledress cáqui, perneiras de lona e capacete Brodie.', r: { tunica: 'khakiBD', mangas: 'khakiBD', calca: 'khakiBD', perneiras: 'perneiraLona', botas: 'couroPreto', cabeca: 'oliva' }, kit: { belt: 'perneiraLona', buckle: 'latao', straps: 'X', strapMat: 'perneiraLona', pouches: 'chest', pouchMat: 'perneiraLona', pockets: 1, buttons: 'baquelite', helmet: 'brodie', helmetMat: 'oliva', net: 1, pack: 'small', packMat: 'perneiraLona', canteen: 1, legs: 'anklet', legMat: 'perneiraLona' }, team: 'rvsf' },
  { id: 'rkka', war: 2, side: 'Aliados', n: 'Exército Vermelho', d: 'Gimnastiorka cáqui, calça escura, botas de couro.', r: { tunica: 'sovKhaki', mangas: 'sovKhaki', calca: 'sovEsc', perneiras: 'couroPreto', botas: 'couroPreto', cabeca: 'oliva' }, kit: { belt: 'couroMarrom', buckle: 'latao', pouches: 'two', pouchMat: 'couroMarrom', pockets: 1, buttons: 'baquelite', helmet: 'ssh40', helmetMat: 'verdeSov', star: 1, pack: 'sidor', packMat: 'lona', canteen: 1, legs: 'jackboot' }, team: 'rvsf' },
  { id: 'rkkawinter', war: 2, side: 'Aliados', n: 'Exército Vermelho (inverno)', d: 'Telogreika acolchoada para o inverno russo.', r: { tunica: 'telogreika', mangas: 'telogreika', calca: 'telogreika', perneiras: 'couroPreto', botas: 'couroPreto', cabeca: 'oliva' }, kit: { belt: 'couroMarrom', buckle: 'latao', pouches: 'two', pouchMat: 'couroMarrom', helmet: 'ssh40', helmetMat: 'verdeSov', star: 1, legs: 'jackboot' }, team: 'rvsf' },
  { id: 'heer1916', war: 1, side: 'Potências Centrais', n: 'Alemanha 1916', d: 'Feldgrau da Grande Guerra com o primeiro Stahlhelm.', r: { tunica: 'feldgrauLa', mangas: 'feldgrauLa', calca: 'feldgrauLa', perneiras: 'couroMarrom', botas: 'couroMarrom', cabeca: 'feldgrau' }, fx: { dirt: 0.45, rust: 0.1 }, kit: { belt: 'couroMarrom', buckle: 'acoGasto', straps: 'Y', strapMat: 'couroMarrom', pouches: 'mauser', pouchMat: 'couroMarrom', buttons: 'acoGasto', collar: 'feldgrauEsc', helmet: 'stahl', helmetMat: 'feldgrau', pack: 'tornister', packMat: 'couroMarrom', gasmask: 1, canteen: 1, legs: 'jackboot', bootMat: 'couroMarrom' }, team: 'cla' },
  { id: 'poilu', war: 1, side: 'Aliados', n: 'França "Poilu" 1915', d: 'Azul-horizonte, perneiras e capacete Adrian.', r: { tunica: 'horizonte', mangas: 'horizonte', calca: 'horizonte', perneiras: 'perneira', botas: 'couroMarrom', cabeca: 'horizonte' }, fx: { dirt: 0.45 }, kit: { belt: 'couroMarrom', buckle: 'latao', straps: 'Y', strapMat: 'couroMarrom', pouches: 'mauser', pouchMat: 'couroMarrom', buttons: 'latao', helmet: 'adrian', helmetMat: 'azulHorizonte', pack: 'musette', packMat: 'lona', canteen: 1, legs: 'puttee', legMat: 'azulHorizonte' }, team: 'rvsf' },
  { id: 'tommy', war: 1, side: 'Aliados', n: 'Britânico 1916 "Tommy"', d: 'Cáqui de serviço, perneiras enroladas e capacete Brodie.', r: { tunica: 'khakiBD', mangas: 'khakiBD', calca: 'khakiBD', perneiras: 'perneira', botas: 'couroMarrom', cabeca: 'oliva' }, fx: { dirt: 0.45 }, kit: { belt: 'perneiraLona', buckle: 'latao', straps: 'X', strapMat: 'perneiraLona', pouches: 'chest', pouchMat: 'perneiraLona', pockets: 1, buttons: 'latao', helmet: 'brodie', helmetMat: 'oliva', pack: 'small', packMat: 'perneiraLona', canteen: 1, legs: 'puttee', legMat: 'perneira' }, team: 'rvsf' },
  { id: 'doughboy', war: 1, side: 'Aliados', n: 'EUA 1918 "Doughboy"', d: 'Lã verde-oliva, perneiras e capacete Brodie.', r: { tunica: 'odLa', mangas: 'odLa', calca: 'odLa', perneiras: 'perneira', botas: 'couroMarrom', cabeca: 'oliva' }, fx: { dirt: 0.45 }, kit: { belt: 'lona', buckle: 'acoGasto', straps: 'H', strapMat: 'lona', pouches: 'garand', pouchMat: 'lona', pockets: 1, buttons: 'latao', helmet: 'brodie', helmetMat: 'oliva', pack: 'haversack', packMat: 'lona', canteen: 1, legs: 'puttee', legMat: 'odLa' }, team: 'rvsf' },
];
// ---------------------------------------------------------------- equipamento pintado em 3D (posição de cada pixel na pose parada)
// kit: belt, buckle, straps ('Y'|'H'|'X'), pouches ('mauser'|'garand'|'chest'|'two'), pockets, buttons, collar, tabs, eagle, star,
//      helmet ('stahl'|'m1'|'brodie'|'adrian'|'ssh40'|'cap'), helmetMat, net, pack ('bread'|'haversack'|'tornister'|'musette'|'sidor'|'small'), canteen, gasmask, legs ('jackboot'|'gaiter'|'puttee'|'anklet')
let KIT = null;
const REG_OF = []; Object.entries(REGIONS).forEach(([k, R]) => R.isl.forEach(i => REG_OF[i] = k));
function kitSetup(sk) {
  const U = UNIFORMS.find(u => u.id === S.char.uniform); if (!U || !U.kit) return null;
  if (sk._kit && sk._kit.id === U.id && sk._kit.off === JSON.stringify(S.char.kitOff || [])) return sk._kit;
  const s = model.surfaces[0], P = s.pos[0], acc = (isl) => { const a = { n: 0, x: 0, y: 0, z: 0, zmin: 1e9, zmax: -1e9, xmax: -1e9 }; isl.forEach(i => (s.islVerts[i] || []).forEach(v => { a.n++; a.x += P[v * 3]; a.y += P[v * 3 + 1]; a.z += P[v * 3 + 2]; a.zmin = Math.min(a.zmin, P[v * 3 + 2]); a.zmax = Math.max(a.zmax, P[v * 3 + 2]); a.xmax = Math.max(a.xmax, P[v * 3]); })); a.x /= a.n || 1; a.y /= a.n || 1; a.z /= a.n || 1; return a; };
  const T = acc(REGIONS.tunica.isl), H = acc([...REGIONS.cabeca.isl, ...REGIONS.rosto.isl]), Bo = acc(REGIONS.botas.isl), Le = acc(REGIONS.perneiras.isl);
  const off = new Set(S.char.kitOff || []), K = { ...U.kit }; off.forEach(k => delete K[k]);
  sk._kit = { id: U.id, off: JSON.stringify(S.char.kitOff || []), U, K, y0: T.y, xf: T.xmax, zb: T.zmin + 1.3, zt: T.zmax, hx: H.x, hy: H.y, htop: H.zmax, foot: Bo.zmin, legTop: Le.zmax };
  return sk._kit;
}
const band = (v, a, b, soft = 0.25) => v < a - soft || v > b + soft ? 0 : v < a ? 1 - (a - v) / soft : v > b ? 1 - (v - b) / soft : 1;
function kitAt(sk, i, isl, r0, g0, b0) {
  const K = KIT.K, reg = REG_OF[isl]; if (!reg) return null;
  const x = sk.pos3[i * 3], y = sk.pos3[i * 3 + 1], z = sk.pos3[i * 3 + 2], nx = -sk.nrm3[i * 3], ny = -sk.nrm3[i * 3 + 1], nz = -sk.nrm3[i * 3 + 2];   // normais do MD2 apontam para dentro
  const front = nx > 0.3, back = nx < -0.3, dy = y - KIT.y0, ady = Math.abs(dy), zb = KIT.zb;
  // mãos e rosto continuam pele (detecta o tom de pele da skin original)
  const isSkin = r0 > g0 * 1.08 && g0 > b0 * 1.02 && r0 > 70;
  if (reg === 'mangas' && isSkin) return ['pele', 1, 0.85];
  if (reg === 'rosto' || reg === 'cabeca') {
    if (K.helmet) {
      const dx = x - KIT.hx, rimBack = K.helmet === 'stahl' ? 2.3 : K.helmet === 'brodie' ? 0.2 : 1.2;
      let brim = KIT.htop - (K.helmet === 'cap' ? 3.2 : 4.4) - (dx < 0 ? Math.min(1, -dx / 4) * rimBack : 0) - (K.helmet === 'stahl' ? Math.max(0, Math.abs(y - KIT.hy) - 2.5) * 0.25 : 0);
      if (z > brim) {
        let sh = 1; if (z < brim + 0.45) sh = 0.62;                                     // aba / borda
        if (K.net && (Math.abs(Math.sin(z * 2.2 + y * 2.2)) < 0.12 || Math.abs(Math.sin(z * 2.2 - y * 2.2)) < 0.12)) return ['oliva', 0.55, 1, 1];
        if (K.helmet === 'adrian' && Math.abs(y - KIT.hy) < 0.35 && z > KIT.htop - 1.6) return [K.helmetMat, 1.25, 1];   // crista
        if (K.star && front && z > brim + 0.8 && z < brim + 2.4 && Math.abs(y - KIT.hy) < 0.9) return ['vermelho', 1, 1];
        return [K.helmetMat, sh, 1, 1];
      }
      if (K.helmet !== 'cap' && Math.abs(Math.abs(y - KIT.hy) - 2.9) < 0.25 && z > brim - 3.5 && !front) return [K.strapMat || 'couroMarrom', 0.8, 1];  // jugular
    }
    if (reg === 'cabeca') return [K.hair || 'couroMarrom', 0.45, 0.9];
    return ['pele', 1, 0.8];
  }
  // pernas
  if (reg === 'perneiras' || reg === 'botas' || (reg === 'calca' && z < KIT.legTop + 2.5)) {
    const L = K.legs;
    if (reg === 'botas') { if (z < KIT.foot + 0.6) return ['couroPreto', 0.55, 1]; if (L === 'jackboot') return [K.bootMat || 'couroPreto', 1.08, 1]; if (front && Math.abs(Math.sin(z * 6)) < 0.25 && z > KIT.foot + 2) return ['couroPreto', 0.6, 0.8]; return null; }
    if (L === 'jackboot' && z < KIT.legTop + 2.5) return [K.bootMat || 'couroPreto', 1.08 + 0.12 * Math.max(0, nx), 1];
    if (L === 'puttee' && z < KIT.legTop + 2.5) { const t = ((z * 1.6 + Math.atan2(ny, nx) * 0.35) % 1 + 1) % 1; return [K.legMat || 'perneira', t < 0.12 ? 0.7 : 1, 1]; }
    if ((L === 'gaiter' || L === 'anklet') && z < KIT.legTop + (L === 'gaiter' ? 1.5 : -1.5)) { const side = Math.abs(ny) > 0.55; if (side && Math.abs(Math.sin(z * 3.2)) < 0.22) return ['acoGasto', 0.8, 1]; return [K.legMat || 'perneiraLona', z > KIT.legTop + 1 ? 0.8 : 1, 1]; }
    return null;
  }
  if (reg !== 'tunica' && reg !== 'calca' && reg !== 'mangas') return null;
  if (reg === 'mangas') { if (K.cuff && z < 9.5 && x > 8) return [K.cuff, 0.85, 1]; return null; }
  // cinto + fivela
  if (K.belt && z > zb - 1 && z < zb + 1) {
    if (front && ady < 0.9) return [K.buckle || 'acoGasto', z > zb - 0.7 && z < zb + 0.7 ? 1.15 : 0.7, 1];
    return [K.belt, Math.abs(z - zb) > 0.82 ? 0.7 : 1, 1];
  }
  if (reg !== 'tunica') return null;
  // cartucheiras
  if (K.pouches && front) {
    const P = K.pouches;
    if (P === 'mauser' || P === 'garand' || P === 'two') {
      const n = P === 'garand' ? 5 : P === 'mauser' ? 3 : 1, w = P === 'garand' ? 1.05 : P === 'two' ? 3 : 1.25, z0 = zb + 0.9, z1 = zb + (P === 'garand' ? 2.6 : 3.3);
      if (z > z0 && z < z1 && ady > 1.3 && ady < 1.3 + n * (w + 0.25)) {
        const k = (ady - 1.3) % (w + 0.25); if (k < w) { const flap = z > z1 - 0.9; return [K.pouchMat || K.belt, flap ? (z > z1 - 0.95 && z < z1 - 0.8 ? 0.55 : 1.08) : (k < 0.12 || k > w - 0.12 ? 0.7 : 0.95), 1]; }
      }
    }
    if (P === 'chest' && z > 13.5 && z < 18 && ady > 1.4 && ady < 5.2) { const k = Math.floor((z - 13.5) / 0.9); return [K.pouchMat || 'lona', (z - 13.5) % 0.9 < 0.12 ? 0.65 : 0.98 - k * 0.02, 1]; }
    if (P === 'bandolier' && Math.abs(dy + (z - 15) * 0.55) < 1.2 && z > zb + 1) { return ['lona', Math.abs(Math.sin(z * 4)) < 0.3 ? 0.7 : 1, 1]; }
  }
  // suspensórios / correias
  if (K.straps && z > zb + 0.9) {
    if (front) { const c = 3.2 - (z - zb) * 0.05; if (Math.abs(ady - c) < 0.5) return [K.strapMat || K.belt, Math.abs(ady - c) > 0.36 ? 0.75 : 1, 1]; }
    if (back) {
      const yz = KIT.zt - 6;
      if (K.straps === 'Y') { const c = z > yz ? (z - yz) * 0.55 : 0; if (Math.abs(ady - c) < 0.5) return [K.strapMat || K.belt, 0.95, 1]; }
      else if (K.straps === 'X') { if (Math.abs(ady - Math.abs(z - yz) * 0.5) < 0.5) return [K.strapMat || K.belt, 0.95, 1]; }
      else if (Math.abs(ady - 3) < 0.5) return [K.strapMat || K.belt, 0.95, 1];
    }
  }
  // mochila / bornal / máscara de gás / cantil
  if (back && K.pack) {
    const PK = { bread: [zb + 0.6, zb + 4, -4.5, -0.5], haversack: [zb + 3, KIT.zt - 3, -2.8, 2.8], tornister: [zb + 5, KIT.zt - 2.5, -3.5, 3.5], musette: [zb + 1, zb + 5.5, -5, -1.2], sidor: [zb + 4, KIT.zt - 4, -3, 3], small: [zb + 6, KIT.zt - 3.5, -3, 3] }[K.pack];
    if (PK && z > PK[0] && z < PK[1] && dy > PK[2] && dy < PK[3]) {
      if (K.pack === 'tornister' && z > PK[1] - 1.4) return ['feldgrauEsc', 0.9 + 0.2 * Math.sin(dy * 3), 1];      // capote enrolado
      const edge = Math.min(z - PK[0], PK[1] - z, dy - PK[2], PK[3] - dy) < 0.3;
      return [K.packMat || 'lona', edge ? 0.65 : (z > PK[1] - 1.6 && z < PK[1] - 1.45 ? 0.6 : 1), 1];
    }
  }
  if (K.gasmask && back && z > zb + 0.5 && z < zb + 4.5 && dy > 1 && dy < 3.6) return ['feldgrau', 0.85 + 0.2 * (Math.abs(Math.sin(z * 5)) > 0.6), 1];
  if (K.canteen && Math.abs(ny) > 0.55 && z > zb - 3.5 && z < zb + 0.5 && Math.abs(x - (KIT.xf - 7)) < 1.6) return [K.canteenMat || 'couroMarrom', 0.9, 1];
  // túnica: gola, distintivos, bolsos e botões
  if (K.collar && z > KIT.zt - 1.8) return [K.collar, 0.9, 1];
  if (front) {
    if (K.tabs && z > KIT.zt - 3 && z < KIT.zt - 1.8 && ady > 1.3 && ady < 2.8) return [K.tabs, Math.abs(Math.sin(ady * 9)) < 0.35 ? 0.7 : 1.1, 1];
    if (K.eagle && dy < -1.6 && dy > -4.6 && z > KIT.zt - 5.4 && z < KIT.zt - 3.6) { const u = (dy + 3.1) / 1.5, v = (z - (KIT.zt - 4.5)) / 0.9; if (Math.abs(v) < 1 - Math.abs(u) * 0.55 || (Math.abs(u) < 0.2 && v < 0.2)) return ['cinzaClaro', 1, 0.9]; }
    if (K.pockets) {
      const top = KIT.zt - 4.3, bot = KIT.zt - 8.5;
      if (z > bot && z < top && ady > 1.3 && ady < 4.6) {
        const e = Math.min(z - bot, top - z, ady - 1.3, 4.6 - ady);
        if (e < 0.15) return [S.islandMat[0].get(isl) || 'lona', 0.6, 1];
        if (z > top - 1.2 && z < top - 1.05) return [S.islandMat[0].get(isl) || 'lona', 0.6, 1];                      // aba
        if (Math.abs(ady - 2.95) < 0.3 && Math.abs(z - (top - 0.65)) < 0.3) return [K.buttonMat || 'acoGasto', 1, 1];
        if (z > top - 1.2) return [S.islandMat[0].get(isl) || 'lona', 1.1, 1];
      }
    }
    if (K.buttons && ady < 0.35) { const k = (z - zb - 1.6) / 2.5; if (k > 0 && Math.abs(k - Math.round(k)) < 0.12 && z < KIT.zt - 1.5) return [K.buttons, 1.1, 1]; if (ady < 0.08) return [S.islandMat[0].get(isl) || 'lona', 0.65, 1]; }
  }
  return null;
}
let gearMesh = null, GEAR = null;
function removeGear() { if (gearMesh) { root.remove(gearMesh); gearMesh.geometry.dispose(); } gearMesh = null; GEAR = null; }
function refreshGear() {
  removeGear();
  if (S.mode !== 'char' || !S.char || !S.char.gear3d || !S.char.uniform) return;
  const U = UNIFORMS.find(u => u.id === S.char.uniform); if (!U || !U.kit) return;
  try {
    GEAR = buildGear(model, { head: [...REGIONS.cabeca.isl, ...REGIONS.rosto.isl], torso: REGIONS.tunica.isl }, U.kit, { helmet: S.char.helmet3d || null });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(gearFrame(GEAR, S.frame), 3)); g.setAttribute('uv', new THREE.BufferAttribute(GEAR.uv, 2));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(GEAR.pos.length).fill(1), 3));
    const ix = new Uint32Array(GEAR.tris.length); for (let t = 0; t < ix.length; t += 3) { ix[t] = GEAR.tris[t]; ix[t + 1] = GEAR.tris[t + 2]; ix[t + 2] = GEAR.tris[t + 1]; }
    g.setIndex(new THREE.BufferAttribute(ix, 1)); g.computeVertexNormals();
    gearMesh = new THREE.Mesh(g, meshes[0].material); root.add(gearMesh);
  } catch (e) { console.error(e); toast('Equipamento 3D: ' + e.message, 'err'); }
}
let charFiles = null;   // arquivos da pasta playermodels do usuário (Map caminho → File)
async function openCharacterFolder(fileList) {
  const files = [...fileList];
  const rel = f => (f.webkitRelativePath || f.name).replace(/\\/g, '/');
  const md2 = files.find(f => /(^|\/)tris\.md2$/i.test(rel(f)) && !/weapons|world|menu/i.test(rel(f))) || files.find(f => /\.md2$/i.test(f.name));
  if (!md2) throw new Error('Selecione a pasta packages/models/playermodels do seu AssaultCube');
  const root = rel(md2).replace(/tris\.md2$/i, '');
  charFiles = new Map(files.filter(f => /\.(jpe?g|png)$/i.test(f.name)).map(f => [rel(f).slice(root.length), f]));
  const base = charFiles.get('skin.jpg') || charFiles.get('RVSF/01.jpg') || [...charFiles.values()][0];
  await loadCharacter(await md2.arrayBuffer(), base);
}
async function loadCharacter(md2Buf, skinFile) {
  const m = parseMD2(md2Buf);
  let img = await loadImage(await fileToDataURL(skinFile));
  if (img.width < 1000) { const sc = Math.max(2, Math.round(1280 / img.width)); const c = document.createElement('canvas'); c.width = img.width * sc; c.height = img.height * sc; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, c.width, c.height); img = c; }
  await loadWeapon({ modelObj: m, md2Buf, cfgText: '', skinImages: [img], weaponName: 'personagem', skinSources: [skinFile] });
  S.mode = 'char'; document.body.dataset.mode = 'char'; S.charMD2 = md2Buf.slice(0); removeGear();
  S.char = { gear3d: true, target: 'team', team: 'rvsf', slot: '01', nick: '', nickTeam: 'ffa', multi: false, baseName: skinFile.name };
  S.skinFiles = ['personagem.jpg']; S.global.detail = 0.55;
  S.animIdx = Math.max(0, anims().findIndex(a => /stand/i.test(a.name)));
  updateAll(); frameCamera('orbit'); buildCharUI(); goStep(2);
  toast('Personagem carregado — escolha um uniforme', 'ok');
}
function applyUniform(id) {
  const U = UNIFORMS.find(u => u.id === id); if (!U || !model) return;
  snapshot('uniforme ' + U.n);
  const mp = S.islandMat[0];
  Object.entries(U.r).forEach(([reg, mat]) => REGIONS[reg].isl.forEach(i => i < model.surfaces[0].nIsl && mp.set(i, mat)));
  Object.assign(S.global, { wear: 0.3, age: 0.2, dirt: 0.25, detail: 0.32 }); S.fx = { ...S.fx, cavity: 0.4, scratches: 0, rust: 0, dust: 0, burn: 0, blood: 0, ...(U.fx || {}) };
  if (U.fx && U.fx.dirt != null) S.global.dirt = U.fx.dirt;
  S.char.uniform = U.id; S.char.team = U.team; S.char.kit = S.char.kitOn !== false; S.modifiedSkins.add(0);
  composite(0); refreshGear(); updateAll(); buildCharUI();
  toast(`Uniforme: ${U.n}`, 'ok');
}
function setRegion(reg, mat) {
  snapshot('região'); REGIONS[reg].isl.forEach(i => mat ? S.islandMat[0].set(i, mat) : S.islandMat[0].delete(i)); S.modifiedSkins.add(0); composite(0); buildCharUI();
}
function regionCenter(reg) {
  const s = model.surfaces[0], sk = skins[0], isl = REGIONS[reg].isl[0];
  let u = 0, v = 0, n = 0; s.islVerts[isl].forEach(x => { u += s.st[x * 2]; v += s.st[x * 2 + 1]; n++; });
  return [u / n * sk.w, v / n * sk.h];
}
function addInsignia(kind) {
  if (!model || S.mode !== 'char') return;
  snapshot('insígnia'); const sk = skins[0], sc = sk.w / 640;
  const base = { id: Math.floor(Math.random() * 1e6), si: 0, font: 'Stardos Stencil', style: 'paint', wear: 0.3, rot: 0, flip: 0 };
  let d;
  if (kind === 'nome') { const [x, y] = regionCenter('tunica'); d = { ...base, kind: 'text', text: $('#charName').value || 'SOLDADO', size: 22 * sc, color: '#d8d0b8', x, y: y - 40 * sc, font: 'Special Elite' }; }
  else if (kind === 'divisas') { const [x, y] = regionCenter('mangas'); d = { ...base, kind: 'chevron', text: '', size: 30 * sc, color: '#c9b27a', x, y: y - 50 * sc }; }
  else if (kind === 'numero') { const [x, y] = regionCenter('cabeca'); d = { ...base, kind: 'text', text: $('#charNum').value || '7', size: 30 * sc, color: '#e8e2d0', x, y }; }
  else if (kind === 'estrela') { const [x, y] = regionCenter('cabeca'); d = { ...base, kind: 'star', text: '', size: 34 * sc, color: S.char.team === 'cla' ? '#b03030' : '#e8e2d0', x, y }; }
  else if (kind === 'faixa') { const [x, y] = regionCenter('mangas'); d = { ...base, kind: 'bar', text: '', size: 46 * sc, color: '#b8a070', x, y, rot: 90 }; }
  S.decals.push(d); S.di = S.decals.length - 1; S.modifiedSkins.add(0);
  document.fonts && document.fonts.load(`20px "${d.font}"`).then(() => refreshResult(0)).catch(() => { });
  refreshResult(0); updateDecalsUI(); toast('Insígnia adicionada — ajuste em Textura › Decalques', 'ok');
}
function charTarget() {
  const c = S.char;
  if (c.target === 'nick') { const nick = (c.nick || 'jogador').replace(/[^\w\-\[\]]/g, ''); return `packages/models/playermodels/custom/${nick}${c.multi ? '__' : '_'}${c.nickTeam}.jpg`; }
  return `packages/models/playermodels/${c.team.toUpperCase()}/${c.slot}.jpg`;
}
function buildCharUI() {
  const box = $('#uniforms'); if (!box) return; box.innerHTML = '';
  UNIFORMS.forEach(U => {
    const b = document.createElement('button'); b.className = 'unicard' + (S.char && S.char.uniform === U.id ? ' on' : '');
    const sw = ['cabeca', 'tunica', 'calca', 'perneiras', 'botas'].map(r => { const m = MATS[U.r[r]]; return m ? `<i style="background:rgb(${m.c.map(v => v | 0)})"></i>` : ''; }).join('');
    b.innerHTML = `<div class="sw">${sw}</div><span class="tag war${U.war}">${U.war === 1 ? '1ª GUERRA' : '2ª GUERRA'} · ${U.side}</span><b>${U.n}</b><small>${U.d}</small>`;
    b.onclick = () => applyUniform(U.id); box.appendChild(b);
  });
  const rg = $('#regions'); rg.innerHTML = '';
  const opts = ['<option value="">— original —</option>', ...CATS.filter(([k]) => k !== 'minhas' || MAT_ORDER.some(m => MATS[m] && MATS[m].cat === 'minhas')).map(([k, n]) => `<optgroup label="${n}">${MAT_ORDER.filter(m => MATS[m] && MATS[m].cat === k).map(m => `<option value="${m}">${MATS[m].n}</option>`).join('')}</optgroup>`)].join('');
  Object.entries(REGIONS).forEach(([k, R]) => {
    const row = document.createElement('div'); row.className = 'field row';
    row.innerHTML = `<label style="width:120px">${R.n}</label><select>${opts}</select>`;
    const sel = row.querySelector('select'); sel.value = model ? (S.islandMat[0].get(R.isl[0]) || '') : '';
    sel.onchange = () => setRegion(k, sel.value || null); rg.appendChild(row);
  });
  if (S.char) {
    $('#charTargetTeam').checked = S.char.target === 'team'; $('#charTargetNick').checked = S.char.target === 'nick';
    $('#charTeam').value = S.char.team; $('#charSlot').value = S.char.slot; $('#charNick').value = S.char.nick; $('#charNickTeam').value = S.char.nickTeam; $('#charMulti').checked = S.char.multi;
    $('#charPath').textContent = charTarget();
  }
}

// ---------------------------------------------------------------- presets de textura
const PRESETS = {
  mp40: { name: 'MP40', base: 'acoOxidado', global: { wear: 0.4, age: 0.2, dirt: 0.3 }, fx: { cavity: 0.45, scratches: 0.25 } },
  thompson: { name: 'Thompson', base: 'parkCinza', global: { wear: 0.35, age: 0.25, dirt: 0.25 }, fx: { cavity: 0.4, scratches: 0.2 } },
  kar98: { name: 'Kar98k', base: 'acoOxidado', global: { wear: 0.45, age: 0.3, dirt: 0.3 }, fx: { cavity: 0.5, scratches: 0.3, rust: 0.15 } },
  garand: { name: 'M1 Garand', base: 'parkVerde', global: { wear: 0.3, age: 0.2, dirt: 0.25 }, fx: { cavity: 0.4, scratches: 0.2 } },
  inverno: { name: 'Frente leste (inverno)', base: 'inverno', global: { wear: 0.6, age: 0.3, dirt: 0.2 }, fx: { cavity: 0.5, scratches: 0.35, rust: 0.1 } },
  afrika: { name: 'Afrika Korps', base: 'deserto', global: { wear: 0.55, age: 0.35, dirt: 0.3 }, fx: { cavity: 0.4, dust: 0.5, scratches: 0.3 } },
};
function applyPreset(key) {
  if (!model) return;
  const p = PRESETS[key]; const si = model.surfaces.findIndex(s => s.name === 'weapon'); if (si < 0) return;
  snapshot('preset ' + key);
  const s = model.surfaces[si];
  for (let i = 0; i < s.nIsl; i++) if (!S.islandMat[si].has(i) || ['acoOxidado', 'parkCinza', 'parkVerde', 'inverno', 'deserto'].includes(S.islandMat[si].get(i))) S.islandMat[si].set(i, p.base);
  Object.assign(S.global, p.global); Object.assign(S.fx, p.fx || {});
  S.modifiedSkins.add(si); skins.forEach((_, i) => composite(i)); updateGlobalUI();
  toast(`Preset ${p.name} aplicado. Escolha madeira/baquelite no banco e clique nas peças.`, 'ok');
}

// ---------------------------------------------------------------- receitas de modelagem
const RECIPES = {
  subgun: [{ n: 'MP40', d: 'Carregador reto e longo, cano curto com apoio, corpo em aço oxidado e empunhadura de baquelite.', tex: 'mp40', steps: [
    { t: 'Selecione o carregador e crie o grupo "Carregador"', g: 'Carregador' },
    { t: 'Alongue o carregador (pente reto de 32)', act: 'scale', g: 'Carregador', axis: 2, f: 1.35, label: 'Alongar' },
    { t: 'Crie o grupo "Ferrolho" (alavanca de engatilhar)', g: 'Ferrolho' },
    { t: 'Oculte a mira/trilho moderno (grupo "Mira" → ocultar)', g: 'Mira', act: 'hide', label: 'Ocultar mira' },
    { t: 'Crie o grupo "Mão" com a mão esquerda (vai seguir o carregador)', g: 'Mão' }] },
  { n: 'Thompson M1A1', d: 'Coronha e telha de madeira, carregador reto de 30, aço parkerizado.', tex: 'thompson', steps: [
    { t: 'Grupo "Carregador"', g: 'Carregador' }, { t: 'Grupo "Coronha" e aplicar Madeira nogueira', g: 'Coronha' },
    { t: 'Grupo "Ferrolho"', g: 'Ferrolho' }, { t: 'Cano mais longo', act: 'scale', g: 'Cano', axis: 1, f: 1.15, label: 'Alongar cano' }] }],
  assault: [{ n: 'StG 44', d: 'Carregador curvo longo, corpo estampado, coronha de madeira.', tex: 'mp40', steps: [
    { t: 'Grupo "Carregador"', g: 'Carregador' }, { t: 'Carregador mais longo', act: 'scale', g: 'Carregador', axis: 2, f: 1.25, label: 'Alongar' },
    { t: 'Grupo "Coronha" (madeira)', g: 'Coronha' }, { t: 'Grupo "Ferrolho"', g: 'Ferrolho' }, { t: 'Oculte trilhos/miras modernas', g: 'Mira', act: 'hide', label: 'Ocultar mira' }] }],
  sniper: [{ n: 'Kar98k + ZF39', d: 'Ferrolho manual com alavanca, madeira por todo o corpo, luneta curta.', tex: 'kar98', steps: [
    { t: 'Grupo "Ferrolho" só com a alavanca', g: 'Ferrolho' }, { t: 'Grupo "Coronha" e aplicar Faia (Kar98k)', g: 'Coronha' },
    { t: 'Grupo "Mira" (luneta) — encurtar', act: 'scale', g: 'Mira', axis: 1, f: 0.75, label: 'Encurtar luneta' },
    { t: 'Grupo "Carregador" (ocultar: o Kar98k é de carga interna)', g: 'Carregador', act: 'hide', label: 'Ocultar carregador' }] }],
  carbine: [{ n: 'M1 Carbine', d: 'Carabina leve, madeira clara, carregador curto de 15.', tex: 'garand', steps: [
    { t: 'Grupo "Carregador"', g: 'Carregador' }, { t: 'Carregador mais curto', act: 'scale', g: 'Carregador', axis: 2, f: 0.8, label: 'Encurtar' },
    { t: 'Grupo "Coronha" e aplicar Madeira clara', g: 'Coronha' }, { t: 'Grupo "Ferrolho"', g: 'Ferrolho' }] }],
  shotgun: [{ n: 'Winchester 1897 "Trench"', d: 'Escopeta pump com protetor de cano e baioneta.', tex: 'garand', steps: [
    { t: 'Grupo "Telha" (a parte que desliza no pump)', g: 'Telha' }, { t: 'Grupo "Coronha" e aplicar Nogueira', g: 'Coronha' },
    { t: 'Adicione o protetor de cano (cilindro)', act: 'prim', type: 'cyl', near: 'muzzle', label: 'Criar protetor' }] }],
  pistol: [{ n: 'Luger P08', d: 'Pistola com articulação (toggle) em cima, empunhadura de madeira quadriculada.', tex: 'mp40', steps: [
    { t: 'Grupo "Ferrolho" (slide/articulação)', g: 'Ferrolho' }, { t: 'Grupo "Carregador"', g: 'Carregador' },
    { t: 'Grupo "Coronha" (empunhadura) e aplicar Quadriculado', g: 'Coronha' }] },
  { n: 'Colt M1911', d: 'Slide em aço parkerizado e talas de madeira.', tex: 'thompson', steps: [
    { t: 'Grupo "Ferrolho" (slide)', g: 'Ferrolho' }, { t: 'Grupo "Carregador"', g: 'Carregador' }] }],
  knife: [{ n: 'M3 Trench Knife', d: 'Lâmina escura parkerizada, cabo de couro em anéis.', tex: 'thompson', steps: [
    { t: 'Selecione o cabo e aplique Couro', g: 'Cabo' }, { t: 'Lâmina: aplique Parkerizado cinza' }] }],
  grenade: [{ n: 'Stielhandgranate 24', d: 'A granada "espremedor de batata": cabeça de lata e cabo de madeira.', tex: 'mp40', steps: [
    { t: 'Adicione o cabo de madeira (cilindro)', act: 'prim', type: 'cyl', near: 'root', label: 'Criar cabo' },
    { t: 'Aplique Feldgrau na cabeça e Faia no cabo' }, { t: 'O pino é criado pelo gerador de arremesso (etapa Animação)' }] }],
};
function runRecipeStep(st) {
  if (!model) return;
  if (st.act === 'scale' || st.act === 'hide') {
    const gi = groupByName(new RegExp('^' + st.g.slice(0, 5), 'i'));
    if (gi < 0) return toast(`Crie primeiro o grupo "${st.g}" (selecione as peças → Criar grupo)`, 'warn');
    snapshot(st.label); const g = S.groups[gi];
    if (st.act === 'scale') {
      g.s[st.axis] = +(g.s[st.axis] * st.f).toFixed(3);
      // âncora no topo/fundo: mantém o encaixe (pivô na ponta mais próxima do corpo)
    } else g.hidden = !g.hidden;
    S.gi = gi; updateAll(); toast(`${st.label}: ok`, 'ok');
  } else if (st.act === 'prim') {
    snapshot(st.label);
    const pos = st.near === 'muzzle' ? (m => [m[0], m[1] - 6, m[2]])(muzzle()) : [...S.root.pivot];
    const { gi } = addPrimitive({ type: st.type, pos, size: st.type === 'cyl' ? [0.9, st.near === 'muzzle' ? 10 : 9] : undefined, rot: st.near === 'root' ? [0, 0, 0] : [0, 0, 0] }, { silent: true });
    S.gi = gi; updateAll(); toast('Peça criada — ajuste com Mover/Girar/Escala', 'ok');
  }
}
function updateRecipesUI() {
  const box = $('#recipes'); if (!box) return; box.innerHTML = '';
  const list = RECIPES[S.weapon] || RECIPES[Object.keys(WEAPONS).find(k => S.weapon.includes(k))] || [];
  if (!list.length) { box.innerHTML = '<p class="muted">Sem receita para esta arma — use grupos e peças novas livremente.</p>'; return; }
  list.forEach(r => {
    const d = document.createElement('div'); d.className = 'recipe';
    d.innerHTML = `<h4>${r.n}</h4><p>${r.d}</p><ol></ol><div class="btnrow"><button class="btn sm primary">Textura ${PRESETS[r.tex].name}</button></div>`;
    const ol = d.querySelector('ol');
    r.steps.forEach(st => {
      const li = document.createElement('li'); li.textContent = st.t + ' ';
      if (st.g && groupByName(new RegExp('^' + st.g.slice(0, 5), 'i')) >= 0 && !st.act) li.className = 'ok';
      if (st.act) { const b = document.createElement('button'); b.className = 'btn sm'; b.textContent = st.label; b.onclick = () => runRecipeStep(st); li.appendChild(b); }
      ol.appendChild(li);
    });
    d.querySelector('.btn.primary').onclick = () => { applyPreset(r.tex); };
    box.appendChild(d);
  });
}

// ---------------------------------------------------------------- decalques
const DECAL_SIZE = { size: 28, rot: 0, wear: 0.25 };
function drawDecals(si, ctx) {
  S.decals.forEach((d, i) => { if (d.si === si) drawDecal(ctx, d, i === S.di && S.step === 3); });
}
function drawDecal(ctx, d, selected) {
  const sz = d.size, txt = d.kind === 'text' ? (d.text || '') : '';
  const W = Math.ceil(d.kind === 'text' ? sz * Math.max(1, txt.length) * 0.75 + 16 : sz * 1.3 + 16), H = Math.ceil(sz * 1.5 + 16);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  x.translate(W / 2, H / 2);
  const shape = (fill) => {
    x.beginPath();
    if (d.kind === 'star') { for (let k = 0; k < 10; k++) { const r = k % 2 ? sz * 0.22 : sz * 0.55, a = -Math.PI / 2 + k * Math.PI / 5; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); x.fill(); }
    else if (d.kind === 'ring') { x.lineWidth = sz * 0.14; x.arc(0, 0, sz * 0.45, 0, 7); x.stroke(); }
    else if (d.kind === 'tri') { x.moveTo(0, -sz * 0.5); x.lineTo(sz * 0.5, sz * 0.4); x.lineTo(-sz * 0.5, sz * 0.4); x.closePath(); x.fill(); }
    else if (d.kind === 'chevron') { x.lineWidth = sz * 0.16; x.moveTo(-sz * 0.5, -sz * 0.1); x.lineTo(0, sz * 0.3); x.lineTo(sz * 0.5, -sz * 0.1); x.moveTo(-sz * 0.5, -sz * 0.4); x.lineTo(0, 0); x.lineTo(sz * 0.5, -sz * 0.4); x.stroke(); }
    else if (d.kind === 'bar') { x.fillRect(-sz * 0.6, -sz * 0.12, sz * 1.2, sz * 0.24); }
    else { x.font = `${sz}px "${d.font}"`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, 0, 0); }
  };
  if (d.style === 'engrave') {
    x.fillStyle = x.strokeStyle = 'rgba(0,0,0,0.75)'; x.save(); x.translate(-0.8, -0.8); shape(); x.restore();
    x.fillStyle = x.strokeStyle = 'rgba(235,230,215,0.45)'; x.save(); x.translate(0.8, 0.8); shape(); x.restore();
    x.fillStyle = x.strokeStyle = 'rgba(20,18,16,0.55)'; shape();
  } else { x.fillStyle = x.strokeStyle = d.color; shape(); }
  const wear = d.style === 'stamp' ? Math.max(0.45, d.wear) : d.wear;
  if (wear > 0) {                                    // desgaste: falhas na tinta
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'destination-out';
    const n = Math.round(W * H * wear * 0.05);
    for (let k = 0; k < n; k++) { const px = hash2(k, d.id) * W, py = hash2(d.id, k) * H, r = 0.4 + hash2(k + 7, d.id) * 1.6 * wear; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); }
  }
  ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.rot * D2R); if (d.flip) ctx.scale(-1, 1);
  ctx.globalAlpha = d.style === 'stamp' ? 0.82 : d.style === 'paint' ? 0.94 : 1;
  ctx.drawImage(c, -W / 2, -H / 2); ctx.globalAlpha = 1;
  if (selected) { ctx.strokeStyle = 'rgba(224,96,122,0.9)'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1; ctx.strokeRect(-W / 2 + 6, -H / 2 + 6, W - 12, H - 12); ctx.setLineDash([]); }
  ctx.restore();
}
function decalForm() {
  return { kind: $('#decKind').value, text: $('#decText').value, font: $('#decFont').value, style: $('#decStyle').value, color: $('#decColor').value, size: DECAL_SIZE.size, rot: DECAL_SIZE.rot, wear: DECAL_SIZE.wear };
}
function placeDecal(si, x, y) {
  if (S.decalPending) {
    snapshot('decalque');
    const sk = skins[si], isl = sk.id[clamp(y | 0, 0, sk.h - 1) * sk.w + clamp(x | 0, 0, sk.w - 1)];
    const d = { id: Math.floor(Math.random() * 1e6), si, x, y, flip: isl >= 0 ? sk.mirror[isl] : 0, ...decalForm() };
    S.decals.push(d); S.di = S.decals.length - 1; S.decalPending = false;
    document.fonts && document.fonts.load(`${d.size}px "${d.font}"`).then(() => refreshResult(si)).catch(() => { });
    S.modifiedSkins.add(si); refreshResult(si); updateDecalsUI(); toast('Decalque aplicado — clique de novo para reposicionar', 'ok');
  } else if (S.decals[S.di]) {
    const d = S.decals[S.di], old = d.si; snapshot('mover decalque'); d.si = si; d.x = x; d.y = y;
    { const sk = skins[si], isl = sk.id[clamp(y | 0, 0, sk.h - 1) * sk.w + clamp(x | 0, 0, sk.w - 1)]; d.flip = isl >= 0 ? sk.mirror[isl] : 0; }
    refreshResult(si); if (old !== si) refreshResult(old);
  } else toast('Clique em "Adicionar e posicionar" primeiro', 'warn');
}
function editSelectedDecal() {
  const d = S.decals[S.di]; if (!d || S.decalPending) return;
  Object.assign(d, decalForm());
  document.fonts && document.fonts.load(`${d.size}px "${d.font}"`).then(() => refreshResult(d.si)).catch(() => { });
  refreshResult(d.si); updateDecalsUI(false);
}
function updateDecalsUI(rebuildForm = true) {
  const ul = $('#decals'); if (!ul) return; ul.innerHTML = '';
  if (!S.decals.length) ul.innerHTML = '<li class="muted">Nenhum decalque.</li>';
  S.decals.forEach((d, i) => {
    const li = document.createElement('li'); li.className = i === S.di ? 'on' : '';
    li.innerHTML = `<span>${d.kind === 'text' ? '“' + (d.text || '').replace(/</g, '&lt;') + '”' : { star: '★ Estrela', ring: '◯ Círculo', tri: '▲ Triângulo', chevron: '︾ Divisa', bar: '▬ Faixa' }[d.kind]}</span><small>${model.surfaces[d.si] ? model.surfaces[d.si].name : '?'} · ${d.style} · ${d.size}px</small><button class="ic" title="Apagar">✕</button>`;
    li.onclick = e => {
      if (e.target.tagName === 'BUTTON') { snapshot('apagar decalque'); S.decals.splice(i, 1); S.di = -1; refreshResult(d.si); updateDecalsUI(); return; }
      S.di = i; S.decalPending = false;
      $('#decKind').value = d.kind; $('#decText').value = d.text; $('#decFont').value = d.font; $('#decStyle').value = d.style; $('#decColor').value = d.color;
      DECAL_SIZE.size = d.size; DECAL_SIZE.rot = d.rot; DECAL_SIZE.wear = d.wear; $$('#decSliders .srow').forEach(r => r.sync());
      skins.forEach((_, k) => refreshResult(k)); updateDecalsUI(); setTool('decal');
    };
    ul.appendChild(li);
  });
}

// ---------------------------------------------------------------- UI: componentes
function slider(container, label, min, max, step, get, set, opts = {}) {
  const row = document.createElement('div'); row.className = 'srow';
  row.innerHTML = `<label>${label}</label><input type="range" min="${min}" max="${max}" step="${step}"><input type="number" min="${min}" max="${max}" step="${step}">`;
  const [r, n] = row.querySelectorAll('input');
  const sync = () => { const v = get(); r.value = v; n.value = +(+v).toFixed(3); };
  let snapped = false;
  const apply = (v, final) => {
    if (!snapped && opts.undo && model) { snapshot(opts.undo); snapped = true; }
    set(+v); n.value = +(+v).toFixed(3); r.value = v; if (final) snapped = false;
  };
  r.addEventListener('input', () => apply(r.value)); r.addEventListener('change', () => { snapped = false; });
  n.addEventListener('change', () => apply(n.value, true));
  r.addEventListener('dblclick', () => apply(opts.reset ?? 0, true));
  row.sync = sync; sync(); container.appendChild(row); return row;
}
const syncers = [];
function matThumb(key) {
  const m = MATS[key], c = document.createElement('canvas'); c.width = 72; c.height = 44;
  const x = c.getContext('2d'), im = x.createImageData(72, 44);
  for (let y = 0; y < 44; y++) for (let X = 0; X < 72; X++) {
    const j = (y * 72 + X) * 4, sh = 0.82 + 0.3 * (1 - y / 44) * (0.6 + 0.4 * fbm(X * 0.2, y * 0.2));
    let col;
    if (m.tex) col = TEX[m.tex](X * 3, y * 3, m);
    else { const pf = m.p === 'wood' ? 0.84 + 0.17 * Math.sin(y * 0.9 + fbm(X * 0.02, y * 0.1) * 11) : m.p === 'metal' ? 0.92 + 0.16 * fbm(X * 0.3, y * 0.3) : 0.95 + 0.1 * fbm(X * 0.1, y * 0.1); col = m.c.map(v => v * pf); }
    im.data[j] = col[0] * sh; im.data[j + 1] = col[1] * sh; im.data[j + 2] = col[2] * sh; im.data[j + 3] = 255;
  }
  x.putImageData(im, 0, 0); return c;
}
function buildMatGrid() {
  const cats = $('#matCats'); cats.innerHTML = '';
  CATS.forEach(([k, n]) => { const b = document.createElement('button'); b.textContent = n; b.className = k === S.matCat ? 'on' : ''; b.onclick = () => { S.matCat = k; buildMatGrid(); }; cats.appendChild(b); });
  const grid = $('#mats'); grid.innerHTML = '';
  const keys = MAT_ORDER.filter(k => MATS[k] && MATS[k].cat === S.matCat);
  if (!keys.length) grid.innerHTML = '<p class="muted" style="grid-column:1/-1">Nenhuma ainda — use "+ Importar textura".</p>';
  keys.forEach(k => {
    const b = document.createElement('button'); b.className = 'mat' + (k === S.mat ? ' on' : ''); b.dataset.mat = k; b.title = MATS[k].n;
    b.appendChild(MATS[k]._thumb || (MATS[k]._thumb = matThumb(k))); const sp = document.createElement('span'); sp.textContent = MATS[k].n; b.appendChild(sp);
    b.onclick = () => { S.mat = k; $$('.mat').forEach(x => x.classList.toggle('on', x === b)); if (S.tool !== 'material') setTool('material'); };
    if (MATS[k].custom) b.oncontextmenu = e => { e.preventDefault(); deleteCustomTex(k); };
    grid.appendChild(b);
  });
}
// texturas importadas pelo usuário (salvas no navegador)
async function importTexture(file) {
  const img = await loadImage(await fileToDataURL(file));
  const sc = Math.min(1, 256 / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.max(8, img.width * sc | 0); c.height = Math.max(8, img.height * sc | 0);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const key = 'user_' + Date.now(), name = file.name.replace(/\.\w+$/, '').slice(0, 24);
  registerImageTexture(key, name, c.getContext('2d').getImageData(0, 0, c.width, c.height), 1);
  const saved = JSON.parse(localStorage.getItem('cm_tex') || '[]'); saved.push({ key, name, url: c.toDataURL('image/jpeg', 0.85) });
  try { localStorage.setItem('cm_tex', JSON.stringify(saved)); } catch (e) { toast('Textura usada, mas não coube no armazenamento do navegador', 'warn'); }
  S.matCat = 'minhas'; S.mat = key; buildMatGrid(); setTool('material'); toast(`Textura "${name}" no banco (Minhas)`, 'ok');
}
async function loadCustomTextures() {
  let saved = []; try { saved = JSON.parse(localStorage.getItem('cm_tex') || '[]'); } catch (e) { }
  for (const t of saved) {
    try { const img = await loadImage(t.url); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); registerImageTexture(t.key, t.name, x.getImageData(0, 0, c.width, c.height)); } catch (e) { }
  }
}
function deleteCustomTex(k) {
  const saved = JSON.parse(localStorage.getItem('cm_tex') || '[]').filter(t => t.key !== k);
  localStorage.setItem('cm_tex', JSON.stringify(saved)); MAT_ORDER.splice(MAT_ORDER.indexOf(k), 1); buildMatGrid(); toast('Textura removida do banco');
}

function buildStaticUI() {
  buildMatGrid();
  const gl = $('#globalBox');
  [['Detalhe da skin original', 'detail', 0, 1.5, 0.01, 1], ['Desgaste nas bordas', 'wear', 0, 1, 0.01, 0.35], ['Envelhecimento', 'age', 0, 1, 0.01, 0.25], ['Sujeira geral', 'dirt', 0, 1, 0.01, 0.25], ['Brilho', 'bright', -0.4, 0.4, 0.01, 0], ['Contraste', 'contrast', 0.5, 1.8, 0.01, 1]]
    .forEach(([l, k, a, b, st, rs]) => syncers.push(slider(gl, l, a, b, st, () => S.global[k], v => { S.global[k] = v; queueComposite(); }, { undo: 'ajuste ' + l, reset: rs })));
  const fb = $('#fxBox');
  [['Sujeira nas cavidades', 'cavity'], ['Arranhões', 'scratches'], ['Ferrugem', 'rust'], ['Poeira e terra (por cima)', 'dust'], ['Pólvora no cano', 'burn'], ['Sangue', 'blood']]
    .forEach(([l, k]) => syncers.push(slider(fb, l, 0, 1, 0.01, () => S.fx[k], v => { S.fx[k] = v; skins.forEach((_, i) => S.modifiedSkins.add(i)); queueComposite(); }, { undo: l })));
  syncers.push(slider(fb, 'Semente (sangue)', 0, 50, 1, () => S.fx.seed, v => { S.fx.seed = v; queueComposite(); }, { reset: 3 }));
  const bb = $('#brushSliders');
  slider(bb, 'Tamanho', 2, 120, 1, () => S.brush.size, v => S.brush.size = v, { reset: 18 });
  slider(bb, 'Opacidade', 0.05, 1, 0.01, () => S.brush.opacity, v => S.brush.opacity = v, { reset: 0.6 });
  slider(bb, 'Dureza', 0, 0.95, 0.01, () => S.brush.hard, v => S.brush.hard = v, { reset: 0.4 });
  $('#brushColor').oninput = e => S.brush.color = e.target.value;
  $$('.swatch').forEach(s => s.onclick = () => { S.brush.color = s.dataset.c; $('#brushColor').value = s.dataset.c; setTool('brush'); });
  const ds = $('#decSliders');
  slider(ds, 'Tamanho', 6, 200, 1, () => DECAL_SIZE.size, v => { DECAL_SIZE.size = v; editSelectedDecal(); }, { reset: 28 });
  slider(ds, 'Rotação', -180, 180, 1, () => DECAL_SIZE.rot, v => { DECAL_SIZE.rot = v; editSelectedDecal(); });
  slider(ds, 'Desgaste', 0, 1, 0.01, () => DECAL_SIZE.wear, v => { DECAL_SIZE.wear = v; editSelectedDecal(); }, { reset: 0.25 });
  ['#decKind', '#decText', '#decFont', '#decStyle', '#decColor'].forEach(id => $(id).addEventListener('input', editSelectedDecal));
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
  // quadros-chave
  const ab = $('#keySliders');
  const T = () => animTarget();
  const kGet = (k, i, d = 0) => () => { const g = T(); if (!g || !model) return d; const v = interpKey(g, S.frame); return v ? (k === 's' ? v.s : v[k][i]) : d; };
  const kSet = (k, i) => v => {
    const g = T(); if (!g) return;
    const cur = interpKey(g, S.frame) || { t: Z3(), r: Z3(), s: 1 };
    const key = g.keys[S.frame] || { t: [...cur.t], r: [...cur.r], s: cur.s, e: $('#keyEase').value };
    if (k === 's') key.s = v; else key[k][i] = v;
    g.keys[S.frame] = key; updateGeometry(); updateTimeline(); updateAnimUI(false);
  };
  ['X', 'Y', 'Z'].forEach((a, i) => syncers.push(slider(ab, 'Desloc. ' + a, -30, 30, 0.05, kGet('t', i), kSet('t', i), { undo: 'chave' })));
  ['X', 'Y', 'Z'].forEach((a, i) => syncers.push(slider(ab, 'Rotação ' + a, -360, 360, 0.5, kGet('r', i), kSet('r', i), { undo: 'chave' })));
  syncers.push(slider(ab, 'Escala (0 = some)', 0, 2, 0.01, kGet('s', 0, 1), kSet('s', 0), { undo: 'chave', reset: 1 }));
  // geradores
  const gr = $('#genRecoil');
  slider(gr, 'Coice', 0, 8, 0.1, () => GOPT.recoil.kick, v => { GOPT.recoil.kick = v; liveGen('recoil'); }, { reset: 2.2, undo: 'recuo' });
  slider(gr, 'Subida do cano', 0, 25, 0.5, () => GOPT.recoil.rise, v => { GOPT.recoil.rise = v; liveGen('recoil'); }, { reset: 6, undo: 'recuo' });
  slider(gr, 'Lateral', 0, 3, 0.1, () => GOPT.recoil.side, v => { GOPT.recoil.side = v; liveGen('recoil'); }, { reset: 1, undo: 'recuo' });
  slider(gr, 'Ferrolho (dist.)', 0, 8, 0.1, () => GOPT.bolt.dist, v => { GOPT.bolt.dist = v; liveGen('bolt'); }, { reset: 3, undo: 'ferrolho' });
  const rl = $('#genReload');
  slider(rl, 'Inclinação', 0, 60, 1, () => GOPT.reload.tilt, v => { GOPT.reload.tilt = v; liveGen('reload'); }, { reset: 22, undo: 'recarga' });
  slider(rl, 'Queda do carreg.', 0, 30, 0.5, () => GOPT.reload.drop, v => { GOPT.reload.drop = v; liveGen('reload'); }, { reset: 14, undo: 'recarga' });
  // banco de animações
  const bank = $('#animBank');
  Object.entries(ANIM_BANK).forEach(([k, P]) => {
    const d = document.createElement('div'); d.className = 'bankcard'; d.dataset.k = k;
    d.innerHTML = `<b>${P.n}</b><small>Quadros ${P.clips.join(' / ')} · usa: ${P.needs}</small><button class="btn sm">Aplicar</button>`;
    d.querySelector('button').onclick = () => applyAnimBank(k); bank.appendChild(d);
  });
  // cartões de armas
  const wc = $('#weaponCards');
  Object.entries(WEAPONS).forEach(([k, w]) => {
    const b = document.createElement('button'); b.className = 'wcard';
    b.innerHTML = `<div class="th" style="background-image:url(weapons/${k}/thumb.png)"></div><span class="tag">${w.ac}</span><div class="bd"><b>${w.n}</b><small>${w.alt}</small><em>→ ${w.ww2}</em></div>`;
    b.onclick = () => loadBundled(k); wc.appendChild(b);
  });
}
const GOPT = { recoil: { kick: 2.2, rise: 6, side: 1 }, bolt: { dist: 3, axis: '-y' }, reload: { tilt: 22, drop: 14 } };
// os controles dos geradores aplicam na hora e mostram o quadro onde o efeito aparece
let liveT = 0;
function liveGen(name) {
  if (!model || S.mode === 'char') return;
  clearTimeout(liveT);
  liveT = setTimeout(() => {
    const opts = { ...(GOPT[name] || {}) };
    if (name === 'recoil') opts.side = opts.side || 0.0001;
    GEN[name](opts);
    const c = name === 'reload' ? clip(/reload/i) : clip(/shoot/i);
    if (c) { const f = name === 'reload' ? c[0] + Math.round((c[1] - c[0]) * 0.4) : name === 'bolt' ? c[0] + Math.max(1, Math.round((c[1] - c[0]) * 0.3)) : Math.min(c[1], c[0] + 1); S.playing = false; updatePlayBtn(); setFrame(f); }
    updateAll();
  }, 120);
}
function updateGlobalUI() { syncers.forEach(s => s.sync()); }

// ---------------------------------------------------------------- UI: atualização
function updateSelectionUI() {
  const n = S.sel.isl.size;
  $('#selInfo').textContent = n ? `${n} ilha(s) em "${model.surfaces[S.sel.si].name}"` : 'Clique no modelo (duplo-clique = peça inteira)';
  $('#btnGroup').disabled = !n;
}
function updateGroupsUI() {
  const ul = $('#groups'); ul.innerHTML = '';
  if (!S.groups.length) ul.innerHTML = '<li class="muted">Nenhum grupo. Selecione peças e clique em "Criar grupo".</li>';
  S.groups.forEach((g, i) => {
    const li = document.createElement('li'); li.className = i === S.gi && !S.animRoot ? 'on' : '';
    const nk = Object.keys(g.keys).length, par = g.parent >= 0 && S.groups[g.parent] ? ' · segue ' + S.groups[g.parent].name : '';
    li.innerHTML = `<input value="${g.name.replace(/"/g, '&quot;')}"><small>${model.surfaces[g.si].name} · ${g.isl.size} ilhas${nk ? ' · ' + nk + ' chaves' : ''}${par}</small><button title="Mostrar/ocultar peça" class="ic">${g.hidden ? '◌' : '●'}</button><button title="Apagar grupo" class="ic">✕</button>`;
    const [inp, eye, del] = [li.querySelector('input'), ...li.querySelectorAll('button')];
    li.onclick = e => { if (e.target === inp || e.target.tagName === 'BUTTON') return; S.gi = i; S.animRoot = false; updateAll(); };
    inp.onfocus = () => { if (S.gi !== i) { S.gi = i; S.animRoot = false; updateGeometry(); updateMeshUI(); updateTimeline(); updateAnimUI(); $$('#groups li').forEach((x, j) => x.classList.toggle('on', j === i)); } };
    inp.onchange = () => { g.name = inp.value; updateRecipesUI(); updateAnimTargets(); };
    eye.onclick = () => { snapshot('ocultar'); g.hidden = !g.hidden; updateAll(); };
    del.onclick = () => deleteGroup(i);
    ul.appendChild(li);
  });
}
function updateMeshUI() {
  const g = S.groups[S.gi];
  $('#meshGroup').textContent = g ? `Grupo: ${g.name}` : 'Selecione ou crie um grupo';
  $('#meshSliders').classList.toggle('disabled', !g); $('#pivotSliders').classList.toggle('disabled', !g);
  const sel = $('#groupParent');
  sel.innerHTML = '<option value="-1">— ninguém —</option>' + S.groups.map((x, i) => i === S.gi ? '' : `<option value="${i}">${x.name}</option>`).join('');
  sel.value = g ? (g.parent ?? -1) : -1; sel.disabled = !g;
  syncers.forEach(s => s.sync());
}
function updateAnimTargets() {
  const sel = $('#animTarget');
  sel.innerHTML = '<option value="root">◆ Arma inteira (raiz)</option>' + S.groups.map((g, i) => `<option value="${i}">${g.name}</option>`).join('');
  sel.value = S.animRoot ? 'root' : (S.gi >= 0 ? S.gi : 'root');
}
function updateAnimUI(full = true) {
  const g = animTarget();
  const k = g && g.keys[S.frame];
  $('#animGroup').textContent = g ? `${g === S.root ? 'Arma inteira' : g.name} · quadro ${S.frame}${k ? ' · ◆ chave' : ''}` : 'Escolha o que animar';
  if (k) $('#keyEase').value = k.e || 'smooth';
  $('#keySliders').classList.toggle('disabled', !g);
  $('#frameCount').value = model ? model.nf : 16;
  if (full) { updateAnimTargets(); }
  syncers.forEach(s => s.sync());
}
function clipOf(f) {
  for (const a of anims()) if (f >= a.start && f < a.start + a.count && a.count > 1 || (a.count === 1 && f === a.start && /idle/i.test(a.name))) return /idle/i.test(a.name) ? 'idle' : /shoot|throw/i.test(a.name) ? 'shoot' : /reload/i.test(a.name) ? 'reload' : 'other';
  return '';
}
function updateTimeline() {
  if (!model) return;
  const tl = $('#frames'); const g = animTarget(); const [a, b] = playRange();
  if (tl.children.length !== model.nf) { tl.innerHTML = ''; for (let f = 0; f < model.nf; f++) { const d = document.createElement('button'); d.textContent = f; d.onclick = () => { S.playing = false; updatePlayBtn(); setFrame(f); }; tl.appendChild(d); } }
  [...tl.children].forEach((d, f) => { const c = clipOf(f); d.className = (f === S.frame ? 'cur ' : '') + (g && g.keys[f] ? 'key ' : '') + (f >= a && f <= b && S.animIdx >= 0 ? 'rng ' : '') + (c ? 'c-' + c : ''); d.title = c ? `quadro ${f} · ${c}` : `quadro ${f}`; });
  const sel = $('#animSel'), list = anims(), want = ['<option value="-1">Todos os quadros</option>', ...list.map((x, i) => `<option value="${i}">${x.name} (${x.start}–${x.start + x.count - 1})</option>`)].join('');
  if (sel.dataset.h !== want) { sel.innerHTML = want; sel.dataset.h = want; }
  sel.value = S.animIdx;
}
function updatePlayBtn() { $('#play').textContent = S.playing ? '❚❚' : '▶'; }
function updateSurfacesUI() {
  const ul = $('#surfs'); ul.innerHTML = '';
  model.surfaces.forEach((s, i) => {
    const li = document.createElement('li'); li.className = i === S.editSkin ? 'on' : '';
    li.innerHTML = `<span>${s.name}${s.generated ? ' <small style="display:inline;color:var(--acc)">nova</small>' : ''}</span><small>${s.nv} vért · ${s.ntri} tri · ${S.skinFiles[i]}</small><button class="ic" title="Mostrar/ocultar na visualização">${s.hiddenView ? '◌' : '●'}</button>`;
    li.onclick = e => { if (e.target.tagName === 'BUTTON') { s.hiddenView = !s.hiddenView; updateGeometry(); updateSurfacesUI(); return; } S.editSkin = i; updateSurfacesUI(); draw2D(); };
    ul.appendChild(li);
  });
}
function updateAll() {
  if (!model) return;
  updateForgeUI();
  updateGeometry(); updateSelectionUI(); updateGroupsUI(); updateMeshUI(); updateAnimUI(); updateTimeline(); updateSurfacesUI(); updateGlobalUI(); updateRecipesUI(); updateDecalsUI(); updateBankUI(); draw2D();
  $('#stats').textContent = `${model.surfaces.reduce((a, s) => a + s.ntri, 0)} tri · ${model.nf} quadros · ${S.groups.length} grupos`;
  $('#curWeapon').textContent = S.weapon ? `${S.weapon}` : '';
  $$('.bankcard').forEach(c => c.classList.toggle('rec', c.dataset.k === S.weapon));
}

// ---------------------------------------------------------------- pipeline
function goStep(n) {
  if (n > 1 && !model) { toast('Escolha uma arma primeiro', 'warn'); n = 1; }
  if (game.on) game.exit();
  S.step = n; document.body.dataset.step = n;
  if (n === 5 && model) { const key = (S.prop && S.prop.id) || (S.preset && S.preset.id) || S.weapon; if (S._cfFor !== key) { S._cfFor = key; cfDefaults(); } }
  $('.steps button[data-step="2"]').lastChild.textContent = S.mode === 'char' ? 'Uniforme' : 'Modelagem';
  $$('.steps button').forEach(b => { const k = +b.dataset.step; b.classList.toggle('on', k === n); b.classList.toggle('done', !!model && k < n); b.disabled = k > 1 && !model; });
  $('#stepPrev').style.visibility = n > 2 ? '' : 'hidden';
  $('#stepNext').textContent = n === 5 ? 'Instalar no jogo' : 'Próximo →';
  if (n !== 3 && ['material', 'brush', 'eraser', 'picker', 'decal'].includes(S.tool)) setTool('nav');
  if (n === 3 && S.tool === 'nav') setTool('material');
  if (n !== 4) S.playing = false;
  updatePlayBtn();
  requestAnimationFrame(() => { resize(); draw2D(); });
  if (model) skins.forEach((_, i) => refreshResult(i));
}

// ---------------------------------------------------------------- ligações
function bindUI() {
  $$('.steps button').forEach(b => b.onclick = () => goStep(+b.dataset.step));
  $('#stepPrev').onclick = () => goStep(Math.max(2, S.step - 1));
  $('#stepNext').onclick = () => S.step === 5 ? installToGame().catch(err => toast(err.message, 'err')) : goStep(S.step + 1);
  $$('[data-tool]').forEach(b => b.onclick = () => setTool(b.dataset.tool));
  $$('.subtabs button').forEach(b => b.onclick = () => {
    const pane = b.closest('.pane');
    pane.querySelectorAll('.subtabs button').forEach(x => x.classList.toggle('on', x === b));
    pane.querySelectorAll('.sub').forEach(t => t.classList.toggle('on', t.id === b.dataset.sub));
    if (b.dataset.sub === 't-brush' && !['brush', 'eraser'].includes(S.tool)) setTool('brush');
    if (b.dataset.sub === 't-decal') setTool('decal');
    if (b.dataset.sub === 't-bank') setTool('material');
  });
  $$('[data-cam]').forEach(b => b.onclick = () => frameCamera(b.dataset.cam));
  $('#openDir').onchange = e => openFiles(e.target.files).then(() => model && goStep(2)).catch(err => toast(err.message, 'err'));
  $('#openFiles').onchange = e => openFiles(e.target.files).then(() => model && goStep(2)).catch(err => toast(err.message, 'err'));
  $('#weaponName').onchange = e => { S.weapon = e.target.value.trim() || 'arma'; updateAll(); };
  $('#btnZip').onclick = () => exportZip().catch(err => toast(err.message, 'err'));
  $('#btnInstall').onclick = () => installToGame().catch(err => toast(err.message, 'err'));
  $('#btnGameDir').onclick = () => connectGameDir();
  $('#btnRestore').onclick = () => restoreOriginal().catch(err => toast(err.message, 'err'));
  $('#btnMD3').onclick = () => model && download('tris_high.md3', new Blob([exportMD3()]));
  $('#btnSkin').onclick = async () => model && download(baseName(S.skinFiles[S.editSkin]), await skinBlob(S.editSkin, /\.png$/i.test(S.skinFiles[S.editSkin]) ? 'image/png' : 'image/jpeg'));
  $('#btnCfg').onclick = () => model && download('md3.cfg', new Blob([S.cfg]));
  $('#btnSave').onclick = () => saveProject(); $('#btnSave2').onclick = () => saveProject();
  $('#btnShot').onclick = () => { renderer.render(scene, camera); canvas.toBlob(b => download(`${S.weapon}_preview.png`, b)); };
  $('#btnGroup').onclick = createGroup;
  $('#btnClearSel').onclick = () => { S.sel = { si: -1, isl: new Set() }; updateSelectionUI(); updateColors(); draw2D(); };
  $('#btnSelPiece').onclick = () => { if (!S.sel.isl.size) return; const s = model.surfaces[S.sel.si]; const ps = new Set([...S.sel.isl].map(i => s.piece[i])); for (let i = 0; i < s.nIsl; i++) if (ps.has(s.piece[i])) S.sel.isl.add(i); updateSelectionUI(); updateColors(); draw2D(); };
  $('#btnSelGroup').onclick = () => { const g = S.groups[S.gi]; if (!g) return; S.sel = { si: g.si, isl: new Set(g.isl) }; updateSelectionUI(); updateColors(); draw2D(); };
  $('#btnAddToGroup').onclick = () => { const g = S.groups[S.gi]; if (!g || S.sel.si !== g.si) return toast('Seleção e grupo precisam estar na mesma parte', 'warn'); snapshot('adicionar ao grupo'); S.groups.forEach(o => { if (o !== g && o.si === g.si) S.sel.isl.forEach(i => o.isl.delete(i)); }); S.sel.isl.forEach(i => g.isl.add(i)); updateAll(); };
  $('#btnApplySel').onclick = () => { if (!S.sel.isl.size) return toast('Selecione peças primeiro', 'warn'); assignMaterial(S.sel.si, [...S.sel.isl], S.mat); };
  $('#btnClearMatSel').onclick = () => { if (!S.sel.isl.size) return toast('Selecione peças primeiro', 'warn'); assignMaterial(S.sel.si, [...S.sel.isl], null); };
  $('#texImport').onchange = e => e.target.files[0] && importTexture(e.target.files[0]).catch(err => toast(err.message, 'err'));
  $('#btnClearPaint').onclick = () => { if (!model) return; snapshot('limpar pintura'); const sk = skins[S.editSkin]; sk.overlay.getContext('2d').clearRect(0, 0, sk.w, sk.h); refreshResult(S.editSkin); };
  $('#btnResetSkin').onclick = () => { if (!model) return; snapshot('resetar skin'); S.islandMat[S.editSkin].clear(); const sk = skins[S.editSkin]; sk.overlay.getContext('2d').clearRect(0, 0, sk.w, sk.h); S.decals = S.decals.filter(d => d.si !== S.editSkin); composite(S.editSkin); updateDecalsUI(); };
  $('#skinFile').onchange = e => e.target.files[0] && replaceSkin(e.target.files[0]).catch(err => toast(err.message, 'err'));
  $('#wireToggle').onchange = e => { S.showWire = e.target.checked; draw2D(); };
  $('#tagToggle').onchange = e => { S.showTag = e.target.checked; updateGeometry(); };
  $('#wire3d').onchange = e => meshes.forEach(m => { m.material.wireframe = e.target.checked; });
  $$('[data-preset]').forEach(b => b.onclick = () => applyPreset(b.dataset.preset));
  $$('[data-prim]').forEach(b => b.onclick = () => {
    if (!model) return; snapshot('peça nova');
    const t = b.dataset.prim, pos = t === 'shell' ? defaultPort() : t === 'cyl' || t === 'bullet' ? (m => [m[0], m[1] - 5, m[2]])(muzzle()) : [...S.root.pivot];
    const r = addPrimitive({ type: t, pos, rot: t === 'shell' || t === 'pin' ? [0, 0, 90] : [0, 0, 0] }, { silent: true }); S.gi = r.gi; updateAll();
    toast(`Peça criada: grupo "${S.groups[r.gi].name}". Ajuste com Mover/Girar/Escala.`, 'ok');
  });
  $('#btnRig').onclick = () => applyRig();
  $('#btnAddMap').onclick = () => addPropToMap().catch(err => toast(err.message, 'err'));
  $$('.btnCopyMM').forEach(b => b.onclick = () => { navigator.clipboard && navigator.clipboard.writeText(mapmodelLine()); toast('Linha copiada: ' + mapmodelLine(), 'ok'); });
  $('#refToggle').onchange = e => { S.showRef = e.target.checked; refMan.visible = S.mode === 'prop' && S.showRef; };
  $('#btnPropReset').onclick = () => S.prop && loadProp(S.propDef || S.prop.id, S.prop.vars, true);
  $('#tex2k').onchange = async e => {
    S.tex2k = e.target.checked;
    if (S.mode === 'prop' && S.propDef) await loadProp(S.propDef, S.prop.vars, true);
    else if (S.presetDef) await loadPreset(S.presetDef);
    else return toast('A textura 2K vale para modelos do arsenal, Forja, importados e mapmodels', 'warn');
    goStep(3);
  };
  $('#charKit').onchange = e => { if (!S.char) return; S.char.kitOn = e.target.checked; S.char.kit = e.target.checked; S.modifiedSkins.add(0); composite(0); };
  $('#charGear').onchange = e => { if (!S.char) return; S.char.gear3d = e.target.checked; refreshGear(); updateAll(); };
  $('#charHelmet').onchange = e => { if (!S.char) return; S.char.helmet3d = e.target.value || null; refreshGear(); updateAll(); };
  try { localStorage.removeItem('cm_gh_token'); localStorage.removeItem('cm_gh_repo'); localStorage.removeItem('cm_cf_author'); } catch (e) { }
  cfShowAccount(null); if (cfKey()) cfUseKey(cfKey());
  $('#cfConnect').onclick = async () => { $('#cfStatus').textContent = 'Entre com a conta oficial na janela do CubeForge e clique em “Autorizar o CUBE MAKER”…'; try { const d = await cfConnect(); if (await cfUseKey(d.key, d.user)) toast('CUBE MAKER conectado ao CubeForge', 'ok'); } catch (e) { $('#cfStatus').textContent = '✖ ' + e.message; } };
  $('#cfLogout').onclick = () => { try { localStorage.removeItem('cm_cf_key'); } catch (e) { } cfShowAccount(null); $('#cfStatus').textContent = 'Desconectado neste navegador. Para desligar a chave de vez, use “Desconectar” em Minha conta no CubeForge.'; };
  $('#cfKeySave').onclick = () => { const k = $('#cfKeyIn').value.trim(); if (k) cfUseKey(k).then(ok => { if (ok) { $('#cfKeyIn').value = ''; $('.cfbox details').open = false; } }); };
  $('#cfPublish').onclick = cfPublish;
  $('#cfZip').onclick = async () => { try { const P = await cfPackage(); download(`CUBEFORGE_${P.slug}.zip`, P.blob); $('#cfStatus').textContent = `Pacote de ${P.tamanho} baixado.`; } catch (e) { toast(e.message, 'err'); } };
  $('#sndShot').onclick = async () => { if (!S.sound) return toast('Abra uma arma primeiro', 'warn'); play((await soundPCM()).shot); };
  $('#sndReload').onclick = async () => { if (!S.sound) return toast('Abra uma arma primeiro', 'warn'); play((await soundPCM()).rel); };
  $('#sndReset').onclick = () => { if (S.presetDef) { S.sound.p = soundPreset(S.presetDef.slot, S.presetDef.id); buildSoundUI(); } };
  $('#sndRandom').onclick = () => { if (!S.sound) return; Object.keys(S.sound.p).forEach(k => S.sound.p[k] = clamp(S.sound.p[k] + (Math.random() - 0.5) * 0.3, 0, 1)); buildSoundUI(); $('#sndShot').click(); };
  $('#soundInstall').onchange = e => { if (S.sound) S.sound.install = e.target.checked; };
  $('#sndDownload').onclick = async () => { if (!S.sound) return; const { shot, rel } = await soundPCM(); download(`${(S.preset || {}).id || 'arma'}_tiro.ogg`, await toOgg(shot)); download(`${(S.preset || {}).id || 'arma'}_recarga.ogg`, await toOgg(rel)); };
  const cena = createScene({ toast, download }); window.CM_cena = cena;
  $('#btnScene').onclick = () => cena.open();
  $('#impFile').onchange = e => e.target.files[0] && importFile(e.target.files[0]);
  ['x', 'y', 'z'].forEach((a, i) => $('#impRot' + a.toUpperCase()).onclick = () => { if (!S.imp) return; S.imp.rot[i] = (S.imp.rot[i] + 90) % 360; applyImport(); });
  $('#impFlip').onclick = () => { if (!S.imp) return; S.imp.rot[2] = (S.imp.rot[2] + 180) % 360; applyImport(); };
  $('#impApply').onclick = () => { if (!S.imp) return; S.imp.size = +$('#impSize').value || S.imp.size; S.imp.off = [0, +$('#impOffY').value || 0, +$('#impOffZ').value || 0]; S.imp.target = $('#impTarget').value; applyImport(); };
  $('#impTarget').onchange = e => { if (!S.imp) return; S.imp.target = e.target.value; S.imp.size = IMP_SIZE[e.target.value] || 1500; $('#impSize').value = S.imp.size; applyImport(); };
  $('#forgeName').onchange = () => { S.forgeName = $('#forgeName').value; if (S.preset) S.preset.n = S.forgeName; };
  $('#openChar').onchange = e => openCharacterFolder(e.target.files).catch(err => toast(err.message, 'err'));
  $$('[data-ins]').forEach(b => b.onclick = () => addInsignia(b.dataset.ins));
  const charSync = () => { if (!S.char) return; S.char.target = $('#charTargetNick').checked ? 'nick' : 'team'; S.char.team = $('#charTeam').value; S.char.slot = $('#charSlot').value; S.char.nick = $('#charNick').value.trim(); S.char.nickTeam = $('#charNickTeam').value; S.char.multi = $('#charMulti').checked; $('#charPath').textContent = charTarget(); };
  ['#charTargetTeam', '#charTargetNick', '#charTeam', '#charSlot', '#charNick', '#charNickTeam', '#charMulti'].forEach(id => $(id).addEventListener('input', charSync));
  $('#groupParent').onchange = e => { const g = S.groups[S.gi]; if (!g) return; snapshot('hierarquia'); g.parent = +e.target.value; updateAll(); };
  $('#btnHideGroup').onclick = () => { const g = S.groups[S.gi]; if (!g) return; snapshot('ocultar'); g.hidden = !g.hidden; updateAll(); };
  $('#btnResetGroup').onclick = () => { const g = S.groups[S.gi]; if (!g) return; snapshot('resetar grupo'); g.t = Z3(); g.r = Z3(); g.s = [1, 1, 1]; updateAll(); };
  $('#btnDecAdd').onclick = () => { if (!model) return; S.decalPending = true; S.di = -1; setTool('decal'); updateDecalsUI(); toast('Clique na arma ou na vista UV para colocar o decalque'); };
  // animação
  $$('[data-gen]').forEach(b => b.onclick = () => {
    const g = b.dataset.gen, o = g === 'recoil' ? GOPT.recoil : g === 'bolt' ? GOPT.bolt : g === 'reload' ? GOPT.reload : {};
    runGen(g, o, b.textContent);
  });
  $('#animTarget').onchange = e => { const v = e.target.value; if (v === 'root') S.animRoot = true; else { S.animRoot = false; S.gi = +v; } updateAll(); };
  $('#keyEase').onchange = e => { const g = animTarget(); if (!g || !g.keys[S.frame]) return; snapshot('curva'); g.keys[S.frame].e = e.target.value; updateGeometry(); };
  let keyClip = null;
  $('#btnCopyKey').onclick = () => { const g = animTarget(); if (!g) return; const k = interpKey(g, S.frame); keyClip = k ? JSON.parse(JSON.stringify({ ...k, e: (g.keys[S.frame] || {}).e })) : null; toast(keyClip ? 'Chave copiada' : 'Nada para copiar'); };
  $('#btnPasteKey').onclick = () => { const g = animTarget(); if (!g || !keyClip) return; snapshot('colar chave'); g.keys[S.frame] = JSON.parse(JSON.stringify(keyClip)); updateAll(); };
  $('#btnDelKey').onclick = () => { const g = animTarget(); if (!g || !g.keys[S.frame]) return; snapshot('apagar chave'); delete g.keys[S.frame]; updateAll(); };
  $('#btnClearKeys').onclick = () => { const g = animTarget(); if (!g) return; snapshot('limpar chaves'); g.keys = {}; updateAll(); };
  $('#btnClips').onclick = () => model && assembleClips(+$('#clipIdle').value, +$('#clipShoot').value, +$('#clipReload').value);
  $('#btnFrames').onclick = () => { if (!model) return; snapshot('quadros'); setFrameCount(+$('#frameCount').value); };
  $('#btnSaveAnim').onclick = () => saveMyAnim($('#myAnimName').value.trim());
  $('#cfgText').oninput = e => { S.cfg = e.target.value; updateTimeline(); };
  $('#play').onclick = () => { if (!model) return; S.playing = !S.playing; updatePlayBtn(); };
  $('#animSel').onchange = e => { S.animIdx = +e.target.value; const [a] = playRange(); setFrame(a); };
  $('#fps').onchange = e => S.fps = clamp(+e.target.value || 25, 1, 60);
  $('#prevF').onclick = () => model && setFrame(S.frame > 0 ? S.frame - 1 : model.nf - 1);
  $('#nextF').onclick = () => model && setFrame((S.frame + 1) % model.nf);
  $('#btnGame').onclick = async () => { await armGameSounds().catch(() => {}); game.enter(); };
  $('#btnUndo').onclick = undo; $('#btnRedo').onclick = redo;
  $('#btnHelp').onclick = () => $('#help').classList.toggle('show');
  $('#help').onclick = e => { if (e.target.id === 'help' || e.target.classList.contains('close')) $('#help').classList.remove('show'); };
  window.addEventListener('keydown', e => {
    if (game.on) return;
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redo(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 's') { e.preventDefault(); saveProject(); return; }
    if (S.step === 3 && 'mbeid'.includes(k) && k) setTool({ m: 'material', b: 'brush', e: 'eraser', i: 'picker', d: 'decal' }[k]);
    if (k === 'v') setTool('nav');
    else if (k === 'g') createGroup(); else if (k === 'f') frameCamera('orbit'); else if (k === 'p') frameCamera('fps');
    else if (k === ' ' && S.step === 4) { e.preventDefault(); S.playing = !S.playing; updatePlayBtn(); }
    else if (k === 'arrowleft') $('#prevF').click(); else if (k === 'arrowright') $('#nextF').click();
    else if (k === '[') { S.brush.size = Math.max(2, S.brush.size - 3); $$('#brushSliders .srow').forEach(r => r.sync()); }
    else if (k === ']') { S.brush.size = Math.min(120, S.brush.size + 3); $$('#brushSliders .srow').forEach(r => r.sync()); }
    else if (k === 'escape') $('#btnClearSel').click();
  });
  const drop = async e => {
    e.preventDefault(); document.body.classList.remove('dropping');
    const files = await collectDropped(e.dataTransfer);
    openFiles(files).then(() => model && goStep(Math.max(2, S.step))).catch(err => toast(err.message, 'err'));
  };
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', drop);
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


// ---------------------------------------------------------------- Modo Jogo + ciclo
const game = createGame({
  THREE, scene, camera, controls, canvas, root, toast, anims,
  model: () => model, setFrame: f => setFrame(f), getFrame: () => S.frame, fps: () => S.fps, weapon: () => S.weapon,
  hasPrim: re => S.groups.some(g => g.prim && re.test(g.name)),
  tagWorld: () => { root.updateWorldMatrix(true, true); return tagMarker.getWorldPosition(new THREE.Vector3()); },
  setGameMode: on => { S.gaming = on; document.body.classList.toggle('gaming', on); grid.visible = !on; updateGeometry(); requestAnimationFrame(resize); },
});
let last = performance.now(), acc = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (game.on) game.update(dt, now);
  else {
    if (model && S.playing) {
      acc += dt;
      if (acc >= 1 / S.fps) { acc = 0; const [a, b] = playRange(); setFrame(S.frame >= b || S.frame < a ? a : S.frame + 1); }
    }
    controls.update();
  }
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

buildStaticUI(); buildArsenalUI(); buildPropUI(); bindUI(); setTool('nav'); resize(); initGameDir(); defaultHands();
loadCustomTextures().then(() => buildMatGrid());
camera.position.set(40, 25, 40); controls.target.set(0, 0, -10);
requestAnimationFrame(loop);
goStep(1);
function thumbnail(w = 480, h = 300, hideHands = false) {
  const bg = scene.background, gv = grid.visible, tv = tagMarker.visible, pv = pivotMarker.visible, ex = renderer.toneMappingExposure;
  const saved = { p: camera.position.clone(), t: controls.target.clone() };
  scene.background = new THREE.Color(0x121317); grid.visible = tagMarker.visible = pivotMarker.visible = false; renderer.toneMappingExposure = 1.9;
  meshes.forEach(m => { m.userData.selOv.visible = m.userData.grpOv.visible = false; m.visible = !((hideHands || ['subgun', 'assault', 'sniper', 'carbine', 'shotgun', 'pistol'].includes(S.weapon)) && model.surfaces[m.userData.si].name === 'hands'); });
  const pr = renderer.getPixelRatio(); renderer.setPixelRatio(1); renderer.setSize(w, h, false);
  const fov = camera.fov; camera.fov = 30; camera.aspect = w / h; camera.updateProjectionMatrix();
  const box = new THREE.Box3(); meshes.forEach(m => { if (!m.visible) return; m.geometry.computeBoundingBox(); box.union(m.geometry.boundingBox.clone().applyMatrix4(root.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3()), dim = box.getSize(new THREE.Vector3());
  const tv2 = Math.tan(15 * D2R), th2 = tv2 * camera.aspect;
  const rv = refMan.visible; refMan.visible = false;
  if (S.mode === 'prop') {                            // mapmodel: vista 3/4 de cima, enquadrada pela esfera
    const r = dim.length() / 2, dist = r / Math.sin(Math.min(15, Math.atan(th2) / D2R) * D2R) * (dim.length() > 300 ? 0.72 : 0.9);
    camera.position.copy(c).add(new THREE.Vector3(0.95, 0.62, 0.8).normalize().multiplyScalar(dist)); camera.lookAt(c);
  } else {
    const dist = Math.max(Math.max(dim.z, dim.x) / 2 / th2, dim.y / 2 / tv2) * 1.12 + Math.min(dim.x, dim.z) / 2;
    camera.position.copy(c).add(new THREE.Vector3(1, 0.18, 0.22).normalize().multiplyScalar(dist)); camera.lookAt(c);
  }
  renderer.render(scene, camera);
  const out = document.createElement('canvas'); out.width = w; out.height = h; out.getContext('2d').drawImage(renderer.domElement, 0, 0);
  renderer.setPixelRatio(pr); camera.fov = fov; resize();
  scene.background = bg; grid.visible = gv; tagMarker.visible = tv; pivotMarker.visible = pv; renderer.toneMappingExposure = ex;
  meshes.forEach(m => m.visible = true); refMan.visible = rv; updateColors(); camera.position.copy(saved.p); controls.target.copy(saved.t); controls.update();
  return out.toDataURL('image/png');
}
function viewChar(v = 'front', zoom = 1) {
  const box = new THREE.Box3(); meshes.forEach(m => box.expandByObject(m));
  const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3()).length();
  const q = new THREE.Quaternion(); root.getWorldQuaternion(q);
  const f = new THREE.Vector3(1, v === 'back' ? 0.9 : -0.55, 0).applyQuaternion(q).multiplyScalar(v === 'back' ? -1 : 1); f.y = 0.25; f.normalize();
  if (zoom > 1) c.y += sz * 0.12;
  camera.position.copy(c).addScaledVector(f, sz * 1.25 / zoom); controls.target.copy(c); camera.lookAt(c); controls.update();
}
window.CM = { cfPackage, cfDefaults, refreshGear, soundPCM, viewChar, toOgg, importFile, loadProp, PROPS, addPropToMap, packageFiles, startForge, forgeDef, loadCharacter, applyUniform, addInsignia, UNIFORMS, charTarget, loadPreset, ARSENAL, _i: { THREE, get meshes() { return meshes; }, camera, renderer, scene, root, grid, tagMarker, pivotMarker, controls, resize }, debugBox: () => meshes.map(m => { m.geometry.computeBoundingBox(); const b = m.geometry.boundingBox; return [m.visible, b.min.toArray().map(v => +v.toFixed(1)), b.max.toArray().map(v => +v.toFixed(1)), m.geometry.index.count, m.geometry.attributes.position.array.slice(0, 3).join(',')]; }), thumbnail, S, get model() { return model; }, get skins() { return skins; }, loadBundled, loadDemo, exportMD3, createGroup, selectIsland, assignMaterial, applyPreset, applyAnimBank, runGen, setFrame, frameCamera, setTool, parseMD3, parseMD2, undo, captureState, goStep, game, placeDecal, addPrimitive, assembleClips, interpKey };
{
  const h = location.hash.slice(1);
  if (h === 'demo') loadBundled('subgun'); else if (WEAPONS[h]) loadBundled(h);
}
