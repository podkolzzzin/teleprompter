<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  /** Scroll progress from 0 to 1 */
  progress: number
  /** Seconds remaining at current speed; negative means unavailable */
  timeLeft: number
}>()

const emit = defineEmits<{
  reset: []
  step: [direction: -1 | 1]
}>()

const clampedProgress = computed(() => Math.max(0, Math.min(1, props.progress)))
const progressPercent = computed(() => Math.round(clampedProgress.value * 100))
const progressStyle = computed(() => ({ width: `${clampedProgress.value * 100}%` }))

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}
</script>

<template>
  <div class="scroll-timeline" aria-label="Script progress">
    <div class="tl-controls">
      <button
        type="button"
        class="tl-btn"
        :disabled="clampedProgress <= 0"
        aria-label="Jump backward"
        title="Jump backward"
        @click.stop="emit('step', -1)"
      >
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M11 19l-7-7 7-7" />
          <path d="M20 19l-7-7 7-7" />
        </svg>
      </button>

      <div class="tl-meter" role="meter" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="progressPercent">
        <div class="tl-track">
          <div class="tl-fill" :style="progressStyle"></div>
        </div>
      </div>

      <button
        type="button"
        class="tl-btn"
        :disabled="clampedProgress <= 0"
        aria-label="Restart"
        title="Restart"
        @click.stop="emit('reset')"
      >
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <path d="M3 3v6h6" />
        </svg>
      </button>

      <button
        type="button"
        class="tl-btn"
        :disabled="clampedProgress >= 1"
        aria-label="Jump forward"
        title="Jump forward"
        @click.stop="emit('step', 1)"
      >
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M13 5l7 7-7 7" />
          <path d="M4 5l7 7-7 7" />
        </svg>
      </button>
    </div>

    <div class="tl-labels">
      <span class="tl-elapsed">{{ progressPercent }}%</span>
      <span v-if="timeLeft >= 0" class="tl-time-left">{{ formatTime(timeLeft) }} left</span>
    </div>
  </div>
</template>

<style scoped>
.scroll-timeline {
  width: 100%;
  user-select: none;
}

.tl-controls {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) 34px 34px;
  align-items: center;
  gap: 8px;
}

.tl-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.86);
  cursor: pointer;
  touch-action: manipulation;
}

.tl-btn:disabled {
  cursor: default;
  opacity: 0.35;
}

.tl-meter {
  display: flex;
  align-items: center;
  min-width: 0;
  height: 34px;
  pointer-events: none;
}

.tl-track {
  width: 100%;
  height: 5px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
}

.tl-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--accent, #4ade80);
}

.tl-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}
</style>
