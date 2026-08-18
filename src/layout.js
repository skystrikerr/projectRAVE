// Building floor plan, now three levels:
//   L0 ground  — main hall + chill / vip / arcade wings
//   L1 Sky Deck balcony (y=6.5) — south end of the main hall, stairs on the west wall
//   L2 rooftop (y=14.2) — open air above the arcade den, stairs from the Sky Deck's east end
// Exports collision data shared by the player (walk mode) and the waypoint
// router used by agents.

export const WALL_H = 14;
export const BALCONY_Y = 6.5;
export const ROOF_Y = 14.2;

export const ROOMS = {
  main:   { x1: -28, x2: 28, z1: -28, z2: 28 },
  chill:  { x1: -58, x2: -28, z1: -10, z2: 18, door: { x: -28, z: 4, y: 0 } },
  vip:    { x1: 28, x2: 52, z1: -16, z2: 6, door: { x: 28, z: -5, y: 0 } },
  arcade: { x1: 6, x2: 34, z1: 28, z2: 50, door: { x: 20, z: 28, y: 0 } },
  // outdoor smoking patio, reached through the back of the chill room
  patio:  { x1: -56, x2: -32, z1: 18, z2: 44, door: { x: -42, z: 18, y: 0 }, outdoor: true },
};

// which room each wing opens into (patio hangs off the chill room)
export const ROOM_PARENT = { chill: 'main', vip: 'main', arcade: 'main', patio: 'chill' };

// L0 -> L1 stairs: straight flight hugging the main hall west wall
export const STAIRS = {
  x1: -27.6, x2: -23.4, z1: 6.2, z2: 20.2, // overlaps the deck so the seam is continuous
  base: { x: -25.5, z: 6.0, y: 0 },
  top: { x: -25.5, z: 20.4, y: BALCONY_Y },
};
export const BALCONY = { x1: -28, x2: 28, z1: 20, z2: 28 };

// L1 -> L2 stairs: east end of the Sky Deck, punching up through the roofline
export const ROOF_STAIRS = {
  x1: 23.8, x2: 27.8, z1: 20.8, z2: 29.9,
  base: { x: 25.8, z: 21.0, y: BALCONY_Y },
  top: { x: 25.8, z: 30.1, y: ROOF_Y },
};
export const ROOF = { x1: 6, x2: 34, z1: 28, z2: 50 }; // over the arcade den

export function levelOf(y) {
  return y > 10 ? 2 : y > 3.5 ? 1 : 0;
}

// walkable height at a point (ramps on the stairs, deck / roof slabs)
export function groundHeight(x, z, y) {
  if (y > 3.5 && x >= ROOF_STAIRS.x1 && x <= ROOF_STAIRS.x2 && z >= ROOF_STAIRS.z1 && z <= ROOF_STAIRS.z2) {
    return BALCONY_Y + (ROOF_Y - BALCONY_Y) * Math.min(1, Math.max(0, (z - 21) / 8.5));
  }
  if (y > 10 && x >= ROOF.x1 && x <= ROOF.x2 && z >= ROOF.z1 && z <= ROOF.z2) {
    return ROOF_Y;
  }
  if (x >= STAIRS.x1 && x <= STAIRS.x2 && z >= STAIRS.z1 && z <= STAIRS.z2 && y <= 10) {
    return BALCONY_Y * Math.min(1, Math.max(0, (z - 6.5) / 13));
  }
  if (y > 3.5 && x >= BALCONY.x1 && x <= BALCONY.x2 && z >= BALCONY.z1 && z <= BALCONY.z2) {
    return BALCONY_Y;
  }
  return 0;
}

// ---------------- collision walls (axis-aligned segments) ----------------
// ground level — door gaps included
export const WALLS_GROUND = [
  // main hall
  { x1: -28, z1: -28, x2: 28, z2: -28 },
  { x1: -28, z1: 28, x2: 18, z2: 28 }, { x1: 22, z1: 28, x2: 28, z2: 28 },
  { x1: -28, z1: -28, x2: -28, z2: 2 }, { x1: -28, z1: 6, x2: -28, z2: 28 },
  { x1: 28, z1: -28, x2: 28, z2: -7 }, { x1: 28, z1: -3, x2: 28, z2: 28 },
  // chill room (south wall has the patio door gap at x -44..-40)
  { x1: -58, z1: -10, x2: -58, z2: 18 },
  { x1: -58, z1: -10, x2: -28, z2: -10 },
  { x1: -58, z1: 18, x2: -44, z2: 18 }, { x1: -40, z1: 18, x2: -28, z2: 18 },
  // patio fence
  { x1: -56, z1: 18, x2: -56, z2: 44 }, { x1: -32, z1: 18, x2: -32, z2: 44 },
  { x1: -56, z1: 44, x2: -32, z2: 44 },
  // vip lounge
  { x1: 52, z1: -16, x2: 52, z2: 6 },
  { x1: 28, z1: -16, x2: 52, z2: -16 }, { x1: 28, z1: 6, x2: 52, z2: 6 },
  // arcade den
  { x1: 6, z1: 50, x2: 34, z2: 50 },
  { x1: 6, z1: 28, x2: 6, z2: 50 }, { x1: 34, z1: 28, x2: 34, z2: 50 },
];

// balcony level — building perimeter + railing (gaps at both stair landings)
export const WALLS_UPPER = [
  { x1: -28, z1: 28, x2: 28, z2: 28 },
  { x1: -28, z1: 20, x2: -28, z2: 28 },
  { x1: 28, z1: 20, x2: 28, z2: 28 },
  { x1: -23.4, z1: 20, x2: 23.8, z2: 20 }, // railing (west gap = stairs up, east gap = roof stairs)
];

// rooftop — parapet with a gap where the stairs arrive
export const WALLS_ROOF = [
  { x1: 6, z1: 50, x2: 34, z2: 50 },
  { x1: 6, z1: 28, x2: 23.8, z2: 28 }, { x1: 27.8, z1: 28, x2: 34, z2: 28 },
  { x1: 6, z1: 28, x2: 6, z2: 50 }, { x1: 34, z1: 28, x2: 34, z2: 50 },
];

// chunky furniture the player can't walk through (ground level, AABBs)
export const BLOCKERS = [
  { x1: -6.2, z1: -27.4, x2: 6.2, z2: -22.6 },   // DJ platform
  { x1: -10.2, z1: -25.2, x2: -7.8, z2: -22.8 }, // speakers
  { x1: 7.8, z1: -25.2, x2: 10.2, z2: -22.8 },
  { x1: 23.8, z1: 3.9, x2: 25.6, z2: 20.1 },     // bar counter
  { x1: -14.8, z1: -3.3, x2: -12.2, z2: -0.7 },  // podiums
  { x1: 12.2, z1: -3.3, x2: 14.8, z2: -0.7 },
  { x1: -14.7, z1: -14.7, x2: -13.3, z2: -13.3 }, // pillars
  { x1: 13.3, z1: -14.7, x2: 14.7, z2: -13.3 },
  { x1: -14.7, z1: 13.3, x2: -13.3, z2: 14.7 },
  { x1: 13.3, z1: 13.3, x2: 14.7, z2: 14.7 },
  { x1: 7.9, z1: 48.8, x2: 31.6, z2: 49.8 },     // arcade cabinets
  { x1: 18.2, z1: 37.9, x2: 21.8, z2: 40.1 },    // air hockey
  { x1: -48, z1: 0.4, x2: -45.5, z2: 10.1 },     // chill couches
  { x1: 41, z1: -6.2, x2: 45.5, z2: -3.8 },      // vip table
  { x1: -23.6, z1: 6.2, x2: -23.2, z2: 20 },     // stair side guard
];

export function roomOf(x, z, y = 0) {
  const lvl = levelOf(y);
  if (lvl === 2) return 'roof';
  if (lvl === 1) return 'balcony';
  for (const [name, r] of Object.entries(ROOMS)) {
    if (name === 'main') continue;
    if (x >= r.x1 && x <= r.x2 && z >= r.z1 && z <= r.z2) return name;
  }
  return 'main';
}

// doors from a wing outward to the main hall (patio -> chill -> main)
function doorsToMain(room) {
  const out = [];
  let r = room;
  while (r && r !== 'main' && ROOMS[r]?.door) { out.push({ ...ROOMS[r].door }); r = ROOM_PARENT[r]; }
  return out;
}

// waypoint list from (fx,fz,fy) to (tx,tz,ty), threading doorways and stairs
export function route(fx, fz, fy, tx, tz, ty = 0) {
  const fl = levelOf(fy), tl = levelOf(ty);
  const fromRoom = roomOf(fx, fz, fy), toRoom = roomOf(tx, tz, ty);
  if (fl === 0 && tl === 0 && fromRoom === toRoom) return [{ x: tx, z: tz, y: ty }];

  const pts = [];
  let lvl = fl;
  if (lvl === 0) pts.push(...doorsToMain(fromRoom));
  while (lvl < tl) {
    const s = lvl === 0 ? STAIRS : ROOF_STAIRS;
    pts.push({ ...s.base }, { ...s.top });
    lvl++;
  }
  while (lvl > tl) {
    const s = lvl === 1 ? STAIRS : ROOF_STAIRS;
    pts.push({ ...s.top }, { ...s.base });
    lvl--;
  }
  if (tl === 0) pts.push(...doorsToMain(toRoom).reverse());
  pts.push({ x: tx, z: tz, y: ty });
  // drop repeated waypoints (shared ancestor doors)
  return pts.filter((p, i) =>
    i === 0 || Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z) > 0.5 || (p.y || 0) !== (pts[i - 1].y || 0));
}

// circle-vs-walls/blockers resolution for the walking player.
// px/pz = previous position: penetrations resolve back toward the side the
// player came from, so a big step can never tunnel to the far side of a wall.
export function collide(x, z, y, px = x, pz = z, r = 0.45) {
  const lvl = levelOf(y);
  const walls = lvl === 2 ? WALLS_ROOF : lvl === 1 ? WALLS_UPPER : WALLS_GROUND;
  for (const w of walls) {
    if (w.x1 === w.x2) { // wall along z
      if (z > Math.min(w.z1, w.z2) - r && z < Math.max(w.z1, w.z2) + r && Math.abs(x - w.x1) < r) {
        x = w.x1 + Math.sign(px - w.x1 || 1) * r;
      }
    } else { // wall along x
      if (x > Math.min(w.x1, w.x2) - r && x < Math.max(w.x1, w.x2) + r && Math.abs(z - w.z1) < r) {
        z = w.z1 + Math.sign(pz - w.z1 || 1) * r;
      }
    }
  }
  if (lvl === 0) {
    for (const b of BLOCKERS) {
      if (x > b.x1 - r && x < b.x2 + r && z > b.z1 - r && z < b.z2 + r) {
        // push out along the shallowest axis
        const dxl = x - (b.x1 - r), dxr = (b.x2 + r) - x;
        const dzl = z - (b.z1 - r), dzr = (b.z2 + r) - z;
        const m = Math.min(dxl, dxr, dzl, dzr);
        if (m === dxl) x = b.x1 - r;
        else if (m === dxr) x = b.x2 + r;
        else if (m === dzl) z = b.z1 - r;
        else z = b.z2 + r;
      }
    }
  }
  return { x, z };
}
