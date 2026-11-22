<script setup lang="ts">
// Display-only: renders a plain snapshot (≤ 5 per second). All logic lives in tested TypeScript.
import { ref } from 'vue'
import type { DebugSnapshot } from './debugSnapshot'

defineProps<{ snapshot: DebugSnapshot }>()

const collapsed = ref(false)

const pct = (v: number) => `${Math.round(v * 100)}%`
const fpsClass = (fps: number) => (fps >= 55 ? 'good' : fps >= 40 ? 'ok' : 'bad')
</script>

<template>
  <aside class="debug-panel" aria-label="Debug overlay">
    <header>
      <button
        class="toggle"
        :aria-expanded="!collapsed"
        :title="collapsed ? 'Expand' : 'Collapse'"
        @click="collapsed = !collapsed"
      >
        {{ collapsed ? '▸' : '▾' }}
      </button>
      <strong>debug</strong>
      <span :class="['fps', fpsClass(snapshot.frame.fps)]">
        {{ Math.round(snapshot.frame.fps) }} FPS
      </span>
      <span class="muted">
        frame {{ snapshot.frame.avgFrameMs.toFixed(1) }} ms (worst
        {{ snapshot.frame.worstFrameMs.toFixed(1) }})
      </span>
      <span v-if="!collapsed" class="muted">
        · seed {{ snapshot.seed }} · tick {{ snapshot.tick }} · {{ snapshot.creatures.length }}
        creatures · press D to hide
      </span>
    </header>

    <table v-if="!collapsed">
      <thead>
        <tr>
          <th></th>
          <th>personality</th>
          <th>mood → doing</th>
          <th>sees</th>
          <th>curiosity</th>
          <th>boldness</th>
          <th>energy</th>
          <th>attention</th>
          <th>trust</th>
          <th>rattled</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="c in snapshot.creatures" :key="c.id">
          <td><span class="swatch" :style="{ background: `hsl(${c.hue} 55% 74%)` }"></span></td>
          <td>{{ c.archetype }}</td>
          <td>
            <span :class="['emotion', c.emotion]">{{ c.emotion }}</span> → {{ c.intent }}
          </td>
          <td class="muted">{{ c.stimulus }}</td>
          <td
            v-for="(v, i) in [c.curiosity, c.boldness, c.energy, c.attention, c.trust, c.rattled]"
            :key="i"
          >
            <span class="bar"><span :style="{ width: pct(v) }"></span></span>
          </td>
        </tr>
      </tbody>
    </table>
  </aside>
</template>

<style scoped>
.debug-panel {
  position: fixed;
  top: 12px;
  right: 12px;
  max-width: calc(100vw - 24px);
  padding: 8px 12px;
  border-radius: 10px;
  background: rgb(8 24 34 / 82%);
  color: #e8f4f2;
  font:
    12px/1.5 ui-monospace,
    monospace;
  box-shadow: 0 4px 18px rgb(0 0 0 / 35%);
  pointer-events: auto;
}
header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.toggle {
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
  padding: 0 2px;
}
.muted {
  color: #9fc2c6;
}
.fps.good {
  color: #8fe3a8;
}
.fps.ok {
  color: #ffd166;
}
.fps.bad {
  color: #ff7b7b;
}
table {
  margin-top: 6px;
  border-collapse: collapse;
}
th {
  text-align: left;
  font-weight: normal;
  color: #9fc2c6;
  padding: 0 8px 2px 0;
}
td {
  padding: 1px 8px 1px 0;
  white-space: nowrap;
}
.swatch {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.emotion.curious {
  color: #7fd3ff;
}
.emotion.scared {
  color: #c9a7ff;
}
.emotion.grumpy {
  color: #ff8a5c;
}
.bar {
  display: inline-block;
  width: 48px;
  height: 6px;
  border-radius: 3px;
  background: rgb(255 255 255 / 12%);
  overflow: hidden;
  vertical-align: middle;
}
.bar > span {
  display: block;
  height: 100%;
  background: #7fd3ff;
}
</style>
