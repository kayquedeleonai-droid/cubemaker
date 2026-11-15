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
  lona:        { n: 'Lona cáqui',            c: [140, 124, 90], p: 'cloth',    wear: 0.3, wearColor: [170, 156, 120] },
};
export const MAT_ORDER = ['acoOxidado', 'acoPreto', 'parkCinza', 'parkVerde', 'acoGasto', 'latao', 'nogueira', 'faia', 'madeiraClara', 'baquelite', 'oliva', 'feldgrau', 'dunkelgelb', 'couro', 'lona'];

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
