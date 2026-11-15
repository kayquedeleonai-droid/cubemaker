// CUBE MAKER — materiais de época (Segunda Guerra)
// c: cor média do material · p: padrão procedural · wear: quanto as bordas gastam · wearColor: cor do gasto
export const MATS = {
  acoOxidado:  { n: 'Aço oxidado (azulado)', c: [44, 48, 58],   p: 'metal',    wear: 1,   wearColor: [176, 176, 172] },
  acoPreto:    { n: 'Aço preto fosco',       c: [36, 36, 36],   p: 'metal',    wear: 0.9, wearColor: [160, 158, 152] },
  parkCinza:   { n: 'Parkerizado cinza',     c: [72, 73, 70],   p: 'metal',    wear: 0.8, wearColor: [168, 166, 160] },
  parkVerde:   { n: 'Parkerizado verde',     c: [68, 72, 58],   p: 'metal',    wear: 0.8, wearColor: [166, 164, 152] },
  acoGasto:    { n: 'Aço gasto (prata)',     c: [118, 118, 114], p: 'metal',   wear: 0.4, wearColor: [200, 198, 192] },
  latao:       { n: 'Latão',                 c: [160, 124, 58], p: 'metal',    wear: 0.6, wearColor: [214, 186, 112] },
  nogueira:    { n: 'Madeira nogueira',      c: [92, 52, 28],   p: 'wood',     wear: 0.7, wearColor: [150, 102, 62] },
  faia:        { n: 'Faia (Kar98k)',         c: [124, 74, 40],  p: 'wood',     wear: 0.7, wearColor: [178, 128, 82] },
  madeiraClara:{ n: 'Madeira clara',         c: [152, 100, 56], p: 'wood',     wear: 0.6, wearColor: [196, 150, 100] },
  baquelite:   { n: 'Baquelite',             c: [72, 34, 24],   p: 'bakelite', wear: 0.5, wearColor: [120, 72, 52] },
  oliva:       { n: 'Verde-oliva pintado',   c: [78, 84, 50],   p: 'paint',    wear: 1,   wearColor: [150, 150, 144] },
  feldgrau:    { n: 'Feldgrau',              c: [86, 90, 78],   p: 'paint',    wear: 1,   wearColor: [150, 150, 144] },
  dunkelgelb:  { n: 'Dunkelgelb (areia)',    c: [164, 140, 86], p: 'paint',    wear: 1,   wearColor: [110, 108, 100] },
  couro:       { n: 'Couro',                 c: [100, 64, 36],  p: 'leather',  wear: 0.6, wearColor: [150, 110, 72] },
  cobre:       { n: 'Cobre (projétil)',      c: [178, 100, 58], p: 'metal',    wear: 0.3, wearColor: [220, 150, 100] },
  azulTampa:   { n: 'Tampa azul (Eihandgranate)', c: [52, 84, 140], p: 'paint', wear: 0.6, wearColor: [170, 170, 165] },
  tracer:      { n: 'Traçante (brilho)',     c: [255, 214, 120], p: 'paint',   wear: 0 },
  lona:        { n: 'Lona cáqui',            c: [140, 124, 90], p: 'cloth',    wear: 0.3, wearColor: [170, 156, 120] },
};
export const MAT_ORDER = ['acoOxidado', 'acoPreto', 'parkCinza', 'parkVerde', 'acoGasto', 'latao', 'nogueira', 'faia', 'madeiraClara', 'baquelite', 'oliva', 'feldgrau', 'dunkelgelb', 'couro', 'lona', 'cobre', 'azulTampa'];

function hash(x, y) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < 4; i++) { s += a * vnoise(x * f, y * f); f *= 2; a *= 0.5; }
  return s / 0.9375;
}

// ---------------------------------------------------------------- banco de texturas procedurais (cor por pixel)
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const h2 = (x, y) => { let h = Math.imul(x | 0, 2246822519) ^ Math.imul(y | 0, 3266489917); h = Math.imul(h ^ (h >>> 15), 668265263); return ((h ^ (h >>> 13)) >>> 0) / 4294967295; };
export const TEX = {
  splinter(x, y) {                      // Splittermuster (Alemanha)
    const u = x * 0.866 + y * 0.5, v = -x * 0.5 + y * 0.866;
    const cu = Math.floor(u / 46 + fbm(x * 0.01, y * 0.01) * 0.8), cv = Math.floor(v / 30 + fbm(x * 0.012 + 5, y * 0.012) * 0.8);
    const h = h2(cu, cv);
    let c = h < 0.45 ? [158, 140, 98] : h < 0.72 ? [92, 102, 64] : [104, 76, 50];
    if ((x % 7) < 1.2 && h2(Math.floor(x / 7), Math.floor(y / 14)) > 0.45) c = mix(c, [60, 66, 40], 0.75); // "chuva"
    return c;
  },
  erbsen(x, y) {                        // Erbsenmuster (pontos)
    const n = fbm(x * 0.018, y * 0.018);
    let c = n < 0.42 ? [96, 104, 66] : n < 0.6 ? [150, 132, 88] : [104, 78, 52];
    const gx = Math.floor(x / 9), gy = Math.floor(y / 9), hh = h2(gx, gy);
    const dx = x - gx * 9 - 4.5, dy = y - gy * 9 - 4.5;
    if (hh > 0.55 && dx * dx + dy * dy < 4.5) c = hh > 0.8 ? [70, 56, 38] : [124, 140, 82];
    return c;
  },
  olivaLascado(x, y) {                  // verde-oliva com tinta lascando
    const n = fbm(x * 0.06, y * 0.06), m = fbm(x * 0.012 + 3, y * 0.012);
    return n * m > 0.36 ? [128, 126, 120] : mix([80, 86, 52], [70, 76, 46], fbm(x * 0.03, y * 0.03));
  },
  inverno(x, y) {                       // caiação de inverno
    const n = fbm(x * 0.05, y * 0.05), s = fbm(x * 0.008, y * 0.2);
    return n > 0.62 || s > 0.68 ? [74, 78, 64] : mix([214, 212, 202], [188, 186, 176], fbm(x * 0.02, y * 0.02));
  },
  deserto(x, y) {                       // DAK / areia com manchas
    const n = fbm(x * 0.015, y * 0.015);
    return n > 0.63 ? [120, 96, 64] : mix([176, 152, 104], [160, 136, 92], fbm(x * 0.05, y * 0.05));
  },
  ferrugem(x, y) {                      // aço tomado por ferrugem
    const n = fbm(x * 0.025, y * 0.025), f = fbm(x * 0.15, y * 0.15);
    return n > 0.5 ? mix([150, 74, 34], [96, 46, 22], f) : mix([70, 70, 70], [118, 66, 36], Math.max(0, n - 0.3) * 4 * f);
  },
  quadriculado(x, y) {                  // quadriculado de empunhadura (madeira escura)
    const a = ((x + y) % 7 + 7) % 7, b = ((x - y) % 7 + 7) % 7;
    const line = a < 1.4 || b < 1.4;
    return line ? [34, 22, 14] : mix([88, 54, 30], [70, 42, 24], fbm(x * 0.1, y * 0.1));
  },
  recartilhado(x, y) {                  // recartilhado metálico
    const a = ((x + y) % 4 + 4) % 4, b = ((x - y) % 4 + 4) % 4;
    return (a < 1 || b < 1) ? [40, 40, 42] : [128, 128, 126];
  },
  laminado(x, y) {                      // madeira laminada em camadas
    const t = y * 0.5 + fbm(x * 0.01, y * 0.02) * 10;
    return (Math.floor(t) % 2) ? [138, 92, 54] : [112, 70, 40];
  },
  ebano(x, y) { const n = fbm(x * 0.006, y * 0.06); return mix([44, 28, 20], [70, 46, 30], 0.5 + 0.5 * Math.sin(y * 0.3 + n * 12)); },
  tigre(x, y) {                         // madeira "tigrada"
    const n = fbm(x * 0.004, y * 0.04), w = 0.5 + 0.5 * Math.sin(y * 0.28 + n * 9), s = 0.5 + 0.5 * Math.sin(x * 0.09 + n * 4);
    return mix(mix([150, 98, 54], [120, 74, 40], w), [92, 56, 30], s * 0.35);
  },
  tintaVermelha(x, y) {                 // marcação vermelha gasta (soviética)
    const n = fbm(x * 0.07, y * 0.07);
    return n > 0.66 ? [80, 78, 74] : mix([140, 36, 30], [116, 30, 26], fbm(x * 0.03, y * 0.03));
  },
  abacaxi(x, y) {                       // Mk 2: blocos em relevo com sulcos
    const a = ((x % 16) + 16) % 16, b = ((y % 12) + 12) % 12;
    const groove = a < 2.5 || b < 2.5, n = fbm(x * 0.08, y * 0.08);
    return groove ? [38, 42, 26] : mix([92, 98, 58], [78, 84, 48], n);
  },
  f1seg(x, y) {                         // F1: segmentos mais largos, verde-escuro
    const a = ((x % 20) + 20) % 20, b = ((y % 16) + 16) % 16;
    return (a < 3 || b < 3) ? [30, 34, 26] : mix([70, 80, 56], [58, 66, 46], fbm(x * 0.06, y * 0.06));
  },
  mills(x, y) {                         // Mills / Kugel: ferro escuro segmentado
    const a = ((x % 18) + 18) % 18, b = ((y % 14) + 14) % 14;
    return (a < 3 || b < 3) ? [22, 22, 22] : mix([66, 64, 58], [52, 50, 46], fbm(x * 0.07, y * 0.07));
  },
  perfurado(x, y) {                     // chapa perfurada (camisa de cano)
    const a = ((x % 14) + 14) % 14 - 7, b = ((y % 14) + 14) % 14 - 7;
    return a * a + b * b < 14 ? [8, 8, 8] : mix([52, 54, 58], [40, 42, 46], fbm(x * 0.05, y * 0.05));
  },
  img(x, y, m) {                        // textura importada (repete)
    const I = m.img, ix = ((Math.floor(x * m.scale) % I.w) + I.w) % I.w, iy = ((Math.floor(y * m.scale) % I.h) + I.h) % I.h, j = (iy * I.w + ix) * 4;
    return [I.data[j], I.data[j + 1], I.data[j + 2]];
  },
};
const BANK = {
  splinter:     { n: 'Splinter (camuflagem)', tex: 'splinter', cat: 'camo', wear: 1, wearColor: [150, 150, 144] },
  erbsen:       { n: 'Erbsenmuster (pontos)', tex: 'erbsen', cat: 'camo', wear: 1, wearColor: [150, 150, 144] },
  inverno:      { n: 'Caiação de inverno', tex: 'inverno', cat: 'camo', wear: 1, wearColor: [90, 92, 84] },
  deserto:      { n: 'Deserto (DAK)', tex: 'deserto', cat: 'camo', wear: 1, wearColor: [150, 150, 144] },
  olivaLascado: { n: 'Oliva lascado', tex: 'olivaLascado', cat: 'pintura', wear: 0.6, wearColor: [160, 158, 150] },
  tintaVermelha:{ n: 'Tinta vermelha gasta', tex: 'tintaVermelha', cat: 'pintura', wear: 0.8, wearColor: [150, 148, 140] },
  ferrugem:     { n: 'Ferrugem', tex: 'ferrugem', cat: 'metal', wear: 0.2 },
  recartilhado: { n: 'Recartilhado', tex: 'recartilhado', cat: 'detalhe', wear: 0.3 },
  quadriculado: { n: 'Quadriculado (grip)', tex: 'quadriculado', cat: 'detalhe', wear: 0.3 },
  laminado:     { n: 'Madeira laminada', tex: 'laminado', cat: 'madeira', wear: 0.6, wearColor: [190, 140, 92] },
  abacaxi:      { n: 'Ferro fundido "abacaxi"', tex: 'abacaxi', cat: 'detalhe', wear: 0.8, wearColor: [140, 140, 130] },
  f1seg:        { n: 'Ferro segmentado F1', tex: 'f1seg', cat: 'detalhe', wear: 0.8, wearColor: [140, 140, 130] },
  mills:        { n: 'Ferro segmentado (Mills)', tex: 'mills', cat: 'detalhe', wear: 0.7, wearColor: [150, 148, 140] },
  perfurado:    { n: 'Chapa perfurada', tex: 'perfurado', cat: 'metal', wear: 0.8, wearColor: [170, 170, 165] },
  ebano:        { n: 'Madeira escura', tex: 'ebano', cat: 'madeira', wear: 0.6, wearColor: [130, 90, 60] },
  tigre:        { n: 'Madeira tigrada', tex: 'tigre', cat: 'madeira', wear: 0.6, wearColor: [196, 150, 100] },
};
const CAT_OF = { acoOxidado: 'metal', acoPreto: 'metal', parkCinza: 'metal', parkVerde: 'metal', acoGasto: 'metal', latao: 'metal', cobre: 'metal', nogueira: 'madeira', faia: 'madeira', madeiraClara: 'madeira', baquelite: 'detalhe', azulTampa: 'pintura', oliva: 'pintura', feldgrau: 'pintura', dunkelgelb: 'pintura', couro: 'detalhe', lona: 'detalhe', tracer: 'detalhe' };
Object.entries(CAT_OF).forEach(([k, c]) => MATS[k].cat = c);
Object.entries(BANK).forEach(([k, m]) => {
  let r = 0, g = 0, b = 0, n = 0;                                     // cor média (miniatura e desgaste)
  for (let y = 0; y < 64; y += 4) for (let x = 0; x < 64; x += 4) { const c = TEX[m.tex](x * 3, y * 3, m); r += c[0]; g += c[1]; b += c[2]; n++; }
  MATS[k] = { ...m, c: [r / n, g / n, b / n], p: 'tex' };
  MAT_ORDER.push(k);
});
MAT_ORDER.splice(MAT_ORDER.indexOf('tracer'), MAT_ORDER.includes('tracer') ? 1 : 0);
export const CATS = [['metal', 'Metais'], ['madeira', 'Madeiras'], ['pintura', 'Pinturas'], ['camo', 'Camuflagem'], ['detalhe', 'Detalhes'], ['minhas', 'Minhas']];
export function registerImageTexture(key, name, imageData, scale = 1) {
  const d = imageData.data; let r = 0, g = 0, b = 0;
  for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
  const n = d.length / 4;
  MATS[key] = { n: name, tex: 'img', img: { w: imageData.width, h: imageData.height, data: d }, scale, cat: 'minhas', p: 'tex', c: [r / n, g / n, b / n], wear: 0.5, wearColor: [160, 158, 150], custom: true };
  if (!MAT_ORDER.includes(key)) MAT_ORDER.push(key);
}
