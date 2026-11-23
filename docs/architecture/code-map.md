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
| `src/simulation/presence.ts` | The visitor (cursor/finger) as data; smoothed velocity; press/release edges | `Presence`, `setPresenceInput`, `updatePresence` |
| `src/simulation/interaction.ts` | Boop and grab-and-drag: hit-testing (head + tentacle zone), boop-vs-hold, the held spring + rhythmic pull + wriggle, tether with a top speed, shake stress → ink; reactions by personality (flee / Grumpy chase / Friendly dizzy) as the one override above the mind; interaction sound events (own random stream) | `INTERACTION`, `Interaction`, `creatureAt`, `stepInteraction`, `heldForce`, `pullOffset`, `applyTether`, `struggleLevel`, `stressLimit`, `stressFraction`, `standsItsGround`, `forgives`, `interactionIntent`, `aimAtHand`, `chaseForce`, `dizziness`, `dizzyForce`, `jetLimit`, `isHeld` |
| `src/simulation/perception.ts` | What a creature notices: attention, trust, pressure, startle → stimulus; `rattled` (after inking) caps trust | `Perception`, `Stimulus`, `PERCEPTION`, `stepPerception` |
| `src/simulation/emotion.ts` | Utility-scored emotions, smoothing, hysteresis, fear reflex; being rattled dampens curiosity (and keeps a Grumpy grumpy) | `EmotionKind`, `EMOTION`, `scoreEmotions`, `stepEmotion` |
| `src/simulation/mindState.ts` | The mind's state as data (split out to avoid an import cycle), incl. the food it's going for | `IntentKind`, `MindState`, `createMindState` |
| `src/simulation/mind.ts` | `Mind` interface + `ruleMind`: emotion → intent; calm wander/rest rhythm; food (when calm) | `Mind`, `MIND`, `ruleMind`, `stepActivity` |
| `src/simulation/expression.ts` | Gaze, emote events, mood-scaled animation speed | `Expression`, `EmoteKind`, `EXPRESSION`, `stepExpression`, `showEmote` |
| `src/simulation/movement.ts` | Intent → steering forces, drag, personal speed limit | `MOVEMENT`, `INTENT_SPEED`, `speedLimit`, `stepMovement` |
| `src/simulation/steering.ts` | Reynolds steering behaviors as pure force functions | `STEERING`, `wander`, `stayInBounds`, `separate`, `arrive`, `seek`, `flee`, `brake` |
| `src/simulation/constraints.ts` | Position-based pass: no overlaps, stay in bounds; a held creature shoves others at a limited speed (else it is blocked) | `CONSTRAINTS`, `resolveConstraints` |
| `src/simulation/scenery.ts` | Sea floor: sand height, the swimmable area, seeded rocks/shells/seaweed (own random stream) | `SceneryItem`, `FLOOR`, `SCENERY`, `floorHeight`, `swimBounds`, `createScenery` |
| `src/simulation/ink.ts` | Ink clouds: fixed 128-slot pool of puffs with analytic motion, squirted when a shaken creature inks (own random stream) | `INK`, `InkSystem`, `createInk`, `spawnInk`, `stepInk`, `inkPuffAt` |
| `src/simulation/props.ts` | The treasure chest (open/closed, pages of 3 + ‹ › arrows and pressable page dots, its box, item slots, hit-tests); the wearables catalog (26, by spot — head / eyes / face / hand / cuffs; 3 of each out; fallen items can be picked up; auto-return after 8 s on the sand, blinking for the last 3) and props — items in the water: shrimp sink with a drift and rest on the sand (at most 3); toys (duck, ball) have real physics (neutral buoyancy / sink, bounce, roll, spin, an edge current) and exist once | `CHEST`, `CHEST_ITEMS`, `CHEST_PAGES`, `SLOT_COUNT`, `pageItems`, `turnPage`, `goToPage`, `arrowPosition`, `pageDotPosition`, `pageDotAt`, `WEARABLES`, `WearableKind`, `WearSpot`, `isWearable`, `outCount`, `PROPS`, `TOY`, `TOYS`, `itemAt`, `toyFloor`, `Props`, `Prop`, `PropKind`, `createProps`, `chestBox`, `slotPosition`, `slotAt`, `overChest`, `toggleChest`, `canTake`, `dropProp`, `removeProp`, `stepProps`, `nearestShrimp`, `sandTop`, `restY` |
| `src/simulation/feeding.ts` | Who goes for a shrimp and how, by trait dials (race / sneak / creep / guard); eating (♥, squish, "nom") | `FEEDING`, `feedingStyle`, `chooseMeal`, `mealTarget`, `mealSpeed`, `inReach` |
| `src/simulation/wearables.ts` | Dress-up: wearing one item per spot (head / eyes / face / hand / cuffs; two-spot items), the raised hand's position, creatures picking up dropped items by personality, swapping, taking off, hit-testing worn items, the Grumpy shaking things off | `WEAR`, `HAND`, `COLLECT`, `chooseCollect`, `collectTarget`, `spotPosition`, `spotsOf`, `isDressed`, `wearOn`, `takeOff`, `dropOff`, `wornAt`, `shakeAmount`, `stepWearables` |
| `src/simulation/party.ts` | The party (task #32): on while the disco ball is out (in the water or carried), its fade level, the one beat clock, and the party song's map — "where we are in the song" (section, energy, beat pulse) that the music, lights and dancing share | `PARTY`, `Party`, `createParty`, `discoBallOut`, `beatsAt`, `stepParty`, `PARTY_SONG_MAP`, `PartySection`, `songBar`, `sectionOf`, `PartyMoment`, `momentAt`, `partyMoment` |
| `src/simulation/play.ts` | Toys by personality (fetch / nudge / swat / shy, a mind layer after food); creature–toy contact pushes, the duck's squeak, a Scaredy's flinch | `PLAY`, `playStyle`, `choosePlay`, `playTarget`, `resolveToyContacts` |
| `src/simulation/bubbles.ts` | Bubble particles: fixed 64-slot pool, analytic motion, spawned on flee/hide/standoff (own random stream) | `BUBBLES`, `BubbleSystem`, `createBubbles`, `stepBubbles`, `bubbleAt` |
| `src/simulation/animation.ts` | Breathing/sway oscillators, the blink state machine, the boop squash spring | `CreatureAnimation`, `ANIMATION`, `stepAnimation` |
| `src/simulation/rng.ts` | Seeded PRNG (mulberry32) — the only randomness in the simulation | `Rng`, `createRng`, `next`, `range`, `int`, `pick` |
| `src/simulation/vec2.ts` | 2D vector helpers (mutate in place, no allocations) | `Vec2`, `vec2`, `addScaled`, `limitLength` |
| `src/simulation/math.ts` | Small numeric helpers | `clamp`, `lerp` |

### `src/render/` — Canvas 2D drawing (reads the world, never mutates it)

| File | Purpose | Key exports |
|---|---|---|
| `src/render/scene.ts` | Draws one frame: background → floor → chest → props → creatures (back to front) → ink → bubbles → chest items & carried item → emotes → vignette → debug | `drawScene`, `SceneOptions` |
| `src/render/floor.ts` | "Moonlit reef" sea floor: sand, mossy rocks, glowing shells, swaying seaweed (to the beat during the party); shares its seaweed shape and positions with the neon layer | `drawFloor`, `sandLine`, `sceneryAt`, `SeaweedDance`, `seaweedDance`, `seaweedStrand` |
| `src/render/drawCreature.ts` | The "little octopus": body, fur, tentacles, eyes, mood body language; squash, dangling and the grabbed tentacle; the dizzy look; jet swimming when fast | `drawCreature`, `CreaturePose`, `HeldPose`, `propulsion`, `swimAngle`, `mantleRadii`, `tentacleRoot`, `tentacleOutline`, `grabbedTentacle`, `TENTACLE_ROOT` |
| `src/render/bubbles.ts` | Draws live bubbles (rim + highlight) and their pop rings | `drawBubbles` |
| `src/render/ink.ts` | Draws ink clouds: soft deep-indigo radial-gradient puffs | `drawInk` |
| `src/render/party.ts` | Party lights (tasks #32a, #32c), following the music: dims the pool, the neon reef (neon beat-swaying seaweed, extra clumps that grow, shell halos and glints), sweeping beams, mirror-ball spots, rays off the disco ball, and the ball on top — light-safe (≤ 1 pulse per beat, tested) | `LIGHTS`, `twinkle`, `beatGlow`, `spotGlow`, `drawParty`, `drawDiscoBall` |
| `src/render/chest.ts` | Draws the treasure chest (wood, brass, moss; lid swings open with a golden glow), its floating item slots, and the carried item | `drawChest`, `drawChestItems` |
| `src/render/wearables.ts` | Drawings of the 26 wearables (and the let-go balloon) (held items drawn at the raised tentacle tip; kandi cuffs across tentacle curves), relative to their spot (some hats sit lower: `SIT_LOWER`; rave gear glows); drawn on creatures (in their local frame) or as centered icons | `drawWorn`, `drawHeld`, `drawCuffs`, `drawFloatingBalloon`, `drawWearableIcon`, `WearExtras`, `Curve` |
| `src/render/props.ts` | Draws items in the water: the shrimp, the rubber duck (bobs, turns with its spin) and the soccer ball (patches roll) | `drawProps`, `drawShrimp`, `drawDuck`, `drawBall` |
| `src/render/emotes.ts` | Vector emote bubbles (? ! anger mark ♥) with pop/float/fade | `drawEmotes` |
| `src/render/background.ts` | Water, caustics, floating motes (pure function of time), vignette | `drawBackground`, `drawVignette`, `motePosition` |
| `src/render/motion.ts` | Decorative-motion settings (full vs reduced motion) | `MotionSettings`, `FULL_MOTION`, `REDUCED_MOTION`, `motionSettings` |
| `src/render/debugDraw.ts` | `?debug` canvas layer: perception rings and labels | `drawPerceptionDebug` |
| `src/render/noise.ts` | Stateless deterministic hash for per-creature detail | `hash2` |
| `src/render/stage.ts` | High-DPI full-size canvas + resize handling | `Stage`, `createStage` |

### `src/input/` — DOM input → plain data

| File | Purpose | Key exports |
|---|---|---|
| `src/input/pointer.ts` | Pointer Events (mouse/pen/touch) → latest sample incl. `pressed` (latched, pointer capture); touch lingers briefly | `createPointerInput`, `TOUCH_LINGER_MS` |

### `src/audio/` — Web Audio output layer (observes the world)

| File | Purpose | Key exports |
|---|---|---|
| `src/audio/voice.ts` | Pure voice design: pitch/timbre/contour per creature and emote or interaction sound | `chirpFor`, `panFor`, `pentatonicHz`, `ChirpSpec`, `VoiceKind` |
| `src/audio/soundEvents.ts` | Detects each new emote and interaction sound exactly once (ink is deliberately silent) | `createEmoteWatcher` |
| `src/audio/synth.ts` | Plays chirp specs (oscillator → filter → envelope → pan → master); optional start delay (chirps on the half-beat during the party); shares its audio context and master with the music | `createSynth`, `Synth` |
| `src/audio/music.ts` | The party songs as pure data (task #32b), original deep house in A minor at the party tempo: "Tide Pool Groove" (a 4-bar loop, intro + 8-bar sweeps), "Deep End" (intro → build → drop → breakdown → build → drop 2, looping) and "Deep End (Extended)" (every section doubled, 16-bar drops that evolve halfway — **the party song**); the others are kept for a future track picker; chirp timing | `SONG`, `SONGS`, `PARTY_SONG`, `Song`, `DEEP_END`, `deepEndBar`, `DEEP_END_EXTENDED`, `deepEndExtendedBar`, `A_MINOR`, `Instrument`, `MusicNote`, `stepBeat`, `barNotes`, `notesBetween`, `midiHz`, `chirpDelay` |
| `src/audio/musicPlayer.ts` | Plays the songs with Web Audio: synthesized kick / clap / snare / hats / shaker / rim / growl bass / sub / wobble bass / stabs / pads / sweep / riser / impact, a look-ahead scheduler pinned to the beat clock, the sidechain pump, fades with the party; a fresh channel per party (a restarted song fades the old one out fast) | `MUSIC`, `createMusicPlayer`, `MusicPlayer`, `AudioOut` |

### `src/app/` — Vue shell, game loop, wiring

| File | Purpose | Key exports |
|---|---|---|
| `src/app/App.vue` | Root component, global page styles | — |
| `src/app/WorldCanvas.vue` | Wires everything: world, loop, input, render, audio, debug, hint, reduced motion, the chest button | — |
| `src/app/gameLoop.ts` | `requestAnimationFrame` driver with a fixed timestep + frame timing hook | `createGameLoop` |
| `src/app/fixedStep.ts` | Pure fixed-timestep accumulator (steps + interpolation alpha) | `advanceFixedStep`, `DEFAULT_FIXED_STEP` |
| `src/app/seed.ts` | `?seed=` from the URL, or a random seed per visit | `resolveSeed` |
| `src/app/fpsMeter.ts` | Rolling FPS and frame work time | `createFpsMeter`, `FrameStats` |
| `src/app/debugSnapshot.ts` | World → plain snapshot for the debug panel (incl. `rattled`); 5 Hz publisher | `createDebugSnapshot`, `createPublisher` |
| `src/app/reducedMotion.ts` | Live watcher for the OS "reduce motion" setting | `watchReducedMotion` |
| `src/app/DebugPanel.vue` | Display-only debug panel (press D / `?debug`) | — |
| `src/app/MuteToggle.vue` | Accessible sound on/off button (starts muted), bottom-right | — |
| `src/app/SoundNudge.vue` | "🔈 Turn on sound for the music": a button beside the mute toggle when the party starts while muted (task #32b) | — |
| `src/app/ChestToggle.vue` | Invisible but real button laid over the drawn chest: Tab, Enter/Space, click/tap; `aria-expanded` | — |
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
| How long a creature stays rattled after inking | `PERCEPTION.rattledFade` | `src/simulation/perception.ts` |
| **Emotion & mind** | | |
| How quickly a Scaredy relaxes (wariness) | `EMOTION.wariness` | `src/simulation/emotion.ts` |
| How strongly everyone flinches at a flick | `EMOTION.flinch` | `src/simulation/emotion.ts` |
| How "sticky" moods are (anti-flicker) | `EMOTION.minHold` | `src/simulation/emotion.ts` |
| How much being rattled dampens curiosity | `EMOTION.rattledDamp` | `src/simulation/emotion.ts` |
| How long a Grumpy holds a grudge after inking | `EMOTION.grudge` | `src/simulation/emotion.ts` |
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
| **Treasure chest & feeding** | | |
| Where the chest sits / its size | `CHEST.left` | `src/simulation/props.ts` |
| How far above the chest its items float | `CHEST.slotDistance` | `src/simulation/props.ts` |
| How many shrimp can be in the water at once | `PROPS.maxShrimp` | `src/simulation/props.ts` |
| How fast a shrimp sinks / drifts | `PROPS.sinkSpeed` | `src/simulation/props.ts` |
| How far the chest's corner is kept clear of scenery | `SCENERY.chestClear` | `src/simulation/scenery.ts` |
| How fast each personality goes for food | `FEEDING.speed` | `src/simulation/feeding.ts` |
| How far the hand must be before a Peeker / Scaredy goes for food | `FEEDING.peekerClear` | `src/simulation/feeding.ts` |
| How long a Grumpy guards food before eating it | `FEEDING.guardSeconds` | `src/simulation/feeding.ts` |
| How far a creature can reach to eat | `FEEDING.reachDown` | `src/simulation/feeding.ts` |
| **Toys** | | |
| How strongly toys are eased away from walls (no stuck corners) | `TOY.edgePush` | `src/simulation/props.ts` |
| How much a hit launches the ball (and how hard it takes hits) | `PLAY.ballLift` | `src/simulation/play.ts` |
| When a Scaredy dares to play (hand / others away from the toy) | `PLAY.shyClear` | `src/simulation/play.ts` |
| How bouncy the ball is / how far it rolls | `TOY.restitution` | `src/simulation/props.ts` |
| How long a creature plays before getting bored | `PLAY.sessionSeconds` | `src/simulation/play.ts` |
| How close the Friendly brings a toy before its ♥ | `PLAY.deliver` | `src/simulation/play.ts` |
| How hard a creature pushes a toy it bumps | `PLAY.push` | `src/simulation/play.ts` |
| How hard / how close the Grumpy swats toys | `PLAY.swatSpeed` | `src/simulation/play.ts` |
| How far a Scaredy keeps from toys while watched | `PLAY.avoid` | `src/simulation/play.ts` |
| **Dress-up & chest pages** | | |
| Which items are on which chest page (add an item here) | `CHEST_PAGES` | `src/simulation/props.ts` |
| Where a wearable goes (head / eyes / face) | `WEARABLES` | `src/simulation/props.ts` |
| How many of each wearable can be out | `PROPS.maxEach` | `src/simulation/props.ts` |
| When a fallen item blinks / returns to the chest | `PROPS.blinkAfter` | `src/simulation/props.ts` |
| How often the Grumpy shakes things off | `WEAR.shakeEvery` | `src/simulation/wearables.ts` |
| Party tempo (one beat clock for everything) | `PARTY.bpm` | `src/simulation/party.ts` |
| How fast the party fades in / out | `PARTY.fadeIn` | `src/simulation/party.ts` |
| Where the disco ball hangs, how fast it rises and spins | `DISCO.hangY` | `src/simulation/props.ts` |
| How dark the party gets | `LIGHTS.dim` | `src/render/party.ts` |
| The fastest a party light may twinkle (light safety, < 3/s) | `LIGHTS.maxFlashHz` | `src/render/party.ts` |
| Where the party song's intro / builds / drops / breakdown fall (bars) — music, lights and dancing | `PARTY_SONG_MAP.drop` | `src/simulation/party.ts` |
| How many rays the disco ball throws, and how far | `LIGHTS.rays` | `src/render/party.ts` |
| How much extra seaweed grows during the party, and how fast | `LIGHTS.extraSeaweed` | `src/render/party.ts` |
| Neon seaweed colors | `LIGHTS.neon` | `src/render/party.ts` |
| Where the raised tentacle holds things | `HAND.x` | `src/simulation/wearables.ts` |
| How fast a let-go balloon rises away | `PROPS.balloonLift` | `src/simulation/props.ts` |
| Who picks up dropped items, and when | `COLLECT.notice` | `src/simulation/wearables.ts` |
| How the Grumpy's shake looks | `WEAR.shakeSeconds` | `src/simulation/wearables.ts` |
| How often the duck may squeak | `PLAY.squeakEvery` | `src/simulation/play.ts` |
| **Shake → ink** | | |
| What counts as shaking (hand speed jolts, px/s²) | `INTERACTION.shakeAccel` | `src/simulation/interaction.ts` |
| How fast stress drains when you stop | `INTERACTION.stressLeak` | `src/simulation/interaction.ts` |
| How much shaking each personality puts up with | `INTERACTION.stressLimit` | `src/simulation/interaction.ts` |
| When the warning (tremble, faster squeaks) starts | `INTERACTION.stressWarning` | `src/simulation/interaction.ts` |
| How fast (and how long) it jets away after inking | `INTERACTION.jetSpeed` | `src/simulation/interaction.ts` |
| How long a mad Grumpy chases you | `INTERACTION.chaseSeconds` | `src/simulation/interaction.ts` |
| How fast (and how snappily) it chases — you have to dodge it | `INTERACTION.chaseSpeed` | `src/simulation/interaction.ts` |
| How close you must be for it to squirt / how often | `INTERACTION.chaseInkRange` | `src/simulation/interaction.ts` |
| When it turns its tentacles toward you to fire / where squirts start | `INTERACTION.aimFade` | `src/simulation/interaction.ts` |
| Where a chasing Grumpy stops (× size — tentacles end just short of the cursor) | `INTERACTION.chaseStop` | `src/simulation/interaction.ts` |
| How far short of the cursor its firing tentacles end | `JET.aimMargin` | `src/render/drawCreature.ts` |
| How long a Friendly is dizzy | `INTERACTION.dizzySeconds` | `src/simulation/interaction.ts` |
| How big / fast its dizzy loops are | `INTERACTION.dizzySpeed` | `src/simulation/interaction.ts` |
| The Friendly's tiny hiccup puff | `INTERACTION.hiccupScale` | `src/simulation/interaction.ts` |
| Dizzy look (wobble, spiral eyes, stars) | `DIZZY.wobble` | `src/render/drawCreature.ts` |
| Jet swimming when fast (head first, streaming tentacles, strokes) | `JET.strokeHz` | `src/render/drawCreature.ts` |
| How dark / how much it trembles before inking | `MOOD.tremble` | `src/render/drawCreature.ts` |
| Puffs per squirt / pool size | `INK.burst` | `src/simulation/ink.ts` |
| How long the ink cloud lasts | `INK.life` | `src/simulation/ink.ts` |
| How far the ink spreads | `INK.spread` | `src/simulation/ink.ts` |

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
| How loud the party music is (under the chirps) | `MUSIC.volume` | `src/audio/musicPlayer.ts` |
| How hard the bass/stabs pump on each kick | `MUSIC.duck` | `src/audio/musicPlayer.ts` |
| How much the music shuffles (swing) | `SONG.swing` | `src/audio/music.ts` |
| Where "Deep End"'s builds, drops and breakdown fall (bars) | `DEEP_END.drop` | `src/audio/music.ts` |
| How long each part of the party song lasts (bars) | `DEEP_END_EXTENDED.drop` | `src/audio/music.ts` |
| Which song the party plays | `PARTY_SONG` | `src/audio/music.ts` |
| A personality's voice (wave, register, filter) | `TIMBRE.grumpy` | `src/audio/voice.ts` |
| **Interaction (boop, grab & drag)** | | |
| How forgiving clicking a head is | `INTERACTION.headTolerance` | `src/simulation/interaction.ts` |
| How far below the head a tentacle grab reaches | `INTERACTION.tentacleReach` | `src/simulation/interaction.ts` |
| What counts as a boop (time / movement) | `INTERACTION.boopSeconds` | `src/simulation/interaction.ts` |
| How tightly a held creature follows the hand | `INTERACTION.spring` | `src/simulation/interaction.ts` |
| How far it can trail behind the hand | `INTERACTION.tether` | `src/simulation/interaction.ts` |
| How fast a dragged creature can shove others out of the way | `CONSTRAINTS.shoveSpeed` | `src/simulation/constraints.ts` |
| How far upset creatures pull away from your hand | `INTERACTION.maxPull` | `src/simulation/interaction.ts` |
| Rhythm of the yanks (timid fast, bold slow) | `INTERACTION.pullHz` | `src/simulation/interaction.ts` |
| How upset a creature must be before it struggles | `INTERACTION.calmUpset` | `src/simulation/interaction.ts` |
| How hard creatures wriggle | `INTERACTION.wriggleForce` | `src/simulation/interaction.ts` |
| Top speed of a held creature (catching up after being blocked) | `INTERACTION.maxHeldSpeed` | `src/simulation/interaction.ts` |
| How often struggle squeaks play | `INTERACTION.squeakEvery` | `src/simulation/interaction.ts` |
| How hard a boop squishes | `INTERACTION.boopSquash` | `src/simulation/interaction.ts` |
| How bouncy the squash is | `ANIMATION.squashStiffness` | `src/simulation/animation.ts` |
| How the squash looks (wider / flatter) | `MOOD.squashWide` | `src/render/drawCreature.ts` |
| How tentacles dangle while held | `MOTION.dangleTrail` | `src/render/drawCreature.ts` |
| Longest tentacle trail (fast drags) | `MOTION.maxTrail` | `src/render/drawCreature.ts` |
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

**Add a new interaction sound (e.g. a purr)**

1. `src/simulation/interaction.ts`: extend `InteractionSoundKind` and record it with `sound()` where it happens.
2. `src/audio/voice.ts`: give it a contour in `chirpFor` (`soundEvents.ts` already reports it).
3. Tests: `src/simulation/interaction.test.ts`, and add it to the list in `src/audio/voice.test.ts`.

**Add a new wearable (e.g. a crown)**

1. `src/simulation/props.ts`: add it to `WearableKind`, `WEARABLES` (its spot) and a page in `CHEST_PAGES`.
2. `src/render/wearables.ts`: add its drawing to `DRAW` (relative to its spot, in units of the creature's size).
3. Tests: `src/simulation/wearables.test.ts` (the page/catalog counts).

**Add a new chest item (e.g. a toy)**

1. `src/simulation/props.ts`: extend `PropKind`, add it to `CHEST_ITEMS` (its slot), its physics in `stepProps`,
   and any limit in `canTake`.
2. `src/render/props.ts`: draw it (in the water); `src/render/chest.ts` `drawItem`: its slot icon.
3. Behaviour: how creatures react to it (like `src/simulation/feeding.ts` for food).
4. Tests: `src/simulation/props.test.ts` (+ a behaviour test).

**Add or rename a tuning knob**

1. Add the key to the module's `UPPERCASE` constant object (next to similar ones, with a short comment).
2. Add a row to the table above — `src/codeMap.test.ts` checks the constant and key really exist.

**Add, rename or delete a file**

1. Update the folder table above (CI fails otherwise).
2. If it's a new layer or changes the data flow, update [overview.md](overview.md) too.
