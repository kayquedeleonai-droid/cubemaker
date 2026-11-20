// CUBE MAKER — mãos e mangas próprias (1ª e 2ª Guerra) para as armas em primeira pessoa.
// As mãos originais do AC são duas peças rígidas (palma e antebraço) que só se movem inteiras em cada quadro.
// Aqui a mão nova é modelada do zero, encaixada no antebraço e no cabo/guarda-mão da arma original,
// e acompanha cada quadro da animação pelo encaixe rígido (Horn) das duas peças originais.
import * as THREE from 'three';
import { B, SP, SG, L, TU, buildPreset } from './geo.js';
import { MATS } from './materials.js';
import { computeIslands } from './md3.js';
import { rigid } from './chargear.js';

const MMU = 18;                                     // mm por unidade do MD3 nas armas (antebraço ≈ 28 cm)

// tons de pele
const SKINS = { clara: [212, 168, 138], media: [184, 134, 100], morena: [150, 102, 72], escura: [104, 70, 50] };
Object.entries(SKINS).forEach(([k, c]) => { const key = 'pele_' + k; if (!MATS[key]) MATS[key] = { n: 'Pele (' + k + ')', c, p: 'paint', wear: 0, cat: 'detalhe' }; });
if (!MATS.lanaLuva && MATS.feldgrauLa) MATS.lanaLuva = { ...MATS.feldgrauLa, n: 'Luva de lã', c: [92, 90, 84], wearColor: [120, 118, 110] };

export const SKIN_TONES = [['clara', 'Clara'], ['media', 'Média'], ['morena', 'Morena'], ['escura', 'Escura']];

// estilos: forma (manga inteira, luva, manga arregaçada) + materiais
export const HAND_STYLES = [
  { id: 'orig', n: 'Original do AC (makkE)', war: 0 },
  { id: 'wehr', n: 'Wehrmacht — lã feldgrau', war: 2, form: 'manga', sleeve: 'feldgrauLa', cuff: 'feldgrauEsc' },
  { id: 'wehrLuva', n: 'Wehrmacht — luva de couro preta', war: 2, form: 'luva', sleeve: 'feldgrauLa', glove: 'couroPreto' },
  { id: 'fallschirm', n: 'Fallschirmjäger — splinter + luva', war: 2, form: 'luva', sleeve: 'splinter', glove: 'couroPreto' },
  { id: 'dak', n: 'Afrikakorps — manga arregaçada', war: 2, form: 'arregacada', sleeve: 'tanDAK', watch: true },
  { id: 'usOD', n: 'EUA — lã verde-oliva (OD)', war: 2, form: 'manga', sleeve: 'odLa', cuff: 'odLa' },
  { id: 'usM41', n: 'EUA — jaqueta M41 + luva marrom', war: 2, form: 'luva', sleeve: 'khakiM41', glove: 'couroMarrom' },
  { id: 'usHBT', n: 'EUA — fuzileiro, manga arregaçada', war: 2, form: 'arregacada', sleeve: 'frogskinT', watch: true },
  { id: 'brit', n: 'Reino Unido — battledress', war: 2, form: 'manga', sleeve: 'khakiBD', cuff: 'khakiBD' },
  { id: 'sov', n: 'URSS — gimnastiorka arregaçada', war: 2, form: 'arregacada', sleeve: 'sovKhaki' },
  { id: 'sovInv', n: 'URSS — telogreika + luva de lã', war: 2, form: 'luva', sleeve: 'telogreika', glove: 'lanaLuva' },
  { id: 'inverno', n: 'Inverno — manga branca + luva', war: 2, form: 'luva', sleeve: 'brancoInv', glove: 'couroMarrom' },
  { id: 'frWW1', n: '1ª Guerra — França, azul-horizonte', war: 1, form: 'manga', sleeve: 'horizonte', cuff: 'horizonte', buttons: true },
  { id: 'deWW1', n: '1ª Guerra — Alemanha, punho Brandenburg', war: 1, form: 'manga', sleeve: 'feldgrauLa', cuff: 'feldgrauEsc', buttons: true, tall: true },
  { id: 'ukWW1', n: '1ª Guerra — Reino Unido, cáqui', war: 1, form: 'manga', sleeve: 'khakiBD', cuff: 'khakiBD' },
];
export const handStyle = id => HAND_STYLES.find(s => s.id === id) || HAND_STYLES[0];

// ---------------------------------------------------------------- encaixe nas mãos originais
const V = (a, i) => new THREE.Vector3(a[i * 3], a[i * 3 + 1], a[i * 3 + 2]);
function pcaAxes(pts) {
  const c = new THREE.Vector3(); pts.forEach(p => c.add(p)); c.divideScalar(pts.length);
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  pts.forEach(p => { const d = [p.x - c.x, p.y - c.y, p.z - c.z]; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) C[a][b] += d[a] * d[b]; });
  const mul = v => new THREE.Vector3(C[0][0] * v.x + C[0][1] * v.y + C[0][2] * v.z, C[1][0] * v.x + C[1][1] * v.y + C[1][2] * v.z, C[2][0] * v.x + C[2][1] * v.y + C[2][2] * v.z);
  let v = new THREE.Vector3(0.3, 1, 0.2).normalize();
  for (let i = 0; i < 80; i++) v = mul(v).normalize();
  return { c, axis: v };
}
// peças da mão original: [antebraço, palma] (a palma é a que fica mais à frente)
export function handPieces(hs) {
  const s = { ...hs }; computeIslands(s);
  const byPiece = new Map();
  for (let i = 0; i < s.nIsl; i++) { const p = s.piece[i]; if (!byPiece.has(p)) byPiece.set(p, []); byPiece.get(p).push(...s.islVerts[i]); }
  const list = [...byPiece.values()].map(vs => ({ vs, y: vs.reduce((a, v) => a + hs.pos[0][v * 3 + 1], 0) / vs.length }));
  list.sort((a, b) => a.y - b.y);
  if (list.length < 2) return null;
  const palm = list[list.length - 1].vs, arm = list.slice(0, -1).flatMap(x => x.vs);
  return { arm, palm };
}
// cotovelo (E), pulso (W), raios e centro da palma no quadro 0
function smallestAxis(C) {                                      // menor autovetor (iteração inversa com deslocamento)
  const tr = C[0][0] + C[1][1] + C[2][2];
  const M = [0, 1, 2].map(i => [0, 1, 2].map(j => (i === j ? tr : 0) - C[i][j]));
  let v = new THREE.Vector3(0.2, 0.3, 1).normalize();
  for (let i = 0; i < 80; i++) v = new THREE.Vector3(M[0][0] * v.x + M[0][1] * v.y + M[0][2] * v.z, M[1][0] * v.x + M[1][1] * v.y + M[1][2] * v.z, M[2][0] * v.x + M[2][1] * v.y + M[2][2] * v.z).normalize();
  return v;
}
export function handAnchors(hs) {
  const pc = handPieces(hs); if (!pc) return null;
  const P = hs.pos[0], F = pc.arm.map(v => V(P, v)), H = pc.palm.map(v => V(P, v));
  const Hc = new THREE.Vector3(); H.forEach(p => Hc.add(p)); Hc.divideScalar(H.length);
  const { c: Fc, axis } = pcaAxes(F); const u = axis.clone();
  if (u.dot(Hc.clone().sub(Fc)) < 0) u.negate();
  const t = F.map(p => p.clone().sub(Fc).dot(u)), t0 = Math.min(...t), t1 = Math.max(...t), Lf = t1 - t0;
  const radAt = sel => { const r = F.filter((_, i) => sel(t[i])).map(p => { const d = p.clone().sub(Fc); return d.sub(u.clone().multiplyScalar(d.dot(u))).length(); }); return r.reduce((a, b) => a + b, 0) / Math.max(1, r.length); };
  return {
    pc, u, Lf, Hc,
    E: Fc.clone().addScaledVector(u, t0), W: Fc.clone().addScaledVector(u, t1),
    rE: radAt(x => x < t0 + 0.15 * Lf), rW: radAt(x => x > t1 - 0.15 * Lf),
  };
}

// ---------------------------------------------------------------- modelagem (mm, mão esquerda canônica)
// eixos locais da mão: X = do pulso para os dedos, Y = eixo do cabo (lado do polegar = +Y·side), Z = normal da palma (para o objeto)
function handParts(o) {
  let { Lp, rg, side, mat, glove, thumbMode, fist } = o, k = Lp / 95 * 0.88, gl = glove ? 1.5 : 0;
  const parts = [], Wp = 84 * k, Tp = 30 * k + gl, Lp0 = Lp; Lp = Lp * 0.88;
  const G = [0.6 * Lp0, Tp / 2 + rg];                                     // centro do cabo (X, Z)
  parts.push(B('hand', mat, [Lp * 0.92, Wp, Tp], [Lp * 0.5, 0, 0], { bev: 7 * k, rr: 12 * k, cell: 'palma' }));
  parts.push(SP('hand', mat, [32 * k + gl, 36 * k + gl, 18 * k + gl], [8 * k, 0, -1 * k], { seg: [10, 7], cell: 'palma' }));
  // dedos: indicador → mínimo
  const F = [[31, [44, 26, 20], 9.5], [11, [48, 30, 22], 9.9], [-10, [45, 28, 21], 9.3], [-30, [36, 21, 18], 8.3]];
  F.forEach(([y, segs, r], fi) => {
    const rf = r * k + gl * 0.6, yy = y * k * side * (Wp / (84 * k));
    const K = new THREE.Vector2(Lp - 6 * k, 2 * k), R = Math.max(rg + rf * 0.92, 8);
    let th = Math.atan2(K.y - G[1], K.x - G[0]);
    // primeiro ponto do arco: o mais perto do nó do dedo
    const pts = [[K.x, yy, K.y]];
    let maxTurn = (fist ? 250 : 105) * Math.PI / 180, turned = 0;
    const first = [G[0] + Math.cos(th) * R, G[1] + Math.sin(th) * R];
    if (Math.hypot(first[0] - K.x, first[1] - K.y) > 4 * k) pts.push([first[0], yy, first[1]]);
    segs.forEach(sl => {
      const d = (sl * k) / R; if (turned + d > maxTurn) return; turned += d; th += d;
      pts.push([G[0] + Math.cos(th) * R, yy, G[1] + Math.sin(th) * R]);
    });
    parts.push(TU('hand', mat, pts, rf, { n: Math.max(6, (pts.length - 1) * 3), rs: 8, cell: 'dedos' }));
    parts.push(SP('hand', mat, [rf * 0.98, rf * 0.98, rf * 0.98], pts[pts.length - 1], { seg: [8, 6], cell: 'dedos' }));
    parts.push(SP('hand', mat, [rf * 1.08, rf * 1.08, rf * 1.08], pts[0], { seg: [8, 6], cell: 'dedos' }));     // nó do dedo
  });
  // polegar
  const ty = (Wp / 2 + 4 * k) * side, rt = 11 * k + gl * 0.6;
  const T0 = [26 * k, ty * 0.8, 2 * k], T1 = thumbMode === 'along' ? [42 * k, ty * 1.08, Tp * 0.5 + 2 * k] : [52 * k, ty * 1.12, Tp * 0.5 + 6 * k];
  let T2, T3;
  if (thumbMode === 'along') {                                         // apoio: polegar deitado ao longo do guarda-mão
    const xs = G[0] - (rg + rt) * 0.95;                                // lado de cá do guarda-mão, apontando para a frente
    T2 = [xs + 4 * k, ty * 1.05 + side * 22 * k, G[1] - rg * 0.25]; T3 = [xs, ty * 1.0 + side * 46 * k, G[1] + rg * 0.1];
  } else {                                                             // punho fechado: polegar por cima dos dedos
    const R = rg + rt * 1.9, a1 = Math.PI * 0.62, a2 = Math.PI * 0.95;
    T2 = [G[0] + Math.cos(a1) * R * 0.95, ty * 0.75, G[1] + Math.sin(a1) * R]; T3 = [G[0] + Math.cos(a2) * R * 0.8, ty * 0.35, G[1] + Math.sin(a2) * R * 0.9];
  }
  parts.push(TU('hand', mat, [T0, T1, T2, T3], rt, { n: 10, rs: 8, cell: 'polegar' }));
  parts.push(SP('hand', mat, [rt, rt, rt], T3, { seg: [8, 6], cell: 'polegar' }));
  parts.push(SP('hand', mat, [24 * k + gl, 18 * k + gl, 16 * k + gl], [30 * k, ty * 0.55, 3 * k], { seg: [10, 7], cell: 'palma' }));    // base do polegar
  return parts;
}
// antebraço e manga (mm) ao longo de +Y local, de 0 (cotovelo) a Lf (pulso)
function armParts(o, st, skin) {
  const { Lf, rE, rW } = o, parts = [];
  const r = t => rW + (rE - rW) * Math.pow(Math.max(0, 1 - t), 0.75) + Math.sin(Math.min(1, Math.max(0, t)) * Math.PI) * (rE - rW) * 0.12;
  const prof = (t0, t1, k, n, wav = 0, add = 0) => { const p = []; for (let i = 0; i <= n; i++) { const t = t0 + (t1 - t0) * i / n; p.push([r(t) * k + add + wav * Math.sin(t * 41) * Math.sin(t * 17 + 1), t * Lf]); } return p; };
  const close = p => [[0, p[0][1]], ...p, [0, p[p.length - 1][1]]];
  const gloveFlare = st.form === 'luva';
  if (st.form === 'arregacada') {
    parts.push(L('arm', skin, close(prof(-0.1, 1.02, 1, 18)), [0, 0, 0], { seg: 12, cell: 'braco' }));
    parts.push(L('arm', st.sleeve, close(prof(-0.12, 0.2, 1.42, 10, 2.2, 3)), [0, 0, 0], { seg: 12, cell: 'manga' }));
    parts.push(L('arm', st.sleeve, close(prof(0.17, 0.27, 1.3, 5, 1.2, 2)), [0, 0, 0], { seg: 12, cell: 'dobra' }));
    if (st.watch) {
      const t = 0.86, rr = r(t) + 1.2;
      parts.push(L('arm', 'couroMarrom', close([[rr, t * Lf - 7], [rr + 1.6, t * Lf - 6], [rr + 1.6, t * Lf + 6], [rr, t * Lf + 7]]), [0, 0, 0], { seg: 12, cell: 'pulseira' }));
      parts.push(L('arm', 'acoGasto', close([[0.1, -1], [9.5, -1], [10.5, 1], [10.5, 3], [9, 4.2], [0.1, 4.2]]), [0, t * Lf, 0], { seg: 12, rot: [0, 0, -90], M: new THREE.Matrix4().makeTranslation(rr + 1.2, 0, 0).toArray(), cell: 'relogio' }));
    }
  } else {
    const end = gloveFlare ? 0.9 : 0.93;
    parts.push(L('arm', st.sleeve, close(prof(-0.12, end, 1.16, 14, 1.4, 2)), [0, 0, 0], { seg: 12, cell: 'manga' }));
    if (!gloveFlare) {
      const c0 = st.tall ? 0.72 : 0.84;
      parts.push(L('arm', st.cuff || st.sleeve, close(prof(c0, 0.955, 1.26, 6, 0.4, 3.5)), [0, 0, 0], { seg: 12, cell: 'punho' }));
      parts.push(L('arm', skin, close(prof(0.86, 1.03, 0.98, 6)), [0, 0, 0], { seg: 12, cell: 'braco' }));
      if (st.buttons) [0.8, 0.9].forEach(t => { if (t < c0 && !st.tall) return; parts.push(SP('arm', 'latao', [3.4, 3.4, 2.2], [0, t * Lf, r(t) * 1.26 + 3.2], { seg: [10, 7], cell: 'botoes' })); });
    } else {
      parts.push(L('arm', st.glove, close(prof(0.8, 1.04, 1.24, 8, 0.6, 3)), [0, 0, 0], { seg: 12, cell: 'luvaPunho' }));
    }
  }
  return parts;
}

// ---------------------------------------------------------------- monta a superfície nova "hands"
// m0: modelo MD3 original do slot (mãos + arma originais); slot: knife, pistol…; st: estilo; tone: tom de pele
export function buildHands(m0, slot, styleId, tone = 'media') {
  const st = handStyle(styleId); if (!st.form) return null;
  const hi = m0.surfaces.findIndex(s => s.name === 'hands'); if (hi < 0) return null;
  const hs = m0.surfaces[hi], A = handAnchors(hs); if (!A) return null;
  const fist = ['knife', 'pistol', 'grenade'].includes(slot);
  // eixo e centro do que a mão segura
  const H0v = A.pc.palm.map(v => V(hs.pos[0], v)), pp = pcaAxes(H0v);
  const others = []; m0.surfaces.forEach((s, i) => { if (i !== hi) for (let v = 0; v < s.nv; v++) others.push(V(s.pos[0], v)); });
  let G, a, rg, nUp = null;
  if (fist) {                                                       // faca, pistola, granada: cabo em pé dentro do punho
    a = new THREE.Vector3(0, 0, 1);
    const near = others.filter(p => p.distanceTo(A.Hc) < 3.2);
    G = near.length > 6 ? near.reduce((c, p) => c.add(p), new THREE.Vector3()).divideScalar(near.length) : A.Hc.clone();
    G.z = A.Hc.z;
    rg = slot === 'grenade' ? 1.25 : slot === 'pistol' ? 0.95 : 0.7;
  } else {                                                          // armas longas: guarda-mão ao longo do cano (+Y)
    a = new THREE.Vector3(0, 1, 0);
    // normal da palma original (menor eixo da palma), apontando para cima, para a arma
    const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; H0v.forEach(p => { const d = p.clone().sub(A.Hc).toArray(); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += d[i] * d[j]; });
    const n0 = smallestAxis(C); if (n0.z < 0) n0.negate(); nUp = n0.clone();
    // corte da arma acima da palma: centro e raio do guarda-mão
    const up = A.Hc.clone().addScaledVector(n0, 1.2);
    const slab = others.filter(p => Math.abs(p.y - up.y) < 1.6 && Math.hypot(p.x - up.x, p.z - up.z) < 4.5 && p.z > A.Hc.z);
    if (slab.length > 4) {
      const zmin = Math.min(...slab.map(p => p.z)), xs = slab.map(p => p.x);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2, hw = (Math.max(...xs) - Math.min(...xs)) / 2;
      rg = Math.min(2.2, Math.max(0.9, hw));
      G = new THREE.Vector3(cx, up.y, zmin + rg);
    } else { rg = 1.4; G = A.Hc.clone().addScaledVector(n0, 1 + rg); }
  }
  const W = A.W.clone(), thumbDir = fist ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
  const side = a.dot(thumbDir) >= 0 ? 1 : -1;
  const rgm = rg * MMU, glove = st.form === 'luva';
  const skin = 'pele_' + (SKINS[tone] ? tone : 'media'), handMat = glove ? st.glove : skin;
  const zg = 15 + (glove ? 1.5 : 0) + rgm;
  const det = (d, a, n) => new THREE.Matrix3().set(d.x, a.x, n.x, d.y, a.y, n.y, d.z, a.z, n.z).determinant();
  let d, n, Lp, origin, wristLink = null;
  if (fist) {
    // punho: o calcanhar da palma fica no pulso e a mão se inclina até o cabo
    const v = G.clone().sub(W); v.sub(a.clone().multiplyScalar(v.dot(a)));
    const Lv = Math.max(v.length(), 2.5) * MMU;
    let xg = Math.sqrt(Math.max(1, Lv * Lv - zg * zg));
    Lp = Math.min(96, Math.max(80, xg / 0.6)); xg = 0.6 * Lp;
    const vh = v.clone().normalize(), w = new THREE.Vector3().crossVectors(a, vh), ang = Math.atan2(zg, xg);
    const pick = sgn => ({ d: vh.clone().multiplyScalar(Math.cos(ang)).addScaledVector(w, -sgn * Math.sin(ang)).normalize(), n: vh.clone().multiplyScalar(Math.sin(ang)).addScaledVector(w, sgn * Math.cos(ang)).normalize() });
    ({ d, n } = pick(1)); if (det(d, a, n) < 0) ({ d, n } = pick(-1));
    origin = W.clone();
  } else {
    // apoio: palma deitada embaixo do guarda-mão, dedos subindo pelo lado de lá; o pulso dobra até o antebraço
    Lp = 88;
    n = nUp.clone().sub(a.clone().multiplyScalar(nUp.dot(a))).normalize();
    d = new THREE.Vector3().crossVectors(a, n).normalize(); if (d.x < 0) d.negate();
    const Pc = G.clone().addScaledVector(n, -zg / MMU).addScaledVector(d, -(0.6 - 0.5) * Lp / MMU);   // centro da palma
    origin = Pc.clone().addScaledVector(d, -0.5 * Lp / MMU);                                         // calcanhar da palma
    wristLink = W.clone();
  }
  if (det(d, a, n) < 0) a = a.clone().negate();
  const sideF = a.dot(thumbDir) >= 0 ? 1 : -1;
  const Mh = new THREE.Matrix4().makeBasis(d, a, n).scale(new THREE.Vector3(1 / MMU, 1 / MMU, 1 / MMU)).setPosition(origin);
  // antebraço: +Y local → u
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), A.u);
  const Ma = new THREE.Matrix4().compose(A.E, q, new THREE.Vector3(1 / MMU, 1 / MMU, 1 / MMU));
  const hpL = handParts({ Lp, rg: rgm, side: sideF, mat: handMat, glove, thumbMode: fist ? 'wrap' : 'along', fist });
  if (wristLink) {                                                   // pulso: liga o fim do antebraço ao calcanhar da palma
    const wl = wristLink.clone().applyMatrix4(Mh.clone().invert()).toArray(), rw = A.rW * MMU * 0.92 + (glove ? 2 : 0);
    hpL.push(SG('hand', handMat, wl, [10, 0, 0], rw, { seg: 10, cell: 'pulso' }));
    hpL.push(SP('hand', handMat, [rw, rw, rw], wl, { seg: [10, 7], cell: 'pulso' }));
  }
  const hp = hpL.map(p => ({ ...p, M: Mh.clone().multiply(p.M ? new THREE.Matrix4().fromArray(p.M) : new THREE.Matrix4()).toArray() }));
  const ap = armParts({ Lf: A.Lf * MMU, rE: A.rE * MMU, rW: A.rW * MMU }, st, skin).map(p => ({ ...p, M: Ma.clone().multiply(p.M ? new THREE.Matrix4().fromArray(p.M) : new THREE.Matrix4()).toArray() }));
  const Bp = buildPreset({ build: () => ({ parts: [...ap, ...hp] }) }, { soft: true, W: 512, H: 512 });
  // quadros: cada vértice segue a peça original correspondente (palma ou antebraço)
  const nv = Bp.pos.length / 3, isHand = new Uint8Array(nv);
  for (let i = 0; i < nv; i++) isHand[i] = Bp.parts[Bp.vpart[i]].g === 'hand' ? 1 : 0;
  const gather = (f, vs) => { const P = hs.pos[f], o = new Float32Array(vs.length * 3); vs.forEach((vv, i) => { o[i * 3] = P[vv * 3]; o[i * 3 + 1] = P[vv * 3 + 1]; o[i * 3 + 2] = P[vv * 3 + 2]; }); return o; };
  const A0 = gather(0, A.pc.arm), H0 = gather(0, A.pc.palm);
  const pos = [], nrm = [], tmp = new THREE.Vector3();
  for (let f = 0; f < m0.nf; f++) {
    const Mf = [rigid(A0, gather(f, A.pc.arm)), rigid(H0, gather(f, A.pc.palm))], Nf = Mf.map(M => new THREE.Matrix3().getNormalMatrix(M));
    const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3);
    for (let i = 0; i < nv; i++) {
      const h = isHand[i];
      tmp.set(Bp.pos[i * 3], Bp.pos[i * 3 + 1], Bp.pos[i * 3 + 2]).applyMatrix4(Mf[h]); P.set([tmp.x, tmp.y, tmp.z], i * 3);
      tmp.set(Bp.nrm[i * 3], Bp.nrm[i * 3 + 1], Bp.nrm[i * 3 + 2]).applyMatrix3(Nf[h]).normalize(); N.set([tmp.x, tmp.y, tmp.z], i * 3);
    }
    pos.push(P); nrm.push(N);
  }
  return { Bp, hi, style: st, tone, pos, nrm, nv, tris: new Int32Array(Bp.tris), uv: new Float32Array(Bp.uv) };
}
