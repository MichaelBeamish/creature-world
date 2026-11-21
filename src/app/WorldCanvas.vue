<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef } from 'vue'
import { createStage, type Stage } from '../render/stage'
import { createDemoDot, drawDemoDot, stepDemoDot } from './demoDot'
import { createGameLoop, type GameLoop } from './gameLoop'

const canvasEl = useTemplateRef<HTMLCanvasElement>('canvas')

// Deliberately NOT reactive (ADR 0001): per-frame objects must stay out of Vue's reactivity system.
let stage: Stage | null = null
let loop: GameLoop | null = null

onMounted(() => {
  if (!canvasEl.value) return
  const s = createStage(canvasEl.value)
  const dot = createDemoDot()
  stage = s

  loop = createGameLoop({
    step(dt) {
      stepDemoDot(dot, dt, s.width, s.height)
    },
    render(alpha) {
      s.ctx.fillStyle = '#0e2a3a'
      s.ctx.fillRect(0, 0, s.width, s.height)
      drawDemoDot(s.ctx, dot, alpha)
    },
  })
  loop.start()
})

// Runs on unmount *and* on hot reload — without this, every edit would leave another loop running.
onBeforeUnmount(() => {
  loop?.stop()
  stage?.destroy()
  loop = null
  stage = null
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
}
</style>
