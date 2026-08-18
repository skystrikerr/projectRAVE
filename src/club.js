import * as THREE from 'three';
import { makeNametag } from './sprites.js';
import { WALL_H, ROOMS } from './layout.js';

// Builds the club environment and returns { group, update(world, dt) }.
// Four rooms (see layout.js):
//   MAIN HALL   — dance floor (0,-2), DJ north wall, bar east, podiums
//   CHILL ROOM  — west wing: couches, bean bags, starfield ceiling
//   VIP LOUNGE  — east wing: gold, velvet ropes, champagne
//   ARCADE DEN  — south wing: 6 cabinets + air hockey

const TILES = 20, TILE = 1.15;

const hash = (x, y, s) => {
  const v = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return v - Math.floor(v);
};

// per-genre light programs: hue shift, movement speed, moving-head pattern
const PROGRAMS = {
  TECHNO:    { hue: 0,    speed: 1,    style: 'fan' },
  ACID:      { hue: 0.18, speed: 1.35, style: 'cross' },
  HOUSE:     { hue: 0.08, speed: 0.75, style: 'sweep' },
  TRANCE:    { hue: 0.55, speed: 0.9,  style: 'sweep' },
  HARDSTYLE: { hue: 0.95, speed: 1.7,  style: 'chase' },
  DUBSTEP:   { hue: 0.32, speed: 0.6,  style: 'cross' },
  'DRUM&BASS': { hue: 0.45, speed: 1.9, style: 'chase' },
  SYNTHWAVE: { hue: 0.82, speed: 0.5,  style: 'fan' },
};

export function buildClub(scene) {
  const g = new THREE.Group();
  scene.add(g);

  scene.fog = new THREE.FogExp2(0x070512, 0.012);
  scene.background = new THREE.Color(0x05030c);

  // ---------- floors & ceiling (one big slab under everything) ----------
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x0d0b1a, metalness: 0.85, roughness: 0.35 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(130, 130), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(-3, 0, 11);
  g.add(floor);
  // ceilings are per-room so the patio stays open to the sky
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0x060410, side: THREE.DoubleSide });
  for (const [cw, cd, cx, cz] of [[56, 56, 0, 0], [30, 28, -43, 4], [24, 22, 40, -5], [28, 22, 20, 39]]) {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(cw, cd), ceilMat);
    c.rotation.x = Math.PI / 2;
    c.position.set(cx, WALL_H, cz);
    g.add(c);
  }

  // ---------- walls (box segments with door gaps) ----------
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x0a0816, metalness: 0.4, roughness: 0.8 });
  const wallX = (x, z1, z2) => {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.4, WALL_H, z2 - z1), wallMat);
    w.position.set(x, WALL_H / 2, (z1 + z2) / 2);
    g.add(w);
  };
  const wallZ = (z, x1, x2) => {
    const w = new THREE.Mesh(new THREE.BoxGeometry(x2 - x1, WALL_H, 0.4), wallMat);
    w.position.set((x1 + x2) / 2, WALL_H / 2, z);
    g.add(w);
  };
  // main hall (doors: west z 2..6, east z -7..-3, south x 18..22)
  wallZ(-28, -28, 28);
  wallZ(28, -28, 18); wallZ(28, 22, 28);
  wallX(-28, -28, 2); wallX(-28, 6, 28);
  wallX(28, -28, -7); wallX(28, -3, 28);
  // chill room
  wallX(-58, -10, 18); wallZ(-10, -58, -28); wallZ(18, -58, -28);
  // vip lounge
  wallX(52, -16, 6); wallZ(-16, 28, 52); wallZ(6, 28, 52);
  // arcade den
  wallZ(50, 6, 34); wallX(6, 28, 50); wallX(34, 28, 50);

  // door lintels + glowing neon frames
  const doorGlows = [];
  const doorDefs = [
    { room: 'chill', color: 0x7a7aff, axis: 'x' },
    { room: 'vip', color: 0xffd700, axis: 'x' },
    { room: 'arcade', color: 0x22e6ff, axis: 'z' },
  ];
  for (const { room, color, axis } of doorDefs) {
    const d = ROOMS[room].door;
    const lintel = new THREE.Mesh(
      axis === 'x' ? new THREE.BoxGeometry(0.5, WALL_H - 5, 4.6) : new THREE.BoxGeometry(4.6, WALL_H - 5, 0.5),
      wallMat
    );
    lintel.position.set(d.x, 5 + (WALL_H - 5) / 2, d.z);
    g.add(lintel);
    const m = new THREE.MeshBasicMaterial({ color, toneMapped: false });
    doorGlows.push(m);
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 5, 0.2), m);
      post.position.set(d.x + (axis === 'z' ? s * 2.3 : 0), 2.5, d.z + (axis === 'x' ? s * 2.3 : 0));
      g.add(post);
    }
    const top = new THREE.Mesh(
      axis === 'x' ? new THREE.BoxGeometry(0.2, 0.2, 4.8) : new THREE.BoxGeometry(4.8, 0.2, 0.2),
      m
    );
    top.position.set(d.x, 5.05, d.z);
    g.add(top);
  }

  // neon trim strips along the main hall walls
  const trims = [];
  const trimGeo = new THREE.BoxGeometry(55.6, 0.12, 0.12);
  for (const y of [4, 8.5]) {
    for (const [pos, ry] of [
      [[0, y, -27.9], 0], [[0, y, 27.9], 0],
      [[-27.9, y, 0], Math.PI / 2], [[27.9, y, 0], Math.PI / 2],
    ]) {
      const m = new THREE.MeshBasicMaterial({ color: 0xff2bd6 });
      const t = new THREE.Mesh(trimGeo, m);
      t.position.set(...pos);
      t.rotation.y = ry;
      g.add(t);
      trims.push(m);
    }
  }

  // pillars with glowing rings (main hall)
  const rings = [];
  for (const [px, pz] of [[-14, -14], [14, -14], [-14, 14], [14, 14]]) {
    const p = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, WALL_H, 10),
      new THREE.MeshStandardMaterial({ color: 0x0c0a18, metalness: 0.7, roughness: 0.5 })
    );
    p.position.set(px, WALL_H / 2, pz);
    g.add(p);
    for (const ry of [2.8, 6, 9.2]) {
      const m = new THREE.MeshBasicMaterial({ color: 0x22e6ff });
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.06, 8, 24), m);
      r.rotation.x = Math.PI / 2;
      r.position.set(px, ry, pz);
      g.add(r);
      rings.push(m);
    }
  }

  // ---------- dance floor ----------
  const tileMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(TILE - 0.08, 0.1, TILE - 0.08),
    new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
    TILES * TILES
  );
  const dummy = new THREE.Object3D();
  let i = 0;
  for (let ix = 0; ix < TILES; ix++) {
    for (let iz = 0; iz < TILES; iz++) {
      dummy.position.set((ix - TILES / 2 + 0.5) * TILE, 0.05, -2 + (iz - TILES / 2 + 0.5) * TILE);
      dummy.updateMatrix();
      tileMesh.setMatrixAt(i, dummy.matrix);
      tileMesh.setColorAt(i, new THREE.Color(0x111122));
      i++;
    }
  }
  g.add(tileMesh);
  const tileColor = new THREE.Color();

  // go-go podiums
  const podiumGlows = [];
  for (const px of [-13.5, 13.5]) {
    const pod = new THREE.Mesh(
      new THREE.CylinderGeometry(1.05, 1.2, 0.9, 16),
      new THREE.MeshStandardMaterial({ color: 0x141028, metalness: 0.7, roughness: 0.4 })
    );
    pod.position.set(px, 0.45, -2);
    g.add(pod);
    const m = new THREE.MeshBasicMaterial({ color: 0xff2bd6 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.06, 8, 28), m);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(px, 0.92, -2);
    g.add(ring);
    podiumGlows.push(m);
  }

  // ---------- DJ booth + LED wall + speakers ----------
  const boothMat = new THREE.MeshStandardMaterial({ color: 0x100d20, metalness: 0.6, roughness: 0.4 });
  const platform = new THREE.Mesh(new THREE.BoxGeometry(12, 0.9, 4.5), boothMat);
  platform.position.set(0, 0.45, -25);
  g.add(platform);
  const console_ = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.85, 1.1), boothMat);
  console_.position.set(0, 1.32, -24);
  g.add(console_);
  const consoleTop = new THREE.Mesh(new THREE.BoxGeometry(5.3, 0.05, 0.9), new THREE.MeshBasicMaterial({ color: 0x22e6ff }));
  consoleTop.position.set(0, 1.77, -24);
  g.add(consoleTop);

  const LED_COLS = 34, LED_ROWS = 11;
  const ledMesh = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.55, 0.55),
    new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
    LED_COLS * LED_ROWS
  );
  i = 0;
  for (let cx = 0; cx < LED_COLS; cx++) {
    for (let ry = 0; ry < LED_ROWS; ry++) {
      dummy.position.set((cx - LED_COLS / 2 + 0.5) * 0.68, 2.8 + ry * 0.68, -27.6);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      ledMesh.setMatrixAt(i, dummy.matrix);
      ledMesh.setColorAt(i, new THREE.Color(0x050510));
      i++;
    }
  }
  g.add(ledMesh);

  const speakers = [];
  for (const sx of [-9, 9]) {
    const stack = new THREE.Group();
    for (let s = 0; s < 3; s++) {
      const size = 2.2 - s * 0.5;
      const box = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), boothMat);
      box.position.y = s === 0 ? 1.1 : s === 1 ? 3 : 4.4;
      stack.add(box);
      const cone = new THREE.Mesh(
        new THREE.TorusGeometry(size * 0.3, 0.07, 8, 24),
        new THREE.MeshBasicMaterial({ color: 0xff2bd6 })
      );
      cone.position.set(0, box.position.y, size / 2 + 0.02);
      stack.add(cone);
    }
    stack.position.set(sx, 0, -24);
    g.add(stack);
    speakers.push(stack);
  }

  // ---------- bar (main hall east) ----------
  const counter = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 16), boothMat);
  counter.position.set(24.7, 0.55, 12);
  g.add(counter);
  const counterTop = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 16.1), new THREE.MeshBasicMaterial({ color: 0xffb42b }));
  counterTop.position.set(24.7, 1.13, 12);
  g.add(counterTop);
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4.5, 16), wallMat);
  shelf.position.set(27.6, 2.2, 12);
  g.add(shelf);
  const bottleMats = [];
  for (let b = 0; b < 18; b++) {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(Math.random(), 1, 0.55) });
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.5, 8), m);
    bottle.position.set(27.25, 1.7 + (b % 3) * 1.1, 5.5 + Math.floor(b / 3) * 2.2);
    g.add(bottle);
    bottleMats.push(m);
  }
  for (let s = 0; s < 5; s++) {
    const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.25, 0.7, 10), boothMat);
    stool.position.set(23.3, 0.35, 6 + s * 3);
    g.add(stool);
  }

  // ---------- CHILL ROOM (west wing) ----------
  const couchMat = new THREE.MeshStandardMaterial({ color: 0x1a1030, metalness: 0.1, roughness: 0.9 });
  for (const [cx, cz, ry] of [[-46.5, 2.5, 0], [-46.5, 8, 0], [-52.5, 4.5, Math.PI / 2]]) {
    const couch = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 3.8), couchMat);
    seat.position.y = 0.28;
    couch.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.3, 3.8), couchMat);
    back.position.set(-0.8, 0.75, 0);
    couch.add(back);
    couch.position.set(cx, 0, cz);
    couch.rotation.y = ry;
    g.add(couch);
  }
  // bean bags
  const bagColors = [0x7a7aff, 0x2bffc9, 0xff2bd6, 0xffb42b];
  bagColors.forEach((bc, bi) => {
    const bag = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 12, 8),
      new THREE.MeshStandardMaterial({ color: bc, emissive: bc, emissiveIntensity: 0.12, roughness: 0.9 })
    );
    bag.scale.y = 0.55;
    bag.position.set([-40, -50, -38, -44][bi], 0.4, [13, -4, -6, 14][bi]);
    g.add(bag);
  });
  const chillTable = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.7, 0.5, 12), new THREE.MeshBasicMaterial({ color: 0x7a7aff }));
  chillTable.position.set(-48, 0.25, 4.5);
  g.add(chillTable);
  // starfield ceiling
  const starGeo = new THREE.BufferGeometry();
  const starPos = [];
  for (let s = 0; s < 140; s++) {
    starPos.push(-58 + Math.random() * 30, 13.4 + Math.random() * 0.4, -10 + Math.random() * 28);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xcfd8ff, size: 0.16, sizeAttenuation: true }));
  g.add(stars);
  const chillLight = new THREE.PointLight(0x7a7aff, 55, 34, 1.4);
  chillLight.position.set(-43, 10, 4);
  g.add(chillLight);

  // vial cart tucked in the chill room — the club's booster stand
  const cart = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.05, 1.2), boothMat);
  cart.position.set(-34.5, 0.52, -6);
  g.add(cart);
  const cartTop = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.06, 1.3), new THREE.MeshBasicMaterial({ color: 0x4fd8ff }));
  cartTop.position.set(-34.5, 1.08, -6);
  g.add(cartTop);
  const vialGlows = [];
  for (let v = 0; v < 6; v++) {
    const m = new THREE.MeshBasicMaterial({ color: 0x4fd8ff });
    const vial = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.16, 3, 8), m);
    vial.position.set(-35.5 + v * 0.4, 1.28, -6);
    g.add(vial);
    vialGlows.push(m);
  }

  // ---------- SMOKING PATIO (outdoors, behind the chill room) ----------
  const patioDeck = new THREE.Mesh(new THREE.BoxGeometry(24, 0.08, 26), new THREE.MeshStandardMaterial({ color: 0x14121c, roughness: 0.95 }));
  patioDeck.position.set(-44, 0.04, 31);
  g.add(patioDeck);
  // slatted fence around the perimeter
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x1c1730, metalness: 0.3, roughness: 0.85 });
  for (let fx = -56; fx <= -32; fx += 1.2) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.4, 0.12), fenceMat);
    slat.position.set(fx, 1.2, 44);
    g.add(slat);
  }
  for (const side of [-56, -32]) {
    for (let fz = 18.6; fz <= 44; fz += 1.2) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 0.9), fenceMat);
      slat.position.set(side, 1.2, fz);
      g.add(slat);
    }
  }
  // string lights criss-crossing overhead
  const stringBulbs = [];
  for (let s = 0; s < 3; s++) {
    const z0 = 23 + s * 8;
    for (let b = 0; b <= 14; b++) {
      const t = b / 14;
      const m = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), m);
      bulb.position.set(-55 + t * 22, 4.4 - Math.sin(t * Math.PI) * 0.9, z0 + (s % 2 ? 1.5 : -1.5) * Math.sin(t * Math.PI));
      g.add(bulb);
      stringBulbs.push(m);
    }
  }
  // picnic benches + stools
  for (const [bx, bz, br] of [[-49, 24, 0], [-38, 28, Math.PI / 2], [-46, 38, 0.4]]) {
    const table = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.16, 1.4), fenceMat);
    table.position.set(bx, 0.95, bz);
    table.rotation.y = br;
    g.add(table);
    for (const s of [-1, 1]) {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.14, 0.5), fenceMat);
      bench.position.set(bx + Math.sin(br + Math.PI / 2) * s * 1.15, 0.5, bz + Math.cos(br + Math.PI / 2) * s * 1.15);
      bench.rotation.y = br;
      g.add(bench);
    }
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.95, 0.16), fenceMat);
    leg.position.set(bx, 0.47, bz);
    g.add(leg);
  }
  // Moss's planters
  for (const [px, pz] of [[-54, 21], [-34.5, 21], [-54, 42], [-34.5, 42], [-44, 43]]) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 1.6), fenceMat);
    box.position.set(px, 0.35, pz);
    g.add(box);
    for (let l = 0; l < 5; l++) {
      const leaf = new THREE.Mesh(
        new THREE.ConeGeometry(0.16, 0.85, 5),
        new THREE.MeshStandardMaterial({ color: 0x2f7d3a, emissive: 0x18401f, emissiveIntensity: 0.4, roughness: 0.9 })
      );
      leaf.position.set(px + (Math.random() - 0.5) * 1.1, 1.05, pz + (Math.random() - 0.5) * 1.1);
      leaf.rotation.z = (Math.random() - 0.5) * 0.7;
      g.add(leaf);
    }
  }
  // patio heater, glowing coil on top
  const heaterPole = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 3, 8), fenceMat);
  heaterPole.position.set(-42, 1.5, 33);
  g.add(heaterPole);
  const heaterGlow = new THREE.MeshBasicMaterial({ color: 0xff7b3a });
  const heaterTop = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.7, 12, 1, true), heaterGlow);
  heaterTop.position.set(-42, 3.3, 33);
  g.add(heaterTop);
  const patioLight = new THREE.PointLight(0xffb46b, 34, 26, 1.5);
  patioLight.position.set(-44, 5, 31);
  g.add(patioLight);
  // stars above the patio
  const pStarGeo = new THREE.BufferGeometry();
  const pStarPos = [];
  for (let s = 0; s < 160; s++) {
    pStarPos.push(-44 + (Math.random() - 0.5) * 70, 18 + Math.random() * 40, 31 + (Math.random() - 0.5) * 70);
  }
  pStarGeo.setAttribute('position', new THREE.Float32BufferAttribute(pStarPos, 3));
  g.add(new THREE.Points(pStarGeo, new THREE.PointsMaterial({ color: 0xd8e2ff, size: 0.3, sizeAttenuation: true, fog: false })));

  // drifting vapor puffs from the smokers
  const PUFFS = 40;
  const puffMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.3, 6, 5),
    new THREE.MeshBasicMaterial({ color: 0xdfe4ff, transparent: true, opacity: 0.16, depthWrite: false }),
    PUFFS
  );
  const puffs = [];
  for (let p = 0; p < PUFFS; p++) puffs.push({ life: 0, x: 0, y: 0, z: 0, vy: 0 });
  g.add(puffMesh);
  let puffCursor = 0;
  function spawnPuff(x, y, z) {
    const p = puffs[puffCursor = (puffCursor + 1) % PUFFS];
    p.life = 1; p.x = x; p.y = y; p.z = z; p.vy = 0.4 + Math.random() * 0.4;
  }

  // ---------- VIP LOUNGE (east wing) ----------
  const carpet = new THREE.Mesh(new THREE.BoxGeometry(23, 0.06, 21), new THREE.MeshStandardMaterial({ color: 0x2a0a14, roughness: 0.95 }));
  carpet.position.set(40, 0.03, -5);
  g.add(carpet);
  const goldMat = new THREE.MeshStandardMaterial({ color: 0x8a6d1a, metalness: 0.95, roughness: 0.25, emissive: 0xffd700, emissiveIntensity: 0.08 });
  const vipCouchMat = new THREE.MeshStandardMaterial({ color: 0x3a1020, metalness: 0.2, roughness: 0.8 });
  for (const [cx, cz, ry] of [[48.5, -9, Math.PI / 2], [48.5, -1, Math.PI / 2], [42, -13.5, 0]]) {
    const couch = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 4.2), vipCouchMat);
    seat.position.y = 0.3;
    couch.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.4, 4.2), vipCouchMat);
    back.position.set(-0.85, 0.8, 0);
    couch.add(back);
    couch.position.set(cx, 0, cz);
    couch.rotation.y = ry;
    g.add(couch);
  }
  const vipTable = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.85, 0.55, 14), goldMat);
  vipTable.position.set(44, 0.28, -5);
  g.add(vipTable);
  // champagne bottles on the table
  for (let b = 0; b < 3; b++) {
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.55, 8), new THREE.MeshBasicMaterial({ color: 0xffd77a }));
    bottle.position.set(43.5 + b * 0.5, 0.85, -5.3 + (b % 2) * 0.6);
    g.add(bottle);
  }
  // velvet rope by the door
  for (const rz of [-8.4, -1.6]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.1, 8), goldMat);
    post.position.set(31.5, 0.55, rz);
    g.add(post);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffd700 }));
    ball.position.set(31.5, 1.15, rz);
    g.add(ball);
  }
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 6.8, 6), new THREE.MeshBasicMaterial({ color: 0xc71585 }));
  rope.rotation.x = Math.PI / 2;
  rope.position.set(31.5, 1.05, -5);
  g.add(rope);
  const vipLight = new THREE.PointLight(0xffd700, 50, 30, 1.4);
  vipLight.position.set(40, 10, -5);
  g.add(vipLight);

  // ---------- ARCADE DEN (south wing) ----------
  const arcadeScreens = [];
  for (let a = 0; a < 6; a++) {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.9, 0.8), boothMat);
    cab.position.set(8.5 + a * 4.5, 0.95, 49.3);
    g.add(cab);
    const m = new THREE.MeshBasicMaterial({ color: 0x22e6ff, toneMapped: false });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.6), m);
    screen.position.set(8.5 + a * 4.5, 1.35, 48.88);
    screen.rotation.y = Math.PI;
    g.add(screen);
    arcadeScreens.push(m);
  }
  // air hockey table
  const hockey = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.85, 1.9), boothMat);
  hockey.position.set(20, 0.43, 39);
  g.add(hockey);
  const hockeyGlow = new THREE.MeshBasicMaterial({ color: 0x22e6ff });
  const hockeyTop = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.04, 2), hockeyGlow);
  hockeyTop.position.set(20, 0.87, 39);
  g.add(hockeyTop);
  const arcLight = new THREE.PointLight(0x22e6ff, 45, 30, 1.4);
  arcLight.position.set(20, 10, 39);
  g.add(arcLight);

  // ---------- posters under the balcony (south wall) ----------
  const posterMats = [];
  for (let p = 0; p < 3; p++) {
    const m = new THREE.MeshBasicMaterial({ color: 0xff2bd6, toneMapped: false });
    const poster = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.2), m);
    poster.position.set(-18 + p * 6, 3.2, 27.7);
    poster.rotation.y = Math.PI;
    g.add(poster);
    posterMats.push(m);
  }

  // ---------- MERCH STAND (main hall, under the balcony) ----------
  const merchCounter = new THREE.Mesh(new THREE.BoxGeometry(5, 1.05, 1.3), boothMat);
  merchCounter.position.set(11, 0.52, 26);
  g.add(merchCounter);
  const merchTop = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.06, 1.4), new THREE.MeshBasicMaterial({ color: 0x2bffc9 }));
  merchTop.position.set(11, 1.08, 26);
  g.add(merchTop);
  const merchRack = new THREE.Mesh(new THREE.BoxGeometry(5, 2.6, 0.25), wallMat);
  merchRack.position.set(11, 1.9, 27.2);
  g.add(merchRack);
  const merchItems = [];
  for (let mi = 0; mi < 8; mi++) {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(mi / 8, 1, 0.6) });
    const item = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.6, 0.1), m);
    item.position.set(9 + (mi % 4) * 1.35, mi < 4 ? 2.5 : 1.6, 27);
    g.add(item);
    merchItems.push(m);
  }
  {
    const s = makeNametag('MERCH', '#2bffc9');
    s.position.set(11, 3.5, 26.9);
    s.scale.multiplyScalar(3.4);
    g.add(s);
  }

  // ---------- SKY DECK balcony (second floor, south end of main hall) ----------
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x120e24, metalness: 0.75, roughness: 0.4 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(56, 0.35, 8), deckMat);
  deck.position.set(0, 6.33, 24);
  g.add(deck);
  // glowing fascia along the deck edge (joins the beat-reactive trims)
  {
    const m = new THREE.MeshBasicMaterial({ color: 0xff2bd6 });
    const fascia = new THREE.Mesh(new THREE.BoxGeometry(56, 0.12, 0.12), m);
    fascia.position.set(0, 6.42, 20.05);
    g.add(fascia);
    trims.push(m);
  }
  // railing: posts + glowing top rail (gap at the stair landing, west end)
  const railGlow = new THREE.MeshBasicMaterial({ color: 0x22e6ff });
  for (let px = -23; px <= 27; px += 2.5) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.05, 6), deckMat);
    post.position.set(px, 7.03, 20.15);
    g.add(post);
  }
  const topRail = new THREE.Mesh(new THREE.BoxGeometry(51.4, 0.07, 0.07), railGlow);
  topRail.position.set(2.3, 7.56, 20.15);
  g.add(topRail);
  // support columns under the deck
  for (const cx of [-18, 0, 18]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 6.2, 10), deckMat);
    col.position.set(cx, 3.1, 24);
    g.add(col);
  }
  // stairs along the west wall (solid risers so they read from below)
  for (let s = 0; s < 13; s++) {
    const hgt = (s + 1) * 0.5;
    const step = new THREE.Mesh(new THREE.BoxGeometry(4.2, hgt, 1.03), deckMat);
    step.position.set(-25.5, hgt / 2, 7 + s);
    g.add(step);
  }
  // glowing handrail up the stairs
  const stairRail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 14.6), railGlow);
  stairRail.position.set(-23.4, 4.35, 13.2);
  stairRail.rotation.x = -Math.atan2(6.5, 13);
  g.add(stairRail);
  // loveseats up top, facing the dance floor
  for (const lx of [-10, 8]) {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 1.3), couchMat);
    seat.position.set(lx, 6.75, 26.4);
    g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(3, 1.1, 0.35), couchMat);
    back.position.set(lx, 7.05, 27.05);
    g.add(back);
  }
  // sky bar nook (west end — the east end holds the rooftop stairs)
  const skyBar = new THREE.Mesh(new THREE.BoxGeometry(5, 1, 1.2), boothMat);
  skyBar.position.set(-20, 7, 26.6);
  g.add(skyBar);
  const skyBarTop = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.05, 1.3), new THREE.MeshBasicMaterial({ color: 0xff9ddb }));
  skyBarTop.position.set(-20, 7.53, 26.6);
  g.add(skyBarTop);
  for (let b = 0; b < 5; b++) {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(Math.random(), 1, 0.6) });
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.4, 8), m);
    bottle.position.set(-21.6 + b * 0.8, 7.76, 26.6);
    g.add(bottle);
    bottleMats.push(m);
  }
  const deckLight = new THREE.PointLight(0xff9ddb, 42, 26, 1.4);
  deckLight.position.set(0, 9.6, 24);
  g.add(deckLight);

  // ---------- ROOFTOP (third floor, open air above the arcade den) ----------
  const roofSlab = new THREE.Mesh(new THREE.BoxGeometry(28, 0.4, 22), deckMat);
  roofSlab.position.set(20, 14.0, 39);
  g.add(roofSlab);
  // parapet glow rails (gap at the stair landing on the north edge)
  const parapetGlow = new THREE.MeshBasicMaterial({ color: 0x9b30ff });
  const parapets = [
    [20, 50, 28, 0],       // south edge: cx, cz, len, rotY
    [14.9, 28, 17.8, 0],   // north edge west of the stair gap
    [30.9, 28, 6.2, 0],    // north edge east of the stair gap
    [6, 39, 22, Math.PI / 2],
    [34, 39, 22, Math.PI / 2],
  ];
  for (const [px, pz, len, ry] of parapets) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.08), parapetGlow);
    rail.position.set(px, 15.3, pz);
    rail.rotation.y = ry;
    g.add(rail);
    const wallLow = new THREE.Mesh(new THREE.BoxGeometry(len, 1, 0.15), deckMat);
    wallLow.position.set(px, 14.7, pz);
    wallLow.rotation.y = ry;
    g.add(wallLow);
  }
  // stairs from the Sky Deck up through the roofline
  for (let s = 0; s < 9; s++) {
    const hgt = (s + 1) * 0.855;
    const step = new THREE.Mesh(new THREE.BoxGeometry(4, hgt, 0.98), deckMat);
    step.position.set(25.8, 6.5 + hgt / 2, 21.5 + s * 0.95);
    g.add(step);
  }
  // benches + heat lamps
  for (const [bx, bz] of [[12, 46.5], [28, 46.5]]) {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.45, 1.1), couchMat);
    bench.position.set(bx, 14.5, bz);
    g.add(bench);
  }
  const lampGlows = [];
  for (const [lx, lz] of [[10, 33], [30, 33], [20, 46]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.4, 8), deckMat);
    pole.position.set(lx, 15.4, lz);
    g.add(pole);
    const m = new THREE.MeshBasicMaterial({ color: 0xffb46b });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), m);
    lamp.position.set(lx, 16.7, lz);
    g.add(lamp);
    lampGlows.push(m);
  }
  const roofLight = new THREE.PointLight(0xffb46b, 38, 24, 1.5);
  roofLight.position.set(20, 17.5, 39);
  g.add(roofLight);
  // night sky: star dome + moon + distant city skyline
  const skyGeo = new THREE.BufferGeometry();
  const skyPos = [];
  for (let s = 0; s < 320; s++) {
    const a = Math.random() * Math.PI * 2, r = 60 + Math.random() * 60;
    skyPos.push(20 + Math.cos(a) * r, 25 + Math.random() * 45, 39 + Math.sin(a) * r);
  }
  skyGeo.setAttribute('position', new THREE.Float32BufferAttribute(skyPos, 3));
  g.add(new THREE.Points(skyGeo, new THREE.PointsMaterial({ color: 0xd8e2ff, size: 0.35, sizeAttenuation: true, fog: false })));
  const moon = new THREE.Mesh(new THREE.SphereGeometry(3.2, 16, 12), new THREE.MeshBasicMaterial({ color: 0xf4f1ff, fog: false, toneMapped: false }));
  moon.position.set(75, 48, -35);
  g.add(moon);
  for (let b = 0; b < 22; b++) {
    const a = (b / 22) * Math.PI * 2 + 0.3;
    const dist = 85 + Math.random() * 30;
    const h = 12 + Math.random() * 34;
    const bld = new THREE.Mesh(
      new THREE.BoxGeometry(6 + Math.random() * 8, h, 6 + Math.random() * 8),
      new THREE.MeshBasicMaterial({ color: 0x0e0b20, fog: false })
    );
    bld.position.set(20 + Math.cos(a) * dist, h / 2, 39 + Math.sin(a) * dist);
    g.add(bld);
    const win = new THREE.Mesh(
      new THREE.PlaneGeometry(3, h * 0.6),
      new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(0.08 + Math.random() * 0.5, 0.8, 0.4), transparent: true, opacity: 0.35, fog: false, toneMapped: false })
    );
    win.position.copy(bld.position);
    win.position.y = h * 0.55;
    win.lookAt(20, h * 0.55, 39);
    win.translateZ(Math.max(3, bld.geometry.parameters.depth / 2) + 0.2);
    g.add(win);
  }

  // ---------- neon signs ----------
  const signs = [
    ['✦ SYNAPSE ✦', '#ff2bd6', [0, 12.4, -27.4], 9],
    ['BAR', '#ffb42b', [25.5, 5.8, 12], 4],
    ['CHILL', '#7a7aff', [-43, 6.5, 4], 5],
    ['V I P', '#ffd700', [40, 6.5, -5], 5],
    ['ARCADE', '#22e6ff', [20, 6.5, 46], 5],
    ['SKY DECK', '#ff9ddb', [0, 9, 25.5], 5],
    ['✶ ROOFTOP ✶', '#9b30ff', [20, 16.8, 39], 5],
    ['PATIO', '#ffb46b', [-44, 5.6, 20], 4.5],
    ['BOOSTERS', '#4fd8ff', [-34.5, 2.6, -6], 2.6],
  ];
  for (const [text, color, pos, scale] of signs) {
    const s = makeNametag(text, color);
    s.position.set(...pos);
    s.scale.multiplyScalar(scale);
    g.add(s);
  }

  // ---------- disco balls ----------
  const balls = [];
  for (const [bx, by, bz, br] of [[0, 10.2, -2, 1.5], [-12, 9.3, 8, 0.8], [12, 9.3, 8, 0.8], [-43, 10.5, 4, 0.7], [40, 10.5, -5, 0.7]]) {
    const ball = new THREE.Mesh(
      new THREE.IcosahedronGeometry(br, 2),
      new THREE.MeshStandardMaterial({ color: 0xd9e6ff, metalness: 1, roughness: 0.12, flatShading: true })
    );
    ball.position.set(bx, by, bz);
    g.add(ball);
    balls.push(ball);
  }
  const ballLight = new THREE.PointLight(0xffffff, 70, 34, 1.6);
  ballLight.position.set(0, 10, -2);
  g.add(ballLight);

  // ---------- trusses, lasers, light cones (main hall) ----------
  const trussMat = new THREE.MeshStandardMaterial({ color: 0x141225, metalness: 0.8, roughness: 0.4 });
  for (const tz of [-20, 8]) {
    const truss = new THREE.Mesh(new THREE.BoxGeometry(50, 0.35, 0.35), trussMat);
    truss.position.set(0, 12.4, tz);
    g.add(truss);
  }

  const lasers = [];
  const laserGeo = new THREE.CylinderGeometry(0.035, 0.035, 60, 6, 1, true);
  laserGeo.translate(0, -30, 0);
  for (let l = 0; l < 12; l++) {
    const mat = new THREE.MeshBasicMaterial({
      color: l % 2 ? 0x22e6ff : 0xff2bd6,
      transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    });
    const beam = new THREE.Mesh(laserGeo, mat);
    const pivot = new THREE.Group();
    pivot.position.set(-11 + (l % 6) * 4.4, 12.3, l < 6 ? -20 : 8);
    pivot.add(beam);
    g.add(pivot);
    lasers.push({ pivot, mat, i: l });
  }

  const cones = [];
  const coneGeo = new THREE.ConeGeometry(3, 11.5, 24, 1, true);
  const coneColors = [0xff2bd6, 0x22e6ff, 0x9d4bff, 0x2bffc9, 0xffb42b, 0xd0ff2b];
  for (let c = 0; c < 6; c++) {
    const mat = new THREE.MeshBasicMaterial({
      color: coneColors[c], transparent: true, opacity: 0.1,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    });
    const cone = new THREE.Mesh(coneGeo, mat);
    cone.rotation.x = Math.PI;
    cone.position.y = -5.75;
    const pivot = new THREE.Group();
    pivot.position.set(-10 + (c % 3) * 10, 12.3, c < 3 ? -12 : 6);
    pivot.add(cone);
    g.add(pivot);
    cones.push({ pivot, i: c });
  }

  // ---------- moving-head beams (programmable light show) ----------
  const heads = [];
  const headBeamGeo = new THREE.CylinderGeometry(0.12, 1.5, 26, 14, 1, true);
  headBeamGeo.translate(0, -13, 0);
  for (let h = 0; h < 6; h++) {
    const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.5), trussMat);
    const hx = -20 + h * 8, hz = h % 2 ? -18 : 6;
    yoke.position.set(hx, 12.1, hz);
    g.add(yoke);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.16,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    });
    const beam = new THREE.Mesh(headBeamGeo, mat);
    const pivot = new THREE.Group();
    pivot.position.set(hx, 11.9, hz);
    pivot.add(beam);
    g.add(pivot);
    heads.push({ pivot, mat, i: h });
  }

  // ---------- blinder bars (white audience flash) ----------
  const blinders = [];
  for (const bz of [-21, 7]) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xfff4d0, toneMapped: false, transparent: true, opacity: 0 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(14, 0.5, 0.3), mat);
    bar.position.set(0, 11.4, bz);
    g.add(bar);
    const light = new THREE.PointLight(0xfff0cc, 0, 40, 1.1);
    light.position.set(0, 10.6, bz);
    g.add(light);
    blinders.push({ mat, light });
  }

  // ---------- CO2 jets either side of the booth ----------
  const JETS = 60;
  const jetMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.42, 6, 5),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false }),
    JETS
  );
  const jets = [];
  for (let j = 0; j < JETS; j++) jets.push({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0 });
  jetMesh.visible = false;
  g.add(jetMesh);
  let jetCursor = 0, lastJetBar = -1;
  function fireJets() {
    for (let n = 0; n < 22; n++) {
      const p = jets[jetCursor = (jetCursor + 1) % JETS];
      const side = n % 2 ? 1 : -1;
      p.life = 1;
      p.x = side * 6.5; p.y = 2.2; p.z = -22.5;
      p.vx = side * (1.5 + Math.random() * 1.5);
      p.vy = 4.5 + Math.random() * 2.5;
    }
  }

  // ---------- confetti (drop only, main hall) ----------
  const CONF = 260;
  const confMesh = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.14, 0.3),
    new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, toneMapped: false }),
    CONF
  );
  const confData = [];
  for (let cf = 0; cf < CONF; cf++) {
    confData.push({
      x: (Math.random() - 0.5) * 34, y: Math.random() * WALL_H, z: -12 + Math.random() * 24,
      vy: 1.6 + Math.random() * 2.4, ph: Math.random() * 7,
    });
    confMesh.setColorAt(cf, new THREE.Color().setHSL(Math.random(), 1, 0.6));
  }
  confMesh.visible = false;
  g.add(confMesh);

  // ---------- global lights ----------
  const amb = new THREE.AmbientLight(0x221833, 6);
  g.add(amb);
  const hemi = new THREE.HemisphereLight(0x3a2a66, 0x0a0614, 1.6);
  g.add(hemi);

  const spots = [];
  for (const [color, sx] of [[0xff2bd6, -11], [0x22e6ff, 11], [0x9d4bff, 0]]) {
    const s = new THREE.SpotLight(color, 1100, 55, 0.5, 0.5, 1.3);
    s.position.set(sx, 12.6, -6);
    const tgt = new THREE.Object3D();
    g.add(tgt);
    s.target = tgt;
    g.add(s);
    spots.push({ light: s, tgt, off: sx });
  }

  const strobe = new THREE.PointLight(0xffffff, 0, 45, 1.2);
  strobe.position.set(0, 10, -2);
  g.add(strobe);

  // ---------- animation ----------
  const trimColor = new THREE.Color();
  function update(world, dt) {
    const t = world.time;
    const m = world.music;
    const beat = m.started ? m.beat : t * 1.4;
    const bar = m.started ? m.bar : Math.floor(beat / 4);
    const hue = (bar * 0.045) % 1;

    // dance floor tile patterns, switching every 2 bars
    const mode = Math.floor(bar / 2) % 4;
    let idx = 0;
    for (let ix = 0; ix < TILES; ix++) {
      for (let iz = 0; iz < TILES; iz++) {
        let on = false;
        if (mode === 0) on = (ix + iz + Math.floor(beat)) % 2 === 0;
        else if (mode === 1) {
          const d = Math.hypot(ix - TILES / 2 + 0.5, iz - TILES / 2 + 0.5);
          on = ((d - beat * 1.6) % 4 + 4) % 4 < 1.4;
        } else if (mode === 2) on = (ix + Math.floor(beat * 2)) % 8 < 2;
        else on = hash(ix, iz, Math.floor(beat * 2)) > 0.72;
        if (on) tileColor.setHSL((hue + (ix + iz) * 0.004) % 1, 1, 0.55);
        else tileColor.setHSL((hue + 0.5) % 1, 0.9, 0.045);
        tileMesh.setColorAt(idx++, tileColor);
      }
    }
    tileMesh.instanceColor.needsUpdate = true;

    // LED equalizer wall
    const spec = m.spectrum();
    idx = 0;
    for (let cx = 0; cx < LED_COLS; cx++) {
      let level;
      if (spec) {
        const bin = Math.floor((cx / LED_COLS) * (spec.length * 0.75));
        level = (spec[bin] / 255) * LED_ROWS * 1.15;
      } else {
        level = (Math.sin(t * 2 + cx * 0.6) * 0.5 + 0.5) * LED_ROWS * 0.5;
      }
      for (let ry = 0; ry < LED_ROWS; ry++) {
        if (ry < level) tileColor.setHSL((hue + 0.35 + ry * 0.028) % 1, 1, ry > level - 1.3 ? 0.72 : 0.5);
        else tileColor.set(0x08060f);
        ledMesh.setColorAt(idx++, tileColor);
      }
    }
    ledMesh.instanceColor.needsUpdate = true;

    // neon trim + rings + podiums + door frames breathe with the beat
    trimColor.setHSL(hue, 1, 0.5 + m.kickPulse * 0.22);
    for (const tm of trims) tm.color.copy(trimColor);
    trimColor.setHSL((hue + 0.4) % 1, 1, 0.5 + m.kickPulse * 0.22);
    for (const rm of rings) rm.color.copy(trimColor);
    trimColor.setHSL((hue + 0.7) % 1, 1, 0.5 + m.kickPulse * 0.3);
    for (const pm of podiumGlows) pm.color.copy(trimColor);

    // posters cycle colors
    for (let p = 0; p < posterMats.length; p++) {
      posterMats[p].color.setHSL((hue + p * 0.33) % 1, 1, 0.4 + m.kickPulse * 0.15);
    }

    // "lights up" during the closing phase of the night
    const lightsUp = world.nightPhase === 'closing' ? 1 : 0;
    amb.intensity = 6 + lightsUp * 20;
    hemi.intensity = 1.6 + lightsUp * 5;

    // each genre runs its own light program
    const prog = PROGRAMS[m.genre?.name] || PROGRAMS.TECHNO;
    const pHue = (hue + prog.hue) % 1;

    // lasers fan + sweep (program speed, faster on the drop, dimmed at closing)
    for (const { pivot, mat, i: li } of lasers) {
      pivot.rotation.x = 0.9 + Math.sin(t * 0.7 * prog.speed + li * 0.5) * 0.35;
      pivot.rotation.z = Math.sin(t * (m.isDrop ? 1.6 : 0.9) * prog.speed + li * 0.8) * 0.8;
      mat.opacity = (0.35 + m.kickPulse * 0.4) * (1 - lightsUp * 0.85);
      mat.color.setHSL((pHue + (li % 2) * 0.5) % 1, 1, 0.55);
    }

    // moving heads run the program's pattern
    for (const { pivot, mat, i: hi } of heads) {
      let tilt = 0.55, pan = 0, bright = 1;
      if (prog.style === 'cross') {
        pan = Math.sin(t * 0.8 * prog.speed + hi * 1.05) * 0.85 * (hi % 2 ? -1 : 1);
        tilt = 0.5 + Math.cos(t * 0.6 + hi) * 0.22;
      } else if (prog.style === 'chase') {
        const active = Math.floor(beat * 2) % heads.length;
        bright = active === hi ? 1 : 0.12;
        pan = Math.sin(hi * 1.4) * 0.6;
      } else if (prog.style === 'sweep') {
        pan = Math.sin(t * 0.45 * prog.speed) * 0.95;
        tilt = 0.45 + Math.sin(t * 0.35) * 0.3;
      } else { // fan
        pan = Math.sin(t * 0.7 * prog.speed + hi * 0.55) * 0.7;
        tilt = 0.5 + Math.sin(t * 0.5 + hi * 0.9) * 0.25;
      }
      pivot.rotation.z = pan;
      pivot.rotation.x = tilt;
      mat.color.setHSL((pHue + 0.15 + hi * 0.04) % 1, 1, 0.6);
      mat.opacity = (0.07 + m.kickPulse * 0.16) * bright * (1 - lightsUp * 0.9);
    }

    // blinders slam on the drop's downbeats
    const blind = m.isDrop && beat % 1 < 0.13 ? 1 : 0;
    for (const b of blinders) {
      b.mat.opacity = blind * 0.85;
      b.light.intensity = blind * 260;
    }

    // CO2 jets punch once per drop bar
    if (m.isDrop && bar !== lastJetBar && bar % 2 === 0) {
      lastJetBar = bar;
      fireJets();
    }
    let jetAlive = false;
    for (let j = 0; j < JETS; j++) {
      const p = jets[j];
      if (p.life <= 0) continue;
      jetAlive = true;
      p.life -= dt * 0.75;
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= dt * 1.6;
      dummy.position.set(p.x, p.y, p.z);
      const s = 0.6 + (1 - p.life) * 2.6;
      dummy.scale.set(s, s, s);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      jetMesh.setMatrixAt(j, dummy.matrix);
    }
    if (!jetAlive) {
      jetMesh.visible = false;
    } else {
      jetMesh.visible = true;
      jetMesh.instanceMatrix.needsUpdate = true;
      jetMesh.material.opacity = 0.3;
    }
    dummy.scale.set(1, 1, 1);

    // light cones sway
    for (const { pivot, i: ci } of cones) {
      pivot.rotation.x = Math.sin(t * 0.5 + ci * 1.7) * 0.45;
      pivot.rotation.z = Math.cos(t * 0.42 + ci * 2.3) * 0.45;
    }

    // moving spotlights chase the floor
    for (const s of spots) {
      s.tgt.position.set(
        Math.sin(t * 0.6 + s.off) * 11,
        0,
        -3 + Math.cos(t * 0.48 + s.off * 0.7) * 9
      );
      s.light.intensity = 850 + m.kickPulse * 700;
    }

    // disco balls
    for (const b of balls) b.rotation.y = t * 0.35;
    ballLight.intensity = 50 + m.kickPulse * 55;

    // speakers thump
    for (const sp of speakers) {
      const sc = 1 + m.kickPulse * 0.07;
      sp.scale.set(sc, sc, sc);
    }

    // arcade screens flicker through game states
    for (let a = 0; a < arcadeScreens.length; a++) {
      arcadeScreens[a].color.setHSL((t * 0.14 + a * 0.31) % 1, 1, 0.5 + 0.18 * Math.sin(t * 7 + a * 3));
    }

    // confetti rains during the drop (or a triggered confetti burst / last song)
    if (m.isDrop || world.confettiBurst > 0) {
      confMesh.visible = true;
      for (let cf = 0; cf < CONF; cf++) {
        const c = confData[cf];
        c.y -= c.vy * dt;
        if (c.y < 0.1) c.y = WALL_H - 0.5;
        dummy.position.set(c.x + Math.sin(t * 2 + c.ph) * 0.5, c.y, c.z);
        dummy.rotation.set(t * 3 + c.ph, c.ph, t * 2);
        dummy.updateMatrix();
        confMesh.setMatrixAt(cf, dummy.matrix);
      }
      confMesh.instanceMatrix.needsUpdate = true;
    } else {
      confMesh.visible = false;
    }

    // gentle strobe on the last bars of the drop (kept slow on purpose)
    if (m.isDrop && bar % 8 >= 6) strobe.intensity = beat % 1 < 0.18 ? 380 : 0;
    else strobe.intensity = 0;

    // bar bottles twinkle
    for (let b = 0; b < bottleMats.length; b++) {
      const tw = 0.45 + 0.25 * Math.sin(t * 1.8 + b * 2.1);
      bottleMats[b].color.setHSL((b * 0.13 + hue * 0.3) % 1, 1, tw);
    }

    // side-room mood lights breathe softly
    chillLight.intensity = 50 + Math.sin(t * 0.7) * 12;
    vipLight.intensity = 46 + m.kickPulse * 18;
    arcLight.intensity = 40 + Math.sin(t * 5) * 8;
    for (let l = 0; l < lampGlows.length; l++) {
      lampGlows[l].color.setHSL(0.075, 0.9, 0.5 + 0.08 * Math.sin(t * 2.2 + l * 2));
    }

    // patio: warm string lights sway, heater glows, vapor drifts
    for (let s = 0; s < stringBulbs.length; s++) {
      stringBulbs[s].color.setHSL(0.09, 0.85, 0.52 + 0.13 * Math.sin(t * 1.6 + s * 0.7));
    }
    heaterGlow.color.setHSL(0.045, 1, 0.45 + 0.12 * Math.sin(t * 3.1));
    patioLight.intensity = 32 + Math.sin(t * 1.3) * 5;
    for (const a of world.agents) {
      if (a.state === 'smoke' && Math.random() < dt * 1.4) {
        spawnPuff(a.g.position.x + (Math.random() - 0.5) * 0.3, a.g.position.y + 2.1, a.g.position.z + 0.25);
      }
    }
    let puffAlive = false;
    for (let p = 0; p < PUFFS; p++) {
      const q = puffs[p];
      if (q.life <= 0) continue;
      puffAlive = true;
      q.life -= dt * 0.42;
      q.y += q.vy * dt;
      q.x += dt * 0.25;
      dummy.position.set(q.x, q.y, q.z);
      const s = 0.5 + (1 - q.life) * 2.2;
      dummy.scale.set(s, s, s);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      puffMesh.setMatrixAt(p, dummy.matrix);
    }
    puffMesh.visible = puffAlive;
    if (puffAlive) puffMesh.instanceMatrix.needsUpdate = true;
    dummy.scale.set(1, 1, 1);

    // vial cart + merch rack twinkle
    for (let v = 0; v < vialGlows.length; v++) {
      vialGlows[v].color.setHSL((0.5 + v * 0.12 + t * 0.05) % 1, 1, 0.55 + 0.15 * Math.sin(t * 2 + v));
    }
    for (let mi = 0; mi < merchItems.length; mi++) {
      merchItems[mi].color.setHSL((mi / merchItems.length + t * 0.06) % 1, 1, 0.55 + 0.12 * Math.sin(t * 3 + mi));
    }
  }

  return { group: g, update };
}
