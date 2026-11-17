// CUBE MAKER — estúdio de som: gera o tiro e a recarga de cada arma por síntese (sem gravações de terceiros)
// e exporta em Ogg Vorbis, o formato que o AssaultCube usa.
import { createOggEncoder } from 'wasm-media-encoders';

export const SR = 44100;
// parâmetros (0–1): forca (corpo grave), estalo (brilho do disparo), eco (cauda), mecanica (ferrolho/cliques), tom (afinação), dist (distância)
export const SOUND_DEFAULT = { forca: 0.6, estalo: 0.6, eco: 0.45, mecanica: 0.4, tom: 0.5, dist: 0.15 };
export function soundPreset(slot, id = '') {
  const p = { ...SOUND_DEFAULT };
  if (slot === 'pistol') Object.assign(p, { forca: 0.4, estalo: 0.7, eco: 0.3, mecanica: 0.5, tom: 0.65 });
  if (slot === 'subgun') Object.assign(p, { forca: 0.45, estalo: 0.55, eco: 0.3, mecanica: 0.45, tom: 0.55 });
  if (slot === 'assault') Object.assign(p, { forca: 0.62, estalo: 0.7, eco: 0.45, mecanica: 0.35, tom: 0.5 });
  if (slot === 'sniper') Object.assign(p, { forca: 0.85, estalo: 0.75, eco: 0.8, mecanica: 0.6, tom: 0.35 });
  if (slot === 'carbine') Object.assign(p, { forca: 0.7, estalo: 0.65, eco: 0.6, mecanica: 0.45, tom: 0.45 });
  if (slot === 'shotgun') Object.assign(p, { forca: 0.95, estalo: 0.45, eco: 0.65, mecanica: 0.7, tom: 0.3 });
  if (/mg42/.test(id)) Object.assign(p, { forca: 0.55, estalo: 0.9, eco: 0.35, tom: 0.6 });
  if (/thompson|bar1918|lewis/.test(id)) Object.assign(p, { forca: 0.7, estalo: 0.5, tom: 0.4 });
  if (/garand|kar98|mosin|lebel|springfield|enfield/.test(id)) Object.assign(p, { forca: 0.9, eco: 0.85 });
  return p;
}

const noise = (ctx, dur) => { const b = ctx.createBuffer(1, Math.ceil(dur * ctx.sampleRate), ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const s = ctx.createBufferSource(); s.buffer = b; return s; };
function env(ctx, node, t0, a, peak, dec, shape = 'exp') {
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(peak, t0 + a);
  if (shape === 'exp') g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + dec); else g.gain.linearRampToValueAtTime(0, t0 + a + dec);
  node.connect(g); return g;
}
function filt(ctx, type, f, q = 0.7) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
// clique metálico (peças batendo)
function click(ctx, out, t, o = {}) {
  const n = noise(ctx, 0.08), bp = filt(ctx, 'bandpass', o.f || 2600, o.q || 3); n.connect(bp);
  env(ctx, bp, t, 0.0008, o.v ?? 0.6, o.d || 0.035).connect(out); n.start(t);
  if (o.ring) { const s = ctx.createOscillator(); s.frequency.value = o.ring; env(ctx, s, t, 0.001, (o.v ?? 0.6) * 0.25, 0.09).connect(out); s.start(t); s.stop(t + 0.15); }
}
// deslizar metal com metal (carregador entrando, ferrolho)
function slide(ctx, out, t, dur, o = {}) {
  const n = noise(ctx, dur + 0.05), bp = filt(ctx, 'bandpass', o.f || 1800, 1.2); n.connect(bp);
  env(ctx, bp, t, dur * 0.3, o.v ?? 0.25, dur * 0.7, 'lin').connect(out); n.start(t);
}

export async function renderShot(p) {
  const dur = 0.35 + p.eco * 1.6, ctx = new OfflineAudioContext(1, Math.ceil(dur * SR), SR);
  const master = ctx.createGain(); master.gain.value = 0.9;
  const shaper = ctx.createWaveShaper(), curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * (1.5 + p.forca * 3)); } shaper.curve = curve;
  const lp = filt(ctx, 'lowpass', 16000 - p.dist * 12000); shaper.connect(lp); lp.connect(master); master.connect(ctx.destination);
  const pitch = 0.6 + p.tom * 0.9;
  // estalo supersônico
  const n1 = noise(ctx, 0.2), hp = filt(ctx, 'highpass', 1200 + p.estalo * 3000); n1.connect(hp);
  env(ctx, hp, 0, 0.0006, 0.6 + p.estalo * 0.6, 0.03 + p.estalo * 0.05).connect(shaper); n1.start(0);
  // corpo: ruído grave + queda de tom
  const n2 = noise(ctx, 0.5), lp2 = filt(ctx, 'lowpass', 500 * pitch); n2.connect(lp2);
  env(ctx, lp2, 0, 0.002, 0.5 + p.forca * 0.9, 0.09 + p.forca * 0.2).connect(shaper); n2.start(0);
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(160 * pitch, 0); o.frequency.exponentialRampToValueAtTime(38 * pitch, 0.18);
  env(ctx, o, 0, 0.002, 0.5 + p.forca * 0.6, 0.12 + p.forca * 0.2).connect(shaper); o.start(0); o.stop(0.5);
  // cauda / eco (reflexões)
  if (p.eco > 0.02) {
    const n3 = noise(ctx, dur), bp = filt(ctx, 'bandpass', 380 * pitch, 0.6); n3.connect(bp);
    env(ctx, bp, 0.02, 0.03, 0.12 + p.eco * 0.25, 0.3 + p.eco * 1.3).connect(master); n3.start(0);
    [0.09, 0.17, 0.29].forEach((d, i) => { const n4 = noise(ctx, 0.3), b4 = filt(ctx, 'lowpass', 900 - i * 200); n4.connect(b4); env(ctx, b4, d * (0.6 + p.eco), 0.004, (0.25 - i * 0.06) * p.eco, 0.12).connect(master); n4.start(0); });
  }
  // mecânica: ferrolho voltando
  if (p.mecanica > 0.02) { click(ctx, master, 0.045 + (1 - p.tom) * 0.03, { v: 0.3 * p.mecanica, f: 3200, ring: 1900 * pitch }); click(ctx, master, 0.075, { v: 0.2 * p.mecanica, f: 2200 }); }
  return normalize((await ctx.startRendering()).getChannelData(0), 0.92);
}
// recarga: tempos (0–1) acompanham a animação de recarga
export async function renderReload(p, dur = 1.8, kind = 'mag') {
  const ctx = new OfflineAudioContext(1, Math.ceil(dur * SR), SR), out = ctx.createGain(); out.gain.value = 1; out.connect(ctx.destination);
  const T = f => f * dur, m = 0.5 + p.mecanica;
  if (kind === 'stripper') {
    click(ctx, out, T(0.12), { v: 0.5 * m, f: 2400, ring: 1300 }); slide(ctx, out, T(0.15), 0.12, { v: 0.2 });
    for (let i = 0; i < 5; i++) click(ctx, out, T(0.32 + i * 0.06), { v: 0.35, f: 3200 });
    slide(ctx, out, T(0.75), 0.1, { v: 0.25 }); click(ctx, out, T(0.86), { v: 0.6 * m, f: 2000, ring: 1100 });
  } else if (kind === 'shells') {
    for (let i = 0; i < 4; i++) { slide(ctx, out, T(0.15 + i * 0.17), 0.07, { v: 0.2, f: 1400 }); click(ctx, out, T(0.22 + i * 0.17), { v: 0.4, f: 1700 }); }
    slide(ctx, out, T(0.86), 0.08, { v: 0.35, f: 1100 }); click(ctx, out, T(0.93), { v: 0.6 * m, f: 1500, ring: 700 });
  } else if (kind === 'belt') {
    click(ctx, out, T(0.15), { v: 0.6 * m, f: 1800, ring: 900 }); slide(ctx, out, T(0.3), 0.25, { v: 0.25, f: 2600 });
    for (let i = 0; i < 6; i++) click(ctx, out, T(0.45 + i * 0.025), { v: 0.25, f: 4000 });
    click(ctx, out, T(0.72), { v: 0.8 * m, f: 1400, ring: 700 }); click(ctx, out, T(0.86), { v: 0.5 * m, f: 2800 });
  } else {
    click(ctx, out, T(0.12), { v: 0.5 * m, f: 2600 }); slide(ctx, out, T(0.16), 0.12, { v: 0.22 });           // trava solta, carregador sai
    slide(ctx, out, T(0.5), 0.1, { v: 0.25, f: 1500 }); click(ctx, out, T(0.6), { v: 0.75 * m, f: 1600, ring: 800 }); // entra e trava
    slide(ctx, out, T(0.76), 0.06, { v: 0.2, f: 2400 }); click(ctx, out, T(0.82), { v: 0.6 * m, f: 3000, ring: 1500 }); // ferrolho
  }
  return normalize((await ctx.startRendering()).getChannelData(0), 0.8);
}
function normalize(d, peak) { let m = 0; for (const v of d) m = Math.max(m, Math.abs(v)); const k = m > 0 ? peak / m : 1; const o = new Float32Array(d.length); for (let i = 0; i < d.length; i++) o[i] = d[i] * k; return o; }

let ENC = null;
export async function toOgg(pcm, q = 5) {
  if (!ENC) ENC = await createOggEncoder();
  ENC.configure({ channels: 1, sampleRate: SR, vbrQuality: q });
  const parts = [];
  for (let i = 0; i < pcm.length; i += 4096) parts.push(ENC.encode([pcm.subarray(i, i + 4096)]).slice());
  parts.push(ENC.finalize().slice());
  return new Blob(parts, { type: 'audio/ogg' });
}
let AC = null;
export function play(pcm) {
  AC = AC || new AudioContext(); const b = AC.createBuffer(1, pcm.length, SR); b.getChannelData(0).set(pcm);
  const s = AC.createBufferSource(); s.buffer = b; s.connect(AC.destination); s.start(); return s;
}
// nomes dos sons de cada slot: lidos do config do jogo quando existe; senão, os nomes padrão do AC
const GUESS = { pistol: ['weapon/pistol', 'weapon/pistol_reload'], subgun: ['weapon/smg', 'weapon/smg_reload'], assault: ['weapon/assault', 'weapon/assault_reload'], sniper: ['weapon/sniper', 'weapon/sniper_reload'], carbine: ['weapon/carbine', 'weapon/carbine_reload'], shotgun: ['weapon/shotgun', 'weapon/shotgun_reload'] };
const KEYS = { pistol: /pistol/, subgun: /smg|subgun|mp5|sub\b/, assault: /assault|auto|m16|ar\b/, sniper: /sniper/, carbine: /carbine/, shotgun: /shotgun/ };
export function soundNames(slot, cfgText) {
  if (cfgText) {
    const names = [...cfgText.matchAll(/registersound\s+"?([^"\s]+)"?/g)].map(m => m[1]).filter(n => /weapon/.test(n));
    const k = KEYS[slot]; if (k) {
      const shot = names.find(n => k.test(n) && !/reload|empty|pull|switch/.test(n)), rel = names.find(n => k.test(n) && /reload/.test(n));
      if (shot) return { shot, reload: rel || null, fromCfg: true };
    }
  }
  const g = GUESS[slot]; return g ? { shot: g[0], reload: g[1], fromCfg: false } : null;
}
