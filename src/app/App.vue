<script setup lang="ts">
// UI shell only (ADR 0001): the world is drawn on a canvas; Vue hosts it and, later, overlay UI.
import WorldCanvas from './WorldCanvas.vue'
</script>

<template>
  <WorldCanvas />
</template>

<style>
html,
body {
  margin: 0;
  height: 100%;
  overflow: hidden;
  background: #0e2a3a;
  color: #e8f4f2;
  font-family: system-ui, sans-serif;
}

#app {
  height: 100%;
}
</style>
