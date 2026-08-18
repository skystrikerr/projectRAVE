// Controller support (standard Gamepad API mapping — Xbox/PlayStation/generic).
// Left stick moves, right stick looks, A talks, B leaves, Y cycles camera,
// Start opens the drama panel, Back opens the recap.

const DEAD = 0.18;
const dz = (v) => (Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD));

export const BTN = {
  A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7,
  BACK: 8, START: 9, L3: 10, R3: 11,
  UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15,
};

// canned openers so a controller-only player can still hold a conversation
export const PAD_LINES = [
  'hey, what are you into tonight?',
  'what do you actually think of this place?',
  'who should I be watching out for in here?',
  'tell me something nobody else knows',
  'what is on your mind right now?',
  'got any gossip for me?',
  'who do you have a crush on? be honest',
  'what would you change about this club?',
];

export class Pad {
  constructor() {
    this.prev = [];
    this.connected = false;
    this.onConnect = null; // (connected, id) => {}
  }

  read() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (const p of pads) {
      if (p && p.connected && p.buttons && p.buttons.length) { gp = p; break; }
    }
    if (!gp) {
      if (this.connected) { this.connected = false; this.onConnect && this.onConnect(false); }
      this.prev = [];
      return null;
    }
    if (!this.connected) { this.connected = true; this.onConnect && this.onConnect(true, gp.id); }
    const buttons = gp.buttons.map((b) => b.pressed || b.value > 0.4);
    const just = buttons.map((b, i) => b && !this.prev[i]);
    this.prev = buttons;
    return {
      lx: dz(gp.axes[0] || 0), ly: dz(gp.axes[1] || 0),
      rx: dz(gp.axes[2] || 0), ry: dz(gp.axes[3] || 0),
      buttons, just, id: gp.id,
    };
  }
}
