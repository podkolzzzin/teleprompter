<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { marked } from 'marked'
import { useShareClient, type SessionPayload } from '../composables/useRemoteControl'

const route = useRoute()
const router = useRouter()
const { status, error, connect, onData } = useShareClient()

const rawContent = ref('')
const playing = ref(false)
const speed = ref(5)
const fontSize = ref(48)
const mirror = ref(false)
const focusOpacity = ref(50)
const controlsHidden = ref(false)
const areaWidth = ref(900)
const areaOffsetX = ref(0)

const scrollEl = ref<HTMLElement | null>(null)
let rafId: number | null = null
let lastTime: number | null = null

const renderedContent = computed(() => marked.parse(rawContent.value || '') as string)

const contentAreaStyle = computed(() => ({
  maxWidth: `${areaWidth.value}px`,
  marginLeft: `calc(50% - ${areaWidth.value / 2}px + ${areaOffsetX.value}px)`,
}))

onMounted(async () => {
  const peerId = route.params.peerId as string
  if (!peerId) {
    router.push('/')
    return
  }

  onData((payload) => {
    if (payload.type === 'session') {
      applySession(payload)
    }
  })

  try {
    await connect(peerId)
  } catch {
    // error is reactive in the composable
  }

  window.addEventListener('keydown', handleKey)
})

onUnmounted(() => {
  stopScroll()
  window.removeEventListener('keydown', handleKey)
})

async function applySession(session: SessionPayload) {
  rawContent.value = session.content
  speed.value = session.settings.speed
  fontSize.value = session.settings.fontSize
  mirror.value = session.settings.mirror
  areaWidth.value = session.settings.areaWidth
  areaOffsetX.value = session.settings.areaOffsetX
  focusOpacity.value = session.settings.focusOpacity ?? 50
  await nextTick()
  if (scrollEl.value) {
    scrollEl.value.scrollTop = session.scrollOffset
  }
}

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
    const pps = speed.value * 20
    scrollEl.value.scrollTop += (pps * delta) / 1000
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
  } else if (e.key === 'm' || e.key === 'M') {
    mirror.value = !mirror.value
  } else if (e.key === 'h' || e.key === 'H') {
    controlsHidden.value = !controlsHidden.value
  } else if (e.key === 'r' || e.key === 'R') {
    if (scrollEl.value) scrollEl.value.scrollTop = 0
  } else if (e.code === 'Escape') {
    router.push('/')
  }
}
</script>

<template>
  <div class="tp-root" :class="{ mirrored: mirror, 'controls-hidden': controlsHidden }">
    <div class="focus-overlay" :style="{ opacity: focusOpacity / 100 }"></div>

    <!-- Connecting overlay -->
    <div v-if="status === 'error' || status === 'connecting' || (status === 'connected' && !rawContent)" class="overlay">
      <div class="overlay-box">
        <template v-if="status === 'error'">
          <p class="overlay-icon">❌</p>
          <p class="overlay-title">Connection failed</p>
          <p class="overlay-sub">{{ error }}</p>
          <button class="btn-back" @click="router.push('/')">← Back</button>
        </template>
        <template v-else-if="status === 'connected'">
          <p class="overlay-icon">⏳</p>
          <p class="overlay-title">Waiting for content…</p>
        </template>
        <template v-else>
          <p class="overlay-icon">🔗</p>
          <p class="overlay-title">Connecting…</p>
          <p class="overlay-sub">Please keep the sender's device open.</p>
        </template>
      </div>
    </div>

    <!-- Scrolling content area -->
    <div
      ref="scrollEl"
      class="tp-scroll"
      :style="{ fontSize: fontSize + 'px' }"
      @click="togglePlay"
    >
      <div class="tp-content prose" :style="contentAreaStyle" v-html="renderedContent"></div>
      <div class="tp-spacer"></div>
    </div>

    <!-- Controls overlay -->
    <div class="controls" @click.stop>
      <div class="controls-inner">
        <button class="ctrl-btn back-btn" @click="router.push('/')" title="Back">←</button>

        <button class="ctrl-btn play-btn" @click="togglePlay" :title="playing ? 'Pause' : 'Play'">
          {{ playing ? '⏸' : '▶' }}
        </button>

        <div class="ctrl-group">
          <label class="ctrl-label">Speed</label>
          <input type="range" min="1" max="20" v-model.number="speed" class="ctrl-slider" />
          <span class="ctrl-value">{{ speed }}</span>
        </div>

        <div class="ctrl-group">
          <label class="ctrl-label">Size</label>
          <input type="range" min="24" max="96" step="4" v-model.number="fontSize" class="ctrl-slider" />
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

        <button class="ctrl-btn hide-btn" @click="controlsHidden = !controlsHidden">
          {{ controlsHidden ? '⚙' : '✕' }}
        </button>
      </div>
    </div>

    <div v-if="playing && !controlsHidden" class="tap-hint">Tap text to pause</div>
    <button v-if="controlsHidden" class="show-controls-btn" @click.stop="controlsHidden = false">⚙</button>
  </div>
</template>

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

.overlay {
  position: fixed;
  inset: 0;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.overlay-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
  padding: 32px;
}

.overlay-icon {
  font-size: 48px;
}

.overlay-title {
  font-size: 22px;
  font-weight: 600;
  color: var(--text);
}

.overlay-sub {
  color: var(--text-muted);
  font-size: 14px;
  max-width: 280px;
}

.btn-back {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
  margin-top: 8px;
}

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

.focus-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 10;
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.95) 0%,
    rgba(0, 0, 0, 0.85) 30%,
    rgba(0, 0, 0, 0.4) 42%,
    transparent 48%,
    transparent 52%,
    rgba(0, 0, 0, 0.4) 58%,
    rgba(0, 0, 0, 0.85) 70%,
    rgba(0, 0, 0, 0.95) 100%
  );
}

.focus-overlay::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 1px;
  background: rgba(74, 222, 128, 0.15);
}

.prose :deep(h1),
.prose :deep(h2),
.prose :deep(h3) {
  color: #fff;
  margin: 0.6em 0 0.3em;
  line-height: 1.3;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding-bottom: 0.3em;
}
.prose :deep(h1) { font-size: 1.4em; }
.prose :deep(h2) { font-size: 1.2em; }
.prose :deep(h3) { font-size: 1.05em; }
.prose :deep(p) { color: #fff; margin-bottom: 0.6em; }
.prose :deep(ul),
.prose :deep(ol) { padding-left: 1.2em; margin-bottom: 0.6em; }
.prose :deep(li) { color: #fff; margin-bottom: 0.25em; }
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
  .tp-content { padding: 24px 24px 0; }
  .ctrl-slider { width: 70px; }
  .controls-inner { gap: 8px; }
  .ctrl-btn { padding: 8px 12px; font-size: 16px; }
}
</style>
