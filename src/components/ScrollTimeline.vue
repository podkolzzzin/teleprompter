<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  /** Scroll progress from 0 to 1 */
  progress: number
  /** Seconds remaining at current speed; negative means unavailable */
  timeLeft: number
}>()

const emit = defineEmits<{
  seek: [progress: number]
}>()

const barEl = ref<HTMLElement | null>(null)
const dragging = ref(false)

function progressFromPointer(e: PointerEvent): number {
  if (!barEl.value) return 0
  const rect = barEl.value.getBoundingClientRect()
  return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
}

function onPointerDown(e: PointerEvent) {
  dragging.value = true
  emit('seek', progressFromPointer(e))
  barEl.value?.setPointerCapture?.(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value) return
  emit('seek', progressFromPointer(e))
}

function onPointerUp(e: PointerEvent) {
  if (!dragging.value) return
  dragging.value = false
  barEl.value?.releasePointerCapture?.(e.pointerId)
}

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}
</script>

<template>
  <div class="scroll-timeline">
    <div
      ref="barEl"
      class="tl-bar"
      @pointerdown.stop.prevent="onPointerDown"
      @pointermove.stop="onPointerMove"
      @pointerup.stop="onPointerUp"
      title="Timeline — drag to seek"
    >
      <div class="tl-track">
        <div class="tl-fill" :style="{ width: (progress * 100) + '%' }"></div>
      </div>
      <div class="tl-thumb" :style="{ left: (progress * 100) + '%' }"></div>
    </div>
    <div class="tl-labels">
      <span class="tl-elapsed">{{ Math.round(progress * 100) }}%</span>
      <span v-if="timeLeft >= 0" class="tl-time-left">{{ formatTime(timeLeft) }} left</span>
    </div>
  </div>
</template>

<style scoped>
.scroll-timeline {
  width: 100%;
  user-select: none;
}

.tl-bar {
  position: relative;
  height: 20px;
  cursor: pointer;
  touch-action: none;
  display: flex;
  align-items: center;
}

.tl-track {
  position: absolute;
  left: 0;
  right: 0;
  height: 4px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
}

.tl-fill {
  height: 100%;
  background: var(--accent, #4ade80);
  border-radius: 2px;
  pointer-events: none;
}

.tl-thumb {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--accent, #4ade80);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s, transform 0.1s;
}

.tl-bar:hover .tl-thumb,
.tl-bar:active .tl-thumb {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1.1);
}

.tl-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}
</style>
