<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef } from 'vue'
import { createEmoteWatcher } from '../audio/soundEvents'
import { createSynth, type Synth } from '../audio/synth'
import { chirpFor, panFor } from '../audio/voice'
import { createPointerInput, type PointerInput } from '../input/pointer'
import { FULL_MOTION, motionSettings } from '../render/motion'
import { drawScene } from '../render/scene'
import { createStage, type Stage } from '../render/stage'
import { creatureAt } from '../simulation/interaction'
import { setPresenceInput } from '../simulation/presence'
import { createWorld, resizeWorld, stepWorld } from '../simulation/world'
import DebugPanel from './DebugPanel.vue'
import FirstVisitHint from './FirstVisitHint.vue'
import MuteToggle from './MuteToggle.vue'
import { createDebugSnapshot, createPublisher, type DebugSnapshot } from './debugSnapshot'
import { createFpsMeter } from './fpsMeter'
import { createGameLoop, type GameLoop } from './gameLoop'
import { watchReducedMotion } from './reducedMotion'
import { resolveSeed } from './seed'

const CREATURE_COUNT = 5
/** Debug panel refresh interval: ≤ 5 updates per second. */
const SNAPSHOT_INTERVAL_MS = 200

const canvasEl = useTemplateRef<HTMLCanvasElement>('canvas')

// Debug overlay: `D` toggles it in dev; `?debug` turns it on (and enables `D`) in any build.
const debugRequested = new URLSearchParams(window.location.search).has('debug')
const debugAllowed = import.meta.env.DEV || debugRequested
const debugVisible = ref(debugRequested)
// shallowRef: Vue tracks only "a new snapshot arrived" — never the fields inside it.
const snapshot = shallowRef<DebugSnapshot | null>(null)

// Sound: always starts muted. The AudioContext is only created on the first unmute click
// (browsers block audio until a user gesture).
const muted = ref(true)
/** Plain mirror of `muted` for the per-frame code (no reactive reads in the hot loop). */
let soundOn = false
let synth: Synth | null = null
const watchEmotes = createEmoteWatcher()

function toggleSound() {
  synth ??= createSynth()
  soundOn = !soundOn
  muted.value = !soundOn
  synth.setMuted(!soundOn)
}

// First-visit hint: shown until the visitor first interacts with the pool.
const hintVisible = ref(true)
let hintPending = true

// Accessibility: decorative motion follows the OS "reduce motion" setting, live.
let motion = FULL_MOTION
let stopWatchingMotion: (() => void) | null = null

// Deliberately NOT reactive (ADR 0001): per-frame objects must stay out of Vue's reactivity system.
let stage: Stage | null = null
let loop: GameLoop | null = null
let pointer: PointerInput | null = null
/** Plain mirror of `debugVisible` for the per-frame code (no reactive reads in the hot loop). */
let showDebug = debugVisible.value

const meter = createFpsMeter()
const publish = createPublisher(SNAPSHOT_INTERVAL_MS)

function toggleDebug() {
  showDebug = !showDebug
  debugVisible.value = showDebug
  if (!showDebug) {
    meter.reset()
    snapshot.value = null
  }
}

function onKeyDown(event: KeyboardEvent) {
  if (!debugAllowed || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
  if (event.key === 'd' || event.key === 'D') toggleDebug()
}

onMounted(() => {
  if (!canvasEl.value) return
  const s = createStage(canvasEl.value)
  stage = s
  const input = createPointerInput(canvasEl.value, () => performance.now())
  pointer = input
  window.addEventListener('keydown', onKeyDown)
  stopWatchingMotion = watchReducedMotion((reduced) => (motion = motionSettings(reduced)))

  const seed = resolveSeed(window.location.search)
  console.info(
    `[Creature World] seed ${seed} — add ?seed=${seed} to the URL to see this world again`,
  )
  const world = createWorld({
    seed,
    width: s.width,
    height: s.height,
    creatureCount: CREATURE_COUNT,
  })

  loop = createGameLoop({
    step(dt) {
      if (world.width !== s.width || world.height !== s.height)
        resizeWorld(world, s.width, s.height)
      // Sample input at the boundary: the simulation only ever sees plain data, once per fixed step.
      const sample = input.sample(performance.now())
      setPresenceInput(world.presence, sample.x, sample.y, sample.active, sample.pressed)
      if (hintPending && sample.active) {
        hintPending = false
        hintVisible.value = false // a single reactive write, once
      }
      stepWorld(world, dt)
    },
    render(alpha) {
      updateCursor(world)
      drawScene(s.ctx, world, alpha, s.width, s.height, { debug: showDebug, motion })
    },
    frame(now, workMs) {
      // Sound is an output layer: it observes new emotes and interaction sounds (always, so nothing
      // stale plays on unmute).
      const events = watchEmotes(world)
      if (synth && soundOn) {
        for (const e of events)
          synth.play(chirpFor(e.creature, e.kind), panFor(e.creature.position.x, s.width))
      }

      if (!showDebug) return // zero cost while the overlay is off
      meter.record(now, workMs)
      if (publish(now)) snapshot.value = createDebugSnapshot(world, seed, meter.stats())
    },
  })
  /** Hand cursor: "grab" over a creature, "grabbing" while holding one. Written only when it changes. */
  let cursor = ''
  function updateCursor(w: typeof world) {
    const p = w.presence
    const next = w.interaction.hold
      ? 'grabbing'
      : p.active && creatureAt(w, p.position.x, p.position.y)
        ? 'grab'
        : ''
    if (next !== cursor && canvasEl.value) {
      cursor = next
      canvasEl.value.style.cursor = next
    }
  }

  loop.start()
})

// Runs on unmount *and* on hot reload — without this, every edit would leave another loop running.
onBeforeUnmount(() => {
  loop?.stop()
  stage?.destroy()
  pointer?.destroy()
  window.removeEventListener('keydown', onKeyDown)
  stopWatchingMotion?.()
  stopWatchingMotion = null
  synth?.close()
  synth = null
  loop = null
  stage = null
  pointer = null
})
</script>

<template>
  <canvas ref="canvas" class="world-canvas" />
  <DebugPanel v-if="debugVisible && snapshot" :snapshot="snapshot" />
  <FirstVisitHint :visible="hintVisible" />
  <MuteToggle :muted="muted" @toggle="toggleSound" />
</template>

<style scoped>
.world-canvas {
  display: block; /* canvas is inline by default, which adds a few px of line-height gap */
  width: 100%;
  height: 100%;
  touch-action: none; /* touches on the pool are interactions, not scrolling/zooming */
}
</style>
