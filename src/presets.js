// CUBE MAKER — Arsenal: modelos procedurais de armas e itens da 1ª e 2ª Guerra Mundial
// Unidades em milímetros. Armas de fogo: origem no eixo do cano logo acima do gatilho, +Y = frente (cano), +Z = cima, +X = direita.
// Facas: origem no meio do cabo, +Y = ponta da lâmina, +Z = lado do dorso. Granadas: origem onde a mão segura, +Y = para cima (espoleta).
import * as THREE from 'three';

// ---------------------------------------------------------------- peças
const B = (g, mat, s, p, o = {}) => ({ kind: 'box', g, mat, s, p, ...o });
const C = (g, mat, r, l, p, o = {}) => ({ kind: 'cyl', g, mat, r, l, p, ...o });
const L = (g, mat, prof, p, o = {}) => ({ kind: 'lathe', g, mat, prof, p, ...o });
const E = (g, mat, pts, w, p = [0, 0, 0], o = {}) => ({ kind: 'ext', g, mat, pts, w, p, ...o });
const SP = (g, mat, r, p, o = {}) => ({ kind: 'sph', g, mat, r, p, ...o });
const T = (g, mat, R, tube, p, o = {}) => ({ kind: 'torus', g, mat, R, tube, p, ...o });

// partes comuns
function trigger(metal, h = 18, y = 0) {
  return [
    B('Gatilho', metal, [4, 5, 16], [0, y + 2, -h - 8], { rot: [12, 0, 0], pivot: [0, y + 2, -h] }),
    B(null, metal, [5, 52, 4], [0, y + 4, -h - 22], { cell: 'guarda' }),
    B(null, metal, [5, 4, 22], [0, y + 29, -h - 11], { cell: 'guarda' }),
  ];
}
const grip = (mat, y0, z0, len = 95, ang = 18, w = 26, th = 32) => {
  const a = ang * Math.PI / 180, dy = -Math.sin(a) * len, dz = -Math.cos(a) * len;
  return E(null, mat, [[y0, z0], [y0 + th, z0], [y0 + th + dy, z0 + dz], [y0 + dy - 4, z0 + dz + 4]], w);
};

// ---------------------------------------------------------------- famílias
function boltRifle(o) {
  const m = o.metal || 'acoOxidado', w = o.wood || 'nogueira';
  const P = [
    // coronha inteira em madeira (perfil lateral)
    E(null, w, [[-400, -18], [-400, -135], [-360, -140], [-150, -62], [-70, -64], [-40, -30], [60, -34], [o.forend, -30], [o.forend, -14], [80, -12], [-30, -14], [-120, -24], [-330, -10]], 34, [0, 0, 0], { cell: 'coronha' }),
    C(null, m, 14, 230, [0, 25, 0]),                                   // caixa da culatra
    C('Cano', m, 8, o.muzzle - o.forend + 40, [0, (o.muzzle + o.forend - 40) / 2, 0]),
    B(null, m, [20, 22, 28], [0, o.forend + 6, -10]),                  // ponteira
    C(null, m, 9, 18, [0, o.muzzle - 9, 0], { cell: 'massa' }),         // massa de mira
    B('Mira', m, [4, 6, 14], [0, o.muzzle - 12, 12]),
    B('Mira', m, [14, 40, 10], [0, 110, 14]),                          // alça
    ...trigger(m, 30, -20),
  ];
  if (o.handguard) P.push(B(null, w, [22, o.handguard, 12], [0, o.forend - o.handguard / 2 - 10, 11], { cell: 'guardamao' }));
  (o.bands || []).forEach(y => P.push(C(null, m, 21, 10, [0, y, -10], { cell: 'bracadeira' })));
  // alavanca do ferrolho
  if (o.bolt === 'down') P.push(C('Ferrolho', 'acoGasto', 4, 46, [24, -12, -10], { axis: 'x', rot: [0, 0, -28], pivot: [0, -12, 0] }), SP('Ferrolho', 'acoGasto', [8, 8, 8], [44, -12, -24], { pivot: [0, -12, 0] }));
  else if (o.bolt === 'straight') P.push(C('Ferrolho', 'acoGasto', 4, 44, [26, -6, 0], { axis: 'x', pivot: [0, -6, 0] }), SP('Ferrolho', 'acoGasto', [8, 8, 8], [48, -6, 0], { pivot: [0, -6, 0] }));
  else P.push(C('Ferrolho', 'acoGasto', 4, 40, [24, -40, -6], { axis: 'x', rot: [0, 0, -15], pivot: [0, -40, 0] }), SP('Ferrolho', 'acoGasto', [7, 7, 7], [42, -42, -14], { pivot: [0, -40, 0] }));
  if (o.mag === 'box') P.push(B('Carregador', m, [22, 62, 70], [0, 40, -62]));
  else P.push(B(null, m, [20, 90, 8], [0, 40, -40]));
  if (o.scope) {
    const sy = o.scope === 'zf39' ? 0 : o.scope === 'm73' ? -10 : 10, len = o.scope === 'zf39' ? 230 : o.scope === 'm73' ? 300 : 170, r = o.scope === 'm73' ? 10 : 13, sx = o.scope === 'pu' ? 10 : 0, sz = o.scope === 'pu' ? 46 : 52;
    P.push(C('Mira', 'acoPreto', r, len, [sx, sy, sz]), L('Mira', 'acoPreto', [[0, 0], [r + 6, 0], [r + 6, 40], [r, 70], [0, 70]], [sx, sy + len / 2 - 20, sz], { cell: 'luneta' }),
      L('Mira', 'acoPreto', [[0, 0], [r, 0], [r + 5, 30], [r + 5, 55], [0, 55]], [sx, sy - len / 2 - 40, sz], { cell: 'luneta' }),
      B('Mira', 'acoPreto', [12, 16, sz - 14], [sx / 2, sy - 50, sz / 2 + 4], { cell: 'montagem' }), B('Mira', 'acoPreto', [12, 16, sz - 14], [sx / 2, sy + 60, sz / 2 + 4], { cell: 'montagem' }));
  }
  return { parts: P, muzzle: o.muzzle, support: [0, Math.min(o.forend - 60, 260), -40], port: [16, 20, 8] };
}

function semiRifle(o) {
  const m = o.metal || 'parkCinza', w = o.wood || 'madeiraClara';
  const P = [
    E(null, w, [[-360, -14], [-360, -125], [-320, -128], [-130, -58], [-60, -60], [-30, -30], [o.forend, -28], [o.forend, -10], [-120, -18], [-300, -6]], 32, [0, 0, 0], { cell: 'coronha' }),
    B(null, m, [26, 220, 30], [0, 30, -2]),
    C('Cano', m, 8, o.muzzle - o.forend + 20, [0, (o.muzzle + o.forend - 20) / 2, 0]),
    B(null, w, [22, o.forend - 110, 12], [0, (o.forend + 110) / 2, 13], { cell: 'guardamao' }),
    C(null, m, 20, 12, [0, o.forend - 20, -8], { cell: 'bracadeira' }),
    B('Mira', m, [4, 6, 16], [0, o.muzzle - 14, 14]), B('Mira', m, [14, 20, 14], [0, -10, 20]),
    B('Carregador', m, [20, 50, o.magLen || 70], [0, 40, -40 - (o.magLen || 70) / 2]),
    B('Ferrolho', 'acoGasto', [8, 34, 10], [o.boltLeft ? -17 : 17, 60, 4]),
    ...trigger(m, 28, -20),
  ];
  if (o.brake) P.push(B(null, m, [20, 40, 20], [0, o.muzzle - 18, 0], { cell: 'freio' }), B(null, 'acoPreto', [22, 30, 8], [0, o.muzzle - 18, 0], { cell: 'freio2' }));
  if (o.gasTube) P.push(C(null, m, 6, o.forend - 80, [0, (o.forend + 80) / 2, 18], { cell: 'gas' }));
  return { parts: P, muzzle: o.muzzle, support: [0, Math.min(o.forend - 60, 220), -36], port: [16, 30, 8] };
}

function revolver(o) {
  const m = o.metal || 'acoOxidado';
  return { parts: [
    B(null, m, [22, 70, 34], [0, 0, -6]),                                     // armação
    C('Tambor', m, 19, 50, [0, 5, -2], { pivot: [0, 5, -2] }),
    C('Cano', m, o.r || 8, o.barrel, [0, 35 + o.barrel / 2, 2]),
    C(null, m, 4, o.barrel - 20, [0, 35 + o.barrel / 2, -9], { cell: 'vareta' }),
    B('Mira', m, [3, 6, 8], [0, 32 + o.barrel, 12]),
    E(null, o.grip || 'baquelite', [[-48, -10], [-18, -10], [-30, -90], [-62, -88]], 26, [0, 0, 0], { cell: 'cabo' }),
    B('Ferrolho', 'acoGasto', [8, 18, 22], [0, -40, 10], { rot: [-20, 0, 0], pivot: [0, -34, -4] }),   // cão
    ...trigger(m, 18, -8),
    ...(o.ring ? [T(null, 'acoGasto', 7, 1.5, [0, -66, -92], { axis: 'x' })] : []),
  ], muzzle: 35 + o.barrel, support: null, port: null };
}

// ---------------------------------------------------------------- catálogo
// slot: em qual arma do AC o modelo entra · war: 1 ou 2 (Grande Guerra / Segunda Guerra)
export const ARSENAL = [
  // ======================= GRANADAS
  { id: 'stielhandgranate24', slot: 'grenade', war: 2, c: 'Alemanha', n: 'Stielhandgranate 24', d: 'O "espremedor de batata": cabeça de 70 mm e cabo de madeira, 360 mm no total.', fx: { cavity: 0.4, scratches: 0.25 },
    build: () => ({ parts: [
      C(null, 'faia', 13, 290, [0, 25, 0]),
      C(null, 'feldgrau', 35, 70, [0, 205, 0], { cell: 'cabeca' }),
      L(null, 'feldgrau', [[0, 0], [33, 0], [35, 6], [35, 8], [14, 16], [13, 18], [0, 18]], [0, 240, 0], { cell: 'cabeca2' }),
      L(null, 'feldgrau', [[0, 0], [14, 0], [35, -8], [33, -12], [0, -12]], [0, 170, 0], { cell: 'cabeca3' }),
      C('Pino', 'acoGasto', 14.5, 16, [0, -128, 0], { pivot: [0, -128, 0] }),
      C(null, 'acoGasto', 15, 8, [0, 168, 0], { cell: 'anel' }),
    ], support: null }) },
  { id: 'stielhandgranate17', slot: 'grenade', war: 1, c: 'Alemanha', n: 'Stielhandgranate 17', d: 'Versão da Grande Guerra, cabeça menor de 60 mm e clipe de cinto.', fx: { cavity: 0.5, scratches: 0.35, rust: 0.2 },
    build: () => ({ parts: [
      C(null, 'nogueira', 13, 250, [0, 10, 0]),
      C(null, 'acoPreto', 30, 110, [0, 190, 0], { cell: 'cabeca' }),
      L(null, 'acoPreto', [[0, 0], [30, 0], [26, 10], [8, 14], [0, 14]], [0, 245, 0], { cell: 'cabeca2' }),
      B(null, 'acoGasto', [6, 60, 10], [32, 170, 0], { cell: 'clipe' }),
      C('Pino', 'acoGasto', 14.5, 16, [0, -122, 0], { pivot: [0, -122, 0] }),
    ] }) },
  { id: 'mk2', slot: 'grenade', war: 2, c: 'EUA', n: 'Mk 2 "abacaxi"', d: 'Corpo de ferro fundido segmentado, espoleta com alavanca e argola.', fx: { cavity: 0.55, scratches: 0.3 },
    build: () => ({ parts: [
      L(null, 'abacaxi', [[0, -54], [16, -52], [26, -42], [29, -22], [29, 8], [26, 26], [18, 38], [11, 42], [0, 42]], [0, 0, 0]),
      C(null, 'oliva', 10, 26, [0, 54, 0]),
      B('Alavanca', 'oliva', [10, 74, 3], [0, 28, 31], { rot: [-8, 0, 0] }),
      T('Pino', 'acoGasto', 11, 1.6, [16, 60, 6], { axis: 'z', pivot: [10, 60, 0] }),
      C('Pino', 'acoGasto', 1.5, 22, [7, 60, 0], { axis: 'x', pivot: [10, 60, 0] }),
    ] }) },
  { id: 'f1', slot: 'grenade', war: 2, c: 'URSS', n: 'F1 "Limonka"', d: 'Granada defensiva soviética: casca segmentada e espoleta UZRG.', fx: { cavity: 0.55, scratches: 0.3, rust: 0.1 },
    build: () => ({ parts: [
      L(null, 'f1seg', [[0, -60], [14, -58], [24, -48], [27, -26], [27, 10], [23, 30], [14, 40], [0, 42]], [0, 0, 0]),
      C(null, 'acoOxidado', 9, 30, [0, 56, 0]),
      B('Alavanca', 'acoGasto', [10, 70, 3], [0, 30, 29], { rot: [-10, 0, 0] }),
      T('Pino', 'acoGasto', 12, 1.6, [18, 64, 6], { axis: 'z', pivot: [10, 64, 0] }),
    ] }) },
  { id: 'mills36', slot: 'grenade', war: 1, c: 'Reino Unido', n: 'Mills Nº 36', d: 'A "Mills bomb": casca ovalada segmentada, usada nas duas guerras.', fx: { cavity: 0.5, scratches: 0.3, rust: 0.15 },
    build: () => ({ parts: [
      L(null, 'mills', [[0, -50], [18, -47], [28, -34], [31, -12], [30, 10], [24, 30], [12, 40], [0, 41]], [0, 0, 0]),
      C(null, 'latao', 12, 10, [0, -52, 0], { cell: 'tampa' }),
      B('Alavanca', 'acoPreto', [12, 76, 3], [0, 4, 33], { rot: [-4, 0, 0] }),
      T('Pino', 'acoGasto', 12, 1.6, [20, 40, 4], { axis: 'z', pivot: [12, 40, 0] }),
    ] }) },
  { id: 'eihandgranate39', slot: 'grenade', war: 2, c: 'Alemanha', n: 'Eihandgranate 39', d: 'Granada "ovo": corpo liso cinza-esverdeado, nervura no meio e tampa azul.', fx: { cavity: 0.35, scratches: 0.25 },
    build: () => ({ parts: [
      L(null, 'feldgrau', [[0, -38], [16, -35], [26, -22], [30, -2], [31, 0], [30, 2], [26, 16], [16, 30], [8, 34], [0, 34]], [0, 0, 0]),
      C(null, 'acoGasto', 8, 10, [0, 38, 0], { cell: 'rosca' }),
      C('Pino', 'azulTampa', 9, 14, [0, 48, 0], { pivot: [0, 44, 0] }),
    ] }) },
  { id: 'kugelhandgranate', slot: 'grenade', war: 1, c: 'Alemanha', n: 'Kugelhandgranate 1915', d: 'Granada esférica da Grande Guerra, 80 mm, ferro fundido com sulcos.', fx: { cavity: 0.55, rust: 0.35, scratches: 0.3 },
    build: () => ({ parts: [
      SP(null, 'mills', [40, 40, 40], [0, 0, 0]),
      C(null, 'latao', 9, 28, [0, 50, 0]),
      T('Pino', 'couro', 10, 2.5, [0, 70, 0], { axis: 'x', pivot: [0, 62, 0] }),
    ] }) },
  { id: 'rgd33', slot: 'grenade', war: 2, c: 'URSS', n: 'RGD-33', d: 'Granada de cabo soviética com luva de fragmentação quadriculada; 190 mm.', fx: { cavity: 0.45, scratches: 0.3 },
    build: () => ({ parts: [
      C(null, 'oliva', 15, 110, [0, -10, 0]),
      C(null, 'quadriculado', 27, 72, [0, 85, 0], { cell: 'luva' }),
      L(null, 'oliva', [[0, 0], [26, 0], [24, 8], [10, 12], [0, 12]], [0, 121, 0]),
      B('Pino', 'acoGasto', [8, 18, 8], [17, 30, 0], { pivot: [15, 30, 0] }),
      C(null, 'acoGasto', 16, 6, [0, 48, 0], { cell: 'anel' }),
    ] }) },

  // ======================= FACAS E BAIONETAS
  { id: 'm3trench', slot: 'knife', war: 2, c: 'EUA', n: 'M3 Trench Knife', d: 'Lâmina parkerizada e cabo de anéis de couro empilhados.', fx: { cavity: 0.4, scratches: 0.3 },
    build: () => ({ parts: [
      E('Lâmina', 'parkCinza', [[38, -11], [150, -9], [205, 0], [178, 8], [38, 11]], 4),
      B('Cabo', 'acoGasto', [10, 8, 44], [0, 34, 0]),
      C('Cabo', 'couro', 13, 110, [0, -22, 0], { r2: 12 }),
      C('Cabo', 'acoGasto', 13, 14, [0, -82, 0], { cell: 'pomo' }),
    ] }) },
  { id: 'mk1trench', slot: 'knife', war: 1, c: 'EUA', n: 'Mk I Trench Knife', d: 'Faca de trincheira de 1918 com soco-inglês de latão e lâmina punhal.', fx: { cavity: 0.5, scratches: 0.35 },
    build: () => ({ parts: [
      E('Lâmina', 'acoPreto', [[40, -12], [210, 0], [40, 12]], 5),
      C('Cabo', 'latao', 14, 100, [0, -15, 0]),
      E('Cabo', 'latao', [[-60, -14], [-60, -50], [-40, -58], [30, -58], [40, -40], [40, -14], [30, -14], [30, -44], [-50, -44], [-50, -14]], 10, [0, 0, 0], { cell: 'soco' }),
      SP('Cabo', 'latao', [5, 5, 7], [0, -30, -62], { cell: 'cravo' }), SP('Cabo', 'latao', [5, 5, 7], [0, 0, -62], { cell: 'cravo' }), SP('Cabo', 'latao', [5, 5, 7], [0, 25, -62], { cell: 'cravo' }),
      L('Cabo', 'latao', [[0, 0], [14, 0], [10, -24], [0, -30]], [0, -65, 0], { cell: 'pomo' }),
    ] }) },
  { id: 'kampfmesser42', slot: 'knife', war: 2, c: 'Alemanha', n: 'Kampfmesser 42', d: 'Faca de combate com cabo de madeira e lâmina de um gume.', fx: { cavity: 0.4, scratches: 0.3 },
    build: () => ({ parts: [
      E('Lâmina', 'acoGasto', [[30, -10], [140, -10], [180, 4], [168, 10], [30, 10]], 4),
      E('Cabo', 'nogueira', [[-90, -12], [25, -14], [28, 14], [-90, 12], [-96, 0]], 20),
      C('Cabo', 'acoGasto', 13, 6, [0, 28, 0], { cell: 'guarda' }),
    ] }) },
  { id: 'baioneta98', slot: 'knife', war: 2, c: 'Alemanha', n: 'Baioneta S84/98', d: 'Baioneta do Kar98k: lâmina longa e talas de madeira.', fx: { cavity: 0.4, scratches: 0.35 },
    build: () => ({ parts: [
      E('Lâmina', 'acoGasto', [[30, -11], [250, -9], [280, 2], [250, 10], [30, 11]], 4),
      E('Cabo', 'nogueira', [[-85, -14], [25, -14], [25, 14], [-85, 14]], 18),
      B('Cabo', 'acoOxidado', [10, 10, 40], [0, 30, 4]),
      C('Cabo', 'acoOxidado', 14, 20, [0, -92, 0], { cell: 'pomo' }),
    ] }) },
  { id: 'fairbairn', slot: 'knife', war: 2, c: 'Reino Unido', n: 'Fairbairn-Sykes', d: 'Punhal dos comandos britânicos: lâmina fina de dois gumes e cabo recartilhado.', fx: { cavity: 0.35, scratches: 0.25 },
    build: () => ({ parts: [
      E('Lâmina', 'acoPreto', [[30, -10], [200, -1], [205, 0], [200, 1], [30, 10]], 5),
      B('Cabo', 'acoPreto', [10, 6, 50], [0, 28, 0]),
      C('Cabo', 'recartilhado', 11, 110, [0, -32, 0], { r2: 13 }),
      SP('Cabo', 'acoPreto', [11, 10, 11], [0, -92, 0], { cell: 'pomo' }),
    ] }) },

  // ======================= PISTOLAS
  { id: 'luger', slot: 'pistol', war: 1, c: 'Alemanha', n: 'Luger P08', d: 'Ação de articulação (toggle) por cima, empunhadura inclinada quadriculada.', fx: { cavity: 0.45, scratches: 0.25 },
    build: () => ({ parts: [
      B(null, 'acoOxidado', [18, 90, 24], [0, -5, -6]),
      C('Cano', 'acoOxidado', 6, 100, [0, 90, 0]),
      B('Ferrolho', 'acoOxidado', [16, 34, 10], [0, -22, 10], { pivot: [0, -5, 8] }),
      C('Ferrolho', 'acoGasto', 7, 26, [0, -36, 14], { axis: 'x', pivot: [0, -5, 8] }),
      E(null, 'quadriculado', [[-58, -14], [-22, -14], [-44, -100], [-78, -96]], 26, [0, 0, 0], { cell: 'cabo' }),
      B('Carregador', 'acoOxidado', [16, 30, 10], [0, -60, -104], { rot: [20, 0, 0] }),
      B('Mira', 'acoOxidado', [3, 5, 8], [0, 136, 8]),
      ...trigger('acoOxidado', 16, -8),
    ], muzzle: 140, support: null, port: [8, -20, 14] }) },
  { id: 'colt1911', slot: 'pistol', war: 1, c: 'EUA', n: 'Colt M1911', d: 'A .45 das duas guerras: slide parkerizado e talas de nogueira.', fx: { cavity: 0.4, scratches: 0.3 },
    build: () => ({ parts: [
      B('Ferrolho', 'parkCinza', [20, 210, 24], [0, 55, 2]),
      B(null, 'parkCinza', [20, 120, 18], [0, 30, -18]),
      C('Cano', 'acoPreto', 6, 10, [0, 162, 2], { cell: 'boca' }),
      E(null, 'quadriculado', [[-65, -24], [-25, -24], [-38, -110], [-80, -108]], 28, [0, 0, 0], { cell: 'cabo' }),
      B('Carregador', 'parkCinza', [16, 34, 10], [0, -60, -114], { rot: [12, 0, 0] }),
      B(null, 'parkCinza', [10, 16, 16], [0, -55, 12], { rot: [-25, 0, 0], cell: 'cao' }),
      B('Mira', 'parkCinza', [3, 6, 8], [0, 150, 18]),
      ...trigger('parkCinza', 26, -8),
    ], muzzle: 166, support: null, port: [12, 40, 10] }) },
  { id: 'p38', slot: 'pistol', war: 2, c: 'Alemanha', n: 'Walther P38', d: 'Slide aberto em cima com o cano à mostra, empunhadura de baquelite.', fx: { cavity: 0.45, scratches: 0.25 },
    build: () => ({ parts: [
      B('Ferrolho', 'acoOxidado', [20, 130, 20], [0, 10, 2]),
      C('Cano', 'acoOxidado', 7, 70, [0, 105, 2]),
      B(null, 'acoOxidado', [20, 120, 18], [0, 20, -16]),
      E(null, 'baquelite', [[-62, -22], [-24, -22], [-36, -108], [-76, -106]], 28, [0, 0, 0], { cell: 'cabo' }),
      B('Carregador', 'acoOxidado', [16, 32, 10], [0, -58, -112], { rot: [12, 0, 0] }),
      B('Mira', 'acoOxidado', [3, 5, 8], [0, 128, 16]),
      ...trigger('acoOxidado', 24, -6),
    ], muzzle: 140, support: null, port: [12, 10, 10] }) },
  { id: 'c96', slot: 'pistol', war: 1, c: 'Alemanha', n: 'Mauser C96 "Broomhandle"', d: 'Carregador fixo à frente do gatilho e cabo de "cabo de vassoura".', fx: { cavity: 0.5, scratches: 0.3 },
    build: () => ({ parts: [
      B(null, 'acoOxidado', [20, 150, 30], [0, 10, -6]),
      C('Cano', 'acoOxidado', 7, 140, [0, 150, 0]),
      B('Carregador', 'acoOxidado', [18, 50, 60], [0, 40, -50]),
      E(null, 'nogueira', [[-70, -14], [-40, -14], [-50, -80], [-58, -110], [-96, -112], [-100, -90], [-84, -20]], 28, [0, 0, 0], { cell: 'cabo' }),
      B('Ferrolho', 'acoGasto', [14, 30, 12], [0, -50, 12], { pivot: [0, -50, 8] }),
      B('Mira', 'acoOxidado', [12, 20, 12], [0, 70, 16]),
      ...trigger('acoOxidado', 22, -20),
    ], muzzle: 222, support: null, port: [12, -10, 12] }) },
  { id: 'webley', slot: 'pistol', war: 1, c: 'Reino Unido', n: 'Webley Mk VI', d: 'Revólver de quebrar da Grande Guerra, cano de 6 polegadas.', fx: { cavity: 0.5, scratches: 0.3 },
    build: () => revolver({ barrel: 150, grip: 'baquelite', ring: true }) },
  { id: 'nagant', slot: 'pistol', war: 1, c: 'Rússia / URSS', n: 'Nagant M1895', d: 'Revólver de 7 tiros com selagem de gás, usado até 1945.', fx: { cavity: 0.5, scratches: 0.3, rust: 0.1 },
    build: () => revolver({ barrel: 115, r: 7, grip: 'nogueira', ring: true }) },

  // ======================= SUBMETRALHADORAS
  { id: 'mp40', slot: 'subgun', war: 2, c: 'Alemanha', n: 'MP40', d: 'Aço oxidado e baquelite, carregador reto de 32 e coronha rebatida.', fx: { cavity: 0.45, scratches: 0.25 },
    build: () => ({ parts: [
      C(null, 'acoOxidado', 16, 240, [0, 35, 0]),
      C('Cano', 'acoOxidado', 7, 120, [0, 215, -2]), C(null, 'acoPreto', 9, 12, [0, 272, -2], { cell: 'boca' }),
      B(null, 'acoOxidado', [8, 30, 14], [0, 190, -16], { cell: 'apoio' }),
      E(null, 'baquelite', [[-85, -12], [140, -12], [140, -26], [60, -32], [-85, -30]], 26, [0, 0, 0], { cell: 'chassi' }),
      grip('baquelite', -45, -26, 95, 16),
      B(null, 'acoOxidado', [22, 40, 44], [0, 75, -38], { cell: 'poço' }),
      B('Carregador', 'acoOxidado', [16, 32, 230], [0, 75, -168]),
      C('Ferrolho', 'acoGasto', 4, 22, [-24, 30, 4], { axis: 'x' }), SP('Ferrolho', 'acoGasto', [6, 6, 6], [-36, 30, 4]),
      B(null, 'acoOxidado', [4, 200, 6], [11, 20, -40], { cell: 'haste' }), B(null, 'acoOxidado', [4, 200, 6], [-11, 20, -40], { cell: 'haste' }),
      B(null, 'acoOxidado', [36, 6, 44], [0, 122, -48], { cell: 'soleira' }),
      B('Mira', 'acoOxidado', [10, 14, 10], [0, -20, 20]), C('Mira', 'acoOxidado', 6, 10, [0, 262, 12]),
      ...trigger('acoOxidado', 26, -10),
    ], muzzle: 278, support: [-6, 75, -60], port: [16, 40, 6] }) },
  { id: 'thompson', slot: 'subgun', war: 2, c: 'EUA', n: 'Thompson M1928A1', d: 'Tambor de 50, cano aletado, punho vertical e coronha de nogueira.', fx: { cavity: 0.45, scratches: 0.3 },
    build: () => ({ parts: [
      B(null, 'parkCinza', [26, 250, 34], [0, 20, -2]),
      C('Cano', 'parkCinza', 8, 260, [0, 270, 0]),
      ...[170, 182, 194, 206, 218, 230, 242].map(y => C(null, 'parkCinza', 13, 3, [0, y, 0], { cell: 'aletas' })),
      B(null, 'parkCinza', [18, 34, 18], [0, 405, 2], { cell: 'compensador' }),
      E(null, 'nogueira', [[-95, -8], [-95, 14], [-280, -18], [-280, -96], [-240, -98], [-120, -40]], 32, [0, 0, 0], { cell: 'coronha' }),
      grip('nogueira', -55, -20, 95, 14, 26),
      E(null, 'nogueira', [[130, -18], [165, -18], [160, -100], [128, -100]], 26, [0, 0, 0], { cell: 'punho' }),
      C('Carregador', 'parkCinza', 66, 40, [0, 70, -88], { axis: 'x' }),
      B('Ferrolho', 'acoGasto', [12, 16, 14], [0, 40, 22]),
      B('Mira', 'parkCinza', [16, 22, 22], [0, -55, 24]), B('Mira', 'parkCinza', [3, 6, 14], [0, 412, 16]),
      ...trigger('parkCinza', 20, -10),
    ], muzzle: 422, support: [0, 145, -60], port: [16, 30, 8] }) },
  { id: 'ppsh41', slot: 'subgun', war: 2, c: 'URSS', n: 'PPSh-41', d: 'Coronha de madeira inteiriça, camisa perfurada e tambor de 71.', fx: { cavity: 0.5, scratches: 0.3, dirt: 0.4 },
    build: () => ({ parts: [
      E(null, 'madeiraClara', [[-300, -16], [-300, -110], [-260, -112], [-110, -50], [-40, -46], [120, -30], [130, -14], [-30, -14], [-260, -6]], 32, [0, 0, 0], { cell: 'coronha' }),
      C(null, 'acoPreto', 15, 170, [0, 30, 0]),
      C(null, 'perfurado', 17, 210, [0, 220, 0]),
      C('Cano', 'acoPreto', 6, 30, [0, 330, 0]),
      B(null, 'acoPreto', [32, 16, 36], [0, 330, 0], { rot: [24, 0, 0], cell: 'freio' }),
      C('Carregador', 'acoPreto', 60, 42, [0, 70, -78], { axis: 'x' }),
      C('Ferrolho', 'acoGasto', 4, 18, [22, 10, 2], { axis: 'x' }),
      B('Mira', 'acoPreto', [10, 16, 10], [0, 80, 20]), B('Mira', 'acoPreto', [3, 5, 12], [0, 315, 20]),
      ...trigger('acoPreto', 22, -10),
    ], muzzle: 340, support: [0, 140, -40], port: [16, 30, 8] }) },
  { id: 'sten', slot: 'subgun', war: 2, c: 'Reino Unido', n: 'Sten Mk II', d: 'Simples e barata: tubo de aço, carregador lateral e coronha de esqueleto.', fx: { cavity: 0.5, scratches: 0.35, rust: 0.15 },
    build: () => ({ parts: [
      C(null, 'acoPreto', 18, 330, [0, 60, 0]),
      C(null, 'perfurado', 16, 80, [0, 255, 0]), C('Cano', 'acoPreto', 7, 40, [0, 315, 0]),
      B(null, 'acoPreto', [44, 40, 30], [-26, 70, 0], { cell: 'poço' }),
      B('Carregador', 'acoPreto', [200, 30, 22], [-140, 70, 0]),
      B(null, 'acoPreto', [18, 60, 46], [0, -5, -32], { cell: 'caixa' }),
      C(null, 'acoPreto', 5, 200, [0, -200, -14], { cell: 'haste' }),
      B(null, 'acoPreto', [10, 8, 60], [0, -300, -30], { cell: 'soleira' }),
      C('Ferrolho', 'acoGasto', 4, 24, [22, 90, 8], { axis: 'x' }),
      B('Mira', 'acoPreto', [8, 8, 10], [0, -40, 20]),
      ...trigger('acoPreto', 30, -10),
    ], muzzle: 335, support: [-60, 70, -16], port: [18, 60, 6] }) },
  { id: 'mp18', slot: 'subgun', war: 1, c: 'Alemanha', n: 'MP18', d: 'A primeira submetralhadora da Grande Guerra: coronha de fuzil e camisa perfurada.', fx: { cavity: 0.5, scratches: 0.3, rust: 0.2 },
    build: () => ({ parts: [
      E(null, 'nogueira', [[-320, -16], [-320, -120], [-280, -122], [-120, -54], [-40, -50], [140, -32], [150, -14], [-40, -16], [-280, -6]], 32, [0, 0, 0], { cell: 'coronha' }),
      C(null, 'acoOxidado', 16, 200, [0, 30, 6]),
      C(null, 'perfurado', 17, 200, [0, 230, 6]), C('Cano', 'acoOxidado', 6, 30, [0, 340, 6]),
      B('Carregador', 'acoOxidado', [180, 26, 20], [-110, 40, 6]),
      C('Ferrolho', 'acoGasto', 4, 20, [22, 0, 8], { axis: 'x' }),
      B('Mira', 'acoOxidado', [10, 16, 10], [0, 60, 26]),
      ...trigger('acoOxidado', 28, -14),
    ], muzzle: 355, support: [0, 110, -40], port: [18, 20, 10] }) },

  // ======================= FUZIS DE ASSALTO / AUTOMÁTICOS
  { id: 'stg44', slot: 'assault', war: 2, c: 'Alemanha', n: 'StG 44', d: 'O primeiro fuzil de assalto: corpo estampado, carregador curvo de 30.', fx: { cavity: 0.45, scratches: 0.3 },
    build: () => ({ parts: [
      B(null, 'acoOxidado', [30, 330, 40], [0, 40, -4]),
      C(null, 'acoOxidado', 10, 200, [0, 300, 12], { cell: 'gas' }),
      C('Cano', 'acoOxidado', 8, 280, [0, 340, -4]),
      B('Mira', 'acoOxidado', [16, 20, 24], [0, 455, 8]),
      E('Carregador', 'acoOxidado', [[80, -24], [130, -24], [165, -120], [205, -230], [160, -250], [120, -140]], 22),
      grip('baquelite', -45, -24, 100, 18, 28),
      E(null, 'nogueira', [[-130, -8], [-130, 18], [-350, -10], [-350, -112], [-300, -116], [-150, -40]], 34, [0, 0, 0], { cell: 'coronha' }),
      B('Mira', 'acoOxidado', [14, 40, 10], [0, 50, 22]),
      C('Ferrolho', 'acoGasto', 4, 24, [-26, 70, 6], { axis: 'x' }), SP('Ferrolho', 'acoGasto', [6, 6, 6], [-40, 70, 6]),
      ...trigger('acoOxidado', 26, -10),
    ], muzzle: 482, support: [0, 150, -60], port: [18, 50, 6] }) },
  { id: 'bar1918', slot: 'assault', war: 1, c: 'EUA', n: 'BAR M1918', d: 'Fuzil automático Browning das duas guerras, carregador de 20.', fx: { cavity: 0.45, scratches: 0.35 },
    build: () => ({ parts: [
      B(null, 'parkCinza', [34, 300, 52], [0, 20, -6]),
      E(null, 'nogueira', [[-130, -6], [-130, 22], [-380, 0], [-380, -120], [-330, -124], [-150, -50]], 36, [0, 0, 0], { cell: 'coronha' }),
      grip('nogueira', -40, -32, 90, 16, 28),
      B(null, 'nogueira', [36, 220, 30], [0, 300, -10], { cell: 'guardamao' }),
      C('Cano', 'parkCinza', 9, 380, [0, 500, 0]), C(null, 'parkCinza', 9, 300, [0, 380, -26], { cell: 'gas' }),
      B(null, 'parkCinza', [20, 40, 20], [0, 690, 0], { cell: 'boca' }),
      B('Carregador', 'parkCinza', [26, 70, 90], [0, 90, -76]),
      C('Ferrolho', 'acoGasto', 5, 26, [-28, 60, -6], { axis: 'x' }),
      B('Mira', 'parkCinza', [16, 30, 18], [0, -60, 28]), B('Mira', 'parkCinza', [3, 6, 16], [0, 680, 18]),
      ...trigger('parkCinza', 34, -14),
    ], muzzle: 710, support: [0, 300, -40], port: [20, 40, 6] }) },
  { id: 'fg42', slot: 'assault', war: 2, c: 'Alemanha', n: 'FG 42', d: 'Fuzil dos paraquedistas: punho inclinado, carregador lateral e bipé.', fx: { cavity: 0.45, scratches: 0.3 },
    build: () => ({ parts: [
      B(null, 'acoOxidado', [28, 260, 40], [0, 40, 0]),
      C('Cano', 'acoOxidado', 8, 260, [0, 300, 0]),
      B(null, 'acoOxidado', [22, 40, 22], [0, 440, 0], { cell: 'freio' }),
      B('Carregador', 'acoOxidado', [190, 30, 26], [-115, 50, 0]),
      grip('baquelite', -30, -20, 100, 34, 26),
      E(null, 'laminado', [[-90, -4], [-90, 18], [-330, 0], [-330, -100], [-290, -104], [-150, -36]], 30, [0, 0, 0], { cell: 'coronha' }),
      B(null, 'acoOxidado', [6, 220, 6], [8, 280, -16], { cell: 'bipe' }), B(null, 'acoOxidado', [6, 220, 6], [-8, 280, -16], { cell: 'bipe' }),
      C('Ferrolho', 'acoGasto', 4, 22, [24, 40, 4], { axis: 'x' }),
      B('Mira', 'acoOxidado', [14, 20, 22], [0, 10, 26]), B('Mira', 'acoOxidado', [3, 6, 20], [0, 420, 18]),
      ...trigger('acoOxidado', 26, -10),
    ], muzzle: 460, support: [0, 200, -40], port: [18, 40, 6] }) },

  // ======================= FUZIS DE FERROLHO (sniper)
  { id: 'kar98k', slot: 'sniper', war: 2, c: 'Alemanha', n: 'Kar98k + ZF39', d: 'O fuzil alemão padrão com luneta ZF39, coronha de faia e alavanca curvada.', fx: { cavity: 0.45, scratches: 0.3 },
    build: () => boltRifle({ wood: 'faia', forend: 470, muzzle: 740, bolt: 'down', handguard: 200, bands: [330, 430], scope: 'zf39' }) },
  { id: 'gewehr98', slot: 'sniper', war: 1, c: 'Alemanha', n: 'Gewehr 98', d: 'O Mauser da Grande Guerra: longo, alavanca reta, sem luneta.', fx: { cavity: 0.5, scratches: 0.35, rust: 0.15 },
    build: () => boltRifle({ wood: 'nogueira', forend: 620, muzzle: 860, bolt: 'straight', handguard: 300, bands: [420, 580] }) },
  { id: 'mosin', slot: 'sniper', war: 2, c: 'URSS', n: 'Mosin-Nagant 91/30 PU', d: 'Alavanca reta comprida e luneta PU lateral.', fx: { cavity: 0.5, scratches: 0.35 },
    build: () => boltRifle({ wood: 'madeiraClara', forend: 520, muzzle: 790, bolt: 'straight', handguard: 240, bands: [360, 480], scope: 'pu' }) },
  { id: 'springfield', slot: 'sniper', war: 2, c: 'EUA', n: 'Springfield M1903A4', d: 'Fuzil de precisão americano com luneta fina M73.', fx: { cavity: 0.4, scratches: 0.3 },
    build: () => boltRifle({ wood: 'nogueira', metal: 'parkCinza', forend: 500, muzzle: 770, bolt: 'down', handguard: 220, bands: [350, 470], scope: 'm73' }) },
  { id: 'enfield4', slot: 'sniper', war: 2, c: 'Reino Unido', n: 'Lee-Enfield Nº 4 (T)', d: 'Carregador destacável de 10, cano à mostra e luneta Nº 32.', fx: { cavity: 0.45, scratches: 0.3 },
    build: () => boltRifle({ wood: 'faia', metal: 'acoPreto', forend: 460, muzzle: 720, bolt: 'enfield', handguard: 250, bands: [300, 440], mag: 'box', scope: 'no32' }) },

  // ======================= CARABINAS / SEMIAUTOMÁTICOS
  { id: 'm1carbine', slot: 'carbine', war: 2, c: 'EUA', n: 'M1 Carbine', d: 'Leve e curta, madeira clara e carregador de 15.', fx: { cavity: 0.4, scratches: 0.3 },
    build: () => semiRifle({ forend: 330, muzzle: 470, magLen: 60 }) },
  { id: 'garand', slot: 'carbine', war: 2, c: 'EUA', n: 'M1 Garand', d: 'O fuzil semiautomático americano, clipe interno de 8.', fx: { cavity: 0.4, scratches: 0.3 },
    build: () => semiRifle({ forend: 520, muzzle: 760, magLen: 14, wood: 'nogueira', gasTube: true }) },
  { id: 'g43', slot: 'carbine', war: 2, c: 'Alemanha', n: 'Gewehr 43', d: 'Semiautomático alemão, coronha laminada e carregador de 10.', fx: { cavity: 0.45, scratches: 0.3 },
    build: () => semiRifle({ forend: 480, muzzle: 700, wood: 'laminado', metal: 'acoOxidado', boltLeft: true, gasTube: true }) },
  { id: 'svt40', slot: 'carbine', war: 2, c: 'URSS', n: 'SVT-40', d: 'Tokarev semiautomático com freio de boca e carregador de 10.', fx: { cavity: 0.45, scratches: 0.3 },
    build: () => semiRifle({ forend: 420, muzzle: 690, wood: 'madeiraClara', metal: 'acoPreto', brake: true, gasTube: true }) },
  { id: 'smle', slot: 'carbine', war: 1, c: 'Reino Unido', n: 'SMLE Mk III', d: 'O Lee-Enfield da Grande Guerra: madeira até a boca e carregador de 10.', fx: { cavity: 0.5, scratches: 0.35, rust: 0.15 },
    build: () => boltRifle({ wood: 'nogueira', metal: 'acoPreto', forend: 640, muzzle: 680, bolt: 'enfield', handguard: 360, bands: [380, 560], mag: 'box' }) },

  // ======================= ESCOPETAS
  { id: 'win1897', slot: 'shotgun', war: 1, c: 'EUA', n: 'Winchester 1897 "Trench"', d: 'Pump com protetor de calor perfurado e baioneta, das duas guerras.', fx: { cavity: 0.45, scratches: 0.35 },
    build: () => ({ parts: [
      B(null, 'acoPreto', [28, 150, 50], [0, 10, -8]),
      C('Cano', 'acoPreto', 10, 500, [0, 330, 0]),
      C(null, 'perfurado', 16, 320, [0, 300, 2]),
      C(null, 'acoPreto', 8, 380, [0, 270, -22], { cell: 'tubo' }),
      C('Telha', 'nogueira', 15, 120, [0, 160, -22]),
      E(null, 'nogueira', [[-70, -6], [-70, 22], [-360, 0], [-360, -116], [-310, -120], [-90, -46]], 34, [0, 0, 0], { cell: 'coronha' }),
      B(null, 'acoGasto', [8, 16, 18], [0, -62, 14], { rot: [-25, 0, 0], cell: 'cao' }),
      B(null, 'acoPreto', [10, 30, 16], [0, 560, -16], { cell: 'baioneta' }),
      SP('Mira', 'latao', [3, 3, 3], [0, 575, 12]),
      ...trigger('acoPreto', 30, -10),
    ], muzzle: 580, support: [0, 160, -40], port: [18, 20, 4] }) },
  { id: 'ithaca37', slot: 'shotgun', war: 2, c: 'EUA', n: 'Ithaca 37 Trench', d: 'Pump da Segunda Guerra, ejeção por baixo e telha estriada.', fx: { cavity: 0.4, scratches: 0.3 },
    build: () => ({ parts: [
      B(null, 'parkCinza', [28, 160, 48], [0, 15, -8]),
      C('Cano', 'parkCinza', 10, 460, [0, 320, 0]),
      C(null, 'perfurado', 15, 280, [0, 300, 2]),
      C(null, 'parkCinza', 8, 340, [0, 260, -22], { cell: 'tubo' }),
      C('Telha', 'quadriculado', 15, 110, [0, 160, -22]),
      E(null, 'nogueira', [[-75, -6], [-75, 22], [-350, 0], [-350, -112], [-300, -116], [-95, -44]], 34, [0, 0, 0], { cell: 'coronha' }),
      SP('Mira', 'latao', [3, 3, 3], [0, 545, 12]),
      ...trigger('parkCinza', 30, -10),
    ], muzzle: 550, support: [0, 160, -40], port: [0, 20, -30] }) },
];

// ---------------------------------------------------------------- geometria
const D2R = Math.PI / 180;
function partGeometry(p) {
  let g;
  switch (p.kind) {
    case 'box': g = new THREE.BoxGeometry(p.s[0], p.s[1], p.s[2]); break;
    case 'cyl': g = new THREE.CylinderGeometry(p.r2 ?? p.r, p.r, p.l, p.seg || (p.r > 25 ? 16 : 10), 1); break;
    case 'lathe': g = new THREE.LatheGeometry(p.prof.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y)), p.seg || 12); break;
    case 'sph': g = new THREE.SphereGeometry(1, 14, 10); g.scale(p.r[0], p.r[1], p.r[2]); break;
    case 'torus': g = new THREE.TorusGeometry(p.R, p.tube, 6, 14); break;
    case 'ext': {
      const sh = new THREE.Shape(p.pts.map(([y, z]) => new THREE.Vector2(y, z)));
      g = new THREE.ExtrudeGeometry(sh, { depth: p.w, bevelEnabled: false });
      // (x_e, y_e, z_e) → (x = z_e - w/2, y = x_e, z = y_e)
      g.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, -p.w / 2, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1));
      break;
    }
  }
  if (p.axis === 'x') g.applyMatrix4(new THREE.Matrix4().makeRotationZ(-Math.PI / 2));
  if (p.axis === 'z') g.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  if (p.rot) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(p.rot[0] * D2R, p.rot[1] * D2R, p.rot[2] * D2R)));
  g.applyMatrix4(new THREE.Matrix4().makeTranslation(p.p[0], p.p[1], p.p[2]));
  if (!g.index) { const n = g.attributes.position.count; g.setIndex([...Array(n).keys()]); }
  g.computeVertexNormals();
  return g;
}

// Monta a malha final em mm com atlas UV: cada "célula" (parte) ganha um quadro da textura,
// dividido em 3 projeções (faces X, Y e Z) para não esticar.
export function buildPreset(def) {
  const spec = def.build();
  const parts = spec.parts;
  const cells = [], cellOf = parts.map((p, i) => { const key = p.cell ? p.cell + '|' + p.mat : '#' + i; let k = cells.indexOf(key); if (k < 0) { cells.push(key); k = cells.length - 1; } return k; });
  const n = cells.length, cols = Math.ceil(Math.sqrt(n * 2)), rows = Math.ceil(n / cols);
  const cw = 1 / cols, ch = 1 / rows, pad = 0.004;
  const pos = [], nrm = [], uv = [], tris = [], vpart = [];
  // bbox por célula (para normalizar a projeção)
  const geos = parts.map(partGeometry);
  const cb = cells.map(() => new THREE.Box3());
  geos.forEach((g, i) => { g.computeBoundingBox(); cb[cellOf[i]].union(g.boundingBox); });
  geos.forEach((g, pi) => {
    const P = g.attributes.position.array, N = g.attributes.normal.array, I = g.index.array, ci = cellOf[pi];
    const bx = cb[ci], mn = bx.min, sz = bx.getSize(new THREE.Vector3()).max(new THREE.Vector3(1e-3, 1e-3, 1e-3));
    const c0 = (ci % cols) * cw, r0 = Math.floor(ci / cols) * ch;
    const sub = [[c0 + pad, r0 + pad, cw * 0.5 - 2 * pad, ch - 2 * pad], [c0 + cw * 0.5 + pad, r0 + pad, cw * 0.5 - 2 * pad, ch * 0.5 - 2 * pad], [c0 + cw * 0.5 + pad, r0 + ch * 0.5 + pad, cw * 0.5 - 2 * pad, ch * 0.5 - 2 * pad]];
    const map = new Map();
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t], b = I[t + 1], c = I[t + 2];
      const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
      const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
      const fx = Math.abs(uy * vz - uz * vy), fy = Math.abs(uz * vx - ux * vz), fz = Math.abs(ux * vy - uy * vx);
      if (fx + fy + fz < 1e-9) continue;
      const ax = fx >= fy && fx >= fz ? 0 : fy >= fz ? 1 : 2;
      const out = [];
      for (const v of [a, b, c]) {
        const key = v * 3 + ax; let idx = map.get(key);
        if (idx === undefined) {
          idx = pos.length / 3; map.set(key, idx);
          const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
          pos.push(x, y, z); nrm.push(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]); vpart.push(pi);
          const [s0, s1] = ax === 0 ? [(y - mn.y) / sz.y, 1 - (z - mn.z) / sz.z] : ax === 1 ? [(x - mn.x) / sz.x, 1 - (z - mn.z) / sz.z] : [(x - mn.x) / sz.x, (y - mn.y) / sz.y];
          const r = sub[ax]; uv.push(r[0] + s0 * r[2], r[1] + s1 * r[3]);
        }
        out.push(idx);
      }
      // MD3/AC desenha com a ordem de vértices invertida em relação ao three.js
      tris.push(out[0], out[2], out[1]);
    }
    g.dispose();
  });
  return { spec, parts, cells, cellOf, cols, rows, pos, nrm, uv, tris, vpart };
}

// textura base do atlas: cinza neutro com ruído fino e bordas escurecidas (detalhe para os materiais)
export function atlasCanvas(B, w = 1024, h = 512) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = '#5a5a5a'; x.fillRect(0, 0, w, h);
  const cw = w / B.cols, ch = h / B.rows;
  for (let i = 0; i < B.cells.length; i++) {
    const c0 = (i % B.cols) * cw, r0 = Math.floor(i / B.cols) * ch;
    [[0, 0, 0.5, 1], [0.5, 0, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]].forEach(([a, b, ww, hh]) => {
      const X = c0 + a * cw, Y = r0 + b * ch, W = ww * cw, H = hh * ch;
      const g = x.createLinearGradient(X, Y, X, Y + H); g.addColorStop(0, '#9a9a9a'); g.addColorStop(0.5, '#8c8c8c'); g.addColorStop(1, '#7a7a7a');
      x.fillStyle = g; x.fillRect(X, Y, W, H);
      x.strokeStyle = 'rgba(30,30,30,0.55)'; x.lineWidth = 3; x.strokeRect(X + 2, Y + 2, W - 4, H - 4);
      x.strokeStyle = 'rgba(220,220,220,0.18)'; x.lineWidth = 1; x.strokeRect(X + 5, Y + 5, W - 10, H - 10);
    });
  }
  const im = x.getImageData(0, 0, w, h), d = im.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 14; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  x.putImageData(im, 0, 0);
  return c;
}

// ================================================================ FORJA: arma do zero por parâmetros
export const FORGE_FAMILIES = {
  pistol:  { n: 'Pistola', slot: 'pistol', d: 'Slide, armação e empunhadura.', p: { era: 'ww2', barrel: 110, body: 190, stock: 'nenhuma', mag: 'cabo', magLen: 30, grip: 'pistola', fore: 'nao', sight: 'ferro', muzzle: 'nenhum', wood: 'nogueira', metal: 'acoOxidado', jacket: 'nao', bipod: 'nao', bayonet: 'nao', side: 'direita' } },
  smg:     { n: 'Submetralhadora', slot: 'subgun', d: 'Compacta, automática, ferrolho aberto.', p: { era: 'ww2', barrel: 150, body: 260, stock: 'dobravel', mag: 'reto', magLen: 200, grip: 'pistola', fore: 'nao', sight: 'ferro', muzzle: 'nenhum', wood: 'baquelite', metal: 'acoOxidado', jacket: 'sim', bipod: 'nao', bayonet: 'nao', side: 'esquerda' } },
  assault: { n: 'Fuzil de assalto', slot: 'assault', d: 'Carregador curvo, seletor automático.', p: { era: 'ww2', barrel: 300, body: 330, stock: 'madeira', mag: 'curvo', magLen: 230, grip: 'pistola', fore: 'nao', sight: 'ferro', muzzle: 'freio', wood: 'nogueira', metal: 'acoOxidado', jacket: 'nao', bipod: 'nao', bayonet: 'nao', side: 'esquerda' } },
  bolt:    { n: 'Fuzil de ferrolho', slot: 'sniper', d: 'Ferrolho manual, coronha inteira de madeira.', p: { era: 'ww2', barrel: 360, body: 230, stock: 'inteira', mag: 'interno', magLen: 0, grip: 'reta', fore: 'nao', sight: 'luneta', muzzle: 'nenhum', wood: 'faia', metal: 'acoOxidado', jacket: 'nao', bipod: 'nao', bayonet: 'nao', side: 'direita' } },
  semi:    { n: 'Semiautomático / carabina', slot: 'carbine', d: 'Tiro a tiro, carregador destacável.', p: { era: 'ww2', barrel: 300, body: 220, stock: 'inteira', mag: 'reto', magLen: 70, grip: 'reta', fore: 'nao', sight: 'ferro', muzzle: 'nenhum', wood: 'madeiraClara', metal: 'parkCinza', jacket: 'nao', bipod: 'nao', bayonet: 'nao', side: 'direita' } },
  shotgun: { n: 'Escopeta', slot: 'shotgun', d: 'Pump com tubo de cartuchos.', p: { era: 'ww2', barrel: 460, body: 160, stock: 'madeira', mag: 'tubo', magLen: 0, grip: 'reta', fore: 'nao', sight: 'ferro', muzzle: 'nenhum', wood: 'nogueira', metal: 'acoPreto', jacket: 'sim', bipod: 'nao', bayonet: 'nao', side: 'direita' } },
};
export const FORGE_OPTIONS = {
  era: [['ww2', '2ª Guerra'], ['ww1', '1ª Guerra'], ['moderno', 'Moderna']],
  stock: [['nenhuma', 'Sem coronha'], ['madeira', 'Madeira'], ['inteira', 'Madeira inteira (até o cano)'], ['dobravel', 'Dobrável (hastes)'], ['esqueleto', 'Esqueleto (tubo)'], ['polimero', 'Polímero ajustável']],
  mag: [['reto', 'Reto'], ['curvo', 'Curvo'], ['tambor', 'Tambor'], ['lateral', 'Lateral (esquerda)'], ['interno', 'Interno'], ['tubo', 'Tubo (escopeta)'], ['cabo', 'No cabo (pistola)']],
  grip: [['pistola', 'Empunhadura de pistola'], ['reta', 'Reta (pulso da coronha)']],
  fore: [['nao', 'Sem punho frontal'], ['vertical', 'Punho vertical']],
  sight: [['ferro', 'Mira de ferro'], ['luneta', 'Luneta'], ['pontovermelho', 'Ponto vermelho + trilho']],
  muzzle: [['nenhum', 'Nenhum'], ['freio', 'Freio de boca'], ['supressor', 'Supressor'], ['compensador', 'Compensador inclinado']],
  jacket: [['nao', 'Não'], ['sim', 'Camisa perfurada']],
  bipod: [['nao', 'Não'], ['sim', 'Bipé']],
  bayonet: [['nao', 'Não'], ['sim', 'Baioneta']],
  side: [['direita', 'Direita'], ['esquerda', 'Esquerda']],
};
export function forgeBuild(fam, p) {
  const modern = p.era === 'moderno', m = modern ? 'acoPreto' : p.metal, w = modern ? 'polimero' : p.wood, P = [];
  const sx = p.side === 'esquerda' ? -1 : 1;
  if (fam === 'pistol') {
    const L = p.body, by = (p.barrel - 20) / 2;
    P.push(B('Ferrolho', m, [20, L, 24], [0, L / 2 - 70, 2]), B(null, m, [20, L * 0.65, 18], [0, L * 0.3 - 70, -18]));
    if (p.barrel > L - 60) P.push(C('Cano', m, 6, p.barrel - (L - 70) + 10, [0, (L - 70) + (p.barrel - (L - 70)) / 2, 2]));
    P.push(C(null, 'acoPreto', 6, 8, [0, Math.max(L - 70, p.barrel) - 2, 2], { cell: 'boca' }));
    P.push(E(null, w === 'baquelite' || w === 'polimero' ? w : 'quadriculado', [[-60, -24], [-24, -24], [-36, -110], [-76, -108]], 28, [0, 0, 0], { cell: 'cabo' }));
    P.push(B('Carregador', m, [16, 34, 10], [0, -58, -114], { rot: [12, 0, 0] }), B('Mira', m, [3, 6, 8], [0, L - 80, 18]), B('Mira', m, [12, 6, 8], [0, -60, 18]));
    P.push(...trigger(m, 26, -8));
    return { parts: P, muzzle: Math.max(L - 70, p.barrel) + 4, support: null, port: [12, 20, 10] };
  }
  const rear = -90, front = rear + p.body, mz = front + p.barrel, br = fam === 'shotgun' ? 10 : 8;
  P.push(B(null, m, [26, p.body, 34], [0, (rear + front) / 2, -2]));
  P.push(C('Cano', m, br, p.barrel + 10, [0, front + p.barrel / 2 - 5, 0]));
  if (p.jacket === 'sim') P.push(C(null, 'perfurado', br + 8, p.barrel * 0.62, [0, front + p.barrel * 0.31, 1]));
  // coronha
  if (p.stock === 'madeira') P.push(E(null, w, [[rear - 30, -6], [rear - 30, 18], [-360, -2], [-360, -116], [-310, -120], [rear - 50, -46]], 34, [0, 0, 0], { cell: 'coronha' }));
  if (p.stock === 'inteira') P.push(E(null, w, [[-380, -18], [-380, -135], [-340, -140], [-150, -62], [-70, -64], [-40, -30], [front + p.barrel * 0.6, -30], [front + p.barrel * 0.6, -14], [80, -12], [-30, -14], [-120, -24], [-310, -10]], 34, [0, 0, 0], { cell: 'coronha' }),
    B(null, w, [22, p.barrel * 0.45, 12], [0, front + p.barrel * 0.33, 12], { cell: 'guardamao' }));
  if (p.stock === 'dobravel') P.push(B(null, m, [4, 210, 6], [11, 10, -40], { cell: 'haste' }), B(null, m, [4, 210, 6], [-11, 10, -40], { cell: 'haste' }), B(null, m, [36, 6, 44], [0, 112, -48], { cell: 'soleira' }));
  if (p.stock === 'esqueleto') P.push(C(null, m, 5, 220, [0, rear - 110, -14], { cell: 'haste' }), B(null, m, [10, 8, 60], [0, rear - 220, -30], { cell: 'soleira' }));
  if (p.stock === 'polimero') P.push(E(null, 'polimero', [[rear - 10, 4], [-330, 0], [-330, -100], [-300, -104], [rear - 30, -30]], 32, [0, 0, 0], { cell: 'coronha' }), C(null, m, 9, 120, [0, rear - 60, -2], { cell: 'tubo' }));
  // empunhadura
  if (p.grip === 'pistola') P.push(grip(w === 'polimero' || w === 'baquelite' ? w : modern ? 'polimero' : w, -45, -22, 95, 16, 26));
  if (p.fore === 'vertical') P.push(E(null, w, [[front - 40, -18], [front - 5, -18], [front - 10, -100], [front - 42, -100]], 26, [0, 0, 0], { cell: 'punho' }));
  // carregador
  const my = Math.min(70, front - 60);
  if (p.mag === 'reto') P.push(B('Carregador', m, [18, 32, p.magLen], [0, my, -26 - p.magLen / 2]));
  if (p.mag === 'curvo') P.push(E('Carregador', m, [[my - 25, -24], [my + 25, -24], [my + 55, -24 - p.magLen * 0.45], [my + 95, -24 - p.magLen], [my + 50, -24 - p.magLen - 18], [my + 10, -24 - p.magLen * 0.5]], 22));
  if (p.mag === 'tambor') P.push(C('Carregador', m, 62, 40, [0, my, -86], { axis: 'x' }));
  if (p.mag === 'lateral') P.push(B('Carregador', m, [190, 30, 22], [-115, my, 0]), B(null, m, [40, 40, 30], [-24, my, 0], { cell: 'poço' }));
  if (p.mag === 'interno') P.push(B(null, m, [20, 90, 8], [0, 40, -40]));
  if (p.mag === 'tubo') { P.push(C(null, m, 8, p.barrel * 0.75, [0, front + p.barrel * 0.375, -22], { cell: 'tubo' })); P.push(C('Telha', w, 15, 120, [0, front + 70, -22])); }
  // mira
  if (p.sight === 'ferro') P.push(B('Mira', m, [12, 18, 12], [0, rear + 40, 22]), B('Mira', m, [3, 6, 14], [0, mz - 14, 14]));
  if (p.sight === 'luneta') P.push(C('Mira', 'acoPreto', 13, 220, [0, 10, 52]), L('Mira', 'acoPreto', [[0, 0], [19, 0], [19, 40], [13, 70], [0, 70]], [0, 100, 52], { cell: 'luneta' }), L('Mira', 'acoPreto', [[0, 0], [13, 0], [18, 30], [18, 55], [0, 55]], [0, -155, 52], { cell: 'luneta' }), B('Mira', 'acoPreto', [12, 16, 38], [0, -40, 32], { cell: 'montagem' }), B('Mira', 'acoPreto', [12, 16, 38], [0, 60, 32], { cell: 'montagem' }));
  if (p.sight === 'pontovermelho') P.push(B('Mira', 'recartilhado', [18, p.body * 0.8, 8], [0, (rear + front) / 2, 19]), B('Mira', 'acoPreto', [20, 50, 26], [0, 10, 34]), B('Mira', 'tracer', [12, 2, 14], [0, -14, 36], { cell: 'lente' }));
  // boca
  if (p.muzzle === 'freio') P.push(B(null, m, [22, 40, 22], [0, mz + 14, 0], { cell: 'freio' }));
  if (p.muzzle === 'supressor') P.push(C(null, 'acoPreto', br + 8, 150, [0, mz + 70, 0], { cell: 'supressor' }));
  if (p.muzzle === 'compensador') P.push(B(null, m, [30, 16, 34], [0, mz + 6, 0], { rot: [24, 0, 0], cell: 'freio' }));
  const tip = mz + (p.muzzle === 'supressor' ? 145 : p.muzzle === 'freio' ? 34 : 10);
  if (p.bipod === 'sim') P.push(B(null, m, [6, 220, 6], [8, mz - 120, -16], { cell: 'bipe' }), B(null, m, [6, 220, 6], [-8, mz - 120, -16], { cell: 'bipe' }));
  if (p.bayonet === 'sim') P.push(E(null, 'acoGasto', [[mz - 20, -14], [mz + 200, -10], [mz + 230, -16], [mz - 20, -24]], 4, [0, 0, 0], { cell: 'baioneta' }));
  // ferrolho
  if (fam === 'bolt') P.push(C('Ferrolho', 'acoGasto', 4, 46, [24, -12, -10], { axis: 'x', rot: [0, 0, -28], pivot: [0, -12, 0] }), SP('Ferrolho', 'acoGasto', [8, 8, 8], [44, -12, -24], { pivot: [0, -12, 0] }));
  else if (fam === 'semi') P.push(B('Ferrolho', 'acoGasto', [8, 34, 10], [17 * sx, 60, 4]));
  else P.push(C('Ferrolho', 'acoGasto', 4, 22, [24 * sx, 40, 4], { axis: 'x' }), SP('Ferrolho', 'acoGasto', [6, 6, 6], [37 * sx, 40, 4]));
  P.push(...trigger(m, 26, -10));
  const support = p.fore === 'vertical' ? [0, front - 22, -60] : p.mag === 'lateral' ? [-60, my, -16] : fam === 'shotgun' ? [0, front + 70, -40] : p.stock === 'inteira' ? [0, Math.min(front + p.barrel * 0.4, 260), -40] : [0, my, -50];
  return { parts: P, muzzle: tip, support, port: [16, 30, 8] };
}
export function forgeDef(fam, p, name) {
  const F = FORGE_FAMILIES[fam];
  return { id: 'forge-' + fam, slot: F.slot, war: p.era === 'ww1' ? 1 : 2, c: 'Forja', n: name || ('Forja · ' + F.n), d: F.d, forge: { fam, p: { ...p } }, fx: { cavity: 0.4, scratches: p.era === 'moderno' ? 0.1 : 0.25, rust: p.era === 'ww1' ? 0.15 : 0 }, build: () => forgeBuild(fam, p) };
}
