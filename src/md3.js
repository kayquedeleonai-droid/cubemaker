// CUBE MAKER — leitura e escrita de MD3 (Quake 3 / AssaultCube)
const TAU = Math.PI * 2;

function readStr(dv, off, len) {
  let s = '';
  for (let i = 0; i < len; i++) {
    const c = dv.getUint8(off + i);
    if (!c) break;
    s += String.fromCharCode(c);
  }
  return s;
}
function writeStr(dv, off, len, str) {
  for (let i = 0; i < len; i++) dv.setUint8(off + i, i < str.length && i < len - 1 ? str.charCodeAt(i) & 255 : 0);
}

export function decodeNormal(n) {
  const lat = ((n >> 8) & 255) * TAU / 255;
  const lng = (n & 255) * TAU / 255;
  return [Math.cos(lat) * Math.sin(lng), Math.sin(lat) * Math.sin(lng), Math.cos(lng)];
}
export function encodeNormal(x, y, z) {
  const l = Math.hypot(x, y, z) || 1;
  x /= l; y /= l; z /= l;
  if (Math.abs(x) < 1e-6 && Math.abs(y) < 1e-6) return z > 0 ? 0 : 128;
  let lat = Math.round(Math.atan2(y, x) * 255 / TAU);
  let lng = Math.round(Math.acos(Math.max(-1, Math.min(1, z))) * 255 / TAU);
  return ((lat & 255) << 8) | (lng & 255);
}

export function parseMD3(buf) {
  const dv = new DataView(buf);
  if (readStr(dv, 0, 4) !== 'IDP3') throw new Error('Não é um arquivo MD3 válido');
  const m = {
    version: dv.getInt32(4, true),
    name: readStr(dv, 8, 64),
    flags: dv.getInt32(72, true),
    nf: dv.getInt32(76, true),
    frames: [], tagNames: [], tags: [], surfaces: []
  };
  const nt = dv.getInt32(80, true), ns = dv.getInt32(84, true);
  const ofsFrames = dv.getInt32(92, true), ofsTags = dv.getInt32(96, true), ofsSurf = dv.getInt32(100, true);
  for (let f = 0; f < m.nf; f++) {
    const o = ofsFrames + f * 56;
    const g = i => dv.getFloat32(o + i * 4, true);
    m.frames.push({ min: [g(0), g(1), g(2)], max: [g(3), g(4), g(5)], origin: [g(6), g(7), g(8)], radius: g(9), name: readStr(dv, o + 40, 16) });
  }
  for (let f = 0; f < m.nf; f++) {
    const row = [];
    for (let t = 0; t < nt; t++) {
      const o = ofsTags + (f * nt + t) * 112;
      if (f === 0) m.tagNames.push(readStr(dv, o, 64));
      const g = i => dv.getFloat32(o + 64 + i * 4, true);
      row.push({ origin: [g(0), g(1), g(2)], axis: [g(3), g(4), g(5), g(6), g(7), g(8), g(9), g(10), g(11)] });
    }
    m.tags.push(row);
  }
  let o = ofsSurf;
  for (let s = 0; s < ns; s++) {
    if (readStr(dv, o, 4) !== 'IDP3') throw new Error('Superfície MD3 corrompida');
    const S = {
      name: readStr(dv, o + 4, 64), flags: dv.getInt32(o + 68, true),
      nv: dv.getInt32(o + 80, true), ntri: dv.getInt32(o + 84, true), shaders: [], pos: [], nrm: [], nraw: []
    };
    const nsh = dv.getInt32(o + 76, true);
    const ofsTris = dv.getInt32(o + 88, true), ofsSh = dv.getInt32(o + 92, true), ofsST = dv.getInt32(o + 96, true), ofsX = dv.getInt32(o + 100, true), ofsEnd = dv.getInt32(o + 104, true);
    for (let i = 0; i < nsh; i++) S.shaders.push({ name: readStr(dv, o + ofsSh + i * 68, 64), index: dv.getInt32(o + ofsSh + i * 68 + 64, true) });
    S.tris = new Int32Array(S.ntri * 3);
    for (let i = 0; i < S.ntri * 3; i++) S.tris[i] = dv.getInt32(o + ofsTris + i * 4, true);
    S.st = new Float32Array(S.nv * 2);
    for (let i = 0; i < S.nv * 2; i++) S.st[i] = dv.getFloat32(o + ofsST + i * 4, true);
    for (let f = 0; f < m.nf; f++) {
      const P = new Float32Array(S.nv * 3), N = new Float32Array(S.nv * 3), R = new Uint16Array(S.nv);
      for (let v = 0; v < S.nv; v++) {
        const q = o + ofsX + (f * S.nv + v) * 8;
        P[v * 3] = dv.getInt16(q, true) / 64; P[v * 3 + 1] = dv.getInt16(q + 2, true) / 64; P[v * 3 + 2] = dv.getInt16(q + 4, true) / 64;
        R[v] = dv.getUint16(q + 6, true);
        const n = decodeNormal(R[v]);
        N[v * 3] = n[0]; N[v * 3 + 1] = n[1]; N[v * 3 + 2] = n[2];
      }
      S.pos.push(P); S.nrm.push(N); S.nraw.push(R);
    }
    m.surfaces.push(S);
    o += ofsEnd;
  }
  return m;
}

// final: { surfaces: [{ tris: Int32Array (visíveis), pos: [Float32Array por quadro], nrm: [...] }], tags: [quadro][tag]{origin,axis} }
export function buildMD3(model, final) {
  const nf = final.surfaces[0] ? final.surfaces[0].pos.length : model.nf;
  const nt = model.tagNames.length, ns = model.surfaces.length;
  const surfSize = model.surfaces.map((S, i) => 108 + S.shaders.length * 68 + (final.surfaces[i].tris.length / 3) * 12 + S.nv * 8 + nf * S.nv * 8);
  const ofsFrames = 108, ofsTags = ofsFrames + nf * 56, ofsSurf = ofsTags + nf * nt * 112;
  const total = ofsSurf + surfSize.reduce((a, b) => a + b, 0);
  const buf = new ArrayBuffer(total), dv = new DataView(buf);
  writeStr(dv, 0, 4, 'IDP3'); dv.setUint8(3, 51);
  dv.setInt32(4, 15, true);
  writeStr(dv, 8, 64, model.name || 'cubemaker');
  dv.setInt32(72, model.flags || 0, true);
  dv.setInt32(76, nf, true); dv.setInt32(80, nt, true); dv.setInt32(84, ns, true); dv.setInt32(88, 0, true);
  dv.setInt32(92, ofsFrames, true); dv.setInt32(96, ofsTags, true); dv.setInt32(100, ofsSurf, true); dv.setInt32(104, total, true);
  for (let f = 0; f < nf; f++) {
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    const src = model.frames[Math.min(f, model.frames.length - 1)];
    const org = src ? src.origin : [0, 0, 0];
    let rad = 0;
    final.surfaces.forEach(fs => {
      const P = fs.pos[f];
      for (let i = 0; i < P.length; i += 3) {
        for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], P[i + k]); mx[k] = Math.max(mx[k], P[i + k]); }
        rad = Math.max(rad, Math.hypot(P[i] - org[0], P[i + 1] - org[1], P[i + 2] - org[2]));
      }
    });
    if (!isFinite(mn[0])) { mn.fill(0); mx.fill(0); }
    const o = ofsFrames + f * 56;
    [...mn, ...mx, ...org, rad].forEach((v, i) => dv.setFloat32(o + i * 4, v, true));
    writeStr(dv, o + 40, 16, (src && src.name) || ('frame' + f));
  }
  for (let f = 0; f < nf; f++) for (let t = 0; t < nt; t++) {
    const o = ofsTags + (f * nt + t) * 112;
    writeStr(dv, o, 64, model.tagNames[t]);
    const tg = final.tags[f][t];
    [...tg.origin, ...tg.axis].forEach((v, i) => dv.setFloat32(o + 64 + i * 4, v, true));
  }
  let o = ofsSurf;
  model.surfaces.forEach((S, si) => {
    const fs = final.surfaces[si], ntri = fs.tris.length / 3, nsh = S.shaders.length;
    const ofsSh = 108, ofsTris = ofsSh + nsh * 68, ofsST = ofsTris + ntri * 12, ofsX = ofsST + S.nv * 8, ofsEnd = ofsX + nf * S.nv * 8;
    writeStr(dv, o, 4, 'IDP3'); dv.setUint8(o + 3, 51);
    writeStr(dv, o + 4, 64, S.name);
    dv.setInt32(o + 68, S.flags || 0, true);
    dv.setInt32(o + 72, nf, true); dv.setInt32(o + 76, nsh, true); dv.setInt32(o + 80, S.nv, true); dv.setInt32(o + 84, ntri, true);
    dv.setInt32(o + 88, ofsTris, true); dv.setInt32(o + 92, ofsSh, true); dv.setInt32(o + 96, ofsST, true); dv.setInt32(o + 100, ofsX, true); dv.setInt32(o + 104, ofsEnd, true);
    S.shaders.forEach((sh, i) => { writeStr(dv, o + ofsSh + i * 68, 64, sh.name); dv.setInt32(o + ofsSh + i * 68 + 64, i, true); });
    for (let i = 0; i < fs.tris.length; i++) dv.setInt32(o + ofsTris + i * 4, fs.tris[i], true);
    for (let i = 0; i < S.nv * 2; i++) dv.setFloat32(o + ofsST + i * 4, S.st[i], true);
    const cl = v => Math.max(-32768, Math.min(32767, Math.round(v * 64)));
    for (let f = 0; f < nf; f++) {
      const P = fs.pos[f], N = fs.nrm[f];
      for (let v = 0; v < S.nv; v++) {
        const q = o + ofsX + (f * S.nv + v) * 8;
        dv.setInt16(q, cl(P[v * 3]), true); dv.setInt16(q + 2, cl(P[v * 3 + 1]), true); dv.setInt16(q + 4, cl(P[v * 3 + 2]), true);
        const raw = fs.nraw && fs.nraw[f] && !(fs.moved && fs.moved[v]);
        dv.setUint16(q + 6, raw ? fs.nraw[f][v] : encodeNormal(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]), true);
      }
    }
    o += ofsEnd;
  });
  return buf;
}

// Ilhas UV (vértices conectados por triângulos) e "peças" (ilhas que se tocam na posição)
export function computeIslands(S) {
  const p = new Int32Array(S.nv); for (let i = 0; i < S.nv; i++) p[i] = i;
  const f = x => { while (p[x] !== x) { p[x] = p[p[x]]; x = p[x]; } return x; };
  const u = (a, b) => { a = f(a); b = f(b); if (a !== b) p[a] = b; };
  for (let t = 0; t < S.ntri; t++) { u(S.tris[t * 3], S.tris[t * 3 + 1]); u(S.tris[t * 3], S.tris[t * 3 + 2]); }
  const map = new Map(); S.island = new Int32Array(S.nv);
  for (let v = 0; v < S.nv; v++) { const r = f(v); if (!map.has(r)) map.set(r, map.size); S.island[v] = map.get(r); }
  S.nIsl = map.size;
  S.islTris = Array.from({ length: S.nIsl }, () => []);
  for (let t = 0; t < S.ntri; t++) S.islTris[S.island[S.tris[t * 3]]].push(t);
  S.islVerts = Array.from({ length: S.nIsl }, () => []);
  for (let v = 0; v < S.nv; v++) S.islVerts[S.island[v]].push(v);
  const q = new Int32Array(S.nIsl); for (let i = 0; i < S.nIsl; i++) q[i] = i;
  const g = x => { while (q[x] !== x) { q[x] = q[q[x]]; x = q[x]; } return x; };
  const P = S.pos[0], seen = new Map();
  for (let v = 0; v < S.nv; v++) {
    const k = Math.round(P[v * 3] * 64) + ',' + Math.round(P[v * 3 + 1] * 64) + ',' + Math.round(P[v * 3 + 2] * 64);
    const o = seen.get(k);
    if (o === undefined) seen.set(k, S.island[v]);
    else { const a = g(o), b = g(S.island[v]); if (a !== b) q[a] = b; }
  }
  S.piece = new Int32Array(S.nIsl); for (let i = 0; i < S.nIsl; i++) S.piece[i] = g(i);
}

export function parseCfg(text) {
  const out = { skins: {}, anims: [], load: null };
  text.split(/\r?\n/).forEach(line => {
    const toks = (line.match(/"[^"]*"|\S+/g) || []).map(t => t.replace(/^"|"$/g, ''));
    if (!toks.length) return;
    const c = toks[0].toLowerCase();
    if (c === 'md3load') out.load = toks[1];
    else if (c === 'md3skin' && toks.length >= 3) out.skins[toks[1]] = toks[2];
    else if (c === 'md3anim' && toks.length >= 3) out.anims.push({ name: toks[1], start: +toks[2] || 0, count: Math.max(1, +toks[3] || 1), speed: +toks[4] || 0 });
  });
  return out;
}

// ---------------------------------------------------------------- MD2 (modelo de jogador do AC: só leitura, para pintar a skin)
export function parseMD2(buf) {
  const dv = new DataView(buf);
  if (readStr(dv, 0, 4) !== 'IDP2') throw new Error('Não é um arquivo MD2 válido');
  const g = o => dv.getInt32(o, true);
  const skinW = g(8), skinH = g(12), frameSize = g(16), nXYZ = g(24), nST = g(28), nTris = g(32), nFrames = g(40);
  const ofsST = g(48), ofsTris = g(52), ofsFrames = g(56);
  const st = []; for (let i = 0; i < nST; i++) st.push([dv.getInt16(ofsST + i * 4, true) / skinW, dv.getInt16(ofsST + i * 4 + 2, true) / skinH]);
  // vértices do MD3-like: um por par (posição, uv)
  const key = new Map(), vXYZ = [], vST = [], tris = [];
  for (let t = 0; t < nTris; t++) {
    const o = ofsTris + t * 12, out = [];
    for (let k = 0; k < 3; k++) {
      const xi = dv.getUint16(o + k * 2, true), si = dv.getUint16(o + 6 + k * 2, true), kk = xi * 65536 + si;
      let idx = key.get(kk); if (idx === undefined) { idx = vXYZ.length; key.set(kk, idx); vXYZ.push(xi); vST.push(si); }
      out.push(idx);
    }
    tris.push(out[0], out[2], out[1]);
  }
  const nv = vXYZ.length, S = { name: 'body', flags: 0, nv, ntri: nTris, shaders: [], tris: new Int32Array(tris), st: new Float32Array(nv * 2), pos: [], nrm: [], nraw: [] };
  vST.forEach((si, i) => { S.st[i * 2] = st[si][0]; S.st[i * 2 + 1] = st[si][1]; });
  const frames = [];
  for (let f = 0; f < nFrames; f++) {
    const o = ofsFrames + f * frameSize;
    const sc = [0, 1, 2].map(k => dv.getFloat32(o + k * 4, true)), tr = [0, 1, 2].map(k => dv.getFloat32(o + 12 + k * 4, true));
    const name = readStr(dv, o + 24, 16); frames.push({ name, min: [0, 0, 0], max: [0, 0, 0], origin: [0, 0, 0], radius: 0 });
    const P = new Float32Array(nv * 3);
    for (let i = 0; i < nv; i++) { const q = o + 40 + vXYZ[i] * 4; for (let k = 0; k < 3; k++) P[i * 3 + k] = dv.getUint8(q + k) * sc[k] + tr[k]; }
    // normais suaves calculadas da malha
    const N = new Float32Array(nv * 3);
    for (let t = 0; t < nTris; t++) {
      const a = tris[t * 3], b = tris[t * 3 + 1], c = tris[t * 3 + 2];
      const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2], vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
      const nx = -(uy * vz - uz * vy), ny = -(uz * vx - ux * vz), nz = -(ux * vy - uy * vx);
      for (const v of [a, b, c]) { N[v * 3] += nx; N[v * 3 + 1] += ny; N[v * 3 + 2] += nz; }
    }
    for (let i = 0; i < nv; i++) { const l = Math.hypot(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]) || 1; N[i * 3] /= l; N[i * 3 + 1] /= l; N[i * 3 + 2] /= l; }
    S.pos.push(P); S.nrm.push(N); S.nraw.push(new Uint16Array(nv));
  }
  // animações pelo nome dos quadros (stand01, run03 …)
  const anims = []; frames.forEach((fr, i) => { const n = fr.name.replace(/\d+$/, ''); const last = anims[anims.length - 1]; if (last && last.name === n) last.count++; else anims.push({ name: n, start: i, count: 1, speed: 0 }); });
  return { version: 8, name: 'player', flags: 0, nf: nFrames, frames, tagNames: [], tags: frames.map(() => []), surfaces: [S], md2: true, skinW, skinH, md2Anims: anims };
}
