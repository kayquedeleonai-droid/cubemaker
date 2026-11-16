// CUBE MAKER — Arsenal em alta fidelidade: modelos refeitos com chanfros, parafusos, miras, gatilhos e
// guarda-mato de verdade, e armas novas da 1ª e 2ª Guerra. Milímetros; origem no eixo do cano acima do gatilho,
// +Y = frente, +Z = cima, +X = direita (lado da janela de ejeção na maioria das armas).
import { B, C, L, E, SP, T, SG, TU, roundRect, circlePts } from './geo.js';

// ---------------------------------------------------------------- peças comuns
// guarda-mato vazado + gatilho curvo (grupo "Gatilho", gira no pino)
export function trig(m, y = 0, z = -14, o = {}) {
  const h = o.h || 24, a = o.back || 34, b = o.front || 30;
  return [
    E(null, m, roundRect(y - a, z - h - 7, y + b, z + 1, 11, 3), 7, [0, 0, 0], { holes: [roundRect(y - a + 5, z - h - 2, y + b - 5, z - 1, 8, 3)], cell: 'guarda' }),
    E('Gatilho', o.tm || m, [[y + 1, z + 2], [y + 7, z + 2], [y + 6, z - h * 0.4], [y + 1, z - h + 6], [y - 4, z - h + 7], [y, z - h * 0.42]], 5, [0, 0, 0], { pivot: [0, y + 4, z + 2], cell: 'gatilho' }),
  ];
}
// parafuso passante (aparece dos dois lados)
const screw = (m, y, z, w, r = 2.6) => C(null, m, r, w + 1.2, [0, y, z], { axis: 'x', seg: 8, cell: 'parafuso' });
// anel/abraçadeira em torno do eixo Y
const band = (m, y, z, R, tube = 3.5, sc = [1, 1, 1]) => T(null, m, R, tube, [0, y, z], { rot: [90, 0, 0], seg: [5, 18], sc, cell: 'bracadeira' });
// massa de mira com túnel (Kar98k, MP40) ou lâmina simples
function frontSight(m, y, z, o = {}) {
  const P = [C('Mira', m, o.r || 8, o.len || 16, [0, y, z], { seg: 12, cell: 'massa' }), B('Mira', m, [2.4, 4, o.post || 11], [0, y + 2, z + (o.r || 8) + (o.post || 11) / 2 - 2], { cell: 'poste' })];
  if (o.hood) P.push(T('Mira', m, o.hood, 2, [0, y, z + (o.r || 8)], { rot: [90, 0, 0], arc: 180, seg: [4, 10], sc: [1, 1.15, 1], cell: 'tunel' }));
  return P;
}
// alça de mira em rampa (fuzis)
function tangentSight(m, y, z, len = 60) {
  return [B('Mira', m, [22, len, 9], [0, y, z + 4], { bev: 2, cell: 'alcabase' }), B('Mira', m, [18, len * 0.8, 3], [0, y + 4, z + 10], { rot: [-4, 0, 0], cell: 'alcafolha' }), B('Mira', m, [20, 6, 9], [0, y - len / 2 + 6, z + 14], { cell: 'alcaentalhe' })];
}
// luneta: tubo, campânulas, torres e anéis
function scope(m, y, z, len, r, o = {}) {
  const x = o.x || 0, P = [
    C('Mira', m, r, len, [x, y, z], { seg: 16, cell: 'tubo' }),
    L('Mira', m, [[0, 0], [r, 0], [r + 1, 6], [r * 1.65, 40], [r * 1.7, 70], [r * 1.6, 74], [0, 74]], [x, y + len / 2 - 6, z], { seg: 18, cell: 'objetiva' }),
    L('Mira', m, [[0, 0], [r * 1.45, 0], [r * 1.5, 6], [r * 1.45, 34], [r, 60], [0, 60]], [x, y - len / 2 - 54, z], { seg: 18, cell: 'ocular' }),
    C('Mira', 'vidro', r * 1.55, 2, [x, y + len / 2 + 69, z], { seg: 16, cell: 'lente' }), C('Mira', 'vidro', r * 1.3, 2, [x, y - len / 2 - 54, z], { seg: 16, cell: 'lente' }),
    C('Mira', m, 7, 14, [x, y + 10, z + r + 6], { axis: 'z', seg: 10, cell: 'torre' }), C('Mira', m, 7, 14, [x + r + 6, y + 10, z], { axis: 'x', seg: 10, cell: 'torre' }),
  ];
  (o.mounts || [-50, 60]).forEach(dy => P.push(T('Mira', m, r + 2, 3, [x, y + dy, z], { rot: [90, 0, 0], seg: [4, 16], cell: 'anel' }), B('Mira', m, [14, 18, z - (o.base || 16)], [x / 2, y + dy, (z + (o.base || 16)) / 2 - r / 2], { bev: 2, cell: 'montagem' })));
  return P;
}
const swivel = (m, y, z) => T(null, m, 9, 2.2, [0, y, z], { rot: [0, 90, 0], seg: [4, 10], cell: 'zarelho' });

// ---------------------------------------------------------------- fuzil de ferrolho (Mauser, Mosin, Enfield, Springfield, Arisaka, Lebel)
export function boltRifleHD(o) {
  const m = o.metal || 'acoOxidado', w = o.wood || 'nogueira', F = o.forend, M = o.muzzle, st = o.stock || 'mauser';
  const grip = st === 'mauser' || st === 'arisaka' ? [[-155, -60], [-115, -70], [-88, -80], [-70, -64], [-52, -38]] : st === 'enfield' ? [[-150, -58], [-110, -66], [-84, -70], [-66, -54], [-50, -36]] : [[-140, -54], [-60, -44], [-48, -36]];
  const P = [
    E(null, w, [[-400, -12], [-404, -70], [-402, -138], [-372, -140], [-250, -100], ...grip, [-30, -36], [60, -38], [100, -30], [F - 30, -24], [F, -18], [F, -6], [120, -8], [110, -12], [-110, -12], [-150, -18], [-200, -16], [-300, -8], [-380, -6]], 34, [0, 0, 0], { bev: 7, bevSeg: 2, cell: 'coronha' }),
    E(null, m, [[-405, -12], [-406, -70], [-404, -139], [-398, -139], [-400, -70], [-399, -12]], 34, [0, 0, 0], { cell: 'soleira' }),
    // caixa da culatra, anéis e cano escalonado
    C(null, m, 14.5, 230, [0, 0, 0], { seg: 16, cell: 'caixa' }), C(null, m, 16.5, 36, [0, 98, 0], { seg: 16, cell: 'anel' }), C(null, m, 16, 28, [0, -100, 0], { seg: 16, cell: 'ponte' }),
    C('Cano', m, 10.5, 200, [0, 216, 0], { r2: 9.5, seg: 14, cell: 'cano1' }), C('Cano', m, 9.3, M - 316, [0, (M + 316) / 2, 0], { r2: 8.2, seg: 14, cell: 'cano2' }),
    // ferrolho
    C('Ferrolho', 'acoGasto', 9, 170, [0, -60, 6], { seg: 12, cell: 'corpo' }),
    L('Ferrolho', m, [[0, 0], [11, 0], [12, 6], [9, 30], [0, 34]], [0, -184, 6], { seg: 12, cell: 'cao' }),
    B('Ferrolho', m, [4, 10, 20], [0, -170, 20], { cell: 'trava' }),
    // ponteira, massa, alça
    B(null, m, [24, 42, 26], [0, F + 8, -8], { bev: 3, cell: 'ponteira' }), B(null, m, [10, 26, 10], [0, F + 14, -24], { cell: 'baioneta' }),
    ...frontSight(m, M - 16, 0, { r: 9.5, len: 18, post: 10, hood: o.hood ? 13 : 0 }),
    ...tangentSight(m, 150, 10, 64),
    // guarda-mato, espelho do carregador, vareta
    B(null, m, [24, 120, 5], [0, 14, -38], { bev: 1.5, cell: 'espelho' }), ...trig(m, 0, -40, { h: 22, back: 38, front: 34 }),
    C(null, 'acoGasto', 3, F - 120, [0, F / 2 + 70, -17], { seg: 6, cell: 'vareta' }), C(null, 'acoGasto', 4, 10, [0, M - 40, -17], { seg: 6, cell: 'vareta' }),
    swivel(m, -320, -132), swivel(m, F - 60, -32),
    screw(m, 70, -30, 34), screw(m, -60, -30, 34),
  ];
  if (o.handguard) P.push(B(null, w, [22, o.handguard, 13], [0, F - o.handguard / 2 - 6, 11], { bev: 5, cell: 'guardamao' }));
  (o.bands || []).forEach(y => P.push(band(m, y, -6, 18, 3.5, [1.12, 1, 1.2]), swivel(m, y, -30)));
  if (st === 'mauser') P.push(C(null, m, 14, 36, [0, -300, -62], { axis: 'x', seg: 14, cell: 'disco' }));
  if (o.dustCover) P.push(B(null, m, [26, 120, 6], [0, -20, 16], { bev: 2, cell: 'tampa' }));
  // alavanca
  const gB = { pivot: [0, -40, 6] };
  if (o.bolt === 'down') P.push(SG('Ferrolho', 'acoGasto', [8, -42, 6], [34, -58, -18], 4, { seg: 8, ...gB }), SP('Ferrolho', 'acoGasto', [8.5, 8.5, 8.5], [37, -60, -22], { ...gB, seg: [10, 8] }));
  else if (o.bolt === 'straight') P.push(SG('Ferrolho', 'acoGasto', [8, -10, 6], [46, -10, 4], 4, { seg: 8, ...gB }), SP('Ferrolho', 'acoGasto', [8, 8, 8], [50, -10, 4], { ...gB, seg: [10, 8] }));
  else P.push(SG('Ferrolho', 'acoGasto', [8, -88, 6], [36, -96, -12], 4, { seg: 8, ...gB }), SP('Ferrolho', 'acoGasto', [7, 9, 7], [40, -98, -16], { ...gB, seg: [10, 8] }));
  if (o.mag === 'box') P.push(B('Carregador', m, [22, 64, 66], [0, 40, -66], { bev: 3 }));
  if (o.tube) P.push(C(null, m, 7, F - 100, [0, F / 2 + 30, -22], { seg: 10, cell: 'tubo' }));
  if (o.scope === 'zf39') P.push(...scope('acoPreto', 0, 52, 210, 13));
  else if (o.scope === 'pu') P.push(...scope('acoPreto', -10, 48, 150, 11, { x: 12 }));
  else if (o.scope === 'm73') P.push(...scope('acoPreto', -10, 44, 300, 9.5, { mounts: [-90, 90] }));
  else if (o.scope === 'no32') P.push(...scope('acoPreto', 10, 52, 160, 13, { mounts: [-40, 50] }));
  return { parts: P, muzzle: M, support: [0, Math.min(F - 60, 260), -40], port: [16, 20, 8] };
}

// ---------------------------------------------------------------- semiautomáticos (Garand, Carbine, G43, SVT-40, SMLE)
export function semiRifleHD(o) {
  const m = o.metal || 'parkCinza', w = o.wood || 'madeiraClara', F = o.forend, M = o.muzzle, ml = o.magLen || 0;
  const P = [
    E(null, w, [[-360, -12], [-362, -128], [-330, -130], [-200, -88], [-130, -62], [-96, -70], [-70, -62], [-48, -34], [F - 30, -28], [F, -20], [F, -8], [100, -12], [-120, -14], [-170, -18], [-300, -6]], 32, [0, 0, 0], { bev: 7, bevSeg: 2, cell: 'coronha' }),
    E(null, m, [[-364, -12], [-366, -128], [-358, -128], [-358, -12]], 32, [0, 0, 0], { cell: 'soleira' }),
    B(null, m, [26, 230, 30], [0, 26, -2], { bev: 4, cell: 'caixa' }),
    C('Cano', m, 9.5, M - 140, [0, (M + 140) / 2, 0], { r2: 8.2, seg: 14, cell: 'cano' }),
    B(null, w, [22, F - 130, 13], [0, (F + 130) / 2, 13], { bev: 5, cell: 'guardamao' }),
    band(m, F - 22, -6, 17, 3.5, [1.15, 1, 1.25]), band(m, (F + 130) / 2, -2, 17, 3, [1.15, 1, 1.25]),
    ...frontSight(m, M - 14, 0, { r: 9, len: 16, post: 11, hood: o.hood ? 12 : 0 }),
    B('Mira', m, [20, 22, 18], [0, -66, 18], { bev: 3, cell: 'alca' }), C('Mira', m, 5, 22, [0, -66, 26], { axis: 'x', seg: 8, cell: 'tambor' }),
    B('Ferrolho', 'acoGasto', [8, 42, 11], [o.boltLeft ? -17 : 17, 52, 4], { bev: 2 }),
    ...trig(m, 0, -34, { h: 22, back: 36, front: 30 }), swivel(m, -300, -122), swivel(m, F - 40, -30), screw(m, -20, -28, 32),
  ];
  if (ml) P.push(B('Carregador', m, [20, 52, ml], [0, 46, -36 - ml / 2], { bev: 2.5 }), B(null, m, [22, 56, 6], [0, 46, -38 - ml], { bev: 1.5, cell: 'base' }));
  if (o.enbloc) P.push(B('Carregador', 'latao', [14, 46, 8], [0, 30, 14], { cell: 'clipe' }));
  if (o.gasTube) P.push(C(null, m, 6, F - 80, [0, (F + 80) / 2, 20], { seg: 10, cell: 'gas' }));
  if (o.gasCyl) P.push(C(null, m, 14, 70, [0, M - 50, -14], { seg: 14, cell: 'gasCil' }), B(null, m, [24, 30, 30], [0, M - 40, -8], { bev: 3, cell: 'gasBloco' }));
  if (o.brake) P.push(L(null, m, [[0, 0], [13, 0], [13, 40], [0, 40]], [0, M - 40, 0], { seg: 12, cell: 'freio' }), ...[0, 1, 2, 3, 4, 5].map(i => B(null, 'acoPreto', [28, 3, 8], [0, M - 34 + i * 6, 0], { cell: 'fenda' })));
  if (o.perf) P.push(...Array.from({ length: 5 }, (_, i) => B(null, 'acoPreto', [24, 14, 6], [0, 200 + i * 40, 20], { cell: 'janela' })));
  if (o.noseCap) P.push(B(null, m, [26, 50, 30], [0, M - 25, -4], { bev: 4, cell: 'narigao' }), B('Mira', m, [16, 10, 22], [0, M - 10, 12], { cell: 'orelhas' }));
  return { parts: P, muzzle: M, support: [0, Math.min(F - 60, 220), -36], port: [16, 30, 8] };
}

// ---------------------------------------------------------------- revólveres (Webley, Nagant)
export function revolverHD(o) {
  const m = o.metal || 'acoOxidado', Lb = o.barrel, g = o.grip || 'baquelite';
  const P = [
    E(null, m, [[-48, -14], [-40, 20], [36, 20], [38, 6], [44, -10], [26, -24], [-20, -28]], 20, [0, 0, 0], { bev: 2, holes: [roundRect(-26, -16, 24, 14, 4, 2)], cell: 'armacao' }),
    C('Tambor', m, 20, 44, [0, 0, -1], { seg: 18, cell: 'tambor' }),
    ...Array.from({ length: o.flutes || 6 }, (_, i) => { const a = i / (o.flutes || 6) * Math.PI * 2; return B('Tambor', 'acoPreto', [3, 30, 6], [Math.cos(a) * 19, 0, -1 + Math.sin(a) * 19], { rot: [0, -a * 180 / Math.PI, 0], cell: 'canelura' }); }),
    C('Cano', m, o.r || 7.5, Lb, [0, 38 + Lb / 2, 6], { seg: 14, cell: 'cano' }),
    B('Cano', m, [8, Lb, 6], [0, 38 + Lb / 2, 14], { cell: 'nervura' }),
    C(null, m, 4, Lb - 24, [0, 40 + (Lb - 24) / 2, -8], { seg: 8, cell: 'vareta' }),
    B('Mira', m, [3, 8, 9], [0, 34 + Lb, 18], { cell: 'mira' }),
    E(null, g, [[-46, -12], [-16, -20], [-26, -60], [-36, -96], [-70, -94], [-66, -40]], 30, [0, 0, 0], { bev: 4, bevSeg: 2, cell: 'cabo' }),
    E(null, m, [[-36, -96], [-70, -94], [-70, -100], [-36, -102]], 30, [0, 0, 0], { cell: 'base' }), screw(m, -44, -56, 30),
    E('Ferrolho', m, [[-44, 4], [-30, 4], [-38, 22], [-58, 34], [-62, 30], [-48, 16]], 8, [0, 0, 0], { pivot: [0, -36, -2], cell: 'cao' }),
    ...trig(m, -6, -24, { h: 20, back: 24, front: 24 }),
  ];
  if (o.ring) P.push(T(null, 'acoGasto', 7, 1.6, [0, -60, -106], { rot: [0, 90, 0], seg: [4, 12], cell: 'argola' }));
  if (o.webley) P.push(B(null, m, [22, 14, 12], [0, -38, 24], { bev: 2, cell: 'trava' }), B(null, m, [10, 10, 14], [-12, -30, 18], { cell: 'trava2' }));
  return { parts: P, muzzle: 38 + Lb, support: null, port: null };
}

// ---------------------------------------------------------------- modelos refeitos (por id do arsenal)
export const HD = {
  mp40: () => ({ parts: [
    C(null, 'acoOxidado', 17, 300, [0, 20, 0], { seg: 18, cell: 'caixa' }),
    ...[60, 100, 140].map(y => B(null, 'acoPreto', [36, 22, 3], [0, y, 0], { cell: 'friso' })),
    L(null, 'acoOxidado', [[0, 0], [17, 0], [18, -10], [14, -18], [0, -20]], [0, -130, 0], { seg: 16, cell: 'tampa' }),
    C(null, 'acoOxidado', 19, 26, [0, 182, 0], { seg: 16, cell: 'porca' }),
    C('Cano', 'acoOxidado', 10, 230, [0, 310, 0], { r2: 9, seg: 14, cell: 'cano' }), L('Cano', 'acoOxidado', [[0, 0], [10, 0], [11, 4], [11, 14], [0, 14]], [0, 425, 0], { seg: 14, cell: 'boca' }),
    E(null, 'acoOxidado', [[250, -10], [262, -10], [262, -28], [230, -28], [230, -20], [250, -20]], 14, [0, 0, 0], { cell: 'apoio' }),
    ...frontSight('acoOxidado', 420, 0, { r: 10, len: 14, post: 9, hood: 14 }),
    E(null, 'baquelite', [[-120, -14], [160, -14], [170, -24], [100, -34], [-30, -34], [-120, -26]], 30, [0, 0, 0], { bev: 3, cell: 'chassi' }),
    E(null, 'baquelite', [[-40, -30], [0, -30], [-6, -80], [-12, -118], [-50, -122], [-52, -100], [-40, -60]], 30, [0, 0, 0], { bev: 5, bevSeg: 2, cell: 'punho' }),
    ...Array.from({ length: 6 }, (_, i) => B(null, 'baquelite', [32, 3, 30], [0, -22 - i * 1.2, -60 - i * 9], { rot: [-8, 0, 0], cell: 'estria' })),
    screw('acoOxidado', -24, -42, 30),
    B(null, 'acoOxidado', [28, 52, 64], [0, 96, -44], { bev: 3, cell: 'poco' }), B(null, 'acoOxidado', [30, 20, 10], [0, 96, -14], { cell: 'trava' }),
    B('Carregador', 'acoOxidado', [22, 34, 246], [0, 96, -178], { bev: 2.5 }), ...[0, 1, 2, 3].map(i => B('Carregador', 'acoOxidado', [23, 8, 30], [0, 96, -120 - i * 38], { cell: 'nervurapente' })),
    B('Carregador', 'acoOxidado', [24, 38, 6], [0, 96, -302], { bev: 1.5, cell: 'basepente' }),
    // coronha rebatida embaixo
    SG(null, 'acoOxidado', [-12, -110, -26], [-12, 190, -40], 4.5, { seg: 8, cell: 'haste' }), SG(null, 'acoOxidado', [12, -110, -26], [12, 190, -40], 4.5, { seg: 8, cell: 'haste' }),
    E(null, 'acoOxidado', [[180, -32], [200, -32], [204, -86], [184, -88]], 44, [0, 0, 0], { bev: 2, cell: 'soleira' }),
    C(null, 'acoGasto', 7, 34, [0, -116, -24], { axis: 'x', seg: 10, cell: 'articulacao' }),
    // alavanca de manejo (lado esquerdo), alça
    C('Ferrolho', 'acoGasto', 5, 24, [-26, 40, 4], { axis: 'x', seg: 8 }), SP('Ferrolho', 'acoGasto', [6, 8, 6], [-40, 40, 4], { seg: [10, 8] }),
    B(null, 'acoPreto', [3, 50, 10], [-17.5, 40, 4], { cell: 'trilho' }), B(null, 'acoPreto', [3, 40, 12], [17.2, 46, 6], { cell: 'janela' }),
    B('Mira', 'acoOxidado', [16, 24, 12], [0, -60, 20], { bev: 2, cell: 'alca' }), B('Mira', 'acoOxidado', [3, 14, 10], [-8, -60, 30], { cell: 'orelha' }), B('Mira', 'acoOxidado', [3, 14, 10], [8, -60, 30], { cell: 'orelha' }),
    ...trig('acoOxidado', 0, -34, { h: 22, back: 30, front: 28 }), swivel('acoOxidado', -100, -28),
  ], muzzle: 439, support: [-6, 96, -70], port: [18, 46, 6] }),

  thompson: () => ({ parts: [
    B(null, 'parkCinza', [30, 270, 36], [0, 20, 4], { bev: 4, cell: 'caixa' }), B(null, 'parkCinza', [26, 200, 22], [0, 10, -22], { bev: 3, cell: 'armacao' }),
    C('Cano', 'parkCinza', 9, 270, [0, 285, 4], { seg: 14, cell: 'cano' }),
    ...Array.from({ length: 12 }, (_, i) => C(null, 'parkCinza', 15, 3, [0, 168 + i * 9, 4], { seg: 16, cell: 'aletas' })),
    L(null, 'parkCinza', [[0, 0], [11, 0], [12, 2], [12, 52], [0, 52]], [0, 410, 4], { seg: 14, cell: 'compensador' }), ...[0, 1, 2].map(i => B(null, 'acoPreto', [10, 5, 6], [0, 425 + i * 10, 15], { cell: 'fendacomp' })),
    E(null, 'nogueira', [[-115, -2], [-115, 18], [-150, 10], [-310, -12], [-330, -14], [-330, -118], [-300, -120], [-160, -52], [-130, -36]], 36, [0, 0, 0], { bev: 7, bevSeg: 2, cell: 'coronha' }),
    E(null, 'parkCinza', [[-334, -14], [-336, -118], [-330, -118], [-330, -14]], 36, [0, 0, 0], { cell: 'soleira' }), screw('parkCinza', -320, -30, 36), screw('parkCinza', -320, -100, 36),
    E(null, 'nogueira', [[-60, -30], [-20, -30], [-28, -76], [-34, -118], [-74, -120], [-72, -90], [-62, -58]], 30, [0, 0, 0], { bev: 5, bevSeg: 2, cell: 'punho' }),
    E(null, 'nogueira', [[132, -14], [172, -14], [166, -50], [176, -60], [168, -76], [174, -90], [166, -110], [130, -110], [126, -70]], 30, [0, 0, 0], { bev: 5, bevSeg: 2, cell: 'punhof' }),
    B(null, 'parkCinza', [16, 30, 10], [0, 152, -10], { cell: 'presilha' }),
    C('Carregador', 'parkCinza', 70, 44, [0, 70, -96], { axis: 'x', seg: 28 }), C('Carregador', 'parkCinza', 30, 50, [0, 70, -96], { axis: 'x', seg: 18, cell: 'cubo' }),
    T('Carregador', 'parkCinza', 70, 3, [0, 70, -96], { rot: [0, 90, 0], seg: [4, 28], cell: 'aro' }), B('Carregador', 'acoGasto', [6, 40, 10], [24, 70, -96], { cell: 'chave' }),
    B('Ferrolho', 'acoGasto', [10, 18, 16], [0, 40, 28], { bev: 2 }), SP('Ferrolho', 'acoGasto', [8, 8, 7], [0, 46, 36], { seg: [10, 8] }),
    B('Mira', 'parkCinza', [18, 30, 22], [0, -80, 30], { bev: 2, cell: 'lyman' }), B('Mira', 'parkCinza', [6, 26, 30], [-9, -80, 40], { cell: 'lyman2' }), B('Mira', 'parkCinza', [6, 26, 30], [9, -80, 40], { cell: 'lyman2' }),
    B('Mira', 'parkCinza', [3, 8, 14], [0, 418, 22], { cell: 'poste' }),
    B(null, 'acoGasto', [3, 16, 8], [-16, -20, -14], { rot: [0, 0, 0], cell: 'seletor' }), B(null, 'acoGasto', [3, 16, 8], [-16, 6, -14], { cell: 'seletor' }), screw('parkCinza', -40, -16, 26),
    ...trig('parkCinza', 0, -34, { h: 22, back: 30, front: 28 }), swivel('parkCinza', -250, -110),
  ], muzzle: 462, support: [0, 150, -70], port: [18, 30, 10] }),

  ppsh41: () => ({ parts: [
    E(null, 'madeiraClara', [[-110, -10], [-110, 14], [-320, -8], [-340, -10], [-340, -116], [-310, -118], [-140, -56], [-80, -48], [-40, -40], [130, -32], [140, -16], [-20, -18]], 34, [0, 0, 0], { bev: 7, bevSeg: 2, cell: 'coronha' }),
    E(null, 'acoPreto', [[-344, -10], [-345, -116], [-338, -116], [-338, -10]], 34, [0, 0, 0], { cell: 'soleira' }),
    C(null, 'acoPreto', 17, 220, [0, 10, 2], { seg: 16, cell: 'caixa' }), B(null, 'acoPreto', [30, 140, 16], [0, 20, -12], { bev: 2, cell: 'armacao' }),
    C(null, 'perfurado', 18, 230, [0, 236, 2], { seg: 18, cell: 'camisa' }), C('Cano', 'acoPreto', 7, 30, [0, 352, 2], { seg: 10 }),
    E(null, 'acoPreto', [[340, -16], [372, -6], [372, 22], [340, 22]], 36, [0, 0, 0], { rot: [0, 0, 0], cell: 'freio', holes: [[[350, -4], [364, -4], [364, 12], [350, 12]]] }),
    C('Carregador', 'acoPreto', 64, 46, [0, 70, -84], { axis: 'x', seg: 28 }), T('Carregador', 'acoPreto', 64, 3, [0, 70, -84], { rot: [0, 90, 0], seg: [4, 28], cell: 'aro' }), C('Carregador', 'acoGasto', 18, 50, [0, 70, -84], { axis: 'x', seg: 12, cell: 'cubo' }),
    B('Carregador', 'acoPreto', [26, 40, 30], [0, 70, -24], { bev: 2, cell: 'pescoco' }),
    C('Ferrolho', 'acoGasto', 5, 22, [22, 0, 4], { axis: 'x', seg: 8 }), SP('Ferrolho', 'acoGasto', [6, 6, 6], [34, 0, 4], { seg: [8, 6] }),
    B('Mira', 'acoPreto', [20, 30, 14], [0, 120, 20], { bev: 2, cell: 'alca' }), ...frontSight('acoPreto', 336, 2, { r: 6, len: 10, post: 14, hood: 12 }),
    B(null, 'acoGasto', [3, 14, 10], [0, 30, -26], { cell: 'seletor' }), ...trig('acoPreto', 0, -32, { h: 22, back: 30, front: 28 }),
  ], muzzle: 372, support: [0, 150, -40], port: [17, 30, 8] }),

  stg44: () => ({ parts: [
    B(null, 'acoOxidado', [30, 300, 40], [0, 30, -2], { bev: 4, cell: 'caixa' }), ...[0, 1, 2, 3, 4].map(i => B(null, 'acoOxidado', [31, 6, 6], [0, -70 + i * 50, 14], { cell: 'friso' })),
    C(null, 'acoOxidado', 11, 210, [0, 290, 16], { seg: 14, cell: 'gas' }), B(null, 'nogueira', [24, 120, 20], [0, 250, 6], { bev: 5, cell: 'guardamao' }),
    C('Cano', 'acoOxidado', 9, 300, [0, 330, -4], { r2: 8, seg: 14, cell: 'cano' }), L('Cano', 'acoOxidado', [[0, 0], [11, 0], [11, 26], [0, 26]], [0, 470, -4], { seg: 12, cell: 'rosca' }),
    B(null, 'acoOxidado', [22, 26, 34], [0, 400, 4], { bev: 3, cell: 'bloco' }), ...frontSight('acoOxidado', 455, 4, { r: 8, len: 12, post: 12, hood: 12 }),
    E('Carregador', 'acoOxidado', [[70, -22], [124, -22], [150, -100], [182, -200], [196, -244], [146, -258], [130, -214], [104, -120]], 24, [0, 0, 0], { bev: 2.5 }),
    ...[0, 1, 2].map(i => B('Carregador', 'acoOxidado', [25, 6, 30], [0, 120 + i * 22, -90 - i * 44], { rot: [-20, 0, 0], cell: 'nervurapente' })),
    E(null, 'baquelite', [[-60, -22], [-20, -22], [-30, -70], [-36, -118], [-76, -118], [-76, -90], [-66, -50]], 30, [0, 0, 0], { bev: 5, bevSeg: 2, cell: 'punho' }),
    E(null, 'nogueira', [[-120, -6], [-120, 18], [-360, -12], [-360, -116], [-320, -120], [-150, -48]], 36, [0, 0, 0], { bev: 7, bevSeg: 2, cell: 'coronha' }),
    E(null, 'acoOxidado', [[-364, -12], [-364, -116], [-356, -116], [-356, -12]], 36, [0, 0, 0], { cell: 'soleira' }),
    B('Mira', 'acoOxidado', [18, 60, 10], [0, 70, 22], { bev: 2, cell: 'alca' }), B('Mira', 'acoOxidado', [14, 40, 3], [0, 74, 28], { rot: [-4, 0, 0], cell: 'folha' }),
    C('Ferrolho', 'acoGasto', 4, 26, [-28, 160, 16], { axis: 'x', seg: 8 }), SP('Ferrolho', 'acoGasto', [6, 6, 6], [-42, 160, 16], { seg: [8, 6] }),
    B(null, 'acoPreto', [3, 50, 14], [15.6, 40, 2], { cell: 'janela' }), screw('acoOxidado', -100, -10, 30), screw('acoOxidado', 30, -14, 30),
    ...trig('acoOxidado', 0, -24, { h: 22, back: 30, front: 30 }), swivel('acoOxidado', 380, -18),
  ], muzzle: 496, support: [0, 140, -70], port: [18, 50, 6] }),

  luger: () => ({ parts: [
    E(null, 'acoOxidado', [[-86, -10], [-30, -10], [40, -12], [56, -4], [56, 10], [-86, 10]], 20, [0, 0, 0], { bev: 2.5, cell: 'armacao' }),
    C('Cano', 'acoOxidado', 7.5, 100, [0, 102, 2], { r2: 6.5, seg: 14, cell: 'cano' }), C(null, 'acoOxidado', 10, 30, [0, 66, 2], { seg: 14, cell: 'base' }),
    ...frontSight('acoOxidado', 146, 2, { r: 6.5, len: 8, post: 8 }),
    B('Ferrolho', 'acoOxidado', [16, 40, 10], [0, -10, 14], { bev: 2, pivot: [0, 10, 12] }), B('Ferrolho', 'acoOxidado', [16, 34, 10], [0, -48, 14], { bev: 2, pivot: [0, 10, 12] }),
    ...[-1, 1].map(s => C('Ferrolho', 'recartilhado', 8, 10, [s * 13, -30, 14], { axis: 'x', seg: 14, pivot: [0, 10, 12], cell: 'botao' })),
    B('Mira', 'acoOxidado', [6, 8, 8], [0, -66, 20], { cell: 'alca' }),
    E(null, 'acoOxidado', [[-66, -8], [-22, -8], [-30, -34], [-50, -92], [-60, -104], [-92, -98], [-94, -86], [-80, -50], [-76, -24]], 24, [0, 0, 0], { bev: 3, round: 10, cell: 'cabo' }),
    E(null, 'quadriculado', [[-62, -18], [-30, -18], [-38, -38], [-54, -86], [-62, -94], [-84, -90], [-74, -50], [-70, -28]], 27, [0, 0, 0], { bev: 2, round: 8, cell: 'talas' }), screw('acoGasto', -56, -56, 28),
    B('Carregador', 'nogueira', [18, 34, 12], [0, -76, -106], { rot: [32, 0, 0], bev: 4 }),
    B(null, 'acoGasto', [3, 16, 8], [-12, -54, -6], { cell: 'trava' }),
    ...trig('acoOxidado', 0, -10, { h: 18, back: 22, front: 24 }),
  ], muzzle: 152, support: null, port: [8, -20, 14] }),

  colt1911: () => ({ parts: [
    B('Ferrolho', 'parkCinza', [22, 216, 26], [0, 56, 4], { bev: 2.5 }), ...Array.from({ length: 8 }, (_, i) => B('Ferrolho', 'acoPreto', [23, 2, 18], [0, -42 + i * 4.5, 4], { cell: 'serrilha' })),
    B('Ferrolho', 'acoPreto', [3, 42, 12], [11.2, 40, 6], { cell: 'janela' }),
    C('Cano', 'acoPreto', 7, 10, [0, 165, 4], { seg: 12, cell: 'boca' }), C(null, 'parkCinza', 10, 8, [0, 160, 4], { seg: 12, cell: 'bucha' }),
    E(null, 'parkCinza', [[-60, -9], [120, -9], [120, -22], [40, -24], [10, -28], [-60, -28]], 20, [0, 0, 0], { bev: 2, cell: 'armacao' }),
    E(null, 'parkCinza', [[-68, -22], [-22, -22], [-28, -50], [-38, -114], [-44, -120], [-84, -118], [-88, -110], [-80, -60]], 26, [0, 0, 0], { bev: 2.5, round: 7, cell: 'cabo' }),
    E(null, 'quadriculado', [[-62, -32], [-30, -32], [-36, -60], [-44, -106], [-78, -104], [-74, -60]], 29, [0, 0, 0], { bev: 2, round: 7, cell: 'talas' }), screw('acoGasto', -48, -42, 30), screw('acoGasto', -60, -94, 30),
    E(null, 'parkCinza', [[-58, -8], [-74, -16], [-80, -40], [-66, -38], [-60, -22]], 18, [0, 0, 0], { cell: 'grip' }),
    B('Carregador', 'parkCinza', [16, 32, 10], [0, -62, -120], { rot: [12, 0, 0], bev: 2 }),
    E('Ferrolho', 'parkCinza', [[-56, 6], [-48, 6], [-54, 20], [-72, 24], [-72, 18], [-60, 14]], 10, [0, 0, 0], { pivot: [0, -52, 4], cell: 'cao' }),
    B(null, 'acoGasto', [3, 22, 6], [-11.5, -30, -6], { cell: 'trava' }), C(null, 'acoGasto', 3, 24, [0, 64, -14], { axis: 'x', seg: 8, cell: 'pino' }),
    B('Mira', 'parkCinza', [4, 8, 8], [0, 150, 20]), B('Mira', 'parkCinza', [16, 8, 7], [0, -40, 20], { cell: 'alca' }),
    ...trig('parkCinza', -4, -24, { h: 18, back: 22, front: 26 }),
  ], muzzle: 170, support: null, port: [12, 40, 10] }),

  p38: () => ({ parts: [
    B('Ferrolho', 'acoOxidado', [22, 136, 22], [0, 12, 4], { bev: 2.5 }), ...Array.from({ length: 7 }, (_, i) => B('Ferrolho', 'acoPreto', [23, 2, 16], [0, -42 + i * 4.5, 4], { cell: 'serrilha' })),
    C('Cano', 'acoOxidado', 8, 74, [0, 112, 6], { seg: 14, cell: 'cano' }), ...frontSight('acoOxidado', 140, 6, { r: 7, len: 8, post: 8 }),
    E(null, 'acoOxidado', [[-54, -7], [100, -7], [100, -20], [20, -26], [-54, -26]], 20, [0, 0, 0], { bev: 2, cell: 'armacao' }),
    E(null, 'acoOxidado', [[-60, -22], [-22, -22], [-36, -112], [-76, -110]], 24, [0, 0, 0], { bev: 2.5, cell: 'cabo' }),
    E(null, 'baquelite', [[-56, -28], [-28, -28], [-40, -102], [-70, -100]], 28, [0, 0, 0], { bev: 2, cell: 'talas' }), ...Array.from({ length: 7 }, (_, i) => B(null, 'baquelite', [29, 2.5, 26], [0, -45 - i * 1.6, -40 - i * 9], { rot: [-10, 0, 0], cell: 'estria' })),
    B('Carregador', 'acoOxidado', [16, 32, 10], [0, -58, -116], { rot: [12, 0, 0], bev: 2 }),
    E('Ferrolho', 'acoOxidado', [[-52, 8], [-46, 8], [-50, 20], [-66, 22], [-64, 16]], 10, [0, 0, 0], { pivot: [0, -50, 4], cell: 'cao' }),
    C(null, 'acoGasto', 4, 26, [0, -36, 10], { axis: 'x', seg: 8, cell: 'trava' }), B('Mira', 'acoOxidado', [14, 8, 6], [0, -42, 18], { cell: 'alca' }),
    ...trig('acoOxidado', -2, -22, { h: 18, back: 22, front: 28 }), T(null, 'acoGasto', 6, 1.5, [0, -66, -112], { rot: [0, 90, 0], seg: [4, 10] }),
  ], muzzle: 150, support: null, port: [12, 10, 10] }),
};
// família (mesmas opções das definições originais)
export const HD_FAMILY = {
  kar98k: () => boltRifleHD({ wood: 'faia', forend: 470, muzzle: 740, bolt: 'down', handguard: 200, bands: [330, 430], scope: 'zf39', hood: true }),
  gewehr98: () => boltRifleHD({ wood: 'nogueira', forend: 620, muzzle: 860, bolt: 'straight', handguard: 300, bands: [420, 580] }),
  mosin: () => boltRifleHD({ wood: 'madeiraClara', forend: 520, muzzle: 790, bolt: 'straight', handguard: 240, bands: [360, 480], scope: 'pu', stock: 'mosin', hood: true }),
  springfield: () => boltRifleHD({ wood: 'nogueira', metal: 'parkCinza', forend: 500, muzzle: 770, bolt: 'down', handguard: 220, bands: [350, 470], scope: 'm73', stock: 'springfield' }),
  enfield4: () => boltRifleHD({ wood: 'faia', metal: 'acoPreto', forend: 460, muzzle: 720, bolt: 'enfield', handguard: 250, bands: [300, 440], mag: 'box', scope: 'no32', stock: 'enfield' }),
  smle: () => boltRifleHD({ wood: 'nogueira', metal: 'acoPreto', forend: 640, muzzle: 680, bolt: 'enfield', handguard: 360, bands: [380, 560], mag: 'box', stock: 'enfield' }),
  m1carbine: () => semiRifleHD({ forend: 330, muzzle: 470, magLen: 60 }),
  garand: () => semiRifleHD({ forend: 520, muzzle: 760, wood: 'nogueira', gasCyl: true, enbloc: true }),
  g43: () => semiRifleHD({ forend: 480, muzzle: 700, magLen: 70, wood: 'laminado', metal: 'acoOxidado', boltLeft: true, gasTube: true, hood: true }),
  svt40: () => semiRifleHD({ forend: 420, muzzle: 690, magLen: 64, wood: 'madeiraClara', metal: 'acoPreto', brake: true, gasTube: true, perf: true, hood: true }),
  webley: () => revolverHD({ barrel: 150, grip: 'baquelite', ring: true, webley: true }),
  nagant: () => revolverHD({ barrel: 115, r: 7, grip: 'nogueira', ring: true, flutes: 7 }),
};

// ---------------------------------------------------------------- armas novas
export const NEW_WEAPONS = [
  { id: 'mg42', slot: 'assault', war: 2, c: 'Alemanha', n: 'MG 42', d: 'A "serra de Hitler": camisa perfurada, cofre de fita e bipé — 1.200 tiros por minuto.', fx: { cavity: 0.5, scratches: 0.3 },
    build: () => ({ parts: [
      B(null, 'acoPreto', [40, 330, 54], [0, 40, 0], { bev: 4, cell: 'caixa' }), B(null, 'acoPreto', [44, 120, 18], [0, 70, 34], { bev: 3, cell: 'tampa' }),
      E(null, 'perfurado', [[210, -26], [520, -22], [520, 24], [210, 30]], 40, [0, 0, 0], { bev: 3, cell: 'camisa' }),
      ...[0, 1, 2, 3, 4, 5, 6].map(i => B(null, 'acoPreto', [44, 10, 8], [0, 240 + i * 40, 28], { cell: 'friso' })),
      B(null, 'acoPreto', [24, 50, 20], [-30, 300, 0], { bev: 3, cell: 'trava' }),
      C('Cano', 'acoPreto', 9, 120, [0, 560, 0], { seg: 12 }), L('Cano', 'acoPreto', [[0, 0], [20, 0], [24, 10], [24, 50], [16, 60], [0, 60]], [0, 600, 0], { seg: 14, cell: 'quebrachama' }),
      ...frontSight('acoPreto', 500, 30, { r: 4, len: 10, post: 22 }),
      SG(null, 'acoPreto', [6, 470, -20], [40, 640, -150], 6, { seg: 8, cell: 'bipe' }), SG(null, 'acoPreto', [-6, 470, -20], [-40, 640, -150], 6, { seg: 8, cell: 'bipe' }),
      E(null, 'baquelite', [[-130, -10], [-130, 20], [-170, 22], [-380, -12], [-380, -96], [-340, -100], [-170, -50]], 40, [0, 0, 0], { bev: 6, bevSeg: 2, cell: 'coronha' }),
      E(null, 'baquelite', [[-60, -28], [-20, -28], [-30, -76], [-36, -124], [-76, -124], [-76, -96], [-66, -56]], 30, [0, 0, 0], { bev: 5, bevSeg: 2, cell: 'punho' }),
      B('Carregador', 'feldgrau', [90, 120, 120], [-80, 60, -100], { bev: 6, cell: 'cofre' }), TU('Carregador', 'latao', [[-40, 60, -40], [-20, 60, -14], [0, 60, -6]], 10, { rs: 4, cell: 'fita' }),
      ...Array.from({ length: 6 }, (_, i) => C('Carregador', 'latao', 4.5, 30, [-40 + i * 4, 60, -40 + i * 6], { axis: 'y', rot: [0, 0, 0], seg: 8, cell: 'cartucho' })),
      C('Ferrolho', 'acoGasto', 5, 34, [26, 80, 0], { axis: 'x', seg: 8 }), SP('Ferrolho', 'acoGasto', [7, 7, 7], [44, 80, 0], { seg: [8, 6] }),
      B('Mira', 'acoPreto', [20, 40, 14], [0, 100, 46], { bev: 2, cell: 'alca' }), ...trig('acoPreto', 0, -28, { h: 24, back: 32, front: 30 }),
    ], muzzle: 660, support: [0, 260, -40], port: [24, 40, -20] }) },
  { id: 'lewis', slot: 'assault', war: 1, c: 'Reino Unido', n: 'Metralhadora Lewis', d: 'Camisa de arrefecimento grossa e prato de 47 cartuchos em cima — Grande Guerra.', fx: { cavity: 0.5, scratches: 0.35, rust: 0.15 },
    build: () => ({ parts: [
      B(null, 'acoPreto', [36, 260, 46], [0, 20, -4], { bev: 4, cell: 'caixa' }),
      C(null, 'parkVerde', 40, 420, [0, 360, 2], { seg: 22, cell: 'camisa' }), ...Array.from({ length: 6 }, (_, i) => B(null, 'acoPreto', [3, 400, 82], [0, 360, 2], { rot: [0, i * 30, 0], cell: 'aleta' })),
      L(null, 'parkVerde', [[40, 0], [40, 10], [16, 60], [12, 70], [0, 70]], [0, 570, 2], { seg: 18, cell: 'cone' }), C('Cano', 'acoPreto', 7, 40, [0, 660, 2], { seg: 10 }),
      C('Carregador', 'acoPreto', 82, 34, [0, 40, 62], { axis: 'z', seg: 30 }), C('Carregador', 'acoGasto', 22, 40, [0, 40, 62], { axis: 'z', seg: 14, cell: 'cubo' }), ...Array.from({ length: 12 }, (_, i) => { const a = i / 12 * Math.PI * 2; return B('Carregador', 'acoPreto', [4, 60, 4], [Math.cos(a) * 52, 40 + Math.sin(a) * 52, 80], { rot: [0, 0, a * 180 / Math.PI + 90], cell: 'raio' }); }),
      E(null, 'nogueira', [[-110, -10], [-110, 16], [-340, -8], [-340, -100], [-300, -104], [-140, -40]], 34, [0, 0, 0], { bev: 7, bevSeg: 2, cell: 'coronha' }),
      E(null, 'nogueira', [[-56, -26], [-18, -26], [-28, -76], [-34, -112], [-72, -112], [-66, -60]], 28, [0, 0, 0], { bev: 5, cell: 'punho' }),
      SG(null, 'acoPreto', [6, 560, -30], [50, 700, -170], 6, { seg: 8, cell: 'bipe' }), SG(null, 'acoPreto', [-6, 560, -30], [-50, 700, -170], 6, { seg: 8, cell: 'bipe' }),
      C('Ferrolho', 'acoGasto', 5, 24, [-26, 40, -6], { axis: 'x', seg: 8 }), B('Mira', 'acoPreto', [16, 30, 20], [0, -60, 30], { bev: 2 }), B('Mira', 'acoPreto', [3, 8, 16], [0, 600, 50]),
      ...trig('acoPreto', 0, -28, { h: 22, back: 30, front: 28 }),
    ], muzzle: 680, support: [0, 220, -50], port: [20, 40, 6] }) },
  { id: 'chauchat', slot: 'assault', war: 1, c: 'França', n: 'Chauchat CSRG 1915', d: 'O fuzil-metralhadora francês: carregador em meia-lua aberto e camisa de cano.', fx: { cavity: 0.55, scratches: 0.4, rust: 0.25 },
    build: () => ({ parts: [
      C(null, 'acoOxidado', 24, 380, [0, 60, -6], { seg: 18, cell: 'tubo' }), C(null, 'acoOxidado', 15, 300, [0, 380, 0], { seg: 14, cell: 'camisa' }), ...Array.from({ length: 8 }, (_, i) => T(null, 'acoOxidado', 15, 2.5, [0, 260 + i * 30, 0], { rot: [90, 0, 0], seg: [4, 14], cell: 'anel' })),
      C('Cano', 'acoOxidado', 7, 60, [0, 560, 0], { seg: 10 }), B('Mira', 'acoOxidado', [3, 8, 18], [0, 520, 20]),
      E('Carregador', 'acoOxidado', [[30, -24], [90, -24], [110, -80], [100, -140], [70, -190], [30, -210], [20, -190], [50, -150], [62, -90], [50, -40]], 22, [0, 0, 0], { bev: 2, holes: [[[52, -60], [70, -90], [64, -130], [48, -100]]], cell: 'pente' }),
      E(null, 'nogueira', [[-100, -12], [-100, 14], [-340, -10], [-340, -110], [-300, -114], [-150, -52]], 34, [0, 0, 0], { bev: 7, cell: 'coronha' }),
      E(null, 'nogueira', [[-50, -28], [-14, -28], [-22, -80], [-62, -84], [-60, -50]], 28, [0, 0, 0], { bev: 5, cell: 'punho' }),
      E(null, 'nogueira', [[180, -30], [210, -30], [206, -100], [176, -100]], 26, [0, 0, 0], { bev: 5, cell: 'punhof' }),
      SG(null, 'acoOxidado', [6, 470, -14], [50, 560, -160], 6, { seg: 8, cell: 'bipe' }), SG(null, 'acoOxidado', [-6, 470, -14], [-50, 560, -160], 6, { seg: 8, cell: 'bipe' }),
      C('Ferrolho', 'acoGasto', 5, 26, [28, 40, 0], { axis: 'x', seg: 8 }), B('Mira', 'acoOxidado', [14, 30, 18], [0, -40, 26], { bev: 2 }),
      ...trig('acoOxidado', 0, -30, { h: 22, back: 30, front: 28 }),
    ], muzzle: 590, support: [0, 195, -70], port: [20, 30, 6] }) },
  { id: 'm3grease', slot: 'subgun', war: 2, c: 'EUA', n: 'M3 "Grease Gun"', d: 'Corpo tubular estampado, coronha de arame retrátil e tampa de ejeção.', fx: { cavity: 0.5, scratches: 0.3 },
    build: () => ({ parts: [
      C(null, 'parkCinza', 30, 230, [0, 30, -6], { seg: 20, cell: 'corpo' }), L(null, 'parkCinza', [[0, 0], [30, 0], [24, 20], [16, 30], [0, 30]], [0, 145, -6], { seg: 18, cell: 'frente' }),
      L(null, 'parkCinza', [[0, 0], [30, 0], [26, -16], [0, -20]], [0, -85, -6], { seg: 18, cell: 'tras' }),
      C('Cano', 'parkCinza', 9, 140, [0, 240, -4], { seg: 12 }), L('Cano', 'parkCinza', [[0, 0], [12, 0], [12, 14], [0, 14]], [0, 172, -4], { seg: 12, cell: 'porca' }),
      B(null, 'parkCinza', [32, 70, 12], [0, 40, 26], { bev: 3, cell: 'tampa' }), B(null, 'acoPreto', [3, 50, 20], [22, 40, 10], { cell: 'janela' }),
      B(null, 'parkCinza', [26, 46, 50], [0, 110, -54], { bev: 3, cell: 'poco' }), B('Carregador', 'parkCinza', [22, 34, 220], [0, 110, -180], { bev: 2.5 }), B('Carregador', 'parkCinza', [24, 38, 6], [0, 110, -292], { bev: 1.5, cell: 'base' }),
      E(null, 'parkCinza', [[-50, -30], [-10, -30], [-18, -80], [-24, -120], [-62, -120], [-62, -90], [-56, -50]], 28, [0, 0, 0], { bev: 4, cell: 'punho' }),
      SG(null, 'acoGasto', [-8, -80, -14], [-8, -320, -30], 4, { seg: 8, cell: 'arame' }), SG(null, 'acoGasto', [8, -80, -14], [8, -320, -30], 4, { seg: 8, cell: 'arame' }), SG(null, 'acoGasto', [-12, -320, -30], [12, -320, -30], 4, { seg: 8, cell: 'arame' }), SG(null, 'acoGasto', [0, -320, -30], [0, -330, -100], 4, { seg: 8, cell: 'arame' }),
      E('Ferrolho', 'parkCinza', [[-40, -10], [-10, -10], [-14, -40], [-40, -40]], 36, [0, 0, 0], { cell: 'manivela' }), C('Ferrolho', 'acoGasto', 3, 50, [24, -26, -26], { axis: 'x', seg: 6 }),
      B('Mira', 'parkCinza', [10, 14, 20], [0, -60, 30], { bev: 1.5 }), B('Mira', 'parkCinza', [3, 8, 16], [0, 150, 28]),
      ...trig('parkCinza', 0, -36, { h: 22, back: 30, front: 28 }),
    ], muzzle: 312, support: [0, 110, -70], port: [24, 40, 10] }) },
  { id: 'pps43', slot: 'subgun', war: 2, c: 'URSS', n: 'PPS-43', d: 'Chapa estampada soldada, camisa vazada e carregador curvo de 35.', fx: { cavity: 0.5, scratches: 0.35, dirt: 0.45 },
    build: () => ({ parts: [
      B(null, 'acoPreto', [30, 230, 40], [0, 20, -2], { bev: 3, cell: 'caixa' }),
      E(null, 'acoPreto', [[130, -18], [330, -14], [330, 20], [130, 20]], 30, [0, 0, 0], { bev: 2, cell: 'camisa', holes: [[[150, -6], [200, -6], [200, 10], [150, 10]], [[220, -6], [270, -6], [270, 10], [220, 10]], [[290, -6], [318, -6], [318, 10], [290, 10]]] }),
      C('Cano', 'acoPreto', 7, 200, [0, 230, 2], { seg: 10 }), B(null, 'acoPreto', [32, 20, 40], [0, 338, 2], { bev: 2, rot: [20, 0, 0], cell: 'freio' }),
      E('Carregador', 'acoPreto', [[70, -22], [114, -22], [130, -100], [150, -200], [110, -210], [92, -110]], 22, [0, 0, 0], { bev: 2 }),
      E(null, 'baquelite', [[-60, -20], [-20, -20], [-28, -72], [-34, -116], [-72, -116], [-66, -60]], 28, [0, 0, 0], { bev: 5, cell: 'punho' }),
      SG(null, 'acoPreto', [-10, -90, 10], [-10, -320, 0], 5, { seg: 8, cell: 'coronha' }), SG(null, 'acoPreto', [10, -90, 10], [10, -320, 0], 5, { seg: 8, cell: 'coronha' }),
      E(null, 'acoPreto', [[-330, 10], [-310, 10], [-310, -90], [-330, -94]], 30, [0, 0, 0], { bev: 2, cell: 'soleira' }), SG(null, 'acoPreto', [0, -100, -24], [0, -320, -80], 5, { seg: 8, cell: 'coronha' }),
      C('Ferrolho', 'acoGasto', 5, 22, [22, 40, 6], { axis: 'x', seg: 8 }), B('Mira', 'acoPreto', [16, 20, 14], [0, -50, 24], { bev: 2 }), B('Mira', 'acoPreto', [3, 8, 16], [0, 320, 26]),
      ...trig('acoPreto', 0, -24, { h: 22, back: 30, front: 28 }),
    ], muzzle: 350, support: [0, 92, -80], port: [17, 30, 6] }) },
  { id: 'beretta38', slot: 'subgun', war: 2, c: 'Itália', n: 'Beretta MAB 38', d: 'Coronha de nogueira inteira, dois gatilhos e compensador de quatro fendas.', fx: { cavity: 0.45, scratches: 0.3 },
    build: () => ({ parts: [
      E(null, 'nogueira', [[-360, -8], [-360, -116], [-320, -120], [-140, -56], [-60, -50], [200, -32], [210, -16], [-60, -18], [-320, -4]], 32, [0, 0, 0], { bev: 7, bevSeg: 2, cell: 'coronha' }),
      C(null, 'acoOxidado', 15, 220, [0, 20, 2], { seg: 16, cell: 'caixa' }), C(null, 'perfurado', 17, 200, [0, 230, 2], { seg: 16, cell: 'camisa' }),
      L(null, 'acoOxidado', [[0, 0], [17, 0], [17, 40], [0, 40]], [0, 330, 2], { seg: 14, cell: 'comp' }), ...[0, 1, 2, 3].map(i => B(null, 'acoPreto', [10, 5, 6], [0, 338 + i * 8, 16], { cell: 'fendacomp' })),
      B('Carregador', 'acoOxidado', [20, 32, 160], [0, 60, -110], { bev: 2 }), B(null, 'acoOxidado', [24, 40, 40], [0, 60, -38], { bev: 3, cell: 'poco' }),
      ...trig('acoOxidado', -10, -34, { h: 22, back: 40, front: 34 }), E('Gatilho', 'acoOxidado', [[14, -32], [20, -32], [18, -48], [12, -54], [10, -46]], 5, [0, 0, 0], { pivot: [0, 16, -32], cell: 'gatilho2' }),
      C('Ferrolho', 'acoGasto', 4, 22, [-22, 40, 4], { axis: 'x', seg: 8 }), B('Mira', 'acoOxidado', [14, 30, 12], [0, -40, 20], { bev: 2 }), ...frontSight('acoOxidado', 320, 2, { r: 6, len: 10, post: 14 }),
      swivel('acoOxidado', -260, -96), swivel('acoOxidado', 160, -36),
    ], muzzle: 372, support: [0, 140, -40], port: [17, 30, 6] }) },
  { id: 'arisaka99', slot: 'sniper', war: 2, c: 'Japão', n: 'Arisaka Tipo 99', d: 'Fuzil japonês com tampa de culatra deslizante e coronha de duas peças.', fx: { cavity: 0.45, scratches: 0.3 },
    build: () => boltRifleHD({ wood: 'madeiraClara', forend: 520, muzzle: 760, bolt: 'down', handguard: 300, bands: [360, 480], stock: 'arisaka', dustCover: true, hood: true }) },
  { id: 'lebel', slot: 'sniper', war: 1, c: 'França', n: 'Lebel Modelo 1886', d: 'Longo fuzil francês da Grande Guerra com carregador tubular sob o cano.', fx: { cavity: 0.55, scratches: 0.35, rust: 0.2 },
    build: () => boltRifleHD({ wood: 'nogueira', forend: 650, muzzle: 900, bolt: 'straight', handguard: 0, bands: [450, 600], stock: 'mosin', tube: true }) },
  { id: 'tt33', slot: 'pistol', war: 2, c: 'URSS', n: 'Tokarev TT-33', d: 'Pistola soviética de cão exposto com talas de baquelite e estrela.', fx: { cavity: 0.45, scratches: 0.3 },
    build: () => { const s = HD.colt1911(); return { ...s, parts: s.parts.map(p => p.mat === 'parkCinza' ? { ...p, mat: 'acoOxidado' } : p.mat === 'quadriculado' ? { ...p, mat: 'baquelite' } : p).concat([B(null, 'baquelite', [30, 14, 14], [0, -46, -56], { cell: 'estrela' })]).filter(p => p.cell !== 'grip'), muzzle: 168 }; } },
  { id: 'hipower', slot: 'pistol', war: 2, c: 'Bélgica', n: 'Browning Hi-Power', d: 'Carregador de 13, ferrolho de perfil inclinado — usada pelos dois lados.', fx: { cavity: 0.4, scratches: 0.3 },
    build: () => { const s = HD.colt1911(); return { ...s, parts: s.parts.map(p => p.mat === 'parkCinza' ? { ...p, mat: 'acoPreto' } : p.mat === 'quadriculado' ? { ...p, mat: 'nogueira' } : p).filter(p => p.cell !== 'grip').concat([B('Carregador', 'acoPreto', [18, 34, 12], [0, -62, -124], { rot: [12, 0, 0], bev: 2, cell: 'base' })]) }; } },
];
