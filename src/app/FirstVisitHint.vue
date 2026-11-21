<script setup lang="ts">
// A quiet nudge for first-time visitors; it fades away the moment they interact.
defineProps<{ visible: boolean }>()

// Touch screens have no hovering cursor, so the wording adapts.
const touch = window.matchMedia('(hover: none)').matches
const text = touch ? 'tap near them…' : 'move your cursor near them…'
</script>

<template>
  <!-- type="transition": the fade-in is a CSS animation, the fade-out a transition; tell Vue to wait for the
       transition, or it waits for an animationend that already happened and never removes the hint. -->
  <Transition name="hint" type="transition">
    <p v-if="visible" class="hint">{{ text }}</p>
  </Transition>
</template>

<style scoped>
.hint {
  position: fixed;
  left: 50%;
  bottom: 28px;
  transform: translateX(-50%);
  margin: 0;
  color: #cfe7e9;
  font:
    italic 15px/1.4 system-ui,
    sans-serif;
  letter-spacing: 0.02em;
  opacity: 0;
  pointer-events: none;
  /* Appear after a moment, so the creatures get the first look. */
  animation: hint-in 1.2s ease 1.5s forwards;
}
@keyframes hint-in {
  to {
    opacity: 0.7;
  }
}
.hint-leave-active {
  transition: opacity 0.8s ease;
}
.hint-leave-to {
  opacity: 0 !important;
}
</style>
