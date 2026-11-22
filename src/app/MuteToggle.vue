<script setup lang="ts">
// A real <button>: focusable, works with Enter/Space, announces its state to screen readers.
defineProps<{ muted: boolean }>()
defineEmits<{ toggle: [] }>()
</script>

<template>
  <button
    class="mute-toggle"
    type="button"
    :aria-pressed="!muted"
    :aria-label="muted ? 'Turn creature sounds on' : 'Turn creature sounds off'"
    :title="muted ? 'Sound off — click to hear the creatures' : 'Sound on'"
    @click="$emit('toggle')"
  >
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
      <template v-if="muted">
        <path
          d="M16 9l5 6M21 9l-5 6"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
      </template>
      <template v-else>
        <path
          d="M16 9.5a3.5 3.5 0 0 1 0 5M18.5 7a7 7 0 0 1 0 10"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          fill="none"
        />
      </template>
    </svg>
  </button>
</template>

<style scoped>
.mute-toggle {
  position: fixed;
  right: 14px;
  bottom: 14px;
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 50%;
  background: rgb(8 24 34 / 70%);
  color: #e8f4f2;
  cursor: pointer;
  opacity: 0.75;
  transition: opacity 0.2s;
}
.mute-toggle:hover,
.mute-toggle:focus-visible {
  opacity: 1;
}
.mute-toggle:focus-visible {
  outline: 2px solid #7fd3ff;
  outline-offset: 2px;
}
</style>
