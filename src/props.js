// CUBE MAKER — mapmodels da 1ª e 2ª Guerra (cenário, veículos, aviões, artilharia, objetos, soldados caídos)
// Milímetros, +Y = frente, +Z = cima. O modelo é centralizado e apoiado no chão (z = 0) na hora de montar.
import * as THREE from 'three';
import { B, C, L, E, SP, T, SG, LO, W, TU, PI, helix, starPts, circlePts, roundRect, xform, TRS } from './geo.js';
import { HD } from './arsenal_hd.js';
import { BOATS } from './boats.js';

const D2R = Math.PI / 180;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const rnd = s => { let x = Math.sin(s * 127.1) * 43758.5453; return x - Math.floor(x); };

// ---------------------------------------------------------------- peças auxiliares
// roda: pneu (torno) + aro + cubo, eixo em X
function wheel(x, y, z, R, w, o = {}) {
  const tire = o.tire || 'borracha', hub = o.hub || 'oliva', r0 = R * (o.rim || 0.62), g = o.g || null;
  const P = [
    L(g, tire, [[r0, -w / 2], [R - w * 0.25, -w / 2], [R, -w * 0.2], [R, w * 0.2], [R - w * 0.25, w / 2], [r0, w / 2]], [x, y, z], { axis: 'x', seg: o.seg || 22, cell: 'pneu' + tire }),
    C(g, hub, r0, w * 0.86, [x, y, z], { axis: 'x', seg: 18, cell: 'aro' + hub }),
    C(g, hub, r0 * 0.35, w * 1.05, [x, y, z], { axis: 'x', seg: 10, cell: 'cubo' + hub }),
  ];
  if (o.spokes) for (let i = 0; i < o.spokes; i++) {
    const a = i / o.spokes * Math.PI * 2;
    P.push(SG(g, hub, [x, y + Math.cos(a) * r0 * 0.3, z + Math.sin(a) * r0 * 0.3], [x, y + Math.cos(a) * r0 * 0.98, z + Math.sin(a) * r0 * 0.98], o.spokeR || 14, { seg: 5, cell: 'raio' + hub }));
  }
  return P;
}
// roda de madeira com raios (carroça, canhão da 1ª Guerra)
function spokedWheel(x, y, z, R, w, n = 12, mat = 'tabuas', iron = 'acoOxidado') {
  const P = [T(null, iron, R - 18, 22, [x, y, z], { rot: [0, 90, 0], seg: [6, 32], cell: 'aroferro' }), T(null, mat, R - 60, 34, [x, y, z], { rot: [0, 90, 0], seg: [6, 32], cell: 'aromadeira' }),
    C(null, iron, R * 0.16, w * 1.6, [x, y, z], { axis: 'x', seg: 12, cell: 'cuboferro' })];
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; P.push(SG(null, mat, [x, y + Math.cos(a) * R * 0.14, z + Math.sin(a) * R * 0.14], [x, y + Math.cos(a) * (R - 70), z + Math.sin(a) * (R - 70)], 16, { seg: 6, cell: 'raiomadeira' })); }
  return P;
}
const sandbag = (x, y, z, yaw = 0, mat = 'sacoAreia', s = 1) => PI(null, mat, [130 * s, 270 * s, 72 * s], [x, y, z], { rot: [rnd(x + y * 3 + z) * 6 - 3, rnd(x * 7 + y) * 6 - 3, yaw], seg: [9, 6], e: 0.42, cell: 'saco' + mat });

// insígnias no plano YZ (normal +X), espessura t em X a partir de x=0
function insignia(kind, R, t = 6) {
  const disc = (r, mat, k) => C(null, mat, r, t, [t / 2 + k * t * 0.6, 0, 0], { axis: 'x', seg: 28, cell: 'ins' + mat });
  switch (kind) {
    case 'roundel': return [disc(R, 'azulRoundel', 0), disc(R * 0.62, 'branco', 1), disc(R * 0.36, 'vermelho', 2)];
    case 'roundelA': return [disc(R, 'amarelo', 0), disc(R * 0.86, 'azulRoundel', 1), disc(R * 0.56, 'branco', 2), disc(R * 0.33, 'vermelho', 3)];
    case 'hinomaru': return [disc(R, 'branco', 0), disc(R * 0.86, 'vermelho', 1)];
    case 'starUS': return [disc(R, 'azulRoundel', 0), E(null, 'branco', starPts(R * 0.98), t, [t * 1.1, 0, 0], { cell: 'insstar' }), B(null, 'branco', [t, R * 3.2, R * 0.5], [t * 0.5, 0, 0], { cell: 'insbar' })];
    case 'starW': return [E(null, 'branco', starPts(R), t, [t / 2, 0, 0], { cell: 'insstarw' })];
    case 'starR': return [E(null, 'branco', starPts(R * 1.08), t, [t / 2, 0, 0], { cell: 'insstarw' }), E(null, 'vermelho', starPts(R), t, [t * 1.1, 0, 0], { cell: 'insstarr' })];
    case 'balken': {
      const a = R * 2, b = R * 0.5, wb = R * 0.22;
      return [B(null, 'branco', [t, a, b + wb * 2], [t / 2, 0, 0], { cell: 'insbw' }), B(null, 'branco', [t, b + wb * 2, a], [t / 2, 0, 0], { cell: 'insbw' }),
        B(null, 'preto', [t, a - wb * 2, b], [t * 1.1, 0, 0], { cell: 'insbk' }), B(null, 'preto', [t, b, a - wb * 2], [t * 1.1, 0, 0], { cell: 'insbk' })];
    }
    case 'pattee': {                                 // cruz pátea (1ª Guerra)
      const r = R, q = R * 0.24, P = [[q, q], [r * 0.62, r], [-r * 0.62, r], [-q, q], [-r, r * 0.62], [-r, -r * 0.62], [-q, -q], [-r * 0.62, -r], [r * 0.62, -r], [q, -q], [r, -r * 0.62], [r, r * 0.62]];
      return [B(null, 'branco', [t, R * 2.3, R * 2.3], [t / 2, 0, 0], { cell: 'insbw' }), E(null, 'preto', P, t, [t * 1.1, 0, 0], { cell: 'insbk' })];
    }
  }
  return [];
}
// coloca uma lista de peças (normal +X) num ponto com rotação
const place = (parts, t, r, s = 1) => xform(parts, TRS(t, r, s, 'ZYX'));

// ---------------------------------------------------------------- capacetes (borda em z = 0, aberto embaixo)
export function helmet(kind, mat) {
  switch (kind) {
    case 'm1': return [L(null, mat, [[0, 175], [80, 168], [125, 140], [148, 90], [156, 30], [160, 0], [175, -6], [178, -10], [150, -4], [0, 30]], [0, 0, 0], { axis: 'z', seg: 22, sc: [0.92, 1.08, 1], cell: 'capacete' })];
    case 'stahl': return [L(null, mat, [[0, 165], [80, 158], [122, 130], [140, 82], [146, 36], [160, 6], [178, -24], [168, -26], [150, -4], [0, 30]], [0, 0, 0], { axis: 'z', seg: 22, sc: [0.92, 1.08, 1], cell: 'capacete' }), SP(null, mat, [10, 10, 6], [130, 20, 80], { seg: [6, 4], cell: 'capacete' }), SP(null, mat, [10, 10, 6], [-130, 20, 80], { seg: [6, 4], cell: 'capacete' })];
    case 'brodie': return [L(null, mat, [[0, 120], [70, 112], [112, 80], [130, 26], [140, 8], [205, 0], [210, -6], [200, -6], [130, 0], [0, 20]], [0, 0, 0], { axis: 'z', seg: 24, cell: 'capacete' })];
    case 'adrian': return [L(null, mat, [[0, 160], [85, 150], [125, 110], [140, 50], [150, 10], [190, -4], [192, -10], [150, -2], [0, 30]], [0, 0, 0], { axis: 'z', seg: 22, sc: [0.9, 1.1, 1], cell: 'capacete' }),
      E(null, mat, [[-150, 120], [-90, 168], [0, 186], [90, 168], [150, 118], [120, 110], [0, 160], [-120, 112]], 20, [0, 0, 0], { cell: 'crista' })];
    case 'ssh40': return [L(null, mat, [[0, 170], [82, 162], [125, 132], [146, 80], [152, 20], [158, -10], [150, -12], [0, 30]], [0, 0, 0], { axis: 'z', seg: 22, sc: [0.93, 1.07, 1], cell: 'capacete' })];
    case 'pickel': return [L(null, 'couroPreto', [[0, 150], [90, 140], [130, 90], [140, 20], [175, -4], [170, -10], [0, 20]], [0, 0, 0], { axis: 'z', seg: 20, sc: [0.92, 1.1, 1], cell: 'capacete' }), L(null, 'latao', [[0, 120], [10, 110], [22, 40], [30, 0], [0, 0]], [0, 0, 145], { axis: 'z', seg: 10 })];
    case 'quepe': return [L(null, mat, [[0, 100], [120, 96], [130, 60], [118, 0], [0, 0]], [0, 0, 0], { axis: 'z', seg: 18, cell: 'quepe' }), E(null, 'couroPreto', [[100, 0], [190, -10], [180, -24], [100, -12]], 200, [0, 0, 0], { rot: [0, 0, 90], cell: 'pala' })];
  }
  return [];
}

// ---------------------------------------------------------------- soldado (esqueleto simples + pose)
const UNIFORMS = {
  us44: { n: 'EUA 1944 (M41)', tunic: 'khakiM41', pants: 'odLa', legs: 'perneiraLona', boots: 'couroMarrom', helm: ['m1', 'oliva'], gear: 'lona', pack: 'lonaVerde' },
  de44: { n: 'Wehrmacht', tunic: 'feldgrauLa', pants: 'feldgrauEsc', legs: 'couroPreto', boots: 'couroPreto', helm: ['stahl', 'feldgrau'], gear: 'couroPreto', pack: 'lona', tall: true },
  fj: { n: 'Fallschirmjäger', tunic: 'splinter', pants: 'feldgrauLa', legs: 'couroPreto', boots: 'couroPreto', helm: ['stahl', 'feldgrau'], gear: 'couroPreto', pack: 'lona' },
  dak: { n: 'Afrika Korps', tunic: 'tanDAK', pants: 'tanDAK', legs: 'perneiraLona', boots: 'couroMarrom', helm: ['stahl', 'dunkelgelb'], gear: 'lona', pack: 'lona' },
  uk: { n: 'Britânico', tunic: 'khakiBD', pants: 'khakiBD', legs: 'perneiraLona', boots: 'couroPreto', helm: ['brodie', 'oliva'], gear: 'lona', pack: 'lona' },
  su: { n: 'Exército Vermelho', tunic: 'sovKhaki', pants: 'sovEsc', legs: 'couroPreto', boots: 'couroPreto', helm: ['ssh40', 'verdeSov'], gear: 'lona', pack: 'lona', tall: true },
  suInv: { n: 'Soviético (inverno)', tunic: 'telogreika', pants: 'telogreika', legs: 'couroPreto', boots: 'couroPreto', helm: ['ssh40', 'branco'], gear: 'lona', pack: 'lona' },
  deInv: { n: 'Alemão (inverno)', tunic: 'brancoInv', pants: 'brancoInv', legs: 'couroPreto', boots: 'couroPreto', helm: ['stahl', 'inverno'], gear: 'couroPreto', pack: 'lona' },
  usmc: { n: 'USMC (Pacífico)', tunic: 'frogskinT', pants: 'frogskinT', legs: 'perneiraLona', boots: 'couroMarrom', helm: ['m1', 'frogskinT'], gear: 'lona', pack: 'lonaVerde' },
  fr16: { n: 'Poilu francês 1916', tunic: 'horizonte', pants: 'horizonte', legs: 'perneira', boots: 'couroPreto', helm: ['adrian', 'azulHorizonte'], gear: 'couro', pack: 'lona' },
  de16: { n: 'Alemão 1916', tunic: 'feldgrauLa', pants: 'feldgrauLa', legs: 'couroMarrom', boots: 'couroMarrom', helm: ['stahl', 'feldgrau'], gear: 'couroMarrom', pack: 'couro', tall: true },
  uk16: { n: 'Tommy 1916', tunic: 'khakiBD', pants: 'khakiBD', legs: 'perneira', boots: 'couroMarrom', helm: ['brodie', 'oliva'], gear: 'lona', pack: 'lona' },
  us18: { n: 'Doughboy 1918', tunic: 'odLa', pants: 'odLa', legs: 'perneira', boots: 'couroMarrom', helm: ['brodie', 'oliva'], gear: 'lona', pack: 'lona' },
};
export const UNIFORM_OPTS = Object.entries(UNIFORMS).map(([k, u]) => [k, u.n]);
// ângulos em graus: [x, y, z] (x: dobra para frente/trás; y: lateral; z: gira)
const POSES = {
  brucos: { root: [-90, 0, 8], spine: [4, 0, 0], neck: [20, 0, 30], sL: [-160, -12, 0], eL: [-30], sR: [-20, 30, 0], eR: [-60], hL: [6, -10, 0], kL: [-12], hR: [30, 12, 0], kR: [-75], fall: 'down' },
  costas: { root: [90, 0, -6], spine: [-4, 0, 0], neck: [-14, 8, 20], sL: [-15, -75, 0], eL: [-20], sR: [-35, 70, 0], eR: [-50], hL: [-4, -8, 0], kL: [-10], hR: [-14, 14, 0], kR: [-30] },
  sentado: { root: [14, 0, 0], spine: [8, 0, 0], neck: [-40, 0, 8], sL: [-18, -8, 0], eL: [-30], sR: [-30, 18, 0], eR: [-24], hL: [96, -14, -6], kL: [-60], hR: [70, 16, 8], kR: [-20], seated: true },
  lado: { root: [-10, 90, 0], spine: [-14, 0, 0], neck: [-20, 0, 0], sL: [-60, 10, 0], eL: [-80], sR: [-70, -10, 0], eR: [-70], hL: [70, 0, 0], kL: [-90], hR: [50, 0, 0], kR: [-70] },
  ajoelhado: { root: [-30, 0, 0], spine: [-30, 0, 0], neck: [-35, 0, 0], sL: [-30, 0, 0], eL: [-20], sR: [-20, 10, 0], eR: [-30], hL: [80, -8, 0], kL: [-110], hR: [10, 10, 0], kR: [-100], kneel: true },
};
export const POSE_OPTS = [['brucos', 'De bruços'], ['costas', 'De costas'], ['sentado', 'Sentado, encostado'], ['lado', 'De lado, encolhido'], ['ajoelhado', 'Caído de joelhos']];
function soldier(poseKey, uk, o = {}) {
  const U = UNIFORMS[uk] || UNIFORMS.us44, Pz = POSES[poseKey] || POSES.brucos, P = [];
  const R = a => new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(a[0] * D2R, a[1] * D2R, (a[2] || 0) * D2R, 'ZYX'));
  const Tm = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
  const root = Tm(0, 0, 0).multiply(R(Pz.root));
  const spine = root.clone().multiply(Tm(0, 0, 40)).multiply(R(Pz.spine));
  const pt = (M, x, y, z) => V3(x, y, z).applyMatrix4(M).toArray();
  const put = (M, part) => ({ ...part, M: M.clone().multiply(part.M ? new THREE.Matrix4().fromArray(part.M) : new THREE.Matrix4()).toArray() });
  // tronco e quadril
  P.push(put(root, LO(null, U.pants, [{ y: -60, w: 330, ht: 110, hb: 110 }, { y: 60, w: 350, ht: 120, hb: 120 }], [0, 0, 0], { rot: [90, 0, 0], seg: 12, cell: 'quadril' })));
  P.push(put(spine, LO(null, U.tunic, [{ y: 0, w: 330, ht: 110, hb: 110 }, { y: 200, w: 360, ht: 125, hb: 120 }, { y: 400, w: 420, ht: 125, hb: 115 }, { y: 500, w: 400, ht: 100, hb: 100, n: 2.6 }, { y: 530, w: 260, ht: 70, hb: 70 }], [0, 0, 0], { rot: [90, 0, 0], seg: 14, cell: 'tronco' })));
  P.push(put(spine, B(null, U.gear, [370, 250, 50], [0, 0, 20], { bev: 8, cell: 'cinto' })));
  P.push(put(spine, B(null, U.gear, [90, 50, 70], [-110, 128, 0], { bev: 8, cell: 'bolsa' })), put(spine, B(null, U.gear, [90, 50, 70], [110, 128, 0], { bev: 8, cell: 'bolsa' })));
  P.push(put(spine, SG(null, U.gear, [-170, 90, 480], [120, 118, 30], 18, { seg: 5, cell: 'correia' })), put(spine, SG(null, U.gear, [170, 90, 480], [-120, 118, 30], 18, { seg: 5, cell: 'correia' })));
  if (o.pack !== false) P.push(put(spine, B(null, U.pack, [300, 130, 300], [0, -190, 300], { bev: 30, cell: 'mochila' })));
  // cabeça
  const neck = spine.clone().multiply(Tm(0, 0, 540)).multiply(R(Pz.neck));
  P.push(put(neck, C(null, 'pele', 52, 90, [0, 0, 40], { axis: 'z', seg: 10, cell: 'pescoco' })));
  P.push(put(neck, SP(null, 'pele', [92, 104, 116], [0, 12, 160], { seg: [14, 10], cell: 'cabeca' })));
  P.push(put(neck, SP(null, 'pele', [24, 30, 22], [0, 108, 150], { seg: [6, 5], cell: 'nariz' })));
  if (o.helmet !== false) P.push(...helmet(U.helm[0], U.helm[1]).map(h => put(neck.clone().multiply(Tm(0, 4, 192)).multiply(R([-6, 0, 0])), h)));
  // braços
  [['L', -1], ['R', 1]].forEach(([s, sg]) => {
    const sh = spine.clone().multiply(Tm(sg * 215, 0, 470)).multiply(R([Pz['s' + s][0], Pz['s' + s][1] * sg, (Pz['s' + s][2] || 0) * sg]));
    const el = sh.clone().multiply(Tm(0, 0, -300)).multiply(R([Pz['e' + s][0], 0, 0]));
    P.push(SG(null, U.tunic, pt(sh, 0, 0, 0), pt(sh, 0, 0, -300), 56, { r2: 50, seg: 9, cell: 'braco' }));
    P.push(SP(null, U.tunic, [58, 58, 58], [0, 0, 0], { M: sh.toArray(), seg: [8, 6], cell: 'ombro' }));
    P.push(SG(null, U.tunic, pt(el, 0, 0, 0), pt(el, 0, 0, -250), 48, { r2: 40, seg: 9, cell: 'antebraco' }));
    P.push(SP(null, 'pele', [40, 26, 70], [0, 10, -290], { M: el.toArray(), seg: [8, 6], cell: 'mao' }));
  });
  // pernas
  [['L', -1], ['R', 1]].forEach(([s, sg]) => {
    const hp = root.clone().multiply(Tm(sg * 100, 0, -40)).multiply(R([Pz['h' + s][0], Pz['h' + s][1] * sg, (Pz['h' + s][2] || 0) * sg]));
    const kn = hp.clone().multiply(Tm(0, 0, -430)).multiply(R([Pz['k' + s][0], 0, 0]));
    P.push(SG(null, U.pants, pt(hp, 0, 0, 0), pt(hp, 0, 0, -430), 78, { r2: 62, seg: 10, cell: 'coxa' }));
    P.push(SG(null, U.legs, pt(kn, 0, 0, 0), pt(kn, 0, 0, -400), 60, { r2: 50, seg: 10, cell: 'canela' + U.legs }));
    if (U.tall) P.push(SG(null, U.boots, pt(kn, 0, 0, -120), pt(kn, 0, 0, -400), 64, { r2: 56, seg: 10, cell: 'cano' }));
    P.push(B(null, U.boots, [100, 270, 100], [0, 70, -440], { M: kn.toArray(), bev: 20, cell: 'bota' }));
    P.push(B(null, 'couroPreto', [104, 274, 22], [0, 70, -485], { M: kn.toArray(), bev: 6, cell: 'sola' }));
  });
  return P;
}

// ---------------------------------------------------------------- fuzil simples (para túmulos e cenas)
function rifleProp(M, wood = 'faia') {
  const parts = [
    E(null, wood, [[-560, -18], [-560, -130], [-520, -136], [-330, -60], [-250, -62], [-220, -28], [380, -32], [380, -14], [-210, -12], [-500, -8]], 40, [0, 0, 0], { bev: 6, cell: 'fcoronha' }),
    C(null, 'acoOxidado', 15, 230, [0, -110, 4], { cell: 'fcaixa' }), C(null, 'acoOxidado', 9, 330, [0, 440, 4], { cell: 'fcano' }),
    C(null, 'acoOxidado', 20, 12, [0, 200, -10], { cell: 'fbraca' }), SP(null, 'acoGasto', [9, 9, 9], [44, -150, -20], { cell: 'fbola' }),
  ];
  return xform(parts, M);
}

// ---------------------------------------------------------------- pequenas montagens
function crate(x, y, z, w, l, h, mat = 'caixaVerde', o = {}) {
  const P = [B(null, mat, [w, l, h], [x, y, z + h / 2], { bev: 6, cell: 'caixa' + mat, rot: [0, 0, o.yaw || 0] })];
  const yaw = (o.yaw || 0) * D2R, c = Math.cos(yaw), s = Math.sin(yaw);
  const at = (dx, dy) => [x + dx * c - dy * s, y + dx * s + dy * c];
  [-1, 1].forEach(k => { const [px, py] = at(0, k * (l / 2 - 40)); P.push(B(null, mat, [w + 16, 40, h + 16], [px, py, z + h / 2], { bev: 4, rot: [0, 0, o.yaw || 0], cell: 'ripa' + mat })); });
  if (o.handles !== false) [-1, 1].forEach(k => { const [px, py] = at(k * (w / 2 + 14), 0); P.push(T(null, 'lona', 40, 7, [px, py, z + h * 0.62], { rot: [0, 90, (o.yaw || 0)], arc: 180, seg: [5, 10], cell: 'alca' })); });
  return P;
}
function drum(x, y, z, mat = 'oliva', o = {}) {
  const R = 290, H = 880;
  const P = [C(null, mat, R, H, [0, 0, H / 2], { axis: 'z', seg: 24, cell: 'tambor' + mat }),
    T(null, mat, R, 12, [0, 0, H * 0.33], { seg: [5, 28], cell: 'friso' + mat }), T(null, mat, R, 12, [0, 0, H * 0.66], { seg: [5, 28], cell: 'friso' + mat }),
    T(null, mat, R - 4, 14, [0, 0, H - 6], { seg: [5, 28], cell: 'friso' + mat }), T(null, mat, R - 4, 14, [0, 0, 6], { seg: [5, 28], cell: 'friso' + mat }),
    C(null, 'acoGasto', 36, 20, [R * 0.55, 0, H + 6], { axis: 'z', seg: 10, cell: 'tampa' })];
  return xform(P, TRS([x, y, z], o.rot || [0, 0, o.yaw || 0]));
}

// ---------------------------------------------------------------- aviões
// fuselagem por seções; asas com perfil; empenagem; hélice (grupo animado)
function fighter(o) {
  const P = [], F = o.fus, cam = o.top, und = o.under || o.top;
  P.push(LO(null, cam, F.map(([y, w, ht, hb, z = 0]) => ({ y, w, ht, hb, z, n: o.boxy || 2.3 })), [0, 0, 0], { seg: 20, cell: 'fuselagem' }));
  if (o.belly) P.push(LO(null, und, o.belly.map(([y, w, ht, hb, z = 0]) => ({ y, w, ht, hb, z })), [0, 0, 0], { seg: 14, cell: 'barriga' }));
  // cabine
  const cp = o.canopy; P.push(LO(null, 'vidro', cp.sec.map(([y, w, h]) => ({ y, w, ht: h, hb: 10, z: cp.z })), [0, 0, 0], { seg: 14, cell: 'cabine' }));
  if (cp.frame) cp.sec.slice(1, -1).forEach(([y, w, h]) => P.push(T(null, cam, w / 2, 9, [0, y, cp.z], { rot: [90, 0, 0], arc: 180, seg: [4, 12], cell: 'moldura', sc: [1, h / (w / 2), 1] })));
  // asas
  const w = o.wing;
  if (w.gull) {                                     // asa de gaivota invertida (Stuka)
    [-1, 1].forEach(s => {
      P.push(W(null, cam, { span: w.inner, c0: w.c0, c1: w.c0 * 0.95, t: 0.15, dih: -w.gull, half: true }, [0, w.y, w.z], { mx: s < 0, cell: 'asa1' }));
      const ex = w.inner, ez = w.z - Math.tan(w.gull * D2R) * w.inner;
      P.push(W(null, cam, { span: w.span - w.inner, c0: w.c0 * 0.95, c1: w.c1, t: 0.13, dih: w.dih, half: true }, [ex, w.y - (w.sweepIn || 0), ez], { mx: s < 0, cell: 'asa2' }));
    });
  } else P.push(W(null, cam, { span: w.span, c0: w.c0, c1: w.c1, t: w.t || 0.13, dih: w.dih || 5, ell: w.ell, sweep: w.sweep || 0, lePos: w.lePos, K: w.ell ? 16 : 10 }, [0, w.y, w.z], { cell: 'asa' }));
  const h = o.tail;
  P.push(W(null, cam, { span: h.span, c0: h.c0, c1: h.c1, t: 0.1, ell: h.ell, sweep: h.sweep || 0, K: 8 }, [0, h.y, h.z], { cell: 'profundor' }));
  P.push(W(null, cam, { span: h.fin, c0: h.fc0, c1: h.fc1, t: 0.1, ell: h.ell, sweep: h.fsweep || 0, half: true, K: 8 }, [0, h.fy ?? h.y, h.fz ?? h.z], { rot: [0, -90, 0], cell: 'leme' }));
  // nariz: spinner e hélice
  const n = o.nose;
  if (n.radial) P.push(L(null, n.cowl || cam, [[n.radial * 0.6, 0], [n.radial, 60], [n.radial * 1.02, n.len * 0.6], [n.radial * 0.92, n.len], [n.radial * 0.6, n.len]], [0, n.y - n.len, n.z], { seg: 24, cell: 'capo' }),
    C(null, 'preto', n.radial * 0.6, 20, [0, n.y - 12, n.z], { seg: 20, cell: 'motor' }));
  P.push(L('Hélice', n.spinMat || 'preto', [[0, n.spin * 2.4], [n.spin * 0.45, n.spin * 1.9], [n.spin * 0.85, n.spin * 1.1], [n.spin, 0], [0, 0]], [0, n.y, n.z], { seg: 18, cell: 'spinner' }));
  for (let i = 0; i < n.blades; i++) P.push(W('Hélice', 'preto', { span: n.prop, c0: n.chord, c1: n.chord * 0.6, t: 0.08, half: true, K: 5, N: 6 }, [0, n.y + n.spin * 0.6 + n.chord / 2, n.z], { rot: [18, i * 360 / n.blades, 0], ord: 'YXZ', cell: 'pa' }));
  if (n.tips !== false) for (let i = 0; i < n.blades; i++) { const a = i * 2 * Math.PI / n.blades; P.push(B('Hélice', 'amarelo', [70, 40, 140], [Math.cos(a) * (n.prop - 70), n.y + n.spin * 0.6, n.z - Math.sin(a) * (n.prop - 70)], { rot: [0, i * 360 / n.blades, 0], cell: 'ponta' })); }
  // trem de pouso
  const g = o.gear;
  [-1, 1].forEach(s => {
    const top = [s * g.x0, g.y, g.z0], bot = [s * g.x1, g.y + (g.dy || 0), g.z1];
    P.push(SG(null, 'acoGasto', top, bot, 40, { seg: 8, cell: 'perna' }));
    if (g.spat) P.push(LO(null, cam, [{ y: 380, w: 40, h: 60 }, { y: 120, w: 260, h: 540 }, { y: -250, w: 220, h: 420 }, { y: -500, w: 30, h: 60 }], [bot[0], bot[1], bot[2] - 50], { seg: 12, cell: 'carenagem' }));
    else P.push(B(null, cam, [12, 380, 520], [s * (g.x1 + 50), bot[1], (top[2] + bot[2]) / 2], { rot: [0, s * 6, 0], cell: 'tampa' }));
    P.push(...wheel(s * g.x1, bot[1], bot[2] - g.r * 0.2, g.r, g.w, { hub: 'acoGasto', seg: 18 }));
  });
  if (g.tail) P.push(SG(null, 'acoGasto', [0, g.tail[0], g.tail[1]], [0, g.tail[0] - 60, g.tail[1] - 160], 22, { seg: 6 }), ...wheel(0, g.tail[0] - 60, g.tail[1] - 170, 90, 60, { hub: 'acoGasto', seg: 12 }));
  // detalhes
  (o.extra || []).forEach(x => P.push(x));
  // insígnias: ['tipo', R, 'wing', x, u] na asa · ['tipo', R, 'side', y, z] nos dois lados da fuselagem · ou posição livre
  (o.ins || []).forEach(([k, R, a, b, c]) => {
    if (a === 'wing') { const [x, y, z, d] = wingTop(w, b, c); P.push(...place(insignia(k, R, 24), [x, y, z - 14], [0, x > 0 ? -90 - d : -90 + d, 0])); }
    else if (a === 'side') { const hw = fusHalf(F, b); [1, -1].forEach(s => P.push(...place(insignia(k, R, 16), [s * (hw - 8), b, c], [0, 0, s > 0 ? 0 : 180]))); }
    else P.push(...place(insignia(k, R), a, b));
  });
  return xform(P, TRS([0, 0, 0], [o.pitch || 0, 0, 0]));
}
// ponto na superfície de cima da asa (mesma fórmula do perfil em geo.js)
const nacaT = u => 5 * (0.2969 * Math.sqrt(u) - 0.126 * u - 0.3516 * u * u + 0.2843 * u ** 3 - 0.1015 * u ** 4);
function wingTop(w, x, u) {
  const a = Math.min(1, Math.abs(x) / w.span), chord = w.ell ? Math.max(w.c1 || w.c0 * 0.25, w.c0 * Math.sqrt(Math.max(0, 1 - a ** 2.2))) : w.c0 + (w.c1 - w.c0) * a;
  const le = -(w.sweep || 0) * a + (w.ell ? -(w.c0 - chord) * (w.lePos ?? 0.25) : 0), d = w.dih || 5;
  const zc = a * w.span * Math.tan(d * D2R), th = (w.t || 0.13) * chord;
  return [x, w.y + le - u * chord, w.z + zc + nacaT(u) * th * 1.15, d];
}
function fusHalf(F, y) {                             // meia-largura da fuselagem na estação y
  for (let i = 0; i < F.length - 1; i++) { const [y0, w0] = F[i], [y1, w1] = F[i + 1]; if (y <= y0 && y >= y1) return (w0 + (w1 - w0) * (y0 - y) / (y0 - y1)) / 2; }
  return F[0][1] / 2;
}
// giro da hélice em torno do eixo inclinado pelo "pitch" do avião parado
export function spinR(pitch, ang) {
  const m = new THREE.Matrix4().makeRotationX(pitch * D2R).multiply(new THREE.Matrix4().makeRotationY(ang * D2R)).multiply(new THREE.Matrix4().makeRotationX(-pitch * D2R));
  const e = new THREE.Euler().setFromRotationMatrix(m, 'XYZ'); return [e.x / D2R, e.y / D2R, e.z / D2R];
}
function biplane(o) {
  const P = [], m = o.skin, wd = o.wood || 'nogueira';
  P.push(LO(null, m, o.fus.map(([y, w, ht, hb, z = 0]) => ({ y, w, ht, hb, z, n: 3.2 })), [0, 0, 0], { seg: 16, cell: 'fuselagem' }));
  if (o.cowl) P.push(L(null, o.cowlMat || 'aluminio', [[o.cowl * 0.5, 0], [o.cowl, 80], [o.cowl, o.cowlLen], [o.cowl * 0.6, o.cowlLen + 30], [0, o.cowlLen + 30]], [0, o.noseY - o.cowlLen, o.noseZ], { seg: 22, cell: 'capo' }));
  o.wings.forEach(([z, span, chord, y, dih = 0], i) => P.push(W(null, o.wingMat || m, { span, c0: chord, c1: chord * 0.92, t: 0.07, dih }, [0, y, z], { cell: 'asa' + i })));
  // montantes e cabos
  const ws = o.wings, struts = o.struts || [ws[0][1] * 0.55];
  struts.forEach(x => [-1, 1].forEach(s => {
    for (let i = 0; i < ws.length - 1; i++) {
      const a = ws[i], b = ws[i + 1];
      P.push(SG(null, wd, [s * x, a[3] - a[2] * 0.2, a[0]], [s * x, b[3] - b[2] * 0.2, b[0]], 22, { seg: 6, cell: 'montante' }), SG(null, wd, [s * x, a[3] - a[2] * 0.75, a[0]], [s * x, b[3] - b[2] * 0.75, b[0]], 22, { seg: 6, cell: 'montante' }));
      P.push(SG(null, 'acoGasto', [s * x, a[3] - a[2] * 0.2, a[0]], [s * 250, b[3] - b[2] * 0.4, b[0]], 4, { seg: 4, cell: 'cabo' }), SG(null, 'acoGasto', [s * 250, a[3] - a[2] * 0.4, a[0]], [s * x, b[3] - b[2] * 0.75, b[0]], 4, { seg: 4, cell: 'cabo' }));
    }
  }));
  // cabane
  [-1, 1].forEach(s => P.push(SG(null, 'acoGasto', [s * 260, o.cab[0], o.cab[1]], [s * 240, ws[ws.length - 1][3] - 300, ws[ws.length - 1][0]], 16, { seg: 6, cell: 'cabane' })));
  P.push(W(null, m, { span: o.tail.span, c0: o.tail.c0, c1: o.tail.c0 * 0.7, t: 0.06, ell: true, K: 8 }, [0, o.tail.y, o.tail.z], { cell: 'profundor' }));
  P.push(W(null, m, { span: o.tail.fin, c0: o.tail.fc, c1: o.tail.fc * 0.6, t: 0.06, ell: true, half: true, K: 6 }, [0, o.tail.y + 60, o.tail.z], { rot: [0, -90, 0], cell: 'leme' }));
  // hélice de madeira
  P.push(C('Hélice', 'acoGasto', 70, 120, [0, o.noseY + 60, o.noseZ], { seg: 12 }));
  [0, 180].forEach(a => P.push(W('Hélice', wd, { span: o.prop, c0: 200, c1: 130, t: 0.12, half: true, K: 5, N: 6 }, [0, o.noseY + 140, o.noseZ], { rot: [20, a, 0], ord: 'YXZ', cell: 'pa' })));
  // trem
  [-1, 1].forEach(s => P.push(SG(null, 'acoGasto', [s * 250, o.noseY - 450, -380], [s * 600, o.noseY - 650, o.gearZ], 18, { seg: 6, cell: 'perna' }), SG(null, 'acoGasto', [s * 250, o.noseY - 1050, -380], [s * 600, o.noseY - 650, o.gearZ], 18, { seg: 6, cell: 'perna' })));
  P.push(SG(null, 'acoGasto', [-650, o.noseY - 650, o.gearZ], [650, o.noseY - 650, o.gearZ], 22, { seg: 6 }));
  P.push(...wheel(-680, o.noseY - 650, o.gearZ, 330, 90, { hub: 'linho', tire: 'borracha', rim: 0.86 }), ...wheel(680, o.noseY - 650, o.gearZ, 330, 90, { hub: 'linho', rim: 0.86 }));
  P.push(SG(null, 'nogueira', [0, o.tail.y + 200, o.tail.z - 100], [0, o.tail.y - 50, o.gearZ - 280], 20, { seg: 5 }));
  // metralhadoras gêmeas
  [-1, 1].forEach(s => P.push(C(null, 'acoPreto', 30, 800, [s * 120, o.noseY - 700, o.mgZ], { seg: 8, cell: 'mg' }), C(null, 'perfurado', 42, 500, [s * 120, o.noseY - 650, o.mgZ], { seg: 10, cell: 'mgcamisa' })));
  (o.ins || []).forEach(([k, R, t, r]) => P.push(...place(insignia(k, R, 14), t, r)));
  return xform(P, TRS([0, 0, 0], [o.pitch || 0, 0, 0]));
}

// ---------------------------------------------------------------- tanques
function tracks(o) {                                 // lagartas dos dois lados + rodas
  const P = [], L0 = o.len / 2, Rf = o.rf, Rr = o.rr, H = o.h;
  const side = [[L0 - Rf, 0], [L0, H * 0.5], [L0 - Rf * 0.4, H], [-L0 + Rr * 0.4, H], [-L0, H * 0.5], [-L0 + Rr, 0]];
  const prof = []; // contorno da lagarta (y, z)
  side.forEach(q => prof.push(q));
  [-1, 1].forEach(s => {
    P.push(E(null, 'acoOxidado', prof.map(([y, z]) => [y, z]), o.tw, [s * o.x, 0, 0], { bev: 12, cell: 'lagarta', holes: [prof.map(([y, z]) => [y * 0.93, z * 0.86 + H * 0.07])] }));
    o.wheels.forEach(([y, z, r, w]) => P.push(...wheel(s * (o.x + (w ? 0 : 0)), y, z, r, w || o.tw * 0.8, { tire: o.tire || 'borracha', hub: o.paint, rim: o.rim || 0.82, seg: 18 })));
    (o.rollers || []).forEach(([y, z, r]) => P.push(C(null, o.paint, r, o.tw * 0.5, [s * o.x, y, z], { axis: 'x', seg: 12, cell: 'rolete' })));
    P.push(C(null, o.paint, Rf * 0.75, o.tw * 0.9, [s * o.x, L0 - Rf * 0.9, H * 0.62], { axis: 'x', seg: 14, cell: 'motriz' }));
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; P.push(B(null, o.paint, [o.tw * 0.95, 60, 60], [s * o.x, L0 - Rf * 0.9 + Math.cos(a) * Rf * 0.78, H * 0.62 + Math.sin(a) * Rf * 0.78], { rot: [-i * 30, 0, 0], cell: 'dente' })); }
  });
  return P;
}
function tank(o) {
  const P = [], pa = o.paint;
  P.push(...tracks({ ...o.tr, paint: pa }));
  P.push(E(null, pa, o.hull, o.hullW, [0, 0, 0], { bev: 25, cell: 'casco' }));
  if (o.sponson) P.push(E(null, pa, o.sponson, o.sponW, [0, 0, 0], { bev: 15, cell: 'paralama' }));
  // torre
  const tz = o.turret.z, ty = o.turret.y;
  if (o.turret.lathe) P.push(L('Torre', pa, o.turret.lathe, [0, ty, tz], { axis: 'z', seg: o.turret.seg || 20, sc: o.turret.sc || [1, 1, 1], cell: 'torre' }));
  if (o.turret.ext) P.push(E('Torre', pa, o.turret.ext, o.turret.w, [0, ty, tz], { bev: 30, cell: 'torre', holes: o.turret.holes }));
  if (o.turret.loft) P.push(LO('Torre', pa, o.turret.loft, [0, ty, tz], { seg: 20, cell: 'torre' }));
  const gz = tz + o.gun.z, gy = ty + o.gun.y;
  P.push(B('Torre', pa, o.gun.mantlet, [0, gy, gz], { bev: 20, cell: 'mantelete' }));
  P.push(C('Torre', pa, o.gun.r, o.gun.len, [0, gy + o.gun.len / 2, gz], { seg: 14, r2: o.gun.r * 0.92, cell: 'canhao' }));
  if (o.gun.brake) P.push(L('Torre', pa, [[0, 0], [o.gun.r * 1.6, 0], [o.gun.r * 1.7, 30], [o.gun.r * 1.7, o.gun.brake - 30], [o.gun.r * 1.6, o.gun.brake], [0, o.gun.brake]], [0, gy + o.gun.len, gz], { seg: 14, cell: 'freio' }));
  P.push(C('Torre', 'acoPreto', o.gun.r * 0.7, 20, [0, gy + o.gun.len + (o.gun.brake || 0) + 2, gz], { seg: 12, cell: 'boca' }));
  // escotilhas, cúpula, mg, ferramentas
  (o.hatches || []).forEach(([x, y, z, r, g]) => P.push(C(g || null, pa, r, 40, [x, y, z], { axis: 'z', seg: 16, cell: 'escotilha' }), C(g || null, pa, r * 0.3, 30, [x + r * 0.5, y, z + 30], { axis: 'z', seg: 8, cell: 'trava' })));
  (o.extra || []).forEach(x => P.push(x));
  (o.ins || []).forEach(([k, R, t, r, g]) => P.push(...place(insignia(k, R), t, r).map(p => g ? { ...p, g } : p)));
  return P;
}

// ---------------------------------------------------------------- catálogo
export const PROP_CATS = { item: 'Itens do jogo (substituem os do AC)', fort: 'Fortificações', veic: 'Veículos e tanques', aviao: 'Aviões', naval: 'Barcos do Dia D (Omaha)', art: 'Artilharia e armas pesadas', obj: 'Objetos e suprimentos', cen: 'Cenário e construções', sold: 'Soldados caídos' };
const soldierVars = (pose, uni) => ({ pose: { n: 'Pose', o: POSE_OPTS, v: pose }, uni: { n: 'Uniforme', o: UNIFORM_OPTS, v: uni } });

const ESC = { n: 'Tamanho no jogo', o: [['1', 'Real'], ['1.5', '1,5×'], ['2', '2×'], ['3', '3×']], v: '1.5' };
export const PROPS = [

  // ================================================== ITENS DO JOGO (pickups do AC: munição, vida, colete, granadas, akimbo)
  { id: 'item_ammobox', cat: 'item', pickup: 'ammobox', war: 2, n: 'Munição → caixote de madeira', d: 'Substitui a caixa de munição do AC por um caixote de munição de madeira com alças e chapa de identificação.', mm: '', vars: { esc: ESC },
    build: v => ({ parts: xform([...crate(0, 0, 0, 300, 460, 240, 'caixaVerde'), B(null, 'amarelo', [4, 200, 60], [152, 0, 150], { cell: 'plaqueta' }), B(null, 'preto', [4, 160, 14], [154, 0, 150], { cell: 'texto' }), SG(null, 'couroMarrom', [-150, -120, 244], [150, -120, 244], 8, { seg: 6, cell: 'cinta' }), SG(null, 'couroMarrom', [-150, 120, 244], [150, 120, 244], 8, { seg: 6, cell: 'cinta' })], TRS([0, 0, 0], [0, 0, 0], +v.esc)) }) },
  { id: 'item_pistolclips', cat: 'item', pickup: 'pistolclips', war: 2, n: 'Pentes de pistola', d: 'Três carregadores de pistola com projéteis à mostra, sobre um pano.', mm: '', vars: { esc: ESC },
    build: v => { const mag = (x, y, z, r) => xform([B(null, 'acoPreto', [24, 34, 130], [0, 0, 65], { cell: 'pente' }), B(null, 'nogueira', [28, 38, 14], [0, 0, 6], { cell: 'base' }), L(null, 'latao', [[0, 0], [8, 0], [8, 10], [5, 18], [0, 20]], [0, 4, 130], { axis: 'z', seg: 10, cell: 'bala' })], TRS([x, y, z], r));
      return { parts: xform([B(null, 'lonaVerde', [260, 220, 6], [0, 0, 3], { cell: 'pano' }), ...mag(-60, 0, 6, [0, 0, 10]), ...mag(20, -20, 24, [0, 90, 80]), ...mag(70, 60, 22, [-90, 0, 30])], TRS([0, 0, 0], [0, 0, 0], +v.esc)) }; } },
  { id: 'item_nade', cat: 'item', pickup: 'nade', war: 2, n: 'Granadas', d: 'Uma Stielhandgranate deitada e uma Mk 2 "abacaxi" em pé.', mm: '', vars: { esc: ESC },
    build: v => ({ parts: xform([...xform([C(null, 'faia', 15, 280, [0, 0, 0], { seg: 14, cell: 'cabo' }), C(null, 'feldgrau', 34, 76, [0, 175, 0], { seg: 18, cell: 'cabeca' }), C(null, 'acoGasto', 16, 12, [0, -146, 0], { seg: 12, cell: 'tampa' })], TRS([-60, 0, 34], [0, 0, 20])),
      L(null, 'abacaxi', [[0, 0], [22, 2], [30, 14], [31, 50], [28, 74], [16, 86], [0, 88]], [70, 40, 0], { axis: 'z', seg: 16, cell: 'mk2' }), C(null, 'acoGasto', 10, 24, [70, 40, 96], { axis: 'z', seg: 10, cell: 'espoleta' }),
      E(null, 'acoGasto', [[0, 0], [10, 0], [6, -60], [0, -64]], 12, [70, 52, 104], { rot: [0, 0, 0], cell: 'alavanca' }), T(null, 'acoGasto', 12, 2, [56, 40, 104], { rot: [0, 90, 0], seg: [4, 12], cell: 'argola' })], TRS([0, 0, 0], [0, 0, 0], +v.esc)) }) },
  { id: 'item_health', cat: 'item', pickup: 'health', war: 2, n: 'Kit médico → bolsa de enfermeiro', d: 'Bolsa de lona do padioleiro com a cruz vermelha em círculo branco e alça.', mm: '', vars: { esc: ESC },
    build: v => ({ parts: xform([B(null, 'lona', [340, 140, 240], [0, 0, 120], { bev: 18, cell: 'bolsa' }), B(null, 'lona', [348, 150, 90], [0, 0, 210], { bev: 12, rot: [-8, 0, 0], cell: 'aba' }),
      ...[-1, 1].flatMap(s2 => [C(null, 'branco', 70, 4, [0, s2 * 72, 120], { axis: 'y', seg: 24, cell: 'disco' }), B(null, 'vermelho', [90, 4, 26], [0, s2 * 75, 120], { cell: 'cruz' }), B(null, 'vermelho', [26, 4, 90], [0, s2 * 75, 120], { cell: 'cruz' })]),
      TU(null, 'lona', [[-170, 0, 220], [-150, 0, 380], [0, 0, 440], [150, 0, 380], [170, 0, 220]], 12, { rs: 6, cell: 'alca' }), B(null, 'latao', [30, 10, 24], [0, 76, 170], { cell: 'fivela' })], TRS([0, 0, 0], [0, 0, 0], +v.esc)) }) },
  { id: 'item_helmet', cat: 'item', pickup: 'helmet', war: 2, soft: false, n: 'Capacete (proteção)', d: 'Capacete M1 com rede de camuflagem e jugular — substitui o capacete do AC.', mm: '', vars: { esc: ESC, mod: { n: 'Modelo', o: [['m1', 'M1 (EUA)'], ['stahl', 'Stahlhelm'], ['brodie', 'Brodie'], ['ssh40', 'SSh-40']], v: 'm1' } },
    build: v => ({ parts: xform([...helmet(v.mod, v.mod === 'stahl' ? 'feldgrau' : v.mod === 'ssh40' ? 'verdeSov' : 'oliva'), T(null, 'couroMarrom', 120, 6, [0, 20, -40], { rot: [0, 90, 0], arc: 180, seg: [4, 14], sc: [1, 1, 0.6], cell: 'jugular' })], TRS([0, 0, 50], [0, 0, 0], +v.esc)) }) },
  { id: 'item_kevlar', cat: 'item', pickup: 'kevlar', war: 2, n: 'Colete → colete antiestilhaço', d: 'Colete de lona com placas costuradas, estilo M1 flak vest.', mm: '', vars: { esc: ESC },
    build: v => ({ parts: xform([LO(null, 'lonaVerde', [{ y: 0, w: 380, ht: 120, hb: 110 }, { y: 260, w: 420, ht: 130, hb: 120 }, { y: 440, w: 440, ht: 120, hb: 110 }, { y: 520, w: 300, ht: 80, hb: 80 }], [0, 0, 0], { rot: [90, 0, 0], seg: 16, cell: 'colete' }),
      ...[-1, 1].map(s2 => B(null, 'couroMarrom', [60, 250, 24], [s2 * 110, 0, 498], { bev: 6, cell: 'alca' })), B(null, 'couroMarrom', [400, 260, 30], [0, 0, 20], { bev: 8, cell: 'cinto' })], TRS([0, 0, 0], [0, 0, 0], +v.esc)) }) },
  { id: 'item_akimbo', cat: 'item', pickup: 'akimbo', war: 2, soft: false, n: 'Akimbo → par de pistolas', d: 'Duas Colt 1911 cruzadas no chão (pega o modelo de alta fidelidade do arsenal).', mm: '', vars: { esc: ESC },
    build: v => { const pist = HD.colt1911().parts.map(p => ({ ...p, g: null }));
      return { parts: xform([...xform(pist, TRS([-40, 0, 14], [0, 90, 20])), ...xform(pist, TRS([40, 30, 42], [0, -90, 160]))], TRS([0, 0, 0], [0, 0, 0], +v.esc)) }; } },
  // ================================================== FORTIFICAÇÕES
  { id: 'sacos_muro', cat: 'fort', war: 0, n: 'Muro de sacos de areia', d: 'Três fiadas de sacos desencontrados, 1,6 m de largura.', mm: '3 3 0 0', vars: { cor: { n: 'Saco', o: [['sacoAreia', 'Juta'], ['sacoAreiaV', 'Verde']], v: 'sacoAreia' } },
    build: v => ({ parts: [0, 1, 2, 3].flatMap(r => Array.from({ length: r % 2 ? 2 : 3 }, (_, i) => sandbag((i - (r % 2 ? 0.5 : 1)) * 560 + (r % 2) * 0, rnd(r * 9 + i) * 40 - 20, 70 + r * 130, 90, v.cor))) }) },
  { id: 'sacos_ninho', cat: 'fort', war: 0, n: 'Ninho circular de sacos', d: 'Semicírculo de sacos de areia para metralhadora ou morteiro, 2,8 m.', mm: '6 3 0 0', vars: { cor: { n: 'Saco', o: [['sacoAreia', 'Juta'], ['sacoAreiaV', 'Verde']], v: 'sacoAreia' } },
    build: v => ({ parts: [0, 1, 2, 3].flatMap(r => Array.from({ length: 9 }, (_, i) => { const a = (-100 + (i + (r % 2) * 0.5) * 25) * D2R, R0 = 1400; return sandbag(Math.cos(a) * R0, Math.sin(a) * R0, 70 + r * 130, a / D2R, v.cor); })) }) },
  { id: 'sacos_pilha', cat: 'fort', war: 0, n: 'Pilha de sacos', d: 'Sacos jogados em pilha, para cobertura baixa.', mm: '2 2 0 0',
    build: () => ({ parts: [sandbag(-280, 0, 70, 80), sandbag(280, 30, 70, 100), sandbag(0, 300, 70, 10), sandbag(0, 40, 200, 85), sandbag(60, 380, 190, 20, 'sacoAreiaV')] }) },
  { id: 'arame_sanfona', cat: 'fort', war: 0, n: 'Arame farpado em sanfona', d: 'Concertina de 3 m entre estacas de ferro em saca-rolhas.', mm: '0 3 0 0',
    build: () => ({ parts: [TU(null, 'acoOxidado', helix(420, 3000, 22, 400, { jit: 40, z: 430 }).map(([x, y, z]) => [y, x + Math.sin(y * 0.004) * 60, z]), 5, { rs: 3, n: 640, cell: 'arame' }),
      TU(null, 'acoOxidado', helix(400, 3000, 22, 400, { jit: 30, z: 430 }).map(([x, y, z]) => [y + 60, x - 30, z * 0.98]), 5, { rs: 3, n: 640, cell: 'arame' }),
      ...[-1500, 0, 1500].flatMap(x => [SG(null, 'ferrugem', [x, 0, -100], [x, 0, 900], 16, { seg: 6, cell: 'estaca' }), TU(null, 'ferrugem', helix(40, 300, 3, 30).map(([a, b, c]) => [x + a, c, b + 200]), 8, { rs: 4, cell: 'saca' })]),
      ...helix(420, 3000, 22, 400, { z: 430 }).filter((_, i) => i % 5 === 2).map(([x, y, z], i) => B(null, 'acoOxidado', [6, 6, 60], [y, x, z], { rot: [i * 37, i * 53, 0], cell: 'farpa' }))] }) },
  { id: 'cavalo_frisa', cat: 'fort', war: 1, n: 'Cavalo de frisa', d: 'Viga de madeira com estacas cruzadas e arame — barreira móvel da Grande Guerra.', mm: '2 3 0 0',
    build: () => { const P = [C(null, 'tabuasCinza', 70, 2600, [0, 0, 620], { axis: 'x', seg: 10, cell: 'viga' })];
      [-1100, -400, 400, 1100].forEach((x, i) => { P.push(SG(null, 'tabuasCinza', [x, -700, 0], [x, 700, 1240], 45, { seg: 7, cell: 'estaca' }), SG(null, 'tabuasCinza', [x, 700, 0], [x, -700, 1240], 45, { seg: 7, cell: 'estaca' })); });
      for (let k = 0; k < 4; k++) { const z = 250 + k * 250, s = k % 2 ? 1 : -1; P.push(TU(null, 'acoOxidado', [[-1300, s * (560 - k * 90), z], [-400, s * (560 - k * 90) * 0.98, z + 20], [400, s * (560 - k * 90), z - 10], [1300, s * (560 - k * 90) * 0.97, z]], 5, { rs: 4, cell: 'arame' })); }
      return { parts: P }; } },
  { id: 'ourico', cat: 'fort', war: 2, n: 'Ouriço tcheco', d: 'Três cantoneiras de aço cruzadas contra tanques (Normandia, 1944).', mm: '1 3 0 0',
    build: () => { const L0 = 1900, q = new THREE.Quaternion().setFromUnitVectors(V3(1, 1, 1).normalize(), V3(0, 0, 1)); const M = new THREE.Matrix4().makeRotationFromQuaternion(q).premultiply(new THREE.Matrix4().makeTranslation(0, 0, L0 / (2 * Math.sqrt(3)))).multiply(new THREE.Matrix4().makeRotationZ(0.3));
      const beam = r => [B(null, 'ferrugem', [L0, 100, 10], [0, 45, 0], { rot: r, cell: 'cantoneira' }), B(null, 'ferrugem', [L0, 10, 100], [0, 0, 45], { rot: r, cell: 'cantoneira' })];
      return { parts: xform([...beam([0, 0, 0]), ...beam([0, 0, 90]).map(p => ({ ...p, rot: [0, 0, 90] })), ...[B(null, 'ferrugem', [L0, 100, 10], [0, 0, 0], { rot: [0, 90, 0], cell: 'cantoneira' }), B(null, 'ferrugem', [L0, 10, 100], [0, 0, 0], { rot: [0, 90, 0], cell: 'cantoneira' })], B(null, 'acoOxidado', [200, 200, 200], [0, 0, 0], { cell: 'chapa' })], M) }; } },
  { id: 'dentes_dragao', cat: 'fort', war: 2, n: 'Dentes de dragão', d: 'Pirâmides de concreto da Linha Siegfried, em fila.', mm: '4 3 0 0',
    build: () => ({ parts: [-1, 0, 1].flatMap(i => [L(null, 'concreto', [[0, 0], [620, 0], [600, 40], [150, 980], [120, 1000], [0, 1000]], [i * 1500, rnd(i + 3) * 200, 0], { axis: 'z', seg: 4, rot: [0, 0, 45 + i * 4], cell: 'dente' })]).concat([B(null, 'concreto', [4400, 1200, 160], [0, 100, -60], { cell: 'base' })]) }) },
  { id: 'trincheira_parede', cat: 'fort', war: 1, n: 'Parede de trincheira', d: 'Revestimento de tábuas e estacas, com sacos no parapeito — 2,4 m.', mm: '1 6 0 0',
    build: () => { const P = []; for (let i = 0; i < 7; i++) P.push(B(null, 'tabuas', [2400, 40, 240], [0, 0, 130 + i * 255], { bev: 4, rot: [rnd(i) * 3 - 1.5, 0, 0], cell: 'tabua' }));
      [-1100, 0, 1100].forEach(x => P.push(SG(null, 'tabuasCinza', [x, 60, -100], [x, 40, 1950], 60, { seg: 7, cell: 'estaca' })));
      for (let i = 0; i < 4; i++) P.push(sandbag(-900 + i * 600, -120, 1900, 90), sandbag(-600 + i * 600, -100, 2030, 90));
      P.push(...Array.from({ length: 6 }, (_, i) => B(null, 'tabuasCinza', [180, 1100, 40], [-1050 + i * 420, 600, -40], { cell: 'estrado' })), B(null, 'tabuasCinza', [2400, 90, 60], [0, 300, -10], { cell: 'trave' }), B(null, 'tabuasCinza', [2400, 90, 60], [0, 900, -10], { cell: 'trave' }));
      return { parts: P }; } },
  { id: 'estrado', cat: 'fort', war: 1, n: 'Estrado de trincheira', d: 'Passarela de ripas sobre a lama (duckboard).', mm: '1 1 0 0',
    build: () => ({ parts: [...Array.from({ length: 12 }, (_, i) => B(null, 'tabuasCinza', [680, 110, 32], [0, -1000 + i * 182, 80], { bev: 4, rot: [0, rnd(i) * 4 - 2, rnd(i * 3) * 4 - 2], cell: 'ripa' })), B(null, 'tabuasCinza', [80, 2200, 90], [-260, 0, 20], { cell: 'trave' }), B(null, 'tabuasCinza', [80, 2200, 90], [260, 0, 20], { cell: 'trave' })] }) },
  { id: 'casamata', cat: 'fort', war: 2, n: 'Casamata de concreto', d: 'Pillbox hexagonal com seteiras e teto grosso — 3,6 m.', mm: '8 8 0 0',
    build: () => { const P = [L(null, 'concreto', [[0, 0], [1900, 0], [1880, 1900], [1700, 2000], [0, 2000]], [0, 0, 0], { axis: 'z', seg: 6, cell: 'parede' }), L(null, 'concreto', [[0, 0], [2150, 0], [2150, 300], [1950, 420], [0, 420]], [0, 0, 1950], { axis: 'z', seg: 6, cell: 'teto' })];
      for (let i = 0; i < 6; i++) { const a = (i * 60 + 30) * D2R; if (i === 3) continue; P.push(B(null, 'preto', [700, 60, 140], [Math.cos(a) * 1640, Math.sin(a) * 1640, 1380], { rot: [0, 0, i * 60 + 30 + 90], cell: 'seteira' })); }
      P.push(B(null, 'tabuasCinza', [900, 60, 1700], [0, -1660, 850], { cell: 'porta' }));
      for (let i = 0; i < 10; i++) P.push(sandbag(-1600 + i * 360, 1900, 70, 0), sandbag(-1450 + i * 330, 1850, 200, 0));
      return { parts: P }; } },
  { id: 'torre_vigia', cat: 'fort', war: 0, n: 'Torre de vigia', d: 'Torre de madeira de 6 m com plataforma, guarda-corpo, telhado e escada.', mm: '3 20 0 0',
    build: () => { const P = [], H = 5200, b = 1300, t = 900;
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([x, y]) => P.push(SG(null, 'tabuasCinza', [x * b, y * b, 0], [x * t, y * t, H + 1300], 80, { seg: 6, cell: 'pilar' })));
      for (let k = 0; k < 3; k++) { const z0 = k * 1700 + 200, z1 = z0 + 1500, s0 = b - (b - t) * z0 / (H + 1300), s1 = b - (b - t) * z1 / (H + 1300);
        [[0, 1], [1, 0], [0, -1], [-1, 0]].forEach(([x, y]) => { const px = y, py = -x; P.push(SG(null, 'tabuasCinza', [x * s0 + px * s0, y * s0 + py * s0, z0], [x * s1 - px * s1, y * s1 - py * s1, z1], 40, { seg: 5, cell: 'travessa' })); }); }
      P.push(B(null, 'tabuas', [2400, 2400, 80], [0, 0, H], { cell: 'piso' }));
      [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([x, y]) => { P.push(B(null, 'tabuas', x ? [60, 2300, 600] : [2300, 60, 600], [x * 1150, y * 1150, H + 450], { cell: 'guarda' })); });
      P.push(L(null, 'tabuasCinza', [[0, 900], [1700, 0], [1600, -20], [0, 880]], [0, 0, H + 1350], { axis: 'z', seg: 4, rot: [0, 0, 45], cell: 'telhado' }));
      P.push(SG(null, 'tabuasCinza', [-300, -2100, 0], [-300, -1150, H], 40, { seg: 5, cell: 'escada' }), SG(null, 'tabuasCinza', [300, -2100, 0], [300, -1150, H], 40, { seg: 5, cell: 'escada' }));
      for (let i = 1; i < 16; i++) { const f = i / 16; P.push(SG(null, 'tabuasCinza', [-300, -2100 + 950 * f, H * f], [300, -2100 + 950 * f, H * f], 22, { seg: 5, cell: 'degrau' })); }
      P.push(C('Holofote', 'cinzaPanzer', 240, 300, [800, 800, H + 1000], { rot: [20, 0, 0], seg: 18, cell: 'holofote' }), C('Holofote', 'amarelo', 220, 10, [800, 800 + 150, H + 1055], { rot: [20, 0, 0], seg: 18, cell: 'lente' }));
      return { parts: P }; },
    anim: { n: 24, fps: 10, groups: { Holofote: f => ({ r: [0, 0, Math.sin(f / 24 * Math.PI * 2) * 40] }) } } },

  // ================================================== VEÍCULOS
  { id: 'willys', cat: 'veic', war: 2, n: 'Jeep Willys MB', d: 'O jeep americano: capô com estrela, para-brisa rebatível, estepe e galão.', mm: '4 4 0 0',
    build: () => { const P = [], o = 'oliva';
      P.push(E(null, o, [[1600, 520], [1600, 860], [700, 880], [650, 930], [-1500, 930], [-1650, 880], [-1650, 520], [-1200, 520], [-1150, 600], [-600, 600], [-500, 520], [700, 520], [800, 600], [1300, 600], [1350, 520]], 1240, [0, 0, 0], { bev: 25, cell: 'carroceria' }));
      P.push(B(null, o, [1400, 900, 40], [0, 1150, 890], { bev: 10, cell: 'capo' }));
      P.push(...place(insignia('starW', 300, 8), [0, 1150, 910], [0, -90, 0]));
      [-1, 1].forEach(s => { P.push(E(null, o, [[1650, 560], [1580, 760], [1250, 820], [900, 760], [820, 560]], 260, [s * 620, 0, 0], { bev: 10, cell: 'paralama' }), E(null, o, [[-700, 560], [-780, 760], [-1100, 820], [-1430, 760], [-1500, 560]], 220, [s * 620, 0, 0], { bev: 10, cell: 'paralama' })); });
      P.push(B(null, 'acoPreto', [1150, 60, 400], [0, 1620, 720], { bev: 10, cell: 'grade' }));
      for (let i = 0; i < 9; i++) P.push(B(null, o, [40, 70, 340], [-440 + i * 110, 1650, 720], { cell: 'fenda' }));
      [-1, 1].forEach(s => P.push(C(null, 'vidro', 70, 30, [s * 400, 1660, 800], { axis: 'y', seg: 12, cell: 'farol' })));
      P.push(B(null, o, [1240, 40, 480], [0, 620, 1180], { rot: [-8, 0, 0], cell: 'parabrisa' }), B(null, 'vidro', [1100, 20, 380], [0, 630, 1185], { rot: [-8, 0, 0], cell: 'vidro' }));
      P.push(T(null, 'acoPreto', 200, 18, [-300, 300, 1150], { rot: [60, 0, 0], seg: [5, 16], cell: 'volante' }), SG(null, 'acoPreto', [-300, 300, 1150], [-300, 600, 850], 20, { seg: 6 }));
      [[-300, -100], [300, -100], [0, -900]].forEach(([x, y], i) => P.push(B(null, 'lonaVerde', [i === 2 ? 1100 : 480, 480, 100], [x, y, 960], { bev: 30, cell: 'assento' }), B(null, 'lonaVerde', [i === 2 ? 1100 : 480, 100, 420], [x, y - 230, 1180], { bev: 30, cell: 'encosto' })));
      [[1050, 330], [-1050, 330]].forEach(([y, z]) => [-1, 1].forEach(s => P.push(...wheel(s * 610, y, z, 360, 230, { hub: o, rim: 0.55 }))));
      P.push(...wheel(0, -1720, 720, 360, 230, { hub: o, rim: 0.55 }).map(p => ({ ...p, axis: undefined })));
      P.push(B(null, o, [180, 340, 460], [700, -1600, 780], { bev: 20, cell: 'galao' }));
      P.push(B(null, 'acoPreto', [1300, 120, 120], [0, 1700, 450], { cell: 'parachoque' }));
      return { parts: P }; } },
  { id: 'kubelwagen', cat: 'veic', war: 2, n: 'Kübelwagen Typ 82', d: 'O utilitário alemão: carroceria de chapa nervurada, estepe no capô.', mm: '4 4 0 0', vars: { cor: { n: 'Pintura', o: [['dunkelgelb', 'Dunkelgelb'], ['cinzaPanzer', 'Cinza Panzer'], ['hinterhalt', 'Camuflado'], ['inverno', 'Inverno']], v: 'dunkelgelb' } },
    build: v => { const P = [], o = v.cor;
      P.push(LO(null, o, [{ y: -1850, w: 1300, ht: 380, hb: 300, z: 760, n: 6 }, { y: -900, w: 1500, ht: 420, hb: 320, z: 760, n: 8 }, { y: 600, w: 1500, ht: 420, hb: 320, z: 760, n: 8 }, { y: 1500, w: 1400, ht: 180, hb: 300, z: 720, n: 6 }, { y: 1850, w: 1100, ht: 60, hb: 260, z: 640, n: 5 }], [0, 0, 0], { seg: 24, cell: 'carroceria' }));
      for (let i = 0; i < 5; i++) [-1, 1].forEach(s => P.push(B(null, o, [20, 2400, 30], [s * 760, -400, 640 + i * 70], { cell: 'nervura' })));
      P.push(B(null, o, [1450, 30, 420], [0, 520, 1350], { rot: [-12, 0, 0], cell: 'parabrisa' }), B(null, 'vidro', [1300, 20, 330], [0, 530, 1350], { rot: [-12, 0, 0], cell: 'vidro' }));
      P.push(...wheel(0, 1500, 900, 340, 200, { hub: o, rim: 0.5 }).map(p => ({ ...p, axis: 'z', rot: [0, 0, 0] })));
      [[1200, 340], [-1150, 340]].forEach(([y, z]) => [-1, 1].forEach(s => P.push(...wheel(s * 660, y, z, 340, 210, { hub: o, rim: 0.5 }))));
      [-1, 1].forEach(s => P.push(C(null, 'vidro', 80, 40, [s * 520, 1600, 1000], { axis: 'y', seg: 12, cell: 'farol' })));
      [[-350, -100], [350, -100], [0, -1050]].forEach(([x, y], i) => P.push(B(null, 'couroMarrom', [i === 2 ? 1150 : 500, 480, 100], [x, y, 900], { bev: 30, cell: 'assento' })));
      P.push(T(null, 'preto', 190, 16, [-350, 280, 1150], { rot: [60, 0, 0], seg: [5, 16], cell: 'volante' }));
      P.push(...place(insignia('balken', 150), [762, -1200, 950], [0, 0, 0]), ...place(insignia('balken', 150), [-762, -1200, 950], [0, 0, 180]));
      return { parts: P }; } },
  { id: 'moto_sidecar', cat: 'veic', war: 2, n: 'Moto BMW R75 com sidecar', d: 'Motocicleta alemã com carro lateral e MG34 montada.', mm: '3 3 0 0', vars: { cor: { n: 'Pintura', o: [['feldgrau', 'Feldgrau'], ['dunkelgelb', 'Dunkelgelb'], ['cinzaPanzer', 'Cinza Panzer']], v: 'feldgrau' } },
    build: v => { const P = [], o = v.cor;
      P.push(...wheel(0, 900, 330, 330, 110, { hub: o, rim: 0.7 }), ...wheel(0, -560, 330, 330, 110, { hub: o, rim: 0.7 }), ...wheel(1100, -150, 330, 330, 110, { hub: o, rim: 0.7 }));
      P.push(SG(null, o, [0, 820, 380], [0, 600, 1000], 30), SG(null, o, [0, -560, 330], [0, 200, 520], 40), SG(null, o, [0, 200, 520], [0, 600, 1000], 40));
      P.push(LO(null, o, [{ y: 100, w: 200, h: 150, z: 980 }, { y: 400, w: 320, h: 260, z: 1000 }, { y: 650, w: 200, h: 180, z: 1020 }], [0, 0, 0], { seg: 12, cell: 'tanque' }));
      P.push(B(null, 'acoGasto', [600, 300, 280], [0, 220, 600], { bev: 30, cell: 'motor' }), C(null, 'acoGasto', 90, 260, [-370, 260, 560], { axis: 'x', seg: 12, cell: 'cilindro' }), C(null, 'acoGasto', 90, 260, [370, 260, 560], { axis: 'x', seg: 12, cell: 'cilindro' }));
      P.push(B(null, 'couroPreto', [240, 380, 90], [0, -150, 1000], { bev: 30, cell: 'banco' }), B(null, 'couroPreto', [240, 300, 80], [0, -520, 900], { bev: 30, cell: 'banco' }));
      P.push(SG(null, 'acoPreto', [-380, 680, 1220], [380, 680, 1220], 16), SG(null, 'acoPreto', [0, 700, 1000], [0, 680, 1220], 22));
      P.push(C(null, 'vidro', 95, 70, [0, 800, 1120], { axis: 'y', seg: 14, cell: 'farol' }));
      P.push(E(null, o, [[1100, 560], [1000, 760], [700, 820], [500, 760]], 160, [0, 0, 0], { rot: [0, 0, 0], cell: 'paralama' }));
      P.push(LO(null, o, [{ y: 900, w: 120, ht: 120, hb: 120, z: 700 }, { y: 600, w: 700, ht: 330, hb: 280, z: 720 }, { y: -400, w: 760, ht: 380, hb: 300, z: 740 }, { y: -900, w: 520, ht: 260, hb: 260, z: 760 }], [1100, 0, 0], { seg: 18, cell: 'sidecar' }));
      P.push(B(null, 'couroPreto', [500, 450, 100], [1100, -350, 1080], { bev: 40, cell: 'assento' }));
      P.push(C(null, 'acoPreto', 22, 700, [1100, 600, 1250], { seg: 8, cell: 'mg' }), B(null, 'acoPreto', [70, 320, 120], [1100, 150, 1250], { bev: 10, cell: 'mgcorpo' }), C(null, 'perfurado', 34, 300, [1100, 450, 1250], { seg: 10, cell: 'mgcamisa' }));
      return { parts: P }; } },
  { id: 'opel_blitz', cat: 'veic', war: 2, n: 'Caminhão Opel Blitz', d: 'Caminhão de 3 t com carroceria de madeira e lona arqueada.', mm: '6 8 0 0', vars: { cor: { n: 'Pintura', o: [['cinzaPanzer', 'Cinza Panzer'], ['dunkelgelb', 'Dunkelgelb'], ['feldgrau', 'Feldgrau']], v: 'cinzaPanzer' } },
    build: v => { const P = [], o = v.cor;
      P.push(B(null, 'acoPreto', [900, 6000, 200], [0, 0, 800], { cell: 'chassi' }));
      P.push(LO(null, o, [{ y: 1500, w: 1900, ht: 900, hb: 600, z: 1500, n: 5 }, { y: 2400, w: 1900, ht: 900, hb: 600, z: 1500, n: 5 }], [0, 0, 0], { seg: 20, cell: 'cabine' }));
      P.push(LO(null, o, [{ y: 2400, w: 1100, ht: 450, hb: 450, z: 1300, n: 4 }, { y: 3300, w: 1050, ht: 400, hb: 450, z: 1250, n: 4 }], [0, 0, 0], { seg: 16, cell: 'capo' }));
      P.push(B(null, 'vidro', [1600, 20, 500], [0, 2410, 2050], { rot: [-6, 0, 0], cell: 'vidro' }), B(null, 'acoPreto', [900, 40, 700], [0, 3320, 1250], { cell: 'grade' }));
      [-1, 1].forEach(s => { P.push(E(null, o, [[3500, 900], [3300, 1200], [2700, 1250], [2300, 1150], [2300, 900]], 380, [s * 950, 0, 0], { bev: 15, cell: 'paralama' }), C(null, 'vidro', 110, 70, [s * 800, 3250, 1550], { axis: 'y', seg: 12, cell: 'farol' })); });
      P.push(B(null, 'tabuas', [2200, 3800, 80], [0, -900, 1250], { cell: 'piso' }));
      [[1100, 0], [-1100, 0]].forEach(([x]) => P.push(B(null, 'tabuas', [60, 3800, 500], [x, -900, 1520], { cell: 'lateral' })));
      P.push(B(null, 'tabuas', [2200, 60, 500], [0, -2800, 1520], { cell: 'traseira' }));
      P.push(LO(null, 'lona', [{ y: -2800, w: 2250, ht: 700, hb: 10, z: 1800, n: 2 }, { y: 1000, w: 2250, ht: 700, hb: 10, z: 1800, n: 2 }], [0, 0, 0], { seg: 18, capA: true, cell: 'lona' }));
      for (let i = 0; i < 4; i++) P.push(T(null, 'lona', 1110, 20, [0, -2700 + i * 1200, 1800], { rot: [90, 0, 0], arc: 180, seg: [4, 14], sc: [1, 1, 0.64], cell: 'arco' }));
      [[2900, 520], [-1600, 520], [-2500, 520]].forEach(([y, z], i) => [-1, 1].forEach(s => P.push(...wheel(s * (i ? 820 : 900), y, z, 520, 260, { hub: o, rim: 0.55 }))));
      P.push(...place(insignia('balken', 220), [1103, -900, 1520], [0, 0, 0]), ...place(insignia('balken', 220), [-1103, -900, 1520], [0, 0, 180]));
      return { parts: P }; } },
  { id: 'sherman', cat: 'veic', war: 2, n: 'Tanque M4 Sherman', d: 'Casco fundido com glacis inclinado, suspensão VVSS, canhão de 75 mm e .50 na torre.', mm: '12 9 0 0',
    build: () => { const pa = 'oliva';
      const wh = []; [-1650, -620, 620].forEach(y => { wh.push([y - 260, 300, 255, 0], [y + 260, 300, 255, 0]); });
      return { parts: tank({ paint: pa,
        tr: { len: 5900, h: 1150, rf: 420, rr: 360, tw: 420, x: 1170, wheels: wh, rollers: [[-1650, 900, 90], [-620, 900, 90], [620, 900, 90]] },
        hull: [[3000, 700], [2950, 1100], [1700, 1950], [-2700, 1950], [-2950, 1600], [-2950, 700]], hullW: 2620,
        sponson: [[2800, 1150], [-2900, 1150], [-2900, 1300], [2650, 1300]], sponW: 2650,
        turret: { y: 0, z: 1950, lathe: [[0, 0], [1150, 0], [1120, 500], [950, 820], [500, 920], [0, 920]], sc: [0.95, 1.08, 1], seg: 22 },
        gun: { y: 900, z: 430, r: 60, len: 2400, mantlet: [800, 300, 500] },
        hatches: [[-350, -300, 2870, 270, 'Torre'], [350, -100, 2870, 230, 'Torre'], [-450, 1650, 1950, 230], [450, 1650, 1950, 230]],
        extra: [SG('Torre', 'acoPreto', [-350, -300, 3050], [-350, 600, 3250], 30), C('Torre', 'acoPreto', 22, 1200, [-350, 400, 3230], { rot: [-10, 0, 0], seg: 8 }), B('Torre', 'acoPreto', [140, 400, 200], [-350, -100, 3150], { bev: 10 }),
          B(null, pa, [2400, 180, 400], [0, -2950, 1400], { bev: 20, cell: 'traseira' }), C(null, 'acoPreto', 110, 300, [-700, -3000, 1250], { axis: 'y', seg: 10 }), C(null, 'acoPreto', 110, 300, [700, -3000, 1250], { axis: 'y', seg: 10 }),
          C(null, pa, 200, 300, [0, 2860, 1000], { axis: 'x', seg: 12, cell: 'transmissao' }), B(null, 'nogueira', [80, 1400, 80], [900, -1500, 1960], { cell: 'pa' }), B(null, 'acoGasto', [40, 900, 40], [-900, -1400, 1960], { cell: 'barra' })],
        ins: [['starW', 400, [1312, -1200, 1500], [0, 0, 0]], ['starW', 400, [-1312, -1200, 1500], [0, 0, 180]], ['starW', 300, [0, 0, 2880], [0, -90, 0], 'Torre']] }) }; } },
  { id: 'tiger', cat: 'veic', war: 2, n: 'Tanque Tiger I', d: 'Blindagem quadrada, rodas intercaladas, canhão 8,8 cm com freio de boca.', mm: '14 9 0 0', vars: { cor: { n: 'Pintura', o: [['hinterhalt', 'Camuflado'], ['dunkelgelb', 'Dunkelgelb'], ['cinzaPanzer', 'Cinza Panzer'], ['inverno', 'Inverno']], v: 'hinterhalt' } },
    build: v => { const pa = v.cor, wh = [];
      for (let i = 0; i < 8; i++) { const y = -2500 + i * 680; wh.push([y, 400, 400, 120]); if (i < 7) wh.push([y + 340, 400, 400, 120]); }
      return { parts: tank({ paint: pa,
        tr: { len: 6300, h: 1200, rf: 450, rr: 420, tw: 720, x: 1450, wheels: wh, tire: 'acoPreto', rim: 0.9 },
        hull: [[3150, 650], [3150, 1150], [2700, 1300], [2400, 1950], [-3000, 1950], [-3150, 1700], [-3150, 650]], hullW: 2300,
        sponson: [[2700, 1250], [2350, 1950], [-3100, 1950], [-3100, 1250]], sponW: 3400,
        turret: { y: -200, z: 1950, ext: [[-1500, 0], [-1600, 400], [-1500, 900], [1500, 900], [1550, 0]], w: 2200 },
        gun: { y: 1550, z: 480, r: 80, len: 4300, mantlet: [800, 260, 700], brake: 400 },
        hatches: [[-500, -900, 2880, 300, 'Torre'], [500, -500, 2880, 280, 'Torre'], [-500, 2200, 1950, 240], [500, 2200, 1950, 240]],
        extra: [C('Torre', pa, 330, 240, [-500, -900, 2950], { axis: 'z', seg: 18, cell: 'cupula' }), ...Array.from({ length: 6 }, (_, i) => B('Torre', 'vidro', [60, 120, 80], [-500 + Math.cos(i * 1.05) * 330, -900 + Math.sin(i * 1.05) * 330, 2990], { rot: [0, 0, i * 60] })),
          B('Torre', pa, [700, 500, 400], [0, -1800, 2350], { bev: 30, cell: 'caixa' }), ...[-1, 1].flatMap(s => [C('Torre', 'acoPreto', 50, 300, [s * 1120, 1000, 2600], { rot: [-20, 0, 0], seg: 8 }), C('Torre', 'acoPreto', 50, 300, [s * 1120, 900, 2600], { rot: [-20, 0, 0], seg: 8 })]),
          C(null, 'acoPreto', 130, 400, [-500, -3200, 1500], { axis: 'y', seg: 12 }), C(null, 'acoPreto', 130, 400, [500, -3200, 1500], { axis: 'y', seg: 12 }), B(null, 'nogueira', [80, 1600, 80], [1500, -1500, 1980], { cell: 'pa' }), C(null, 'acoGasto', 40, 1800, [-1500, -1200, 1990], { seg: 8 })],
        ins: [['balken', 200, [1702, 0, 1600], [0, 0, 0]], ['balken', 200, [-1702, 0, 1600], [0, 0, 180]]] }) }; } },
  { id: 't34', cat: 'veic', war: 2, n: 'Tanque T-34/85', d: 'Blindagem inclinada, rodas Christie grandes e torre fundida com canhão de 85 mm.', mm: '12 9 0 0', vars: { cor: { n: 'Pintura', o: [['verdeSov', 'Verde 4BO'], ['inverno', 'Inverno'], ['tintaVermelha', 'Gasto']], v: 'verdeSov' } },
    build: v => { const pa = v.cor, wh = [];
      for (let i = 0; i < 5; i++) wh.push([-2300 + i * 1100, 410, 410, 0]);
      return { parts: tank({ paint: pa,
        tr: { len: 6000, h: 1150, rf: 420, rr: 430, tw: 500, x: 1270, wheels: wh },
        hull: [[3000, 650], [2900, 950], [1600, 1650], [-2400, 1650], [-3000, 1150], [-3000, 650]], hullW: 2000,
        sponson: [[1600, 1050], [1500, 1650], [-2450, 1650], [-3000, 1150], [-3000, 1050]], sponW: 3000,
        turret: { y: -150, z: 1650, loft: [{ y: -1400, w: 1600, ht: 650, hb: 10, n: 3 }, { y: -400, w: 2100, ht: 800, hb: 10, n: 3 }, { y: 800, w: 1900, ht: 760, hb: 10, n: 3 }, { y: 1300, w: 1300, ht: 560, hb: 10, n: 3 }] },
        gun: { y: 1300, z: 420, r: 65, len: 3600, mantlet: [600, 350, 450] },
        hatches: [[-400, -400, 2450, 280, 'Torre'], [400, -300, 2450, 230, 'Torre']],
        extra: [C('Torre', pa, 300, 220, [-400, -400, 2470], { axis: 'z', seg: 18, cell: 'cupula' }), ...[-1, 1].map(s => C(null, 'tabuas', 180, 1100, [s * 1100, -2700, 1300], { axis: 'y', seg: 14, cell: 'tanqueext' })),
          C(null, 'acoPreto', 50, 600, [-450, 2700, 1350], { rot: [-50, 0, 0], seg: 8 }), B(null, pa, [1800, 100, 100], [0, -3020, 900], { cell: 'escape' })],
        ins: [['starR', 280, [1002, -500, 2050], [0, 0, 0], 'Torre'], ['starR', 280, [-1002, -500, 2050], [0, 0, 180], 'Torre']] }) }; } },
  { id: 'tanque_destruido', cat: 'veic', war: 2, n: 'Panzer IV destruído', d: 'Carcaça queimada com a torre deslocada e uma lagarta solta.', mm: '12 8 0 0', fx: { burn: 0, rust: 0.6, dirt: 0.7, scratches: 0.5 },
    build: () => { const pa = 'ferrugem', wh = []; for (let i = 0; i < 8; i++) wh.push([-2200 + i * 620, 300, 260, 0]);
      const P = tank({ paint: pa, tr: { len: 5600, h: 1050, rf: 380, rr: 360, tw: 400, x: 1200, wheels: wh, rollers: [[-1800, 950, 80], [-600, 950, 80], [600, 950, 80], [1800, 950, 80]] },
        hull: [[2800, 600], [2800, 1300], [2400, 1700], [-2700, 1700], [-2800, 1400], [-2800, 600]], hullW: 2100,
        sponson: [[2500, 1150], [-2800, 1150], [-2800, 1250], [2500, 1250]], sponW: 2850,
        turret: { y: 0, z: 1700, ext: [[-1300, 0], [-1300, 750], [1000, 820], [1300, 0]], w: 1750 }, gun: { y: 1300, z: 400, r: 60, len: 2800, mantlet: [500, 200, 400], brake: 250 } });
      return { parts: P.map(p => p.g === 'Torre' ? { ...p, g: null, M: TRS([300, -500, 120], [0, 10, 24]).multiply(p.M ? new THREE.Matrix4().fromArray(p.M) : new THREE.Matrix4()).toArray() } : p)
        .filter(p => !(p.cell === 'lagarta' && p.p[0] > 0)).concat([E(null, 'acoOxidado', [[0, 0], [3000, 0], [3000, 60], [0, 60]], 400, [2200, -1500, 0], { rot: [0, 0, 70], cell: 'lagarta2' })]) }; } },

  // ================================================== AVIÕES
  { id: 'spitfire', cat: 'aviao', war: 2, n: 'Supermarine Spitfire Mk IX', d: 'Asa elíptica, camuflagem RAF, rodelas, hélice de 4 pás girando.', mm: '18 10 0 0',
    build: () => ({ parts: fighter({ top: 'rafCamo', under: 'rlm76', pitch: 10,
      fus: [[4250, 520, 300, 420, -40], [3600, 760, 420, 560, -60], [2600, 860, 520, 700, -80], [1400, 880, 600, 720, -80], [600, 860, 600, 700], [-300, 800, 560, 640], [-1500, 640, 470, 560, -30], [-2800, 440, 340, 430], [-3900, 220, 250, 300, 40], [-4500, 60, 140, 110, 80]],
      canopy: { z: 480, frame: true, sec: [[1500, 120, 40], [1200, 500, 280], [400, 540, 320], [-200, 440, 220], [-700, 120, 60]] },
      wing: { span: 5615, c0: 2510, c1: 500, ell: true, dih: 6, y: 1650, z: -480, lePos: 0.3 },
      tail: { y: -3600, z: 60, span: 1600, c0: 1000, c1: 380, ell: true, fin: 1500, fc0: 1300, fc1: 420, fy: -3300, fz: 180 },
      nose: { y: 4250, z: -40, spin: 300, blades: 4, prop: 1600, chord: 260 },
      gear: { x0: 900, x1: 1100, y: 1700, z0: -500, z1: -1500, r: 340, w: 150, tail: [-4200, -100] },
      extra: [...[-1, 1].flatMap(s => [B(null, 'rlm76', [380, 900, 220], [s * 1700, 900, -760], { bev: 30, cell: 'radiador' }), C(null, 'acoPreto', 25, 700, [s * 2100, 2000, -460], { seg: 8, cell: 'canhao' }), ...Array.from({ length: 6 }, (_, i) => C(null, 'acoPreto', 35, 120, [s * 400, 3600 - i * 160, 120], { axis: 'x', seg: 8, cell: 'escape' }))])],
      ins: [['roundelA', 330, 'side', -1700, 40], ['roundel', 440, 'wing', 3500, 0.32], ['roundel', 440, 'wing', -3500, 0.32]] }) }),
    anim: { n: 6, fps: 24, groups: { 'Hélice': f => ({ r: spinR(10, f * 15), e: 'linear' }) } } },
  { id: 'bf109', cat: 'aviao', war: 2, n: 'Messerschmitt Bf 109 G', d: 'Asa trapezoidal de pontas arredondadas, RLM 74/75, nariz amarelo.', mm: '16 9 0 0',
    build: () => ({ parts: fighter({ top: 'rlmSplinter', under: 'rlm76', pitch: 11, boxy: 2.2,
      fus: [[4100, 620, 380, 420, -20], [3200, 860, 520, 600, -40], [2000, 900, 560, 660, -40], [900, 880, 640, 660], [0, 800, 560, 620], [-1200, 600, 460, 520], [-2500, 400, 340, 400, 30], [-3700, 180, 240, 260, 60], [-4300, 50, 140, 100, 80]],
      canopy: { z: 470, frame: true, sec: [[1500, 120, 40], [1200, 480, 250], [600, 520, 290], [-100, 420, 200], [-500, 120, 60]] },
      wing: { span: 4960, c0: 2300, c1: 1100, dih: 6.5, y: 1500, z: -460, sweep: 300 },
      tail: { y: -3500, z: 160, span: 1450, c0: 950, c1: 520, fin: 1300, fc0: 1100, fc1: 600, fy: -3250, fz: 220 },
      nose: { y: 4100, z: -20, spin: 300, blades: 3, prop: 1500, chord: 280, spinMat: 'preto' },
      gear: { x0: 300, x1: 1000, y: 1600, z0: -650, z1: -1550, r: 330, w: 150, tail: [-4000, -50] },
      extra: [L(null, 'amarelo', [[440, 0], [520, 300], [520, 600], [0, 600]], [0, 3500, -20], { seg: 20, cell: 'narizamarelo' }), ...[-1, 1].flatMap(s => [B(null, 'rlm76', [300, 700, 160], [s * 1500, 900, -680], { bev: 20, cell: 'radiador' }), ...Array.from({ length: 6 }, (_, i) => C(null, 'acoPreto', 35, 100, [s * 440, 3400 - i * 150, 50], { axis: 'x', seg: 8, cell: 'escape' }))])],
      ins: [['balken', 280, 'side', -1600, 50], ['balken', 340, 'wing', 3300, 0.35], ['balken', 340, 'wing', -3300, 0.35]] }) }),
    anim: { n: 8, fps: 24, groups: { 'Hélice': f => ({ r: spinR(11, f * 15), e: 'linear' }) } } },
  { id: 'p51', cat: 'aviao', war: 2, n: 'North American P-51D Mustang', d: 'Cabine em bolha, alumínio natural, entrada de ar ventral e estrela americana.', mm: '18 9 0 0',
    build: () => ({ parts: fighter({ top: 'aluminio', pitch: 10,
      fus: [[4400, 560, 340, 420, -40], [3500, 840, 480, 620, -60], [2200, 900, 560, 680, -60], [1000, 900, 520, 700], [0, 860, 600, 700], [-1500, 620, 430, 520], [-2900, 420, 330, 380, 40], [-4000, 160, 230, 250, 80], [-4500, 50, 130, 90, 100]],
      belly: [[700, 300, 50, 160, -680], [-200, 560, 50, 420, -720], [-1700, 400, 50, 260, -560], [-2300, 120, 40, 60, -480]],
      canopy: { z: 470, sec: [[1500, 120, 40], [1100, 600, 380], [100, 640, 420], [-900, 380, 200], [-1500, 80, 40]] },
      wing: { span: 5650, c0: 2700, c1: 1200, dih: 5, y: 1700, z: -500, sweep: 0 },
      tail: { y: -3600, z: 80, span: 1700, c0: 1100, c1: 520, fin: 1500, fc0: 1500, fc1: 600, fy: -3250, fz: 200, fsweep: 700 },
      nose: { y: 4400, z: -40, spin: 300, blades: 4, prop: 1700, chord: 280 },
      gear: { x0: 900, x1: 1200, y: 1500, z0: -600, z1: -1600, r: 360, w: 160, tail: [-4100, -60] },
      extra: [...[-1, 1].flatMap(s => [...[0, 1, 2].map(i => C(null, 'acoPreto', 22, 500, [s * (2200 + i * 200), 2000, -470], { seg: 8, cell: 'mg' })), ...Array.from({ length: 6 }, (_, i) => C(null, 'acoPreto', 35, 120, [s * 430, 3700 - i * 160, 60], { axis: 'x', seg: 8, cell: 'escape' }))]), L(null, 'oliva', [[480, 0], [500, 600], [0, 600]], [0, 3300, -40], { seg: 20, cell: 'antirreflexo' })],
      ins: [['starUS', 300, 'side', -1900, 0], ['starUS', 400, 'wing', -3900, 0.35]] }) }),
    anim: { n: 6, fps: 24, groups: { 'Hélice': f => ({ r: spinR(10, f * 15), e: 'linear' }) } } },
  { id: 'zero', cat: 'aviao', war: 2, n: 'Mitsubishi A6M Zero', d: 'Motor radial, asa de pontas arredondadas e o hinomaru vermelho.', mm: '18 9 0 0', vars: { cor: { n: 'Pintura', o: [['cinzaClaro', 'Cinza-claro (1942)'], ['verdeJapao', 'Verde escuro (1944)']], v: 'cinzaClaro' } },
    build: v => ({ parts: fighter({ top: v.cor, under: 'cinzaClaro', pitch: 11,
      fus: [[3300, 1000, 500, 500, 0], [2500, 1080, 560, 560], [1500, 960, 560, 600], [400, 860, 520, 560], [-900, 640, 420, 480], [-2200, 400, 320, 360, 30], [-3500, 180, 220, 220, 60], [-4000, 50, 120, 90, 80]],
      canopy: { z: 450, frame: true, sec: [[1400, 120, 40], [1000, 520, 300], [-300, 520, 300], [-1300, 300, 160], [-1900, 80, 40]] },
      wing: { span: 6000, c0: 2600, c1: 900, dih: 6, y: 1500, z: -380, sweep: 400 },
      tail: { y: -3200, z: 60, span: 1600, c0: 1000, c1: 500, fin: 1300, fc0: 1200, fc1: 500, fy: -3000, fz: 180 },
      nose: { y: 3900, z: 0, spin: 260, blades: 3, prop: 1450, chord: 240, radial: 560, len: 700, cowl: 'preto', tips: false },
      gear: { x0: 1300, x1: 1400, y: 1300, z0: -450, z1: -1450, r: 300, w: 140, tail: [-3700, -80] },
      ins: [['hinomaru', 330, 'side', -2000, 0], ['hinomaru', 460, 'wing', 4200, 0.35], ['hinomaru', 460, 'wing', -4200, 0.35]] }) }),
    anim: { n: 8, fps: 24, groups: { 'Hélice': f => ({ r: spinR(11, f * 15), e: 'linear' }) } } },
  { id: 'stuka', cat: 'aviao', war: 2, n: 'Junkers Ju 87 Stuka', d: 'Asa de gaivota invertida, trem fixo carenado e cabine longa de dois lugares.', mm: '20 10 0 0',
    build: () => ({ parts: fighter({ top: 'rlmSplinter', under: 'rlm76', pitch: 12, boxy: 2.6,
      fus: [[4300, 700, 450, 500], [3400, 1000, 600, 700], [2000, 1000, 640, 760], [600, 960, 760, 700], [-800, 820, 620, 600], [-2400, 560, 420, 460, 30], [-3800, 260, 300, 300, 80], [-4500, 60, 160, 120, 100]],
      canopy: { z: 560, frame: true, sec: [[1800, 140, 40], [1400, 560, 300], [-600, 560, 300], [-1200, 300, 120]] },
      wing: { gull: 14, inner: 1600, span: 6900, c0: 2700, c1: 1100, dih: 8, y: 1700, z: -500, sweepIn: 150 },
      tail: { y: -3800, z: 200, span: 1700, c0: 1100, c1: 600, fin: 1500, fc0: 1300, fc1: 700, fy: -3600, fz: 260 },
      nose: { y: 4300, z: 0, spin: 300, blades: 3, prop: 1650, chord: 300 },
      gear: { x0: 1500, x1: 1600, y: 1300, z0: -900, z1: -1750, r: 320, w: 140, spat: true, tail: [-4300, -40] },
      extra: [B(null, 'rlm76', [500, 700, 400], [0, 3000, -800], { bev: 50, cell: 'radiador' }), C(null, 'preto', 200, 1800, [0, 1000, -1050], { seg: 14, cell: 'bomba' }), L(null, 'preto', [[0, 0], [200, 0], [200, 100], [0, 400]], [0, 1900, -1050], { seg: 12 }), L(null, 'preto', [[0, 0], [200, 0], [100, -300], [0, -300]], [0, 100, -1050], { seg: 12 })],
      ins: [['balken', 300, 'side', -1900, 80]] }) }),
    anim: { n: 8, fps: 24, groups: { 'Hélice': f => ({ r: spinR(12, f * 15), e: 'linear' }) } } },
  { id: 'fokker_dr1', cat: 'aviao', war: 1, n: 'Fokker Dr.I (triplano)', d: 'O triplano do Barão Vermelho: três asas, cruz pátea e hélice de madeira.', mm: '12 10 0 0', vars: { cor: { n: 'Pintura', o: [['vermelho', 'Vermelho'], ['lozenge', 'Losangos'], ['linho', 'Linho']], v: 'vermelho' } },
    build: v => ({ parts: biplane({ skin: v.cor, wingMat: v.cor, pitch: 12, noseY: 2300, noseZ: 0,
      fus: [[2300, 820, 400, 420], [1600, 800, 450, 460], [400, 700, 420, 440], [-1200, 420, 300, 300, 60], [-2900, 80, 140, 120, 120]],
      cowl: 500, cowlLen: 450, cowlMat: 'aluminio',
      wings: [[-560, 2850, 1000, 1200], [380, 3100, 1000, 1350], [1250, 3600, 1000, 1500]], struts: [1700],
      cab: [1700, 480], tail: { y: -2600, z: 100, span: 1200, c0: 900, fin: 900, fc: 800 }, prop: 1300, gearZ: -1100, mgZ: 620,
      ins: [['pattee', 220, [128, -2000, 100], [0, 0, 0]], ['pattee', 220, [-128, -2000, 100], [0, 0, 180]], ['pattee', 320, [2800, 1000, 1276], [0, -90, 0]], ['pattee', 320, [-2800, 1000, 1276], [0, -90, 0]]] }) }),
    anim: { n: 6, fps: 24, groups: { 'Hélice': f => ({ r: spinR(12, f * 30), e: 'linear' }) } } },
  { id: 'sopwith_camel', cat: 'aviao', war: 1, n: 'Sopwith Camel', d: 'Biplano britânico de 1917: linho envernizado, Vickers gêmeas e rodelas.', mm: '12 9 0 0',
    build: () => ({ parts: biplane({ skin: 'linho', wingMat: 'linho', pitch: 11, noseY: 2400, noseZ: 0,
      fus: [[2400, 860, 440, 460], [1700, 820, 480, 480], [400, 720, 440, 440], [-1300, 420, 300, 300, 60], [-3200, 80, 140, 120, 120]],
      cowl: 520, cowlLen: 480, cowlMat: 'aluminio',
      wings: [[-560, 4100, 1370, 1300, -5], [850, 4100, 1370, 1450, 5]], struts: [2200],
      cab: [1800, 480], tail: { y: -2900, z: 100, span: 1500, c0: 950, fin: 1000, fc: 900 }, prop: 1300, gearZ: -1150, mgZ: 600,
      ins: [['roundel', 260, [160, -1800, 80], [0, 0, 0]], ['roundel', 260, [-160, -1800, 80], [0, 0, 180]], ['roundel', 420, [3000, 800, 896], [0, -90, 0]], ['roundel', 420, [-3000, 800, 896], [0, -90, 0]]] }) }),
    anim: { n: 6, fps: 24, groups: { 'Hélice': f => ({ r: spinR(11, f * 30), e: 'linear' }) } } },
  { id: 'aviao_abatido', cat: 'aviao', war: 2, n: 'Caça abatido', d: 'Bf 109 caído de nariz no chão, asa partida e hélice torta.', mm: '12 6 0 0', fx: { burn: 0, rust: 0.3, dirt: 0.8, scratches: 0.6 },
    build: () => { const P = fighter({ top: 'rlmSplinter', under: 'rlm76', boxy: 2.2,
      fus: [[4100, 620, 380, 420, -20], [3200, 860, 520, 600, -40], [2000, 900, 560, 660, -40], [900, 880, 640, 660], [0, 800, 560, 620], [-1200, 600, 460, 520], [-2500, 400, 340, 400, 30], [-3700, 180, 240, 260, 60], [-4300, 50, 140, 100, 80]],
      canopy: { z: 470, sec: [[1500, 120, 40], [1200, 480, 250], [600, 520, 290], [-100, 420, 200], [-500, 120, 60]] },
      wing: { span: 4960, c0: 2300, c1: 1100, dih: 6.5, y: 1500, z: -460, sweep: 300 },
      tail: { y: -3500, z: 160, span: 1450, c0: 950, c1: 520, fin: 1300, fc0: 1100, fc1: 600, fy: -3250, fz: 220 },
      nose: { y: 4100, z: -20, spin: 300, blades: 3, prop: 1500, chord: 280, tips: false },
      gear: { x0: 300, x1: 1000, y: 1600, z0: -650, z1: -900, r: 330, w: 150 },
      ins: [['balken', 280, 'side', -1600, 50]] });
      const crashed = xform(P.map(p => p.g === 'Hélice' ? { ...p, g: null, rot: p.rot ? [p.rot[0] + 35, p.rot[1], p.rot[2] + 20] : p.rot } : p), TRS([0, 0, 2000], [-22, 8, 15]));
      return { parts: crashed.concat([W(null, 'rlmSplinter', { span: 2500, c0: 1500, c1: 1100, t: 0.12, half: true }, [3200, -1500, 120], { rot: [6, 4, 160], cell: 'asasolta' }),
        ...Array.from({ length: 10 }, (_, i) => B(null, i % 2 ? 'rlmSplinter' : 'acoOxidado', [200 + rnd(i) * 400, 100 + rnd(i + 5) * 300, 15], [rnd(i * 3) * 4000 - 2000, rnd(i * 7) * 4000 - 1000, 20], { rot: [rnd(i) * 40, rnd(i + 1) * 40, rnd(i + 2) * 180], cell: 'destroco' })),
        L(null, 'lama', [[0, 120], [1600, 60], [2200, 0], [0, 0]], [0, 3200, -60], { axis: 'z', seg: 18, cell: 'cratera' })]) }; } },

  // ================================================== ARTILHARIA E ARMAS PESADAS
  { id: 'flak88', cat: 'art', war: 2, n: 'Canhão Flak 8,8 cm', d: 'O "oitenta e oito": plataforma em cruz, escudo e cano longo apontado para o céu.', mm: '10 8 0 0', vars: { cor: { n: 'Pintura', o: [['dunkelgelb', 'Dunkelgelb'], ['cinzaPanzer', 'Cinza Panzer'], ['inverno', 'Inverno']], v: 'dunkelgelb' } },
    build: v => { const o = v.cor, P = [B(null, o, [600, 5000, 300], [0, 0, 350], { bev: 30, cell: 'braco' }), B(null, o, [4600, 500, 260], [0, 0, 340], { bev: 30, cell: 'braco' }),
      ...[[0, 2400], [0, -2400], [2200, 0], [-2200, 0]].map(([x, y]) => C(null, o, 240, 120, [x, y, 120], { axis: 'z', seg: 14, cell: 'sapata' })),
      C(null, o, 450, 900, [0, 0, 950], { axis: 'z', seg: 18, r2: 380, cell: 'pedestal' }), C('Torre', o, 650, 200, [0, 0, 1450], { axis: 'z', seg: 22, cell: 'giro' }),
      B('Torre', o, [200, 800, 900], [-500, 0, 1900], { bev: 20, cell: 'munhao' }), B('Torre', o, [200, 800, 900], [500, 0, 1900], { bev: 20, cell: 'munhao' })];
      const gun = [C(null, o, 110, 5000, [0, 2500, 0], { r2: 85, seg: 16, cell: 'cano' }), C(null, o, 180, 1800, [0, 300, 0], { seg: 16, cell: 'culatra' }), B(null, o, [380, 1100, 380], [0, -600, -60], { bev: 30, cell: 'bloco' }),
        C(null, 'acoGasto', 70, 1700, [0, 900, 230], { seg: 10, cell: 'recuo' }), C(null, 'acoGasto', 60, 1300, [0, 800, -230], { seg: 10, cell: 'recuo' }), C(null, 'acoPreto', 95, 40, [0, 5010, 0], { seg: 14 })];
      P.push(...xform(gun.map(p => ({ ...p, g: 'Torre' })), TRS([0, 0, 2200], [32, 0, 0])));
      P.push(E('Torre', o, [[-1300, 0], [1300, 0], [1300, 1400], [600, 1700], [-600, 1700], [-1300, 1400]], 30, [0, 1300, 1300], { rot: [0, 0, 90], holes: [[[-200, 500], [200, 500], [200, 1000], [-200, 1000]]], cell: 'escudo' }));
      P.push(...[-1, 1].map(s => SP(null, 'acoGasto', [120, 120, 120], [s * 900, 0, 1700], { seg: [8, 6] })));
      return { parts: P }; } },
  { id: 'pak40', cat: 'art', war: 2, n: 'Canhão antitanque PaK 40', d: 'Escudo duplo inclinado, flechas abertas e freio de boca.', mm: '6 4 0 0', vars: { cor: { n: 'Pintura', o: [['dunkelgelb', 'Dunkelgelb'], ['cinzaPanzer', 'Cinza Panzer'], ['hinterhalt', 'Camuflado']], v: 'dunkelgelb' } },
    build: v => { const o = v.cor, P = [...wheel(-1000, 0, 420, 420, 180, { hub: o, rim: 0.55 }), ...wheel(1000, 0, 420, 420, 180, { hub: o, rim: 0.55 }),
      SG(null, o, [-1000, 0, 420], [1000, 0, 420], 70, { seg: 10, cell: 'eixo' }), SG(null, o, [-200, -100, 500], [-1400, -3300, 120], 90, { seg: 8, cell: 'flecha' }), SG(null, o, [200, -100, 500], [1400, -3300, 120], 90, { seg: 8, cell: 'flecha' }),
      B(null, o, [300, 120, 200], [-1400, -3350, 80], { cell: 'pa' }), B(null, o, [300, 120, 200], [1400, -3350, 80], { cell: 'pa' }),
      B(null, o, [600, 1300, 380], [0, -200, 800], { bev: 40, cell: 'berco' }), C(null, o, 90, 3300, [0, 1900, 900], { r2: 75, seg: 14, cell: 'cano' }),
      L(null, o, [[0, 0], [160, 0], [170, 40], [170, 360], [160, 400], [0, 400]], [0, 3550, 900], { seg: 14, cell: 'freio' }), B(null, 'preto', [360, 80, 120], [0, 3750, 900], { cell: 'fenda' }),
      E(null, o, [[-1050, 0], [1050, 0], [1050, 900], [80, 1000], [-80, 1000], [-1050, 900]], 14, [0, 350, 500], { rot: [0, 0, 90], ord: 'XYZ', holes: [[[-160, 300], [160, 300], [160, 520], [-160, 520]]], cell: 'escudo' }),
      E(null, o, [[-1050, 0], [1050, 0], [1050, 900], [-1050, 900]], 14, [0, 430, 520], { rot: [0, 0, 90], cell: 'escudo2' })];
      return { parts: P.map(p => p.cell && p.cell.startsWith('escudo') ? { ...p, rot: [-14, 0, 90], ord: 'XYZ' } : p) }; } },
  { id: 'canhao75', cat: 'art', war: 1, n: 'Canhão de 75 mm (1897)', d: 'O "Soixante-quinze" francês: rodas de madeira raiadas e escudo.', mm: '6 4 0 0',
    build: () => ({ parts: [...spokedWheel(-850, 0, 640, 640, 100, 14), ...spokedWheel(850, 0, 640, 640, 100, 14), SG(null, 'azulHorizonte', [-850, 0, 640], [850, 0, 640], 60, { seg: 10 }),
      SG(null, 'azulHorizonte', [0, -100, 700], [0, -3200, 80], 120, { r2: 90, seg: 8, cell: 'flecha' }), B(null, 'azulHorizonte', [400, 300, 200], [0, -3250, 60], { cell: 'pa' }),
      B(null, 'azulHorizonte', [400, 1600, 300], [0, 300, 900], { bev: 30, cell: 'berco' }), C(null, 'azulHorizonte', 75, 2700, [0, 1300, 1100], { r2: 62, seg: 14, cell: 'cano' }),
      E(null, 'azulHorizonte', [[-900, 0], [900, 0], [900, 1000], [-900, 1000]], 12, [0, 520, 400], { rot: [-8, 0, 90], ord: 'XYZ', holes: [[[-120, 600], [120, 600], [120, 820], [-120, 820]]], cell: 'escudo' }),
      E(null, 'azulHorizonte', [[-900, 0], [900, 0], [900, 500], [-900, 500]], 12, [0, 430, -100], { rot: [8, 0, 90], ord: 'XYZ', cell: 'escudo2' })] }) },
  { id: 'morteiro', cat: 'art', war: 2, n: 'Morteiro 81 mm', d: 'Tubo, bipé e placa-base, com caixa de granadas aberta.', mm: '2 2 0 0',
    build: () => ({ parts: [C(null, 'oliva', 300, 60, [0, -300, 30], { axis: 'z', seg: 16, cell: 'placa' }), ...xform([C(null, 'oliva', 45, 1250, [0, 0, 625], { axis: 'z', seg: 14, cell: 'tubo' }), C(null, 'acoPreto', 50, 50, [0, 0, 1250], { axis: 'z', seg: 14 })], TRS([0, -300, 60], [-30, 0, 0])),
      SG(null, 'oliva', [0, 150, 900], [-350, 450, 0], 22, { seg: 6, cell: 'bipe' }), SG(null, 'oliva', [0, 150, 900], [350, 450, 0], 22, { seg: 6, cell: 'bipe' }), SG(null, 'acoGasto', [-250, 360, 300], [250, 360, 300], 12, { seg: 6 }),
      B(null, 'acoGasto', [80, 120, 300], [0, 200, 800], { cell: 'mira' }),
      ...crate(700, -200, 0, 420, 700, 260, 'caixaVerde', { handles: false }), ...[0, 1, 2].map(i => L(null, 'oliva', [[0, 0], [38, 20], [40, 240], [20, 330], [0, 340]], [580 + i * 110, -200, 260], { axis: 'z', rot: [80, 0, 0], seg: 10, cell: 'granada' }))] }) },
  { id: 'mg42_tripe', cat: 'art', war: 2, n: 'MG 42 no tripé (Lafette 34)', d: 'Metralhadora alemã com camisa perfurada, cofre de munição e fita.', mm: '2 2 0 0',
    build: () => ({ parts: [SG(null, 'feldgrau', [0, 0, 600], [0, -900, 0], 30, { seg: 8, cell: 'perna' }), SG(null, 'feldgrau', [0, 0, 600], [-600, 500, 0], 30, { seg: 8, cell: 'perna' }), SG(null, 'feldgrau', [0, 0, 600], [600, 500, 0], 30, { seg: 8, cell: 'perna' }),
      B(null, 'feldgrau', [160, 500, 120], [0, 0, 650], { bev: 15, cell: 'berco' }),
      B('Arma', 'acoPreto', [70, 600, 130], [0, 100, 760], { bev: 10, cell: 'caixa' }), C('Arma', 'perfurado', 34, 520, [0, 650, 770], { seg: 12, cell: 'camisa' }), C('Arma', 'acoPreto', 16, 120, [0, 960, 770], { seg: 8 }),
      L('Arma', 'acoPreto', [[0, 0], [26, 0], [32, 30], [26, 60], [0, 60]], [0, 990, 770], { seg: 10 }), E('Arma', 'baquelite', [[-200, 760], [-200, 700], [-560, 640], [-560, 760]], 50, [0, 0, 0], { bev: 8, cell: 'coronha' }),
      E('Arma', 'baquelite', [[-60, 700], [-20, 700], [-60, 580], [-110, 590]], 36, [0, 0, 0], { cell: 'punho' }),
      B(null, 'feldgrau', [120, 280, 200], [-300, 0, 100], { bev: 15, cell: 'cofre' }), TU(null, 'latao', [[-300, 0, 220], [-200, 40, 500], [-60, 60, 760]], 18, { rs: 4, cell: 'fita' })] }) },
  { id: 'vickers', cat: 'art', war: 1, n: 'Metralhadora Vickers', d: 'Metralhadora da Grande Guerra com camisa d’água e mangueira para a lata de condensação.', mm: '2 2 0 0',
    build: () => ({ parts: [SG(null, 'parkVerde', [0, 0, 550], [0, -900, 0], 34, { seg: 8, cell: 'perna' }), SG(null, 'parkVerde', [0, 0, 550], [-600, 500, 0], 34, { seg: 8, cell: 'perna' }), SG(null, 'parkVerde', [0, 0, 550], [600, 500, 0], 34, { seg: 8, cell: 'perna' }),
      B('Arma', 'latao', [180, 420, 200], [0, -120, 700], { bev: 10, cell: 'caixa' }), C('Arma', 'latao', 75, 720, [0, 460, 720], { seg: 16, cell: 'camisa' }), ...[0, 1, 2, 3].map(i => T('Arma', 'latao', 76, 6, [0, 150 + i * 200, 720], { rot: [90, 0, 0], seg: [4, 16] })),
      C('Arma', 'acoPreto', 20, 100, [0, 860, 720], { seg: 8 }), SG('Arma', 'acoPreto', [-60, -330, 720], [-60, -420, 720], 18), SG('Arma', 'acoPreto', [60, -330, 720], [60, -420, 720], 18),
      C(null, 'oliva', 130, 380, [300, 300, 190], { axis: 'z', seg: 14, cell: 'lata' }), TU(null, 'borracha', [[0, 600, 650], [200, 600, 500], [300, 300, 380]], 18, { rs: 6, cell: 'mangueira' })] }) },
  { id: 'holofote', cat: 'art', war: 0, n: 'Holofote antiaéreo', d: 'Holofote de 150 cm sobre reparo giratório — anima varrendo o céu.', mm: '3 4 0 0',
    build: () => ({ parts: [C(null, 'cinzaPanzer', 600, 150, [0, 0, 75], { axis: 'z', seg: 20, cell: 'base' }), C('Holofote', 'cinzaPanzer', 500, 120, [0, 0, 220], { axis: 'z', seg: 20, cell: 'giro' }),
      SG('Holofote', 'cinzaPanzer', [-650, 0, 250], [-650, 0, 1300], 60, { seg: 8 }), SG('Holofote', 'cinzaPanzer', [650, 0, 250], [650, 0, 1300], 60, { seg: 8 }),
      ...xform([C(null, 'cinzaPanzer', 600, 900, [0, 0, 0], { seg: 26, cell: 'tambor' }), C(null, 'vidro', 560, 20, [0, 455, 0], { seg: 26, cell: 'lente' }), T(null, 'cinzaPanzer', 590, 30, [0, 450, 0], { rot: [90, 0, 0], seg: [5, 26] }), L(null, 'cinzaPanzer', [[0, 0], [600, 0], [400, -350], [0, -380]], [0, -450, 0], { seg: 20 })].map(p => ({ ...p, g: 'Holofote' })), TRS([0, 0, 1300], [35, 0, 0]))] }),
    anim: { n: 32, fps: 8, groups: { Holofote: f => ({ r: [0, 0, Math.sin(f / 32 * Math.PI * 2) * 50] }) } } },

  // ================================================== OBJETOS
  { id: 'caixa_municao', cat: 'obj', war: 0, n: 'Caixote de munição', d: 'Caixote de madeira com ripas e alças de corda.', mm: '1 1 0 0', vars: { cor: { n: 'Madeira', o: [['caixaVerde', 'Pintado de verde'], ['tabuas', 'Madeira crua'], ['tabuasCinza', 'Madeira gasta']], v: 'caixaVerde' } },
    build: v => ({ parts: crate(0, 0, 0, 500, 800, 380, v.cor) }) },
  { id: 'caixas_pilha', cat: 'obj', war: 0, n: 'Pilha de caixotes', d: 'Caixotes empilhados de tamanhos variados — boa cobertura.', mm: '3 4 0 0',
    build: () => ({ parts: [...crate(-300, 0, 0, 600, 1000, 450, 'caixaVerde', { yaw: 90 }), ...crate(600, -100, 0, 500, 800, 380, 'tabuas', { yaw: 4 }), ...crate(-250, 30, 450, 500, 800, 380, 'caixaVerde', { yaw: 85 }), ...crate(550, -50, 380, 420, 600, 300, 'caixaVerde', { yaw: -8 }), ...crate(-200, 0, 830, 420, 600, 300, 'tabuasCinza', { yaw: 100 })] }) },
  { id: 'lata_municao', cat: 'obj', war: 2, n: 'Latas de munição', d: 'Duas latas de munição de metal com tampa articulada.', mm: '1 1 0 0',
    build: () => ({ parts: [0, 1].flatMap(i => [B(null, 'oliva', [110, 280, 190], [i * 140, i * 40, 95], { bev: 8, rot: [0, 0, i * 12], cell: 'lata' }), B(null, 'oliva', [120, 290, 20], [i * 140, i * 40, 200], { bev: 4, rot: [0, 0, i * 12], cell: 'tampa' }), T(null, 'acoGasto', 50, 6, [i * 140, i * 40, 220], { rot: [0, 90, i * 12], arc: 180, seg: [4, 8] })]) }) },
  { id: 'tambor', cat: 'obj', war: 0, n: 'Tambor de 200 L', d: 'Tambor de combustível com frisos — em pé.', mm: '1 3 0 0', vars: { cor: { n: 'Pintura', o: [['oliva', 'Verde-oliva'], ['feldgrau', 'Feldgrau'], ['vermelho', 'Vermelho'], ['ferrugem', 'Enferrujado']], v: 'oliva' } },
    build: v => ({ parts: drum(0, 0, 0, v.cor) }) },
  { id: 'tambores', cat: 'obj', war: 0, n: 'Tambores (grupo)', d: 'Três tambores em pé e um caído.', mm: '3 3 0 0',
    build: () => ({ parts: [...drum(0, 0, 0, 'oliva'), ...drum(620, 80, 0, 'ferrugem'), ...drum(300, 560, 0, 'feldgrau'), ...drum(-500, 700, 290, 'oliva', { rot: [90, 0, 30] })] }) },
  { id: 'galao', cat: 'obj', war: 2, n: 'Galão Wehrmacht (jerrycan)', d: 'O galão de 20 L com o "X" estampado e três alças.', mm: '1 1 0 0', vars: { cor: { n: 'Pintura', o: [['feldgrau', 'Feldgrau'], ['dunkelgelb', 'Dunkelgelb'], ['oliva', 'Aliado (oliva)'], ['vermelho', 'Vermelho']], v: 'feldgrau' } },
    build: v => { const o = v.cor; return { parts: [B(null, o, [165, 345, 470], [0, 0, 235], { bev: 18, cell: 'corpo' }), ...[-1, 1].flatMap(s => [B(null, o, [12, 420, 26], [s * 86, 0, 235], { rot: [52, 0, 0], cell: 'x' }), B(null, o, [12, 420, 26], [s * 86, 0, 235], { rot: [-52, 0, 0], cell: 'x' })]),
      ...[-110, 0, 110].map(y => T(null, o, 46, 10, [0, y, 485], { rot: [0, 90, 0], arc: 180, seg: [5, 10], cell: 'alca' })), C(null, 'acoGasto', 30, 50, [0, 150, 490], { axis: 'z', seg: 10, cell: 'bocal' })] }; } },
  { id: 'radio', cat: 'obj', war: 2, n: 'Rádio de campanha', d: 'Transmissor em caixa de metal com fone, manipulador e antena chicote.', mm: '1 3 0 0',
    build: () => ({ parts: [B(null, 'oliva', [460, 300, 520], [0, 0, 260], { bev: 15, cell: 'caixa' }), B(null, 'preto', [400, 10, 300], [0, 152, 340], { cell: 'painel' }), ...[[-120, 420], [0, 420], [120, 420], [-120, 300], [120, 300]].map(([x, z]) => C(null, 'baquelite', 24, 30, [x, 165, z], { axis: 'y', seg: 10, cell: 'botao' })),
      C(null, 'vidro', 40, 10, [0, 160, 260], { axis: 'y', seg: 14, cell: 'mostrador' }), SG(null, 'acoGasto', [180, -100, 520], [260, -60, 2400], 6, { r2: 3, seg: 5, cell: 'antena' }),
      T(null, 'acoPreto', 90, 10, [-320, 120, 40], { rot: [0, 0, 0], arc: 200, seg: [4, 12] }), SP(null, 'baquelite', [45, 45, 20], [-410, 120, 40], { seg: [8, 6] }), SP(null, 'baquelite', [45, 45, 20], [-230, 120, 40], { seg: [8, 6] }),
      TU(null, 'preto', [[-230, 140, 60], [-100, 200, 30], [100, 160, 100], [230, 150, 200]], 6, { rs: 4 }), B(null, 'baquelite', [80, 140, 40], [300, 300, 20], { bev: 6, cell: 'manip' })] }) },
  { id: 'capacete_m1', cat: 'obj', war: 2, n: 'Capacete M1 no chão', d: 'Capacete americano caído, levemente virado.', mm: '0 1 0 0',
    build: () => ({ parts: xform(helmet('m1', 'oliva'), TRS([0, 0, 120], [-40, 20, 30])) }) },
  { id: 'capacete_stahl', cat: 'obj', war: 2, n: 'Stahlhelm no chão', d: 'Capacete alemão M35 emborcado.', mm: '0 1 0 0', vars: { cor: { n: 'Pintura', o: [['feldgrau', 'Feldgrau'], ['dunkelgelb', 'Dunkelgelb'], ['inverno', 'Inverno']], v: 'feldgrau' } },
    build: v => ({ parts: xform(helmet('stahl', v.cor), TRS([0, 0, 160], [180 - 25, 0, 40])) }) },
  { id: 'capacete_brodie', cat: 'obj', war: 1, n: 'Capacete Brodie no chão', d: 'O "prato de sopa" britânico da Grande Guerra.', mm: '0 1 0 0',
    build: () => ({ parts: xform(helmet('brodie', 'oliva'), TRS([0, 0, 70], [-25, 0, 0])) }) },
  { id: 'capacete_adrian', cat: 'obj', war: 1, n: 'Capacete Adrian no chão', d: 'Capacete francês com crista, azul-horizonte.', mm: '0 1 0 0',
    build: () => ({ parts: xform(helmet('adrian', 'azulHorizonte'), TRS([0, 0, 110], [-30, 10, 60])) }) },
  { id: 'tumulo_campanha', cat: 'obj', war: 0, n: 'Túmulo de campanha', d: 'Fuzil cravado pela baioneta com o capacete na coronha e monte de terra.', mm: '1 4 0 0', vars: { uni: { n: 'Capacete', o: [['m1', 'M1 (EUA)'], ['stahl', 'Stahlhelm'], ['brodie', 'Brodie'], ['adrian', 'Adrian'], ['ssh40', 'SSh-40']], v: 'stahl' } },
    build: v => { const M = TRS([0, 0, 950], [0, -90, 0]).multiply(TRS([0, 0, 0], [0, 0, -90]));
      return { parts: [...rifleProp(TRS([0, 0, 600], [-90, 0, 0]).multiply(TRS([0, 0, 0], [0, 0, 0]))), ...xform(helmet(v.uni, v.uni === 'adrian' ? 'azulHorizonte' : v.uni === 'stahl' ? 'feldgrau' : 'oliva'), TRS([0, 0, 1080], [8, 4, 0])),
        L(null, 'lama', [[0, 260], [500, 200], [700, 60], [760, 0], [0, 0]], [0, -700, 0], { axis: 'z', seg: 16, sc: [0.75, 1.5, 1], cell: 'monte' }), ...[0, 1, 2, 3, 4].map(i => SP(null, 'concreto', [60 + rnd(i) * 40, 50, 40], [Math.cos(i * 1.3) * 550, -700 + Math.sin(i * 1.3) * 1000, 30], { seg: [6, 4], cell: 'pedra' }))] }; } },
  { id: 'cruz_madeira', cat: 'obj', war: 0, n: 'Cruz de madeira', d: 'Cruz simples de campanha com plaquinha (dá para escrever com decalque).', mm: '0 4 0 0',
    build: () => ({ parts: [B(null, 'tabuasCinza', [80, 60, 1200], [0, 0, 600], { bev: 6, rot: [0, 4, 0] }), B(null, 'tabuasCinza', [600, 60, 80], [0, 0, 900], { bev: 6, rot: [0, 4, 0] }), B(null, 'branco', [260, 10, 120], [0, 36, 760], { cell: 'placa' }), L(null, 'lama', [[0, 160], [400, 80], [500, 0], [0, 0]], [0, -500, 0], { axis: 'z', seg: 14, sc: [0.8, 1.6, 1], cell: 'monte' })] }) },
  { id: 'maca', cat: 'obj', war: 0, n: 'Maca de campanha', d: 'Maca de lona com varas de madeira e pés de ferro.', mm: '1 1 0 0',
    build: () => ({ parts: [...[-1, 1].flatMap(s => [C(null, 'tabuas', 25, 2300, [s * 280, 0, 160], { seg: 8, cell: 'vara' }), SG(null, 'acoOxidado', [s * 280, 800, 160], [s * 280, 800, 0], 10), SG(null, 'acoOxidado', [s * 280, -800, 160], [s * 280, -800, 0], 10)]),
      B(null, 'lona', [560, 1800, 12], [0, 0, 150], { cell: 'lona' }), PI(null, 'lonaVerde', [200, 300, 60], [0, -500, 200], { seg: [8, 6], cell: 'cobertor' })] }) },
  { id: 'mesa_mapa', cat: 'obj', war: 0, n: 'Mesa de comando com mapa', d: 'Mesa de campanha com mapa aberto, lampião, binóculo e telefone de campo.', mm: '2 3 0 0',
    build: () => ({ parts: [B(null, 'tabuas', [1600, 900, 50], [0, 0, 760], { bev: 6, cell: 'tampo' }), ...[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => B(null, 'tabuas', [60, 60, 740], [x * 720, y * 380, 370], { cell: 'perna' })),
      B(null, 'mapa', [1100, 700, 4], [0, 0, 788], { rot: [0, 0, 6], cell: 'mapa' }), C(null, 'vermelho', 8, 50, [200, 100, 810], { axis: 'z', seg: 6 }), C(null, 'azulRoundel', 8, 50, [-150, -60, 810], { axis: 'z', seg: 6 }),
      L(null, 'acoOxidado', [[0, 0], [70, 0], [70, 20], [50, 30], [55, 160], [40, 200], [30, 240], [0, 250]], [550, 250, 785], { axis: 'z', seg: 12, cell: 'lampiao' }), C(null, 'vidro', 45, 110, [550, 250, 900], { axis: 'z', seg: 12, cell: 'globo' }),
      ...[-1, 1].map(s => C(null, 'acoPreto', 32, 150, [-500 + s * 40, -250, 820], { seg: 10, cell: 'binoculo' })), B(null, 'couroMarrom', [240, 120, 200], [-600, 280, 885], { bev: 20, cell: 'telefone' }), SG(null, 'preto', [-600, 280, 1000], [-480, 280, 1020], 25),
      B(null, 'tabuas', [450, 400, 40], [0, -850, 450], { bev: 6, cell: 'banco' }), ...[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => B(null, 'tabuas', [40, 40, 440], [x * 190, -850 + y * 170, 220], { cell: 'pernab' }))] }) },
  { id: 'lampiao', cat: 'obj', war: 0, n: 'Lampião de querosene', d: 'Lampião de tempestade com alça.', mm: '0 1 0 0',
    build: () => ({ parts: [L(null, 'acoOxidado', [[0, 0], [90, 0], [90, 40], [70, 50], [75, 200], [60, 270], [40, 300], [0, 310]], [0, 0, 0], { axis: 'z', seg: 14, cell: 'corpo' }), C(null, 'vidro', 58, 150, [0, 0, 130], { axis: 'z', seg: 14, cell: 'globo' }),
      ...[0, 1, 2, 3].map(i => SG(null, 'acoOxidado', [Math.cos(i * 1.57) * 72, Math.sin(i * 1.57) * 72, 50], [Math.cos(i * 1.57) * 72, Math.sin(i * 1.57) * 72, 220], 5, { seg: 4 })), T(null, 'acoOxidado', 80, 5, [0, 0, 320], { rot: [90, 0, 0], arc: 180, seg: [4, 10] })] }) },
  { id: 'mascara_gas', cat: 'obj', war: 2, n: 'Estojo de máscara de gás', d: 'Cilindro canelado alemão (Gasmaskenbüchse) com alça.', mm: '0 1 0 0',
    build: () => ({ parts: xform([L(null, 'feldgrau', [[0, 0], [60, 0], [62, 10], [62, 260], [58, 270], [0, 270]], [0, 0, 0], { seg: 18, cell: 'cilindro' }), ...Array.from({ length: 6 }, (_, i) => T(null, 'feldgrau', 63, 4, [0, 30 + i * 42, 0], { rot: [90, 0, 0], seg: [4, 18] })), L(null, 'feldgrau', [[0, 0], [66, 0], [66, 30], [0, 34]], [0, 270, 0], { seg: 18 }), T(null, 'couroPreto', 140, 6, [0, 130, 0], { rot: [0, 0, 90], arc: 200, seg: [4, 14] })], TRS([0, 0, 64], [0, 0, 30])) }) },
  { id: 'cartuchos_pilha', cat: 'obj', war: 0, n: 'Estojos de artilharia', d: 'Estojos de latão de 105 mm espalhados e um engradado de projéteis.', mm: '2 1 0 0',
    build: () => ({ parts: [...Array.from({ length: 7 }, (_, i) => L(null, 'latao', [[0, 0], [62, 0], [62, 8], [56, 12], [56, 360], [52, 380], [0, 380]], [rnd(i) * 900 - 450, rnd(i + 9) * 600 - 300, 58], { axis: 'y', rot: [0, 90, rnd(i * 5) * 180], ord: 'ZYX', seg: 12, cell: 'estojo' })),
      B(null, 'tabuas', [700, 400, 60], [0, 600, 200], { cell: 'engradado' }), B(null, 'tabuas', [700, 400, 60], [0, 600, 30], { cell: 'engradado' }), ...[0, 1, 2, 3].map(i => L(null, 'oliva', [[0, 0], [52, 0], [52, 260], [30, 400], [0, 420]], [-260 + i * 170, 600, 0], { axis: 'z', seg: 12, cell: 'projetil' }))] }) },
  { id: 'bicicleta', cat: 'obj', war: 2, n: 'Bicicleta militar', d: 'Bicicleta de infantaria com quadro de aço e bagageiro.', mm: '1 2 0 0',
    build: () => { const P = []; [[560, 340], [-500, 340]].forEach(([y, z]) => { P.push(T(null, 'borracha', 320, 18, [0, y, z], { rot: [0, 90, 0], seg: [6, 30], cell: 'pneu' }), T(null, 'acoGasto', 300, 8, [0, y, z], { rot: [0, 90, 0], seg: [4, 30], cell: 'aro' }));
        for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; P.push(SG(null, 'acoGasto', [0, y, z], [0, y + Math.cos(a) * 300, z + Math.sin(a) * 300], 2.5, { seg: 3, cell: 'raio' })); } });
      const F = [[0, -500, 340], [0, -100, 380], [0, -180, 900], [0, 420, 880], [0, 560, 340]];
      P.push(SG(null, 'oliva', F[0], F[1], 16), SG(null, 'oliva', F[1], F[2], 18), SG(null, 'oliva', F[2], F[3], 18), SG(null, 'oliva', F[1], F[3], 18), SG(null, 'oliva', F[3], F[4], 16), SG(null, 'oliva', F[0], F[2], 12));
      P.push(SG(null, 'acoPreto', [-280, 460, 1060], [280, 460, 1060], 12), SG(null, 'oliva', F[3], [0, 460, 1060], 14), B(null, 'couroMarrom', [120, 260, 60], [0, -200, 960], { bev: 20, cell: 'selim' }), B(null, 'oliva', [300, 400, 20], [0, -480, 720], { cell: 'bagageiro' }), C(null, 'acoGasto', 90, 20, [0, -100, 380], { axis: 'x', seg: 14, cell: 'coroa' }));
      return { parts: xform(P, TRS([0, 0, 0], [0, -8, 0])) }; } },

  // ================================================== CENÁRIO
  { id: 'muro_ruina', cat: 'cen', war: 0, n: 'Muro em ruínas', d: 'Parede de tijolos com topo quebrado, reboco caindo e entulho no pé.', mm: '4 10 0 0', vars: { mat: { n: 'Material', o: [['reboco', 'Reboco sobre tijolo'], ['tijolo', 'Tijolo aparente'], ['concreto', 'Concreto']], v: 'reboco' } },
    build: v => ({ parts: [E(null, v.mat, [[-2000, 0], [2000, 0], [2000, 1800], [1500, 2300], [1100, 1700], [700, 2900], [200, 2400], [-300, 3100], [-800, 2200], [-1300, 2500], [-2000, 1600]], 300, [0, 0, 0], { rot: [0, 0, 90], holes: [[[-1200, 900], [-500, 900], [-500, 1900], [-1200, 1900]]], cell: 'parede' }),
      ...Array.from({ length: 26 }, (_, i) => B(null, 'tijolo', [230, 110, 70], [rnd(i) * 3600 - 1800, rnd(i + 40) * 1400 - 700, 35 + rnd(i + 3) * 60], { rot: [rnd(i) * 40, rnd(i + 2) * 40, rnd(i + 7) * 180], cell: 'tijolo' })),
      ...Array.from({ length: 5 }, (_, i) => SP(null, v.mat, [400, 300, 200], [rnd(i + 50) * 3000 - 1500, (rnd(i + 30) - 0.5) * 900, 0], { seg: [7, 5], cut: 90, cell: 'entulho' }))] }) },
  { id: 'poste_telegrafo', cat: 'cen', war: 0, n: 'Poste de telégrafo', d: 'Poste de madeira com travessa e isoladores de vidro.', mm: '0 22 0 0',
    build: () => ({ parts: [C(null, 'tabuasCinza', 120, 7000, [0, 0, 3500], { axis: 'z', r2: 100, seg: 10, cell: 'poste' }), B(null, 'tabuasCinza', [1600, 100, 120], [0, 0, 6600], { cell: 'travessa' }), B(null, 'tabuasCinza', [1100, 100, 120], [0, 0, 6200], { cell: 'travessa' }),
      ...[-700, -350, 350, 700].map(x => L(null, 'vidro', [[0, 0], [40, 0], [50, 60], [30, 120], [0, 130]], [x, 0, 6660], { axis: 'z', seg: 10, cell: 'isolador' })), ...[-450, 450].map(x => L(null, 'vidro', [[0, 0], [40, 0], [50, 60], [30, 120], [0, 130]], [x, 0, 6260], { axis: 'z', seg: 10, cell: 'isolador' })),
      SG(null, 'acoGasto', [0, 0, 6000], [0, 3000, 0], 6, { seg: 4 })] }) },
  { id: 'poste_luz', cat: 'cen', war: 0, n: 'Poste de rua antigo', d: 'Poste de ferro fundido com braço curvo e lanterna.', mm: '0 14 0 0',
    build: () => ({ parts: [L(null, 'acoPreto', [[0, 0], [200, 0], [200, 60], [140, 100], [130, 400], [90, 500], [80, 3800], [0, 3800]], [0, 0, 0], { axis: 'z', seg: 14, cell: 'poste' }), TU(null, 'acoPreto', [[0, 0, 3700], [100, 0, 4000], [400, 0, 4100], [650, 0, 3950]], 35, { rs: 8, cell: 'braco' }),
      L(null, 'acoPreto', [[0, 0], [170, 60], [190, 100], [0, 150]], [650, 0, 3900], { axis: 'z', seg: 12, cell: 'chapeu' }), L(null, 'vidro', [[0, 0], [100, 0], [150, 250], [0, 260]], [650, 0, 3640], { axis: 'z', seg: 4, cell: 'lanterna' })] }) },
  { id: 'feno', cat: 'cen', war: 0, n: 'Monte de feno', d: 'Meda de feno arredondada — esconderijo clássico.', mm: '4 6 0 0',
    build: () => ({ parts: [L(null, 'palha', [[0, 0], [1500, 0], [1600, 300], [1500, 900], [1100, 1600], [500, 2000], [0, 2050]], [0, 0, 0], { axis: 'z', seg: 22, cell: 'meda' }), SG(null, 'tabuasCinza', [0, 0, 1500], [80, 0, 2600], 40, { seg: 6 }), ...Array.from({ length: 8 }, (_, i) => SP(null, 'palha', [300, 200, 80], [Math.cos(i) * 1700, Math.sin(i) * 1700, 0], { seg: [7, 4], cut: 90, cell: 'solta' }))] }) },
  { id: 'carroca', cat: 'cen', war: 0, n: 'Carroça de fazenda', d: 'Carroça de madeira com rodas raiadas e varais.', mm: '4 4 0 0',
    build: () => ({ parts: [...spokedWheel(-850, -400, 600, 600, 90, 12), ...spokedWheel(850, -400, 600, 600, 90, 12), SG(null, 'acoOxidado', [-850, -400, 600], [850, -400, 600], 40, { seg: 8 }),
      B(null, 'tabuas', [1500, 2600, 60], [0, -200, 800], { cell: 'piso' }), ...[-1, 1].map(s => B(null, 'tabuas', [50, 2600, 400], [s * 750, -200, 1020], { cell: 'lateral' })), B(null, 'tabuas', [1500, 50, 400], [0, -1500, 1020], { cell: 'traseira' }),
      SG(null, 'tabuas', [-500, 1100, 800], [-500, 3200, 500], 45, { seg: 7, cell: 'varal' }), SG(null, 'tabuas', [500, 1100, 800], [500, 3200, 500], 45, { seg: 7, cell: 'varal' }), SG(null, 'tabuas', [0, -1500, 500], [0, -1500, 0], 50), ...Array.from({ length: 4 }, (_, i) => sandbag(-400 + i * 260, -400 + rnd(i) * 300, 900, 10 * i))] }) },
  { id: 'barraca', cat: 'cen', war: 0, n: 'Barraca de campanha', d: 'Barraca de lona para dois, com estacas e cordas.', mm: '3 3 0 0', vars: { cor: { n: 'Lona', o: [['lonaVerde', 'Verde-oliva'], ['lona', 'Cáqui'], ['splinter', 'Zeltbahn (splinter)']], v: 'lonaVerde' } },
    build: v => ({ parts: [E(null, v.cor, [[-1000, 0], [1000, 0], [40, 1100], [-40, 1100]], 2200, [0, 0, 0], { rot: [0, 0, 0], cell: 'lona', holes: [[[-900, 30], [900, 30], [0, 1050]]] }), E(null, v.cor, [[-1000, 0], [1000, 0], [0, 1100]], 30, [0, 1100, 0], { rot: [0, 0, 90], cell: 'fundo' }),
      SG(null, 'tabuas', [0, 1150, 0], [0, 1150, 1250], 20), SG(null, 'tabuas', [0, -1150, 0], [0, -1150, 1250], 20), ...[[1, 1], [-1, 1], [1, -1], [-1, -1]].map(([x, y]) => SG(null, 'lona', [0, y * 1150, 1220], [x * 900, y * 1700, 0], 5, { seg: 4 }))].map(p => p.cell === 'lona' ? { ...p, rot: [0, 0, 90], p: [0, 0, 0] } : p) }) },
  { id: 'cerca', cat: 'cen', war: 0, n: 'Cerca de madeira', d: 'Seção de cerca rústica de 3 m com uma tábua solta.', mm: '1 3 0 0',
    build: () => ({ parts: [...[-1400, 0, 1400].map(x => B(null, 'tabuasCinza', [110, 110, 1300], [x, 0, 650], { bev: 10, cell: 'mourao' })), B(null, 'tabuasCinza', [3000, 40, 140], [0, 60, 1000], { rot: [0, 1, 0], cell: 'tabua' }), B(null, 'tabuasCinza', [3000, 40, 140], [0, 60, 600], { rot: [0, -2, 0], cell: 'tabua' }), B(null, 'tabuasCinza', [1500, 40, 140], [700, 60, 200], { rot: [0, 25, 0], cell: 'tabua' })] }) },
  { id: 'arvore_morta', cat: 'cen', war: 1, n: 'Árvore estilhaçada', d: 'Tronco da terra de ninguém: copa arrancada e galhos quebrados.', mm: '2 14 0 0',
    build: () => { const P = [C(null, 'tabuasCinza', 260, 4200, [0, 0, 2100], { axis: 'z', r2: 150, seg: 12, rot: [3, -4, 0], cell: 'tronco' }), L(null, 'tabuasCinza', [[0, 600], [100, 500], [250, 320], [350, 100], [420, 0], [0, 0]], [0, 0, 0], { axis: 'z', seg: 12, cell: 'raiz' })];
      for (let i = 0; i < 6; i++) { const z = 1600 + i * 420, a = i * 2.3; P.push(SG(null, 'tabuasCinza', [0, 0, z], [Math.cos(a) * (900 - i * 80), Math.sin(a) * (900 - i * 80), z + 500 + rnd(i) * 400], 70 - i * 6, { r2: 15, seg: 6, cell: 'galho' })); }
      for (let i = 0; i < 5; i++) { const a = i * 1.26; P.push(SG(null, 'tabuasCinza', [0, 0, 4100], [Math.cos(a) * 90, Math.sin(a) * 90, 4300 + rnd(i) * 300], 50, { r2: 5, seg: 4, cell: 'lasca' })); }
      return { parts: P }; } },
  { id: 'toco', cat: 'cen', war: 0, n: 'Toco de árvore', d: 'Toco serrado com raízes aparentes.', mm: '1 1 0 0',
    build: () => ({ parts: [L(null, 'tabuasCinza', [[0, 500], [260, 500], [280, 420], [300, 120], [460, 0], [0, 0]], [0, 0, 0], { axis: 'z', seg: 12, cell: 'toco' }), C(null, 'madeiraClara', 255, 10, [0, 0, 500], { axis: 'z', seg: 12, cell: 'corte' })] }) },
  { id: 'placa_direcao', cat: 'cen', war: 0, n: 'Placa de direção', d: 'Poste com placas apontando para cidades (escreva com decalques).', mm: '0 8 0 0',
    build: () => ({ parts: [C(null, 'tabuasCinza', 50, 2600, [0, 0, 1300], { axis: 'z', seg: 8 }), ...[[2300, 15, 1], [2050, -20, -1], [1800, 40, 1]].map(([z, a, s]) => E(null, 'branco', [[0, 0], [900, 0], [1000, 90], [900, 180], [0, 180]].map(([y, zz]) => [y * s, zz - 90]), 30, [0, 0, z], { rot: [0, 0, 90 + a], cell: 'placa' }))] }) },
  { id: 'bandeira', cat: 'cen', war: 0, n: 'Mastro com bandeira', d: 'Bandeira em 5 faixas que tremula ao vento (pinte com decalques).', mm: '0 18 0 0', vars: { cor: { n: 'Cor', o: [['vermelho', 'Vermelho'], ['branco', 'Branco'], ['azulRoundel', 'Azul'], ['oliva', 'Verde'], ['amarelo', 'Amarelo']], v: 'vermelho' } },
    build: v => ({ parts: [C(null, 'branco', 40, 5500, [0, 0, 2750], { axis: 'z', seg: 10, cell: 'mastro' }), SP(null, 'latao', [60, 60, 60], [0, 0, 5530]), ...Array.from({ length: 5 }, (_, i) => B('Bandeira' + (i + 1), v.cor, [8, 300, 900], [0, -150 - i * 300, 4950], { cell: 'tecido' }))] }),
    anim: { n: 16, fps: 12, chain: true, pivot: 'maxY', groups: Object.fromEntries([1, 2, 3, 4, 5].map(i => ['Bandeira' + i, f => ({ r: [0, 0, Math.sin((f / 16) * Math.PI * 2 - i * 0.9) * (6 + i * 3)] })])) } },

  // ================================================== SOLDADOS CAÍDOS
  { id: 'soldado_brucos', cat: 'sold', war: 0, n: 'Soldado caído de bruços', d: 'Corpo de bruços com o fuzil ao lado. Escolha pose e uniforme.', mm: '0 1 0 0', vars: soldierVars('brucos', 'us44'), fx: { dirt: 0.5 },
    build: v => ({ parts: [...soldier(v.pose, v.uni), ...rifleProp(TRS([500, 900, 30], [0, 90, 70]))] }) },
  { id: 'soldado_costas', cat: 'sold', war: 0, n: 'Soldado caído de costas', d: 'Corpo de costas, braços abertos, capacete caído ao lado.', mm: '0 1 0 0', vars: soldierVars('costas', 'de44'), fx: { dirt: 0.5 },
    build: v => ({ parts: soldier(v.pose, v.uni, { helmet: false }).concat(xform(helmet(UNIFORMS[v.uni].helm[0], UNIFORMS[v.uni].helm[1]), TRS([-700, -900, 140], [150, 10, 40]))) }) },
  { id: 'soldado_sentado', cat: 'sold', war: 0, n: 'Soldado ferido encostado', d: 'Sentado encostado em parede ou árvore, cabeça baixa.', mm: '1 3 0 0', vars: soldierVars('sentado', 'uk'), fx: { dirt: 0.45 },
    build: v => ({ parts: [...soldier(v.pose, v.uni), ...rifleProp(TRS([-500, 300, 30], [0, 90, 20]))] }) },
  { id: 'soldado_lado', cat: 'sold', war: 0, n: 'Soldado caído de lado', d: 'Encolhido de lado, joelhos dobrados.', mm: '0 1 0 0', vars: soldierVars('lado', 'su'), fx: { dirt: 0.5 },
    build: v => ({ parts: soldier(v.pose, v.uni) }) },
  { id: 'soldado_joelhos', cat: 'sold', war: 0, n: 'Soldado tombado de joelhos', d: 'Caído para a frente sobre os joelhos.', mm: '0 2 0 0', vars: soldierVars('ajoelhado', 'fr16'), fx: { dirt: 0.55 },
    build: v => ({ parts: soldier(v.pose, v.uni) }) },
  { id: 'corpo_coberto', cat: 'sold', war: 0, n: 'Corpo coberto', d: 'Soldado coberto por um poncho, só as botas à mostra.', mm: '0 1 0 0', vars: { cor: { n: 'Poncho', o: [['lonaVerde', 'Verde-oliva'], ['splinter', 'Zeltbahn (splinter)'], ['lona', 'Cáqui'], ['branco', 'Lençol branco']], v: 'lonaVerde' }, uni: { n: 'Botas', o: [['couroMarrom', 'Marrom'], ['couroPreto', 'Pretas']], v: 'couroMarrom' } },
    build: v => ({ parts: [LO(null, v.cor, [{ y: -800, w: 500, ht: 30, hb: 5 }, { y: -650, w: 760, ht: 260, hb: 5 }, { y: 100, w: 820, ht: 230, hb: 5 }, { y: 500, w: 640, ht: 160, hb: 5 }, { y: 820, w: 560, ht: 300, hb: 5 }, { y: 1000, w: 400, ht: 20, hb: 5 }], [0, 0, 0], { seg: 18, cell: 'poncho' }),
      ...[-1, 1].map(s => B(null, v.uni, [110, 120, 280], [s * 140, -930, 140], { bev: 20, rot: [10, s * 15, 0] }))] }) },
  ...BOATS,
];
export function propDef(id) { return PROPS.find(p => p.id === id); }
