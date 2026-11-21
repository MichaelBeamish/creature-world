<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef } from 'vue'
import { createPointerInput, type PointerInput } from '../input/pointer'
import { drawScene } from '../render/scene'
import { createStage, type Stage } from '../render/stage'
import { setPresenceInput } from '../simulation/presence'
import { createWorld, resizeWorld, stepWorld } from '../simulation/world'
import { createGameLoop, type GameLoop } from './gameLoop'
import { resolveSeed } from './seed'

const CREATURE_COUNT = 5

const canvasEl = useTemplateRef<HTMLCanvasElement>('canvas')

// Deliberately NOT reactive (ADR 0001): per-frame objects must stay out of Vue's reactivity system.
let stage: Stage | null = null
let loop: GameLoop | null = null
let pointer: PointerInput | null = null

onMounted(() => {
  if (!canvasEl.value) return
  const s = createStage(canvasEl.value)
  stage = s
  const input = createPointerInput(canvasEl.value, () => performance.now())
  pointer = input
  const debug = new URLSearchParams(window.location.search).has('debug')

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
      setPresenceInput(world.presence, sample.x, sample.y, sample.active)
      stepWorld(world, dt)
    },
    render(alpha) {
      drawScene(s.ctx, world, alpha, s.width, s.height, { debug })
    },
  })
  loop.start()
})

// Runs on unmount *and* on hot reload — without this, every edit would leave another loop running.
onBeforeUnmount(() => {
  loop?.stop()
  stage?.destroy()
  pointer?.destroy()
  loop = null
  stage = null
  pointer = null
})
</script>

<template>
  <canvas ref="canvas" class="world-canvas" />
</template>

<style scoped>
.world-canvas {
  display: block; /* canvas is inline by default, which adds a few px of line-height gap */
  width: 100%;
  height: 100%;
  touch-action: none; /* touches on the pool are interactions, not scrolling/zooming */
}
</style>
