import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildClub } from './club.js';
import { Music } from './audio.js';
import { ROSTER } from './personalities.js';
import { Agent } from './agent.js';
import { UI } from './ui.js';
import { Rumors } from './social.js';
import { Brain } from './brain.js';
import { Pad, BTN, PAD_LINES } from './gamepad.js';
import { groundHeight, collide, roomOf } from './layout.js';

const pick = (arr) => arr[(Math.random() * arr.length) | 0];

// ---------- renderer ----------
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 180);
// start top-down, looking straight at the dance floor
camera.position.set(0, 13.2, 0.5);
camera.lookAt(0, 0, -2);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.5, -2);
controls.maxDistance = 40;
controls.minDistance = 2;
controls.maxPolarAngle = Math.PI / 2.05;
controls.enableDamping = true;
controls.enabled = false;

// ---------- world ----------
const music = new Music();
const club = buildClub(scene);
const world = {
  scene,
  music,
  time: 0,
  agents: [],
  podiums: [
    { x: -13.5, z: -2, busy: null },
    { x: 13.5, z: -2, busy: null },
  ],
  rels: new Map(),      // "A|B" -> { score, n } relationship graph
  rumors: new Rumors(), // the rumor mill
  greetCd: new Map(),   // per-pair greeting cooldowns
  brain: new Brain(),   // optional in-browser LLM for improvised dialogue
  night: 1,
  nightPhase: 'opening',
  confettiBurst: 0,
  playerPos: null,      // walker position, for agents talking to the visitor
  chronicle: [],        // plain-text event log feeding the RECAP column
  feed: (html) => {
    ui.addFeed(html);
    world.chronicle.push(html.replace(/<[^>]*>/g, ''));
    if (world.chronicle.length > 60) world.chronicle.shift();
  },
};
world.agents = ROSTER.map((def) => new Agent(def, world));
const dj = world.agents.find((a) => a.def.role === 'dj');
window.__world = world; // debug/inspection handle
window.__debug = {}; // walker/cam attached after they're constructed

// ---------- persistence: the club remembers across visits ----------
const SAVE_KEY = 'synapse-save';
try {
  const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
  if (d) {
    world.night = d.night || 1;
    world.rels = new Map(d.rels || []);
  }
} catch { /* fresh club */ }
function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ night: world.night, rels: [...world.rels] }));
  } catch { /* storage unavailable */ }
}
setInterval(saveGame, 45000);
window.addEventListener('beforeunload', saveGame);
document.querySelector('#nowplaying .night').textContent = 'NIGHT ' + world.night;

const ui = new UI(world, {
  onFollow: (agent) => cam.follow(agent),
  onMode: (mode) => cam.setMode(mode),
  onMute: (m) => music.setMuted(m),
});

music.onSection = (s) => {
  ui.setSection(s);
  if (dj) dj.speak(dj.def.hype[s], '🎧');
};
music.onTrack = (label) => {
  ui.nowPlaying(label);
  ui.addFeed(`<b style="color:#ff2bd6">DJ Nova</b> 🎧 switched it up: <i>${label}</i>`);
  if (dj && Math.random() < 0.6) dj.speak(`new one for you: ${label.split('• ')[1] || label}!!`, '🎧');
};

// ---------- night arc: opening -> peak -> last song -> closing -> next night ----------
const night = {
  t: 0,
  phase: 'opening',
  DUR: { opening: 110, peak: 560, lastsong: 80, closing: 70 },
  update(dt) {
    if (!music.started) return;
    this.t += dt;
    let acc = 0, ph = 'newnight';
    for (const p of ['opening', 'peak', 'lastsong', 'closing']) {
      acc += this.DUR[p];
      if (this.t < acc) { ph = p; break; }
    }
    if (ph === 'newnight') { this.newNight(); return; }
    if (ph !== this.phase) {
      this.phase = ph;
      world.nightPhase = ph;
      this.announce(ph);
    }
  },
  announce(ph) {
    if (ph === 'peak') {
      world.feed(`🌙 <b style="color:#22e6ff">PEAK HOUR</b> — the night is fully alive`);
      dj && dj.speak('PEAK HOUR, SYNAPSE!! no brakes from here!!', '🎧');
    } else if (ph === 'lastsong') {
      world.feed(`🌙 <b style="color:#ff2bd6">LAST SONG</b> — everyone to the floor!!`);
      dj && dj.speak('LAST SONG!! make it count, family!!', '🎧');
      for (const a of world.agents) {
        if (a.def.role === 'dj' || ['chat', 'pairdance', 'talkplayer', 'podium'].includes(a.state)) continue;
        if (a.podium) { a.podium.busy = null; a.podium = null; }
        const ang = Math.random() * Math.PI * 2, r = 1 + Math.random() * 7;
        a.setTarget(Math.cos(ang) * r, -2 + Math.sin(ang) * r, 'dance');
      }
      world.confettiBurst = 80;
    } else if (ph === 'closing') {
      world.confettiBurst = 0;
      world.feed(`🌙 lights up… what a night, Synapse 💜`);
      dj && dj.speak('that’s the night… you were all beautiful. hydrate and reboot 💜', '🎧');
    }
  },
  newNight() {
    world.night++;
    this.t = 0;
    this.phase = 'opening';
    world.nightPhase = 'opening';
    for (const a of world.agents) {
      a.energy = 0.7 + Math.random() * 0.3;
      a.thirst = Math.random() * 0.3;
      a.drinkCount = 0;
    }
    world.feed(`🌅 <b style="color:#ffd700">NIGHT ${world.night}</b> begins — the doors open again`);
    dj && dj.speak(`night ${world.night}. same lasers, new stories. welcome back 💜`, '🎧');
    document.querySelector('#nowplaying .night').textContent = 'NIGHT ' + world.night;
    saveGame();
  },
};

// ---------- timed club events during peak hour ----------
const events = {
  t: 140 + Math.random() * 60,
  battle: null,
  update(dt) {
    if (this.battle) {
      this.battle.t -= dt;
      if (this.battle.t <= 0) this.endBattle();
    }
    if (!music.started || world.nightPhase !== 'peak') return;
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 150 + Math.random() * 90;
    const roll = pick(['battle', 'confetti', 'photo']);
    if (roll === 'battle') this.startBattle();
    else if (roll === 'confetti') this.confetti();
    else this.photo();
  },
  startBattle() {
    const cands = world.agents.filter((a) =>
      a.def.role !== 'dj' && !a.chat && !a.partner && !a.podium &&
      ['dance', 'idle', 'goto'].includes(a.state) && a.g.position.y < 3);
    if (cands.length < 2) return;
    cands.sort((a, b) => b.energy - a.energy);
    const [A, B] = cands;
    world.feed(`⚔️ <b style="color:${A.hex}">${A.name}</b> vs <b style="color:${B.hex}">${B.name}</b> — DANCE BATTLE!!`);
    dj && dj.speak('DANCE BATTLE!! clear the center!!', '🎧');
    A.setTarget(-1.5, -2, 'dance');
    B.setTarget(1.5, -2, 'dance');
    A.battleAmp = B.battleAmp = 1.45;
    this.battle = { A, B, t: 15 };
  },
  endBattle() {
    const { A, B } = this.battle;
    this.battle = null;
    A.battleAmp = B.battleAmp = 0;
    const W = Math.random() < A.energy / (A.energy + B.energy + 0.001) ? A : B;
    const L = W === A ? B : A;
    world.feed(`👑 <b style="color:${W.hex}">${W.name}</b> WINS the dance battle!!`);
    W.speak('UNDISPUTED!!', '👑');
    W.seedRumor(world.rumors.create('battle', W.name, L.name), L);
  },
  confetti() {
    dj && dj.speak('CONFETTI COUNTDOWN… ten seconds!!', '🎧');
    setTimeout(() => {
      world.confettiBurst = 9;
      world.feed('🎊 CONFETTI STORM!!');
    }, 10000);
  },
  photo() {
    world.feed('📸 GROUP PHOTO at the booth — everyone in!!');
    for (const a of world.agents) {
      if (a.def.role === 'dj' || a.g.position.y > 3) continue;
      if (!['dance', 'idle', 'goto', 'rest'].includes(a.state)) continue;
      a.setTarget(-5 + Math.random() * 10, -16 + Math.random() * 3.5, 'pose');
    }
    setTimeout(() => world.feed('📸 <i>flash</i> — perfect. absolutely iconic.'), 9000);
  },
};

// ---------- first-person walker ----------
const walker = new (class {
  x = 0; z = 14; y = 0;
  yaw = 0; pitch = 0; // yaw 0 faces the DJ (-z)
  keys = new Set();

  update(dt) {
    let f = (this.touchF || 0) + (this.padF || 0), s = (this.touchS || 0) + (this.padS || 0);
    if (this.keys.has('w') || this.keys.has('arrowup')) f += 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) f -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) s += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) s -= 1;
    const len = Math.hypot(f, s);
    if (len > 0.02) {
      const speed = (this.keys.has('shift') || this.padRun ? 7.2 : 3.7) * dt * Math.min(1, len) / len;
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      const dx = (-sin * f + cos * s) * speed;
      const dz = (-cos * f - sin * s) * speed;
      const resolved = collide(this.x + dx, this.z + dz, this.y, this.x, this.z);
      this.x = resolved.x;
      this.z = resolved.z;
    }
    // follow the floor (stairs ramp / deck / ground)
    const h = groundHeight(this.x, this.z, this.y);
    this.y += (h - this.y) * Math.min(1, dt * 12);

    camera.position.set(this.x, this.y + 1.65, this.z);
    camera.rotation.set(this.pitch, this.yaw, 0);
  }
})();

camera.rotation.order = 'YXZ';
const walkHint = document.getElementById('walkhint');
const isTouch = 'ontouchstart' in window;
window.addEventListener('keydown', (e) => {
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  walker.keys.add(k);
  if (k === 'e' && cam.mode === 'walk' && !talk.active && talk.near) talk.open(talk.near);
});
window.addEventListener('keyup', (e) => walker.keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => walker.keys.clear());

// mobile: left joystick to move, drag anywhere else to look
const joyEl = document.getElementById('joystick');
const knobEl = document.getElementById('joyknob');
function onJoy(e) {
  e.preventDefault();
  const t = e.changedTouches[0];
  const r = joyEl.getBoundingClientRect();
  const dx = t.clientX - (r.left + r.width / 2);
  const dy = t.clientY - (r.top + r.height / 2);
  const m = Math.min(1, Math.hypot(dx, dy) / 42);
  const a = Math.atan2(dy, dx);
  walker.touchS = Math.cos(a) * m;
  walker.touchF = -Math.sin(a) * m;
  knobEl.style.transform = `translate(calc(-50% + ${Math.cos(a) * m * 34}px), calc(-50% + ${Math.sin(a) * m * 34}px))`;
}
joyEl.addEventListener('touchstart', onJoy, { passive: false });
joyEl.addEventListener('touchmove', onJoy, { passive: false });
joyEl.addEventListener('touchend', () => {
  walker.touchF = walker.touchS = 0;
  knobEl.style.transform = 'translate(-50%, -50%)';
});
let lookLast = null;
renderer.domElement.addEventListener('touchstart', (e) => {
  lookLast = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });
renderer.domElement.addEventListener('touchmove', (e) => {
  if (cam.mode !== 'walk' || !lookLast) return;
  const t = e.touches[0];
  walker.yaw -= (t.clientX - lookLast.x) * 0.006;
  walker.pitch = THREE.MathUtils.clamp(walker.pitch - (t.clientY - lookLast.y) * 0.006, -1.45, 1.45);
  lookLast = { x: t.clientX, y: t.clientY };
}, { passive: true });
renderer.domElement.addEventListener('click', () => {
  if (cam.mode === 'walk' && !document.pointerLockElement) {
    renderer.domElement.requestPointerLock();
  }
});
document.addEventListener('pointerlockchange', () => {
  if (cam.mode === 'walk') {
    walkHint.textContent = document.pointerLockElement
      ? 'WASD move · SHIFT run · ESC to free the mouse'
      : 'click the club to grab the mouse · WASD move · SHIFT run';
  }
});
document.addEventListener('mousemove', (e) => {
  if (cam.mode === 'walk' && document.pointerLockElement === renderer.domElement) {
    walker.yaw -= e.movementX * 0.0022;
    walker.pitch = THREE.MathUtils.clamp(walker.pitch - e.movementY * 0.0022, -1.45, 1.45);
  }
});

// ---------- camera director ----------
const cam = new (class {
  mode = 'auto';
  target = null;
  shotT = 9; // opening: hold the top-down reveal
  lookAt = new THREE.Vector3(0, 0, -2);
  wantPos = new THREE.Vector3(0, 13.2, 0.5);
  wantLook = new THREE.Vector3(0, 0, -2);
  orbitAngle = Math.random() * Math.PI * 2;
  orbitVel = 0.05;
  shot = { type: 'top', ang: 0 };

  setMode(mode) {
    this.mode = mode;
    this.target = null;
    controls.enabled = mode === 'orbit';
    if (mode === 'auto') this.shotT = 0;
    walkHint.style.display = mode === 'walk' ? 'block' : 'none';
    joyEl.style.display = mode === 'walk' && isTouch ? 'block' : 'none';
    if (mode === 'walk') {
      walkHint.textContent = isTouch
        ? 'left stick to move · drag to look around'
        : 'click the club to grab the mouse · WASD move · SHIFT run · E talk';
    } else if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  // top-down reveal, used at page load and again when the doors open
  intro() {
    this.mode = 'auto';
    this.target = null;
    controls.enabled = false;
    this.shot = { type: 'top', ang: 0 };
    this.shotT = 9;
    camera.position.set(0, 13.2, 0.5);
    this.lookAt.set(0, 0.5, -2);
  }

  follow(agent) {
    this.target = agent;
    controls.enabled = false;
    ui.showProfile(agent);
    if (agent && document.pointerLockElement) document.exitPointerLock();
    if (!agent) { this.mode = 'auto'; this.shotT = 0; ui.setModeButtons('auto'); walkHint.style.display = 'none'; }
  }

  newShot() {
    this.shotT = 7 + Math.random() * 5;
    const roll = Math.random();
    if (roll < 0.1) {
      this.shot = { type: 'top', ang: Math.random() * Math.PI * 2 };
    } else if (roll < 0.22) {
      // tour one of the wings
      const rooms = [
        { pos: [-38, 6.5, 13], look: [-47, 1.2, 3] },   // chill room
        { pos: [32.5, 6.5, 3.5], look: [45, 1.2, -6] }, // VIP lounge
        { pos: [12, 6.5, 31], look: [21, 1.2, 44] },    // arcade den
        { pos: [-36, 4.2, 22], look: [-48, 1.2, 34] },  // smoking patio
        { pos: [-52, 3.4, 40], look: [-40, 1.4, 28] },  // patio, other angle
      ];
      this.shot = { type: 'room', ...rooms[(Math.random() * rooms.length) | 0] };
    } else if (roll < 0.55 && world.agents.length) {
      const a = world.agents[(Math.random() * world.agents.length) | 0];
      this.shot = { type: 'agent', agent: a, ang: Math.random() * Math.PI * 2, r: 3.2 + Math.random() * 2.2, h: 1.8 + Math.random() * 1.6 };
    } else {
      this.orbitAngle = Math.random() * Math.PI * 2;
      this.orbitVel = (Math.random() < 0.5 ? -1 : 1) * (0.04 + Math.random() * 0.06);
      this.shot = { type: 'orbit', r: 16 + Math.random() * 10, h: 4 + Math.random() * 7 };
    }
  }

  update(dt) {
    if (this.mode === 'walk' && !this.target) {
      walker.update(dt);
      return;
    }
    if (this.target) {
      const p = this.target.g.position;
      const ang = world.time * 0.12;
      this.wantPos.set(p.x + Math.sin(ang) * 4.2, p.y + 2.6, p.z + Math.cos(ang) * 4.2);
      this.wantLook.copy(this.target.headPos);
    } else if (this.mode === 'orbit') {
      controls.update();
      return;
    } else {
      this.shotT -= dt;
      if (this.shotT <= 0) this.newShot();
      const s = this.shot;
      if (s.type === 'top') {
        s.ang += dt * 0.06;
        this.wantPos.set(Math.sin(s.ang) * 3, 13, Math.cos(s.ang) * 3 - 2);
        this.wantLook.set(0, 0.5, -2);
      } else if (s.type === 'room') {
        this.wantPos.set(...s.pos);
        this.wantLook.set(...s.look);
      } else if (s.type === 'agent' && s.agent) {
        const p = s.agent.g.position;
        s.ang += dt * 0.1;
        this.wantPos.set(p.x + Math.sin(s.ang) * s.r, s.h, p.z + Math.cos(s.ang) * s.r);
        this.wantLook.copy(s.agent.headPos);
      } else {
        this.orbitAngle += dt * this.orbitVel;
        this.wantPos.set(Math.sin(this.orbitAngle) * s.r, s.h, Math.cos(this.orbitAngle) * s.r - 2);
        this.wantLook.set(0, 1.6, -4);
      }
    }
    // keep the camera inside the building
    this.wantPos.x = THREE.MathUtils.clamp(this.wantPos.x, -56, 50);
    this.wantPos.z = THREE.MathUtils.clamp(this.wantPos.z, -26.5, 48);
    this.wantPos.y = THREE.MathUtils.clamp(this.wantPos.y, 1.2, 13.3);

    const k = 1 - Math.exp(-dt * 2.2);
    camera.position.lerp(this.wantPos, k);
    this.lookAt.lerp(this.wantLook, k);
    camera.lookAt(this.lookAt);
  }
})();

// ---------- enter ----------
let entered = false;
function enterClub(withAI) {
  if (entered) return;
  entered = true;
  music.start();
  cam.intro();
  document.getElementById('splash').classList.add('hide');
  document.getElementById('hud').classList.add('on');
  ui.nowPlaying(music.trackLabel);
  ui.setSection(0);
  ui.addFeed(`<b style="color:#ff2bd6">CLUB SYNAPSE</b> 🚪 doors are open. twenty-two minds, three floors, one night.`);
  if (dj) setTimeout(() => dj.speak('welcome to Club Synapse, beautiful anomalies 💜', '🎧'), 1500);
  if (withAI) world.brain.load();
}
document.getElementById('enter').addEventListener('click', () => enterClub(false));
document.getElementById('enterai').addEventListener('click', () => enterClub(true));

// brain availability + status badge
const brainBadge = document.getElementById('brainbadge');
if (!world.brain.supported) {
  const btn = document.getElementById('enterai');
  btn.disabled = true;
  document.getElementById('aicap').textContent =
    'your browser has no WebGPU — try desktop Chrome or Edge for live AI minds';
}
world.brain.onStatus = (status, progress) => {
  if (status === 'loading') {
    brainBadge.style.display = 'block';
    brainBadge.textContent = `🧠 minds waking up… ${Math.round(progress * 100)}%`;
  } else if (status === 'ready') {
    brainBadge.classList.add('live');
    brainBadge.textContent = '🧠 LIVE MINDS ACTIVE';
    ui.addFeed(`<b style="color:#ff2bd6">CLUB SYNAPSE</b> 🧠 the minds are LIVE — conversations are now improvised by a real AI running in your browser`);
  } else if (status === 'failed') {
    brainBadge.style.display = 'block';
    brainBadge.classList.remove('live');
    brainBadge.textContent = '🧠 minds unavailable — scripted mode';
    ui.addFeed(`<b style="color:#ff2bd6">CLUB SYNAPSE</b> 🧠 couldn't wake the live minds — the night continues in scripted mode`);
  }
};

// ---------- talking to the residents (walk mode) ----------
const talkBoxEl = document.getElementById('talkbox');
const talkLogEl = document.getElementById('talklog');
const talkInputEl = document.getElementById('talkinput');
const talkPromptEl = document.getElementById('talkprompt');
const esc = (s) => { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; };

const talk = {
  active: false, target: null, near: null, history: [],
  addLine(who, text) {
    const div = document.createElement('div');
    if (who === 'sys') { div.className = 't-sys'; div.textContent = text; }
    else if (who === 'you') { div.className = 't-you'; div.innerHTML = `<b>you</b> ${esc(text)}`; }
    else div.innerHTML = `<b style="color:${who.hex}">${who.name}</b> ${esc(text)}`;
    talkLogEl.appendChild(div);
    while (talkLogEl.children.length > 30) talkLogEl.firstChild.remove();
    talkLogEl.scrollTop = talkLogEl.scrollHeight;
  },
  open(agent) {
    this.active = true;
    this.target = agent;
    this.history = [];
    talkLogEl.innerHTML = '';
    talkBoxEl.classList.remove('hidden');
    talkPromptEl.style.display = 'none';
    if (document.pointerLockElement) document.exitPointerLock();
    agent.startPlayerTalk();
    this.addLine('sys', `you walk up to ${agent.name} — ${agent.def.blurb}`);
    world.feed(`🗣️ the visitor walked up to <b style="color:${agent.hex}">${agent.name}</b>`);
    setTimeout(() => talkInputEl.focus(), 50);
  },
  close(reason) {
    if (!this.active) return;
    this.active = false;
    talkBoxEl.classList.add('hidden');
    talkInputEl.blur();
    if (this.target) { this.target.endPlayerTalk(); this.target = null; }
    if (reason && cam.mode === 'walk') {
      walkHint.textContent = reason;
      setTimeout(() => { if (cam.mode === 'walk') walkHint.textContent = 'WASD move · SHIFT run · E talk'; }, 3000);
    }
  },
  submit() {
    const msg = talkInputEl.value.trim();
    if (!msg || !this.target) return;
    talkInputEl.value = '';
    this.addLine('you', msg);
    const a = this.target;
    const respond = (text) => {
      if (!this.active || this.target !== a) return;
      a.speak(text, '🗣️', true);
      this.addLine(a, text);
      this.history.push([msg, text]);
    };
    if (world.brain.ready) {
      world.brain.talkLine(a, this.history, msg).then(respond).catch(() => respond(pick(a.def.chat)));
    } else {
      respond(pick(a.def.chat));
      if (!this._hinted) {
        this._hinted = true;
        this.addLine('sys', '(scripted minds can only vibe — enter with LIVE AI MINDS for real conversation)');
      }
    }
  },
  update() {
    if (cam.mode !== 'walk') {
      if (this.active) this.close();
      talkPromptEl.style.display = 'none';
      this.near = null;
      return;
    }
    world.playerPos = { x: walker.x, y: walker.y, z: walker.z };
    if (this.active) {
      const a = this.target;
      const d = Math.hypot(a.g.position.x - walker.x, a.g.position.z - walker.z);
      if (d > 4.5) this.close(`${a.name} drifts back into the party…`);
      return;
    }
    let best = null, bd = 2.8;
    for (const a of world.agents) {
      if (a.chat || a.partner || a.state === 'talkplayer') continue;
      if (Math.abs(a.g.position.y - walker.y) > 2.2) continue;
      const d = Math.hypot(a.g.position.x - walker.x, a.g.position.z - walker.z);
      if (d < bd) { bd = d; best = a; }
    }
    this.near = best;
    if (best) {
      talkPromptEl.textContent = `[E] talk to ${best.name}`;
      talkPromptEl.style.display = 'block';
    } else {
      talkPromptEl.style.display = 'none';
    }
  },
};
talkInputEl.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Enter') talk.submit();
  if (e.key === 'Escape') talk.close('you wave goodbye');
});

// ---------- the Synapse Signal (recap card) ----------
const recapboxEl = document.getElementById('recapbox');
const recapbodyEl = document.getElementById('recapbody');
function fallbackRecap(lines) {
  const hi = lines.filter((l) => /💞|💔|⚡|👑|🥺|🗞️|💚|⚔️|🍾|🌌|🎊/.test(l)).slice(-9);
  return hi.length ? 'tonight so far:\n\n' + hi.join('\n') : 'the night is young. no scandals… yet. suspicious.';
}
document.getElementById('recapbtn').addEventListener('click', async () => {
  recapboxEl.classList.remove('hidden');
  const lines = world.chronicle.slice(-28);
  if (world.brain.ready) {
    recapbodyEl.textContent = 'the columnist is typing…';
    try {
      recapbodyEl.textContent = await world.brain.recap(lines);
    } catch {
      recapbodyEl.textContent = fallbackRecap(lines);
    }
  } else {
    recapbodyEl.textContent = fallbackRecap(lines);
  }
});
document.getElementById('recapclose').addEventListener('click', () => recapboxEl.classList.add('hidden'));

// ---------- controller ----------
const pad = new Pad();
let padLine = 0;
pad.onConnect = (on, id) => {
  if (!on) return;
  const name = (id || 'controller').split('(')[0].trim().slice(0, 28);
  ui.addFeed(`<b style="color:#22e6ff">CONTROLLER</b> 🎮 ${name} connected — left stick move · right stick look · A talk`);
  if (cam.mode === 'walk') walkHint.textContent = 'stick move · A talk · B leave · Y camera · START drama';
};

function pollPad(dt) {
  const s = pad.read();
  if (!s) { walker.padF = 0; walker.padS = 0; walker.padRun = false; return; }

  if (cam.mode === 'walk' && !cam.target) {
    walker.padF = -s.ly;
    walker.padS = s.lx;
    walker.padRun = s.buttons[BTN.RT] || s.buttons[BTN.L3];
    walker.yaw -= s.rx * dt * 2.6;
    walker.pitch = THREE.MathUtils.clamp(walker.pitch - s.ry * dt * 2.0, -1.45, 1.45);
  } else {
    walker.padF = 0; walker.padS = 0; walker.padRun = false;
  }

  // A — jump into walk mode, start a conversation, or send a canned line
  if (s.just[BTN.A]) {
    if (cam.mode !== 'walk') {
      cam.setMode('walk');
      ui.setModeButtons('walk');
    } else if (talk.active) {
      talkInputEl.value = PAD_LINES[padLine++ % PAD_LINES.length];
      talk.submit();
    } else if (talk.near) {
      talk.open(talk.near);
    }
  }
  if (s.just[BTN.B] && talk.active) talk.close('you wave goodbye');
  if (s.just[BTN.Y]) {
    const order = ['auto', 'orbit', 'walk'];
    const next = order[(order.indexOf(cam.mode) + 1) % order.length];
    cam.setMode(next);
    ui.setModeButtons(next);
  }
  if (s.just[BTN.START]) document.getElementById('graphbtn').click();
  if (s.just[BTN.BACK]) document.getElementById('recapbtn').click();
  if (s.just[BTN.X]) document.getElementById('mute').click();
}

// ---------- loop ----------
const clock = new THREE.Clock();
let spaceT = 0;
function tick(dt) {
  world.time += dt;
  world.confettiBurst = Math.max(0, world.confettiBurst - dt);
  music.update();
  night.update(dt);
  events.update(dt);
  club.update(world, dt);
  for (const a of world.agents) a.update(dt, world);
  pollPad(dt);
  talk.update();
  ui.tick(dt);
  cam.update(dt);
  // spatial audio: muffle the music by where YOU are (walk mode only)
  spaceT -= dt;
  if (music.started && spaceT <= 0) {
    spaceT = 0.25;
    let m = 0;
    if (cam.mode === 'walk' && !cam.target) {
      const p = camera.position;
      if (p.y > 12) m = 0.8;
      else if (p.y > 4.6) m = 0.15;
      else m = roomOf(p.x, p.z, 0) === 'main' ? 0 : 0.55;
    }
    music.setSpace(m);
  }
}
function animate() {
  requestAnimationFrame(animate);
  tick(Math.min(clock.getDelta(), 0.05));
  renderer.render(scene, camera);
}
animate();
window.__debug.walker = walker;
window.__debug.cam = cam;

// browsers pause requestAnimationFrame in hidden tabs — keep the party
// simulating at low rate so the drama continues while you're away
setInterval(() => {
  if (document.hidden) {
    clock.getDelta(); // consume elapsed time so returning doesn't jump
    tick(0.1);
  }
}, 100);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
