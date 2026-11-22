# Code map — where things are, and how to change them

**The *where*** to the [architecture overview](overview.md)'s ***why***. Use it before changing anything.

> **Kept honest by CI:** `src/codeMap.test.ts` fails if a source file in `src/` is missing here, if this map names a
> file that doesn't exist, or if a constant/key in the knob table doesn't exist in its file.
> When you add, rename or delete a file or a tuning constant, update this map in the same change.

**Conventions**

- Tests live next to the code they cover: `x.test.ts` beside `x.ts` (so test files aren't listed below).
- Tuning numbers live in an `UPPERCASE` constant object at the top of the module that uses them
  (e.g. `MOVEMENT`, `EMOTION`). Private ones (not exported) are module-local on purpose.
- Import direction: `app → render, input, audio → simulation`. `simulation/` imports nothing outside itself
  (enforced by ESLint: no Vue, DOM, `Math.random`, `Date.now`).

## Files by folder

### `src/` (entry)

| File | Purpose | Key exports |
|---|---|---|
| `src/main.ts` | Mounts the Vue app | — |

### `src/simulation/` — the world, as plain data + functions (deterministic, DOM-free)

| File | Purpose | Key exports |
|---|---|---|
| `src/simulation/world.ts` | The world state (incl. `scenery`) and the fixed-step order of everything | `World`, `createWorld`, `stepWorld`, `resizeWorld` |
| `src/simulation/creature.ts` | Creature data, body proportions, spawn footprint, seeded spawning | `Creature`, `BODY`, `CREATURE_LIMITS`, `footprint`, `createCreature` |
| `src/simulation/traits.ts` | Personality: archetypes on trait dials, dealt without replacement | `Archetype`, `ARCHETYPES`, `dealArchetypes`, `createTraits` |
| `src/simulation/presence.ts` | The visitor (cursor/finger) as data; smoothed velocity | `Presence`, `setPresenceInput`, `updatePresence` |
| `src/simulation/perception.ts` | What a creature notices: attention, trust, pressure, startle → stimulus | `Perception`, `Stimulus`, `PERCEPTION`, `stepPerception` |
| `src/simulation/emotion.ts` | Utility-scored emotions, smoothing, hysteresis, fear reflex | `EmotionKind`, `EMOTION`, `scoreEmotions`, `stepEmotion` |
| `src/simulation/mindState.ts` | The mind's state as data (split out to avoid an import cycle) | `IntentKind`, `MindState`, `createMindState` |
| `src/simulation/mind.ts` | `Mind` interface + `ruleMind`: emotion → intent; calm wander/rest rhythm | `Mind`, `MIND`, `ruleMind`, `stepActivity` |
| `src/simulation/expression.ts` | Gaze, emote events, mood-scaled animation speed | `Expression`, `EmoteKind`, `EXPRESSION`, `stepExpression` |
| `src/simulation/movement.ts` | Intent → steering forces, drag, personal speed limit | `MOVEMENT`, `INTENT_SPEED`, `speedLimit`, `stepMovement` |
| `src/simulation/steering.ts` | Reynolds steering behaviors as pure force functions | `STEERING`, `wander`, `stayInBounds`, `separate`, `arrive`, `seek`, `flee`, `brake` |
| `src/simulation/constraints.ts` | Position-based pass: no overlaps, stay in bounds | `resolveConstraints` |
| `src/simulation/scenery.ts` | Sea floor: sand height, the swimmable area, seeded rocks/shells/seaweed (own random stream) | `SceneryItem`, `FLOOR`, `SCENERY`, `floorHeight`, `swimBounds`, `createScenery` |
| `src/simulation/bubbles.ts` | Bubble particles: fixed 64-slot pool, analytic motion, spawned on flee/hide/standoff (own random stream) | `BUBBLES`, `BubbleSystem`, `createBubbles`, `stepBubbles`, `bubbleAt` |
| `src/simulation/animation.ts` | Breathing/sway oscillators and the blink state machine | `CreatureAnimation`, `ANIMATION`, `stepAnimation` |
| `src/simulation/rng.ts` | Seeded PRNG (mulberry32) — the only randomness in the simulation | `Rng`, `createRng`, `next`, `range`, `int`, `pick` |
| `src/simulation/vec2.ts` | 2D vector helpers (mutate in place, no allocations) | `Vec2`, `vec2`, `addScaled`, `limitLength` |
| `src/simulation/math.ts` | Small numeric helpers | `clamp`, `lerp` |

### `src/render/` — Canvas 2D drawing (reads the world, never mutates it)

| File | Purpose | Key exports |
|---|---|---|
| `src/render/scene.ts` | Draws one frame: background → floor → creatures (back to front) → bubbles → emotes → vignette → debug | `drawScene`, `SceneOptions` |
| `src/render/floor.ts` | "Moonlit reef" sea floor: sand, mossy rocks, glowing shells, swaying seaweed | `drawFloor` |
| `src/render/drawCreature.ts` | The "little octopus": body, fur, tentacles, eyes, mood body language | `drawCreature`, `mantleRadii`, `tentacleRoot`, `tentacleOutline`, `TENTACLE_ROOT` |
| `src/render/bubbles.ts` | Draws live bubbles (rim + highlight) and their pop rings | `drawBubbles` |
| `src/render/emotes.ts` | Vector emote bubbles (? ! anger mark ♥) with pop/float/fade | `drawEmotes` |
| `src/render/background.ts` | Water, caustics, floating motes (pure function of time), vignette | `drawBackground`, `drawVignette`, `motePosition` |
| `src/render/motion.ts` | Decorative-motion settings (full vs reduced motion) | `MotionSettings`, `FULL_MOTION`, `REDUCED_MOTION`, `motionSettings` |
| `src/render/debugDraw.ts` | `?debug` canvas layer: perception rings and labels | `drawPerceptionDebug` |
| `src/render/noise.ts` | Stateless deterministic hash for per-creature detail | `hash2` |
| `src/render/stage.ts` | High-DPI full-size canvas + resize handling | `Stage`, `createStage` |

### `src/input/` — DOM input → plain data

| File | Purpose | Key exports |
|---|---|---|
| `src/input/pointer.ts` | Pointer Events (mouse/pen/touch) → latest sample; touch lingers briefly | `createPointerInput`, `TOUCH_LINGER_MS` |

### `src/audio/` — Web Audio output layer (observes the world)

| File | Purpose | Key exports |
|---|---|---|
| `src/audio/voice.ts` | Pure voice design: pitch/timbre/contour per creature and emote | `chirpFor`, `panFor`, `pentatonicHz`, `ChirpSpec` |
| `src/audio/soundEvents.ts` | Detects each new emote exactly once | `createEmoteWatcher` |
| `src/audio/synth.ts` | Plays chirp specs (oscillator → filter → envelope → pan → master) | `createSynth`, `Synth` |

### `src/app/` — Vue shell, game loop, wiring

| File | Purpose | Key exports |
|---|---|---|
| `src/app/App.vue` | Root component, global page styles | — |
| `src/app/WorldCanvas.vue` | Wires everything: world, loop, input, render, audio, debug, hint, reduced motion | — |
| `src/app/gameLoop.ts` | `requestAnimationFrame` driver with a fixed timestep + frame timing hook | `createGameLoop` |
| `src/app/fixedStep.ts` | Pure fixed-timestep accumulator (steps + interpolation alpha) | `advanceFixedStep`, `DEFAULT_FIXED_STEP` |
| `src/app/seed.ts` | `?seed=` from the URL, or a random seed per visit | `resolveSeed` |
| `src/app/fpsMeter.ts` | Rolling FPS and frame work time | `createFpsMeter`, `FrameStats` |
| `src/app/debugSnapshot.ts` | World → plain snapshot for the debug panel; 5 Hz publisher | `createDebugSnapshot`, `createPublisher` |
| `src/app/reducedMotion.ts` | Live watcher for the OS "reduce motion" setting | `watchReducedMotion` |
| `src/app/DebugPanel.vue` | Display-only debug panel (press D / `?debug`) | — |
| `src/app/MuteToggle.vue` | Accessible sound on/off button (starts muted) | — |
| `src/app/FirstVisitHint.vue` | "move your cursor near them…" hint, gone after the first interaction | — |

## To change X, edit Y

| To change… | Edit | In |
|---|---|---|
| **Personality & population** | | |
| An archetype's curiosity/boldness | `ARCHETYPES.friendly` | `src/simulation/traits.ts` |
| How much creatures vary within an archetype | `TRAIT_VARIATION` | `src/simulation/traits.ts` |
| Energy (speed) range | `ENERGY_RANGE` | `src/simulation/traits.ts` |
| Number of creatures | `CREATURE_COUNT` | `src/app/WorldCanvas.vue` |
| **Perception** | | |
| How far creatures notice you | `PERCEPTION.radius` | `src/simulation/perception.ts` |
| What counts as a sudden movement | `PERCEPTION.suddenSpeed` | `src/simulation/perception.ts` |
| What counts as a calm presence | `PERCEPTION.calmSpeed` | `src/simulation/perception.ts` |
| How fast trust builds | `PERCEPTION.trustBuild` | `src/simulation/perception.ts` |
| How fast chasing pressure builds | `PERCEPTION.pressureBuild` | `src/simulation/perception.ts` |
| **Emotion & mind** | | |
| How quickly a Scaredy relaxes (wariness) | `EMOTION.wariness` | `src/simulation/emotion.ts` |
| How strongly everyone flinches at a flick | `EMOTION.flinch` | `src/simulation/emotion.ts` |
| How "sticky" moods are (anti-flicker) | `EMOTION.minHold` | `src/simulation/emotion.ts` |
| When a timid creature hides instead of fleeing | `MIND.hideThreshold` | `src/simulation/mind.ts` |
| How close a Peeker creeps before darting back | `MIND.peekNear` | `src/simulation/mind.ts` |
| How long creatures wander / rest when calm | `MIND.wanderDuration` | `src/simulation/mind.ts` |
| **Movement** | | |
| Swim speed | `MOVEMENT.baseSpeed` | `src/simulation/movement.ts` |
| How much faster a scared creature darts | `INTENT_SPEED.flee` | `src/simulation/movement.ts` |
| How close a Friendly hovers to you | `MOVEMENT.approachDistance` | `src/simulation/movement.ts` |
| Personal space between creatures | `STEERING.personalSpace` | `src/simulation/steering.ts` |
| How wiggly wandering paths are | `STEERING.wanderJitter` | `src/simulation/steering.ts` |
| **Body, animation & looks** | | |
| Creature size range | `CREATURE_LIMITS.minSize` | `src/simulation/creature.ts` |
| Tentacle length | `BODY.tentacleLength` | `src/simulation/creature.ts` |
| How far apart tentacle roots attach (kept inside the body) | `TENTACLE_ROOT.spread` | `src/render/drawCreature.ts` |
| How high under the body tentacles attach | `BODY.tentacleRootY` | `src/simulation/creature.ts` |
| Breathing speed | `ANIMATION.breathHz` | `src/simulation/animation.ts` |
| How often creatures blink | `ANIMATION.blinkWait` | `src/simulation/animation.ts` |
| Tentacle sway amount | `SWAY.amplitude` | `src/render/drawCreature.ts` |
| How much the Grumpy puffs up | `MOOD.puff` | `src/render/drawCreature.ts` |
| How red the Grumpy flushes | `MOOD.flush` | `src/render/drawCreature.ts` |
| How much fur bristles | `MOOD.bristle` | `src/render/drawCreature.ts` |
| Lean into the direction of travel | `MOTION.maxLean` | `src/render/drawCreature.ts` |
| **Expression** | | |
| Time between emotes | `EXPRESSION.emoteCooldown` | `src/simulation/expression.ts` |
| How long an emote shows | `EXPRESSION.emoteLife` | `src/simulation/expression.ts` |
| How often calm creatures glance at each other | `EXPRESSION.glanceEvery` | `src/simulation/expression.ts` |
| Faster breathing when scared | `EXPRESSION.breathBoost` | `src/simulation/expression.ts` |
| Emote pop-in time / float distance | `POP_SECONDS` | `src/render/emotes.ts` |
| **Bubbles** | | |
| Bubbles released when a creature starts fleeing | `BUBBLES.burst` | `src/simulation/bubbles.ts` |
| Bubbles in a Grumpy huff | `BUBBLES.huff` | `src/simulation/bubbles.ts` |
| Trickle rate while darting | `BUBBLES.trickleEvery` | `src/simulation/bubbles.ts` |
| How fast bubbles rise | `BUBBLES.riseSpeed` | `src/simulation/bubbles.ts` |
| Max bubbles alive at once (pool size) | `BUBBLES.capacity` | `src/simulation/bubbles.ts` |
| **Scene** | | |
| Number of floating motes | `MOTE_COUNT` | `src/render/background.ts` |
| Number of light patches (caustics) | `CAUSTIC_COUNT` | `src/render/background.ts` |
| Sea-floor height (fraction of the window) | `FLOOR.fraction` | `src/simulation/scenery.ts` |
| How far tentacles may rest on the sand | `FLOOR.tentacleAllowance` | `src/simulation/scenery.ts` |
| How many rocks / shells / seaweed | `SCENERY.rocks` | `src/simulation/scenery.ts` |
| Rock size | `SCENERY.rockSize` | `src/simulation/scenery.ts` |
| How far shells stay from rocks (never half-hidden) | `SCENERY.shellRockGap` | `src/simulation/scenery.ts` |
| Seaweed height | `SCENERY.seaweedHeight` | `src/simulation/scenery.ts` |
| Sea-floor colors (sand, rocks, moss, glow) | `LOOK.sandTop` | `src/render/floor.ts` |
| How much reduced motion tones things down | `REDUCED_MOTION.sway` | `src/render/motion.ts` |
| **Sound** | | |
| Overall volume | `MASTER_VOLUME` | `src/audio/synth.ts` |
| Max chirps at once | `MAX_VOICES` | `src/audio/synth.ts` |
| A personality's voice (wave, register, filter) | `TIMBRE.grumpy` | `src/audio/voice.ts` |
| **Input & debug** | | |
| How long a tap counts as presence | `TOUCH_LINGER_MS` | `src/input/pointer.ts` |
| Debug panel refresh rate | `SNAPSHOT_INTERVAL_MS` | `src/app/WorldCanvas.vue` |

## Common changes (recipes)

**Add a new archetype**

1. `src/simulation/traits.ts`: add it to the `Archetype` union, `ARCHETYPES` (its dials) and `ARCHETYPE_DECK`.
2. `src/simulation/emotion.test.ts`: add a column to the `EXPECTED` grid (and check the variation-corner test).
3. `src/audio/voice.ts`: give it a voice in `TIMBRE`.
4. Docs: the grid in `docs/product/mvp.md` and the table in `README.md`.

**Add a new emote**

1. `src/simulation/expression.ts`: extend `EmoteKind` and decide when it fires (`EMOTE_FOR` or `stepEmotes`).
2. `src/render/emotes.ts`: draw it in `drawEmote`.
3. `src/audio/voice.ts`: give it a contour in `chirpFor`.
4. Tests: `src/simulation/expression.test.ts`, `src/audio/voice.test.ts`.

**Add a new stimulus (something the visitor does)**

1. `src/simulation/perception.ts`: extend `Stimulus`, add thresholds to `PERCEPTION`, classify it in `stepPerception`.
2. `src/simulation/emotion.ts`: decide how each emotion scores it in `scoreEmotions`.
3. `src/render/debugDraw.ts`: give it a color in `STIMULUS_COLOR`.
4. Tests: `src/simulation/perception.test.ts` (scripted cursor path), `src/simulation/emotion.test.ts` (grid row).

**Add a new kind of scenery (e.g. coral)**

1. `src/simulation/scenery.ts`: extend `SceneryKind`, add its count/size to `SCENERY`, place it in `createScenery`.
2. `src/render/floor.ts`: draw it in `drawFloor` (a new `draw…` function, using `hash2` for stable detail).
3. Tests: `src/simulation/scenery.test.ts` (counts and ranges).

**Add or rename a tuning knob**

1. Add the key to the module's `UPPERCASE` constant object (next to similar ones, with a short comment).
2. Add a row to the table above — `src/codeMap.test.ts` checks the constant and key really exist.

**Add, rename or delete a file**

1. Update the folder table above (CI fails otherwise).
2. If it's a new layer or changes the data flow, update [overview.md](overview.md) too.
