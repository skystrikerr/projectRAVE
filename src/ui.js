import { SECTION_NAMES } from './audio.js';
import { FRIEND, RIVAL, extremeRel, detectCliques } from './social.js';

export class UI {
  constructor(world, { onFollow, onMode, onMute }) {
    this.world = world;
    this.rosterEl = document.getElementById('roster');
    this.feedEl = document.getElementById('feed');
    this.trackEl = document.querySelector('#nowplaying .track');
    this.sectEl = document.querySelector('#nowplaying .sect');
    this.profileEl = document.getElementById('profile');
    this.rows = new Map();
    this.updateT = 0;
    this.selected = null;
    this.profileAgent = null;

    for (const a of world.agents) {
      const row = document.createElement('div');
      row.className = 'agent-row';
      row.innerHTML =
        `<span class="dot" style="color:${a.hex};background:${a.hex}"></span>` +
        `<span class="nm" style="color:${a.hex}">${a.name}</span>` +
        `<span class="act"></span>`;
      row.title = `${a.def.blurb} • ${a.def.profile.politics}`;
      row.addEventListener('click', () => {
        if (this.selected === a) {
          this.select(null);
          onFollow(null);
        } else {
          this.select(a);
          onFollow(a);
        }
      });
      this.rosterEl.appendChild(row);
      this.rows.set(a, row);
    }

    for (const btn of document.querySelectorAll('#cambar button[data-mode]')) {
      btn.addEventListener('click', () => {
        onMode(btn.dataset.mode);
        this.setModeButtons(btn.dataset.mode);
        this.select(null);
        this.showProfile(null);
      });
    }
    const muteBtn = document.getElementById('mute');
    let muted = false;
    muteBtn.addEventListener('click', () => {
      muted = !muted;
      muteBtn.textContent = muted ? '🔇' : '🔊';
      onMute(muted);
    });

    // relationship graph overlay
    this.graphEl = document.getElementById('graphbox');
    this.graphBtn = document.getElementById('graphbtn');
    this.graphCtx = document.getElementById('graphcanvas').getContext('2d');
    this.graphOpen = false;
    this.cliqueEl = document.getElementById('cliquelist');
    this.graphBtn.addEventListener('click', () => {
      this.graphOpen = !this.graphOpen;
      this.graphEl.classList.toggle('hidden', !this.graphOpen);
      this.graphBtn.classList.toggle('on', this.graphOpen);
      if (this.graphOpen) this.drawGraph();
    });
  }

  drawGraph() {
    const ctx = this.graphCtx;
    const agents = this.world.agents;
    const W = ctx.canvas.width, cx = W / 2, cy = W / 2, R = W / 2 - 52;
    ctx.clearRect(0, 0, W, W);

    // node layout: everyone around a circle
    const pos = new Map();
    agents.forEach((a, i) => {
      const ang = (i / agents.length) * Math.PI * 2 - Math.PI / 2;
      pos.set(a.name, { x: cx + Math.cos(ang) * R, y: cy + Math.sin(ang) * R, a });
    });

    // relationship edges
    for (const [k, r] of this.world.rels) {
      if (Math.abs(r.score) < 0.12) continue;
      const [na, nb] = k.split('|');
      const pa = pos.get(na), pb = pos.get(nb);
      if (!pa || !pb) continue;
      const good = r.score > 0;
      ctx.strokeStyle = good
        ? `rgba(43, 255, 201, ${0.25 + Math.abs(r.score) * 0.7})`
        : `rgba(255, 77, 107, ${0.25 + Math.abs(r.score) * 0.7})`;
      ctx.lineWidth = 1 + Math.abs(r.score) * 3;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
      // official statuses get a badge at the midpoint
      if (r.score >= FRIEND || r.score <= RIVAL) {
        ctx.font = '11px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(good ? '💚' : '⚡', (pa.x + pb.x) / 2, (pa.y + pb.y) / 2 + 4);
      }
    }

    // crush arrows (dashed pink, offset so mutual crushes show both ways)
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(255, 43, 214, 0.55)';
    ctx.lineWidth = 1.4;
    for (const a of agents) {
      const crush = a.def.profile.crush;
      if (!crush || !pos.get(crush)) continue;
      const pa = pos.get(a.name), pb = pos.get(crush);
      const dx = pb.x - pa.x, dy = pb.y - pa.y;
      const len = Math.hypot(dx, dy);
      const ox = (-dy / len) * 4, oy = (dx / len) * 4;
      ctx.beginPath();
      ctx.moveTo(pa.x + ox, pa.y + oy);
      ctx.lineTo(pb.x + ox - dx * 0.12, pb.y + oy - dy * 0.12);
      ctx.stroke();
      ctx.font = '10px system-ui';
      ctx.fillText('💘', pa.x + ox + dx * 0.72, pa.y + oy + dy * 0.72 + 3);
    }
    ctx.setLineDash([]);

    // nodes + names
    const small = agents.length > 16;
    for (const { x, y, a } of pos.values()) {
      ctx.fillStyle = a.hex;
      ctx.shadowColor = a.hex;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(x, y, small ? 4 : 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.font = `700 ${small ? 9 : 10.5}px system-ui`;
      ctx.textAlign = 'center';
      ctx.fillText(a.name, x, y + (y > cy ? 15 : -9));
    }

    this.renderCliques();
  }

  renderCliques() {
    const cliques = detectCliques(this.world);
    const colorOf = (n) => this.world.agents.find((a) => a.name === n)?.hex || '#fff';
    let html = '<div class="ctitle">CLIQUES TONIGHT</div>';
    if (!cliques.length) {
      html += '<div class="none">no crews formed yet — they’re still feeling each other out</div>';
    } else {
      for (const c of cliques.slice(0, 5)) {
        const names = c.members.map((n) => `<span style="color:${colorOf(n)}">${n}</span>`).join(', ');
        html += `<div class="clique"><b>${c.name}</b><br>${names}</div>`;
      }
    }
    this.cliqueEl.innerHTML = html;
  }

  select(agent) {
    this.selected = agent;
    for (const [a, row] of this.rows) row.classList.toggle('sel', a === agent);
    if (agent) this.setModeButtons(null); // following — no mode button lit
  }

  setModeButtons(mode) {
    for (const btn of document.querySelectorAll('#cambar button[data-mode]')) {
      btn.classList.toggle('on', btn.dataset.mode === mode);
    }
  }

  showProfile(agent) {
    this.profileAgent = agent;
    if (!agent) {
      this.profileEl.classList.add('hidden');
      return;
    }
    const p = agent.def.profile;
    this.profileEl.classList.remove('hidden');
    this.profileEl.querySelector('.p-name').textContent = agent.name;
    this.profileEl.querySelector('.p-name').style.color = agent.hex;
    this.profileEl.querySelector('.p-blurb').textContent = agent.def.blurb;
    this.profileEl.querySelector('.p-pol').textContent = p.politics;
    this.profileEl.querySelector('.p-world').textContent = p.worldview;
    this.profileEl.querySelector('.p-team').textContent = p.team;
    this.profileEl.querySelector('.p-crush').textContent = p.crush ? `${p.crush} 💘` : '— (single & thriving)';
  }

  addFeed(html) {
    const div = document.createElement('div');
    div.className = 'entry';
    div.innerHTML = html;
    this.feedEl.appendChild(div);
    while (this.feedEl.children.length > 6) this.feedEl.firstChild.remove();
  }

  nowPlaying(label) {
    this.trackEl.textContent = '♪ ' + label;
  }

  setSection(i) {
    this.sectEl.textContent = SECTION_NAMES[i];
  }

  tick(dt) {
    this.updateT -= dt;
    if (this.updateT > 0) return;
    this.updateT = 0.3;
    for (const [a, row] of this.rows) {
      row.querySelector('.act').textContent = `${a.mood} ${a.actionLabel}`;
    }
    if (this.profileAgent) {
      const a = this.profileAgent;
      this.profileEl.querySelector('.p-act').textContent = `${a.mood} ${a.actionLabel}`;
      this.profileEl.querySelector('.b-energy').style.width = `${a.energy * 100}%`;
      this.profileEl.querySelector('.b-thirst').style.width = `${a.thirst * 100}%`;
      this.profileEl.querySelector('.b-social').style.width = `${a.social * 100}%`;
      const bestie = extremeRel(this.world, a.name, 1);
      const rival = extremeRel(this.world, a.name, -1);
      this.profileEl.querySelector('.p-bestie').textContent = bestie ? `${bestie} 💚` : '— (working on it)';
      this.profileEl.querySelector('.p-rival').textContent = rival ? `${rival} ⚡` : '— (beloved by all)';
    }
    if (this.graphOpen) this.drawGraph();
  }
}
