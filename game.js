// =============================================
// SINGULARITY — Thread the impossible needle
// =============================================

const UA = navigator.userAgent;
const MOBILE = /Android|iPhone|iPad|iPod/i.test(UA) || (window.innerWidth < 768 && 'ontouchstart' in window);
const TOUCH = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const DPR = Math.min(window.devicePixelRatio || 1, MOBILE ? 1.5 : 2);
const PERF = MOBILE ? (window.innerWidth < 400 ? 0 : 1) : 2;

const TAU = Math.PI * 2, DEG = Math.PI / 180;
const norm = a => ((a % TAU) + TAU) % TAU;
const adiff = (a, b) => { let d = norm(a) - norm(b); if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - (1 - t) * (1 - t) * (1 - t);
const rand = (a, b) => Math.random() * (b - a) + a;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ---- Config ----
const C = {
  particles: [35, 80, 200][PERF],
  stars: [25, 55, 120][PERF],
  blur: [0, 6, 14][PERF],
  trailLen: [6, 14, 22][PERF],
  playerR: MOBILE ? 9 : 7,
  ringThick: MOBILE ? 4 : 3,
  // ULTRA HARD settings
  orbitSpeed: 2.1,          // faster orbit
  baseRotSpeed: 0.7,        // faster ring rotation
  speedUp: 0.17,            // bigger speed increase per level
  initGap: 20,              // smaller starting gap (was 25)
  minGap: 8,                // tiny minimum gap
  gapShrink: 1.8,           // faster shrink
  jumpDur: 0.1,
  cooldown: 0.18,
  bgCol: '#03030c',
  playerCol: '#00ffea',
  singCol: '#cc00ff',
  deathCol: '#ff2244',
  successCol: '#00ff88',
  hueBase: 195,
  hueShift: 28,
  SECRET: 'ᚲᛟᛞᛖ ᛁᛊ ᛦᛟᚢᛊᛖᚠ_ᛦᛟᚢᚱ_ᚲᛚᚨᛈᛈᛖᛞ'
};

// ---- Audio ----
class SFX {
  constructor() { this.ctx = null; }
  init() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
  _t(f, d, type, v, r) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.connect(g); g.connect(this.ctx.destination);
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (r) o.frequency.exponentialRampToValueAtTime(r, t + d * 0.8);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.start(t); o.stop(t + d);
  }
  jump() { this._t(500, 0.09, 'sine', 0.18, 950); }
  die() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, sr = this.ctx.sampleRate;
    const n = sr * 0.18, buf = this.ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (n * 0.05));
    const s = this.ctx.createBufferSource(); s.buffer = buf;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    s.connect(g); g.connect(this.ctx.destination); s.start(t);
    this._t(70, 0.25, 'sine', 0.12, 25);
  }
  lvl() { [523, 659, 784, 1047].forEach((f, i) => this._t(f, 0.22, 'sine', 0.1)); }
  secret() { [261, 330, 392, 523, 660].forEach((f, i) => setTimeout(() => this._t(f, 1.4, 'sine', 0.07), i * 180)); }
  cheat() { this._t(300, 0.15, 'square', 0.1, 600); setTimeout(() => this._t(600, 0.2, 'square', 0.08, 900), 100); }
}

// ---- Particles (object pool) ----
class Particles {
  constructor() {
    this.p = [];
    for (let i = 0; i < C.particles; i++)
      this.p.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, r: 2, col: '#fff', on: false });
  }
  emit(x, y, n, col, spd, life) {
    for (let i = 0; i < n; i++) {
      let p = null;
      for (let j = 0; j < this.p.length; j++) { if (!this.p[j].on) { p = this.p[j]; break; } }
      if (!p) return;
      const a = rand(0, TAU), s = rand(spd * 0.2, spd);
      p.x = x; p.y = y; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
      p.life = life; p.max = life; p.r = rand(1.2, 3.2); p.col = col; p.on = true;
    }
  }
  update(dt) {
    for (let i = 0; i < this.p.length; i++) {
      const p = this.p[i]; if (!p.on) continue;
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.97; p.vy *= 0.97;
      p.life -= dt; if (p.life <= 0) p.on = false;
    }
  }
  draw(ctx) {
    const ub = C.blur > 0;
    for (let i = 0; i < this.p.length; i++) {
      const p = this.p[i]; if (!p.on) continue;
      const a = clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = a * 0.85;
      ctx.fillStyle = p.col;
      if (ub) { ctx.shadowColor = p.col; ctx.shadowBlur = 5; }
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * a, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }
}

// ---- Ring ----
class Ring {
  constructor(radius, gapDeg, rotSpeed, hue, ghost) {
    this.radius = radius;
    this.gapAngle = rand(0, TAU);
    this.gapSize = gapDeg * DEG;
    this.rotSpeed = rotSpeed;
    this.rotation = 0;
    this.hue = hue;
    this.cleared = false;
    this.t = rand(0, 10);
    this.hitFlash = 0;
    // Ghost mechanic
    this.ghost = ghost;
    this.ghostT = rand(0, 6);
    this.ghostCycle = rand(2.5, 4);
    this.vis = 1; // 0=invisible, 1=visible
  }
  get curGap() { return norm(this.gapAngle + this.rotation); }
  inGap(angle) { return Math.abs(adiff(angle, this.curGap)) < this.gapSize / 2; }
  update(dt) {
    this.rotation += this.rotSpeed * dt;
    this.t += dt;
    if (this.hitFlash > 0) this.hitFlash -= dt * 3.5;
    // Ghost visibility
    if (this.ghost && !this.cleared) {
      this.ghostT += dt;
      const phase = (this.ghostT % this.ghostCycle) / this.ghostCycle;
      if (phase < 0.3) this.vis = 1;
      else if (phase < 0.38) this.vis = 1 - (phase - 0.3) / 0.08;
      else if (phase < 0.82) this.vis = 0;
      else this.vis = (phase - 0.82) / 0.18;
    } else if (this.cleared) {
      this.vis = 1;
    }
  }
  draw(ctx, cx, cy, isNext) {
    if (this.vis < 0.03 && !this.cleared) return; // skip invisible
    const gap = this.curGap;
    const start = gap + this.gapSize / 2, end = gap - this.gapSize / 2 + TAU;
    const pulse = 0.88 + Math.sin(this.t * 2.8) * 0.12;
    let l, sat, alpha;
    if (this.cleared) {
      l = 16 + this.hitFlash * 35; sat = 25; alpha = 0.25 + this.hitFlash * 0.5;
    } else {
      l = 52 * pulse; sat = 100; alpha = this.vis;
    }
    const col = `hsla(${this.hue},${sat}%,${l}%,${alpha})`;
    ctx.beginPath(); ctx.arc(cx, cy, this.radius, start, end);
    ctx.strokeStyle = col; ctx.lineWidth = C.ringThick + (isNext ? 1 : 0);
    if (C.blur > 0) { ctx.shadowColor = col; ctx.shadowBlur = this.cleared ? 2 : 10; }
    ctx.stroke();
    // gap markers
    if (!this.cleared && this.vis > 0.3) {
      const ms = isNext ? 4 : 2.5;
      const mc = isNext ? `rgba(255,255,255,${this.vis})` : col;
      for (const a of [gap - this.gapSize / 2, gap + this.gapSize / 2]) {
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * this.radius, cy + Math.sin(a) * this.radius, ms, 0, TAU);
        ctx.fillStyle = mc;
        ctx.fill();
      }
    }
    ctx.shadowBlur = 0;
  }
}

// ---- Player ----
class Player {
  constructor() { this.reset(); }
  reset() {
    this.angle = 0; this.ringIdx = 0; this.orbitR = 0;
    this.speed = C.orbitSpeed; this.trail = [];
    this.jumping = false; this.jumpProg = 0;
    this.jumpFrom = 0; this.jumpTo = 0;
    this.cooldown = 0; this.alive = true; this.pt = 0;
  }
  get x() { return Math.cos(this.angle) * this.orbitR; }
  get y() { return Math.sin(this.angle) * this.orbitR; }
  update(dt, cx, cy, timeMult) {
    this.pt += dt;
    if (this.jumping) {
      this.jumpProg += dt / C.jumpDur;
      if (this.jumpProg >= 1) { this.jumping = false; this.orbitR = this.jumpTo; this.cooldown = C.cooldown; }
      else this.orbitR = lerp(this.jumpFrom, this.jumpTo, easeOut(this.jumpProg));
    }
    if (this.cooldown > 0) this.cooldown -= dt;
    this.angle += this.speed * dt * timeMult;
    this.trail.unshift({ x: cx + this.x, y: cy + this.y });
    if (this.trail.length > C.trailLen) this.trail.length = C.trailLen;
  }
  draw(ctx, cx, cy) {
    const px = cx + this.x, py = cy + this.y;
    const pr = C.playerR * (1 + Math.sin(this.pt * 5.5) * 0.1);
    // trail
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i], a = 1 - i / this.trail.length;
      ctx.globalAlpha = a * 0.28; ctx.fillStyle = C.playerCol;
      ctx.beginPath(); ctx.arc(t.x, t.y, pr * a * 0.5, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // body
    ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU);
    ctx.fillStyle = C.playerCol;
    if (C.blur > 0) { ctx.shadowColor = C.playerCol; ctx.shadowBlur = 16; }
    ctx.fill();
    ctx.beginPath(); ctx.arc(px, py, pr * 0.35, 0, TAU);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.shadowBlur = 0;
  }
}

// ---- Game ----
class Game {
  constructor() {
    this.cvs = document.getElementById('gameCanvas');
    this.ctx = this.cvs.getContext('2d');
    this.w = 0; this.h = 0; this.cx = 0; this.cy = 0;
    this.state = 'menu'; // menu | playing | dying | levelUp | secret
    this.stateT = 0;
    this.level = 1;
    this.deaths = 0;
    this.totalDeaths = 0;
    this.best = parseInt(localStorage.getItem('sg_best2') || '0');
    this.rings = [];
    this.player = new Player();
    this.particles = new Particles();
    this.sfx = new SFX();
    this.shake = { x: 0, y: 0, i: 0 };
    this.singPulse = 0; this.menuT = 0;
    this.flashA = 0; this.flashCol = '#fff';
    this.lastT = 0;
    this.secretRevealed = 0;
    // Cheat system
    this.cheatUsed = false;
    this.cheatActive = false;
    this.timeMult = 1;        // 1 = normal, 0.5 = slow
    this.cheatFeedbackT = 0;
    // Stars
    this.stars = [];
    for (let i = 0; i < C.stars; i++)
      this.stars.push({ x: Math.random(), y: Math.random(), r: rand(0.3, 1.6), a: rand(0.12, 0.5), sp: rand(0.3, 1.2) });
    // Nebulae
    this.neb = [];
    if (PERF >= 1) for (let i = 0; i < 3; i++)
      this.neb.push({ x: rand(0.2, 0.8), y: rand(0.2, 0.8), r: rand(0.12, 0.25), h: rand(200, 300), a: rand(0.015, 0.03) });

    this._input();
    this._chatSetup();
    this._resize();
    window.addEventListener('resize', () => this._resize());
    document.fonts.ready.then(() => { this.lastT = performance.now(); requestAnimationFrame(t => this._loop(t)); });
  }

  _resize() {
    this.w = window.innerWidth; this.h = window.innerHeight;
    this.cvs.width = this.w * DPR; this.cvs.height = this.h * DPR;
    this.cvs.style.width = this.w + 'px'; this.cvs.style.height = this.h + 'px';
    this.ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    this.cx = this.w / 2; this.cy = this.h / 2;
  }

  // ---- Chat Bar / Cheat Codes ----
  _chatSetup() {
    const inp = document.getElementById('chatInput');
    const fb = document.getElementById('chatFeedback');
    inp.addEventListener('keydown', e => {
      e.stopPropagation(); // don't trigger game controls
      if (e.key === 'Enter') {
        e.preventDefault();
        const code = inp.value.trim();
        inp.value = '';
        this._cheat(code, fb);
        inp.blur();
      }
    });
  }

  _cheat(code, fb) {
    const show = (msg, cls) => {
      fb.textContent = msg; fb.className = cls;
      clearTimeout(this._fbTimer);
      this._fbTimer = setTimeout(() => { fb.textContent = ''; }, 3000);
    };
    if (this.state !== 'playing') { show('START GAME FIRST', 'error'); return; }
    if (code === '999') {
      if (this.cheatUsed) { show('ALREADY USED (1x PER RUN)', 'error'); return; }
      this.cheatUsed = true;
      this.cheatActive = true;
      this.timeMult = 0.5;
      this.sfx.cheat();
      show('0.5x SPEED ACTIVE', 'success');
      this.cheatFeedbackT = 3;
    } else if (code === '70199') {
      this.sfx.cheat();
      this._startLevel(10);
      show('WARP TO LEVEL 10', 'success');
    } else {
      show('INVALID CODE', 'error');
    }
  }

  // ---- Input ----
  _input() {
    const chatInp = document.getElementById('chatInput');
    const isChatFocused = () => document.activeElement === chatInp;
    const act = () => { if (isChatFocused()) return; this.sfx.init(); this._onInput(); };
    if (TOUCH) {
      this.cvs.addEventListener('touchstart', e => { e.preventDefault(); act(); }, { passive: false });
      this.cvs.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
    }
    this.cvs.addEventListener('mousedown', act);
    window.addEventListener('keydown', e => {
      if (isChatFocused()) return;
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); act(); }
    });
  }

  _onInput() {
    if (this.state === 'menu') {
      this._startLevel(1); this.state = 'playing';
      this.deaths = 0; this.cheatUsed = false; this.cheatActive = false; this.timeMult = 1;
      return;
    }
    if (this.state === 'playing') this._jump();
    if (this.state === 'secret') { this.state = 'menu'; this.level = 1; }
  }

  _startLevel(lv) {
    this.level = lv;
    let count = Math.min(3 + Math.floor(lv * 0.8), 8);
    let gapDeg = Math.max(C.initGap - (lv - 1) * C.gapShrink, C.minGap);
    let speedMult = 1 + (lv - 1) * C.speedUp;

    if (lv >= 10) {
      count = 20;
      gapDeg = 1;
      speedMult *= 4;
    }
    const maxR = Math.min(this.w, this.h) * (MOBILE ? 0.35 : 0.37);
    const minR = MOBILE ? 42 : 52;
    this.rings = [];
    // Determine ghost count based on level
    const ghostCount = lv >= 10 ? count - 1 : (lv < 3 ? 0 : lv < 5 ? 1 : lv < 7 ? 2 : Math.min(count - 2, 4));
    // Pick which rings ghost (never the first ring the player is on)
    const ghostSet = new Set();
    if (ghostCount > 0) {
      let attempts = 0;
      while (ghostSet.size < ghostCount && attempts < 100) {
        const idx = 1 + Math.floor(Math.random() * (count - 1));
        ghostSet.add(idx);
        attempts++;
      }
    }
    for (let i = 0; i < count; i++) {
      const t = count > 1 ? i / (count - 1) : 0;
      const r = maxR - t * (maxR - minR);
      const spd = (C.baseRotSpeed + rand(0.1, 0.45)) * speedMult;
      const dir = lv <= 1 ? (i % 2 === 0 ? 1 : -1) : (Math.random() > 0.45 ? 1 : -1);
      const hue = C.hueBase + i * C.hueShift;
      this.rings.push(new Ring(r, gapDeg, spd * dir, hue, ghostSet.has(i)));
    }
    this.player.reset();
    this.player.orbitR = this.rings[0].radius;
    this.player.speed = C.orbitSpeed * (1 + (lv - 1) * 0.07);
    this.stateT = 0;
  }

  _jump() {
    const p = this.player;
    if (p.jumping || p.cooldown > 0 || !p.alive) return;
    const ni = p.ringIdx + 1;
    if (ni >= this.rings.length) {
      if (this.rings[this.rings.length - 1].cleared) { this._lvlComplete(); return; }
      return;
    }
    const nr = this.rings[ni];
    if (nr.inGap(p.angle)) {
      nr.cleared = true; nr.hitFlash = 1;
      this.rings[p.ringIdx].cleared = true;
      p.jumping = true; p.jumpProg = 0;
      p.jumpFrom = p.orbitR; p.jumpTo = nr.radius; p.ringIdx = ni;
      this.sfx.jump();
      this.particles.emit(this.cx + p.x, this.cy + p.y, PERF >= 1 ? 14 : 6, C.successCol, 90, 0.35);
      if (ni === this.rings.length - 1) setTimeout(() => this._lvlComplete(), 200);
    } else {
      this._die();
    }
  }

  _die() {
    const p = this.player;
    p.alive = false;
    this.state = 'dying'; this.stateT = 0;
    this.deaths++; this.totalDeaths++;
    this.sfx.die();
    const px = this.cx + p.x, py = this.cy + p.y;
    this.particles.emit(px, py, PERF >= 1 ? 35 : 15, C.deathCol, 160, 0.6);
    this.particles.emit(px, py, PERF >= 1 ? 10 : 4, '#ff8800', 80, 0.45);
    this.shake.i = MOBILE ? 7 : 12;
    this.flashA = 0.3; this.flashCol = C.deathCol;
  }

  _lvlComplete() {
    if (this.state === 'levelUp' || this.state === 'secret') return;
    if (this.level >= 10) {
      this.state = 'secret'; this.stateT = 0; this.secretRevealed = 0;
      this.sfx.secret();
      if (this.level > this.best) { this.best = this.level; localStorage.setItem('sg_best2', this.best); }
      this.particles.emit(this.cx, this.cy, C.particles, '#fff', 180, 1.3);
      this.particles.emit(this.cx, this.cy, Math.floor(C.particles * 0.5), C.singCol, 130, 1);
      this.flashA = 0.45; this.flashCol = '#fff';
      return;
    }
    this.state = 'levelUp'; this.stateT = 0;
    this.sfx.lvl();
    if (this.level > this.best) { this.best = this.level; localStorage.setItem('sg_best2', this.best); }
    this.particles.emit(this.cx, this.cy, PERF >= 1 ? 45 : 18, C.singCol, 140, 0.9);
    this.flashA = 0.2; this.flashCol = C.singCol;
  }

  // ---- Update ----
  update(dt) {
    this.menuT += dt; this.singPulse += dt;
    this.particles.update(dt);
    if (this.shake.i > 0) {
      this.shake.x = (Math.random() - 0.5) * this.shake.i;
      this.shake.y = (Math.random() - 0.5) * this.shake.i;
      this.shake.i *= 0.85; if (this.shake.i < 0.15) this.shake.i = 0;
    } else { this.shake.x = 0; this.shake.y = 0; }
    if (this.flashA > 0) this.flashA *= 0.9;
    if (this.cheatFeedbackT > 0) this.cheatFeedbackT -= dt;
    for (const s of this.stars) s.a = clamp(0.12 + Math.sin(this.menuT * s.sp + s.x * 8) * 0.25, 0.06, 0.55);

    if (this.state === 'playing') {
      this.stateT += dt;
      const tm = this.timeMult;
      for (const r of this.rings) { const origSpeed = r.rotSpeed; r.rotSpeed *= tm; r.update(dt); r.rotSpeed = origSpeed; }
      this.player.update(dt, this.cx, this.cy, tm);
      // ambient
      if (PERF >= 1 && Math.random() < 0.1) { const a = rand(0, TAU); this.particles.emit(this.cx + Math.cos(a) * 8, this.cy + Math.sin(a) * 8, 1, C.singCol, 20, 0.9); }
    }
    if (this.state === 'dying') {
      this.stateT += dt;
      for (const r of this.rings) r.update(dt);
      // DEATH RESETS TO LEVEL 1
      if (this.stateT > 0.85) { this._startLevel(1); this.state = 'playing'; }
    }
    if (this.state === 'levelUp') {
      this.stateT += dt;
      if (this.stateT < 0.8 && PERF >= 1 && Math.random() < 0.25) {
        const a = rand(0, TAU), d = rand(15, 70);
        this.particles.emit(this.cx + Math.cos(a) * d, this.cy + Math.sin(a) * d, 1, C.successCol, 50, 0.5);
      }
      if (this.stateT > 1.8) { this._startLevel(this.level + 1); this.state = 'playing'; }
    }
    if (this.state === 'secret') {
      this.stateT += dt;
      this.secretRevealed = clamp(this.stateT / 3, 0, 1);
      if (this.stateT < 3.5 && Math.random() < 0.35) {
        const a = rand(0, TAU), d = rand(80, 220);
        this.particles.emit(this.cx + Math.cos(a) * d, this.cy + Math.sin(a) * d, 1, '#fff', 15, 1.2);
      }
    }
  }

  // ---- Render ----
  render() {
    const c = this.ctx, w = this.w, h = this.h;
    c.fillStyle = C.bgCol; c.fillRect(0, 0, w, h);
    // nebulae
    for (const n of this.neb) {
      const gr = c.createRadialGradient(n.x * w, n.y * h, 0, n.x * w, n.y * h, n.r * Math.min(w, h));
      gr.addColorStop(0, `hsla(${n.h},50%,25%,${n.a})`); gr.addColorStop(1, 'transparent');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
    }
    // vignette
    if (PERF >= 1) {
      const vg = c.createRadialGradient(this.cx, this.cy, Math.min(w, h) * 0.15, this.cx, this.cy, Math.max(w, h) * 0.7);
      vg.addColorStop(0, 'transparent'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
      c.fillStyle = vg; c.fillRect(0, 0, w, h);
    }
    // stars
    for (const s of this.stars) {
      c.globalAlpha = s.a; c.fillStyle = 'rgba(170,190,255,1)';
      c.beginPath(); c.arc(s.x * w, s.y * h, s.r, 0, TAU); c.fill();
    }
    c.globalAlpha = 1;

    c.save(); c.translate(this.shake.x, this.shake.y);
    if (this.state === 'menu') this._drawMenu(c);
    else if (this.state === 'secret') this._drawSecret(c);
    else this._drawGame(c);
    c.restore();

    if (this.flashA > 0.004) {
      c.globalAlpha = this.flashA; c.fillStyle = this.flashCol;
      c.fillRect(0, 0, w, h); c.globalAlpha = 1;
    }
  }

  _drawSing(c) {
    const p = 0.6 + Math.sin(this.singPulse * 3.5) * 0.4, r = 14 * p;
    if (PERF >= 1) {
      const gr = c.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, r * 4);
      gr.addColorStop(0, 'rgba(200,0,255,0.3)'); gr.addColorStop(0.4, 'rgba(200,0,255,0.06)'); gr.addColorStop(1, 'transparent');
      c.fillStyle = gr; c.beginPath(); c.arc(this.cx, this.cy, r * 4, 0, TAU); c.fill();
    }
    c.beginPath(); c.arc(this.cx, this.cy, r, 0, TAU);
    c.fillStyle = C.singCol;
    if (C.blur > 0) { c.shadowColor = C.singCol; c.shadowBlur = 22 * p; }
    c.fill();
    c.beginPath(); c.arc(this.cx, this.cy, r * 0.3, 0, TAU);
    c.fillStyle = '#fff'; c.fill(); c.shadowBlur = 0;
  }

  _drawMenu(c) {
    const maxR = Math.min(this.w, this.h) * 0.26;
    for (let i = 0; i < 5; i++) {
      const r = maxR * (0.3 + i * 0.14);
      const rot = this.menuT * (0.2 + i * 0.1) * (i % 2 ? 1 : -1);
      const gap = 25 * DEG;
      c.beginPath(); c.arc(this.cx, this.cy, r, rot + gap / 2, rot - gap / 2 + TAU);
      const hue = C.hueBase + i * 26;
      c.strokeStyle = `hsla(${hue},65%,42%,0.22)`; c.lineWidth = 2;
      if (C.blur > 0) { c.shadowColor = `hsla(${hue},65%,42%,0.15)`; c.shadowBlur = 6; }
      c.stroke();
    }
    c.shadowBlur = 0;
    this._drawSing(c);

    const s = MOBILE ? 0.62 : 1;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const ts = 1 + Math.sin(this.menuT * 1.4) * 0.015;
    c.save(); c.translate(this.cx, this.cy - 92 * s); c.scale(ts, ts);
    c.font = `900 ${44 * s}px Orbitron,monospace`; c.fillStyle = '#fff';
    if (C.blur > 0) { c.shadowColor = C.playerCol; c.shadowBlur = 22; }
    c.fillText('SINGULARITY', 0, 0); c.restore(); c.shadowBlur = 0;

    c.font = `300 ${14 * s}px Rajdhani,sans-serif`; c.fillStyle = '#5a6ea0';
    c.fillText('Thread the impossible needle. Death resets everything.', this.cx, this.cy - 46 * s);

    if (Math.sin(this.menuT * 3) > -0.3) {
      c.font = `600 ${19 * s}px Rajdhani,sans-serif`; c.fillStyle = C.playerCol;
      if (C.blur > 0) { c.shadowColor = C.playerCol; c.shadowBlur = 7; }
      c.fillText(MOBILE ? '[ TAP TO START ]' : '[ CLICK OR PRESS SPACE ]', this.cx, this.cy + 52 * s);
      c.shadowBlur = 0;
    }

    c.font = `400 ${11 * s}px Rajdhani,sans-serif`; c.fillStyle = 'rgba(80,110,160,0.5)';
    c.fillText(`MODE: ${MOBILE ? 'MOBILE' : 'PC'} · ${MOBILE ? 'TAP' : 'CLICK/SPACE'} TO JUMP`, this.cx, this.cy + 95 * s);

    if (this.best > 0) {
      c.font = `700 ${13 * s}px Rajdhani,sans-serif`;
      c.fillStyle = this.best >= 10 ? '#ffcc00' : C.singCol;
      c.fillText(`BEST: LEVEL ${this.best}${this.best >= 10 ? ' ★' : ''}`, this.cx, this.cy + 120 * s);
    }

    c.font = `300 ${10 * s}px Rajdhani,sans-serif`; c.fillStyle = 'rgba(255,70,70,0.3)';
    c.fillText('⚠ Death resets to Level 1. Rings disappear. Good luck.', this.cx, this.h - 55);
    c.fillStyle = 'rgba(0,255,234,0.2)';
    c.fillText('Type codes in the bar below for... advantages', this.cx, this.h - 40);
  }

  _drawGame(c) {
    this._drawSing(c);
    const ni = this.player.ringIdx + 1;
    for (let i = 0; i < this.rings.length; i++) this.rings[i].draw(c, this.cx, this.cy, i === ni);
    if ((this.state === 'playing' || (this.state === 'dying' && this.stateT < 0.1)) && this.player.alive)
      this.player.draw(c, this.cx, this.cy);
    this.particles.draw(c);
    this._drawHUD(c);
  }

  _drawHUD(c) {
    const s = MOBILE ? 0.72 : 1, pad = MOBILE ? 12 : 20;
    c.textBaseline = 'top';
    // Level
    c.textAlign = 'left';
    c.font = `700 ${16 * s}px Orbitron,monospace`; c.fillStyle = '#fff';
    c.fillText(`LV ${this.level}`, pad, pad);
    // Ring progress
    const cleared = this.rings.filter(r => r.cleared).length, total = this.rings.length;
    c.font = `600 ${12 * s}px Rajdhani,sans-serif`; c.fillStyle = '#4a6080';
    c.fillText(`RING ${Math.min(cleared + 1, total)}/${total}`, pad, pad + 22 * s);
    // Progress bar
    const bw = 70 * s, bx = pad, by = pad + 40 * s;
    c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(bx, by, bw, 2.5);
    const gr = c.createLinearGradient(bx, 0, bx + bw, 0);
    gr.addColorStop(0, C.playerCol); gr.addColorStop(1, C.singCol);
    c.fillStyle = gr; c.fillRect(bx, by, bw * (cleared / total), 2.5);
    // Ghost warning
    const ghostCount = this.rings.filter(r => r.ghost && !r.cleared).length;
    if (ghostCount > 0) {
      c.font = `300 ${10 * s}px Rajdhani,sans-serif`;
      c.fillStyle = `rgba(255,${100 + Math.sin(this.menuT * 4) * 80},80,0.5)`;
      c.fillText(`👻 ${ghostCount} GHOST RING${ghostCount > 1 ? 'S' : ''}`, pad, pad + 52 * s);
    }
    // Deaths
    c.textAlign = 'right';
    c.font = `600 ${12 * s}px Rajdhani,sans-serif`;
    c.fillStyle = this.deaths > 20 ? C.deathCol : '#4a6080';
    c.fillText(`DEATHS: ${this.deaths}`, this.w - pad, pad);
    if (this.best > 0) {
      c.fillStyle = 'rgba(200,0,255,0.4)';
      c.fillText(`BEST: LV ${this.best}`, this.w - pad, pad + 16 * s);
    }
    // Cheat indicator
    if (this.cheatActive) {
      c.fillStyle = '#ffcc00';
      c.fillText('0.5x SPEED', this.w - pad, pad + 32 * s);
    }
    // Difficulty
    const gapDeg = Math.max(C.initGap - (this.level - 1) * C.gapShrink, C.minGap);
    const diff = Math.round((1 - gapDeg / C.initGap) * 100);
    c.textAlign = 'center';
    c.font = `300 ${9 * s}px Rajdhani,sans-serif`;
    const dp = 55 + diff;
    c.fillStyle = `rgba(255,${Math.max(0, 180 - diff * 2.5)},${Math.max(0, 130 - diff * 2)},0.4)`;
    c.fillText(`DIFFICULTY: ${dp}%`, this.cx, this.h - 55);
    // Level warnings
    if (this.level >= 5) {
      c.fillStyle = 'rgba(255,50,50,0.25)';
      c.fillText(this.level >= 8 ? '☠ LEGENDARY' : this.level >= 6 ? '🔥 EXTREME' : '⚠ HARD', this.cx, this.h - 68);
    }
    // State overlays
    if (this.state === 'dying' && this.stateT > 0.12) {
      c.textAlign = 'center'; c.textBaseline = 'middle';
      const fi = clamp((this.stateT - 0.12) * 5, 0, 1);
      c.globalAlpha = fi;
      c.font = `900 ${32 * s}px Orbitron,monospace`; c.fillStyle = C.deathCol;
      if (C.blur > 0) { c.shadowColor = C.deathCol; c.shadowBlur = 16; }
      const msgs = ['OBLITERATED', 'DESTROYED', 'SHATTERED', 'VAPORIZED', 'CRUSHED', 'WRECKED', 'ERASED'];
      c.fillText(msgs[this.totalDeaths % msgs.length], this.cx, this.cy - 15);
      c.shadowBlur = 0;
      c.font = `600 ${16 * s}px Rajdhani,sans-serif`; c.fillStyle = '#ff6666';
      c.fillText('RESET TO LEVEL 1', this.cx, this.cy + 22);
      c.font = `400 ${13 * s}px Rajdhani,sans-serif`; c.fillStyle = '#4a6080';
      c.fillText(`Death #${this.deaths}`, this.cx, this.cy + 46);
      c.globalAlpha = 1;
    }
    if (this.state === 'levelUp') {
      c.textAlign = 'center'; c.textBaseline = 'middle';
      const fi = clamp(this.stateT * 3, 0, 1);
      const sc = 1 + (1 - easeOut(clamp(this.stateT * 2.5, 0, 1))) * 0.25;
      c.globalAlpha = fi;
      c.save(); c.translate(this.cx, this.cy - 18 * s); c.scale(sc, sc);
      c.font = `900 ${36 * s}px Orbitron,monospace`; c.fillStyle = C.successCol;
      if (C.blur > 0) { c.shadowColor = C.successCol; c.shadowBlur = 20; }
      c.fillText(`LEVEL ${this.level}`, 0, 0); c.restore(); c.shadowBlur = 0;
      c.font = `600 ${18 * s}px Rajdhani,sans-serif`; c.fillStyle = C.playerCol;
      c.fillText('SINGULARITY REACHED', this.cx, this.cy + 24 * s);
      c.font = `400 ${12 * s}px Rajdhani,sans-serif`; c.fillStyle = '#4a6080';
      c.fillText(`Level ${this.level + 1} incoming...`, this.cx, this.cy + 50 * s);
      c.globalAlpha = 1;
    }
    // First-time hint
    if (this.state === 'playing' && this.stateT < 3 && this.deaths === 0 && this.level === 1) {
      c.globalAlpha = clamp(1 - this.stateT / 3, 0, 1);
      c.textAlign = 'center'; c.textBaseline = 'bottom';
      c.font = `400 ${12 * s}px Rajdhani,sans-serif`; c.fillStyle = '#4a6080';
      c.fillText(MOBILE ? 'TAP when aligned with the gap' : 'CLICK / SPACE when aligned with the gap', this.cx, this.h - 80);
      c.globalAlpha = 1;
    }
  }

  _drawSecret(c) {
    this._drawSing(c); this.particles.draw(c);
    const s = MOBILE ? 0.58 : 1, t = this.stateT;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    if (t > 0.5) {
      c.globalAlpha = clamp((t - 0.5) * 2, 0, 1);
      c.font = `700 ${13 * s}px Rajdhani,sans-serif`; c.fillStyle = '#ffcc00';
      if (C.blur > 0) { c.shadowColor = '#ffcc00'; c.shadowBlur = 8; }
      c.fillText('★ YOU ACHIEVED THE IMPOSSIBLE ★', this.cx, this.cy - 105 * s);
      c.shadowBlur = 0; c.globalAlpha = 1;
    }
    if (t > 1) {
      c.globalAlpha = clamp((t - 1) * 2, 0, 1);
      c.font = `900 ${30 * s}px Orbitron,monospace`; c.fillStyle = '#fff';
      if (C.blur > 0) { c.shadowColor = C.singCol; c.shadowBlur = 28; }
      c.fillText('LEVEL 10 COMPLETE', this.cx, this.cy - 65 * s);
      c.shadowBlur = 0; c.globalAlpha = 1;
    }
    if (t > 2) {
      const code = C.SECRET;
      const chars = Math.min(code.length, Math.floor((t - 2) * 7));
      c.font = `700 ${26 * s}px Orbitron,monospace`;
      const m = c.measureText(code), bw = m.width + 36 * s, bh = 46 * s;
      const bx = this.cx - bw / 2, by = this.cy - 12 * s - bh / 2;
      c.fillStyle = 'rgba(0,0,0,0.6)'; c.strokeStyle = 'rgba(200,0,255,0.35)'; c.lineWidth = 2;
      const br = 8;
      c.beginPath(); c.moveTo(bx + br, by); c.lineTo(bx + bw - br, by);
      c.arcTo(bx + bw, by, bx + bw, by + br, br); c.lineTo(bx + bw, by + bh - br);
      c.arcTo(bx + bw, by + bh, bx + bw - br, by + bh, br); c.lineTo(bx + br, by + bh);
      c.arcTo(bx, by + bh, bx, by + bh - br, br); c.lineTo(bx, by + br);
      c.arcTo(bx, by, bx + br, by, br); c.closePath(); c.fill(); c.stroke();
      const disp = code.substring(0, chars);
      c.fillStyle = '#ffcc00';
      if (C.blur > 0) { c.shadowColor = '#ffcc00'; c.shadowBlur = 12; }
      c.fillText(disp, this.cx, this.cy - 12 * s);
      if (chars < code.length && Math.sin(t * 10) > 0) {
        const pw = c.measureText(disp).width;
        c.fillRect(this.cx + pw / 2 + 3, this.cy - 26 * s, 2 * s, 24 * s);
      }
      c.shadowBlur = 0;
    }
    if (t > 5) {
      c.globalAlpha = clamp((t - 5) * 2, 0, 1);
      c.font = `400 ${12 * s}px Rajdhani,sans-serif`; c.fillStyle = '#4a6080';
      c.fillText('Save this code. ' + (MOBILE ? 'Tap' : 'Click') + ' to return.', this.cx, this.cy + 40 * s);
      c.font = `300 ${10 * s}px Rajdhani,sans-serif`; c.fillStyle = 'rgba(80,110,160,0.45)';
      c.fillText(`Deaths: ${this.deaths} · You are in the 0.03%`, this.cx, this.cy + 65 * s);
      c.globalAlpha = 1;
    }
  }

  _loop(ts) {
    const dt = Math.min((ts - this.lastT) / 1000, 0.05);
    this.lastT = ts;
    this.update(dt);
    this.render();
    requestAnimationFrame(t => this._loop(t));
  }
}

new Game();
