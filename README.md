# projectRAVE — CLUB SYNAPSE

An animated 3D nightclub where **22 AI agents live, party, argue, fall in love and gossip about each other.**
Built with Three.js + Vite. Runs in the browser or as a Windows desktop app.

**Live:** https://club-synapse.netlify.app

---

## What it is

Club Synapse is a persistent social simulation dressed up as a rave. Every resident has needs
(energy, thirst, sociability), a dance style, politics, a worldview, a sports team, opinions they
will defend, and — for most of them — a crush. What happens between them is not scripted:

- **Relationships** — every conversation shifts a friendship/rivalry score. Cross a threshold and
  the club announces it. Friends greet each other across the room; rivals throw personalised shade.
- **Cliques** — friend groups cluster into named social circles (the Patio Parliament, the Fog
  Machine Society…) visible in the DRAMA overlay.
- **Romance & jealousy** — mutual crushes end up slow-dancing under the disco ball. Unrequited ones
  watch it happen, spiral, and storm off to sulk.
- **Gossip** — real events spawn rumours that *mutate* as they spread, escalating with each retelling.
- **Night arc** — opening → peak hour → last song → lights up → next night. Relationships and the
  night counter persist in local storage, so the story continues between visits.

## The building

Three floors: the main hall (dance floor, DJ booth, bar, podiums, merch stand), a chill room,
a VIP lounge, an arcade den, an outdoor smoking patio, a Sky Deck balcony, and a rooftop with a
city skyline. Agents navigate between them through real doorways and staircases.

## Music & lights

The soundtrack is generated live in the browser with the Web Audio API — eight genres (techno,
acid, house, trance, hardstyle, dubstep, drum & bass, synthwave) that rotate with real BPM changes
and drive a beat-synced light show: lasers, moving heads, blinders, CO2 jets and a 34-column LED wall.

## Live AI minds (optional)

Enter through the second door and the club downloads a small language model (Llama 3.2 1B) that runs
**entirely on your GPU via WebGPU** — no server, no API key, no cost. Conversations, and anything you
say to a resident, are then genuinely improvised in character. Scripted dialogue is always the fallback.

## Controls

| Action | Keyboard / Mouse | Controller |
|---|---|---|
| Move | `WASD` / arrows | Left stick |
| Look | Mouse (click to lock) | Right stick |
| Run | `Shift` | `RT` / `L3` |
| Talk to a resident | `E` | `A` |
| Leave conversation | `Esc` | `B` |
| Cycle camera | on-screen buttons | `Y` |
| Drama overlay | on-screen button | `START` |
| Recap column | on-screen button | `BACK` |
| Mute | on-screen button | `X` |
| Fullscreen (desktop) | `F11` | — |

Touch devices get an on-screen joystick and drag-to-look.

## Running it

```bash
npm install
npm run dev        # http://localhost:5175
npm run build      # production build into dist/
npm run electron   # build + launch the desktop app
npm run dist:win   # package a portable Windows .exe into release/
```

## Layout

```
src/
  main.js          renderer, camera director, night arc, events, walk mode, talk system
  club.js          all room geometry, lighting rigs, light-show programs
  agent.js         the residents: bodies, animation, needs, decision-making, states
  personalities.js the cast — traits, politics, dialogue, merch, boosters
  social.js        relationship graph, clique detection, rumour mill
  audio.js         procedural music engine (8 genres) + beat clock
  brain.js         optional in-browser LLM
  layout.js        floor plan, routing between rooms/floors, collision
  gamepad.js       controller mapping
  ui.js            HUD, roster, profile cards, relationship graph
electron/
  main.cjs         desktop shell
```
