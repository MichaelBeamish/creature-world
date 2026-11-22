<script setup lang="ts">
// An invisible but real <button> laid exactly over the chest drawn on the canvas: focusable (Tab), works with
// Enter/Space and clicks/taps, and announces open/closed to screen readers. The chest itself is drawn in the canvas.
defineProps<{ rect: { x: number; y: number; width: number; height: number }; open: boolean }>()
defineEmits<{ toggle: [] }>()
</script>

<template>
  <button
    class="chest-toggle"
    type="button"
    :aria-expanded="open"
    :aria-label="open ? 'Close the treasure chest' : 'Open the treasure chest'"
    :title="open ? 'Close the chest' : 'Open the chest — drag what you find into the water'"
    :style="{
      left: `${rect.x}px`,
      top: `${rect.y}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    }"
    @click="$emit('toggle')"
  />
</template>

<style scoped>
.chest-toggle {
  position: fixed;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
}
.chest-toggle:focus-visible {
  outline: 2px solid #ffd68c;
  outline-offset: 3px;
}
</style>
