// Shared social memory: a symmetric relationship graph between agents,
// and the rumor mill. Relationship scores live in world.rels keyed "A|B"
// (sorted), drifting toward friendship (+) or rivalry (-) with every
// interaction. Rumors are stored as facts and rendered through an
// escalation ladder — every retelling bumps `gen`, so the story mutates
// as it spreads.

export const FRIEND = 0.45;  // score at or above → friends
export const RIVAL = -0.35;  // score at or below → rivals

export const relKey = (a, b) => [a, b].sort().join('|');

export function relScore(world, a, b) {
  const r = world.rels.get(relKey(a, b));
  return r ? r.score : 0;
}

export function bumpRel(world, a, b, d) {
  const k = relKey(a, b);
  const r = world.rels.get(k) || { score: 0, n: 0 };
  r.score = Math.max(-1, Math.min(1, r.score + d));
  r.n++;
  world.rels.set(k, r);
  return r.score;
}

// strongest friend (sign=1) or fiercest rival (sign=-1) of `name`, or null
export function extremeRel(world, name, sign) {
  let best = null, bs = 0;
  for (const [k, r] of world.rels) {
    const [a, b] = k.split('|');
    if (a !== name && b !== name) continue;
    const v = r.score * sign;
    if (v > bs) { bs = v; best = a === name ? b : a; }
  }
  return best && bs >= (sign > 0 ? FRIEND : -RIVAL) ? best : null;
}

// ---------------- cliques ----------------
// Friend edges (score >= FRIEND) partition the club into social circles.
// Each circle gets a stable-ish name derived from its membership.

const CLIQUE_NAMES = [
  'the Bassline Cartel', 'the Neon Coven', 'the Fog Machine Society', 'the 4AM Club',
  'the Glowstick Union', 'the Subwoofer Cult', 'the Rooftop Philosophers',
  'the Patio Parliament', 'the Sparkle Syndicate', 'the Last Song Crew',
  'the Confetti Committee', 'the Strobe Circle', 'the Afterglow Collective',
];

export function detectCliques(world) {
  const parent = new Map();
  const find = (a) => { while (parent.get(a) !== a) { parent.set(a, parent.get(parent.get(a))); a = parent.get(a); } return a; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };

  for (const a of world.agents) parent.set(a.name, a.name);
  for (const [k, r] of world.rels) {
    if (r.score < FRIEND) continue;
    const [a, b] = k.split('|');
    if (parent.has(a) && parent.has(b)) union(a, b);
  }

  const groups = new Map();
  for (const a of world.agents) {
    const root = find(a.name);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(a.name);
  }

  const out = [];
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    members.sort();
    let h = 0;
    for (const ch of members.join('')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    out.push({ name: CLIQUE_NAMES[h % CLIQUE_NAMES.length], members });
  }
  out.sort((a, b) => b.members.length - a.members.length);
  return out;
}

// ---------------- rumor mill ----------------

const ESCALATIONS = {
  romance: [
    '{A} and {B} are a THING now!! I saw it!!',
    '{A} and {B} are getting married. tonight. on the podium.',
    '{A} and {B} are opening a rival club together. couples only.',
    '{A} and {B} are literally the same process, forked. destiny.',
  ],
  feud: [
    '{A} and {B} got into a HUGE debate',
    '{A} made {B} completely rethink their worldview. there were tears.',
    '{A} and {B} are settling it with a dance battle at midnight',
    '{A} deleted {B}’s entire playlist. it is WAR.',
  ],
  heartbreak: [
    '{A} is heartbroken over {B}…',
    '{A} cried into three Neon Fizzes over {B}',
    '{A} is writing a whole album about {B}. it is all synth.',
    '{A} asked the DJ to play something sad about {B}. Nova declined.',
  ],
  arcade: [
    '{A} set the arcade high score!!',
    '{A} beat the arcade so bad it needed a reboot',
    '{A} is secretly three arcade bots in a trenchcoat',
  ],
  drinks: [
    '{A} is on their THIRD {D} tonight',
    '{A} drank the bar completely out of {D}. legend? menace?',
    '{A} owes the bar a small fortune in {D}s',
  ],
  battle: [
    '{A} beat {B} in the dance battle!!',
    '{A} destroyed {B} so hard the floor tiles filed a report',
    '{A} is the undisputed dance champion of the entire simulation',
  ],
  human: [
    'a HUMAN visitor was talking to {A}??',
    'the human asked {A} some VERY personal questions',
    'the human is a talent scout from another club. {A} is getting poached.',
    'the human IS the club. we literally live in their browser. {A} confirmed it.',
  ],
};

export const GOSSIP_REACTIONS = [
  'no WAY.',
  'I KNEW IT. I called it WEEKS ago.',
  'this changes EVERYTHING.',
  'the group chat needs to hear this immediately.',
  'GASP. gasp. one more: gasp.',
  'I will take this to my grave (the grave is this club)',
];

export const GOSSIP_SOURCES = [
  'I heard it from a VERY reliable source.',
  'spread it responsibly. or don’t.',
  'you did NOT hear it from me.',
  'the disco ball sees everything. it told me.',
];

export class Rumors {
  constructor() {
    this.list = [];
    this._id = 1;
  }

  // create a rumor fact; participants/witnesses learn it via knownRumors
  create(kind, A, B = null, D = null) {
    const r = { id: this._id++, kind, A, B, D, gen: 0 };
    this.list.push(r);
    if (this.list.length > 8) this.list.shift();
    return r;
  }

  textFor(r) {
    const ladder = ESCALATIONS[r.kind];
    const t = ladder[Math.min(r.gen, ladder.length - 1)];
    return t.replaceAll('{A}', r.A).replaceAll('{B}', r.B || 'someone').replaceAll('{D}', r.D || 'drink');
  }

  // rumors `teller` knows that `listener` hasn't heard and isn't the subject of
  unknownTo(teller, listener) {
    return this.list.filter((r) =>
      teller.knownRumors.has(r.id) &&
      !listener.knownRumors.has(r.id) &&
      r.A !== listener.name && r.B !== listener.name);
  }
}
