<template>
  <div class="tp-root" :class="{ mirrored: mirror, 'controls-hidden': controlsHidden }">
    <!-- Focus gradient overlay -->
    <div class="focus-overlay"></div>

    <!-- Frame edit overlay -->
    <div v-if="editingFrame" class="frame-edit-overlay">
      <div class="frame-box" :style="frameBoxStyle">
        <div class="frame-handle frame-handle-left" @pointerdown.prevent="onFramePointerDown('resize-left', $event)"></div>
        <div class="frame-handle frame-handle-right" @pointerdown.prevent="onFramePointerDown('resize-right', $event)"></div>
        <div class="frame-move-zone" @pointerdown.prevent="onFramePointerDown('move', $event)">
          <div class="frame-instructions">↔ Drag to move · Drag edges to resize</div>
        </div>
      </div>
    </div>

    <!-- Scrolling content area -->
    <div
      ref="scrollEl"
      class="tp-scroll"
      :style="{ fontSize: fontSize + 'px' }"
      @click="onScrollClick"
    >
      <div class="tp-content prose" :style="contentAreaStyle" v-html="renderedContent"></div>
      <div class="tp-spacer"></div>
    </div>

    <!-- Controls overlay -->
    <div class="controls" @click.stop>
      <div class="controls-inner">
        <button class="ctrl-btn back-btn" @click="router.push('/')" title="Back">
          ←
        </button>

        <span class="ctrl-separator" aria-hidden="true"></span>

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

        <span class="ctrl-separator" aria-hidden="true"></span>

        <button
          class="ctrl-btn icon-btn"
          :class="{ active: editingFrame }"
          @click="editingFrame = !editingFrame"
          title="Edit prompter frame (F)"
        >
          ⬜
        </button>

        <button
          class="ctrl-btn icon-btn"
          :class="{ active: mirror }"
          @click="mirror = !mirror"
          title="Mirror mode (M)"
        >
          ↔
        </button>

        <span class="ctrl-separator" aria-hidden="true"></span>

        <!-- Remote control share button -->
        <button
          class="ctrl-btn icon-btn share-btn"
          :class="{ active: remoteConnected }"
          @click="openShareModal"
          title="Remote control"
        >
          📲
        </button>

        <!-- Session share button -->
        <button
          class="ctrl-btn icon-btn"
          @click="openSessionShare"
          title="Share this session (S)"
        >
          📤
        </button>

        <button class="ctrl-btn icon-btn hide-btn" @click="controlsHidden = !controlsHidden" title="Toggle controls">
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

    <!-- Remote control share modal -->
    <ShareModal
      v-if="showShareModal"
      :shareUrl="remoteUrl"
      :connected="remoteConnected"
      @close="showShareModal = false"
    />

    <!-- Session share modal -->
    <SessionModal
      v-if="sessionShareOpen"
      :url="sessionShareUrl"
      :status="sessionShareStatus"
      :error-message="sessionShareError"
      @close="closeSessionShare"
    >
      <template #title>
        <h2 class="modal-title">📤 Share Session</h2>
        <p class="modal-desc">Scan the QR code or share the link to let someone view this exact teleprompter session on their device.</p>
      </template>
    </SessionModal>

    <div v-if="loading" class="loading">Loading…</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { marked } from 'marked'
import { getScript } from '../storage/db'
import ShareModal from './ShareModal.vue'
import SessionModal from './SessionModal.vue'
import { useRemoteHost, useShareHost, type RemoteCommand } from '../composables/useRemoteControl'

const router = useRouter()
const route = useRoute()

const loading = ref(true)
const rawContent = ref('')
const playing = ref(false)
const speed = ref(5)
const fontSize = ref(48)
const mirror = ref(false)
const controlsHidden = ref(false)
const editingFrame = ref(false)
const areaWidth = ref(900)
const areaOffsetX = ref(0)
const showShareModal = ref(false)

const scrollEl = ref<HTMLElement | null>(null)
let rafId: number | null = null
let lastTime: number | null = null

// ── Remote control (smartphone controls the teleprompter) ─────────────────────
function handleRemoteCommand(cmd: RemoteCommand) {
  if (cmd.type === 'togglePlay') togglePlay()
  else if (cmd.type === 'speedUp') speed.value = Math.min(20, speed.value + 1)
  else if (cmd.type === 'speedDown') speed.value = Math.max(1, speed.value - 1)
  else if (cmd.type === 'fontUp') fontSize.value = Math.min(96, fontSize.value + 4)
  else if (cmd.type === 'fontDown') fontSize.value = Math.max(24, fontSize.value - 4)
  else if (cmd.type === 'toggleMirror') mirror.value = !mirror.value
  else if (cmd.type === 'reset' && scrollEl.value) scrollEl.value.scrollTop = 0
  else if (cmd.type === 'scrollUp' && scrollEl.value) scrollEl.value.scrollTop = Math.max(0, scrollEl.value.scrollTop - 120)
  else if (cmd.type === 'scrollDown' && scrollEl.value) scrollEl.value.scrollTop += 120
}

const { peerId: remotePeerId, connected: remoteConnected, init: initRemoteHost, broadcastState } =
  useRemoteHost(handleRemoteCommand)

const remoteUrl = computed(() => {
  if (!remotePeerId.value) return ''
  return `${window.location.origin}/remote/${remotePeerId.value}`
})

function openShareModal() {
  if (!remotePeerId.value) initRemoteHost()
  showShareModal.value = true
}

// Auto-close share modal once remote client connects
watch(remoteConnected, (connected) => {
  if (connected) showShareModal.value = false
})

// Broadcast state changes to remote controllers (throttled to avoid excessive sends)
let broadcastTimer: ReturnType<typeof setTimeout> | null = null
watch([playing, speed, fontSize, mirror], () => {
  if (broadcastTimer) clearTimeout(broadcastTimer)
  broadcastTimer = setTimeout(() => {
    broadcastState({
      playing: playing.value,
      speed: speed.value,
      fontSize: fontSize.value,
      mirror: mirror.value,
    })
  }, 50)
})

// ── Session share (share current session state to another device) ─────────────
const sessionShareOpen = ref(false)
const { peerId: sessionPeerId, status: sessionShareHostStatus, error: sessionShareHostError, start: startShareHost, send: sendSession, stop: stopShareHost } = useShareHost()
const sessionShareUrl = ref('')
const sessionShareStatus = computed(() => sessionShareHostStatus.value)
const sessionShareError = computed(() => sessionShareHostError.value)

async function openSessionShare() {
  sessionShareOpen.value = true
  try {
    await startShareHost()
    sessionShareUrl.value = `${window.location.origin}/share/${sessionPeerId.value}`
  } catch {
    // error state is set in the composable
  }
}

watch(sessionShareHostStatus, (newStatus) => {
  if (newStatus === 'connected') {
    sendSession({
      type: 'session',
      content: rawContent.value,
      settings: {
        speed: speed.value,
        fontSize: fontSize.value,
        mirror: mirror.value,
        areaWidth: areaWidth.value,
        areaOffsetX: areaOffsetX.value,
      },
      scrollOffset: scrollEl.value?.scrollTop ?? 0,
    })
  }
})

function closeSessionShare() {
  sessionShareOpen.value = false
  stopShareHost()
  sessionShareUrl.value = ''
}

// ── Rendered content ──────────────────────────────────────────────────────────
const renderedContent = computed(() => {
  return marked.parse(rawContent.value || '') as string
})

const contentAreaStyle = computed(() => ({
  maxWidth: `${areaWidth.value}px`,
  marginLeft: `calc(50% - ${areaWidth.value / 2}px + ${areaOffsetX.value}px)`,
}))

const frameBoxStyle = computed(() => ({
  left: `calc(50% - ${areaWidth.value / 2}px + ${areaOffsetX.value}px)`,
  width: `${areaWidth.value}px`,
}))

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
  document.removeEventListener('pointermove', onFramePointerMove)
  document.removeEventListener('pointerup', onFramePointerUp)
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
  } else if (e.code === 'ArrowLeft') {
    e.preventDefault()
    fontSize.value = Math.max(24, fontSize.value - 4)
  } else if (e.code === 'ArrowRight') {
    e.preventDefault()
    fontSize.value = Math.min(96, fontSize.value + 4)
  } else if (e.key === 'm' || e.key === 'M') {
    mirror.value = !mirror.value
  } else if (e.key === 'h' || e.key === 'H') {
    controlsHidden.value = !controlsHidden.value
  } else if (e.key === 'f' || e.key === 'F') {
    editingFrame.value = !editingFrame.value
  } else if (e.key === 's' || e.key === 'S') {
    if (!sessionShareOpen.value) openSessionShare()
  } else if (e.key === 'r' || e.key === 'R') {
    if (scrollEl.value) scrollEl.value.scrollTop = 0
  } else if (e.code === 'Escape') {
    if (editingFrame.value) {
      editingFrame.value = false
    } else {
      router.push('/')
    }
  }
}

function onScrollClick() {
  if (!editingFrame.value) togglePlay()
}

// Frame drag/resize
type FrameAction = 'move' | 'resize-left' | 'resize-right'
let frameAction: FrameAction | null = null
let frameStartX = 0
let frameStartWidth = 0
let frameStartOffsetX = 0

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function clampOffset(offset: number, width: number) {
  const maxOffset = Math.max(0, (window.innerWidth - width) / 2)
  return clamp(offset, -maxOffset, maxOffset)
}

function onFramePointerDown(action: FrameAction, e: PointerEvent) {
  frameAction = action
  frameStartX = e.clientX
  frameStartWidth = areaWidth.value
  frameStartOffsetX = areaOffsetX.value
  document.addEventListener('pointermove', onFramePointerMove)
  document.addEventListener('pointerup', onFramePointerUp)
}

function onFramePointerMove(e: PointerEvent) {
  if (!frameAction) return
  const dx = (e.clientX - frameStartX) * (mirror.value ? -1 : 1)

  if (frameAction === 'move') {
    areaOffsetX.value = clampOffset(frameStartOffsetX + dx, areaWidth.value)
  } else if (frameAction === 'resize-left') {
    const newWidth = clamp(frameStartWidth - dx, 300, window.innerWidth)
    areaWidth.value = newWidth
    areaOffsetX.value = clampOffset(frameStartOffsetX + (frameStartWidth - newWidth) / 2, newWidth)
  } else if (frameAction === 'resize-right') {
    const newWidth = clamp(frameStartWidth + dx, 300, window.innerWidth)
    areaWidth.value = newWidth
    areaOffsetX.value = clampOffset(frameStartOffsetX + (newWidth - frameStartWidth) / 2, newWidth)
  }
}

function onFramePointerUp() {
  frameAction = null
  document.removeEventListener('pointermove', onFramePointerMove)
  document.removeEventListener('pointerup', onFramePointerUp)
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

.ctrl-btn.icon-btn {
  padding: 10px 12px;
  min-width: 44px;
  text-align: center;
}

.ctrl-btn.icon-btn.active {
  background: rgba(74, 222, 128, 0.25);
  border-color: var(--accent);
  color: var(--accent);
}

.ctrl-separator {
  width: 1px;
  height: 24px;
  background: rgba(255, 255, 255, 0.15);
  flex-shrink: 0;
}

.play-btn {
  background: var(--accent);
  color: #111;
  border-color: transparent;
  font-size: 20px;
  min-width: 52px;
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

/* Focus gradient overlay - dims top/bottom, highlights center */
.focus-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 10;
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.6) 0%,
    rgba(0, 0, 0, 0.15) 25%,
    transparent 40%,
    transparent 60%,
    rgba(0, 0, 0, 0.15) 75%,
    rgba(0, 0, 0, 0.6) 100%
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

/* Frame edit overlay */
.frame-edit-overlay {
  position: fixed;
  inset: 0;
  z-index: 15;
  pointer-events: none;
}

.tp-root.mirrored .frame-edit-overlay {
  transform: scaleX(-1);
}

.tp-root.mirrored .frame-instructions {
  transform: scaleX(-1);
}

.frame-box {
  position: absolute;
  top: 0;
  bottom: 0;
  border: 2px dashed rgba(74, 222, 128, 0.5);
  border-radius: 4px;
}

.frame-handle {
  pointer-events: auto;
  position: absolute;
  top: 0;
  bottom: 0;
  width: 44px;
  cursor: ew-resize;
  touch-action: none;
  background: rgba(74, 222, 128, 0.08);
  transition: background 0.2s;
}

.frame-handle:hover,
.frame-handle:active {
  background: rgba(74, 222, 128, 0.2);
}

.frame-handle::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 4px;
  height: 40px;
  border-radius: 2px;
  background: rgba(74, 222, 128, 0.5);
}

.frame-handle-left {
  left: -22px;
}

.frame-handle-right {
  right: -22px;
}

.frame-move-zone {
  pointer-events: auto;
  position: absolute;
  inset: 0;
  cursor: move;
  touch-action: none;
  z-index: -1;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 40px;
}

.frame-instructions {
  background: rgba(0, 0, 0, 0.7);
  color: rgba(255, 255, 255, 0.7);
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  white-space: nowrap;
  pointer-events: none;
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
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding-bottom: 0.3em;
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

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
}

.modal-desc {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.5;
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
