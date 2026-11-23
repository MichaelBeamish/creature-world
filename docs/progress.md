# Progress Log

Newest first. One entry per verified task or significant decision.

## 2026-11-23 — Task #42: Small-screen layout ✅
- Phones and small windows (shorter side < 600 px, *new* `SCREEN` / `isSmallScreen` in `scenery.ts`) get a scaled-down
  scene, easing smoothly towards 390 px: creatures 0.65–1 × size (fixed at spawn; *new* `Creature.sizeRank` keeps
  their voice pitch), ball / ducks / disco ball 0.8–1 × (*new* `toyRadius`, `discoRadius`); the disco ball floats to
  the upper-left corner; nothing in the chest's corner (rocks, shells, seaweed and its neon skipped at draw time,
  *new* `underChest` / `chestCovers`); extra neon clumps spread over the open sand by width (*new* `neonClumpCount`);
  creatures dim with the party (*new* `partyDarken`). Added at review: the chest is solid for toys — its sides are
  walls, so the big ball bounces off instead of climbing over; toys from above land on the lid.
- **Verified:** all five checks (388 tests, 13 new); one existing test changed deliberately (the crowded 520×360
  window now needs 9 creatures to start overlapping); owner checked on desktop and phone, standalone and in the
  portfolio iframe: "verified".
- **Learned:** breakpoint + interpolation instead of device detection; judging by the shorter side makes portrait and
  landscape agree; circle-vs-box collision, plus a game-feel tweak (walls) where the physics alone let the ball climb
  the corner — the phone-size test caught it, the desktop one didn't.

## 2026-11-23 — Task #41: Show the app as "The Ink Tank" ✅
- The portfolio (michaelbeamish.github.io) embeds the live app as "The Ink Tank", so visitors now see that name:
  `index.html` `<title>` and `og:title`, and the console seed message (`[The Ink Tank] seed …`). The repo,
  `package.json` name, `/creature-world/` URL and project name stay "Creature World"; README gets one line linking the
  portfolio. Added #42 (small-screen layout) to the backlog.
- **Verified:** all five checks (Prettier collapsed the now-shorter `console.info` onto one line); the dev server
  serves the new title and `og:title`; owner checked it standalone and inside the portfolio iframe: "looks good".
- **Learned:** `<title>` (tab, bookmarks) and `og:title` (link previews) are separate; social sites cache previews,
  so already-shared links may show the old name for a while.

## 2026-11-22 — Task #40: Public deploy — live on GitHub Pages ✅
- **Live:** https://michaelbeamish.github.io/creature-world/ — *new* `.github/workflows/deploy.yml` runs the same five
  checks as CI on every push to `main`, then builds and publishes with GitHub's Pages actions; Pages is set to
  publish from Actions. Only merged, checked code goes live — the owner's merge is the release button (ADR 0005).
- Vite `base` `/creature-world/` for the build **and** `pnpm preview` (found by testing: preview counts as "serve",
  so it first served at `/` and the JS 404'd); dev stays at `/`. README: "Play it live" link + Deploy badge;
  `og:url`; code map: project files.
- **Verified:** the production build on the sub-path locally (no errors, no failed requests; `?seed=`, `?debug`
  at 120 FPS); the first Deploy run green; the live site in Chrome — normal and `?debug` clean, and a full party
  (ball out, everyone notices, nudge → sound on, music with no errors). Owner: "looks great".
- **Learned:** test the exact production artifact on its real path before going live; continuous deployment gated by
  the same checks as CI.

## 2026-11-22 — Task #39: A bigger soccer ball, up to 3 ducks ✅
- The last MVP tweak before deploying: the soccer ball is ~2.3× bigger in the water (`TOY.radius.ball` 14 → 32 px;
  the chest icon stays chest-sized); up to 3 rubber ducks out at once, like the shrimp (*new* `PROPS.maxDucks`; a duck
  in the hand counts). Play measures "behind the toy" from its edge, so there's room to get behind the big ball.
- **Verified:** 375 tests (+3): the duck cap, the ball once, its size; the ball-hit test re-placed for the bigger
  ball (and the hitter removed after its hit — it kept coming back to the easier-to-reach ball). Chrome: ball + four
  duck drags → a big ball on the sand, exactly three ducks, icons unchanged. Owner: "verified". All five checks pass.
- **Learned:** sizes leak into behavior (aim points, contact) — measure from edges, not centers.

## 2026-11-22 — Task #38: Cheer up the Grumpy — the rose ✅
- Give the Grumpy the **rose** and he comes round: a ~5.5 s moment in world data (*new* `simulation/cheerUp.ts`,
  `creature.cheerUp`) — sceptical (freezes, a suspicious tilt, "?", still flushed; he doesn't shake it off) → perks up
  (the flush drains, a hop and stretch, "!") → hearts (a burst of hearts and one soft glow, drawn by
  `drawCheerUps`) — where he *becomes* a Friendly: archetype + trait dials switch, his color and energy kept. Since
  every behavior reads the dials, he then acts exactly like a Friendly (voice, fetch, dancing, keeps what he wears).
- **Verified:** 373 tests (+8): the trigger, the phases and emotes, no shaking off, the switch, Friendly afterwards,
  the rose does nothing to others, other items still shaken off; the moves (tilt, hop, reduced motion). Chrome: a
  real scene in each phase. Owner: "perfect. works super well. verified." All five checks pass; docs updated.
- **Learned:** behavior from data, not identity — one data change turns a Grumpy into a Friendly.

## 2026-11-22 — Task #37: Casting — one Grumpy, one Friendly ✅
- "Two grumpies is too much": `dealArchetypes` now deals the four personalities first (shuffled), then extras from a
  *new* `EXTRA_DECK` of Peeker + Scaredy. The pool of 5: one of each plus an extra Peeker or Scaredy — never two
  Grumpies or two Friendlies.
- **Verified:** 300 seeds × 1–6 creatures (at most one Grumpy and one Friendly, ≤ 2 Peekers / Scaredies, all four
  with 4+), the 5th is always a Peeker or Scaredy (both occur). No seed-dependent test shifted; a given `?seed=` with
  5 creatures now makes a different pool than before. Owner: "verified". All five checks pass; docs updated (README
  status line refreshed too).
- **Learned:** build constraints into how things are created, instead of patching them afterwards.

## 2026-11-22 — Task #32d: Party — dancing ✅ (the party, #32, is complete)
- **A mind layer after food** (*new* `simulation/dance.ts`): with the party on, calm creatures `dance` and the
  Grumpy `sulk`s — styles by trait dials: bounce (Friendly: the floor under the ball, big hops, a spin every 8 bars
  in the drops), sway (Peeker: edges closer over the song), shy (Scaredy: braver — closer, bigger — over a minute),
  sulk (Grumpy: the bottom-right corner, 💢 now and then, a secret toe-tap on the beat). Everyone notices the party
  (♥ ? ! 💢, staggered); chirps come on cues (more in the drops); dancers puff bubbles on the beat in the drops; a held
  glow stick waves. Held / chased / dizzy, a fright and food still come first.
- **Follows the song:** how hard they dance comes from `partyMoment` energy — small in the builds, all-out in the
  drops. The moves are a pure `danceMoves(style, amount, beats)` (*new* `render/dance.ts`) drawn in the local frame.
- **Fixed:** the neon seaweed drew in front of the creatures → the party drawing is split into a backdrop (dimming +
  neon reef, behind) and the lights (in front); the dancers are no longer dimmed.
- **Owner feedback:** a Scaredy danced too close to the disco ball (not reproduced) → timid dancers keep
  `DANCE.ballClear` from the ball, tested. Backlog: #37 casting (one Grumpy, one Friendly; Peekers/Scaredies may
  repeat); #38 a cheered-up Grumpy may become a Friendly.
- **Verified:** 364 tests (+15): styles, noticing, the Grumpy's corner, build vs drop, bravery, ball clearance, the
  party ending, priorities, beat bubbles, the moves (hops on the beat, spin, tap, reduced motion). Chrome screenshots in
  build and drop. Owner: "verified". All five checks pass; docs updated.
- **Learned:** split *what* (simulation: where, how hard) from *how it looks* (a pure move function on the beat).

## 2026-11-22 — Task #32c: Party — neon reef + lights that follow the music ✅
- **"Where we are in the song"** in one place: the party song's map moved into `simulation/party.ts`
  (`PARTY_SONG_MAP`, also read by the music) with `momentAt` / `partyMoment` — section, energy (each section eases
  in from the last over a bar) and a beat pulse — for the lights now and the dancing next.
- **Lights follow the music:** calm intro; builds rise smoothly (no strobing with the snare roll); drops pulse on
  every beat, beams swing to the beat, spots swirl faster; soft breakdown. **Rays** shoot out of the disco ball,
  turning as it spins, reaching further with the energy.
- **Neon reef:** seaweed glows neon and sways on the beat (the floor shares its strand geometry, `seaweedStrand`,
  so the neon layer traces it exactly, on top of the dimming); 12 extra clumps grow in over ~8 s and shrink away
  after; shells get colored halos and twinkling glints.
- **Light safety, tested across the whole song:** flashes counted the WCAG way (≥ 10% up and down) in every
  1-second window — beat glow ≈ 2/s, spots within the limit too; reduced motion: no pulses.
- **Bugs found by tests:** section energy stepped between frames (→ crossfade from the previous section's end); a
  reduced-motion test measured the wrong thing (→ "barely changes within a beat").
- **Verified:** 349 tests (+8). Chrome screenshots in intro, build and drop. Owner: "soooooo gooooood" — verified.
  All five checks pass; docs updated. FPS not measured (headless isn't representative) — the owner can check with D.
- **Learned:** one source of truth for timing; accessibility rules as tests; cheap additive strokes instead of
  canvas blur for glows.
- **Backlog:** #37 only ever one Grumpy; #38 cheer up the Grumpy (brainstorm a special gift).

## 2026-11-22 — Task #32b: Party — music ✅
- **Original deep house, synthesized live** (no audio files, nothing copied): *new* `audio/music.ts` holds the songs
  as pure data; *new* `audio/musicPlayer.ts` plays them — kick, clap, snare, hats, shaker, rim, growl bass, sub,
  wobble bass, stabs, pads, sweep, riser, impact — with a look-ahead scheduler pinned to the party's beat clock
  (126 BPM) and a sidechain pump. Music fades with the party and plays only with sound on.
- **Songs:** "Tide Pool Groove" (a 4-bar loop), "Deep End" (builds and drops), and the party song **"Deep End
  (Extended)"** — every section doubled, 16-bar drops that evolve halfway (~2 min, loops back to the first build).
- **Extras:** a "🔈 Turn on sound for the music" nudge when the party starts muted (*new* `SoundNudge.vue`); chirps
  wait for the next half-beat during the party (the song's A minor shares the chirps' pentatonic notes).
- **Owner feedback rounds:** deep, bass-heavy house in the style of the artists named (style only); keep the first
  song and add one with more bass, builds and drops; skipping tracks by re-dropping the ball didn't feel right → one
  song, the drops made longer via a copy ("don't want to risk losing this"); a track picker (iPod) is #36.
- **Bugs found by tests:** the shaker played through the "silent" beat before a drop. Browser-script lessons: grab
  the ball only after it has risen; a unit test proved the game was fine when the script wasn't.
- **Verified:** 341 tests (+25): patterns, swing, key, arrangement, builds and silent beats, drops, loops, chirp
  timing, the party song. Real Chrome: nudge → unmute → music through intro, build and drop with no errors. Owner,
  by ear: "a lot better thank you. verified." All five checks pass; docs updated.
- **Learned:** "two clocks" scheduling for web audio; songs as data (a new song is data, not audio code); copy-then-
  edit to protect something that works; sidechain pumping.

## 2026-11-22 — Task #32a: Party — disco ball + lights ✅
- **Plan:** the party (#32) is split into four steps, each its own PR: 32a disco ball + lights, 32b music, 32c neon
  reef, 32d dancing. All four of Claude's extra ideas approved (beat bubbles, the Grumpy's secret toe-tap, a "turn on
  sound" nudge, chirps in the music's key).
- **Disco ball:** one more chest item (last page, one at a time). Let go in the water, it floats slowly straight up and
  eases to a stop just below the surface, then hangs there spinning (mirror tiles slide round, soft glints).
- **Party:** *new* `simulation/party.ts` — on while the ball is out (in the water or carried), a fade `level`, and
  **one beat clock** (`beatsAt`, 124 BPM) for lights, music and dancing. *New* `render/party.ts`: the pool dims, four
  soft colored beams sweep, mirror-ball spots scatter across the scene — drawn additively; the ball on top.
- **Light safety:** no strobes; every light changes smoothly at under 1/s (`LIGHTS.maxFlashHz`), and a test counts
  brightness peaks to prove < 3/s (WCAG 2.3.1). Reduced motion: beams and spots hold still.
- **Owner feedback:** the ball 1.5× bigger (r 45) and hanging higher; light spots made bigger, brighter, more of them.
- **Verified:** 316 tests (+7): rise + hang + spin, one ball, party on/off + fades, stays on while carried, the beat
  clock, light safety. Real drag in Chrome. Owner: "awesome. verified." All five checks pass; docs updated.
- **Learned:** one master clock keeps music and visuals in sync; additive blending makes light add up like light;
  scripted drags need a pause after the press so the next frame sees it at the press point.

## 2026-11-22 — Task #35: Fix — kandi cuffs in front of the beard ✅
- Kandi cuffs were drawn after the worn items, so they floated over a beard. Draw order is now cuffs → worn items
  (beard, hats, glasses) → held item, so cuffs sit on the tentacles but behind the beard.
- **Verified:** a beard + cuffs + glow stick creature drawn in Chrome; owner: "verified". All five checks pass
  (309 tests).
- **Learned:** painter's algorithm again — layering is purely draw order.

## 2026-11-22 — Task #34: Chest navigation ✅
- The one-way ↻ circle took forever to reach page 10. Now two side-by-side **‹ ›** circles page both ways (wrapping),
  and the **page dots are pressable** to jump straight to a page (bigger: r 4, gap 14; a forgiving 7 px hit area).
  The dot row starts under ‹ (centered, it ran into the chest lid). Pointer cursor over both; dropping a carried item
  on them puts it back in the chest.
- `slotAt` returns 'prev' / 'next'; new `pageDotAt`, `goToPage`, `arrowPosition`, `pageDotPosition`;
  `turnPage(world, step)`.
- **Verified:** 309 tests (+2 net): arrows both ways with wrapping, dot jumps, misses, closed chest, drop on dots.
  Real clicks in Chrome (dot 9 → page 9, ‹ → page 8). Owner: "perfect verified". All five checks pass; docs updated.
- **Learned:** a control's hit area needn't match its drawing — invisible padding makes small targets easy to hit.

## 2026-11-22 — Task #33: Held items ✅
- **Two new spots:** `hand`, a **raised arm** (the rightmost tentacle lifts up and out) holding one of 8 items:
  glow stick (neon glow), pirate cutlass, soda can (straw + fizz), magic wand (sparkling star), balloon, rose, tiny
  trident; and `cuffs`, kandi bead bands on a few tentacles, so cuffs + a held item combine. 3 new chest pages (10).
- `drawTentacles` now **returns its Bézier curves**: the held item sits at the raised tip, rotated to the curve's
  tangent; beads are placed along curves. The simulation estimates the tip (`HAND`) for pressing/taking it back.
- **Owner feedback rounds:** the corn cob (bubble) pipe was built, then dropped; a let-go balloon is drawn full size
  and **floats up off the screen** (back in the chest); **creatures pick up dropped items by personality** — a new mind
  layer after food and play (`chooseCollect`): Friendly goes straight for it (♥), Peeker waits for the hand to move
  away, Scaredy only when nobody's near, Grumpy never; only into a free spot (no hat-stealing loops). The holding arm
  trails with the motion (it was stiff), and a held balloon lags behind on its string and always floats world-up.
- **Verified:** 307 tests (+8 net): hand + cuffs combine, take a held item back, Grumpy shakes held items off, balloon
  floats away, pick-up by personality and the free-spot rule. Galleries (static and mid-swim) and chest pages in real
  Chrome. Owner: "perfect. thank you. verified." All five checks pass; code map, overview, README updated.
- **Learned:** return geometry from a draw pass instead of recomputing it elsewhere; pick the right coordinate space
  per attachment (a hat turns with the body, a balloon obeys world gravity); new behaviours as mind layers keep the
  existing ones untouched.

## 2026-11-22 — Task #30: Dress-up + inventory pages ✅
- **Chest pages:** 3 items per page plus a ↻ circle (wrapping) and page dots — the inventory can grow without the arc
  growing (`CHEST_PAGES`; 7 pages: food & toys, then dress-up).
- **18 wearables**, one per spot (`creature.dress`: head / eyes / face; two-spot items take eyes + face): wizard hat,
  cowboy hat, buccaneer (pirate) hat, party hat, propeller beanie (spins with speed), bouffant wig, tiara, LED cat ears
  (glow), mouse ears, star glasses, heart glasses, neon shutter shades (glow), monocle, see-through snorkel mask, nose
  glasses, clown nose + blue eyeshadow, rainbow clown wig ("a colorful baby bonnet" — owner: don't change it), fluffy
  white beard. Drawn in `drawCreature`'s local frame, so they follow every pose.
- Drop on a creature to wear (swaps the spot); press a worn item to take it off; fallen items sink and can be picked up
  again; after 5 s on the sand they blink for 3 s and return to the chest; at most 3 of each out. **Only the Grumpy
  minds:** it shakes items off one at a time (💢). Press order: chest circles → worn items → toys → creatures.
- **Owner feedback rounds:** pick up fallen items; shorter stay + longer blink; buccaneer hat; hats/wigs sit lower;
  beanie and plain mustache removed; see-through snorkel; white beard; bigger wig; thicker nose-glasses mustache;
  added heart glasses, tiara, clown nose, rave gear, mouse ears (replaced a glowing bucket hat that didn't read), and a
  clown wig (redrawn from separate puffs into one curly rainbow afro); wig icons fit their circles; the snorkel's tube
  is drawn over hats. Held items (kandi cuffs, glow stick, cutlass, bubble pipe, soda, wand, balloon, rose, trident)
  split into **#33**, which absorbs #31.
- **Bugs found:** the clown nose drew twice (a two-spot rule keyed to one item's name → now "the same item fills both
  spots"); a test looped "until a short page" and hung once every page was full (→ bounded loop; test runs now have a
  timeout); my first browser script swapped items off and they auto-returned before the screenshot (→ a gallery drawn
  by the real modules instead).
- **Verified:** 299 tests (+16 net): pages and ↻, wearing/swapping/two-spot items, take off and move, cap, auto-return,
  pick up fallen items, Grumpy shakes everything off, others keep theirs. Galleries of every item and combos in real
  Chrome; chest pages screenshotted. Owner: "amazing. verified". All five checks pass; docs updated.
- **Learned:** write rules in terms of the data, not item names; never loop "until" something that might not happen
  (and put a timeout on test runs); draw order is the painter's algorithm — drive it with data.

## 2026-11-22 — Task #29: Toys — rubber duck + soccer ball ✅
- **Toys in the chest:** the duck and the ball join the shrimp in the chest's arc; each exists once (its slot greys
  out while it's in the pool); toys can be picked up in the water and moved or dropped back on the chest (press order:
  slots → toys → creatures).
- **Physics** (`props.ts`): the duck has **neutral buoyancy** (stays at its depth, drifts to a stop); the ball sinks,
  bounces with restitution, rolls with friction, and **pops up when hit**; both spin, stay in the pool, and a gentle
  **edge current** eases them out of corners (creatures keep a margin from walls, so cornered toys were unreachable).
- **Play** (*new* `play.ts`, a mind layer after food, intent `play`), by trait dials: the Friendly plays **fetch**
  toward the hand (♥ on delivery), the Peeker **nudges** (`?`) and backs off, the Grumpy **swats** toys that come close
  (💢; a swatted ball flies), the Scaredy plays **shyly** — only when nobody's watching — otherwise keeps away and
  flinches at hard landings. Sessions ~12 s, then bored ~6 s; food beats play. A soft **duck squeak** on a bump
  (≤ every 0.6 s, the same for everyone).
- Pushing is **emergent from contact** (`resolveToyContacts`): any creature body touching a toy pushes it; fetch is
  "kick from behind" steering. Timestamps (squeak, swat) live in world data, not module state.
- **Owner feedback → changes:** duck neutral buoyancy (was a spring to the surface); livelier ball that flies up;
  no stuck corners (edge current); more interest (Scaredy plays shyly; boredom 12 → 6 s).
- **Verified:** 283 tests (+19): duck depth/drift, ball bounce/settle/pop-up, walls and corners, contact push,
  fetch/nudge/swat/shy/avoid scenarios, boredom, food beats play, chest each-toy-once and pick-up-from-water, duck
  squeak voice. Real-Chrome run (open chest with three items, duck and ball in the pool, Peeker nudging). Owner: "love
  it. verified". All five checks pass; code map, overview, README updated.
- **Learned:** contact physics + a simple steering trick gives believable play without scripting each personality's
  pushes; keep per-object timers in the world's data so determinism tests and debugging see everything.

## 2026-11-22 — Task #28: Treasure chest + shrimp (feeding) ✅
- **The chest:** a sunken wooden chest (brass, moss, barnacles) on the sand, bottom-left; the mute button moved to the
  bottom-right. Open (click / tap / Tab + Enter): the lid stands up with a golden glow and the items float into slots
  above it. An invisible but real `<button>` (`ChestToggle.vue`) lies exactly over the canvas drawing (accessible).
- **Props** (`props.ts`): drag an item from its slot (checked before creatures) into the water; dropped on the chest it
  goes back. A shrimp sinks with a drift and rests on the sand; at most 3 in the water (the slot greys out).
- **Feeding** (`feeding.ts`, a layer in the mind, only when calm; new intents `eat`, `guard`), by trait dials: the
  Friendly races, the Peeker sneaks in while the hand is away, the Scaredy waits for the hand to leave and creeps in,
  the Grumpy guards (💢, others keep off) then eats. Eating: "nom-nom", ♥, squish.
- Scenery keeps the chest corner clear (`SCENERY.chestClear`; floor layouts shift slightly for existing seeds).
- **Found by tracing before testing:** nobody could reach a shrimp on the sand (→ eat with stretched tentacles,
  `inReach`); approaches too slow (→ higher feeding speeds); a Scaredy lost interest beyond 600 px (→ food noticed
  pool-wide). Browser: the open lid didn't read as open (→ the lid's inside stands up behind the chest).
- **Verified:** 264 tests (+16): chest, slots, carrying, cap, sinking/resting, 300-seed clear corner; feeding styles
  and scenarios per archetype; eating effects; scared creatures ignore food. Real-Chrome run of the full flow.
  Owner: "absolutely perfect". All five checks pass; code map, overview, README updated.
- **Learned:** canvas UI can stay accessible with a real button overlay; tracing scenarios before writing tests
  surfaces behaviour bugs that unit tests written from the spec would have encoded.

## 2026-11-22 — Decision: treasure chest milestone (#28–#32) replaces feeding (#22)
- Owner didn't want food to appear wherever you click empty water. Instead: a **treasure chest** on the sand in the
  bottom-left (the mute button moves to the bottom-right); click to open, items float out, **drag** them into the
  pool or onto a creature.
- Items: **shrimp** (the only food), a **rubber duck** and a **soccer ball**, **dress-up** (hats, sunglasses, fake
  beards), **glow sticks** (creatures hold them), and a **disco ball + club lights** party with an original
  synthesized dance groove (Austin dance-festival vibe; no copying, no festival branding) and dancing by personality.
- Guardrails: light-safe party (no strobes, ≤ 3 flashes/s, calm under reduced motion); music only when unmuted; each
  item exists once (no clutter). Order: #28 chest + shrimp → #29 toys → #30 dress-up → #31 glow sticks → #32 party.

## 2026-11-22 — Task #27: Ink reactions — Grumpy chase, Friendly dizzy ✅
- **One override above the mind:** `interactionIntent` (held > chase > dizzy) replaces the held-only special case;
  new intents `chase`, `dizzy`; trait-defined `forgives` (bold + curious) next to `standsItsGround`.
- **Grumpy gets mad:** after its cloud it chases for ~4 s with *pursuit + velocity matching* (`chaseForce`: the hand's
  velocity + a closing speed ∝ gap, capped at 650 px/s) — walking away fails, fast dodging works; it settles at
  3.2 × size and squirts small aimed puffs within 130 px, at most every 0.5 s; then the standoff + grudge.
- **Friendly forgives:** a tiny hiccup puff + "hic!", ~3 s dizzy (loops from a rotating target velocity; spiral eyes,
  orbiting stars, wobble), then a squish + ♥ and it swims back; rattled ≤ 0.1, trust kept.
- **Jet swimming** (renderer, any fast creature): head first (`swimAngle`), bundled streaming tentacles, rhythmic
  strokes with a body squeeze (`propulsion`, `JET`). Up close a chasing Grumpy *turns and fires* (`aimAtHand`, by
  distance — no flicker): tentacles toward the hand, fitted to end just short of the cursor, squirts from the tips,
  drawn in front of its own ink.
- **Owner feedback → changes:** chase much faster; tentacles should propel it; ink looked like it came from its head
  (→ turn and fire); tentacles went still while firing (→ strokes while aimed); stopped on the cursor (→ pursuit +
  stop distance + fitted tentacles); ink sound sounded like a snare → a low "poof" was inaudible on laptop speakers →
  **owner decision: ink is silent**; the creatures' own voices carry the moment (noise synth removed).
- Also: #24 (pop bubbles) **dropped** by the owner (bubbles are small and pop on their own); #27 moved ahead of #22.
- **Verified:** 248 tests (+14 net) — chase cadence, caught when walking away, top speed, dodge distance, stop
  distance, early end; Friendly hiccup/dizzy/loop/♥/return; aim blend and muzzle; jet helpers; silent ink.
  Browser screenshots across seven seeds (chase, turn-and-fire, dizzy). All five checks pass; docs updated.
- **Learned:** I misremembered a constant (tentacles are 2.9 × size, not 1.2) — the screenshot caught it; fitting
  visuals to measured geometry beats tuning constants. Pursuit needs the target's velocity (feed-forward), or a fast
  chaser lags a moving target and overshoots a still one.

## 2026-11-22 — Task #21: Shake → ink ✅
- **Shake detection:** while held, the hand's *speed jolts* (how sharply its speed changes; smoothed twice, so
  mouse-event jitter doesn't count) fill a **leaky bucket** of stress with a capped fill rate (only sustained shaking
  counts; a flick never does). Steady-speed swirls and sweeps score ~0. Limit = base + boldness + boldness × curiosity:
  normal trackpad shake → Scaredy ≈ 1.0 s, Peeker 1.4 s, Grumpy 1.9 s; Friendly ≈ 2.9 s (patient).
- **Warning tell** near the limit: tremble (off under reduced motion), darker flush, faster squeaks.
- **Ink:** *new* `simulation/ink.ts` — a second pooled particle system (72 slots, analytic motion, own random stream),
  aimed toward the hand like a smoke screen; *new* `render/ink.ts` (deep indigo, owner's choice), ~2× creature-cloud
  size, 4–6 s. *pfft* = new synth capability: white-noise buffer → downward band-pass sweep (`puffFor`).
- **Escape:** the hold ends (fresh press needed), a short **jet** above the normal speed limit, `!`, then flee/hide.
  The **Grumpy** (bold + incurious → `standsItsGround`) instead recoils, squirts again straight at the hand (💢) and
  glares in a standoff for ~14 s (owner's choice).
- **Rattled** (*new* `Perception.rattled`, ~30 s, owner's choice): caps trust at 1 − rattled, dampens curiosity
  (`EMOTION.rattledDamp`) and keeps a Grumpy grumpy (`EMOTION.grudge`). Shown in the debug panel.
- **Owner feedback → changes:** cloud too small (→ ~2×); too hard to trigger on a trackpad (→ speed-jolt detector,
  recalibrated on measured hand paths; Friendly unchanged); Grumpy should do more (→ double squirt + grudge).
  Also found by tests/browser: a single flick inked (→ capped fill rate); trust alone didn't keep a Friendly away
  (→ curiosity damping); tiny cloud and sluggish escape in the browser (→ bigger cloud, jet).
- **Verified:** 237 tests (+20): ink pool/motion/aim/determinism; wiggle/swirl/sweep/flick never ink; trackpad and
  hard-shake timings by archetype; warning; escape, jet, Grumpy double squirt + grudge; rattled trust cap and slower
  Friendly return; puff design. Scripted shakes in headless Chrome. All five checks pass; code map, overview, README.
- **Learned:** choose the signal that *separates* the cases (speed jolts vs acceleration) and calibrate from measured
  inputs; a test that compares float times with `==` can silently skip its assertion.

## 2026-11-22 — Task #20: Boop + drag with struggle ✅
- **Boop** (quick click/tap): squash spring + blink + emote by personality (♥ ? ! 💢), timid ones scoot away.
  **Grab** (press and hold, head *or* tentacle — owner's choice): the creature hangs from the grab point on a damped
  spring; a grabbed tentacle stretches to the hand, the others dangle and trail (trail length capped).
- New `simulation/interaction.ts`: hit-testing from `BODY` proportions (simulation can't import render geometry),
  boop-vs-hold by time/movement, press/release edges in presence, latched quick clicks, pointer capture.
- **Layered "held" state** (first real use of ADR 0004's layering): intent `held` overrides the action while emotions
  keep updating; holding = full attention + pressure, so the existing grid yields the feelings (no new rules).
- **Struggle** (owner: tug + wriggle): a pull *offset* on the spring target — rhythmic yanks in a drifting direction,
  scaled by fear/grumpiness beyond a calm dead zone × energy, eased by curiosity. Measured peaks: Friendly ≈0,
  Peeker 12–16 px, Grumpy 21–31 px, Scaredy 23–28 px; always inside the 50 px tether. Squeaks while struggling.
- **Owner feel feedback → changes:** (1) bumped creatures moved unnaturally → `CONSTRAINTS.shoveSpeed` (180 px/s):
  the rest of the overlap blocks the held creature (replaced a "heavy held creature" workaround); (2) "light speed"
  after being unblocked → `INTERACTION.maxHeldSpeed` (1200 px/s) caps velocity *and* the tether catch-up;
  (3) creatures wiggled but didn't pull → the old struggle force only displaced ~5 px against the spring; replaced by
  the pull offset above.
- Sounds (grab "eep", struggle squeak, boop "bip") recorded as simulation events, voiced in each creature's voice.
  Cursor `grab`/`grabbing`. Reduced motion: new `squash` setting. Vision principle 2 updated to gentle play.
- **Verified:** 217 tests (+26), incl. hit-testing, boop/grab, tether/shove/blocking/top speed, per-archetype pull and
  emotions, release reactions, determinism with scripted presses; scripted boop + drag in headless Chrome (found
  the tentacle-streak bug). All five checks pass; code map, overview, README updated.
- **Learned:** a test can pass while the feature is invisible ("Scaredy tugs more than Friendly" held at ~5 px) —
  assert *visible* magnitudes for feel features; real-browser and owner feel checks caught three issues tests missed.

## 2026-11-22 — Decision: interaction milestone (#20–#26), prioritized
- Owner wants visitors to interact more: drag creatures (they struggle and make noise), shake → ink squirt, plus
  feeding, petting, popping bubbles, names + personality card, and moving shells — "all of them", before #19 and the
  deploy.
- Shifts vision principle 2 ("noticed, not controlled") toward gentle play; to be updated in vision.md as part of
  task #20. Guardrails: soft, no damage, creatures always recover, gentle consequences (lower trust).
- Sequencing: #20 boop + drag → #21 shake → ink → #22 feeding → #23 petting → #24 pop bubbles → #25 names/card →
  #26 move shells → #19 sound nudge → deploy.

## 2026-11-22 — Task #18: Tentacle root corner ✅
- **Owner observation:** a corner of an outer tentacle's root was sometimes visible outside the body.
- **Measured cause:** roots ended in a flat edge (only tips were rounded), and at the body's smallest (scared shrink +
  breathing low point) the outer root *center* (±0.75, 0.75 × size) was already outside the ellipse (≈ 1.08; the
  whole flat end reached ≈ 1.49).
- **Done:** rounded root cap (owner's idea) via a pure `tentacleOutline`; outer roots tucked to ±0.55 × size and
  `BODY.tentacleRootY` 0.75 → 0.6 (computed as the widest spread keeping the whole cap inside the smallest body);
  body size formula extracted to `mantleRadii` (shared by drawing and test).
- **Verified:** first renderer unit test (`src/render/drawCreature.test.ts`): every root-cap point inside the smallest
  body for 3 sizes × 5–8 tentacles — would have failed on the old code; caps rounded at both ends. Before/after
  close-ups (12 worst-case poses) from a temporary harness page (deleted). 188/188 tests; code map updated.
- **Learned / notes:** measure the geometry before tuning by eye; extract pure functions to make drawing testable;
  a regression test should be shown to fail on the old code; delete tests that can't fail.
- **Next:** task #19 ("hear them?" sound nudge) or deploy (roadmap #1).

## 2026-11-21 — Task #16: Bubbles ✅
- **Done:** `simulation/bubbles.ts` — a particle system: fixed 64-slot ring-buffer pool (allocated once), analytic
  closed-form motion (`bubbleAt`: rise with gentle acceleration, wobble, growth, pop at the surface or end of life),
  spawned on intent edges (burst on flee/hide, trickle while darting, Grumpy huff on standoff), own random stream.
  `render/bubbles.ts` draws them (rim, highlight, pop ring); reduced motion = no wobble.
- **Owner feedback:** "might be too many bubbles" → halved: burst 2–3 (was 3–6), huff 1 (was 2), trickle every
  0.6–1.2 s (was 0.3–0.6). Owner: "yes perfect".
- **Verified:** 185/185 tests (spawn rules, trickle, analytic motion incl. surface pop, no wobble under reduced motion,
  pool identity unchanged through 30 s of constant scaring, creatures' rng untouched, full-world determinism).
  Real browser: bursts, trickle and huff visible; 1.0 ms/frame while constantly scaring. Code map, overview and README
  updated; the drift test caught the new file on creation.
- **Learned / notes:** object pooling with a ring buffer; analytic vs integrated motion (integrate when things
  interact); solving a quadratic for an event time; edge detection on state; test names should not hardcode tunable
  numbers.
- **Next:** task #18 (tentacle root corner) or deploy (roadmap #1).

## 2026-11-21 — Task #15: Sea floor ✅
- **Done:** look B "Moonlit reef" (owner's pick from a 3-style preview). `simulation/scenery.ts`: `floorHeight`,
  `swimBounds` (single source of truth for the swimmable area, used by spawning, steering, constraints and hiding),
  `createScenery` (rocks/shells/seaweed as data with relative positions, independent seeded stream).
  `render/floor.ts`: wavy grainy sand, mossy rocks, glowing shells, swaying seaweed (still under reduced motion).
- **Owner feedback round:** rocks too big → 18–34 px; moss "obviously a stretched oval" → small irregular patches on
  the rock's real top edge, clipped to its outline; shells half-hidden behind rocks → shells keep clear of rocks at
  generation time (skipped rather than placed badly; never below 2 shells in 500 worlds). Owner: "night and day
  difference".
- **Verified:** 174/174 tests — floor clamping, swim area, determinism, relative positions, scenery uses none of the
  creatures' randomness, shells clear of rocks across 500 seeds, rock size; movement/personality invariants now check
  nobody sinks into the sand every step. Real browser: seaweed sways / holds still under reduced motion; 0.8 ms/frame.
  Code map + README + overview updated; the drift test caught the new file on creation.
- **Learned / notes:** single source of truth (`swimBounds`); independent random streams; relative layout
  coordinates; clipping decoration to a shape (`ctx.clip(path2D)`); fix placement in data, not in drawing; turn a
  "best effort" into a guarantee when the rule matters (skip instead of near-miss).
- **Next:** task #16 (bubbles).

## 2026-11-21 — Task #17: Code map + drift check ✅
- **Done:** `docs/architecture/code-map.md` — conventions, every source file per folder (purpose + exports, taken
  from the code), a 42-row "to change X, edit Y" knob table, 5 recipes (archetype, emote, stimulus, knob, file).
  `src/codeMap.test.ts` drift test (Vite `import.meta.glob` + `?raw`, no new deps). Workflow: code map in CLAUDE.md
  "Read first" + rule 7 "Verify before you reference"; `/plan-task` lists exact, confirmed symbols; `/verify-task`
  checks the code map with the README; README and overview link it.
- **Verified:** 165/165 tests; the drift test fails on an unmapped file, a stale entry, and made-up knobs
  (`MOVEMENT.topSpeed`, `MAIN_VOLUME`) — each shown on purpose, then reverted. Owner: "looks good".
- **Learned / notes:** documentation as a CI-tested artifact; compiler + drift test cover made-up references in code
  and docs; `import.meta.glob` excludes the calling module itself.
- **Next:** task #15 (sea floor).

## 2026-11-21 — Task #12: MVP polish + success-criteria review ✅ — MVP achieved
- **Done:** reduced motion (`render/motion.ts`, live `app/reducedMotion.ts`: decorative motion toned down, background
  still, behavior unchanged); living background (`render/background.ts`: caustics, stateless floating motes, vignette);
  `FirstVisitHint.vue` (fades on first interaction; touch wording); share-ready page meta (description, theme color,
  Open Graph); `README.md` for the public repo. Sea floor and bubbles split out into tasks #15/#16; roadmap #10 added.
- **Verified:** 162/162 tests. Real browser: hint shows then is removed after the first move; background animates but
  holds still when reduce-motion is toggled on live; touch taps raise attention 2% → 78%; frame cost 0.6 ms.
- **Bug caught:** the hint never disappeared — Vue `<Transition>` waited for the longer CSS *animation* (fade-in,
  already ended) instead of the fade-out *transition*; fixed with `type="transition"`.

### MVP success-criteria review ("The Tide Pool", `docs/product/mvp.md`)
| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Calm idle life for 60 s: no freezing, overlap, or leaving the screen | ✅ | `movement.test.ts` — 60 s × 5 seeds checked every step; everyone wanders and rests (task #6) |
| 2 | Visible reaction within 1 s of the cursor nearby | ✅ | `expression.test.ts` — "MVP success criterion #2", all four archetypes (task #9) |
| 3 | Same input + seed: Scaredy ends farther than Friendly; flick → Grumpy holds, Scaredy flees | ✅ | `personality.test.ts` — ≈160 vs ≈80 px; Grumpy < 25 px, Scaredy > 60 px (task #8) |
| 4 | ~60 FPS with 5 creatures (≥ 55) | ✅ | Owner's laptop: 120 FPS (task #10); 0.6 ms work per frame with the new background |
| 5 | Unit tests; lint, type-check, tests pass | ✅ | 162 tests in 23 files; CI on Node 22 + LTS green on every PR |
| 6 | First-time viewer tells creatures apart (informal, 1–2 people) | ⏸ deferred | Owner's decision: run it if it comes up naturally. Related observation (task #9): personalities show mainly when reacting |

- **Learned / notes:** reduced motion reduces *decoration*, not content; stateless particles; Open Graph for link
  previews; the README as the repo's front page; Vue `<Transition type>` with mixed animation/transition.
- **Next:** task #15 (sea floor), then #16 (bubbles); deploy (roadmap #1).

## 2026-11-21 — Task #11: Sound + mute toggle ✅
- **Done:** `src/audio/` output layer — `voice.ts` (pure `chirpFor`: pentatonic pitch from size + per-creature detune,
  timbre from archetype, contour from emote; `panFor`), `soundEvents.ts` (new-emote watcher), `synth.ts` (Web Audio:
  oscillator + vibrato LFO → low-pass → envelope → stereo pan → master 0.15; ≤ 4 voices; lazy AudioContext).
  `MuteToggle.vue`: accessible button, always starts muted, preference not stored.
- **Verified:** 155/155 tests (distinct voice per creature, determinism, bigger = lower, timbre/contour per archetype
  and emote, gentle ranges over 320 combinations, panning, watcher once-only and read-only). Real browser: 0
  AudioContexts while muted (even during a flick); 1 running context after the click; chirps played after unmuting.
  Owner: "love it".
- **Learned / notes:** synthesis basics (oscillator, filter, envelope, LFO vibrato); autoplay policy; pentatonic
  harmony; data-driven sound (describe vs play); accessible toggle buttons.
- **Next:** task #12 (MVP polish + success-criteria review).

## 2026-11-20 — Task #10: Debug overlay ✅
- **Done:** `app/fpsMeter.ts` (rolling FPS + avg/worst frame work time); `app/debugSnapshot.ts` (world → plain
  snapshot + 200 ms publisher); `app/DebugPanel.vue` (display-only, collapsible); `frame(now, workMs)` hook in the game
  loop; `D` toggle (dev, or any build with `?debug`); `shallowRef` publishing; zero work while hidden.
- **Verified:** 144/144 tests (FPS math, rolling window, snapshot field-by-field + independence, throttle = 5/s on a
  144 Hz display). Real browser: 5.0 panel updates/s; 0.7 ms work per frame (~4% of a 60 Hz budget); overlay costs
  ~0.1 ms/frame only while visible. **MVP criterion #4 passes:** owner's laptop shows 120 FPS; `D` works.
- **Learned / notes:** bridging a high-frequency world to a reactive UI (sample + immutable snapshot, like
  `useSyncExternalStore`); `ref` vs `shallowRef`; plain mirror variables in hot loops; FPS vs frame time; stable
  `v-for` keys.
- **Next:** task #11 (sound + mute toggle).

## 2026-11-20 — Task #9: Eyes + emotes ✅
- **Done:** `simulation/expression.ts` — gaze (dart-and-hold toward the visitor, travel direction, or a glanced-at
  neighbour), emote events (? ! 💢 ♥; 1.5 s life, 2.5 s cooldown, ♥ once per visit), mood-scaled breathing/sway
  (via base rates + phase accumulation). Renderer: puff/shrink, red flush/pale, bristling fur, stretch on darts,
  gaze-following pupils, wide scared eyes, grumpy half-lid glare, blush; `render/emotes.ts` vector bubbles with an
  overshoot pop.
- **Verified:** 135/135 tests — MVP criterion #2 for all four archetypes (reaction within 1 s), emote mapping,
  lifetime, cooldown, ♥ once per visit, gaze, deterministic glances, breathing response. Real mouse, no debug: all
  four moods readable in one screenshot. Owner: "it's awesome".
- **Owner observation:** "sometimes too many of one personality, others missing". Measured: 1000/1000 worlds contain
  all four archetypes — the real cause is that personalities only show when reacting (calm creatures look alike;
  Peeker's early wariness resembles Scaredy; everyone shows `!` after a flick). Proposed "personality tells" (resting
  face + idle habits per archetype); owner chose not to add it for now.
- **Learned / notes:** events in the simulation, looks in the renderer; continuous blending from smoothed levels;
  phase accumulation paying off; saccades; easing (`easeOutBack`); vector shapes over platform-dependent emoji.
  Verify a perceived bug with data before "fixing" it.
- **Next:** task #10 (debug overlay).

## 2026-11-20 — Task #8: Traits + archetypes + mind ✅
- **Done:** `traits.ts` (archetype grid → curiosity/boldness ±0.08 + energy; dealt without replacement);
  `emotion.ts` (utility scores → attack/release levels → dominant emotion with hysteresis; fear reflex on targets);
  `mind.ts` + `mindState.ts` (`Mind` interface, `ruleMind`: emotion → intent; peek in/out; hide in the farthest
  corner; calm wander/rest rhythm); steering `arrive`/`seek`/`flee`/`brake`; intent-driven movement with personal
  speed limits; debug labels `archetype · emotion → intent`; ADR 0004.
- **Verified:** 123/123 tests — archetype grid (20 cases) at every ±0.08 variation corner, MVP criterion #3
  (Scaredy ≈ 160 px vs Friendly ≈ 80 px; flick → Grumpy holds < 25 px, Scaredy flees > 60 px), peeking, hiding,
  hysteresis, fear within one step, 30 s × 3 seeds of chasing/flicking with all invariants. Real mouse via DevTools
  reproduced the grid. No runtime import cycles. Owner play test: "looking good!".
- **Bugs caught:** fear reflex lagged (compared smoothed levels); hysteresis blocked mood changes at spawn; Grumpy fled
  in the browser while tests passed (tests used exact dials — real creatures vary; corner testing found stacked
  threats overflowing, fixed by capping threat at 1 and flinch 0.25); two import cycles (split `mindState.ts`).
- **Learned / notes:** utility AI; hysteresis; layered/subsumption architecture for a future LLM mind; test the
  corners of the input space, not just the typical value; measure before loosening a tolerance.
- **Next:** task #9 (eyes + emotes: make emotions visible).

## 2026-11-20 — Task #7: Cursor presence + perception ✅
- **Done:** `input/pointer.ts` (Pointer Events → latest sample; touch lingers 1 s; injected clock/target);
  `simulation/presence.ts` (visitor as plain data, EMA velocity computed per step); `simulation/perception.ts`
  (attention with fast attack / slow release; startle, pressure, trust → stimulus sudden > chasing > calm > none);
  `render/debugDraw.ts` (`?debug`: rings + labels + cursor speed). Creatures perceive but don't react yet (task #8).
- **Verified:** 81/81 tests (20 new: scripted cursor paths for every stimulus, attack/release timing, determinism
  with a scripted visitor, "no behavior change"); real mouse driven via DevTools showed calm while hovering and sudden
  on a 1047 px/s flick; owner confirmed the debug labels respond.
- **Learned / notes:** sampling input at the boundary (deterministic, replayable); Pointer Events + `touch-action`;
  attack/release envelopes; dependency injection for testability (fake target + clock). Lesson: say explicitly when a
  task is "perceive only" — the owner expected visible reactions; the debug view made the invisible work checkable.
- **Next:** task #8 (traits + archetypes + mind: the creatures start reacting).

## 2026-11-20 — Decision: personality archetypes + visitor stimuli
- Owner wanted creatures to act scared, curious, or angry depending on personality and what the visitor does.
- **Personality = archetype on trait dials:** `curiosity` × `boldness` grid → Peeker, Friendly, Scaredy, Grumpy;
  `energy` for intensity; `boldness` replaces `shyness`; archetypes dealt without replacement (every world has a mix).
  Anger belongs to the Grumpy personality (fight-or-flight), not to every creature.
- **Stimuli (task #7):** calm presence, sudden movement, chasing. Clicking stays on the roadmap (#9).
- Updated `mvp.md` (personality section, success criterion #3, out-of-scope) and tasks #7–9 in the backlog.

## 2026-11-20 — Task #6: Wandering + bounds + separation ✅
- **Done:** `steering.ts` (Reynolds wander / stay-in-bounds / footprint separation as pure force functions);
  `movement.ts` (wander ↔ rest activity, weighted blending, exponential drag, 35 px/s cap); `constraints.ts`
  (position-based pass: separate overlaps, clamp into bounds, cancel velocity into walls); fixed step order with
  semi-implicit Euler. Renderer: lean (≤ ~8°) and tentacle trailing from velocity.
- **Verified:** 61/61 tests — 60 s × 5 seeds checked every step (in bounds, no overlap, speed cap), everyone
  travels and rests, smooth turning, small-window overlap (75–154 px) resolved to < 0.5 px, resize back in bounds
  within one step, determinism. Real-time DevTools screenshots show movement, lean, trailing. Owner: "perfect for
  this relaxed state".
- **Learned / notes:** steering = desired − current velocity; soft forces vs hard constraints (position-based
  dynamics); exponential drag is frame-rate independent; symplectic Euler. Test lesson: a `≤` assertion hid a real
  0.02 px residue — assert what actually happens. Headless `--virtual-time-budget` doesn't advance rAF reliably;
  use real-time DevTools capture for motion.
- **Next:** task #7 (cursor presence + perception).

## 2026-11-20 — Task #5: Idle animation ✅
- **Done:** `simulation/animation.ts` — per-creature breath/sway oscillators (seeded phases and rates, phase
  accumulation with wrapping) and a blink state machine (2–6 s waits, 160 ms blinks, ~15% double blinks), stepped
  in `stepWorld`. Renderer: squash/stretch breathing, traveling-wave tentacle sway, eyelids via canvas clipping.
- **Verified:** 45/45 tests (blink coverage/duration/openness, double-blink rate over 600 s, exact phase
  accumulation incl. rate change, desync across creatures, determinism incl. animation); frames at different times
  differ; ~120 FPS headless; owner: "they move beautifully".
- **Learned / notes:** oscillators via phase accumulation (smooth rate changes) and phase wrapping (float
  precision); state machines; traveling waves from phase lag; canvas clipping. Seeds are stable within a code
  version, not across versions (new rng draws shift later spawns). Added roadmap item #9 (drag / boop / shake).
- **Next:** task #6 (wandering + bounds + separation).

## 2026-11-20 — Task #4: Draw a static creature ✅
- **Done:** style B "Little octopus" (owner picked it from a 3-style preview): tapered Bézier tentacles with
  rounded tips, light fuzz, gradient-shaded mantle, eyes with highlights. `drawScene` (pure, painter's algorithm,
  interpolated); `render/noise.ts` stateless hash for per-creature detail; shared `BODY` proportions + spawn
  `footprint`; rejection-sampled non-overlapping spawns; golden-angle hues; `?seed=` / random seed (logged).
  Deleted the temporary `demoDot.ts`.
- **Verified:** 38/38 tests (non-overlap across 6 seeds, hue spacing ≥ 30°, footprint in bounds, hash range and
  uniformity, seed parsing); same seed → byte-identical screenshots; frames 0.5 s vs 4 s identical (no flicker);
  sharp at 2× DPR; owner approved the look.
- **Known limitation:** very small windows can't fit 5 footprints, so creatures overlap at spawn → resolved by
  separation in task #6 (owner chose to defer).
- **Learned / notes:** rejection sampling with capped attempts; golden-angle color spacing; stateless noise keeps
  rendering a pure function of state; painter's algorithm.
- **Next:** task #5 (idle animation).

## 2026-11-20 — Task #14: Branch + pull-request workflow ✅
- **Done:** one branch (`task/<n>-<slug>`) and PR per task; `/checkpoint` = one approval for commit + push + PR;
  owner merges ("Squash and merge"). PR template added; CLAUDE.md Git workflow section; implement/verify/checkpoint
  skills updated. Repo: squash-only, auto-delete merged branches, squash commits keep commit messages.
  Ruleset "Protect main": PR required, both CI checks required, no force-push or deletion, no bypass.
- **Verified:** API read-back of repo settings and effective rules on `main`; local checks pass; delivered as PR #1
  with green CI, merged by the owner.
- **Learned / notes:** feature branches + PRs as the review gate; squash merge tradeoffs; rulesets vs classic branch
  protection; required checks match job names (rename the CI job → update the ruleset); `git branch -D` after squash.
- **Next:** task #4 (draw a static creature) — first task through the full PR flow.

## 2026-11-20 — Task #13: CI with GitHub Actions ✅
- **Done:** `.github/workflows/ci.yml` — on push to `main`, PRs, and manual dispatch; Node 22 + latest LTS matrix;
  pnpm from `packageManager` with store cache; `--frozen-lockfile`; format → lint → typecheck → test → build as
  separate steps; read-only token; concurrency cancels stale runs. Added tasks #13/#14 to the backlog (stable IDs).
- **Verified:** run 44842531643 green on both Node versions; rerun restored the pnpm cache; temporary branch
  `ci-red-check` with a failing test → run 44842663363 failed at the Test step on both jobs (and GitHub emailed the
  owner); branch deleted, `main` untouched.
- **Learned / notes:** CI as the shared source of truth; matrix builds; least-privilege tokens and action pinning
  (major tag vs SHA); lockfile-keyed caching. GitHub notifies on failed runs (email / mobile app).
- **Next:** task #14 (branch + pull-request workflow), delivered as the first PR.

## 2026-11-20 — Task #3: Simulation core ✅
- **Done:** `rng.ts` (mulberry32; `createRng`/`next`/`range`/`int`/`pick`, state as plain data); `vec2.ts` (in-place
  helpers); `creature.ts` (seeded spawn: position, hue, size, tentacles); `world.ts` (`createWorld`, `stepWorld` with
  prevPosition + Euler integration, `resizeWorld`). ESLint now also bans browser globals, `Math.random`, `Date.now`
  in simulation. Not yet wired into the app (task #4).
- **Verified:** 30/30 tests (17 new: determinism after 600 steps, seed sensitivity, spawn bounds, RNG range and
  uniformity); lint probe → 7 errors from 3 rules; typecheck, format, build pass; app unchanged, no console errors.
- **Learned / notes:** seeded PRNG with state in the world = reproducible "randomness"; data-oriented design
  (plain data + functions) vs OOP; in-place mutation to avoid GC stutter.
- **Next:** task #4 (draw a static creature).

## 2026-11-20 — Task #2: Canvas stage + game loop ✅
- **Done:** `fixedStep.ts` (pure 60 Hz accumulator: steps, carry-over, alpha, 250 ms frame cap, 10-step cap);
  `gameLoop.ts` (rAF driver, idempotent start/stop); `render/stage.ts` (DPR-aware canvas + ResizeObserver);
  `WorldCanvas.vue` (template ref, non-reactive loop/stage, cleanup in `onBeforeUnmount`); temporary `demoDot.ts`.
- **Verified:** 13/13 tests (incl. 30/60/144 FPS → identical 60 steps/s); typecheck, lint, format, build pass;
  headless Chrome at DPR 2: canvas = viewport, buffer = 2×, no scrollbars, ~60 FPS, no console errors;
  HMR edits keep a single loop (60 rAF calls/s); owner confirmed smooth motion and clean resizing.
- **Learned / notes:** "Fix Your Timestep" pattern, spiral-of-death caps, DPR backing store vs CSS size,
  keeping per-frame objects out of Vue reactivity. Also: GitHub repo created (public) and push rule added to workflow.
- **Next:** task #3 (simulation core: world, creature, seeded RNG).

## 2026-11-20 — Task #1: Project scaffold ✅
- **Done:** Vite 8 + Vue 3.5 + TypeScript 6 (strict) via `create-vite` (demo content removed); Vitest 5; ESLint 10 flat config
  (typescript-eslint, eslint-plugin-vue, eslint-config-prettier); Prettier; pnpm 12.21.0 pinned; Node >=22.12.0.
  Sample tests for `clamp` and `lerp`. ESLint `no-restricted-imports` enforces the simulation layer boundary.
- **Verified:** test (6/6), typecheck, lint, format:check, build all exit 0; lint probe confirmed the layer rule;
  headless Chrome rendered the placeholder with no console errors.
- **Learned / notes:** TypeScript pinned to `~6.0.3` because `vue-tsc` and `typescript-eslint` don't support TS 7 yet;
  `@types/node` and `env.d.ts` not needed; Vite doesn't type-check in dev (use editor or `pnpm typecheck`).
  Added the owner's Mentoring preference to CLAUDE.md.
- **Next:** task #2 (canvas stage + game loop).

## 2026-11-20 — Discovery & documentation
- Defined vision, MVP ("The Tide Pool"), architecture, backlog, and skills workflow.
- Owner approved architecture, stack, and MVP scope; ADRs 0001–0003 accepted.
- Added root `.gitignore` (incl. `.claude/settings.local.json`).
- Next: backlog task #1 (project scaffold).
