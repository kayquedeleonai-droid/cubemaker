// CUBE MAKER — embarcações do Dia D (praia de Omaha, 6 de junho de 1944), em escala real (mm; X = lateral, Y = proa, Z = cima).
// Medidas das fichas da US Navy / Royal Navy:
//  LCVP (Higgins)  11,05 × 3,30 m · poço de carga 5,26 × 2,39 × 1,52 m · 2 metralhadoras .30 em poços blindados à popa
//  LCA             12,65 × 3,05 m · blindado, bancos sob cobertura, abrigo blindado do patrão à frente (Rangers em Omaha)
//  LCM(3)          15,24 × 4,29 m · espaço de carga 9,75 × 2,90 m · casa do leme blindada à popa, 2 × .50
//  LCT(5)          35,81 × 9,75 m · rampa de proa, convés de tanques aberto, casaria e casa do leme à popa, 2 × 20 mm
//  LCI(L)          48,31 × 7,09 m · casco de navio, duas rampas laterais de desembarque na proa, torre quadrada
//  DUKW            9,45 × 2,44 m · caminhão anfíbio 6×6, hélice e leme na popa
import { B, C, L, E, SP, T, SG, LO, starPts, xform, TRS } from './geo.js';

// ---------------------------------------------------------------- ajudantes
// chapa horizontal com recortes: contorno em [y, x], espessura em Z
const plate = (g, mat, pts, th, z, o = {}) => E(g, mat, pts.map(([y, x]) => [y, x]), th, [0, 0, z], { ...o, rot: [0, 90, 0], holes: o.holes && o.holes.map(h => h.map(([y, x]) => [y, x])) });
const circ = (cy, cx, r, n = 14) => Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2; return [cy + Math.cos(a) * r, cx + Math.sin(a) * r]; });
function wheel(x, y, z, R, w, hub = 'oliva', g = null) {
  const r0 = R * 0.55;
  return [L(g, 'borracha', [[r0, -w / 2], [R - w * 0.25, -w / 2], [R, -w * 0.2], [R, w * 0.2], [R - w * 0.25, w / 2], [r0, w / 2]], [x, y, z], { axis: 'x', seg: 22, cell: 'pneu' }),
    C(g, hub, r0, w * 0.86, [x, y, z], { axis: 'x', seg: 18, cell: 'aro' }), C(g, hub, r0 * 0.35, w * 1.05, [x, y, z], { axis: 'x', seg: 10, cell: 'cubo' })];
}
// número do casco em segmentos (como estêncil pintado): side = +1 (boreste) / -1 (bombordo)
const SEG7 = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', P: 'abefg', A: 'abcefg', '-': 'g', L: 'def', C: 'adef', T: 'defg', I: 'bc', E: 'adefg', S: 'acdfg', U: 'bcdef' };
function hullText(txt, H, x, y0, zc, side, mat = 'branco') {
  const W = H * 0.56, t = H * 0.13, out = [], step = W + H * 0.22, dir = side > 0 ? 1 : -1;
  let y = y0;
  for (const ch of String(txt)) {
    if (ch === ' ') { y += dir * step * 0.6; continue; }
    const s = SEG7[ch] || '', cx = y + dir * W / 2;
    const seg = (k, a, b) => { if (!s.includes(k)) return; out.push(B(null, mat, [8, a[0], a[1]], [x + side * 4, cx + dir * b[0], zc + b[1]], { cell: 'numero' })); };
    seg('a', [W, t], [0, H / 2 - t / 2]); seg('d', [W, t], [0, -H / 2 + t / 2]); seg('g', [W, t], [0, 0]);
    seg('f', [t, H / 2], [-W / 2 + t / 2, H / 4]); seg('b', [t, H / 2], [W / 2 - t / 2, H / 4]);
    seg('e', [t, H / 2], [-W / 2 + t / 2, -H / 4]); seg('c', [t, H / 2], [W / 2 - t / 2, -H / 4]);
    y += dir * step;
  }
  return out;
}
// metralhadora (Browning .30 / .50) num pino, apontando para a frente
function mg(x, y, z, cal = 30, g = null) {
  const k = cal === 50 ? 1.45 : 1, P = [];
  P.push(SG(g, 'acoPreto', [x, y, z], [x, y, z + 520 * k], 26 * k, { seg: 8, cell: 'pino' }));
  P.push(B(g, 'acoPreto', [110 * k, 520 * k, 150 * k], [x, y + 40, z + 600 * k], { bev: 8, cell: 'caixa_mg' }));
  P.push(C(g, 'acoPreto', 30 * k, 700 * k, [x, y + 650 * k, z + 610 * k], { seg: 10, cell: 'cano_mg' }));
  if (cal === 50) P.push(C(g, 'acoPreto', 40 * k, 480 * k, [x, y + 520 * k, z + 610 * k], { seg: 10, cell: 'camisa' }));
  else P.push(C(g, 'acoPreto', 44, 380, [x, y + 450, z + 610], { seg: 10, cell: 'camisa' }));
  P.push(B(g, 'oliva', [120 * k, 180 * k, 140 * k], [x - 120 * k, y + 40, z + 560 * k], { bev: 10, cell: 'cunhete' }));
  P.push(B(g, 'acoPreto', [60, 120, 160], [x, y - 260 * k, z + 560 * k], { bev: 10, cell: 'punho_mg' }));
  return P;
}
// Oerlikon 20 mm com escudo, num poço circular
function oerlikon(x, y, z, yaw = 0, g = null) {
  const P = [L(g, 'cinzaNevoa', [[0, 0], [900, 0], [900, 1000], [860, 1000], [860, 60], [0, 60]], [x, y, z], { axis: 'z', seg: 22, cell: 'poco20' }),
    SG(g, 'acoPreto', [x, y, z + 60], [x, y, z + 1100], 70, { seg: 10, cell: 'pedestal' }),
    B(g, 'cinzaNevoa', [1100, 30, 800], [x, y + 260, z + 1350], { rot: [-8, 0, 0], cell: 'escudo20' }),
    C(g, 'acoPreto', 45, 2200, [x, y + 800, z + 1350], { rot: [-6, 0, 0], seg: 10, cell: 'cano20' }),
    C(g, 'acoPreto', 140, 380, [x - 120, y - 50, z + 1500], { axis: 'z', seg: 12, cell: 'tambor20' }),
    B(g, 'acoPreto', [500, 80, 60], [x, y - 350, z + 1250], { cell: 'ombreira' })];
  return P;
}

// ---------------------------------------------------------------- LCVP (barco Higgins)
// rampa: 'up' fechada, 'down' arriada na areia, 'anim' anima a descida
function lcvp(v) {
  const P = [], hull = v.cor || 'cinzaOceano', HB = 1650, Y0 = -5525, YB = 4880, ZF = 420, ZW = 1940, ZS = 1480;
  // fundo: casco de compensado com quinas arredondadas, popa funda, proa rasa
  const zb = y => y < -3000 ? 120 : y < 2500 ? 120 + (y + 3000) / 5500 * 40 : 160 + (y - 2500) / 2400 * 230;
  P.push(LO(null, 'antiIncrust', [-5525, -5000, -2000, 1000, 2500, 3600, 4400, 4880].map(y => { const b = zb(y), top = 600; return { y, w: HB - (y > 4300 ? (y - 4300) * 0.08 : 0), ht: (top - b) / 2, hb: (top - b) / 2, z: (top + b) / 2, n: 5 }; }), [0, 0, 0], { seg: 18, cell: 'fundo' }));
  // costados (compensado naval pintado), mais altos no poço de carga
  const side = [[Y0, 560], [YB, 560], [YB, ZW], [-2350, ZW], [-2600, ZS + 180], [Y0, ZS]];
  [-1, 1].forEach(s => {
    P.push(E(null, hull, side, 70, [s * (HB - 35), 0, 0], { bev: 6, cell: 'costado' }));
    // chapas de blindagem aparafusadas na frente do poço e frisos de defensa
    for (let k = 0; k < 4; k++) P.push(B(null, hull, [14, 1700, 980], [s * (HB + 4), -1450 + k * 1720, 1400], { bev: 3, cell: 'blindagem' }));
    P.push(B(null, 'tabuas', [70, 10300, 90], [s * (HB + 30), -380, 1080], { bev: 20, cell: 'defensa' }));
    P.push(B(null, 'tabuas', [60, 10300, 70], [s * (HB + 25), -380, 640], { bev: 16, cell: 'defensa' }));
    P.push(B(null, hull, [120, 7300, 60], [s * (HB - 30), 1260, ZW + 30], { bev: 12, cell: 'braçola' }));
    // olhais de içamento
    [3800, -3900].forEach(y => P.push(T(null, 'acoPreto', 70, 16, [s * (HB - 120), y, (y > 0 ? ZW : ZS) + 70], { rot: [0, 90, 0], seg: [5, 10], cell: 'olhal' })));
    P.push(...hullText(v.num || 'PA26-15', 300, s * (HB + 18), s > 0 ? 1500 : 4600, 1580, s));
  });
  // piso do poço (tábuas) e anteparo de ré do poço
  P.push(B(null, 'tabuas', [2 * HB - 160, YB - -2350 - 80, 50], [0, (YB - 2350) / 2, ZF + 180], { cell: 'piso' }));
  for (let k = 0; k < 9; k++) P.push(B(null, hull, [2 * HB - 200, 60, 70], [0, -2000 + k * 760, ZF + 230], { cell: 'caverna' }));
  P.push(B(null, hull, [2 * HB - 140, 70, ZW - ZF - 60], [0, -2380, (ZW + ZF + 60) / 2], { cell: 'antepara' }));
  // convés de ré com o motor, cabine do patrão e os dois poços das metralhadoras
  const deck = [[-2420, -HB + 60], [-2420, HB - 60], [Y0 + 60, HB - 60], [Y0 + 60, -HB + 60]];
  P.push(plate(null, hull, deck, 50, ZS - 20, { holes: [circ(-4450, -1000, 470), circ(-4450, 1000, 470), [[-3250, 200], [-3250, 1100], [-4000, 1100], [-4000, 200]]], cell: 'convesre' }));
  P.push(B(null, hull, [1150, 1700, 520], [-250, -3150, ZS + 240], { bev: 40, cell: 'caixa_motor' }));
  P.push(B(null, 'acoGasto', [700, 900, 30], [-250, -3150, ZS + 510], { cell: 'tampa_motor' }));
  for (let k = 0; k < 6; k++) P.push(B(null, 'acoPreto', [500, 40, 20], [-250, -2800 - k * 140, ZS + 530], { cell: 'grelha' }));
  // patrão (timoneiro) a boreste: roda de leme e alavanca
  P.push(B(null, hull, [1000, 760, 760], [650, -3620, ZS - 360], { cell: 'cockpit' }));
  P.push(T(null, 'acoPreto', 260, 22, [650, -3300, ZS + 560], { rot: [70, 0, 0], seg: [6, 20], cell: 'roda' }), SG(null, 'acoPreto', [650, -3300, ZS + 560], [650, -3150, ZS + 200], 30, { seg: 8 }));
  P.push(SG(null, 'acoPreto', [950, -3350, ZS + 100], [950, -3350, ZS + 520], 18, { seg: 6 }), SP(null, 'vermelho', [36, 36, 36], [950, -3350, ZS + 540], { seg: [8, 6] }));
  // poços blindados circulares das .30 e metralhadoras
  [-1, 1].forEach(s => {
    P.push(L(null, hull, [[440, -400], [480, -400], [480, 560], [440, 560]], [s * 1000, -4450, ZS], { axis: 'z', seg: 20, cell: 'poco' }));
    P.push(...mg(s * 1000, -4450, ZS + 300));
  });
  P.push(B(null, hull, [2 * HB - 100, 50, 360], [0, -4980, ZS + 160], { bev: 8, cell: 'quebra_mar' }));
  // popa: espelho, poste de reboque (Sampson), bocais de combustível
  P.push(B(null, hull, [2 * HB - 40, 80, ZS - 300], [0, Y0 + 40, (ZS + 300) / 2], { bev: 10, cell: 'espelho' }));
  P.push(C(null, 'acoGasto', 70, 420, [0, -5250, ZS + 200], { axis: 'z', seg: 10, cell: 'sampson' }), C(null, 'acoGasto', 40, 360, [0, -5250, ZS + 340], { axis: 'x', seg: 8, cell: 'sampson' }));
  [-1, 1].forEach(s => P.push(C(null, 'latao', 50, 40, [s * 500, -5380, ZS + 20], { axis: 'z', seg: 10, cell: 'bocal' })));
  // quilha (skeg), leme e hélice
  P.push(E(null, 'antiIncrust', [[-5300, 120], [-1200, 120], [-2400, 0], [-5300, 0]], 120, [0, 0, 0], { cell: 'quilha' }));
  P.push(B(null, 'acoGasto', [40, 380, 560], [0, -5560, 420], { bev: 6, cell: 'leme' }));
  P.push(C(null, 'latao', 70, 160, [0, -5180, 300], { seg: 10, cell: 'helice' }));
  for (let k = 0; k < 3; k++) { const a = k * 120; P.push(B(null, 'latao', [20, 120, 210], [0, -5180, 300], { rot: [0, a, 25], cell: 'pa' })); }
  // rampa de aço: reforços por fora, travessas antiderrapantes por dentro, janela do patrão, cabos ao guincho
  const ramp = [];
  const RH = ZW - 380, RW = 2 * HB - 240;
  ramp.push(B('Rampa', hull, [RW, 90, RH], [0, YB + 45, ZF + RH / 2 - 40], { bev: 10, cell: 'rampa' }));
  for (let k = 0; k < 5; k++) ramp.push(B('Rampa', hull, [90, 70, RH - 120], [-RW / 2 + 260 + k * (RW - 520) / 4, YB + 125, ZF + RH / 2 - 40], { cell: 'reforco' }));
  for (let k = 0; k < 3; k++) ramp.push(B('Rampa', hull, [RW - 120, 70, 90], [0, YB + 125, ZF + 260 + k * (RH - 500) / 2], { cell: 'reforco' }));
  for (let k = 0; k < 9; k++) ramp.push(B('Rampa', 'tabuas', [RW - 300, 40, 50], [0, YB - 20, ZF + 120 + k * (RH - 260) / 8], { cell: 'travessa' }));
  ramp.push(B('Rampa', 'preto', [520, 30, 300], [0, YB + 100, ZF + RH - 380], { cell: 'janela' }), B('Rampa', hull, [600, 24, 340], [0, YB + 115, ZF + RH - 390], { rot: [12, 0, 0], cell: 'tampa_janela' }));
  [-1, 1].forEach(s => ramp.push(T('Rampa', 'acoPreto', 60, 14, [s * (RW / 2 - 120), YB - 40, ZF + RH - 120], { rot: [0, 90, 0], seg: [5, 10], cell: 'olhal_rampa' })));
  // a rampa gira na dobradiça de baixo (y = YB, z = ZF − 40)
  const ang = v.rampa === 'down' ? -98 : -6, hinge = [0, YB, ZF - 40], rr = ang * Math.PI / 180;
  ramp.forEach(p => P.push({ ...p, M: rotX(rr, hinge) }));
  // cabos da rampa ao guincho (só fechada)
  // cabos: do topo da rampa até uma roldana na borda da proa e dali pela borda até o guincho
  [-1, 1].forEach(s => {
    const sh = [s * (HB - 110), YB - 250, ZW + 110];
    P.push(C(null, 'acoPreto', 70, 60, sh, { axis: 'x', seg: 10, cell: 'roldana' }));
    if (v.rampa !== 'down') P.push(SG(null, 'acoPreto', [s * (RW / 2 - 120), YB + 30, ZF + RH - 120], sh, 12, { seg: 5, cell: 'cabo' }));
    P.push(SG(null, 'acoPreto', sh, [s * (HB - 110), -2300, ZW + 110], 12, { seg: 5, cell: 'cabo' }), SG(null, 'acoPreto', [s * (HB - 110), -2300, ZW + 110], [500, -2500, ZW - 120], 12, { seg: 5, cell: 'cabo' }));
  });
  P.push(...[-1, 1].map(s => C(null, 'acoGasto', 70, 220, [s * (RW / 2 + 60), YB, ZF - 40], { axis: 'x', seg: 10, cell: 'dobradica' })));
  // guincho da rampa no anteparo (boreste do motor)
  P.push(C(null, 'acoPreto', 140, 420, [500, -2500, ZW - 120], { axis: 'x', seg: 12, cell: 'guincho' }), B(null, 'acoPreto', [500, 200, 260], [500, -2560, ZW - 320], { cell: 'guincho' }));
  return { parts: P };
}
function rotX(a, [hx, hy, hz]) {                    // rotação em torno de X passando pela dobradiça (matriz 4×4 em coluna)
  const c = Math.cos(a), s = Math.sin(a);
  // T(h) · Rx(a) · T(−h)
  return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, hy - c * hy + s * hz, hz - s * hy - c * hz, 1];
}

// ---------------------------------------------------------------- LCA (Landing Craft Assault, britânico)
function lca(v) {
  const P = [], hull = v.cor || 'cinzaRN', HB = 1525, Y0 = -6325, YB = 5800, ZT = 1480;
  const zb = y => y < 3000 ? 110 : 110 + (y - 3000) / 2800 * 260;
  P.push(LO(null, 'antiIncrust', [-6325, -5600, -2000, 2000, 3500, 4800, 5800].map(y => { const b = zb(y), top = 600; return { y, w: HB - (y > 4800 ? (y - 4800) * 0.25 : 0), ht: (top - b) / 2, hb: (top - b) / 2, z: (top + b) / 2, n: 4 }; }), [0, 0, 0], { seg: 18, cell: 'fundo' }));
  [-1, 1].forEach(s => {
    P.push(E(null, hull, [[Y0, 560], [YB, 560], [YB, ZT + 120], [Y0 + 400, ZT], [Y0, ZT - 150]], 60, [s * (HB - 30), 0, 0], { bev: 6, cell: 'costado' }));
    P.push(B(null, 'tabuas', [70, 11800, 80], [s * (HB + 30), -260, 900], { bev: 20, cell: 'defensa' }));
    // convés lateral blindado sobre os bancos (fileiras de fora cobertas)
    P.push(B(null, hull, [800, 7600, 40], [s * (HB - 430), 600, ZT + 10], { bev: 6, cell: 'cobertura' }));
    P.push(B(null, 'tabuas', [380, 7400, 60], [s * (HB - 380), 600, 760], { cell: 'banco' }));
  });
  P.push(B(null, 'tabuas', [700, 7400, 60], [0, 600, 760], { cell: 'banco_meio' }));
  P.push(B(null, 'tabuas', [2 * HB - 120, 8000, 40], [0, 700, 630], { cell: 'piso' }));
  // anteparo blindado de proa com as duas portas, abrigo do patrão (boreste) e posto do Bren (bombordo)
  P.push(B(null, hull, [2 * HB - 80, 80, ZT - 500], [0, 4800, (ZT + 500) / 2 + 60], { cell: 'antepara_proa' }));
  [-1, 1].forEach(s => P.push(B(null, hull, [560, 40, 1000], [s * 300, 4860, 1060], { rot: [0, 0, s * 25], cell: 'porta' })));
  P.push(B(null, hull, [800, 900, 620], [HB - 520, 4300, ZT + 300], { bev: 30, cell: 'abrigo' }), B(null, 'preto', [600, 20, 70], [HB - 520, 4760, ZT + 450], { cell: 'visor' }));
  P.push(B(null, hull, [700, 700, 420], [-HB + 470, 4400, ZT + 200], { bev: 30, cell: 'posto_bren' }));
  P.push(SG(null, 'acoPreto', [-HB + 470, 4500, ZT + 420], [-HB + 470, 5300, ZT + 470], 22, { seg: 6, cell: 'bren' }), B(null, 'acoPreto', [60, 120, 220], [-HB + 470, 4700, ZT + 560], { rot: [0, 0, 0], cell: 'carregador_bren' }));
  // rampa de proa (estreita) e casco da proa
  const ramp = [B('Rampa', hull, [1500, 80, 1150], [0, YB + 40, 1040], { bev: 10, cell: 'rampa' })];
  for (let k = 0; k < 6; k++) ramp.push(B('Rampa', 'tabuas', [1300, 30, 40], [0, YB - 10, 600 + k * 160], { cell: 'travessa' }));
  const ang = v.rampa === 'down' ? -100 : -4, hinge = [0, YB, 480];
  ramp.forEach(p => P.push({ ...p, M: rotX(ang * Math.PI / 180, hinge) }));
  [-1, 1].forEach(s => P.push(B(null, hull, [520, 700, ZT - 450], [s * (HB - 300), YB - 300, (ZT + 450) / 2 + 60], { cell: 'bochecha' })));
  // popa: convés sobre os motores, espelho, dois lemes
  P.push(B(null, hull, [2 * HB - 60, 2400, 40], [0, -5100, ZT - 60], { cell: 'conves_motor' }));
  P.push(B(null, hull, [900, 1200, 300], [0, -4700, ZT + 100], { bev: 30, cell: 'escotilha_motor' }));
  P.push(B(null, hull, [2 * HB - 40, 70, ZT - 450], [0, Y0 + 40, (ZT + 450) / 2], { cell: 'espelho' }));
  [-1, 1].forEach(s => P.push(B(null, 'acoGasto', [30, 300, 460], [s * 500, Y0 - 120, 380], { cell: 'leme' }), C(null, 'latao', 60, 140, [s * 500, Y0 + 250, 260], { seg: 10, cell: 'helice' })));
  P.push(C(null, 'acoGasto', 40, 1400, [0, -6000, ZT + 700], { axis: 'z', seg: 8, cell: 'mastro' }));
  return { parts: P };
}

// ---------------------------------------------------------------- LCM(3)
function lcm3(v) {
  const P = [], hull = v.cor || 'cinzaOceano', HB = 2145, Y0 = -7620, YB = 6900, ZF = 560, ZW = 2000;
  P.push(LO(null, 'antiIncrust', [-7620, -7000, -3000, 3000, 5200, 6500, 6900].map(y => { const b = y > 5200 ? 140 + (y - 5200) / 1700 * 360 : 140, top = 700; return { y, w: HB, ht: (top - b) / 2, hb: (top - b) / 2, z: (top + b) / 2, n: 8 }; }), [0, 0, 0], { seg: 20, cell: 'fundo' }));
  [-1, 1].forEach(s => {
    P.push(E(null, hull, [[Y0, 640], [YB, 640], [YB, ZW], [-2700, ZW], [-3000, ZW - 300], [Y0, ZW - 300]], 300, [s * (HB - 150), 0, 0], { bev: 10, cell: 'costado' }));   // tanques laterais (casco duplo)
    for (let k = 0; k < 6; k++) P.push(B(null, hull, [20, 60, ZW - 700], [s * (HB + 8), -2300 + k * 1700, (ZW + 700) / 2], { cell: 'nervura' }));
    P.push(B(null, 'borracha', [120, 14000, 160], [s * (HB + 40), -400, 1150], { bev: 40, cell: 'defensa' }));
    [-2600, 6600].forEach(y => P.push(C(null, 'acoGasto', 90, 120, [s * (HB - 150), y, ZW + 60], { axis: 'z', seg: 10, cell: 'cabeco' })));
    P.push(...hullText(v.num || '33', 420, s * (HB + 10), s > 0 ? 3200 : 4300, 1400, s));
  });
  P.push(B(null, 'acoGasto', [2 * HB - 600, 9750, 40], [0, 1950, ZF + 170], { cell: 'piso' }));
  for (let k = 0; k < 10; k++) P.push(B(null, 'acoGasto', [2 * HB - 650, 50, 40], [0, -2700 + k * 1000, ZF + 180], { cell: 'nervura_piso' }));
  // popa: casa do leme blindada com visores, duas .50, ventiladores e lazareto
  P.push(B(null, hull, [2 * HB - 60, 4800, 60], [0, -5200, ZW - 300], { cell: 'conves' }));
  P.push(B(null, hull, [1300, 1200, 1250], [-500, -4100, ZW + 325], { bev: 30, cell: 'casa_leme' }));
  for (let k = 0; k < 3; k++) P.push(B(null, 'preto', [220, 20, 70], [-850 + k * 350, -3495, ZW + 760], { cell: 'visor' }));
  [-1, 1].forEach(s => P.push(...mg(s * 1300, -4800, ZW - 270, 50)));
  [[-1300, -6200], [1300, -6200], [-1300, -3200], [1300, -3200]].forEach(([x, y]) => P.push(L(null, hull, [[0, 0], [110, 0], [110, 380], [190, 520], [190, 620], [0, 620]], [x, y, ZW - 270], { axis: 'z', seg: 12, cell: 'ventilador' })));
  P.push(B(null, hull, [2 * HB - 40, 80, ZW - 700], [0, Y0 + 40, (ZW + 400) / 2], { cell: 'espelho' }));
  [-1, 1].forEach(s => P.push(B(null, 'acoGasto', [36, 420, 600], [s * 700, Y0 - 140, 440], { cell: 'leme' }), C(null, 'latao', 80, 160, [s * 700, Y0 + 280, 330], { seg: 10, cell: 'helice' })));
  P.push(E(null, 'antiIncrust', [[-7500, 140], [-3000, 140], [-4200, 0], [-7500, 0]], 140, [0, 0, 0], { cell: 'quilha' }));
  // rampa de proa (operada pelo motor de bombordo), com correntes
  const RW = 2 * HB - 700, RH = ZW - 300, ramp = [B('Rampa', hull, [RW, 110, RH], [0, YB + 55, ZF + RH / 2], { bev: 12, cell: 'rampa' })];
  for (let k = 0; k < 6; k++) ramp.push(B('Rampa', hull, [100, 80, RH - 120], [-RW / 2 + 200 + k * (RW - 400) / 5, YB + 140, ZF + RH / 2], { cell: 'reforco' }));
  for (let k = 0; k < 10; k++) ramp.push(B('Rampa', 'acoGasto', [RW - 200, 40, 40], [0, YB - 20, ZF + 150 + k * (RH - 300) / 9], { cell: 'travessa' }));
  const ang = v.rampa === 'down' ? -100 : -5, hinge = [0, YB, ZF];
  ramp.forEach(p => P.push({ ...p, M: rotX(ang * Math.PI / 180, hinge) }));
  if (v.rampa !== 'down') [-1, 1].forEach(s => P.push(SG(null, 'acoPreto', [s * (RW / 2 - 60), YB + 60, ZF + RH - 40], [s * (HB - 300), YB - 900, ZW + 300], 20, { seg: 6, cell: 'corrente' })));
  [-1, 1].forEach(s => P.push(B(null, hull, [260, 260, 600], [s * (HB - 300), YB - 900, ZW + 300], { cell: 'torre_corrente' })));
  return { parts: P };
}

// ---------------------------------------------------------------- LCT(5)
function lct5(v) {
  const P = [], hull = v.cor || 'cinzaOceano', HB = 4875, Y0 = -17900, YB = 17000, ZD = 1100, ZW = 2900;
  P.push(LO(null, 'antiIncrust', [Y0, Y0 + 900, -10000, 10000, 15500, YB].map(y => { const b = y > 15500 ? 180 + (y - 15500) / 1500 * 500 : 180, top = 1080; return { y, w: HB, ht: (top - b) / 2, hb: (top - b) / 2, z: (top + b) / 2, n: 10 }; }), [0, 0, 0], { seg: 22, cell: 'fundo' }));
  [-1, 1].forEach(s => {
    // costado/borda falsa com compartimentos laterais
    P.push(E(null, hull, [[Y0, 1200], [YB, 1200], [YB, ZW], [Y0, ZW]], 900, [s * (HB - 450), 0, 0], { bev: 12, cell: 'costado' }));
    P.push(B(null, hull, [920, 34000, 40], [s * (HB - 450), -400, ZW + 20], { cell: 'passadico' }));
    for (let k = 0; k < 9; k++) P.push(C(null, 'acoGasto', 90, 110, [s * (HB - 200), -15000 + k * 3800, ZW + 80], { axis: 'z', seg: 10, cell: 'cabeco' }));
    P.push(B(null, 'borracha', [150, 32000, 180], [s * (HB + 60), 0, 1700], { bev: 40, cell: 'defensa' }));
    P.push(...hullText(v.num || '305', 900, s * (HB + 10), s > 0 ? 9000 : 12300, 2150, s));
    for (let k = 0; k < 12; k++) P.push(B(null, 'acoGasto', [40, 34000 / 12 - 120, 60], [s * (HB - 920), -15500 + k * (34000 / 12), ZW - 200], { cell: 'corrimao' }));
  });
  // convés de tanques com olhais de amarração
  P.push(B(null, 'acoGasto', [2 * HB - 1800, 30000, 60], [0, 1500, ZD + 30], { cell: 'conves_tanques' }));
  for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) P.push(T(null, 'acoPreto', 70, 14, [-2000 + j * 2000, -12000 + i * 5000, ZD + 80], { seg: [4, 8], cell: 'olhal' }));
  // popa: casaria, casa do leme blindada, mastro, Oerlikons e guincho da âncora de popa
  const zh = ZW + 60;
  P.push(B(null, hull, [2 * HB - 1800, 5200, 2400], [0, -15100, ZD + 1200], { bev: 40, cell: 'casaria' }));
  for (let k = 0; k < 4; k++) P.push(C(null, 'vidro', 130, 40, [(k % 2 ? 1 : -1) * (HB - 900 + 10), -14200 - Math.floor(k / 2) * 1800, ZD + 1700], { axis: 'x', seg: 14, cell: 'vigia' }));
  P.push(B(null, hull, [3200, 2400, 2000], [0, -14400, zh + 1000], { bev: 40, cell: 'casa_leme' }));
  for (let k = 0; k < 5; k++) P.push(B(null, 'preto', [420, 20, 140], [-1100 + k * 550, -13190, zh + 1600], { cell: 'visor' }));
  P.push(C(null, 'acoGasto', 110, 7500, [0, -14800, zh + 2000 + 3750], { axis: 'z', seg: 10, r2: 60, cell: 'mastro' }), C(null, 'acoGasto', 50, 2600, [0, -14800, zh + 2000 + 5500], { axis: 'x', seg: 8, cell: 'verga' }));
  P.push(B(null, 'cinzaNevoa', [1400, 900, 800], [0, -14400, zh + 2400], { bev: 20, cell: 'ponte' }));
  [-1, 1].forEach(s => P.push(...oerlikon(s * (HB - 450), -11500, ZW + 40)));
  P.push(C(null, 'acoPreto', 500, 1800, [0, -17400, ZW + 700], { axis: 'x', seg: 16, cell: 'guincho' }), B(null, 'acoPreto', [600, 2200, 1800], [0, -17300, ZW + 900], { rot: [30, 0, 0], cell: 'ancora' }));
  P.push(B(null, hull, [2 * HB - 40, 120, ZW - 300], [0, Y0 + 60, (ZW + 300) / 2], { cell: 'espelho' }));
  [-1, 0, 1].forEach(s => P.push(B(null, 'acoGasto', [60, 900, 1100], [s * 2600, Y0 - 300, 750], { cell: 'leme' }), C(null, 'latao', 160, 300, [s * 2600, Y0 + 500, 500], { seg: 12, cell: 'helice' })));
  // rampa de proa com correntes e pórtico
  const RW = 2 * HB - 2400, RH = 3000, ramp = [B('Rampa', hull, [RW, 180, RH], [0, YB + 90, ZD + RH / 2 - 100], { bev: 14, cell: 'rampa' })];
  for (let k = 0; k < 8; k++) ramp.push(B('Rampa', hull, [140, 120, RH - 200], [-RW / 2 + 300 + k * (RW - 600) / 7, YB + 220, ZD + RH / 2 - 100], { cell: 'reforco' }));
  for (let k = 0; k < 14; k++) ramp.push(B('Rampa', 'acoGasto', [RW - 300, 50, 60], [0, YB - 30, ZD + 150 + k * (RH - 400) / 13], { cell: 'travessa' }));
  const ang = v.rampa === 'down' ? -104 : -8, hinge = [0, YB, ZD];
  ramp.forEach(p => P.push({ ...p, M: rotX(ang * Math.PI / 180, hinge) }));
  [-1, 1].forEach(s => { P.push(B(null, hull, [500, 500, 2600], [s * (RW / 2 + 500), YB - 400, ZW + 1300], { bev: 20, cell: 'portico' })); if (v.rampa !== 'down') P.push(SG(null, 'acoPreto', [s * (RW / 2 - 80), YB + 120, ZD + RH - 200], [s * (RW / 2 + 500), YB - 400, ZW + 2500], 35, { seg: 6, cell: 'corrente' })); });
  P.push(B(null, hull, [2 * HB - 1800, 800, 2000], [0, YB - 600, ZD + 1000], { cell: 'proa' }));
  return { parts: P };
}

// ---------------------------------------------------------------- LCI(L) (rampas laterais, torre quadrada)
function lcil(v) {
  const P = [], hull = v.cor || 'cinzaOceano', L0 = -24155, LB = 24155, HB = 3545, ZD = 3100;
  // casco de navio: proa afilada, fundo chato
  const sec = [[L0, 0.92], [L0 + 1500, 1], [-8000, 1], [12000, 1], [18000, 0.86], [21500, 0.55], [23300, 0.26], [LB, 0.04]];
  P.push(LO(null, hull, sec.map(([y, k]) => ({ y, w: HB * k, ht: (ZD - 200 + (y > 12000 ? (y - 12000) / 12000 * 700 : 0)) / 2, hb: (ZD - 200) / 2, z: (ZD - 200) / 2 + 200, n: y > 18000 ? 2.4 : 6 })), [0, 0, 0], { seg: 24, cell: 'casco' }));
  P.push(LO(null, 'antiIncrust', sec.map(([y, k]) => ({ y, w: HB * k + 15, ht: 250, hb: 250, z: 400, n: y > 18000 ? 2.4 : 6 })), [0, 0, 0], { seg: 24, cell: 'linha_dagua' }));
  // borda falsa e convés
  P.push(B(null, 'acoGasto', [2 * HB - 300, 34000, 40], [0, -4000, ZD + 20], { cell: 'conves' }));
  [-1, 1].forEach(s => {
    for (let k = 0; k < 16; k++) P.push(C(null, 'acoGasto', 25, 1000, [s * (HB - 120), -20000 + k * 2400, ZD + 500], { axis: 'z', seg: 6, cell: 'balaustre' }));
    P.push(C(null, 'acoGasto', 22, 38000, [s * (HB - 120), -1200, ZD + 1000], { seg: 6, cell: 'corrimao' }));
    P.push(...hullText(v.num || 'LCI-92', 800, s * (HB + 10), s > 0 ? 14200 : 19800, 2300, s));
    // rampas laterais: passarela no convés de proa e rampa arriada até a água
    const down = v.rampa !== 'up';
    P.push(B(null, 'acoGasto', [1100, 6000, 80], [s * (HB - 700), 17500, ZD + 900], { cell: 'passarela' }));
    const rp = [B(null, 'acoGasto', [1000, 9000, 60], [0, 0, 0], { cell: 'rampa_lateral' }), ...[-1, 1].map(q => B(null, 'acoGasto', [50, 9000, 600], [q * 480, 0, 300], { cell: 'guarda_rampa' }))];
    for (let k = 0; k < 14; k++) rp.push(B(null, 'tabuas', [900, 50, 40], [0, -4300 + k * 650, 60], { cell: 'degrau' }));
    const ry = 20500, rz = ZD + 900, pitch = down ? -26 : 0, yaw = down ? s * 16 : 0;
    P.push(...xform(rp, TRS([s * (HB + (down ? 1500 : 450)), ry + (down ? 2600 : -2000), down ? rz - 1900 : rz + 400], [pitch, 0, yaw], 1, 'ZYX')));
  });
  // convés de proa elevado e quebra-mar
  P.push(B(null, hull, [2 * HB * 0.7, 9000, 900], [0, 17000, ZD + 450], { bev: 40, cell: 'castelo' }));
  P.push(...oerlikon(0, 21000, ZD + 900));
  // torre quadrada (conn) com ponte, mastro, holofote, Oerlikons e escotilhas dos compartimentos de tropa
  P.push(B(null, hull, [3600, 4200, 2600], [0, -7200, ZD + 1300], { bev: 40, cell: 'torre' }));
  P.push(B(null, hull, [3800, 4400, 300], [0, -7200, ZD + 2750], { cell: 'ponte' }), B(null, hull, [3600, 300, 1100], [0, -5150, ZD + 3400], { cell: 'anteparo_ponte' }));
  for (let k = 0; k < 6; k++) P.push(B(null, 'preto', [380, 20, 140], [-1350 + k * 540, -5110, ZD + 2200], { cell: 'visor' }));
  P.push(C(null, 'acoGasto', 120, 9000, [0, -8300, ZD + 3000 + 4500], { axis: 'z', seg: 10, r2: 70, cell: 'mastro' }), C(null, 'acoGasto', 50, 3600, [0, -8300, ZD + 10500], { axis: 'x', seg: 8, cell: 'verga' }));
  P.push(C(null, 'cinzaNevoa', 260, 380, [0, -6000, ZD + 3500], { rot: [80, 0, 0], seg: 14, cell: 'holofote' }));
  [-1, 1].forEach(s => P.push(...oerlikon(s * 1500, -9600, ZD + 2750)));
  P.push(...oerlikon(0, -19500, ZD));
  for (let k = 0; k < 4; k++) P.push(B(null, hull, [1400, 1400, 400], [(k % 2 ? 1 : -1) * 1500, 3000 + Math.floor(k / 2) * 4500, ZD + 200], { bev: 30, cell: 'escotilha' }));
  P.push(B(null, hull, [2600, 5000, 1800], [0, -15500, ZD + 900], { bev: 30, cell: 'casaria_re' }));
  P.push(C(null, 'acoPreto', 600, 1800, [0, -22800, ZD + 700], { axis: 'x', seg: 16, cell: 'guincho' }), B(null, 'acoPreto', [500, 1600, 1600], [0, -23900, ZD + 300], { rot: [40, 0, 0], cell: 'ancora' }));
  [-1, 1].forEach(s => P.push(B(null, 'acoGasto', [60, 1200, 1500], [s * 1400, L0 - 400, 900], { cell: 'leme' }), C(null, 'latao', 230, 360, [s * 1400, L0 + 600, 700], { seg: 12, cell: 'helice' })));
  return { parts: P };
}

// ---------------------------------------------------------------- DUKW (caminhão anfíbio)
function dukw(v) {
  const P = [], o = v.cor || 'oliva', HB = 1220, ZK = 520;
  // casco-barco: proa inclinada, laterais retas, popa com hélice
  P.push(E(null, o, [[-4725, ZK + 300], [-4500, ZK], [3300, ZK], [4725, ZK + 900], [4725, 1700], [2600, 1700], [-4725, 1550]], 2 * HB, [0, 0, 0], { bev: 50, cell: 'casco' }));
  P.push(B(null, o, [2 * HB - 120, 1900, 40], [0, 3300, 1720], { rot: [-4, 0, 0], cell: 'capo' }));
  for (let k = 0; k < 7; k++) P.push(B(null, 'acoPreto', [900, 50, 20], [0, 3700 - k * 120, 1760], { cell: 'grelha' }));
  P.push(B(null, o, [2 * HB - 100, 60, 600], [0, 4380, 1500], { rot: [55, 0, 0], cell: 'quebra_ondas' }));
  // para-brisa, cabine aberta, volante e bancos; compartimento de carga
  P.push(B(null, o, [2 * HB - 200, 50, 620], [0, 2250, 2030], { rot: [-10, 0, 0], cell: 'parabrisa' }), B(null, 'vidro', [2 * HB - 420, 20, 480], [0, 2262, 2040], { rot: [-10, 0, 0], cell: 'vidro' }));
  P.push(T(null, 'acoPreto', 230, 18, [-500, 1700, 1850], { rot: [55, 0, 0], seg: [5, 16], cell: 'volante' }));
  [-1, 1].forEach(s => P.push(B(null, 'lonaVerde', [700, 600, 120], [s * 500, 1100, 1520], { bev: 30, cell: 'banco' }), B(null, 'lonaVerde', [700, 120, 520], [s * 500, 780, 1760], { bev: 30, cell: 'encosto' })));
  P.push(B(null, 'tabuas', [2 * HB - 220, 3600, 40], [0, -1900, 1150], { cell: 'piso_carga' }));
  [-1, 1].forEach(s => P.push(B(null, o, [60, 3700, 420], [s * (HB - 30), -1900, 1750], { cell: 'borda' })));
  // arcos da lona e estepe
  for (let k = 0; k < 3; k++) P.push(T(null, 'acoPreto', HB - 60, 20, [0, -700 - k * 1300, 1760], { rot: [0, 90, 0], arc: 180, seg: [5, 18], cell: 'arco' }));
  P.push(...wheel(0, -3900, 1830, 470, 300, o).map(p => ({ ...p, axis: 'z' })));
  // seis rodas (eixo dianteiro + boogie traseiro) e para-lamas recortados
  const axles = [2250, -1360, -2480];
  axles.forEach(y => [-1, 1].forEach(s => P.push(...wheel(s * (HB - 120), y, 470, 470, 300, o))));
  // hélice, leme e guincho da popa; estrela branca na lateral
  P.push(C(null, 'latao', 70, 200, [0, -4600, 600], { seg: 10, cell: 'helice' }), B(null, 'acoGasto', [30, 300, 420], [0, -4900, 700], { cell: 'leme' }));
  P.push(C(null, 'acoPreto', 160, 700, [0, -4400, 1600], { axis: 'x', seg: 12, cell: 'guincho' }));
  [-1, 1].forEach(s => P.push(E(null, 'branco', starPts(320), 8, [s * (HB + 5), 0, 1150], { cell: 'estrela' })));
  if (v.mg === 'sim') P.push(T(null, o, 520, 30, [0, 1300, 2550], { seg: [6, 24], cell: 'anel' }), ...[-1, 1].map(s => SG(null, o, [s * 520, 1300, 2550], [s * 600, 1300, 1700], 30, { seg: 6 })), ...mg(0, 1800, 2400, 50));
  return { parts: P };
}

// ---------------------------------------------------------------- catálogo
const RAMPA = { n: 'Rampa', o: [['up', 'Fechada'], ['down', 'Arriada na areia']], v: 'up' };
const ESCB = { n: 'Tamanho no jogo', o: [['1', 'Real'], ['1.25', '1,25×'], ['1.5', '1,5×']], v: '1' };
const COR_US = { n: 'Pintura', o: [['cinzaOceano', 'Cinza oceano 5-O'], ['cinzaNevoa', 'Cinza névoa 5-H'], ['azulNavy', 'Azul marinho 5-N']], v: 'cinzaOceano' };
export const BOATS = [
  { id: 'lcvp', cat: 'naval', war: 2, n: 'LCVP "barco Higgins"', d: 'Réplica do LCVP de Omaha: 11,05 × 3,30 m, costados de compensado com blindagem aparafusada, rampa de aço com janela do patrão e travessas, guincho e cabos, caixa do motor Gray Marine, roda do patrão a boreste, dois poços blindados com Browning .30, quebra-mar, poste Sampson, quilha, leme e hélice. Número de casco no estilo dos transportes (PA26 = USS Samuel Chase).', mm: '10 6 0 0',
    vars: { rampa: RAMPA, cor: COR_US, num: { n: 'Número', o: [['PA26-15', 'PA26-15 (Samuel Chase)'], ['PA33-21', 'PA33-21 (Thomas Jefferson)'], ['PA45-7', 'PA45-7 (Henrico)'], ['', 'sem número']], v: 'PA26-15' }, esc: ESCB },
    build: v => lcvp(v) },
  { id: 'lca', cat: 'naval', war: 2, n: 'LCA (Landing Craft Assault)', d: 'O barco de assalto britânico usado pelos Rangers em Omaha e na Pointe du Hoc: 12,65 × 3,05 m, casco baixo e blindado, bancos sob cobertura, portas blindadas atrás da rampa, abrigo do patrão e posto do Bren na proa.', mm: '10 6 0 0',
    vars: { rampa: RAMPA, cor: { n: 'Pintura', o: [['cinzaRN', 'Cinza 507C'], ['verdeRN', 'Western Approaches'], ['cinzaOceano', 'Cinza escuro']], v: 'cinzaRN' }, esc: ESCB },
    build: v => lca(v) },
  { id: 'lcm3', cat: 'naval', war: 2, n: 'LCM(3) "Mike boat"', d: 'Barcaça de aço de 15,24 × 4,29 m para um tanque de 30 t: tanques laterais, piso nervurado, rampa com correntes, casa do leme blindada com visores, duas .50, ventiladores e dois lemes.', mm: '12 7 0 0',
    vars: { rampa: RAMPA, cor: COR_US, num: { n: 'Número', o: [['33', '33'], ['17', '17'], ['', 'sem número']], v: '33' }, esc: ESCB },
    build: v => lcm3(v) },
  { id: 'lct5', cat: 'naval', war: 2, n: 'LCT(5) — barcaça de tanques', d: 'Landing Craft Tank Mk 5 de 35,81 × 9,75 m: convés de tanques com olhais, rampa de proa com pórtico e correntes, casaria e casa do leme blindada à popa, mastro, dois Oerlikon de 20 mm e guincho da âncora de popa (LCT-305 esteve em Omaha).', mm: '30 10 0 0',
    vars: { rampa: RAMPA, cor: COR_US, num: { n: 'Número', o: [['305', '305'], ['199', '199'], ['27', '27'], ['', 'sem número']], v: '305' }, esc: ESCB },
    build: v => lct5(v) },
  { id: 'lcil', cat: 'naval', war: 2, n: 'LCI(L) — navio de desembarque de infantaria', d: 'Landing Craft Infantry (Large) de 48,31 × 7,09 m com torre quadrada: casco de navio, castelo de proa, duas rampas laterais de desembarque, ponte, mastro, cinco Oerlikon e âncora de popa (LCI-92 em Omaha).', mm: '40 12 0 0',
    vars: { rampa: { n: 'Rampas laterais', o: [['down', 'Arriadas'], ['up', 'Recolhidas']], v: 'down' }, cor: COR_US, num: { n: 'Número', o: [['LCI-92', 'LCI-92'], ['LCI-85', 'LCI-85'], ['LCI-553', 'LCI-553'], ['', 'sem número']], v: 'LCI-92' }, esc: ESCB },
    build: v => lcil(v) },
  { id: 'dukw', cat: 'naval', war: 2, n: 'DUKW "Duck" (caminhão anfíbio)', d: 'O GMC DUKW de 9,45 × 2,44 m que levou munição e obuses para Omaha: casco-barco com quebra-ondas, seis rodas, para-brisa, arcos da lona, estepe, hélice, leme e guincho.', mm: '8 5 0 0',
    vars: { cor: { n: 'Pintura', o: [['oliva', 'Verde-oliva'], ['cinzaOceano', 'Cinza']], v: 'oliva' }, mg: { n: 'Metralhadora .50 no anel', o: [['nao', 'Não'], ['sim', 'Sim']], v: 'nao' }, esc: ESCB },
    build: v => dukw(v) },
];
