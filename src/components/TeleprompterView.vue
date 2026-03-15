<template>
  <div class="tp-root" :class="{ mirrored: mirror, 'controls-hidden': controlsHidden }">
    <!-- Scrolling content area -->
    <div
      ref="scrollEl"
      class="tp-scroll"
      :style="{ fontSize: fontSize + 'px' }"
      @click="togglePlay"
    >
      <div class="tp-content prose" v-html="renderedContent"></div>
      <div class="tp-spacer"></div>
    </div>

    <!-- Controls overlay -->
    <div class="controls" @click.stop>
      <div class="controls-inner">
        <button class="ctrl-btn back-btn" @click="router.push('/')" title="Back">
          ←
        </button>

        <button class="ctrl-btn play-btn" @click="togglePlay" :title="playing ? 'Pause' : 'Play'">
          {{ playing ? '⏸' : '▶' }}
        </button>

        <div class="ctrl-group">
          <label class="ctrl-label">Speed</label>
          <input
            type="range"
            min="1"
            max="20"
            v-model.number="speed"
            class="ctrl-slider"
            title="Scroll speed"
          />
          <span class="ctrl-value">{{ speed }}</span>
        </div>

        <div class="ctrl-group">
          <label class="ctrl-label">Size</label>
          <input
            type="range"
            min="24"
            max="96"
            step="4"
            v-model.number="fontSize"
            class="ctrl-slider"
            title="Font size"
          />
          <span class="ctrl-value">{{ fontSize }}px</span>
        </div>

        <button
          class="ctrl-btn mirror-btn"
          :class="{ active: mirror }"
          @click="mirror = !mirror"
          title="Mirror mode"
        >
          ↔ Mirror
        </button>

        <button class="ctrl-btn hide-btn" @click="controlsHidden = !controlsHidden" title="Toggle controls">
          {{ controlsHidden ? '⚙' : '✕' }}
        </button>
      </div>
    </div>

    <!-- Tap hint when playing -->
    <div v-if="playing && !controlsHidden" class="tap-hint">Tap text to pause</div>

    <!-- Show controls button when hidden -->
    <button v-if="controlsHidden" class="show-controls-btn" @click.stop="controlsHidden = false">
      ⚙
    </button>

    <div v-if="loading" class="loading">Loading…</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { marked } from 'marked'
import { getScript } from '../storage/db'

const router = useRouter()
const route = useRoute()

const loading = ref(true)
const rawContent = ref('')
const playing = ref(false)
const speed = ref(5)
const fontSize = ref(48)
const mirror = ref(false)
const controlsHidden = ref(false)

const scrollEl = ref<HTMLElement | null>(null)
let rafId: number | null = null
let lastTime: number | null = null

const renderedContent = computed(() => {
  const result = marked(rawContent.value || '')
  return typeof result === 'string' ? result : ''
})

onMounted(async () => {
  const id = Number(route.params.id)
  if (id) {
    const script = await getScript(id)
    if (script) {
      rawContent.value = script.content
    }
  }
  loading.value = false
  window.addEventListener('keydown', handleKey)
})

onUnmounted(() => {
  stopScroll()
  window.removeEventListener('keydown', handleKey)
})

function togglePlay() {
  playing.value ? pauseScroll() : startScroll()
}

function startScroll() {
  playing.value = true
  lastTime = null
  rafId = requestAnimationFrame(tick)
}

function pauseScroll() {
  playing.value = false
  stopScroll()
}

function stopScroll() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
}

function tick(ts: number) {
  if (lastTime === null) lastTime = ts
  const delta = ts - lastTime
  lastTime = ts

  if (scrollEl.value) {
    // pixels per second = speed * 20
    const pps = speed.value * 20
    scrollEl.value.scrollTop += (pps * delta) / 1000

    // Stop at bottom
    const el = scrollEl.value
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) {
      playing.value = false
      return
    }
  }

  if (playing.value) {
    rafId = requestAnimationFrame(tick)
  }
}

function handleKey(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  if (e.code === 'Space') {
    e.preventDefault()
    togglePlay()
  } else if (e.code === 'ArrowUp') {
    e.preventDefault()
    speed.value = Math.min(20, speed.value + 1)
  } else if (e.code === 'ArrowDown') {
    e.preventDefault()
    speed.value = Math.max(1, speed.value - 1)
  }
}

// Restart RAF when speed changes while playing
watch(speed, () => {
  if (playing.value) {
    stopScroll()
    startScroll()
  }
})
</script>

<style scoped>
.tp-root {
  position: fixed;
  inset: 0;
  background: #000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  user-select: none;
}

.tp-root.mirrored .tp-scroll {
  transform: scaleX(-1);
}

.tp-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  cursor: pointer;
  scrollbar-width: none;
}

.tp-scroll::-webkit-scrollbar {
  display: none;
}

.tp-content {
  padding: 32px 48px 0;
  max-width: 900px;
  margin: 0 auto;
  line-height: 1.5;
}

.tp-spacer {
  height: 80vh;
}

/* Controls overlay */
.controls {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.9));
  padding: 24px 16px 16px;
  transition: opacity 0.3s, transform 0.3s;
  z-index: 20;
}

.controls-hidden .controls {
  opacity: 0;
  transform: translateY(100%);
  pointer-events: none;
}

.controls-inner {
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 900px;
  margin: 0 auto;
  flex-wrap: wrap;
}

.ctrl-btn {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 18px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: background 0.2s;
  flex-shrink: 0;
}

.ctrl-btn:hover {
  background: rgba(255, 255, 255, 0.22);
  opacity: 1;
}

.play-btn {
  background: var(--accent);
  color: #111;
  border-color: transparent;
  font-size: 20px;
  min-width: 52px;
}

.mirror-btn.active {
  background: rgba(74, 222, 128, 0.25);
  border-color: var(--accent);
  color: var(--accent);
}

.ctrl-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ctrl-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.ctrl-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100px;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.ctrl-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
}

.ctrl-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
  border: none;
}

.ctrl-value {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  min-width: 36px;
}

.tap-hint {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 13px;
  color: rgba(255, 255, 255, 0.4);
  pointer-events: none;
}

.show-controls-btn {
  position: fixed;
  bottom: 16px;
  right: 16px;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  width: 44px;
  height: 44px;
  font-size: 18px;
  padding: 0;
  z-index: 30;
}

.loading {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  font-size: 18px;
  color: var(--text-muted);
}

/* Prose styles for teleprompter */
.prose :deep(h1),
.prose :deep(h2),
.prose :deep(h3) {
  color: #fff;
  margin: 0.6em 0 0.3em;
  line-height: 1.3;
}
.prose :deep(h1) { font-size: 1.4em; }
.prose :deep(h2) { font-size: 1.2em; }
.prose :deep(h3) { font-size: 1.05em; }
.prose :deep(p) {
  color: #fff;
  margin-bottom: 0.6em;
}
.prose :deep(ul),
.prose :deep(ol) {
  padding-left: 1.2em;
  margin-bottom: 0.6em;
}
.prose :deep(li) {
  color: #fff;
  margin-bottom: 0.25em;
}
.prose :deep(strong) { color: var(--accent); }
.prose :deep(em) { color: #ddd; font-style: italic; }
.prose :deep(blockquote) {
  border-left: 4px solid var(--accent);
  padding-left: 1em;
  color: #ccc;
  margin: 0.6em 0;
}
.prose :deep(hr) {
  border: none;
  border-top: 1px solid #333;
  margin: 1em 0;
}

@media (max-width: 640px) {
  .tp-content {
    padding: 24px 24px 0;
  }
  .ctrl-slider {
    width: 70px;
  }
  .controls-inner {
    gap: 8px;
  }
  .ctrl-btn {
    padding: 8px 12px;
    font-size: 16px;
  }
}
</style>
