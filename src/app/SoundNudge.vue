<script setup lang="ts">
// "Turn on sound for the music" (task #32b): shown beside the mute button when the party starts while muted.
// A real button — clicking it turns sound on (a user gesture, so the browser allows audio).
defineProps<{ visible: boolean }>()
const emit = defineEmits<{ enable: [] }>()
</script>

<template>
  <Transition name="nudge">
    <button v-if="visible" type="button" class="sound-nudge" @click="emit('enable')">
      🔈 Turn on sound for the music
    </button>
  </Transition>
</template>

<style scoped>
.sound-nudge {
  position: fixed;
  right: 64px;
  bottom: 18px;
  padding: 8px 14px;
  border: 1px solid rgba(255, 214, 120, 0.6);
  border-radius: 999px;
  background: rgba(20, 24, 52, 0.85);
  color: #ffe9b0;
  font:
    500 14px/1.2 system-ui,
    sans-serif;
  cursor: pointer;
  box-shadow: 0 0 18px rgba(255, 79, 216, 0.35);
}
.sound-nudge:hover,
.sound-nudge:focus-visible {
  background: rgba(40, 32, 80, 0.95);
  outline: 2px solid #ffe9b0;
  outline-offset: 2px;
}
.nudge-enter-active,
.nudge-leave-active {
  transition:
    opacity 0.4s ease,
    transform 0.4s ease;
}
.nudge-enter-from,
.nudge-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
@media (prefers-reduced-motion: reduce) {
  .nudge-enter-active,
  .nudge-leave-active {
    transition: opacity 0.4s ease;
  }
  .nudge-enter-from,
  .nudge-leave-to {
    transform: none;
  }
}
</style>
