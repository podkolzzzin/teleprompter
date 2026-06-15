<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import type { DisplayOrientation } from '../composables/useDisplayOrientation'

const orientation = defineModel<DisplayOrientation>({ required: true })
const open = shallowRef(false)

const options: Array<{ value: DisplayOrientation; label: string; shortLabel: string }> = [
  { value: 'auto', label: 'Auto', shortLabel: 'Auto' },
  { value: 'portrait', label: 'Vertical', shortLabel: 'Vertical' },
  { value: 'landscape', label: 'Horizontal', shortLabel: 'Horizontal' },
]

const currentOption = computed(() => (
  options.find(option => option.value === orientation.value) ?? options[0]
))

function selectOrientation(value: DisplayOrientation) {
  orientation.value = value
  open.value = false
}
</script>

<template>
  <div class="orientation-control">
    <button
      type="button"
      class="orientation-trigger"
      :class="{ active: orientation !== 'auto' }"
      :title="`Screen orientation: ${currentOption.label}`"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click="open = !open"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M9 7h6" />
        <path d="M12 17h.01" />
      </svg>
      <span class="orientation-value">{{ currentOption.shortLabel }}</span>
    </button>

    <div v-if="open" class="orientation-menu" role="menu" aria-label="Screen orientation">
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        class="orientation-option"
        :class="{ selected: orientation === option.value }"
        role="menuitemradio"
        :aria-checked="orientation === option.value"
        @click="selectOrientation(option.value)"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.orientation-control {
  position: relative;
  flex-shrink: 0;
}

.orientation-trigger {
  min-width: 88px;
  min-height: 40px;
  padding: 6px 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  background: transparent;
  color: rgba(255, 255, 255, 0.8);
}

.orientation-trigger:hover,
.orientation-trigger.active {
  background: rgba(74, 222, 128, 0.15);
  color: var(--accent);
}

.orientation-value {
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.orientation-menu {
  position: fixed;
  right: 16px;
  bottom: 76px;
  width: 150px;
  padding: 6px;
  display: grid;
  gap: 4px;
  background: rgba(0, 0, 0, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
  z-index: 40;
}

.orientation-option {
  min-height: 42px;
  padding: 8px 12px;
  background: transparent;
  color: rgba(255, 255, 255, 0.8);
  text-align: left;
}

.orientation-option:hover,
.orientation-option.selected {
  background: rgba(74, 222, 128, 0.15);
  color: var(--accent);
}

@media (max-width: 640px) {
  .orientation-trigger {
    min-width: 76px;
    min-height: 36px;
    padding: 5px 6px;
  }

  .orientation-value {
    font-size: 10px;
  }

  .orientation-menu {
    right: 12px;
    left: 12px;
    width: auto;
    grid-template-columns: repeat(3, 1fr);
    padding: 8px;
  }

  .orientation-option {
    text-align: center;
  }
}
</style>
