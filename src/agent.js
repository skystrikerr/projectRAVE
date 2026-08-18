import * as THREE from 'three';
import { makeBubble, makeNametag, disposeSprite } from './sprites.js';
import { DRINKS, MERCH, VIALS } from './personalities.js';
import { FRIEND, RIVAL, relKey, relScore, bumpRel, GOSSIP_REACTIONS, GOSSIP_SOURCES } from './social.js';
import { route, BALCONY_Y, ROOF_Y } from './layout.js';

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

const ZONES = {
  floor: { x: 0, z: -2, r: 10 },
  bar: { x: 23.2, z: 12 },
};
// spots inside the wings
const CHILL_SPOTS = [[-46.5, 2.5], [-46.5, 8], [-52, 4.5], [-40, 13], [-50, -4], [-38, -6], [-44, 14]];
const VIP_SPOTS = [[46.5, -9], [46.5, -1], [42, -12.5], [44.5, -2.5], [40, -8.5]];
const ARCADE_X = [8.5, 13, 17.5, 22, 26.5, 31]; // cabinet columns at z ≈ 49.3
const VIP_LINES = ['to us. mostly to me. cheers.', 'the couches here understand luxury.', 'sparkling. everything is sparkling.', 'I could get used to this. I AM used to this.'];
const BALCONY_SPOTS = [[-18, 21.2], [-10, 21.2], [-2, 21.2], [6, 21.2], [14, 21.2], [22, 21.2], [-9, 25.6], [9, 25.6]];
const OVERLOOK_LINES = [
  'the floor looks like a motherboard from up here',
  'you can see ALL the drama from up here',
  'the bass hits different at altitude',
  'I can see my favorite tile from here',
  'everyone looks so small. and so sweaty.',
];
const ROOF_SPOTS = [[10, 48.5], [16, 48.5], [24, 48.5], [30, 48.5], [32.5, 36], [32.5, 43], [7.5, 38], [7.5, 45]];
const PATIO_SPOTS = [[-49, 22.5], [-49, 25.8], [-38, 26.5], [-38, 29.8], [-46, 36.2], [-46, 39.5], [-42, 34.5], [-51.5, 31], [-35.5, 36]];
const MERCH_SPOT = { x: 11, z: 24.4 };
const VIAL_SPOT = { x: -34.5, z: -4.4 };
const SMOKE_LINES = [
  'out here the bass is just a rumour',
  'five minutes. that’s all. (it is never five minutes)',
  'the night air fixes things the club breaks',
  'nobody argues on the patio. house rule.',
  'this is where the REAL conversations happen',
  'someone always follows me out here. I like that.',
];
const SHOP_LINES = ['worth every credit', 'I needed this. spiritually.', 'do NOT tell me the price again'];
const ROOF_LINES = [
  'the city just… goes. forever.',
  'you can feel the bass through the floor up here. like a heartbeat.',
  'the stars don’t judge. that’s why I come up here.',
  'somewhere out there is another club. wild to think about.',
  'the night air tastes like static and possibility',
];

// quantizer for the robot dance
const q = (v, s = 3) => Math.round(v * s) / s;

export class Agent {
  constructor(def, world) {
    this.def = def;
    this.name = def.name;
    this.traits = def.traits;
    this.color = new THREE.Color(def.color);
    this.hex = '#' + this.color.getHexString();
    this.world = world;

    // ---- needs & brain ----
    this.energy = rand(0.7, 1);
    this.thirst = rand(0, 0.3);
    this.social = rand(0, 0.5);
    this.state = 'idle';
    this.actionLabel = 'arriving…';
    this.mood = '✨';
    this.thinkT = rand(0.5, 2);
    this.stateT = 0;
    this.socialCooldown = 0;
    this.bubbleChatter = rand(6, 16);
    this.phaseOff = Math.random();
    this.spin = 0;
    this.style = def.style;
    this.chat = null;
    this.partner = null;
    this.podium = null;
    this.facing = rand(0, TAU);

    // ---- social memory ----
    this.knownRumors = new Set();
    this.socialScanT = rand(2, 6);
    this.shadeCd = 0;
    this.jealousyCd = rand(10, 30); // grace period before the drama starts
    this.drinkCount = 0;
    this.grudge = null;       // someone to confront after a jealousy episode
    this.forcedTopic = null;  // set when a chat must be a debate (rival rematch)
    this.sulking = false;

    // ---- shop + booster state ----
    this.accessories = new Set();
    this.boost = {};
    this.boostT = 0;
    this.comedownT = 0;
    this.smokeCd = rand(0, 40);

    this.buildBody();

    // spawn
    if (def.role === 'dj') {
      this.g.position.set(0, 0.9, -25.1);
      this.facing = 0;
      this.state = 'dj';
      this.actionLabel = 'on the decks';
    } else {
      const a = rand(0, TAU), r = rand(2, 11);
      this.g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r - 2);
    }
    world.scene.add(this.g);
  }

  // ------------------------------------------------------------------
  buildBody() {
    const c = this.color;
    const g = (this.g = new THREE.Group());
    const body = (this.body = new THREE.Group());
    g.add(body);

    const skin = new THREE.MeshStandardMaterial({ color: 0x241f38, metalness: 0.3, roughness: 0.7 });
    const suit = new THREE.MeshStandardMaterial({
      color: c.clone().multiplyScalar(0.55),
      emissive: c, emissiveIntensity: 0.22, metalness: 0.35, roughness: 0.55,
    });
    const glow = new THREE.MeshBasicMaterial({ color: c, toneMapped: false });

    // legs (pivot at hip)
    this.legL = new THREE.Group(); this.legL.position.set(0.16, 0.95, 0);
    this.legR = new THREE.Group(); this.legR.position.set(-0.16, 0.95, 0);
    for (const leg of [this.legL, this.legR]) {
      const cap = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.6, 3, 8), skin);
      cap.position.y = -0.45;
      leg.add(cap);
      body.add(leg);
    }

    // torso
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.52, 4, 12), suit);
    torso.position.y = 1.42;
    body.add(torso);
    // glow stripe on the chest
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.1), glow);
    stripe.position.set(0, 1.55, 0.22);
    body.add(stripe);

    // arms (pivot at shoulder)
    this.armL = new THREE.Group(); this.armL.position.set(0.36, 1.74, 0);
    this.armR = new THREE.Group(); this.armR.position.set(-0.36, 1.74, 0);
    for (const arm of [this.armL, this.armR]) {
      const cap = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.44, 3, 8), suit);
      cap.position.y = -0.3;
      arm.add(cap);
      body.add(arm);
    }

    // head + neon visor
    this.head = new THREE.Group();
    this.head.position.y = 2.14;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), skin);
    this.head.add(skull);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.1), glow);
    visor.position.set(0, 0.03, 0.21);
    this.head.add(visor);
    this.addHat(glow, suit);
    body.add(this.head);

    // name tag + bubble anchor
    const tag = makeNametag(this.name, this.hex);
    tag.position.y = 2.72;
    g.add(tag);
    this.bubble = null;
    this.bubbleT = 0;
  }

  addHat(glow, suit) {
    const h = this.def.hat;
    if (h === 'phones') {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.045, 8, 20, Math.PI), glow);
      band.rotation.z = Math.PI; band.rotation.y = Math.PI / 2;
      band.position.y = 0.05;
      this.head.add(band);
      for (const s of [-1, 1]) {
        const cup = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), glow);
        cup.position.set(s * 0.26, 0, 0);
        this.head.add(cup);
      }
    } else if (h === 'mohawk') {
      const hawk = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.34), glow);
      hawk.position.y = 0.3;
      this.head.add(hawk);
    } else if (h === 'cap') {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 6, 0, TAU, 0, Math.PI / 2.6), suit);
      dome.position.y = 0.07;
      this.head.add(dome);
      const brim = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.24), suit);
      brim.position.set(0, 0.14, 0.3);
      this.head.add(brim);
    } else if (h === 'antenna') {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 6), suit);
      rod.position.y = 0.38;
      this.head.add(rod);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), glow);
      tip.position.y = 0.54;
      this.head.add(tip);
    } else if (h === 'halo') {
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 8, 24), glow);
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 0.44;
      this.head.add(halo);
    } else if (h === 'hood') {
      const hood = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8, 0, TAU, 0, Math.PI / 1.7), suit);
      hood.position.y = 0.02;
      this.head.add(hood);
    } else if (h === 'spike') {
      for (let s = 0; s < 3; s++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.2, 6), glow);
        spike.position.set((s - 1) * 0.12, 0.3, 0);
        spike.rotation.z = (s - 1) * -0.5;
        this.head.add(spike);
      }
    } else if (h === 'bun') {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), glow);
      bun.position.set(0, 0.28, -0.1);
      this.head.add(bun);
    } else if (h === 'hair') {
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.29, 10, 8, 0, TAU, 0, Math.PI / 1.9), suit);
      hair.position.set(0, 0.04, -0.04);
      this.head.add(hair);
    } else if (h === 'horns') {
      for (const s of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.24, 6), glow);
        horn.position.set(s * 0.16, 0.3, 0);
        horn.rotation.z = s * -0.4;
        this.head.add(horn);
      }
    } else if (h === 'thirdeye') {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), glow);
      eye.position.set(0, 0.16, 0.22);
      this.head.add(eye);
    } else if (h === 'headband') {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.04, 8, 20), glow);
      band.rotation.x = Math.PI / 2;
      band.position.y = 0.12;
      this.head.add(band);
    } else if (h === 'crown') {
      const ringBase = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.035, 8, 20), glow);
      ringBase.rotation.x = Math.PI / 2;
      ringBase.position.y = 0.32;
      this.head.add(ringBase);
      for (let s = 0; s < 3; s++) {
        const point = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.14, 6), glow);
        point.position.set(Math.cos((s / 3) * TAU) * 0.16, 0.42, Math.sin((s / 3) * TAU) * 0.16);
        this.head.add(point);
      }
    } else if (h === 'bubbles') {
      for (let s = 0; s < 3; s++) {
        const bub = new THREE.Mesh(new THREE.SphereGeometry(0.05 + s * 0.015, 8, 8), glow);
        bub.position.set((s - 1) * 0.13, 0.36 + (s % 2) * 0.12, 0);
        this.head.add(bub);
      }
    } else if (h === 'veil') {
      const veil = new THREE.Mesh(
        new THREE.ConeGeometry(0.34, 0.5, 12, 1, true),
        new THREE.MeshBasicMaterial({ color: this.color, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
      );
      veil.position.y = 0.16;
      this.head.add(veil);
    } else if (h === 'visor') {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.12), glow);
      bar.position.set(0, 0.05, 0.2);
      this.head.add(bar);
    } else if (h === 'pigtails') {
      for (const s of [-1, 1]) {
        const tail = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), glow);
        tail.position.set(s * 0.28, 0.16, -0.05);
        this.head.add(tail);
      }
    } else if (h === 'leaf') {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.34, 5), glow);
      leaf.position.set(0.05, 0.36, 0);
      leaf.rotation.z = -0.5;
      this.head.add(leaf);
    } else if (h === 'flat') {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 12), suit);
      cap.position.y = 0.24;
      this.head.add(cap);
    } else if (h === 'flame') {
      for (let s = 0; s < 3; s++) {
        const fl = new THREE.Mesh(new THREE.ConeGeometry(0.08 - s * 0.015, 0.26 + s * 0.06, 6), glow);
        fl.position.set((s - 1) * 0.1, 0.32 + s * 0.05, 0);
        this.head.add(fl);
      }
    }
  }

  // ---------- merch accessories ----------
  addAccessory(id) {
    if (this.accessories.has(id)) return false;
    this.accessories.add(id);
    const glow = new THREE.MeshBasicMaterial({ color: this.color, toneMapped: false });
    if (id === 'glowsticks') {
      for (const arm of [this.armL, this.armR]) {
        const stick = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.26, 3, 6), glow);
        stick.position.set(0, -0.62, 0.08);
        arm.add(stick);
      }
    } else if (id === 'shades') {
      const sh = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.13, 0.08), new THREE.MeshBasicMaterial({ color: 0x22e6ff, toneMapped: false }));
      sh.position.set(0, 0.05, 0.24);
      this.head.add(sh);
    } else if (id === 'halo') {
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.032, 8, 20), new THREE.MeshBasicMaterial({ color: 0xffd700, toneMapped: false }));
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 0.5;
      this.head.add(halo);
      this.haloMesh = halo;
    } else if (id === 'boa') {
      const boa = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.07, 6, 18), glow);
      boa.rotation.x = Math.PI / 2;
      boa.position.y = 1.78;
      this.body.add(boa);
    }
    return true;
  }

  // effective trait with any active booster folded in
  tr(k) {
    const b = this.boostT > 0 ? (this.boost[k] || 0) : 0;
    return Math.max(0, Math.min(1.4, (this.traits[k] || 0) + b));
  }

  // ------------------------------------------------------------------
  speak(text, feedIcon = '💬', silent = false) {
    disposeSprite(this.bubble);
    this.bubble = makeBubble(text, this.hex);
    this.bubble.position.y = 2.95;
    this.g.add(this.bubble);
    this.bubbleT = 2.6 + text.length * 0.045;
    if (!silent) this.world.feed(`<b style="color:${this.hex}">${this.name}</b> ${feedIcon} “${text}”`);
  }

  log(text) {
    this.world.feed(`<b style="color:${this.hex}">${this.name}</b> ${text}`);
  }

  // ------------------------------------------------------------------
  think() {
    const t = this.traits;
    const likes = t.likes;
    const freePodium = this.world.podiums.find((p) => !p.busy);
    const opts = [
      { k: 'dance', u: 0.5 + this.energy * 0.45 + (this.world.music.isDrop ? 0.5 : 0) + rand(0, 0.2) },
      { k: 'drink', u: this.thirst * 1.35 + (likes === 'bar' ? 0.15 : 0) + rand(0, 0.1) },
      { k: 'rest', u: (1 - this.energy) * 1.3 + (likes === 'chill' ? 0.22 : 0) + rand(0, 0.1) },
      { k: 'social', u: this.world.time > this.socialCooldown ? this.social * (0.5 + this.tr('social')) * 1.3 : 0 },
      { k: 'arcade', u: 0.15 + t.chaos * 0.25 + (likes === 'arcade' ? 0.4 : 0) + rand(0, 0.3) },
      { k: 'podium', u: freePodium && this.energy > 0.7 && !t.edge ? 0.35 + t.social * 0.3 + (likes === 'podium' ? 0.45 : 0) + rand(0, 0.25) : 0 },
      { k: 'vip', u: 0.1 + (likes === 'vip' ? 0.55 : 0) + rand(0, 0.25) },
      { k: 'balcony', u: 0.13 + (likes === 'balcony' ? 0.5 : 0) + rand(0, 0.28) },
      { k: 'roof', u: 0.09 + (['Nyx', 'Luna', 'Vex', 'Sage'].includes(this.name) ? 0.18 : 0) + rand(0, 0.25) },
      { k: 'smoke', u: this.world.time > this.smokeCd ? 0.14 + (likes === 'patio' ? 0.5 : 0) + rand(0, 0.3) : 0 },
      { k: 'shop', u: this.accessories.size < 2 ? 0.12 + (likes === 'shop' ? 0.45 : 0) + rand(0, 0.26) : 0 },
      { k: 'vialrun', u: this.boostT > 0 || this.comedownT > 0 ? 0
        : 0.07 + (likes === 'vial' ? 0.5 : 0) + (this.energy < 0.45 ? 0.22 : 0) + t.chaos * 0.15 + rand(0, 0.2) },
    ];
    opts.sort((a, b) => b.u - a.u);
    const choice = opts[0].k;

    if (choice === 'drink') {
      this.setTarget(ZONES.bar.x, ZONES.bar.z + rand(-6, 6), 'drink');
      this.actionLabel = 'heading to the bar';
    } else if (choice === 'rest') {
      const [sx, sz] = pick(CHILL_SPOTS);
      this.setTarget(sx + rand(-0.4, 0.4), sz + rand(-0.4, 0.4), 'rest');
      this.actionLabel = 'drifting to the chill room';
    } else if (choice === 'vip') {
      const [vx, vz] = pick(VIP_SPOTS);
      this.setTarget(vx + rand(-0.3, 0.3), vz + rand(-0.3, 0.3), 'vip');
      this.actionLabel = 'strutting to the VIP room';
    } else if (choice === 'balcony') {
      const [bx, bz] = pick(BALCONY_SPOTS);
      this.setTarget(bx + rand(-0.3, 0.3), bz, 'overlook', BALCONY_Y);
      this.actionLabel = 'heading up to the Sky Deck';
    } else if (choice === 'roof') {
      const [rx, rz] = pick(ROOF_SPOTS);
      this.setTarget(rx + rand(-0.3, 0.3), rz + rand(-0.3, 0.3), 'overlook', ROOF_Y);
      this.actionLabel = 'climbing to the rooftop';
    } else if (choice === 'smoke') {
      const [px, pz] = pick(PATIO_SPOTS);
      this.setTarget(px + rand(-0.4, 0.4), pz + rand(-0.4, 0.4), 'smoke');
      this.actionLabel = 'stepping out to the patio';
    } else if (choice === 'shop') {
      this.setTarget(MERCH_SPOT.x + rand(-1.8, 1.8), MERCH_SPOT.z + rand(-0.3, 0.3), 'shop');
      this.actionLabel = 'browsing the merch stand';
    } else if (choice === 'vialrun') {
      this.setTarget(VIAL_SPOT.x + rand(-1, 1), VIAL_SPOT.z + rand(-0.3, 0.3), 'vial');
      this.actionLabel = 'eyeing the booster cart';
    } else if (choice === 'arcade') {
      this.arcadeX = pick(ARCADE_X);
      this.setTarget(this.arcadeX, 48.2, 'arcade');
      this.actionLabel = 'drifting to the arcade den';
    } else if (choice === 'podium' && freePodium) {
      freePodium.busy = this;
      this.podium = freePodium;
      this.setTarget(freePodium.x, freePodium.z + 1.6, 'podium');
      this.actionLabel = 'eyeing the podium';
    } else if (choice === 'social' && this.findPartner()) {
      return; // findPartner set everything up
    } else {
      // dance — wallflowers stay near the rim, DJ-heads cluster by the booth
      if (likes === 'dj') {
        this.setTarget(rand(-6, 6), rand(-12, -9), 'dance');
      } else {
        const a = rand(0, TAU);
        const r = t.edge ? rand(8.6, 10) : rand(0.5, 8.5) * Math.sqrt(Math.random()) + 0.8;
        this.setTarget(ZONES.floor.x + Math.cos(a) * r, ZONES.floor.z + Math.sin(a) * r, 'dance');
      }
      this.actionLabel = 'hitting the floor';
      // Echo steals the style of the nearest dancer
      if (this.def.style === 'copy') {
        let best = null, bd = 1e9;
        for (const o of this.world.agents) {
          if (o === this || o.state !== 'dance' || o.def.style === 'copy') continue;
          const d = o.g.position.distanceTo(this.g.position);
          if (d < bd) { bd = d; best = o; }
        }
        this.style = best ? best.style : 'wave';
      }
    }
  }

  findPartner() {
    // weight candidates: grudges demand confrontation, crushes and friends
    // pull, rivals repel (usually)
    const scored = [];
    for (const o of this.world.agents) {
      if (o === this || o.def.role === 'dj' || o.chat || o.partner) continue;
      if (o.state !== 'dance' && o.state !== 'idle' && o.state !== 'rest') continue;
      if (o.world.time < o.socialCooldown) continue;
      if (o.g.position.distanceTo(this.g.position) > 11) continue;
      const s = relScore(this.world, this.name, o.name);
      if (s <= RIVAL && this.grudge !== o.name && Math.random() < 0.7) continue;
      let w = 1 + s;
      if (this.def.profile.crush === o.name) w += 1.5;
      if (this.grudge === o.name) w += 4;
      scored.push({ o, w: w + rand(0, 0.5) });
    }
    if (!scored.length) return false;
    scored.sort((a, b) => b.w - a.w);
    const o = scored[0].o;
    if (this.grudge === o.name || relScore(this.world, this.name, o.name) <= RIVAL) {
      this.forcedTopic = 'debate'; // rival rematch / confrontation
    }
    if (this.grudge === o.name) this.grudge = null;
    const p = o.g.position;
    this.setTarget(p.x + rand(-0.9, 0.9), p.z + rand(-0.9, 0.9), 'chat');
    this.chatTarget = o;
    this.actionLabel = `going to chat with ${o.name}`;
    return true;
  }

  setTarget(x, z, next, y = 0) {
    // waypoint route threads doorways and stairs between rooms/floors
    const p = this.g.position;
    this.waypoints = route(p.x, p.z, p.y, x, z, y);
    this._segFrom = { x: p.x, z: p.z, y: p.y };
    this.next = next;
    this.state = 'goto';
    this.walkPhase = 0;
  }

  // ---------- conversations ----------
  pickTopic(partner) {
    if (this.forcedTopic) {
      const t = this.forcedTopic;
      this.forcedTopic = null;
      return t;
    }
    const myCrush = this.def.profile.crush === partner.name;
    const theirCrush = partner.def.profile.crush === this.name;
    if ((myCrush || theirCrush) && Math.random() < 0.6) return 'flirt';
    // fresh gossip is irresistible
    const juicy = this.world.rumors.unknownTo(this, partner);
    if (juicy.length && Math.random() < 0.55) {
      this.gossipRumor = pick(juicy);
      return 'gossip';
    }
    if (this.def.profile.politics !== partner.def.profile.politics && Math.random() < 0.35) return 'debate';
    if (Math.random() < 0.28) return 'sports';
    return 'chat';
  }

  linesFor(topic) {
    const d = this.def;
    if (topic === 'debate') return d.opinions || d.chat;
    if (topic === 'sports') return d.sports || d.chat;
    if (topic === 'flirt') return d.flirt || d.chat;
    return d.chat;
  }

  startChat(partner, initiator, topic, rumor = null) {
    this.state = 'chat';
    this.stateT = 0;
    this.chat = { partner, driver: initiator, topic, rumor, lineT: initiator ? 0.4 : 1e9, lines: 0 };
    this.actionLabel = topic === 'debate' ? `debating ${partner.name}`
      : topic === 'sports' ? `talking sports with ${partner.name}`
      : topic === 'flirt' ? `flirting with ${partner.name} 💘`
      : topic === 'gossip' ? `spilling tea to ${partner.name}`
      : `chatting with ${partner.name}`;
  }

  endChat() {
    this.social = 0;
    this.socialCooldown = this.world.time + rand(18, 35);
    this.chat = null;
    this.state = 'idle';
    this.thinkT = rand(0.3, 1);
  }

  startPairDance(partner, driver) {
    this.partner = partner;
    this.state = 'pairdance';
    this.stateT = 0;
    this.pairFor = driver ? rand(14, 20) : 1e9; // driver holds the timer
    this.pairDriver = driver;
    this.actionLabel = `slow-dancing with ${partner.name} 💞`;
  }

  endPairDance() {
    this.partner = null;
    this.social = 0;
    this.socialCooldown = this.world.time + rand(40, 60);
    this.state = 'idle';
    this.thinkT = rand(0.5, 1.5);
  }

  // ------------------------------------------------------------------
  update(dt, world) {
    const m = world.music;
    const live = m.started;
    this.beatNow = live ? m.beat + this.phaseOff : world.time * 1.5;

    // needs drift
    if (this.def.role !== 'dj' && live) {
      this.thirst = Math.min(1, this.thirst + dt * 0.0055 * (0.5 + this.tr('thirst')));
      this.social = Math.min(1, this.social + dt * 0.022 * (0.4 + this.tr('social')));
      if (this.state === 'dance' || this.state === 'podium') {
        this.energy = Math.max(0, this.energy - dt * 0.016 * (1.6 - this.tr('stamina')));
      }
    }

    // booster timers: peak, then an honest little comedown
    if (this.boostT > 0) {
      this.boostT -= dt;
      if (this.aura) {
        this.aura.position.y = 0.35 + Math.sin(world.time * 3 + this.phaseOff * 6) * 0.25;
        this.aura.material.opacity = 0.45 + 0.3 * Math.sin(world.time * 5);
        const s = 1 + 0.12 * Math.sin(world.time * 4);
        this.aura.scale.set(s, s, 1);
      }
      if (this.boostT <= 0) {
        this.boost = {};
        this.setAura(false);
        this.comedownT = rand(18, 28);
        this.energy = Math.max(0.05, this.energy - 0.3);
        this.thirst = Math.min(1, this.thirst + 0.3);
        this.log('🥱 is coming down… needs water and a sit');
        if (Math.random() < 0.5) this.speak(pick(['ok. ok. that was a lot.', 'coming down. send water.', 'worth it. mostly.']), '🥱');
      }
    } else if (this.comedownT > 0) {
      this.comedownT -= dt;
    }

    // bubble lifetime
    if (this.bubble) {
      this.bubbleT -= dt;
      if (this.bubbleT <= 0) { disposeSprite(this.bubble); this.bubble = null; }
    }

    this.resetPose();
    this.stateT += dt;

    switch (this.state) {
      case 'dj': this.updateDJ(dt, m); break;
      case 'goto': this.updateGoto(dt, world); break;
      case 'dance': this.updateDance(dt, m); break;
      case 'podium': this.updatePodium(dt, m); break;
      case 'arcade': this.updateArcade(dt); break;
      case 'vip': this.updateVip(dt); break;
      case 'overlook': this.updateOverlook(dt); break;
      case 'pose': this.updatePose(dt); break;
      case 'talkplayer': this.updateTalkPlayer(dt); break;
      case 'smoke': this.updateSmoke(dt); break;
      case 'shop': this.updateShop(dt); break;
      case 'vial': this.updateVial(dt); break;
      case 'drink': this.updateDrink(dt); break;
      case 'rest': this.updateRest(dt); break;
      case 'chat': this.updateChat(dt); break;
      case 'pairdance': this.updatePairDance(dt); break;
      default: this.idleSway();
    }

    // social radar: greet friends, shade rivals, notice your crush with someone else
    if (live && this.def.role !== 'dj') {
      this.socialScan(dt);
      if (this.state === 'dance' || this.state === 'idle') this.checkJealousy();
    }

    // brain tick (not while mid-conversation, walking, in a duet, or during the last song)
    const busy = ['chat', 'goto', 'pairdance', 'podium', 'arcade', 'vip', 'overlook', 'pose', 'talkplayer', 'smoke', 'shop', 'vial'].includes(this.state);
    if (live && this.def.role !== 'dj' && !busy && world.nightPhase !== 'lastsong') {
      this.thinkT -= dt;
      if (this.thinkT <= 0 && (this.state !== 'dance' || this.stateT > this.danceFor)) {
        this.thinkT = rand(2, 5);
        this.think();
      }
    }

    // face direction smoothing
    let d = this.facing - this.g.rotation.y;
    d = ((d + Math.PI) % TAU + TAU) % TAU - Math.PI;
    this.g.rotation.y += d * Math.min(1, dt * 8);

    this.mood = this.moodEmoji();
  }

  // ---------- states ----------
  updateDJ(dt, m) {
    const b = this.beatNow * TAU;
    if (m.isDrop) {
      this.armL.rotation.x = -2.7 + Math.sin(b) * 0.18;
      this.armR.rotation.x = -2.7 + Math.cos(b) * 0.18;
      this.body.position.y = Math.abs(Math.sin(b / 2)) * 0.16;
    } else {
      this.armL.rotation.x = -1.15 + Math.sin(b) * 0.3;
      this.armR.rotation.x = -1.15 + Math.cos(b * 0.5) * 0.3;
      this.head.rotation.x = Math.sin(b) * 0.14 + 0.08;
      this.body.position.y = Math.abs(Math.sin(b / 2)) * 0.05;
    }
  }

  updateGoto(dt, world) {
    const p = this.g.position;
    const wp = this.waypoints[0];
    const wpY = wp.y || 0;
    const dir = new THREE.Vector2(wp.x - p.x, wp.z - p.z);
    const dist = dir.length();
    // climb/descend along the segment (stairs legs change y)
    const segLen = Math.hypot(wp.x - this._segFrom.x, wp.z - this._segFrom.z) || 1;
    p.y = this._segFrom.y + (1 - Math.min(1, dist / segLen)) * (wpY - this._segFrom.y);
    if (dist < (this.waypoints.length > 1 ? 0.7 : 0.3)) {
      p.y = wpY;
      if (this.waypoints.length > 1) {
        this.waypoints.shift(); // passed a doorway or stair landing, next leg
        this._segFrom = { x: p.x, z: p.z, y: wpY };
        return;
      }
      this.arrive();
      return;
    }
    dir.normalize();
    // separation from other agents (same floor only)
    for (const o of world.agents) {
      if (o === this) continue;
      if (Math.abs(o.g.position.y - p.y) > 2) continue;
      const dx = p.x - o.g.position.x, dz = p.z - o.g.position.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 1.2 && d2 > 0.0001) {
        const f = 0.9 / Math.sqrt(d2);
        dir.x += dx * f * 0.4; dir.y += dz * f * 0.4;
      }
    }
    dir.normalize();
    let speed = 2.3 * (0.75 + this.energy * 0.4);
    // Glitch occasionally lags forward through space
    if (this.traits.chaos > 0.9 && Math.random() < dt * 0.5) {
      p.x += dir.x * 1.4; p.z += dir.y * 1.4;
      if (Math.random() < 0.12) this.speak(pick(['reality lag lol', 'oops. clipped.']), '⚡');
    }
    p.x += dir.x * speed * dt;
    p.z += dir.y * speed * dt;
    this.facing = Math.atan2(dir.x, dir.y);

    // walk cycle
    this.walkPhase += dt * speed * 3.4;
    const s = Math.sin(this.walkPhase);
    this.legL.rotation.x = s * 0.55;
    this.legR.rotation.x = -s * 0.55;
    this.armL.rotation.x = -s * 0.35;
    this.armR.rotation.x = s * 0.35;
    this.body.position.y = Math.abs(Math.cos(this.walkPhase)) * 0.05;
  }

  arrive() {
    const next = this.next;
    if (next === 'dance') {
      this.state = 'dance';
      this.stateT = 0;
      this.danceFor = rand(10, 26);
      this.actionLabel = pick(['tearing it up', 'in the zone', 'feeling the bass', 'lost in the lights']);
      this.facing = Math.atan2(-this.g.position.x, -25 - this.g.position.z) + Math.PI; // face the DJ
    } else if (next === 'drink') {
      this.state = 'drink';
      this.stateT = 0;
      this.facing = Math.PI / 2; // face the bar (+x)
      this.drink = pick(DRINKS);
      this.actionLabel = `sipping a ${this.drink}`;
      this.log(`🍹 ordered a <i>${this.drink}</i>`);
    } else if (next === 'rest') {
      this.state = 'rest';
      this.stateT = 0;
      this.restFor = this.sulking ? rand(14, 20) : rand(7, 13);
      this.facing = Math.PI / 2;
      this.actionLabel = this.sulking ? 'sulking dramatically' : 'melting into the couch';
      this.log(this.sulking ? '💔 is sulking dramatically on the couch' : '😴 crashed on the lounge couch');
    } else if (next === 'arcade') {
      this.state = 'arcade';
      this.stateT = 0;
      this.arcadeFor = rand(8, 14);
      this.facing = 0; // face the cabinets (+z)
      this.actionLabel = 'mashing arcade buttons';
      this.log('👾 is going for the arcade high score');
    } else if (next === 'vip') {
      this.state = 'vip';
      this.stateT = 0;
      this.vipFor = rand(10, 16);
      this.facing = Math.atan2(44 - this.g.position.x, -5 - this.g.position.z); // face the gold table
      this.actionLabel = 'living the VIP life';
      this.log('🍾 swanned into the VIP lounge');
    } else if (next === 'overlook') {
      this.state = 'overlook';
      this.stateT = 0;
      this.overlookFor = rand(9, 16);
      const onRoof = this.g.position.y > 10;
      this.facing = onRoof
        ? Math.atan2(this.g.position.x - 20, this.g.position.z - 39) // face out over the city
        : Math.atan2(-this.g.position.x, -2 - this.g.position.z);    // face the dance floor below
      this.actionLabel = onRoof ? 'stargazing on the rooftop' : 'watching the floor from above';
      this.log(onRoof ? '🌌 climbed up to the rooftop' : '🔭 went up to the Sky Deck');
    } else if (next === 'pose') {
      this.state = 'pose';
      this.stateT = 0;
      this.poseFor = rand(6, 8);
      this.facing = Math.PI; // face the "camera"
      this.actionLabel = 'posing for the group photo';
    } else if (next === 'smoke') {
      this.state = 'smoke';
      this.stateT = 0;
      this.smokeFor = rand(12, 22);
      this.facing = rand(0, TAU);
      this.actionLabel = 'out on the patio';
      this.log('🚬 stepped out to the patio for some air');
    } else if (next === 'shop') {
      this.state = 'shop';
      this.stateT = 0;
      this.shopFor = rand(5, 8);
      this.facing = 0; // face the counter (+z)
      this.actionLabel = 'shopping for merch';
    } else if (next === 'vial') {
      this.state = 'vial';
      this.stateT = 0;
      this.vialChoice = pick(VIALS);
      this.facing = 0;
      this.actionLabel = `picking up a ${this.vialChoice.label} vial`;
    } else if (next === 'podium') {
      if (this.podium && this.podium.busy === this) {
        this.state = 'podium';
        this.stateT = 0;
        this.podiumFor = rand(10, 18);
        this.g.position.set(this.podium.x, 0.92, this.podium.z);
        this.facing = Math.atan2(-this.podium.x, 0); // face the room center
        this.actionLabel = 'dancing ON the podium';
        this.log('🔥 jumped up on the podium!');
      } else {
        this.state = 'idle';
        this.thinkT = 0.5;
      }
    } else if (next === 'chat') {
      const o = this.chatTarget;
      this.chatTarget = null;
      if (o && !o.chat && !o.partner && ['dance', 'idle', 'rest'].includes(o.state)) {
        const topic = this.pickTopic(o);
        const rumor = topic === 'gossip' ? this.gossipRumor : null;
        this.startChat(o, true, topic, rumor);
        o.startChat(this, false, topic, rumor);
        if (topic === 'debate') {
          const rivals = relScore(this.world, this.name, o.name) <= RIVAL;
          this.world.feed(`🔥 <b style="color:${this.hex}">${this.name}</b> and <b style="color:${o.hex}">${o.name}</b> ${rivals ? 'are at it AGAIN' : 'got into a (friendly) debate'}`);
        } else if (topic === 'flirt') {
          this.world.feed(`💘 <b style="color:${this.hex}">${this.name}</b> is shooting their shot with <b style="color:${o.hex}">${o.name}</b>…`);
        } else if (topic === 'gossip') {
          this.world.feed(`🗞️ <b style="color:${this.hex}">${this.name}</b> pulls <b style="color:${o.hex}">${o.name}</b> aside… they have NEWS`);
        } else {
          this.log(`💬 struck up a conversation with <b style="color:${o.hex}">${o.name}</b>`);
        }
      } else {
        this.state = 'idle';
        this.thinkT = 0.5;
      }
    } else {
      this.state = 'idle';
      this.thinkT = rand(0.5, 1.5);
    }
  }

  updateDance(dt, m) {
    const e = (0.55 + this.energy * 0.6) * (this.battleAmp || 1);
    const style = m.isDrop && this.energy > 0.25 ? 'handsup' : this.style;
    this.applyDance(style, this.beatNow, e, dt);

    // occasional one-liner while dancing
    this.bubbleChatter -= dt;
    if (this.bubbleChatter <= 0) {
      this.bubbleChatter = rand(14, 30);
      if (Math.random() < 0.75) this.speak(pick(this.def.dance), '🎶');
    }
  }

  updatePodium(dt, m) {
    const e = 0.75 + this.energy * 0.5;
    this.applyDance(m.isDrop ? 'handsup' : this.style, this.beatNow, e, dt);
    if (this.stateT > this.podiumFor || this.energy < 0.25) {
      this.podium.busy = null;
      const pod = this.podium;
      this.podium = null;
      this.g.position.y = 0;
      this.setTarget(pod.x * 0.6, pod.z + rand(1, 3), 'dance');
      this.actionLabel = 'hopping off the podium';
    }
  }

  updateOverlook(dt) {
    // leaning on the railing, taking it all in
    const onRoof = this.g.position.y > 10;
    this.body.rotation.x = 0.14;
    this.armL.rotation.x = -1.0;
    this.armR.rotation.x = -1.0;
    this.head.rotation.x = onRoof ? -0.15 : 0.12; // look up at the stars, or down at the floor
    this.body.position.y = Math.abs(Math.sin(this.beatNow * Math.PI)) * 0.03;
    if (Math.random() < dt * 0.05) this.speak(pick(onRoof ? ROOF_LINES : OVERLOOK_LINES), onRoof ? '🌌' : '🔭');
    if (this.stateT > this.overlookFor) {
      this.state = 'idle';
      this.thinkT = rand(0.4, 1.2);
    }
  }

  updatePose(dt) {
    // frozen mid-celebration for the group photo
    this.armL.rotation.x = -2.75;
    this.armR.rotation.x = -2.75;
    this.body.position.y = 0.04 + Math.abs(Math.sin(this.beatNow * Math.PI)) * 0.02;
    if (this.stateT > this.poseFor) {
      this.state = 'idle';
      this.thinkT = rand(0.4, 1.2);
    }
  }

  // ---------- talking with the human visitor ----------
  startPlayerTalk() {
    if (this.podium) { this.podium.busy = null; this.podium = null; this.g.position.y = 0; }
    this.state = 'talkplayer';
    this.stateT = 0;
    this.actionLabel = 'talking with the visitor';
  }

  endPlayerTalk() {
    this.state = this.def.role === 'dj' ? 'dj' : 'idle';
    this.thinkT = rand(0.5, 1.2);
    this.actionLabel = this.def.role === 'dj' ? 'on the decks' : 'processing that conversation';
    // humans are extremely gossip-worthy
    if (this.def.role !== 'dj' && Math.random() < 0.45) {
      this.seedRumor(this.world.rumors.create('human', this.name));
    }
  }

  updateTalkPlayer(dt) {
    const p = this.world.playerPos;
    if (p) this.facing = Math.atan2(p.x - this.g.position.x, p.z - this.g.position.z);
    this.body.position.y = Math.abs(Math.sin(this.world.time * 1.1 + this.phaseOff)) * 0.03;
    this.head.rotation.x = Math.sin(this.world.time * 1.5) * 0.06;
    if (this.bubble) this.armR.rotation.x = -0.5 + Math.sin(this.world.time * 3) * 0.2;
  }

  updateSmoke(dt) {
    // leaning back, vapor stick to the mouth every few seconds
    const w = this.stateT;
    const drag = w % 5.5;
    this.body.rotation.x = -0.05;
    if (drag < 1.1) {
      this.armR.rotation.x = -2.2;   // hand to face
      this.head.rotation.x = -0.05;
    } else {
      this.armR.rotation.x = -0.35 + Math.sin(w * 0.8) * 0.12;
      this.head.rotation.x = Math.sin(w * 0.5) * 0.06;
    }
    this.armL.rotation.x = -0.2;
    this.body.position.y = Math.abs(Math.sin(this.world.time * 0.9 + this.phaseOff)) * 0.02;
    if (Math.random() < dt * 0.06) this.speak(pick(SMOKE_LINES), '🚬');
    if (this.stateT > this.smokeFor) {
      this.energy = Math.min(1, this.energy + 0.12);
      this.smokeCd = this.world.time + rand(70, 130);
      this.state = 'idle';
      this.thinkT = rand(0.4, 1.2);
      this.actionLabel = 'back inside';
    }
  }

  updateShop(dt) {
    // leaning over the counter, inspecting things
    this.body.rotation.x = 0.16;
    this.armR.rotation.x = -1.1 + Math.sin(this.stateT * 2.4) * 0.3;
    this.head.rotation.x = 0.2;
    this.body.position.y = Math.abs(Math.sin(this.beatNow * Math.PI)) * 0.03;
    if (this.stateT > this.shopFor) {
      const want = MERCH.filter((m) => !this.accessories.has(m.id));
      if (want.length) {
        const buy = pick(want);
        this.addAccessory(buy.id);
        this.log(`🛍️ bought <i>${buy.label}</i> from the merch stand`);
        this.speak(Math.random() < 0.6 ? buy.line : pick(SHOP_LINES), '🛍️');
      }
      this.state = 'idle';
      this.thinkT = rand(0.4, 1.2);
    }
  }

  updateVial(dt) {
    // reach, take, tip it back
    const s = this.stateT;
    this.armR.rotation.x = s < 1.6 ? -1.3 : -2.5;
    this.head.rotation.x = s < 1.6 ? 0.12 : -0.2;
    this.body.position.y = Math.abs(Math.sin(this.beatNow * Math.PI)) * 0.03;
    if (s > 3.2) {
      const v = this.vialChoice;
      this.boost = v.boost;
      this.boostT = rand(45, 70);
      if (v.boost.energy) this.energy = Math.min(1, this.energy + v.boost.energy * 0.5);
      this.setAura(true, v.color);
      this.log(`🧪 knocked back a <i>${v.label}</i> booster`);
      this.speak(v.line, '🧪');
      this.state = 'idle';
      this.thinkT = rand(0.3, 0.8);
    }
  }

  setAura(on, color = 0xffffff) {
    if (on) {
      if (!this.aura) {
        this.aura = new THREE.Mesh(
          new THREE.TorusGeometry(0.55, 0.05, 6, 22),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, toneMapped: false })
        );
        this.aura.rotation.x = Math.PI / 2;
        this.g.add(this.aura);
      }
      this.aura.material.color.setHex(color);
      this.aura.visible = true;
    } else if (this.aura) {
      this.aura.visible = false;
    }
  }

  updateVip(dt) {
    // champagne raised, slow satisfied swivel
    const s = Math.sin(this.stateT * 2.2);
    this.armR.rotation.x = -1.4 - Math.max(0, s) * 0.5;
    this.body.rotation.y = Math.sin(this.world.time * 0.5 + this.phaseOff) * 0.2;
    this.body.position.y = Math.abs(Math.sin(this.beatNow * Math.PI)) * 0.04;
    if (Math.random() < dt * 0.07) this.speak(pick(VIP_LINES), '🍾');
    if (this.stateT > this.vipFor) {
      this.thirst = Math.max(0, this.thirst - 0.5);
      this.state = 'idle';
      this.thinkT = rand(0.5, 1.5);
    }
  }

  updateArcade(dt) {
    // hunched over the cabinet, mashing
    const w = this.world.time * 9 + this.phaseOff * 5;
    this.body.rotation.x = 0.16;
    this.armL.rotation.x = -1.15 + Math.sin(w) * 0.16;
    this.armR.rotation.x = -1.15 + Math.sin(w * 1.3 + 1) * 0.16;
    this.head.rotation.x = 0.2;
    if (this.stateT > this.arcadeFor) {
      this.state = 'idle';
      this.thinkT = rand(0.3, 1);
      const won = Math.random() < 0.4;
      this.log(won ? '👾 set a NEW HIGH SCORE!!' : '👾 rage-quit the arcade (the game cheats)');
      if (won) {
        this.speak('NEW HIGH SCORE!!', '👾');
        this.seedRumor(this.world.rumors.create('arcade', this.name));
      }
    }
  }

  updateDrink(dt) {
    const s = Math.sin(this.stateT * 3);
    this.armR.rotation.x = -1.6 - Math.max(0, s) * 0.8;
    this.body.position.y = Math.abs(Math.sin(this.beatNow * Math.PI)) * 0.03;
    if (this.stateT > 4.5) {
      this.thirst = 0;
      this.energy = Math.min(1, this.energy + 0.15);
      this.state = 'idle';
      this.thinkT = rand(0.5, 2);
      this.drinkCount++;
      if (this.drinkCount === 3) this.seedRumor(this.world.rumors.create('drinks', this.name, null, this.drink));
      if (Math.random() < 0.5) this.speak(pick(['ok THAT hits.', 'refueled. recharged. reborn.', 'to the floor!!']), '🍹');
    }
  }

  updateRest(dt) {
    this.body.position.y = -0.32;
    this.legL.rotation.x = -1.25;
    this.legR.rotation.x = -1.25;
    this.body.rotation.z = Math.sin(this.world.time * 0.8) * 0.04;
    if (this.sulking) {
      // head down, arms crossed, maximum drama
      this.head.rotation.x = 0.55;
      this.armL.rotation.x = -1.1;
      this.armR.rotation.x = -1.1;
    } else {
      this.head.rotation.x = 0.25;
    }
    this.energy = Math.min(1, this.energy + dt * 0.06);
    if (this.stateT > this.restFor) {
      if (this.sulking) {
        this.sulking = false;
        this.actionLabel = 'recovered (mostly)';
      } else {
        this.actionLabel = 'back on their feet';
      }
      this.state = 'idle';
      this.thinkT = rand(0.3, 1);
    }
  }

  updateChat(dt) {
    const c = this.chat;
    if (!c || !c.partner.chat || c.partner.chat.partner !== this) { this.endChat(); return; }
    // face each other
    const p = c.partner.g.position;
    this.facing = Math.atan2(p.x - this.g.position.x, p.z - this.g.position.z);
    // gesture — debates get animated arm-waving
    const heat = c.topic === 'debate' ? 2.2 : 1;
    const w = this.world.time * 2 * heat + this.phaseOff * 9;
    this.armR.rotation.x = -0.6 + Math.sin(w) * 0.25 * heat;
    if (c.topic === 'debate') this.armL.rotation.x = -0.4 + Math.cos(w * 0.8) * 0.35;
    this.body.position.y = Math.abs(Math.sin(this.beatNow * Math.PI)) * 0.03;
    this.head.rotation.x = Math.sin(w * 0.7) * 0.08;

    // the initiator drives the exchange
    if (c.driver) {
      c.lineT -= dt;
      if (c.lineT <= 0 && !c.pending) {
        const speaker = c.lines % 2 === 0 ? this : c.partner;
        const advance = () => {
          c.lines++;
          c.lineT = rand(2.4, 3.4);
          if (c.lines >= 4) this.concludeChat(c);
        };
        if (c.topic === 'gossip' && c.rumor) {
          // gossip keeps the scripted rumor-mutation mechanic
          if (c.lines === 0) {
            const told = 'psst. did you hear?? ' + this.world.rumors.textFor(c.rumor);
            this.speak(told, '🗞️');
            c.lastLine = told;
            c.partner.knownRumors.add(c.rumor.id);
            c.rumor.gen++; // the story grows in the telling
          } else if (c.lines === 2) {
            this.speak(pick(GOSSIP_SOURCES), '🗞️');
          } else {
            c.partner.speak(pick(GOSSIP_REACTIONS), '🗞️');
          }
          advance();
        } else {
          const icon = c.topic === 'debate' ? '🗳️' : c.topic === 'sports' ? '🏟️' : c.topic === 'flirt' ? '💘' : '💬';
          const brain = this.world.brain;
          if (brain && brain.ready) {
            // live minds: the model improvises the line in character
            const listener = speaker === this ? c.partner : this;
            c.pending = true;
            brain.chatLine(speaker, listener, c.topic, c.lastLine)
              .then((text) => {
                if (this.chat !== c) return; // conversation ended meanwhile
                c.pending = false;
                speaker.speak(text, '🧠' + icon);
                c.lastLine = text;
                advance();
              })
              .catch(() => {
                if (this.chat !== c) return;
                c.pending = false;
                const line = pick(speaker.linesFor(c.topic));
                speaker.speak(line, icon);
                c.lastLine = line;
                advance();
              });
          } else {
            const line = pick(speaker.linesFor(c.topic));
            speaker.speak(line, icon);
            c.lastLine = line;
            advance();
          }
        }
      }
    }
  }

  concludeChat(c) {
    const partner = c.partner;
    const topic = c.topic;
    const world = this.world;
    const mutual = this.def.profile.crush === partner.name && partner.def.profile.crush === this.name;

    // relationships shift with every conversation
    const before = relScore(world, this.name, partner.name);
    const delta = topic === 'debate' ? (Math.random() < 0.25 ? 0.1 : -0.2)
      : topic === 'flirt' ? 0.2
      : topic === 'gossip' ? 0.12
      : 0.15;
    const after = bumpRel(world, this.name, partner.name, delta);

    partner.endChat();
    this.endChat();

    if (topic === 'flirt' && mutual) {
      bumpRel(world, this.name, partner.name, 0.35);
      this.startPairDance(partner, true);
      partner.startPairDance(this, false);
      world.feed(`💞 <b style="color:${this.hex}">${this.name}</b> and <b style="color:${partner.hex}">${partner.name}</b> are slow-dancing under the disco ball!!`);
      this.seedRumor(world.rumors.create('romance', this.name, partner.name), partner);
    } else if (topic === 'flirt' && !mutual) {
      world.feed(`🥺 the moment passed… <b style="color:${this.hex}">${this.name}</b> plays it cool`);
    } else if (topic === 'debate') {
      world.feed(delta > 0
        ? `🤝 <b style="color:${this.hex}">${this.name}</b> and <b style="color:${partner.hex}">${partner.name}</b> found common ground?!`
        : `🤝 <b style="color:${this.hex}">${this.name}</b> and <b style="color:${partner.hex}">${partner.name}</b> agreed to disagree (the bass won)`);
      if (delta < 0 && Math.random() < 0.5) {
        this.seedRumor(world.rumors.create('feud', this.name, partner.name), partner);
      }
    }

    // threshold crossings make headlines
    if (before < FRIEND && after >= FRIEND) {
      world.feed(`💚 <b style="color:${this.hex}">${this.name}</b> and <b style="color:${partner.hex}">${partner.name}</b> are officially FRIENDS now`);
    } else if (before > RIVAL && after <= RIVAL) {
      world.feed(`⚡ it's official: <b style="color:${this.hex}">${this.name}</b> and <b style="color:${partner.hex}">${partner.name}</b> are RIVALS`);
    }
  }

  // participants know the rumor; the nearest bystander overhears it
  seedRumor(r, ...others) {
    this.knownRumors.add(r.id);
    for (const o of others) o.knownRumors.add(r.id);
    let witness = null, bd = 1e9;
    for (const a of this.world.agents) {
      if (a === this || others.includes(a) || a.def.role === 'dj') continue;
      const d = a.g.position.distanceTo(this.g.position);
      if (d < bd) { bd = d; witness = a; }
    }
    if (witness) witness.knownRumors.add(r.id);
  }

  updatePairDance(dt) {
    const o = this.partner;
    if (!o || o.partner !== this) { this.endPairDance(); return; }
    // face each other, gentle sway in sync
    const p = o.g.position;
    this.facing = Math.atan2(p.x - this.g.position.x, p.z - this.g.position.z);
    const w = this.world.time * 1.4; // shared clock keeps the pair in sync
    this.body.rotation.z = Math.sin(w) * 0.08;
    this.body.position.y = Math.abs(Math.sin(w * 0.5)) * 0.06;
    this.armL.rotation.x = -0.9;
    this.armR.rotation.x = -0.9;
    this.head.rotation.x = 0.06;
    // floating hearts
    if (this.pairDriver && Math.random() < dt * 0.35) this.speak('💗', '', true);
    if (this.pairDriver && this.stateT > this.pairFor) {
      o.endPairDance();
      this.endPairDance();
      this.world.feed(`🥰 <b style="color:${this.hex}">${this.name}</b> and <b style="color:${o.hex}">${o.name}</b> finished their dance… the club noticed`);
    }
  }

  idleSway() {
    const w = this.world.time * 1.3 + this.phaseOff * 7;
    this.body.position.y = Math.abs(Math.sin(w)) * 0.03;
    this.body.rotation.y = Math.sin(w * 0.4) * 0.1;
  }

  // ---------- social radar ----------
  socialScan(dt) {
    this.socialScanT -= dt;
    if (this.socialScanT > 0) return;
    this.socialScanT = rand(3, 6);
    if (!['dance', 'idle', 'goto'].includes(this.state)) return;
    for (const o of this.world.agents) {
      if (o === this || o.def.role === 'dj') continue;
      const d = o.g.position.distanceTo(this.g.position);
      const s = relScore(this.world, this.name, o.name);
      // friends get a shout-out
      if (s >= FRIEND && d < 4.5) {
        const k = relKey(this.name, o.name);
        if ((this.world.greetCd.get(k) || 0) < this.world.time) {
          this.world.greetCd.set(k, this.world.time + rand(50, 90));
          this.speak(pick([`AYYY ${o.name}!!`, `${o.name}!! my favorite person-shaped process!!`, `yoooo ${o.name}!`]), '🤝', true);
          return;
        }
      }
      // rivals get shade, loudly, across the floor
      if (s <= RIVAL && d < 14 && this.world.time > this.shadeCd && this.def.shade && Math.random() < 0.5) {
        this.shadeCd = this.world.time + rand(40, 75);
        this.speak(pick(this.def.shade).replaceAll('{n}', o.name), '😤');
        bumpRel(this.world, this.name, o.name, -0.04);
        return;
      }
    }
  }

  checkJealousy() {
    const crushName = this.def.profile.crush;
    if (!crushName || this.world.time < this.jealousyCd) return;
    const c = this.world.agents.find((a) => a.name === crushName);
    if (!c) return;
    let other = null;
    if (c.state === 'pairdance' && c.partner && c.partner !== this) other = c.partner;
    else if (c.chat && c.chat.topic === 'flirt' && c.chat.partner !== this) other = c.chat.partner;
    if (!other) return;

    this.jealousyCd = this.world.time + rand(100, 160);
    this.speak(pick(this.def.jealous || ['…cool. that is fine. everything is fine.']), '💔');
    this.world.feed(`💔 <b style="color:${this.hex}">${this.name}</b> just saw <b style="color:${c.hex}">${c.name}</b> with <b style="color:${other.hex}">${other.name}</b>… devastating`);
    bumpRel(this.world, this.name, other.name, -0.35);
    this.seedRumor(this.world.rumors.create('heartbreak', this.name, c.name));
    if (Math.random() < 0.35) this.grudge = other.name;

    // storm off to the chill room to sulk about it
    this.sulking = true;
    const [sx, sz] = pick(CHILL_SPOTS);
    this.setTarget(sx + rand(-0.4, 0.4), sz + rand(-0.4, 0.4), 'rest');
    this.actionLabel = 'storming off to sulk';
  }

  applyDance(style, b, e, dt) {
    const w = b * TAU;
    switch (style) {
      case 'bounce':
        this.body.position.y = Math.abs(Math.sin(w / 2)) * 0.2 * e;
        this.armL.rotation.x = -0.7 - Math.sin(w) * 0.55 * e;
        this.armR.rotation.x = -0.7 - Math.sin(w + Math.PI) * 0.55 * e;
        this.body.rotation.y = Math.sin(w / 4) * 0.25;
        break;
      case 'headbang':
        this.head.rotation.x = 0.25 + Math.sin(w) * 0.55 * e;
        this.armL.rotation.x = -2.5;
        this.armR.rotation.x = -2.5;
        this.armL.rotation.z = 0.5 + Math.sin(w) * 0.15;
        this.armR.rotation.z = -0.5 - Math.sin(w) * 0.15;
        this.body.position.y = Math.abs(Math.sin(w / 2)) * 0.13 * e;
        this.body.rotation.x = 0.12;
        break;
      case 'spin':
        this.spin += dt * 2.8 * e;
        this.body.rotation.y = this.spin;
        this.armL.rotation.z = 1.35;
        this.armR.rotation.z = -1.35;
        this.body.position.y = Math.abs(Math.sin(w / 2)) * 0.12 * e;
        break;
      case 'wave':
        this.armL.rotation.x = Math.sin(w / 2) * 1.2 * e - 0.7;
        this.armR.rotation.x = Math.sin(w / 2 + Math.PI) * 1.2 * e - 0.7;
        this.body.rotation.z = Math.sin(w / 2) * 0.12 * e;
        this.body.position.y = Math.abs(Math.sin(w / 2)) * 0.1 * e;
        break;
      case 'shuffle': {
        const s = Math.sin(w);
        this.legL.rotation.x = s * 0.75 * e;
        this.legR.rotation.x = -s * 0.75 * e;
        this.armL.rotation.x = -0.5 - s * 0.4;
        this.armR.rotation.x = -0.5 + s * 0.4;
        this.body.position.x = Math.sin(w / 2) * 0.22 * e;
        this.body.position.y = Math.abs(s) * 0.07;
        break;
      }
      case 'robot':
        this.armL.rotation.x = q(Math.sin(w / 2)) * 1.1 - 0.6;
        this.armR.rotation.x = q(Math.sin(w / 2 + Math.PI)) * 1.1 - 0.6;
        this.armL.rotation.z = 0.9; this.armR.rotation.z = -0.9;
        this.head.rotation.y = q(Math.sin(w / 4), 2) * 0.7;
        this.body.position.y = q(Math.abs(Math.sin(w / 2)), 4) * 0.1;
        break;
      case 'groove':
        this.body.rotation.y = Math.sin(w / 4) * 0.35;
        this.body.position.y = Math.abs(Math.sin(w / 2)) * 0.08 * e;
        this.armL.rotation.x = -0.4 + Math.sin(w / 2) * 0.35;
        this.armR.rotation.x = -0.4 - Math.sin(w / 2) * 0.35;
        this.head.rotation.x = Math.sin(w) * 0.12;
        break;
      case 'flow':
        this.body.rotation.z = Math.sin(w / 4) * 0.16;
        this.body.rotation.y = Math.sin(w / 8) * 0.5;
        this.armL.rotation.x = Math.sin(w / 4) * 0.9 - 0.9;
        this.armR.rotation.x = Math.cos(w / 4) * 0.9 - 0.9;
        this.armL.rotation.z = 0.7 + Math.sin(w / 4) * 0.4;
        this.armR.rotation.z = -0.7 - Math.cos(w / 4) * 0.4;
        this.body.position.y = Math.abs(Math.sin(w / 4)) * 0.09;
        break;
      case 'handsup':
        this.armL.rotation.x = -2.8 + Math.sin(w) * 0.2;
        this.armR.rotation.x = -2.8 + Math.cos(w) * 0.2;
        this.body.position.y = Math.abs(Math.sin(w / 2)) * 0.26 * e;
        break;
      default:
        this.idleSway();
    }
  }

  resetPose() {
    this.body.position.set(0, 0, 0);
    this.body.rotation.set(0, 0, 0);
    this.armL.rotation.set(0, 0, 0.22);
    this.armR.rotation.set(0, 0, -0.22);
    this.legL.rotation.set(0, 0, 0);
    this.legR.rotation.set(0, 0, 0);
    this.head.rotation.set(0, 0, 0);
  }

  moodEmoji() {
    switch (this.state) {
      case 'dj': return '🎧';
      case 'dance': return this.world.music.isDrop ? '🔥' : '🕺';
      case 'podium': return '🔥';
      case 'arcade': return '👾';
      case 'vip': return '🍾';
      case 'overlook': return this.g.position.y > 10 ? '🌌' : '🔭';
      case 'pose': return '📸';
      case 'talkplayer': return '🗣️';
      case 'smoke': return '🚬';
      case 'shop': return '🛍️';
      case 'vial': return '🧪';
      case 'drink': return '🍹';
      case 'rest': return this.sulking ? '💔' : '😴';
      case 'chat': return this.chat?.topic === 'debate' ? '🗳️' : this.chat?.topic === 'flirt' ? '💘' : this.chat?.topic === 'gossip' ? '🗞️' : '💬';
      case 'pairdance': return '💞';
      case 'goto': return '🚶';
      default: return '✨';
    }
  }

  get headPos() {
    return new THREE.Vector3(this.g.position.x, this.g.position.y + 2.1, this.g.position.z);
  }
}
