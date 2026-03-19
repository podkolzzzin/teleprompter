<template>
  <div class="tp-root" :class="{ mirrored: mirror, 'controls-hidden': controlsHidden }">
    <!-- Focus gradient overlay -->
    <div class="focus-overlay" :style="{ opacity: focusOpacity / 100 }"></div>

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
      <!-- Timeline progress bar -->
      <ScrollTimeline :progress="scrollProgress" :timeLeft="timeLeft" @seek="onTimelineSeek" />

      <div class="controls-inner">
        <button class="ctrl-btn back-btn" @click="router.push('/')" title="Back">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>

        <button class="ctrl-btn play-btn" @click="togglePlay" :title="playing ? 'Pause' : 'Play'">
          <svg v-if="!playing" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6 4l14 8-14 8V4z"/></svg>
          <svg v-else viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><rect x="5" y="3" width="4" height="18" rx="1"/><rect x="15" y="3" width="4" height="18" rx="1"/></svg>
        </button>

        <label class="ctrl-group">
          <span class="ctrl-label">Speed</span>
          <span class="ctrl-value">{{ speed }}</span>
          <div class="ctrl-popup">
            <input
              id="speed-slider"
              type="range"
              min="1"
              max="20"
              v-model.number="speed"
              class="ctrl-slider"
              title="Scroll speed"
            />
          </div>
        </label>

        <label class="ctrl-group">
          <span class="ctrl-label">Size</span>
          <span class="ctrl-value">{{ fontSize }}px</span>
          <div class="ctrl-popup">
            <input
              id="size-slider"
              type="range"
              min="24"
              max="96"
              step="4"
              v-model.number="fontSize"
              class="ctrl-slider"
              title="Font size"
            />
          </div>
        </label>

        <label class="ctrl-group">
          <span class="ctrl-label">Focus</span>
          <span class="ctrl-value">{{ focusOpacity }}%</span>
          <div class="ctrl-popup">
            <input
              id="focus-slider"
              type="range"
              min="0"
              max="100"
              v-model.number="focusOpacity"
              class="ctrl-slider"
              title="Focus opacity gradient"
            />
          </div>
        </label>

        <span class="ctrl-separator" aria-hidden="true"></span>

        <button
          class="ctrl-btn icon-btn"
          :class="{ active: editingFrame }"
          @click="toggleFrameEdit"
          title="Edit prompter frame (F)"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V4h4"/><path d="M16 4h4v4"/><path d="M20 16v4h-4"/><path d="M8 20H4v-4"/></svg>
        </button>

        <button
          class="ctrl-btn icon-btn"
          :class="{ active: mirror }"
          @click="mirror = !mirror"
          title="Mirror mode (M)"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 16V8l-4 4z"/><path d="M17 8v8l4-4z"/><path d="M12 3v18"/></svg>
        </button>

        <span class="ctrl-separator" aria-hidden="true"></span>

        <!-- Remote control share button -->
        <button
          class="ctrl-btn icon-btn share-btn"
          :class="{ active: remoteConnected }"
          @click="openShareModal"
          title="Remote control"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
        </button>

        <!-- Session share button -->
        <button
          class="ctrl-btn icon-btn"
          @click="openSessionShare"
          title="Share this session (S)"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
        </button>

        <button class="ctrl-btn icon-btn hide-btn" @click="controlsHidden = !controlsHidden" title="Toggle controls">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
        </button>
      </div>
    </div>

    <!-- Tap hint when playing -->
    <div v-if="playing && !controlsHidden" class="tap-hint">Tap text to pause</div>

    <!-- Show controls button when hidden -->
    <button v-if="controlsHidden" class="show-controls-btn" @click.stop="controlsHidden = false">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h18"/><path d="M3 6h18"/><path d="M3 18h18"/></svg>
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
import { ref, computed, onMounted, onBeforeUnmount, onUnmounted, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { marked } from 'marked'
import { getScript, updateScrollProgress } from '../storage/db'
import ShareModal from './ShareModal.vue'
import SessionModal from './SessionModal.vue'
import ScrollTimeline from './ScrollTimeline.vue'
import { useRemoteHost, useShareHost, type RemoteCommand } from '../composables/useRemoteControl'

const router = useRouter()
const route = useRoute()

const loading = ref(true)
const rawContent = ref('')
const playing = ref(false)
const speed = ref(5)
const fontSize = ref(48)
const mirror = ref(false)
const focusOpacity = ref(50)
const controlsHidden = ref(false)
const editingFrame = ref(false)
const areaWidth = ref(900)
const areaOffsetX = ref(0)
const showShareModal = ref(false)

const scrollEl = ref<HTMLElement | null>(null)
let rafId: number | null = null
let lastTime: number | null = null
const scriptId = ref<number | null>(null)

// ── Auto-save scroll progress ─────────────────────────────────────────────────
function getScrollProgress(): number {
  if (!scrollEl.value) return 0
  const el = scrollEl.value
  const maxScroll = el.scrollHeight - el.clientHeight
  if (maxScroll <= 0) return 0
  return Math.min(1, el.scrollTop / maxScroll)
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
function scheduleSaveProgress() {
  if (!scriptId.value) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    if (scriptId.value) {
      updateScrollProgress(scriptId.value, getScrollProgress())
    }
  }, 500)
}

function onScroll() {
  scheduleSaveProgress()
  updateTimelineProgress()
}

// ── Scroll progress & timeline ────────────────────────────────────────────────
const scrollProgress = ref(0)  // 0–1
const timeLeft = ref(-1)        // seconds remaining at current speed

function updateTimelineProgress() {
  if (!scrollEl.value) return
  const { scrollTop, scrollHeight, clientHeight } = scrollEl.value
  const maxScroll = scrollHeight - clientHeight
  scrollProgress.value = maxScroll > 0 ? scrollTop / maxScroll : 0
  const pps = speed.value * 20
  timeLeft.value = pps > 0 && maxScroll > 0 ? Math.max(0, maxScroll - scrollTop) / pps : -1
  maybeScrollBroadcast()
}

function onTimelineSeek(progress: number) {
  if (!scrollEl.value) return
  const { scrollHeight, clientHeight } = scrollEl.value
  scrollEl.value.scrollTop = progress * (scrollHeight - clientHeight)
}

// Throttled broadcast of scroll progress to remote (at most once per 100 ms)
let lastScrollBroadcastTime = 0

function buildBroadcastState() {
  return {
    playing: playing.value,
    speed: speed.value,
    fontSize: fontSize.value,
    mirror: mirror.value,
    focusOpacity: focusOpacity.value,
    scrollProgress: scrollProgress.value,
    timeLeft: timeLeft.value,
  }
}

function maybeScrollBroadcast() {
  const now = performance.now()
  if (now - lastScrollBroadcastTime < 100) return
  lastScrollBroadcastTime = now
  broadcastState(buildBroadcastState())
}

// ── Remote control (smartphone controls the teleprompter) ─────────────────────
function handleRemoteCommand(cmd: RemoteCommand) {
  if (cmd.type === 'togglePlay') togglePlay()
  else if (cmd.type === 'speedUp') speed.value = Math.min(20, speed.value + 1)
  else if (cmd.type === 'speedDown') speed.value = Math.max(1, speed.value - 1)
  else if (cmd.type === 'fontUp') fontSize.value = Math.min(96, fontSize.value + 4)
  else if (cmd.type === 'fontDown') fontSize.value = Math.max(24, fontSize.value - 4)
  else if (cmd.type === 'toggleMirror') mirror.value = !mirror.value
  else if (cmd.type === 'reset' && scrollEl.value) scrollEl.value.scrollTo({ top: 0, behavior: 'smooth' })
  else if (cmd.type === 'scrollUp' && scrollEl.value) scrollEl.value.scrollBy({ top: -120, behavior: 'smooth' })
  else if (cmd.type === 'scrollDown' && scrollEl.value) scrollEl.value.scrollBy({ top: 120, behavior: 'smooth' })
  else if (cmd.type === 'seek' && scrollEl.value) {
    const { scrollHeight, clientHeight } = scrollEl.value
    scrollEl.value.scrollTop = cmd.progress * (scrollHeight - clientHeight)
  }
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
watch([playing, speed, fontSize, mirror, focusOpacity], () => {
  if (broadcastTimer) clearTimeout(broadcastTimer)
  broadcastTimer = setTimeout(() => {
      broadcastState(buildBroadcastState())
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
        focusOpacity: focusOpacity.value,
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
    scriptId.value = id
    const script = await getScript(id)
    if (script) {
      rawContent.value = script.content
      if (script.scrollProgress && script.scrollProgress > 0) {
        await nextTick()
        if (scrollEl.value) {
          const maxScroll = scrollEl.value.scrollHeight - scrollEl.value.clientHeight
          scrollEl.value.scrollTop = script.scrollProgress * maxScroll
        }
      }
    }
  }
  loading.value = false
  window.addEventListener('keydown', handleKey)
  scrollEl.value?.addEventListener('scroll', onScroll, { passive: true })
})

onBeforeUnmount(() => {
  // Save progress while refs are still valid
  if (scriptId.value && scrollEl.value) {
    updateScrollProgress(scriptId.value, getScrollProgress())
  }
  if (saveTimer) clearTimeout(saveTimer)
})

onUnmounted(() => {
  stopScroll()
  scrollEl.value?.removeEventListener('scroll', onScroll)
  window.removeEventListener('keydown', handleKey)
  window.removeEventListener('resize', clampFrameToViewport)
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
    toggleFrameEdit()
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

function toggleFrameEdit() {
  editingFrame.value = !editingFrame.value
  if (editingFrame.value && areaWidth.value > window.innerWidth) {
    areaWidth.value = window.innerWidth
    areaOffsetX.value = clampOffset(areaOffsetX.value, areaWidth.value)
  }
}

// Restart RAF when speed changes while playing; also recalculate timeLeft
watch(speed, () => {
  if (playing.value) {
    stopScroll()
    startScroll()
  }
  updateTimelineProgress()
})

// When frame editing starts, clamp frame width to viewport so handles are visible.
// Also re-clamp on viewport resize (e.g. device rotation) while editing is active.
function clampFrameToViewport() {
  const vw = window.innerWidth
  if (areaWidth.value > vw) {
    areaWidth.value = vw
    areaOffsetX.value = clampOffset(areaOffsetX.value, vw)
  }
}

watch(editingFrame, (isEditing) => {
  if (isEditing) {
    clampFrameToViewport()
    window.addEventListener('resize', clampFrameToViewport)
  } else {
    window.removeEventListener('resize', clampFrameToViewport)
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
  padding: 16px 16px 16px;
  transition: opacity 0.3s, transform 0.3s;
  z-index: 20;
  pointer-events: none;
}

.controls :deep(.scroll-timeline) {
  max-width: 900px;
  margin: 0 auto 12px;
  pointer-events: auto;
}

.controls-hidden .controls {
  opacity: 0;
  transform: translateY(100%);
  pointer-events: none;
}

.controls-inner {
  display: flex;
  align-items: center;
  gap: 4px;
  max-width: 900px;
  margin: 0 auto;
  flex-wrap: nowrap;
  overflow-x: auto;
  scrollbar-width: none;
  pointer-events: auto;
}

.controls-inner::-webkit-scrollbar {
  display: none;
}

.ctrl-btn {
  background: transparent;
  color: rgba(255, 255, 255, 0.8);
  border-radius: 8px;
  padding: 8px;
  font-size: 16px;
  border: none;
  transition: background 0.15s, color 0.15s;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  min-width: 40px;
  min-height: 40px;
}

.ctrl-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  opacity: 1;
}

.ctrl-btn.icon-btn {
  padding: 8px;
  min-width: 40px;
  min-height: 40px;
}

.ctrl-btn.icon-btn.active {
  background: rgba(74, 222, 128, 0.15);
  color: var(--accent);
}

.ctrl-separator {
  width: 1px;
  height: 24px;
  background: rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
}

.play-btn {
  background: var(--accent);
  color: #111;
  border-radius: 50%;
  min-width: 40px;
  min-height: 40px;
  padding: 0;
}

.play-btn:hover {
  background: #22c55e;
}

/* Control group: label + value badge, popup slider on hover */
.ctrl-group {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
  flex-shrink: 0;
  height: 40px;
}

.ctrl-group:hover {
  background: rgba(255, 255, 255, 0.1);
}

.ctrl-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 600;
  user-select: none;
}

.ctrl-value {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  user-select: none;
}

/* Invisible bridge between ctrl-group and popup to prevent hover loss when
   moving the mouse through the gap between the two elements */
.ctrl-group::after {
  content: '';
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  height: 8px;
}

/* Popup slider panel – appears above the control group on hover */
.ctrl-popup {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 12px 16px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease, transform 0.2s ease;
  transform: translateX(-50%) translateY(4px);
  white-space: nowrap;
}

.ctrl-group:hover .ctrl-popup,
.ctrl-group:focus-within .ctrl-popup {
  opacity: 1;
  pointer-events: auto;
  transform: translateX(-50%) translateY(0);
}

.ctrl-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 120px;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
  display: block;
}

.ctrl-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
  transition: transform 0.15s ease;
}

.ctrl-slider::-webkit-slider-thumb:hover {
  transform: scale(1.25);
}

.ctrl-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
  border: none;
  transition: transform 0.15s ease;
}

.ctrl-slider::-moz-range-thumb:hover {
  transform: scale(1.25);
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
  bottom: 20px;
  right: 20px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 50%;
  width: 52px;
  height: 52px;
  font-size: 18px;
  padding: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, border-color 0.2s;
}

.show-controls-btn:hover {
  background: rgba(255, 255, 255, 0.18);
  border-color: rgba(255, 255, 255, 0.3);
}

/* Focus gradient overlay - dims top/bottom, highlights center */
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
  .controls-inner {
    gap: 2px;
  }
  .ctrl-btn {
    min-width: 36px;
    min-height: 36px;
    padding: 6px;
  }
  .ctrl-btn.icon-btn {
    min-width: 36px;
    min-height: 36px;
  }
  .play-btn {
    min-width: 36px;
    min-height: 36px;
  }
  .ctrl-group {
    padding: 4px 6px;
    gap: 3px;
  }
  .ctrl-label {
    font-size: 10px;
  }
  .ctrl-value {
    font-size: 11px;
  }
  .ctrl-separator {
    display: none;
  }
  .ctrl-slider {
    width: 100px;
  }
  /* Frame boundary visibility on mobile: keep handles inside the frame */
  .frame-box {
    border-color: rgba(74, 222, 128, 0.8);
  }
  .frame-handle {
    background: rgba(74, 222, 128, 0.15);
  }
  .frame-handle-left {
    left: 0;
  }
  .frame-handle-right {
    right: 0;
  }
  .frame-handle::after {
    width: 6px;
    background: rgba(74, 222, 128, 0.9);
  }
}
</style>
