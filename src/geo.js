// CUBE MAKER — motor de modelagem procedural (peças, malhas, atlas UV e oclusão de ambiente)
// Unidades em milímetros. +Y = frente, +Z = cima, +X = direita.
import * as THREE from 'three';

// ---------------------------------------------------------------- construtores de peças
export const B = (g, mat, s, p, o = {}) => ({ kind: o.bev ? 'rbox' : 'box', g, mat, s, p, ...o });         // caixa (bev = chanfro)
export const C = (g, mat, r, l, p, o = {}) => ({ kind: 'cyl', g, mat, r, l, p, ...o });                     // cilindro (r2 = raio do topo)
export const L = (g, mat, prof, p, o = {}) => ({ kind: 'lathe', g, mat, prof, p, ...o });                   // torno: [[r, y], …]
export const E = (g, mat, pts, w, p = [0, 0, 0], o = {}) => ({ kind: 'ext', g, mat, pts, w, p, ...o });     // perfil lateral [[y, z], …] extrudado em X
export const SP = (g, mat, r, p, o = {}) => ({ kind: 'sph', g, mat, r, p, ...o });                         // esfera/elipsoide
export const T = (g, mat, R, tube, p, o = {}) => ({ kind: 'torus', g, mat, R, tube, p, ...o });            // toro (arc = graus)
export const SG = (g, mat, a, b, r, o = {}) => ({ kind: 'seg', g, mat, a, b, r, p: [0, 0, 0], ...o });      // cilindro de A até B
export const LO = (g, mat, sec, p = [0, 0, 0], o = {}) => ({ kind: 'loft', g, mat, sec, p, ...o });          // seções [{y, w, ht, hb, z, n}]
export const W = (g, mat, w, p = [0, 0, 0], o = {}) => ({ kind: 'wing', g, mat, w, p, ...o });              // asa/empenagem com perfil
export const TU = (g, mat, pts, r, o = {}) => ({ kind: 'tube', g, mat, pts, r, p: [0, 0, 0], ...o });        // tubo por um caminho
export const PI = (g, mat, r, p, o = {}) => ({ kind: 'pillow', g, mat, r, p, ...o });                      // "travesseiro" (saco de areia, almofada)

// caminhos e perfis auxiliares
export function helix(R, len, turns, n = 0, o = {}) {           // espiral ao longo de Y (arame farpado em sanfona)
  const N = n || Math.round(turns * 14), pts = [];
  for (let i = 0; i <= N; i++) { const t = i / N, a = t * turns * Math.PI * 2, j = o.jit ? (Math.sin(i * 1.7) * o.jit) : 0; pts.push([Math.cos(a) * (R + j), -len / 2 + t * len, Math.sin(a) * (R + j) + (o.z || 0)]); }
  return pts;
}
export function starPts(R, r = R * 0.382, n = 5, rot = 90) {
  const p = []; for (let i = 0; i < n * 2; i++) { const a = (rot + i * 180 / n) * Math.PI / 180, rr = i % 2 ? r : R; p.push([Math.cos(a) * rr, Math.sin(a) * rr]); } return p;
}
export function circlePts(R, n = 16, cx = 0, cy = 0) { const p = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; p.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]); } return p; }
export function roundRect(y0, z0, y1, z1, r, n = 3) {
  const p = [], c = [[y1 - r, z1 - r, 0], [y0 + r, z1 - r, 90], [y0 + r, z0 + r, 180], [y1 - r, z0 + r, 270]];
  c.forEach(([cy, cz, a0]) => { for (let i = 0; i <= n; i++) { const a = (a0 + i * 90 / n) * Math.PI / 180; p.push([cy + Math.cos(a) * r, cz + Math.sin(a) * r]); } });
  return p;
}
// espelha uma lista de peças no eixo X (lado esquerdo/direito)
export function mirrorX(parts) {
  return parts.map(p => ({ ...p, mx: !p.mx }));
}

// ---------------------------------------------------------------- geometria de cada peça
const D2R = Math.PI / 180;
function fromArrays(pos, idx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g;
}
function signedVolume(g) {
  const P = g.attributes.position.array, I = g.index.array; let v = 0;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    v += P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c]);
  }
  return v;
}
function flipIndex(g) { const I = g.index.array; for (let t = 0; t < I.length; t += 3) { const x = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = x; } g.index.needsUpdate = true; }
function outward(g) { if (signedVolume(g) < 0) flipIndex(g); return g; }
// anel → malha (seções com o mesmo número de pontos); tampas em leque
function ringsMesh(rings, capA = true, capB = true) {
  const pos = [], idx = [], n = rings[0].length;
  rings.forEach(R => R.forEach(p => pos.push(p[0], p[1], p[2])));
  for (let k = 0; k < rings.length - 1; k++) for (let i = 0; i < n; i++) {
    const a = k * n + i, b = k * n + (i + 1) % n, c = (k + 1) * n + i, d = (k + 1) * n + (i + 1) % n;
    idx.push(a, c, b, b, c, d);
  }
  const cap = (R, k, flip) => {
    const c = [0, 0, 0]; R.forEach(p => { c[0] += p[0] / n; c[1] += p[1] / n; c[2] += p[2] / n; });
    const ci = pos.length / 3; pos.push(...c);
    for (let i = 0; i < n; i++) { const a = k * n + i, b = k * n + (i + 1) % n; flip ? idx.push(ci, a, b) : idx.push(ci, b, a); }
  };
  if (capA) cap(rings[0], 0, false);
  if (capB) cap(rings[rings.length - 1], rings.length - 1, true);
  return outward(fromArrays(pos, idx));
}
function superRing(w, ht, hb, z, n, seg, y, xo = 0) {
  const R = [];
  for (let i = 0; i < seg; i++) {
    const a = i / seg * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    const e = 2 / (n || 2), x = Math.sign(c) * Math.pow(Math.abs(c), e) * w / 2, zz = Math.sign(s) * Math.pow(Math.abs(s), e) * (s >= 0 ? ht : hb);
    R.push([x + xo, y, z + zz]);
  }
  return R;
}
function loftGeo(p) {
  const seg = p.seg || 16;
  const rings = p.sec.map(s => superRing(Math.max(0.01, s.w), s.ht ?? s.h / 2, s.hb ?? s.h / 2, s.z || 0, s.n || 2, seg, s.y, s.x || 0));
  return ringsMesh(rings, p.capA !== false, p.capB !== false);
}
// perfil aerodinâmico (meia-espessura relativa, NACA 4 dígitos)
const naca = u => 5 * (0.2969 * Math.sqrt(u) - 0.126 * u - 0.3516 * u * u + 0.2843 * u ** 3 - 0.1015 * u ** 4);
function wingGeo(p) {
  const w = p.w, K = w.K || 10, N = w.N || 9, t = w.t ?? 0.12, half = w.half;            // half: só um lado (+X)
  const st = [];
  for (let k = 0; k <= K; k++) st.push(half ? k / K : -1 + 2 * k / K);
  const rings = st.map(s => {
    const a = Math.abs(s), chord = w.ell ? Math.max(w.c1 || w.c0 * 0.25, w.c0 * Math.sqrt(Math.max(0, 1 - a ** 2.2))) : w.c0 + (w.c1 - w.c0) * a;
    const le = -(w.sweep || 0) * a + (w.ell ? -(w.c0 - chord) * (w.lePos ?? 0.25) : 0);
    const zc = a * w.span * Math.tan((w.dih || 0) * D2R), x = s * w.span, th = t * chord;
    const R = [];
    for (let i = 0; i < N; i++) { const uu = (1 - Math.cos(i / (N - 1) * Math.PI)) / 2; R.push([x, le - uu * chord, zc + naca(Math.max(uu, 1e-4)) * th * (1 + (w.camber || 0.15))]); }
    for (let i = N - 2; i > 0; i--) { const uu = (1 - Math.cos(i / (N - 1) * Math.PI)) / 2; R.push([x, le - uu * chord, zc - naca(uu) * th * (1 - (w.camber || 0.15))]); }
    return R;
  });
  return ringsMesh(rings, true, true);
}
function pillowGeo(p) {
  const [ws, hs] = p.seg || [10, 7], e = p.e ?? 0.45;
  const g = new THREE.SphereGeometry(1, ws, hs), P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const f = v => Math.sign(v) * Math.pow(Math.abs(v), e);
    P.setXYZ(i, f(P.getX(i)) * p.r[0], f(P.getY(i)) * p.r[1], f(P.getZ(i)) * p.r[2]);
  }
  return g;
}
function extrudeYZ(pts, w, o = {}) {
  const sh = new THREE.Shape(pts.map(([y, z]) => new THREE.Vector2(y, z)));
  (o.holes || []).forEach(h => sh.holes.push(new THREE.Path(h.map(([y, z]) => new THREE.Vector2(y, z)))));
  const b = Math.min(o.bev || 0, w * 0.3);
  const g = new THREE.ExtrudeGeometry(sh, b > 0 ? { depth: w - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: o.bevSeg || 1, curveSegments: 8 } : { depth: w, bevelEnabled: false, curveSegments: 8 });
  g.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, b > 0 ? -w / 2 + b : -w / 2, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1));
  return g;
}
function clean(g) {                                   // só posição + índice (normais recalculadas depois)
  const ng = new THREE.BufferGeometry();
  ng.setAttribute('position', g.attributes.position.clone());
  if (g.index) ng.setIndex([...g.index.array]); else ng.setIndex([...Array(g.attributes.position.count).keys()]);
  g.dispose(); return ng;
}
export function partGeometry(p) {
  let g;
  switch (p.kind) {
    case 'box': g = new THREE.BoxGeometry(p.s[0], p.s[1], p.s[2]); break;
    case 'rbox': {
      const b = Math.min(p.bev, p.s[1] / 2.2, p.s[2] / 2.2);
      g = extrudeYZ(roundRect(-p.s[1] / 2, -p.s[2] / 2, p.s[1] / 2, p.s[2] / 2, Math.max(0.01, p.rr ?? b), p.rr ? 3 : 1), p.s[0], { bev: b }); break;
    }
    case 'cyl': g = new THREE.CylinderGeometry(p.r2 ?? p.r, p.r, p.l, p.seg || (p.r > 60 ? 24 : p.r > 25 ? 18 : 12), 1, !!p.open); break;
    case 'lathe': g = new THREE.LatheGeometry(p.prof.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y)), p.seg || 16); break;
    case 'sph': { const [a, b] = p.seg || [16, 11]; g = new THREE.SphereGeometry(1, a, b, 0, Math.PI * 2, 0, (p.cut || 180) * D2R); g.scale(p.r[0], p.r[1], p.r[2]); break; }
    case 'torus': g = new THREE.TorusGeometry(p.R, p.tube, p.seg ? p.seg[0] : 8, p.seg ? p.seg[1] : 18, (p.arc || 360) * D2R); break;
    case 'ext': g = extrudeYZ(p.pts, p.w, p); break;
    case 'seg': {
      const a = new THREE.Vector3(...p.a), b = new THREE.Vector3(...p.b), d = b.clone().sub(a), len = d.length() || 1;
      g = new THREE.CylinderGeometry(p.r2 ?? p.r, p.r, len, p.seg || 8, 1, !!p.open);
      g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())));
      g.applyMatrix4(new THREE.Matrix4().makeTranslation((p.a[0] + p.b[0]) / 2, (p.a[1] + p.b[1]) / 2, (p.a[2] + p.b[2]) / 2));
      break;
    }
    case 'loft': g = loftGeo(p); break;
    case 'wing': g = wingGeo(p); break;
    case 'pillow': g = pillowGeo(p); break;
    case 'tube': {
      const curve = new THREE.CatmullRomCurve3(p.pts.map(q => new THREE.Vector3(...q)), !!p.closed);
      g = new THREE.TubeGeometry(curve, p.n || p.pts.length * 3, p.r, p.rs || 5, !!p.closed); break;
    }
    default: throw new Error('peça desconhecida: ' + p.kind);
  }
  g = clean(g);
  if (p.axis === 'x') g.applyMatrix4(new THREE.Matrix4().makeRotationZ(-Math.PI / 2));
  if (p.axis === 'z') g.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  if (p.sc) g.applyMatrix4(new THREE.Matrix4().makeScale(...p.sc));
  if (p.rot) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(p.rot[0] * D2R, p.rot[1] * D2R, p.rot[2] * D2R, p.ord || 'XYZ')));
  g.applyMatrix4(new THREE.Matrix4().makeTranslation(p.p[0], p.p[1], p.p[2]));
  if (p.M) g.applyMatrix4(new THREE.Matrix4().fromArray(p.M));                   // transformação extra (montagens/poses)
  if (p.mx) { g.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1)); flipIndex(g); }
  g.computeVertexNormals();
  return g;
}
// aplica uma matriz a um grupo de peças (ex.: girar uma montagem inteira)
export function xform(parts, M) {
  const m = M.toArray ? M : new THREE.Matrix4().fromArray(M);
  return parts.map(p => { const prev = p.M ? new THREE.Matrix4().fromArray(p.M) : new THREE.Matrix4(); return { ...p, M: m.clone().multiply(prev).toArray() }; });
}
export const TRS = (t = [0, 0, 0], r = [0, 0, 0], s = 1, ord = 'XYZ') => new THREE.Matrix4().compose(new THREE.Vector3(...t), new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0] * D2R, r[1] * D2R, r[2] * D2R, ord)), new THREE.Vector3(s, s, s));

// ---------------------------------------------------------------- malha final + atlas com densidade uniforme
// opts: W, H (atlas em px), ground (oclusão do chão para mapmodels), maxDensity (px/mm)
export function buildPreset(def, opts = {}) {
  const spec = def.build();
  const parts = spec.parts.flat().filter(Boolean);
  const AW = opts.W || 1024, AH = opts.H || 512;
  const cells = [], cellOf = parts.map((p, i) => { const key = p.cell ? p.cell + '|' + p.mat : '#' + i; let k = cells.indexOf(key); if (k < 0) { cells.push(key); k = cells.length - 1; } return k; });
  const geos = parts.map(partGeometry);
  const cb = cells.map(() => new THREE.Box3());
  geos.forEach((g, i) => { g.computeBoundingBox(); cb[cellOf[i]].union(g.boundingBox); });
  // 1º passo: quais projeções cada célula usa
  const used = cells.map(() => [false, false, false]);
  const axOf = geos.map(g => {
    const P = g.attributes.position.array, I = g.index.array, ax = new Uint8Array(I.length / 3);
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      const fx = Math.abs(uy * vz - uz * vy), fy = Math.abs(uz * vx - ux * vz), fz = Math.abs(ux * vy - uy * vx);
      ax[t / 3] = fx + fy + fz < 1e-9 ? 255 : fx >= fy && fx >= fz ? 0 : fy >= fz ? 1 : 2;
    }
    return ax;
  });
  geos.forEach((g, i) => axOf[i].forEach(a => { if (a < 3) used[cellOf[i]][a] = true; }));
  // retângulos (mm) de cada projeção usada
  const rects = [];
  cells.forEach((_, ci) => {
    const s = cb[ci].getSize(new THREE.Vector3()).max(new THREE.Vector3(0.5, 0.5, 0.5));
    const dims = [[s.y, s.z], [s.x, s.z], [s.x, s.y]];
    for (let a = 0; a < 3; a++) if (used[ci][a]) rects.push({ ci, a, w: dims[a][0], h: dims[a][1] });
  });
  const pad = 3;
  const pack = sc => {                                  // prateleiras; devolve posições ou null
    const order = rects.map((r, i) => i).sort((i, j) => rects[j].h - rects[i].h || rects[j].w - rects[i].w);
    let x = 0, y = 0, sh = 0; const out = new Array(rects.length);
    for (const i of order) {
      const w = Math.max(4, rects[i].w * sc) + pad * 2, h = Math.max(4, rects[i].h * sc) + pad * 2;
      if (w > AW) return null;
      if (x + w > AW) { x = 0; y += sh; sh = 0; }
      if (y + h > AH) return null;
      out[i] = [x + pad, y + pad, w - pad * 2, h - pad * 2]; x += w; sh = Math.max(sh, h);
    }
    return out;
  };
  let lo = 1e-4, hi = 40, best = null;
  for (let it = 0; it < 28; it++) { const m = (lo + hi) / 2, r = pack(m); if (r) { lo = m; best = r; } else hi = m; }
  let density = lo;
  if (opts.maxDensity && density > opts.maxDensity) { density = opts.maxDensity; best = pack(density); }
  const rectOf = cells.map(() => [null, null, null]);
  rects.forEach((r, i) => { rectOf[r.ci][r.a] = best[i]; });
  const pos = [], nrm = [], uv = [], tris = [], vpart = [];
  geos.forEach((g, pi) => {
    const P = g.attributes.position.array, N = g.attributes.normal.array, I = g.index.array, ci = cellOf[pi], AX = axOf[pi];
    const mn = cb[ci].min, sz = cb[ci].getSize(new THREE.Vector3()).max(new THREE.Vector3(0.5, 0.5, 0.5));
    const map = new Map();
    for (let t = 0; t < I.length; t += 3) {
      const ax = AX[t / 3]; if (ax > 2) continue;
      const R = rectOf[ci][ax], out = [];
      for (const v of [I[t], I[t + 1], I[t + 2]]) {
        const key = v * 3 + ax; let idx = map.get(key);
        if (idx === undefined) {
          idx = pos.length / 3; map.set(key, idx);
          const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
          pos.push(x, y, z); nrm.push(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]); vpart.push(pi);
          const [s0, s1] = ax === 0 ? [(y - mn.y) / sz.y, 1 - (z - mn.z) / sz.z] : ax === 1 ? [(x - mn.x) / sz.x, 1 - (z - mn.z) / sz.z] : [(x - mn.x) / sz.x, (y - mn.y) / sz.y];
          uv.push((R[0] + s0 * R[2]) / AW, (R[1] + s1 * R[3]) / AH);
        }
        out.push(idx);
      }
      tris.push(out[0], out[2], out[1]);              // MD3/AC: ordem invertida em relação ao three.js
    }
    g.dispose();
  });
  const ao = opts.ao === false ? null : bakeAO(pos, nrm, tris, opts.ground);
  return { spec, parts, cells, cellOf, pos, nrm, uv, tris, vpart, ao, density, W: AW, H: AH, rects: best, rectList: rects };
}

// ---------------------------------------------------------------- oclusão de ambiente por voxels
function bakeAO(pos, nrm, tris, ground) {
  const nv = pos.length / 3; if (!nv) return null;
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let i = 0; i < nv; i++) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], pos[i * 3 + k]); mx[k] = Math.max(mx[k], pos[i * 3 + k]); }
  const ext = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) || 1, G = 72, cs = ext / G;
  const dims = [0, 1, 2].map(k => Math.max(1, Math.ceil((mx[k] - mn[k]) / cs) + 3));
  const grid = new Uint8Array(dims[0] * dims[1] * dims[2]);
  const cell = (x, y, z) => { const i = Math.floor((x - mn[0]) / cs) + 1, j = Math.floor((y - mn[1]) / cs) + 1, k = Math.floor((z - mn[2]) / cs) + 1; return (i < 0 || j < 0 || k < 0 || i >= dims[0] || j >= dims[1] || k >= dims[2]) ? -1 : (k * dims[1] + j) * dims[0] + i; };
  for (let t = 0; t < tris.length; t += 3) {                 // marca a superfície dos triângulos
    const a = tris[t] * 3, b = tris[t + 1] * 3, c = tris[t + 2] * 3;
    const l1 = Math.hypot(pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]), l2 = Math.hypot(pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]);
    const n = Math.min(60, Math.ceil(Math.max(l1, l2) / (cs * 0.5)) + 1);
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) {
      const u = i / n, v = j / n, w = 1 - u - v;
      const id = cell(pos[a] * w + pos[b] * u + pos[c] * v, pos[a + 1] * w + pos[b + 1] * u + pos[c + 1] * v, pos[a + 2] * w + pos[b + 2] * u + pos[c + 2] * v);
      if (id >= 0) grid[id] = 1;
    }
  }
  // direções num hemisfério (espiral de Fibonacci)
  const DIRS = []; const ND = 20;
  for (let i = 0; i < ND; i++) { const z = 1 - (i + 0.5) / ND, r = Math.sqrt(1 - z * z), a = i * 2.39996; DIRS.push([Math.cos(a) * r, Math.sin(a) * r, z]); }
  const ao = new Float32Array(nv), maxD = ext * 0.22, steps = Math.max(6, Math.ceil(maxD / cs));
  const tmp = new THREE.Vector3(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 0, 1);
  for (let v = 0; v < nv; v++) {
    const nx = nrm[v * 3], ny = nrm[v * 3 + 1], nz = nrm[v * 3 + 2];
    q.setFromUnitVectors(up, tmp.set(nx, ny, nz).normalize());
    let occ = 0, wsum = 0;
    const ox = pos[v * 3] + nx * cs * 1.6, oy = pos[v * 3 + 1] + ny * cs * 1.6, oz = pos[v * 3 + 2] + nz * cs * 1.6;
    for (const d of DIRS) {
      tmp.set(d[0], d[1], d[2]).applyQuaternion(q); const w = d[2]; wsum += w;
      for (let s = 1; s <= steps; s++) {
        const dist = s * cs * 0.9, x = ox + tmp.x * dist, y = oy + tmp.y * dist, z = oz + tmp.z * dist;
        if (ground && z < 0) { occ += w * (1 - s / steps * 0.6); break; }
        const id = cell(x, y, z);
        if (id >= 0 && grid[id]) { occ += w * (1 - (s / steps) * 0.7); break; }
      }
    }
    let a = 1 - occ / wsum;
    if (ground) a *= 0.72 + 0.28 * Math.min(1, (pos[v * 3 + 2] - 0) / (ext * 0.08 + 1e-3));   // contato com o chão
    ao[v] = Math.max(0.12, Math.min(1, a));
  }
  return ao;
}

// skin-base: cinza com a oclusão rasterizada nas UVs (o compositor usa a luminância como detalhe)
export function atlasCanvas(Bp, w, h) {
  w = w || Bp.W || 1024; h = h || Bp.H || 512;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = '#5a5a5a'; x.fillRect(0, 0, w, h);
  const im = x.getImageData(0, 0, w, h), d = im.data, val = new Float32Array(w * h).fill(-1);
  const U = Bp.uv, T = Bp.tris, A = Bp.ao;
  for (let t = 0; t < T.length; t += 3) {
    const ia = T[t], ib = T[t + 1], ic = T[t + 2];
    const x0 = U[ia * 2] * w, y0 = U[ia * 2 + 1] * h, x1 = U[ib * 2] * w, y1 = U[ib * 2 + 1] * h, x2 = U[ic * 2] * w, y2 = U[ic * 2 + 1] * h;
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0); if (Math.abs(area) < 1e-9) continue;
    const a0 = A ? A[ia] : 1, a1 = A ? A[ib] : 1, a2 = A ? A[ic] : 1;
    const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2) - 1)), maxX = Math.min(w - 1, Math.ceil(Math.max(x0, x1, x2) + 1));
    const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2) - 1)), maxY = Math.min(h - 1, Math.ceil(Math.max(y0, y1, y2) + 1));
    for (let yy = minY; yy <= maxY; yy++) for (let xx = minX; xx <= maxX; xx++) {
      const px = xx + 0.5, py = yy + 0.5;
      let w0 = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) / area, w1 = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) / area, w2 = 1 - w0 - w1;
      if (w0 < -0.02 || w1 < -0.02 || w2 < -0.02) continue;
      val[yy * w + xx] = a0 * w0 + a1 * w1 + a2 * w2;
    }
  }
  // borda escura em cada retângulo (cavidade nas quinas) + ruído leve
  const edge = new Float32Array(w * h).fill(1);
  (Bp.rects || []).forEach(R => {
    if (!R) return; const [rx, ry, rw, rh] = R.map(Math.round);
    for (let yy = ry; yy < ry + rh; yy++) for (let xx = rx; xx < rx + rw; xx++) {
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const e = Math.min(xx - rx, yy - ry, rx + rw - 1 - xx, ry + rh - 1 - yy);
      if (e < 2) edge[yy * w + xx] = 0.86 + e * 0.07;
    }
  });
  for (let i = 0; i < w * h; i++) {
    let v = val[i];
    if (v < 0) {                                            // dilata o valor dos vizinhos (costuras)
      const xx = i % w; v = (xx > 0 && val[i - 1] >= 0) ? val[i - 1] : (xx < w - 1 && val[i + 1] >= 0) ? val[i + 1] : (i >= w && val[i - w] >= 0) ? val[i - w] : (i + w < w * h && val[i + w] >= 0) ? val[i + w] : 0.7;
    }
    const L = (60 + 120 * Math.pow(v, 0.9)) * edge[i] + (Math.random() - 0.5) * 10;
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = L; d[i * 4 + 3] = 255;
  }
  x.putImageData(im, 0, 0);
  return c;
}
