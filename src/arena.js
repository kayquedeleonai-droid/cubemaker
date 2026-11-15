// CUBE MAKER — Arena de treino (CQB) com soldados-bot para o Modo Jogo
const FLOOR = -22, WALL_H = 62;

function canvasTex(THREE, w, h, draw, rep = [1, 1]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.anisotropy = 4; return t;
}
const noise = (x, w, h, a, base) => { const im = x.getImageData(0, 0, w, h), d = im.data; for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * a; d[i] += n; d[i + 1] += n; d[i + 2] += n; } x.putImageData(im, 0, 0); };

export function buildArena(THREE, world) {
  const solids = [], boxes = [];
  const concrete = canvasTex(THREE, 256, 256, (x, w, h) => { x.fillStyle = '#5c5a56'; x.fillRect(0, 0, w, h); noise(x, w, h, 26); x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 2; x.strokeRect(1, 1, w - 2, h - 2); }, [12, 12]);
  const wallTex = canvasTex(THREE, 256, 256, (x, w, h) => {
    x.fillStyle = '#6e6a62'; x.fillRect(0, 0, w, h); noise(x, w, h, 22);
    x.fillStyle = 'rgba(40,36,30,0.55)'; x.fillRect(0, h * 0.72, w, h * 0.28);           // faixa inferior suja
    x.fillStyle = 'rgba(200,60,80,0.55)'; x.fillRect(0, h * 0.7, w, 6);                    // faixa de marcação
    x.strokeStyle = 'rgba(0,0,0,0.18)'; for (let i = 0; i < w; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); }
  });
  const crateTex = canvasTex(THREE, 128, 128, (x, w, h) => {
    x.fillStyle = '#7a5a34'; x.fillRect(0, 0, w, h); noise(x, w, h, 30);
    x.strokeStyle = '#3a2814'; x.lineWidth = 6; x.strokeRect(3, 3, w - 6, h - 6); x.beginPath(); x.moveTo(6, 6); x.lineTo(w - 6, h - 6); x.stroke();
    x.lineWidth = 2; for (let i = 0; i < h; i += 21) { x.beginPath(); x.moveTo(0, i); x.lineTo(w, i); x.stroke(); }
    x.fillStyle = 'rgba(20,20,20,0.6)'; x.font = 'bold 18px monospace'; x.fillText('WH 44', 30, 72);
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), new THREE.MeshStandardMaterial({ map: concrete, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR; world.add(floor); solids.push(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), new THREE.MeshStandardMaterial({ color: 0x2c2b2a, roughness: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = FLOOR + WALL_H + 8; world.add(ceil);
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 }), crateMat = new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.85 });
  const box = (cx, cz, w, d, h = WALL_H, mat = wallMat, y0 = FLOOR) => {
    const g = new THREE.BoxGeometry(w, h, d);
    if (mat === wallMat) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(w, d) / 60, uv.getY(i) * h / 60); }
    const m = new THREE.Mesh(g, mat); m.position.set(cx, y0 + h / 2, cz); world.add(m); solids.push(m);
    boxes.push({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2, top: y0 + h });
    return m;
  };
  // paredes externas
  box(0, -205, 420, 10); box(0, 205, 420, 10); box(-205, 0, 10, 420); box(205, 0, 10, 420);
  // sala central com 4 portas
  [[-45, -70, 50, 6], [45, -70, 50, 6], [-45, 70, 50, 6], [45, 70, 50, 6], [-70, -45, 6, 50], [-70, 45, 6, 50], [70, -45, 6, 50], [70, 45, 6, 50]].forEach(a => box(...a));
  // corredores e divisórias
  box(-135, -60, 6, 90); box(135, 60, 6, 90); box(-60, -140, 90, 6); box(60, 140, 90, 6);
  // caixotes (cobertura)
  [[-130, -130, 30, 30, 28], [-158, -130, 22, 22, 22], [130, -125, 34, 24, 26], [-120, 125, 24, 24, 24], [125, 130, 30, 30, 30], [0, -150, 40, 20, 18],
   [-160, 20, 20, 40, 22], [160, -20, 20, 40, 22], [0, 0, 22, 22, 26], [30, 110, 22, 22, 20], [-30, -105, 22, 22, 20]].forEach(([x, z, w, d, h]) => box(x, z, w, d, h, crateMat));
  box(-130, -130, 22, 22, 18, crateMat, FLOOR + 28);   // caixote empilhado
  // luzes
  const lights = [];
  world.add(new THREE.HemisphereLight(0xd8d4c8, 0x2a2826, 0.9));
  [[0, 0], [-140, -140], [140, 140], [-140, 140], [140, -140]].forEach(([x, z]) => { const L = new THREE.PointLight(0xffe2b8, 1.6, 260, 1.2); L.position.set(x, FLOOR + WALL_H - 4, z); world.add(L); lights.push(L);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(14, 2, 4), new THREE.MeshBasicMaterial({ color: 0xfff0d0 })); lamp.position.copy(L.position).add(new THREE.Vector3(0, 6, 0)); world.add(lamp); });
  // pontos livres para patrulha / nascimento
  const free = (x, z, r = 12) => Math.abs(x) < 196 - r && Math.abs(z) < 196 - r && !boxes.some(b => x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r);
  const way = []; for (let x = -180; x <= 180; x += 30) for (let z = -180; z <= 180; z += 30) if (free(x, z)) way.push(new THREE.Vector3(x, FLOOR, z));
  return { solids, boxes, way, free, start: new THREE.Vector3(0, 0, 165) };
}

// colisão de um círculo (jogador/bot) contra as caixas, no plano XZ
export function collide(p, boxes, r = 7) {
  for (const b of boxes) {
    if (b.top < FLOOR + 10) continue;
    const cx = Math.max(b.x0, Math.min(p.x, b.x1)), cz = Math.max(b.z0, Math.min(p.z, b.z1));
    const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-6) { const d = Math.sqrt(d2); p.x = cx + dx / d * r; p.z = cz + dz / d * r; }
      else { const opts = [[p.x - b.x0 + r, -1, 0], [b.x1 - p.x + r, 1, 0], [p.z - b.z0 + r, 0, -1], [b.z1 - p.z + r, 0, 1]].sort((a, c) => a[0] - c[0])[0]; p.x += opts[1] * opts[0]; p.z += opts[2] * opts[0]; }
    }
  }
}

// ------------------------------------------------------------------ soldado-bot
const UNIFORMS = [
  { body: 0x5c6252, legs: 0x4e5346, helmet: 0x4a4e44 },   // feldgrau
  { body: 0x8a7a54, legs: 0x5c5438, helmet: 0x4e5634 },   // US OD
  { body: 0x8c835c, legs: 0x5e5a42, helmet: 0x4c5440 },   // soviético
];
export class Bot {
  constructor(THREE, world, pos, i) {
    this.T = THREE; this.hp = 100; this.dead = false; this.respawnAt = 0; this.cool = 1 + Math.random(); this.target = null; this.walk = 0;
    const U = UNIFORMS[i % UNIFORMS.length], M = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 });
    const g = new THREE.Group(); this.g = g; this.meshes = [];
    const part = (geo, mat, x, y, z, name) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.userData = { bot: this, part: name }; g.add(m); this.meshes.push(m); return m; };
    this.legL = new THREE.Group(); this.legR = new THREE.Group(); this.legL.position.set(-2.4, 12, 0); this.legR.position.set(2.4, 12, 0); g.add(this.legL, this.legR);
    const leg = (grp) => { const m = new THREE.Mesh(new THREE.BoxGeometry(3.6, 12, 3.6), M(U.legs)); m.position.y = -6; m.userData = { bot: this, part: 'legs' }; grp.add(m); this.meshes.push(m);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(3.8, 2.4, 5.4), M(0x2a2622)); boot.position.set(0, -11.4, 0.8); boot.userData = { bot: this, part: 'legs' }; grp.add(boot); this.meshes.push(boot); };
    leg(this.legL); leg(this.legR);
    part(new THREE.BoxGeometry(9.5, 11, 5.2), M(U.body), 0, 17.5, 0, 'body');
    part(new THREE.BoxGeometry(10, 2, 5.6), M(0x2a2622), 0, 12.6, 0, 'body');                                   // cinto
    part(new THREE.BoxGeometry(5.4, 5.4, 5.4), M(0xc89a7a), 0, 26, 0, 'head');                                    // rosto
    const hel = part(new THREE.SphereGeometry(4.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(U.helmet), 0, 27.4, 0, 'head'); hel.scale.set(1, 0.8, 1.05);
    this.armL = new THREE.Group(); this.armL.position.set(-5.8, 22, 0); g.add(this.armL);
    this.armR = new THREE.Group(); this.armR.position.set(5.8, 22, 0); g.add(this.armR);
    [this.armL, this.armR].forEach(a => { const m = new THREE.Mesh(new THREE.BoxGeometry(3, 10, 3), M(U.body)); m.position.set(0, -4, 3); m.rotation.x = -1.1; m.userData = { bot: this, part: 'body' }; a.add(m); this.meshes.push(m); });
    const gun = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.8, 16), M(0x222222)); gun.position.set(2, 18.5, 8); gun.userData = { bot: this, part: 'body' }; g.add(gun); this.meshes.push(gun);
    this.muzzle = new THREE.Object3D(); this.muzzle.position.set(2, 18.8, 16.5); g.add(this.muzzle);
    g.position.copy(pos); g.position.y = FLOOR; world.add(g);
  }
  headPos(v) { return this.g.localToWorld(v.set(0, 25, 0)); }
}
