// CUBE MAKER — importar modelos de fora (Blender, Sketchfab…): OBJ, GLB e GLTF embutido.
// Cada malha/material vira uma peça; o nome decide o material inicial e o grupo de animação.
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// OBJ e glTF são Y-para-cima; o CUBE MAKER é Z-para-cima
const YUP = new THREE.Matrix4().makeRotationX(Math.PI / 2);
export async function readExternal(file) {
  const ext = file.name.split('.').pop().toLowerCase(), meshes = [];
  let root;
  if (ext === 'obj') root = new OBJLoader().parse(await file.text());
  else if (ext === 'glb' || ext === 'gltf') { const data = ext === 'glb' ? await file.arrayBuffer() : await file.text(); root = await new Promise((res, rej) => new GLTFLoader().parse(data, '', g => res(g.scene), rej)); }
  else throw new Error('Formato não suportado: use .obj, .glb ou .gltf (com tudo embutido)');
  root.updateMatrixWorld(true);
  let meta = root.userData && root.userData.cubemaker;
  root.traverse(o => { if (!meta && o.userData && o.userData.cubemaker && o.userData.cubemaker.v) meta = o.userData.cubemaker; });
  root.traverse(o => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const base = o.geometry.clone(); base.applyMatrix4(o.matrixWorld); base.applyMatrix4(YUP);
    const flip = o.matrixWorld.determinant() < 0;
    const groups = base.groups && base.groups.length > 1 ? base.groups : [{ start: 0, count: base.index ? base.index.count : base.attributes.position.count, materialIndex: 0 }];
    groups.forEach(gr => {
      const m = mats[gr.materialIndex] || mats[0] || {};
      const g = subGeometry(base, gr.start, gr.count, flip); if (!g) return;
      const c = m.color ? [m.color.r, m.color.g, m.color.b].map(v => Math.round(Math.pow(v, 1 / 2.2) * 255)) : [150, 150, 150];
      const img = m.map && m.map.image ? m.map.image : null;
      meshes.push({ name: (o.name || 'peça') + (groups.length > 1 ? '_' + (m.name || gr.materialIndex) : ''), matName: m.name || '', color: c, geo: g, img, info: (o.userData && o.userData.cubemaker) || null });
    });
  });
  if (!meshes.length) throw new Error('Nenhuma malha encontrada no arquivo');
  const tris = meshes.reduce((n, m) => n + m.geo.index.count / 3, 0);
  const textured = meshes.every(m => m.img && m.geo.attributes.uv);
  return { name: file.name.replace(/\.[^.]+$/, ''), meshes, tris, meta: meta || null, textured };
}
function subGeometry(src, start, count, flip) {
  const P = src.attributes.position, UV = src.attributes.uv, idx = src.index ? src.index.array : null, pos = [], uv = [], map = new Map(), out = [];
  for (let i = start; i < start + count; i++) {
    const v = idx ? idx[i] : i; let k = map.get(v);
    if (k === undefined) { k = pos.length / 3; map.set(v, k); pos.push(P.getX(v), P.getY(v), P.getZ(v)); if (UV) uv.push(UV.getX(v), UV.getY(v)); }
    out.push(k);
  }
  if (out.length < 3) return null;
  if (flip) for (let t = 0; t < out.length; t += 3) { const x = out[t + 1]; out[t + 1] = out[t + 2]; out[t + 2] = x; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); if (UV) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(out); return g;
}

// ida e volta com o Blender: mantém UV e textura (várias imagens viram um atlas), grupos pelo nome
// devolve um objeto no formato do buildPreset (mm, Z para cima, triângulos na ordem do MD3)
export function roundtripBp(imp, o = {}) {
  const k = 1000 * (o.scale || 1);
  const imgs = []; imp.meshes.forEach(m => { if (!imgs.includes(m.img)) imgs.push(m.img); });
  const n = Math.ceil(Math.sqrt(imgs.length)), single = imgs.length === 1;
  const iw = i => i.naturalWidth || i.width, ih = i => i.naturalHeight || i.height;
  const AW = single ? Math.min(2048, iw(imgs[0])) : 2048, AH = single ? Math.min(2048, ih(imgs[0])) : 2048;
  const image = document.createElement('canvas'); image.width = AW; image.height = AH;
  const cx = image.getContext('2d'), cw = AW / n, ch = AH / n;
  imgs.forEach((im, i) => cx.drawImage(im, (i % n) * cw, Math.floor(i / n) * ch, cw, ch));
  const pos = [], nrm = [], uv = [], tris = [], vpart = [], parts = [];
  const fr = x => single ? x : Math.min(0.998, Math.max(0.002, x - Math.floor(x)));
  imp.meshes.forEach((m, pi) => {
    const g = m.geo.clone(); g.computeVertexNormals();
    const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, I = g.index.array, base = pos.length / 3, ii = imgs.indexOf(m.img);
    const ox = (ii % n) / n, oy = Math.floor(ii / n) / n;
    for (let v = 0; v < P.count; v++) {
      pos.push(P.getX(v) * k, P.getY(v) * k, P.getZ(v) * k); nrm.push(N.getX(v), N.getY(v), N.getZ(v));
      uv.push(single ? U.getX(v) : ox + fr(U.getX(v)) / n, single ? U.getY(v) : oy + fr(U.getY(v)) / n); vpart.push(pi);
    }
    for (let t = 0; t < I.length; t += 3) tris.push(base + I[t], base + I[t + 2], base + I[t + 1]);   // glTF (anti-horário) → MD3
    const info = m.info || {};
    let pivot = null;
    if (info.pivot) { const p = new THREE.Vector3(...info.pivot).applyMatrix4(YUP).multiplyScalar(k); pivot = p.toArray(); }
    parts.push({ g: info.group || guessGroup(m.name), mat: null, pivot, name: m.name });
  });
  const bb = new THREE.Box3(); for (let i = 0; i < pos.length; i += 3) bb.expandByPoint(new THREE.Vector3(pos[i], pos[i + 1], pos[i + 2]));
  const spec = { parts, muzzle: o.muzzle ?? bb.max.y, support: o.support ?? [0, bb.max.y * 0.45, bb.min.z * 0.5] };
  return { spec, parts, pos, nrm, uv, tris, vpart, density: 1, image, W: AW, H: AH, textured: true };
}

// material do CUBE MAKER a partir do nome e da cor
export function guessMat(name, matName, c) {
  const n = (name + ' ' + matName).toLowerCase();
  if (/wood|madeira|stock|coronha|grip|punho|handguard|forend|walnut|nogueira/.test(n)) return 'nogueira';
  if (/bakel|plastic|polimer|polymer/.test(n)) return 'baquelite';
  if (/glass|vidro|lens|lente/.test(n)) return 'vidro';
  if (/brass|latao|latão|bullet|bala|cartucho|shell/.test(n)) return 'latao';
  if (/leather|couro|sling|bandoleira|strap/.test(n)) return 'couroMarrom';
  if (/cloth|lona|canvas|tecido|fabric/.test(n)) return 'lona';
  if (/rubber|borracha|tire|pneu/.test(n)) return 'borracha';
  const [r, g, b] = c, l = (r + g + b) / 3;
  if (r > g * 1.25 && r > b * 1.5 && l > 50) return l > 140 ? 'madeiraClara' : 'nogueira';
  if (g > r * 1.08 && g > b * 1.1) return 'oliva';
  if (l < 60) return 'acoPreto';
  if (l > 170) return 'aluminio';
  return 'acoOxidado';
}
// grupo de animação pelo nome da peça
export function guessGroup(name) {
  const n = name.toLowerCase();
  if (/mag(azine)?\b|mag_|carregador|pente|drum|tambor_?mag|clip/.test(n)) return 'Carregador';
  if (/bolt|ferrolho|slide|charging|handle|alavanca|manejo/.test(n)) return 'Ferrolho';
  if (/trigger|gatilho/.test(n)) return 'Gatilho';
  if (/cylinder|tambor/.test(n)) return 'Tambor';
  if (/hammer|cão|cao\b/.test(n)) return 'Cão';
  if (/pin|pino|ring|argola/.test(n)) return 'Pino';
  if (/spoon|lever|colher/.test(n)) return 'Alavanca';
  if (/prop|helice|hélice|rotor/.test(n)) return 'Hélice';
  if (/turret|torre/.test(n)) return 'Torre';
  if (/sight|mira|scope|luneta/.test(n)) return 'Mira';
  if (/barrel|cano/.test(n)) return 'Cano';
  return null;
}

// monta a definição (como as do arsenal / mapmodels) a partir do modelo importado
// o: { size (mm, maior dimensão), rot: [x, y, z] graus, off: [x, y, z] mm, weapon: bool }
export function importParts(imp, o) {
  const R = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...o.rot.map(a => a * Math.PI / 180), 'XYZ'));
  const box = new THREE.Box3();
  const geos = imp.meshes.map(m => { const g = m.geo.clone(); g.applyMatrix4(R); g.computeBoundingBox(); box.union(g.boundingBox); return g; });
  const sz = box.getSize(new THREE.Vector3()), k = o.size / Math.max(sz.x, sz.y, sz.z, 1e-6);
  // arma: boca do cano no +Y; origem ~ no eixo do cano acima do gatilho. Mapmodel: o montador centraliza sozinho.
  const c = box.getCenter(new THREE.Vector3());
  const T = o.weapon ? new THREE.Vector3(-c.x, -(box.max.y - sz.y * 0.62), -(box.max.z - sz.z * 0.22)) : c.clone().negate();
  const M = new THREE.Matrix4().makeScale(k, k, k).multiply(new THREE.Matrix4().makeTranslation(T.x, T.y, T.z));
  const parts = geos.map((g, i) => {
    g.applyMatrix4(M); g.translate(...(o.off || [0, 0, 0]));
    const m = imp.meshes[i], mat = (o.mats && o.mats[i]) || guessMat(m.name, m.matName, m.color);
    return { kind: 'mesh', geo: g, mat, g: o.groups === false ? null : guessGroup(m.name), p: [0, 0, 0], cell: 'imp' + i, hard: true };
  });
  const b2 = new THREE.Box3(); geos.forEach(g => { g.computeBoundingBox(); b2.union(g.boundingBox); });
  return { parts, muzzle: b2.max.y, support: [0, b2.max.y * 0.45, b2.min.z * 0.5], port: null, dims: b2.getSize(new THREE.Vector3()).toArray() };
}
