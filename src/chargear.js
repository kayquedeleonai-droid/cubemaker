// CUBE MAKER — equipamento 3D do soldado (capacete, cartucheiras, mochila, cantil, máscara de gás)
// As peças acompanham a cabeça e o tronco em todos os quadros do modelo MD2 (encaixe rígido por Kabsch/Horn),
// e as UVs são projetadas na pele do corpo logo abaixo, então pegam a mesma pintura da skin.
import * as THREE from 'three';
import { partGeometry, B, C, L, PI, SP } from './geo.js';
import { helmet } from './props.js';

const MM = 1 / 33.5;                                   // mm → unidades do modelo do AC (1,80 m ≈ 54 unidades)

// rotação ótima entre dois conjuntos de pontos (método de Horn, quaternion por iteração de potência)
export function rigid(A, Bp) {
  const n = A.length / 3, ca = [0, 0, 0], cb = [0, 0, 0];
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { ca[k] += A[i * 3 + k] / n; cb[k] += Bp[i * 3 + k] / n; }
  const S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < n; i++) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) S[a][b] += (A[i * 3 + a] - ca[a]) * (Bp[i * 3 + b] - cb[b]);
  const [[xx, xy, xz], [yx, yy, yz], [zx, zy, zz]] = S;
  const N = [[xx + yy + zz, yz - zy, zx - xz, xy - yx], [yz - zy, xx - yy - zz, xy + yx, zx + xz], [zx - xz, xy + yx, -xx + yy - zz, yz + zy], [xy - yx, zx + xz, yz + zy, -xx - yy + zz]];
  const sh = Math.abs(xx) + Math.abs(yy) + Math.abs(zz) + Math.abs(xy) + Math.abs(xz) + Math.abs(yz) + 1e-6;
  let q = [1, 0, 0, 0];
  for (let it = 0; it < 60; it++) { const r = [0, 1, 2, 3].map(a => N[a].reduce((s, v, b) => s + v * q[b], 0) + sh * q[a]); const l = Math.hypot(...r); q = r.map(v => v / l); }
  const Q = new THREE.Quaternion(q[1], q[2], q[3], q[0]);
  const M = new THREE.Matrix4().makeRotationFromQuaternion(Q);
  const t = new THREE.Vector3(...ca).applyMatrix4(M); M.setPosition(cb[0] - t.x, cb[1] - t.y, cb[2] - t.z);
  return M;
}
function gather(s, f, verts) { const P = s.pos[f], o = new Float32Array(verts.length * 3); verts.forEach((v, i) => { o[i * 3] = P[v * 3]; o[i * 3 + 1] = P[v * 3 + 1]; o[i * 3 + 2] = P[v * 3 + 2]; }); return o; }
// raio contra o corpo (quadro 0) — ponto de apoio das peças
function hitBody(s, o, d) {
  const P = s.pos[0], T = s.tris; let best = null, bt = 1e9; const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), p = new THREE.Vector3(), q = new THREE.Vector3(), tv = new THREE.Vector3(), a = new THREE.Vector3();
  for (let t = 0; t < T.length; t += 3) {
    a.fromArray(P, T[t] * 3); e1.fromArray(P, T[t + 1] * 3).sub(a); e2.fromArray(P, T[t + 2] * 3).sub(a);
    p.crossVectors(d, e2); const det = e1.dot(p); if (Math.abs(det) < 1e-9) continue;
    tv.copy(o).sub(a); const u = tv.dot(p) / det; if (u < 0 || u > 1) continue;
    q.crossVectors(tv, e1); const v = d.dot(q) / det; if (v < 0 || u + v > 1) continue;
    const tt = e2.dot(q) / det; if (tt > 0 && tt < bt) { bt = tt; best = o.clone().addScaledVector(d, tt); }
  }
  return best;
}
// UV do ponto do corpo mais próximo (projeção nos triângulos do quadro 0)
function nearestUV(s, p, zmin = -1e9) {
  const P = s.pos[0], T = s.tris, st = s.st; let bd = 1e9, uv = [0, 0];
  const tri = new THREE.Triangle(), cp = new THREE.Vector3(), bc = new THREE.Vector3(), A = new THREE.Vector3(), Bv = new THREE.Vector3(), Cv = new THREE.Vector3();
  for (let t = 0; t < T.length; t += 3) {
    A.fromArray(P, T[t] * 3); Bv.fromArray(P, T[t + 1] * 3); Cv.fromArray(P, T[t + 2] * 3); if (typeof zmin === 'function' ? !zmin(A, Bv, Cv) : Math.min(A.z, Bv.z, Cv.z) < zmin) continue; tri.set(A, Bv, Cv); tri.closestPointToPoint(p, cp);
    const d = cp.distanceToSquared(p); if (d >= bd) continue; bd = d; tri.getBarycoord(cp, bc);
    uv = [st[T[t] * 2] * bc.x + st[T[t + 1] * 2] * bc.y + st[T[t + 2] * 2] * bc.z, st[T[t] * 2 + 1] * bc.x + st[T[t + 1] * 2 + 1] * bc.y + st[T[t + 2] * 2 + 1] * bc.z];
  }
  return uv;
}

// ---- coberturas de cabeça novas (mm no referencial da cabeça: meia-largura 100, z = 0 na sobrancelha, frente = +X)
const HELMETS = { stahl: 'stahl', m1: 'm1', brodie: 'brodie', adrian: 'adrian', ssh40: 'ssh40', m33plume: 'm1' };
function dome(H, mat, z0, extra = 0, seg = 16) {
  const cx = (H.fx + H.bx) / 2, rx = (H.fx - H.bx) / 2 / 108, T = H.top + extra;
  return L(null, mat, [[0, T], [52, T - 8], [86, T * 0.7], [106, T * 0.36], [112 + extra * 0.2, Math.max(z0, 6)], [112 + extra * 0.2, z0], [0, z0]], [cx, 0, 0], { axis: 'z', seg, sc: [rx * 1.04, 1.04, 1] });
}
function headgear(k, kit, H) {
  const m = kit.helmetMat || 'couroMarrom', cx = (H.fx + H.bx) / 2;
  switch (k) {
    case 'flycap': return [dome(H, m, -6, 8), ...[-1, 1].map(sd => B(null, m, [90, 22, 120], [cx - 4, sd * 112, -50], { bev: 9 })), B(null, m, [18, 150, 14], [cx + 5, 0, -112], { bev: 5 })];
    case 'tanker': return [dome(H, m, -4, 10), ...[-36, 0, 36].map(y => B(null, m, [(H.fx - H.bx) * 0.86, 22, 26], [cx, y, H.top + 8], { bev: 9 })), ...[-1, 1].map(sd => C(null, 'couroPreto', 44, 30, [cx - 6, sd * 116, -30], { axis: 'y', seg: 12 }))];
    case 'beret': return [L(null, m, [[0, 40], [86, 36], [128, 18], [134, 6], [104, 0], [0, 0]], [cx - 10, 14, H.top - 34], { axis: 'z', seg: 16, sc: [1.12, 1, 1], rot: [-14, 0, 0] }), B(null, 'latao', [8, 30, 36], [H.fx * 0.82, -48, H.top - 30], { bev: 3 })];
    case 'sidecap': return [B(null, m, [(H.fx - H.bx) * 1.02, 74, 64], [cx, 10, H.top - 14], { bev: 20 }), B(null, m, [(H.fx - H.bx) * 1.04, 84, 26], [cx, 10, H.top - 40], { bev: 8 })];
    case 'bergmutze': return [L(null, m, [[0, H.top + 6], [90, H.top], [114, H.top - 30], [116, 10], [0, 10]], [cx, 0, 0], { axis: 'z', seg: 16, sc: [(H.fx - H.bx) / 216 * 1.04, 1.04, 1] }), B(null, m, [70, 170, 10], [H.fx + 22, 0, 16], { bev: 4, rot: [0, -12, 0] })];
    case 'japcap': return [L(null, m, [[0, H.top + 2], [96, H.top - 4], [116, H.top - 40], [118, 8], [0, 8]], [cx, 0, 0], { axis: 'z', seg: 16, sc: [(H.fx - H.bx) / 216 * 1.04, 1.04, 1] }), B(null, m, [64, 160, 10], [H.fx + 20, 0, 12], { bev: 4, rot: [0, -10, 0] }),
      B(null, m, [10, 170, 170], [H.bx - 6, 0, -70], { bev: 4 }), ...[-1, 1].map(sd => B(null, m, [110, 10, 150], [cx - 40, sd * 120, -60], { bev: 4 }))];
    case 'furhat': return [dome(H, m, 0, 34, 16), ...[-1, 1].map(sd => B(null, m, [96, 26, 130], [cx - 6, sd * 124, -40], { bev: 12 })), B(null, m, [26, 200, 70], [H.fx + 6, 0, 36], { bev: 12 })];
    case 'hood': {
      const out = [dome(H, m, -16, 12, 16)], strips = kit.strips || ['sacoAreia', 'lonaVerde'];
      for (let i = 0; i < 26; i++) {
        const a = Math.PI * 0.4 + (i / 25) * Math.PI * 1.2 + ((i * 13) % 7) * 0.03, r = 112, h = 150 + ((i * 37) % 90), tilt = 22 + (i * 29) % 16;
        const z0 = H.top * (0.15 + ((i * 17) % 10) * 0.05);
        // tira de juta pendurada: presa no capuz e caindo para fora, sobre os ombros
        out.push(B(null, strips[i % strips.length], [5, 14 + (i % 3) * 5, h], [cx + Math.cos(a) * (r + 12) * 1.15, Math.sin(a) * (r + 12), z0 - h / 2], { rot: [Math.sin(a) * tilt, -Math.cos(a) * tilt, ((i * 47) % 50) - 25] }));
      }
      return out;
    }
  }
  return [];
}
function goggles(H, kit) {
  const z = kit.helmet === 'tanker' || kit.helmet === 'flycap' ? 44 : 20, x = H.fx * 0.9;
  return [...[-1, 1].map(sd => C(null, 'acoGasto', 31, 24, [x + 4, sd * 40, z], { axis: 'x', seg: 12 })), ...[-1, 1].map(sd => C(null, 'vidro', 25, 6, [x + 18, sd * 40, z], { axis: 'x', seg: 12 })),
    L(null, kit.gogStrap || 'couroMarrom', [[0, z - 9], [120, z - 9], [120, z + 9], [0, z + 9]], [(H.fx + H.bx) / 2, 0, 0], { axis: 'z', seg: 16, sc: [(H.fx - H.bx) / 216 * 1.05, 1.05, 1] })];
}
function headset(H) {
  const cx = (H.fx + H.bx) / 2;
  return [B(null, 'couroPreto', [18, 236, 12], [cx - 6, 0, H.top + 4], { bev: 5 }), ...[-1, 1].map(sd => C(null, 'couroPreto', 40, 24, [cx - 6, sd * 116, -24], { axis: 'y', seg: 12 })), ...[-1, 1].map(sd => B(null, 'couroPreto', [12, 10, 120], [cx - 6, sd * 116, H.top - 70], { bev: 3 }))];
}
function plume(H) {
  const out = [];
  for (let i = 0; i < 8; i++) out.push(L(null, 'preto', [[0, 0], [18, 24], [12, 190], [0, 230]], [H.bx * 0.1 - i * 5, 128 + (i % 3) * 6, 78 - i * 3], { axis: 'z', seg: 5, rot: [112 + (i % 4) * 7, 0, 196 + i * 5], ord: 'ZXY' }));
  return out;
}

// regions: { head: [ilhas], torso: [ilhas] }; kit: o mesmo "kit" do uniforme; opts.helmet força um modelo de capacete
export function buildGear(model, regions, kit, opts = {}) {
  const s = model.surfaces[0], vset = isl => [...new Set(isl.flatMap(i => s.islVerts[i] || []))];
  const headV = vset(regions.head), torsoV = vset(regions.torso);
  const P0 = s.pos[0], avg = vs => { const c = [0, 0, 0]; vs.forEach(v => { for (let k = 0; k < 3; k++) c[k] += P0[v * 3 + k] / vs.length; }); return c; };
  const ext = vs => { const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; vs.forEach(v => { for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], P0[v * 3 + k]); mx[k] = Math.max(mx[k], P0[v * 3 + k]); } }); return { mn, mx }; };
  const hc = avg(headV), he = ext(headV), tc = avg(torsoV), te = ext(torsoV);
  const parts = [];                                    // { parts (DSL em mm, origem local), M (frame0, unidades), bone }
  const put = (dsl, at, rotZ, bone, scale = MM, zmin = -1e9) => parts.push({ zmin, dsl, M: new THREE.Matrix4().compose(new THREE.Vector3(...at), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, rotZ || 0)), new THREE.Vector3(scale, scale, scale)), bone });
  // capacete: aro acima dos olhos, centralizado na cabeça, frente = +X
  const hk = opts.helmet || kit.helmet;
  if (hk && (HELMETS[hk] || hk === 'm33plume')) {
    const kind = HELMETS[hk] || 'm1';
    const rimZ = he.mx[2] - 4.6, sc = ((he.mx[1] - he.mn[1]) / 2 + 0.7) / 160;
    put(helmet(kind, kit.helmetMat || 'oliva'), [hc[0] - 0.2, hc[1], rimZ], Math.PI / 2, 'head', sc, he.mx[2] - 4.0);
  }
  // cobertura de cabeça nova (gorros, boinas, quepes, capuz) — construída no referencial da cabeça (mm, meia-largura = 100, frente = +X)
  {
    const hr = (he.mx[1] - he.mn[1]) / 2, sc = hr / 100, rim = he.mx[2] - 4.6;
    const H = { fx: (he.mx[0] - hc[0]) / sc, bx: (he.mn[0] - hc[0]) / sc, top: (he.mx[2] - rim) / sc };
    const dsl = headgear(hk, kit, H);
    const NB = { flycap: 5.4, tanker: 5.2, beret: 1.9, sidecap: 2.1, bergmutze: 3.0, japcap: 3.2, furhat: 4.1, hood: 6.8 }[hk];
    if (dsl.length) put(dsl, [hc[0], hc[1], rim], 0, 'head', sc, NB ? he.mx[2] - NB + 0.5 : -1e9);
    if (kit.goggles) put(goggles(H, kit), [hc[0], hc[1], rim], 0, 'head', sc);
    if (kit.headset) put(headset(H), [hc[0], hc[1], rim], 0, 'head', sc);
    if (hk === 'm33plume') put(plume(H), [hc[0], hc[1], rim], 0, 'head', sc, (A, B2, C2) => Math.min(A.z, B2.z, C2.z) > rim && (A.y + B2.y + C2.y) / 3 - hc[1] > 2.0 && (A.x + B2.x + C2.x) / 3 - hc[0] < 0.7);
  }
  const zb = te.mn[2] + 1.3, front = new THREE.Vector3(-1, 0, 0), backDir = new THREE.Vector3(1, 0, 0);
  const onBody = (y, z, dir) => hitBody(s, new THREE.Vector3(dir.x < 0 ? 40 : -40, y, z), dir);
  // cartucheiras na frente do cinto
  if (kit.pouches === 'mauser' || kit.pouches === 'garand' || kit.pouches === 'two') {
    const n = kit.pouches === 'garand' ? 3 : kit.pouches === 'mauser' ? 3 : 1, w = kit.pouches === 'two' ? 120 : 62;
    for (const sd of [-1, 1]) for (let k = 0; k < n; k++) {
      const y = tc[1] + sd * (1.9 + k * (w * MM + 0.2) + w * MM / 2), p = onBody(y, zb + 1.9, front); if (!p) continue;
      put([B(null, kit.pouchMat || kit.belt || 'couroPreto', [44, w, 80], [0, 0, 0], { bev: 8 }), B(null, kit.pouchMat || kit.belt || 'couroPreto', [50, w + 4, 22], [4, 0, 34], { bev: 6 })], [p.x + 0.55, p.y, p.z], Math.PI / 2 * 0, 'torso');
    }
  }
  // mochila / bornal nas costas
  if (kit.pack) {
    const sz = { bread: [90, 240, 200], haversack: [110, 280, 380], tornister: [130, 320, 330], musette: [90, 260, 220], sidor: [140, 300, 280], small: [110, 280, 250], radio: [130, 250, 340], rucksack: [170, 330, 330], flamer: [150, 300, 420] }[kit.pack] || [100, 260, 260];
    const z = kit.pack === 'bread' || kit.pack === 'musette' ? zb + 2.6 : (te.mx[2] + zb) / 2 + 1, y = kit.pack === 'bread' || kit.pack === 'musette' ? tc[1] - 2.6 : tc[1];
    const p = onBody(y, z, backDir);
    if (p) {
      const dsl = [B(null, kit.packMat || 'lona', sz, [0, 0, 0], { bev: 28 })];
      if (kit.pack === 'tornister') dsl.push(C(null, 'feldgrauEsc', 55, sz[1] + 40, [0, 0, sz[2] / 2 + 40], { axis: 'x', seg: 10 }));
      if (kit.pack === 'radio') {                           // rádio SCR-300: caixa + antena
        dsl.push(B(null, kit.packMat || 'oliva', [sz[0] * 0.6, 60, 40], [-sz[0] * 0.1, sz[1] * 0.3, sz[2] / 2 + 20], { bev: 8 }));
        dsl.push(C(null, 'preto', 7, 1150, [-10, -sz[1] * 0.35, sz[2] / 2 + 575], { axis: 'z', seg: 6 }));
        dsl.push(SP(null, 'preto', [12, 12, 12], [-10, -sz[1] * 0.35, sz[2] / 2 + 1150], { seg: [6, 4] }));
      }
      if (kit.pack === 'flamer') {                          // lança-chamas: dois tanques + garrafa de gás
        dsl.length = 0;
        for (const sy of [-1, 1]) {
          dsl.push(C(null, kit.packMat || 'oliva', 64, sz[2], [0, sy * 72, 0], { axis: 'z', seg: 12 }));
          dsl.push(SP(null, kit.packMat || 'oliva', [64, 64, 34], [0, sy * 72, sz[2] / 2], { seg: [10, 5] }));
          dsl.push(SP(null, kit.packMat || 'oliva', [64, 64, 34], [0, sy * 72, -sz[2] / 2], { seg: [10, 5] }));
        }
        dsl.push(SP(null, 'acoGasto', [46, 46, 46], [-30, 0, sz[2] * 0.3], { seg: [10, 7] }));
        dsl.push(B(null, 'couroPreto', [30, 240, 26], [-50, 0, sz[2] * 0.15], { bev: 6 }));
      }
      if (kit.pack === 'rucksack') dsl.push(B(null, kit.packMat || 'lona', [sz[0] * 0.8, sz[1] * 0.9, 70], [-10, 0, -sz[2] / 2 + 10], { bev: 18 }), B(null, 'couroMarrom', [40, 60, 120], [-sz[0] / 2 - 10, sz[1] * 0.3, -40], { bev: 10 }), B(null, 'couroMarrom', [40, 60, 120], [-sz[0] / 2 - 10, -sz[1] * 0.3, -40], { bev: 10 }));
      put(dsl, [p.x - sz[0] * MM / 2 - 0.2, p.y, p.z], 0, 'torso');
    }
  }
  // cantil no quadril e máscara de gás nas costas
  if (kit.canteen) { const p = onBody(tc[1] + 4.6, zb - 1.4, front.clone().add(new THREE.Vector3(0, -1.2, 0)).normalize()); if (p) put([L(null, kit.canteenMat || 'couroMarrom', [[0, 0], [70, 0], [85, 20], [85, 160], [70, 180], [20, 190], [20, 215], [0, 215]], [0, 0, -100], { axis: 'z', seg: 12, sc: [1, 0.55, 1] })], [p.x, p.y + 0.6, p.z], 0, 'torso'); }
  if (kit.gasmask) { const p = onBody(tc[1] + 2.3, zb + 2.2, backDir); if (p) put([L(null, 'feldgrau', [[0, 0], [52, 0], [55, 8], [55, 250], [50, 260], [0, 262]], [0, 0, -130], { axis: 'z', seg: 14 })], [p.x - 1.6, p.y, p.z], 0, 'torso'); }
  // colete salva-vidas (Mae West): gola inflada + almofadas no peito
  if (kit.maewest) {
    const ring = []; for (let k = 0; k <= 10; k++) { const t = k / 10 * Math.PI * 2; ring.push([150 + 42 * Math.cos(t), 42 * Math.sin(t)]); }
    const nk = torsoV.filter(v => P0[v * 3 + 2] > te.mx[2] - 1.6), nc = avg(nk.length ? nk : torsoV);
    put([L(null, kit.maewest, ring, [0, 0, 0], { axis: 'z', seg: 14, sc: [0.92, 1.0, 1] })], [nc[0], nc[1], te.mx[2] - 0.7], 0, 'torso');
    for (const sd of [-1, 1]) { const p = onBody(tc[1] + sd * 2.1, te.mx[2] - 4.2, front); if (p) put([B(null, kit.maewest, [52, 105, 170], [0, 0, 0], { bev: 24 })], [p.x + 0.7, p.y, p.z], 0, 'torso'); }
  }
  // malha das peças no quadro 0 + UV projetada no corpo
  const pos = [], uv = [], tris = [], bone = [], mat = [];
  parts.forEach(pt => {
    pt.dsl.flat().forEach(d => {
      const lo = { ...d, hard: true, seg: d.kind === 'lathe' ? 12 : d.kind === 'sph' ? [8, 6] : d.kind === 'cyl' ? 10 : d.seg };   // leve: o MD2 do AC tem limite de vértices
      const g = partGeometry(lo, true); g.applyMatrix4(pt.M);
      const base = pos.length / 3, A = g.attributes.position;
      for (let i = 0; i < A.count; i++) { const v = new THREE.Vector3(A.getX(i), A.getY(i), A.getZ(i)); pos.push(v.x, v.y, v.z); uv.push(...nearestUV(s, v, pt.zmin)); bone.push(pt.bone); }
      const I = g.index.array; for (let t = 0; t < I.length; t += 3) tris.push(base + I[t], base + I[t + 2], base + I[t + 1]);   // ordem do MD2
      mat.push(d.mat);
    });
  });
  // matriz de cada osso em cada quadro
  const h0 = gather(s, 0, headV), t0 = gather(s, 0, torsoV), frames = [];
  for (let f = 0; f < model.nf; f++) frames.push({ head: rigid(h0, gather(s, f, headV)), torso: rigid(t0, gather(s, f, torsoV)) });
  return { pos: new Float32Array(pos), uv: new Float32Array(uv), tris: new Uint32Array(tris), bone, frames, count: parts.length };
}
// posições das peças num quadro
export function gearFrame(G, f) {
  const fr = G.frames[Math.max(0, Math.min(G.frames.length - 1, Math.round(f)))], out = new Float32Array(G.pos.length), v = new THREE.Vector3();
  for (let i = 0; i < G.bone.length; i++) { v.fromArray(G.pos, i * 3).applyMatrix4(fr[G.bone[i]]); out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z; }
  return out;
}

// grava um tris.md2 novo: o modelo original do AC (mesma numeração de vértices, quadros e nomes) + as peças
export function writePlayerMD2(origBuf, G, bulk = null) {
  const dv0 = new DataView(origBuf), I = o => dv0.getInt32(o, true);
  const skinW = I(8), skinH = I(12), fs0 = I(16), nSk = I(20), nX = I(24), nSt = I(28), nT = I(32), nF = I(40), oSk = I(44), oSt = I(48), oT = I(52), oF = I(56);
  const gN = G.bone.length, gT = G.tris.length / 3, X = nX + gN, ST = nSt + gN, TT = nT + gT;
  // posições originais por quadro (descomprimidas)
  const frames = [];
  for (let f = 0; f < nF; f++) {
    const o = oF + f * fs0, sc = [0, 1, 2].map(k => dv0.getFloat32(o + k * 4, true)), tr = [0, 1, 2].map(k => dv0.getFloat32(o + 12 + k * 4, true));
    const name = new Uint8Array(origBuf, o + 24, 16).slice(), P = new Float32Array(X * 3);
    for (let i = 0; i < nX; i++) for (let k = 0; k < 3; k++) P[i * 3 + k] = dv0.getUint8(o + 40 + i * 4 + k) * sc[k] + tr[k] + (bulk && bulk[f] && i * 3 + k < bulk[f].length ? bulk[f][i * 3 + k] : 0);
    P.set(gearFrame(G, f), nX * 3); frames.push({ name, P });
  }
  const tris = []; for (let t = 0; t < nT; t++) { const o = oT + t * 12; tris.push([[0, 1, 2].map(k => dv0.getUint16(o + k * 2, true)), [0, 1, 2].map(k => dv0.getUint16(o + 6 + k * 2, true))]); }
  for (let t = 0; t < gT; t++) { const v = [G.tris[t * 3], G.tris[t * 3 + 1], G.tris[t * 3 + 2]]; tris.push([v.map(x => x + nX), v.map(x => x + nSt)]); }
  const stv = []; for (let i = 0; i < nSt; i++) stv.push([dv0.getInt16(oSt + i * 4, true), dv0.getInt16(oSt + i * 4 + 2, true)]);
  for (let i = 0; i < gN; i++) stv.push([Math.round(G.uv[i * 2] * skinW), Math.round(G.uv[i * 2 + 1] * skinH)]);
  // normais por vértice (média das faces) → índice da tabela do Quake
  return import('./anorms.js').then(({ ANORMS }) => {
    const fsz = 40 + X * 4, nGl = TT * 10 + 1, oSk2 = 68, oSt2 = oSk2 + nSk * 64, oT2 = oSt2 + ST * 4, oF2 = oT2 + TT * 12, oG2 = oF2 + nF * fsz, end = oG2 + nGl * 4;
    const buf = new ArrayBuffer(end), dv = new DataView(buf), u8 = new Uint8Array(buf), W = (o, v) => dv.setInt32(o, v, true);
    u8.set([73, 68, 80, 50]); W(4, 8); W(8, skinW); W(12, skinH); W(16, fsz); W(20, nSk); W(24, X); W(28, ST); W(32, TT); W(36, nGl); W(40, nF); W(44, oSk2); W(48, oSt2); W(52, oT2); W(56, oF2); W(60, oG2); W(64, end);
    u8.set(new Uint8Array(origBuf, oSk, nSk * 64), oSk2);
    stv.forEach(([a, b], i) => { dv.setInt16(oSt2 + i * 4, a, true); dv.setInt16(oSt2 + i * 4 + 2, b, true); });
    tris.forEach(([v, t], i) => { for (let k = 0; k < 3; k++) { dv.setUint16(oT2 + i * 12 + k * 2, v[k], true); dv.setUint16(oT2 + i * 12 + 6 + k * 2, t[k], true); } });
    frames.forEach((F, f) => {
      const o = oF2 + f * fsz, mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
      for (let i = 0; i < X; i++) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], F.P[i * 3 + k]); mx[k] = Math.max(mx[k], F.P[i * 3 + k]); }
      const sc = mn.map((m, k) => Math.max(1e-6, (mx[k] - m) / 255));
      for (let k = 0; k < 3; k++) { dv.setFloat32(o + k * 4, sc[k], true); dv.setFloat32(o + 12 + k * 4, mn[k], true); }
      u8.set(F.name, o + 24);
      const N = new Float32Array(X * 3);
      tris.forEach(([v]) => { const a = v[0] * 3, b = v[1] * 3, c = v[2] * 3, ux = F.P[b] - F.P[a], uy = F.P[b + 1] - F.P[a + 1], uz = F.P[b + 2] - F.P[a + 2], wx = F.P[c] - F.P[a], wy = F.P[c + 1] - F.P[a + 1], wz = F.P[c + 2] - F.P[a + 2];
        const nx = uz * wy - uy * wz, ny = ux * wz - uz * wx, nz = uy * wx - ux * wy; for (const q of v) { N[q * 3] += nx; N[q * 3 + 1] += ny; N[q * 3 + 2] += nz; } });
      for (let i = 0; i < X; i++) {
        for (let k = 0; k < 3; k++) u8[o + 40 + i * 4 + k] = Math.round((F.P[i * 3 + k] - mn[k]) / sc[k]);
        const l = Math.hypot(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]) || 1; let best = 0, bd = -2;
        for (let a = 0; a < 162; a++) { const d = (ANORMS[a][0] * N[i * 3] + ANORMS[a][1] * N[i * 3 + 1] + ANORMS[a][2] * N[i * 3 + 2]) / l; if (d > bd) { bd = d; best = a; } }
        u8[o + 40 + i * 4 + 3] = best;
      }
    });
    let g = oG2;
    tris.forEach(([v, t]) => { W(g, 3); g += 4; for (let k = 0; k < 3; k++) { dv.setFloat32(g, stv[t[k]][0] / skinW, true); dv.setFloat32(g + 4, stv[t[k]][1] / skinH, true); W(g + 8, v[k]); g += 12; } });
    W(g, 0);
    return buf;
  });
}
