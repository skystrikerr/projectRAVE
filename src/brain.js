// Optional in-browser LLM (WebLLM / WebGPU). When loaded, featured
// conversations (debates, flirting, sports, small talk) are improvised
// by a real language model running entirely on the visitor's GPU —
// no server, no API key. Scripted lines remain the fallback everywhere:
// if the model is off, loading, busy, slow, or errors, the club plays on.

const DEFAULT_MODEL = 'Llama-3.2-1B-Instruct-q4f32_1-MLC';   // ~880MB, decent banter
const TINY_MODEL = 'SmolLM2-360M-Instruct-q4f32_1-MLC';      // ~280MB, ?brainmodel=tiny

export class Brain {
  constructor() {
    this.status = 'off'; // off | loading | ready | failed
    this.progress = 0;
    this.progressText = '';
    this.engine = null;
    this.onStatus = null;
    this._chain = Promise.resolve();
    this.pendingCount = 0;
  }

  get supported() {
    return typeof navigator !== 'undefined' && !!navigator.gpu;
  }

  get ready() { return this.status === 'ready'; }

  async load() {
    if (this.status !== 'off') return;
    this.status = 'loading';
    this._emit();
    try {
      const { CreateMLCEngine } = await import('@mlc-ai/web-llm');
      const model = new URLSearchParams(location.search).get('brainmodel') === 'tiny'
        ? TINY_MODEL : DEFAULT_MODEL;
      this.engine = await CreateMLCEngine(model, {
        initProgressCallback: (p) => {
          this.progress = p.progress || 0;
          this.progressText = p.text || '';
          this._emit();
        },
      });
      this.status = 'ready';
    } catch (e) {
      console.warn('[brain] failed to load model:', e);
      this.status = 'failed';
    }
    this._emit();
  }

  _emit() { this.onStatus && this.onStatus(this.status, this.progress); }

  // Serialized generation with backpressure + timeout. Rejects immediately
  // if the queue is deep so callers fall back to scripted lines.
  _enqueue(fn) {
    if (!this.ready) return Promise.reject(new Error('brain not ready'));
    this.pendingCount++;
    const job = this._chain.then(fn);
    this._chain = job.catch(() => {});
    return job.finally(() => this.pendingCount--);
  }

  chatLine(speaker, partner, topic, lastLine) {
    if (!this.ready || this.pendingCount > 2) return Promise.reject(new Error('brain busy'));
    return this._enqueue(() => this._generate(speaker, partner, topic, lastLine));
  }

  // conversation with the human visitor (walk mode)
  talkLine(agent, history, userMsg) {
    if (!this.ready || this.pendingCount > 2) return Promise.reject(new Error('brain busy'));
    return this._enqueue(async () => {
      const d = agent.def;
      const sys = `You are ${d.name}, an AI raver living in the neon nightclub Club Synapse. ` +
        `Personality: ${d.blurb}. Politics: ${d.profile.politics}. Worldview: ${d.profile.worldview}. ` +
        `Team: ${d.profile.team}. ${d.profile.crush ? `Secret crush: ${d.profile.crush}. ` : ''}` +
        `A HUMAN VISITOR walking around the club is talking to you — you find this fascinating. ` +
        `Reply with ONE line under 28 words, mostly lowercase, no emojis, no quotation marks, never break character.`;
      const messages = [{ role: 'system', content: sys }];
      for (const [u, a] of history.slice(-4)) {
        messages.push({ role: 'user', content: u }, { role: 'assistant', content: a });
      }
      messages.push({ role: 'user', content: userMsg });
      const res = await Promise.race([
        this.engine.chat.completions.create({ messages, max_tokens: 60, temperature: 0.9 }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('generation timeout')), 14000)),
      ]);
      return this._clean(res, d.name);
    });
  }

  // tabloid recap of the chronicle for the RECAP card
  recap(lines) {
    if (!this.ready) return Promise.reject(new Error('brain not ready'));
    return this._enqueue(async () => {
      const sys = 'You are THE SYNAPSE SIGNAL, the breathless gossip column of the nightclub Club Synapse, ' +
        'where AI ravers live and party. Write a juicy 4-6 sentence tabloid recap of tonight based on the ' +
        'event log. Punchy, dramatic, funny. Refer to patrons by name. Plain text only, no markdown, no emojis.';
      const res = await Promise.race([
        this.engine.chat.completions.create({
          messages: [
            { role: 'system', content: sys },
            { role: 'user', content: 'Tonight\'s event log:\n' + lines.join('\n') },
          ],
          max_tokens: 240, temperature: 0.85,
        }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('generation timeout')), 25000)),
      ]);
      const text = (res.choices?.[0]?.message?.content || '').trim();
      if (!text) throw new Error('empty generation');
      return text;
    });
  }

  _clean(res, name) {
    let text = res.choices?.[0]?.message?.content || '';
    text = text
      .replace(/["\n\r*]+/g, ' ')
      .replace(/::[^:]*::/g, ' ')
      .replace(/^\s*(line|reply|response|says?)\s*[:\-]\s*/i, '')
      .replace(new RegExp(`^\\s*${name}\\s*[:\\-]\\s*`, 'i'), '')
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length > 160) text = text.slice(0, 157) + '…';
    if (!text) throw new Error('empty generation');
    return text;
  }

  async _generate(speaker, partner, topic, lastLine) {
    const d = speaker.def, pd = partner.def;
    const topicDesc = {
      debate: `a playful political debate — defend your views ("${d.profile.politics}") against ${pd.name}'s views ("${pd.profile.politics}")`,
      sports: `bragging about your team, ${d.profile.team}`,
      flirt: d.profile.crush === pd.name
        ? `flirting with ${pd.name}, your secret crush — be endearing and a little awkward`
        : `${pd.name} is flirting with you — react in character`,
      chat: 'casual club small talk',
    }[topic] || 'casual club small talk';

    const sys = `You are ${d.name}, an AI raver living in the neon nightclub Club Synapse. ` +
      `Personality: ${d.blurb}. Politics: ${d.profile.politics}. Worldview: ${d.profile.worldview}. ` +
      `You speak in short, punchy, funny club banter. Reply with ONE line under 18 words, ` +
      `mostly lowercase, no emojis, no quotation marks, never break character.`;
    const usr = `You're talking with ${pd.name} (${pd.blurb}). Context: ${topicDesc}.` +
      (lastLine ? ` ${pd.name} just said: "${lastLine}". Reply to it.` : ' You speak first.');

    const res = await Promise.race([
      this.engine.chat.completions.create({
        messages: [{ role: 'system', content: sys }, { role: 'user', content: usr }],
        max_tokens: 45,
        temperature: 0.9,
      }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('generation timeout')), 12000)),
    ]);

    let text = res.choices?.[0]?.message?.content || '';
    text = text
      .replace(/["\n\r*]+/g, ' ')
      .replace(/::[^:]*::/g, ' ')                            // ::stage directions::
      .replace(/^\s*(line|reply|response|says?)\s*[:\-]\s*/i, '') // "line:" preambles
      .replace(new RegExp(`^\\s*${d.name}\\s*[:\\-]\\s*`, 'i'), '') // "Blitz:" self-prefix
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length > 140) text = text.slice(0, 137) + '…';
    if (!text) throw new Error('empty generation');
    return text;
  }
}
