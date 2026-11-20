<script setup lang="ts">
// UI shell only (ADR 0001). The canvas world arrives in backlog task #2.
const title = 'Creature World'
</script>

<template>
  <main class="placeholder">
    <h1>{{ title }}</h1>
    <p>Something is stirring in the tide pool…</p>
  </main>
</template>

<style>
html,
body {
  margin: 0;
  height: 100%;
  background: #0e2a3a;
  color: #e8f4f2;
  font-family: system-ui, sans-serif;
}

#app {
  height: 100%;
}
</style>

<style scoped>
.placeholder {
  display: grid;
  place-content: center;
  height: 100%;
  text-align: center;
}
</style>
