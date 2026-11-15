// CUBE MAKER — Modo Jogo: estande de tiro para testar as animações como no AssaultCube
// Clique = atirar · R = recarregar · G = granada · Esc = sair

const WEAPON_STATS = {           // valores aproximados do AssaultCube 1.3
  subgun: { delay: 80, mag: 30, spare: 120, auto: true, pellets: 1, kick: 0.9 },
  assault: { delay: 120, mag: 20, spare: 100, auto: true, pellets: 1, kick: 1.3 },
  sniper: { delay: 1500, mag: 5, spare: 20, auto: false, pellets: 1, kick: 3.5 },
  carbine: { delay: 720, mag: 10, spare: 40, auto: false, pellets: 1, kick: 2 },
  shotgun: { delay: 880, mag: 7, spare: 28, auto: false, pellets: 9, kick: 3.5 },
  pistol: { delay: 160, mag: 10, spare: 50, auto: false, pellets: 1, kick: 1.2 },
  knife: { delay: 500, mag: 0, spare: 0, auto: false, pellets: 0, kick: 0, melee: true },
  grenade: { delay: 650, mag: 1, spare: 3, auto: false, pellets: 0, kick: 0, grenade: true },
};

// ---------------------------------------------------------------- som sintetizado (WebAudio)
class Sfx {
  ctx = null;
  init() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } } if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  noise(dur) { const c = this.ctx, b = c.createBuffer(1, c.sampleRate * dur, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const s = c.createBufferSource(); s.buffer = b; return s; }
  env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  shot(heavy = 1) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime;
    const n = this.noise(0.5), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'lowpass'; f.frequency.setValueAtTime(7000, t); f.frequency.exponentialRampToValueAtTime(300, t + 0.25 * heavy);
    this.env(g, t, 0.002, 0.9, 0.22 * heavy); n.connect(f).connect(g).connect(c.destination); n.start(t); n.stop(t + 0.5);
    const o = c.createOscillator(), g2 = c.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    this.env(g2, t, 0.002, 0.8 * heavy, 0.16); o.connect(g2).connect(c.destination); o.start(t); o.stop(t + 0.3);
  }
  click(freq = 1800, vol = 0.25, when = 0) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime + when;
    const n = this.noise(0.06), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 3;
    this.env(g, t, 0.001, vol, 0.04); n.connect(f).connect(g).connect(c.destination); n.start(t); n.stop(t + 0.08);
  }
  metal(when = 0, pitch = 1) { this.click(2600 * pitch, 0.35, when); this.click(900 * pitch, 0.25, when + 0.012); }
  tink(when = 0) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime + when;
    [3100, 4700, 6200].forEach((fq, i) => { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = fq * (0.95 + Math.random() * 0.1); this.env(g, t, 0.001, 0.08 / (i + 1), 0.25); o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.3); });
  }
  boom() {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime;
    const n = this.noise(2), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'lowpass'; f.frequency.setValueAtTime(1800, t); f.frequency.exponentialRampToValueAtTime(80, t + 1.4);
    this.env(g, t, 0.005, 1, 1.5); n.connect(f).connect(g).connect(c.destination); n.start(t); n.stop(t + 2);
    const o = c.createOscillator(), g2 = c.createGain(); o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(25, t + 0.8); this.env(g2, t, 0.005, 1, 0.9); o.connect(g2).connect(c.destination); o.start(t); o.stop(t + 1);
  }
  swish() { if (!this.ctx) return; const c = this.ctx, t = c.currentTime; const n = this.noise(0.3), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'bandpass'; f.frequency.setValueAtTime(600, t); f.frequency.exponentialRampToValueAtTime(3000, t + 0.15); f.Q.value = 1.5; this.env(g, t, 0.03, 0.4, 0.15); n.connect(f).connect(g).connect(c.destination); n.start(t); n.stop(t + 0.3); }
}

export function createGame(ctx) {
  const { THREE, scene, camera, controls, canvas, root } = ctx;
  const sfx = new Sfx();
  const G = { on: false, stats: null, ammo: 0, spare: 0, firing: false, last: 0, clip: null, clipT0: 0, reloading: false, kick: 0, camKick: 0, yaw: 0, pitch: 0, score: 0, shots: 0, nadeT: 0 };
  const world = new THREE.Group(); world.visible = false; scene.add(world);
  const fx = [];   // efeitos temporários {obj, life, update}
  let targets = [], solids = [], saved = null, hud = null, flash = null, flashLight = null;

  // ------------------------------------------------ estande
  function bullseye() {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    x.fillStyle = '#d8d2c0'; x.fillRect(0, 0, 256, 256);
    [[120, '#2a2a2a'], [96, '#d8d2c0'], [72, '#2a2a2a'], [48, '#d8d2c0'], [24, '#b8344d']].forEach(([r, col]) => { x.beginPath(); x.arc(128, 128, r, 0, 7); x.fillStyle = col; x.fill(); });
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function buildRange() {
    while (world.children.length) world.remove(world.children[0]);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x3a3a3c, roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -22; world.add(floor); solids = [floor];
    const g = new THREE.GridHelper(400, 40, 0x555558, 0x444447); g.position.y = -21.9; world.add(g);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(400, 90, 4), new THREE.MeshStandardMaterial({ color: 0x4a4a4e, roughness: 0.9 }));
    wall.position.set(0, 20, -200); world.add(wall); solids.push(wall);
    const tex = bullseye(); targets = [];
    [[-28, -2, -70], [8, 4, -95], [40, -6, -120], [-55, 10, -150], [70, 12, -170]].forEach(([x, y, z]) => {
      const t = new THREE.Mesh(new THREE.BoxGeometry(14, 14, 1.2), [0, 0, 0, 0, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }), new THREE.MeshStandardMaterial({ color: 0x777777 })].map(m => m || new THREE.MeshStandardMaterial({ color: 0x8a8070 })));
      t.position.set(x, y, z); t.userData.base = t.position.clone(); t.userData.wob = 0; world.add(t); targets.push(t); solids.push(t);
      const post = new THREE.Mesh(new THREE.BoxGeometry(1.2, 22 + y, 1.2), new THREE.MeshStandardMaterial({ color: 0x5a4a3a })); post.position.set(x, (y - 22) / 2 - 3.5, z - 1); world.add(post);
    });
    flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex(), color: 0xffd8a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
    flash.scale.set(9, 9, 1); flash.visible = false; flash.renderOrder = 20; world.add(flash);
    flashLight = new THREE.PointLight(0xffb070, 0, 80, 1.5); world.add(flashLight);
  }
  function flashTex() {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 2, 64, 64, 62); g.addColorStop(0, 'rgba(255,255,230,1)'); g.addColorStop(0.25, 'rgba(255,200,110,0.9)'); g.addColorStop(1, 'rgba(255,120,40,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    x.globalCompositeOperation = 'lighter'; x.strokeStyle = 'rgba(255,220,150,0.8)'; x.lineWidth = 5;
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.random() * 0.3; x.beginPath(); x.moveTo(64, 64); x.lineTo(64 + Math.cos(a) * 60, 64 + Math.sin(a) * 60); x.stroke(); }
    const t = new THREE.CanvasTexture(c); return t;
  }

  // ------------------------------------------------ HUD
  function makeHud() {
    hud = document.createElement('div'); hud.className = 'gamehud';
    hud.innerHTML = `<div class="xhair"></div><div class="ammo"><b>30</b><span>/ 90</span></div><div class="ginfo"></div>
      <div class="ghelp">CLIQUE atirar · <b>R</b> recarregar · <b>G</b> granada · mouse mira · <b>ESC</b> sair</div>
      <div class="gscore">ACERTOS <b>0</b></div><button class="btn gexit">Sair do Modo Jogo</button>`;
    canvas.parentElement.appendChild(hud);
    hud.querySelector('.gexit').onclick = () => exit();
  }
  function updateHud() {
    if (!hud) return;
    hud.querySelector('.ammo b').textContent = G.stats.melee ? '∞' : G.ammo;
    hud.querySelector('.ammo span').textContent = G.stats.melee ? '' : '/ ' + G.spare;
    hud.querySelector('.ammo').classList.toggle('low', !G.stats.melee && G.ammo <= Math.ceil(G.stats.mag * 0.2));
    hud.querySelector('.gscore b').textContent = `${G.score} / ${G.shots}`;
    hud.querySelector('.ginfo').textContent = G.clip ? `${G.clip.name} · quadro ${ctx.getFrame()}` : 'gun idle';
  }

  // ------------------------------------------------ animação do modelo
  function playClip(re, onEnd) {
    const a = ctx.anims().find(x => re.test(x.name));
    const nf = ctx.model().nf;
    if (!a || a.count <= 1) { G.clip = null; onEnd && onEnd(false); return false; }
    G.clip = { name: a.name, start: Math.min(a.start, nf - 1), count: a.count, t0: performance.now(), onEnd };
    return true;
  }
  function idleFrame() { const a = ctx.anims().find(x => /idle/i.test(x.name)); return a ? a.start : 0; }

  // ------------------------------------------------ ações
  function muzzleWorld() { return ctx.tagWorld(); }
  function shoot(now) {
    const st = G.stats;
    if (G.reloading || G.busy || now - G.last < st.delay) return;
    if (st.grenade) return throwGrenade(now);
    if (!st.melee && G.ammo <= 0) { sfx.click(900, 0.3); G.last = now; if (G.spare > 0) reload(); return; }
    G.last = now;
    if (st.melee) { sfx.swish(); playClip(/shoot/i, () => { G.clip = null; }); setTimeout(() => meleeHit(), st.delay * 0.4); return; }
    G.ammo--; G.shots++;
    sfx.shot(st.pellets > 1 ? 1.6 : st.kick > 3 ? 1.4 : 1);
    G.kick = Math.min(1.6, G.kick + st.kick * 0.35); G.camKick += st.kick * 0.012;
    playClip(/shoot/i, () => { G.clip = null; });
    // clarão
    const m = muzzleWorld(); flash.position.copy(m); flash.material.rotation = Math.random() * 6; flash.visible = true; flash.userData.t = now; flashLight.position.copy(m); flashLight.intensity = 6;
    // tiro / tracer
    for (let p = 0; p < st.pellets; p++) {
      const spread = st.pellets > 1 ? 0.06 : 0.004 + G.kick * 0.004;
      const dir = new THREE.Vector3((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, -1).applyQuaternion(camera.quaternion).normalize();
      const ray = new THREE.Raycaster(camera.position.clone(), dir, 0.1, 600);
      const hit = ray.intersectObjects(solids, false)[0];
      const end = hit ? hit.point : camera.position.clone().addScaledVector(dir, 400);
      if (p < 3) tracer(m, end);
      if (hit) impact(hit, targets.includes(hit.object));
    }
    if (!ctx.hasPrim(/estojo/i)) ejectShell();
    else sfx.tink(0.35 + Math.random() * 0.2);
    if (G.ammo === 0 && G.spare > 0) setTimeout(() => G.on && reload(), st.delay + 120);
    updateHud();
  }
  function meleeHit() {
    const ray = new THREE.Raycaster(camera.position.clone(), new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion), 0.1, 90);
    const hit = ray.intersectObjects(solids, false)[0];
    if (hit) { impact(hit, targets.includes(hit.object)); sfx.metal(0, 0.6); }
  }
  function reload() {
    const st = G.stats;
    if (G.reloading || st.melee || st.grenade || G.ammo >= st.mag || G.spare <= 0) return;
    G.reloading = true;
    const a = ctx.anims().find(x => /reload/i.test(x.name));
    const fps = ctx.fps();
    const dur = a && a.count > 1 ? a.count / fps * 1000 : 1400;
    sfx.metal(dur * 0.0003, 0.8); sfx.click(1200, 0.3, dur * 0.0003 + 0.05);           // carregador sai
    sfx.metal(dur * 0.00072, 1.1); sfx.click(2400, 0.35, dur * 0.00075);                // carregador entra (clique)
    sfx.metal(dur * 0.00086, 1.4);                                                       // ferrolho
    const has = playClip(/reload/i, () => { G.clip = null; });
    if (!has) G.dip = { t0: performance.now(), dur };                                    // sem clipe: abaixa a arma como o AC faz
    setTimeout(() => { const need = st.mag - G.ammo, take = Math.min(need, G.spare); G.ammo += take; G.spare -= take; G.reloading = false; updateHud(); }, dur);
    updateHud();
  }
  function throwGrenade(now) {
    if (G.nadeT && now - G.nadeT < 1400) return; G.nadeT = now;
    if (G.stats.grenade) {                                  // arma = granada: tira o pino (gun shoot) e depois arremessa (gun throw)
      if (G.ammo <= 0) { if (G.spare <= 0) return; G.ammo++; G.spare--; }
      G.ammo--; G.busy = true; sfx.click(3200, 0.25);
      const afterPin = () => {
        const hasThrow = playClip(/throw/i, () => { G.clip = null; G.hideUntil = performance.now() + 450; G.busy = false; if (G.ammo <= 0 && G.spare > 0) { G.ammo++; G.spare--; } updateHud(); });
        G.keepLast = hasThrow;
        const a = ctx.anims().find(x => /throw/i.test(x.name)), rel = hasThrow ? Math.max(1, Math.round(a.count * 0.2)) / ctx.fps() * 1000 : 0;
        setTimeout(() => { sfx.swish(); spawnGrenade(0); }, rel);
        if (!hasThrow) { G.busy = false; }
      };
      if (!playClip(/shoot/i, () => { G.clip = null; afterPin(); })) afterPin();
      updateHud(); return;
    }
    sfx.click(3200, 0.25); setTimeout(() => sfx.swish(), 250);
    spawnGrenade(120);
  }
  function spawnGrenade(delay) {
    const geo = new THREE.SphereGeometry(1.1, 12, 10), mat = new THREE.MeshStandardMaterial({ color: 0x4e5434, roughness: 0.7 });
    const n = new THREE.Mesh(geo, mat), dir = new THREE.Vector3(0, 0.25, -1).applyQuaternion(camera.quaternion).normalize();
    n.position.copy(camera.position).add(new THREE.Vector3(2, -2, -3).applyQuaternion(camera.quaternion));
    const vel = dir.multiplyScalar(95); world.add(n);
    let bounced = 0;
    setTimeout(() => {
      fx.push({ obj: n, life: 1.8, update(dt) {
        vel.y -= 120 * dt; n.position.addScaledVector(vel, dt); n.rotation.x += dt * 8;
        if (n.position.y < -21) { n.position.y = -21; vel.y = -vel.y * 0.35; vel.x *= 0.6; vel.z *= 0.6; if (bounced++ < 3) sfx.metal(0, 0.5); }
      }, end() { world.remove(n); explode(n.position.clone()); } });
    }, delay);
    updateHud();
  }
  function explode(p) {
    sfx.boom(); G.camKick += 0.06; G.shake = 0.6;
    const s = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.position.copy(p); world.add(s);
    const L = new THREE.PointLight(0xff9040, 40, 200, 1.2); L.position.copy(p); world.add(L);
    fx.push({ obj: s, life: 0.6, update(dt, k) { s.scale.setScalar(4 + (1 - k) * 26); s.material.opacity = k * 0.9; L.intensity = k * 40; }, end() { world.remove(s); world.remove(L); } });
    for (let i = 0; i < 40; i++) debris(p, 0x3a332a, 60);
    targets.forEach(t => { if (t.position.distanceTo(p) < 45) { t.userData.wob = 1; G.score++; } });
    updateHud();
  }
  function tracer(a, b) {
    const geo = new THREE.BufferGeometry().setFromPoints([a.clone(), b.clone()]);
    const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffd890, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending }));
    world.add(l); fx.push({ obj: l, life: 0.07, update(dt, k) { l.material.opacity = k; }, end() { world.remove(l); geo.dispose(); } });
  }
  function impact(hit, isTarget) {
    const n = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 0, 1);
    const dec = new THREE.Mesh(new THREE.CircleGeometry(0.7, 10), new THREE.MeshBasicMaterial({ color: 0x141414, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
    dec.position.copy(hit.point).addScaledVector(n, 0.05); dec.lookAt(hit.point.clone().add(n));
    (isTarget ? hit.object : world).attach(dec);
    fx.push({ obj: dec, life: 12, update(dt, k) { dec.material.opacity = Math.min(0.85, k * 4); }, end() { dec.parent && dec.parent.remove(dec); } });
    for (let i = 0; i < 7; i++) debris(hit.point, isTarget ? 0xd8d2c0 : 0x888888, 25, n);
    if (isTarget) { hit.object.userData.wob = 1; G.score++; sfx.click(700, 0.2, 0.05); }
    updateHud();
  }
  function debris(p, color, speed, n) {
    const d = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), new THREE.MeshBasicMaterial({ color }));
    d.position.copy(p); world.add(d);
    const v = new THREE.Vector3(Math.random() - 0.5, Math.random(), Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random()));
    if (n) v.addScaledVector(n, speed * 0.6);
    fx.push({ obj: d, life: 0.5 + Math.random() * 0.5, update(dt) { v.y -= 90 * dt; d.position.addScaledVector(v, dt); d.rotation.x += dt * 10; }, end() { world.remove(d); } });
  }
  function ejectShell() {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.9, 8), new THREE.MeshStandardMaterial({ color: 0xc89a48, metalness: 0.8, roughness: 0.35 }));
    const m = muzzleWorld(); const back = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion);
    s.position.copy(m).addScaledVector(back, 9).add(new THREE.Vector3(1, 1.5, 0).applyQuaternion(camera.quaternion));
    const v = new THREE.Vector3(14 + Math.random() * 5, 12 + Math.random() * 4, 3).applyQuaternion(camera.quaternion);
    world.add(s); let landed = false;
    fx.push({ obj: s, life: 1.6, update(dt) { v.y -= 70 * dt; s.position.addScaledVector(v, dt); s.rotation.x += dt * 22; s.rotation.z += dt * 15; if (s.position.y < -21.6 && !landed) { landed = true; v.set(v.x * 0.3, Math.abs(v.y) * 0.25, v.z * 0.3); sfx.tink(); } }, end() { world.remove(s); } });
  }

  // ------------------------------------------------ entrada
  function onDown(e) {
    if (!G.on) return; sfx.init();
    if (e.button === 0) { G.firing = true; shoot(performance.now()); if (canvas.requestPointerLock && document.pointerLockElement !== canvas) { try { const r = canvas.requestPointerLock(); r && r.catch && r.catch(() => { }); } catch (err) { } } }
    if (e.button === 2) { G.aim = !G.aim; }
  }
  function onUp(e) { if (e.button === 0) G.firing = false; }
  function onMove(e) {
    if (!G.on) return;
    if (document.pointerLockElement === canvas) { G.yaw -= e.movementX * 0.0022; G.pitch -= e.movementY * 0.0022; }
    else { const r = canvas.getBoundingClientRect(); G.yaw = -((e.clientX - r.left) / r.width - 0.5) * 0.9; G.pitch = -((e.clientY - r.top) / r.height - 0.5) * 0.5; }
    G.yaw = Math.max(-1.1, Math.min(1.1, G.yaw)); G.pitch = Math.max(-0.6, Math.min(0.6, G.pitch));
    G.sway = Math.max(-1, Math.min(1, (G.sway || 0) + e.movementX * 0.01));
  }
  function onKey(e) {
    if (!G.on) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') { if (document.pointerLockElement !== canvas) exit(); return; }
    if (k === 'r') { sfx.init(); reload(); }
    if (k === 'g') { sfx.init(); throwGrenade(performance.now()); }
    e.stopPropagation(); e.preventDefault();
  }
  const ctxMenu = e => { if (G.on) e.preventDefault(); };

  // ------------------------------------------------ ciclo
  const tmpM = new THREE.Matrix4(), baseRot = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
  function update(dt, now) {
    if (!G.on) return;
    if (G.firing && G.stats.auto) shoot(now);
    // animação do modelo
    if (G.clip) {
      const f = Math.floor((now - G.clip.t0) / 1000 * ctx.fps());
      if (f >= G.clip.count) { const cb = G.clip.onEnd, last = G.clip.start + G.clip.count - 1, keep = G.keepLast; G.clip = null; G.keepLast = false; cb && cb(true); if (!G.clip) ctx.setFrame(keep ? last : idleFrame()); }
      else if (G.clip.start + f !== ctx.getFrame()) ctx.setFrame(G.clip.start + f);
    }
    // câmera
    G.camKick *= Math.pow(0.002, dt); G.kick *= Math.pow(0.0005, dt); G.sway = (G.sway || 0) * Math.pow(0.01, dt);
    let shake = 0; if (G.shake) { G.shake = Math.max(0, G.shake - dt); shake = G.shake; }
    camera.position.set((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, 0);
    camera.rotation.set(G.pitch + G.camKick, G.yaw, 0, 'YXZ');
    camera.updateMatrixWorld();
    // arma presa à câmera + recuo procedural (como o "kick" do AC) + balanço
    let dip = 0;
    if (G.dip) { const k = (now - G.dip.t0) / G.dip.dur; if (k >= 1) G.dip = null; else dip = Math.sin(k * Math.PI); }
    const kickBack = G.kick * 1.6, kickUp = G.kick * 0.05;
    tmpM.copy(camera.matrixWorld)
      .multiply(new THREE.Matrix4().makeTranslation(-G.sway * 0.4, -dip * 9, kickBack))
      .multiply(new THREE.Matrix4().makeRotationX(kickUp - dip * 0.5))
      .multiply(new THREE.Matrix4().makeRotationY(-G.sway * 0.03))
      .multiply(baseRot);
    root.matrix.copy(tmpM); root.matrixWorldNeedsUpdate = true;
    root.visible = !(G.hideUntil && now < G.hideUntil);
    if (G.hideUntil && now >= G.hideUntil) { G.hideUntil = 0; ctx.setFrame(idleFrame()); }
    // clarão
    if (flash.visible && now - flash.userData.t > 45) { flash.visible = false; }
    flashLight.intensity *= Math.pow(0.0001, dt);
    // alvos balançam
    targets.forEach(t => { if (t.userData.wob > 0) { t.userData.wob = Math.max(0, t.userData.wob - dt * 1.4); t.rotation.x = Math.sin(t.userData.wob * 18) * t.userData.wob * 0.5; } });
    // efeitos
    for (let i = fx.length - 1; i >= 0; i--) {
      const e = fx[i]; e.life -= dt; e.max = e.max || e.life + dt;
      if (e.life <= 0) { e.end && e.end(); fx.splice(i, 1); continue; }
      e.update && e.update(dt, e.life / e.max);
    }
    if (Math.random() < 0.2) updateHud();
  }

  function enter() {
    if (!ctx.model()) return ctx.toast('Abra uma arma primeiro', 'warn');
    sfx.init();
    G.stats = WEAPON_STATS[ctx.weapon()] || WEAPON_STATS.subgun;
    G.ammo = G.stats.mag; G.spare = G.stats.spare; G.busy = false; G.hideUntil = 0; G.keepLast = false; G.score = 0; G.shots = 0; G.kick = 0; G.camKick = 0; G.yaw = 0; G.pitch = 0; G.clip = null; G.reloading = false;
    saved = { pos: camera.position.clone(), quat: camera.quaternion.clone(), target: controls.target.clone(), fov: camera.fov, bg: scene.background, auto: root.matrixAutoUpdate };
    buildRange(); world.visible = true; ctx.setGameMode(true);
    controls.enabled = false; camera.fov = 70; camera.updateProjectionMatrix();
    root.matrixAutoUpdate = false;
    scene.background = new THREE.Color(0x232326);
    makeHud(); updateHud();
    canvas.addEventListener('pointerdown', onDown); window.addEventListener('pointerup', onUp); window.addEventListener('pointermove', onMove);
    window.addEventListener('keydown', onKey, true); canvas.addEventListener('contextmenu', ctxMenu);
    G.on = true; ctx.setFrame(idleFrame());
  }
  function exit() {
    if (!G.on) return; G.on = false; G.firing = false;
    if (document.pointerLockElement) document.exitPointerLock();
    canvas.removeEventListener('pointerdown', onDown); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointermove', onMove);
    window.removeEventListener('keydown', onKey, true); canvas.removeEventListener('contextmenu', ctxMenu);
    fx.splice(0).forEach(e => e.end && e.end());
    world.visible = false; hud && hud.remove(); hud = null;
    root.visible = true; root.matrixAutoUpdate = true; root.position.set(0, 0, 0); root.rotation.set(-Math.PI / 2, 0, 0); root.scale.set(1, 1, 1); root.updateMatrix();
    camera.position.copy(saved.pos); camera.quaternion.copy(saved.quat); camera.fov = saved.fov; camera.updateProjectionMatrix();
    controls.target.copy(saved.target); controls.enabled = true; scene.background = saved.bg;
    ctx.setGameMode(false); ctx.setFrame(0);
  }
  return { enter, exit, update, get on() { return G.on; } };
}
