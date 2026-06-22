<template>
  <div
    ref="rootEl"
    class="tp-root"
    :class="{
      mirrored: mirror,
      'flipped-vertically': flipVertically,
      'controls-hidden': controlsHidden,
      'is-playing': playing,
      [orientationClass]: orientationClass,
    }"
  >
    <!-- Focus gradient overlay -->
    <div class="focus-overlay" :style="{ opacity: focusOpacity / 100 }"></div>

    <!-- Voice sync word highlight band -->
    <div v-if="isVoiceSyncActive" class="voice-sync-highlight" :style="voiceSyncHighlightStyle" aria-hidden="true"></div>

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
      <div
        ref="scrollTrackEl"
        class="tp-scroll-track"
        :class="{ 'is-auto-scrolling': autoScrollAnimating }"
        :style="scrollTrackStyle"
        @animationend="finishScroll"
      >
        <div class="tp-start-spacer"></div>
        <div class="tp-content prose" :style="contentAreaStyle" v-html="renderedContent"></div>
        <div class="tp-spacer"></div>
      </div>
    </div>

    <!-- Controls overlay -->
    <div class="controls" @click.stop>
      <!-- Timeline progress bar -->
      <ScrollTimeline :progress="scrollProgress" :timeLeft="timeLeft" @seek="onTimelineSeek" />

      <div class="mobile-adjustments" aria-label="Reading controls">
        <div class="mobile-control-row">
          <div class="mobile-control-meta">
            <span class="mobile-control-label">Speed</span>
            <span class="mobile-control-value">{{ speed }}</span>
          </div>
          <div class="mobile-control-field mobile-step-field">
            <button
              type="button"
              class="mobile-step-btn"
              :disabled="speed <= MIN_SCROLL_SPEED"
              aria-label="Decrease speed"
              @click="changeSpeed(-1)"
            >
              −
            </button>
            <input
              type="range"
              :min="MIN_SCROLL_SPEED"
              :max="MAX_SCROLL_SPEED"
              :step="SCROLL_SPEED_STEP"
              v-model.number="speed"
              class="mobile-slider"
              title="Scroll speed"
            />
            <button
              type="button"
              class="mobile-step-btn"
              :disabled="speed >= MAX_SCROLL_SPEED"
              aria-label="Increase speed"
              @click="changeSpeed(1)"
            >
              +
            </button>
          </div>
        </div>

        <div class="mobile-control-row">
          <div class="mobile-control-meta">
            <span class="mobile-control-label">Text</span>
            <span class="mobile-control-value">{{ fontSize }}px</span>
          </div>
          <div class="mobile-control-field mobile-step-field">
            <button
              type="button"
              class="mobile-step-btn"
              :disabled="fontSize <= 24"
              aria-label="Decrease text size"
              @click="changeFontSize(-1)"
            >
              −
            </button>
            <input
              type="range"
              min="24"
              max="96"
              step="4"
              v-model.number="fontSize"
              class="mobile-slider"
              title="Font size"
            />
            <button
              type="button"
              class="mobile-step-btn"
              :disabled="fontSize >= 96"
              aria-label="Increase text size"
              @click="changeFontSize(1)"
            >
              +
            </button>
          </div>
        </div>

        <div class="mobile-control-row">
          <div class="mobile-control-meta">
            <span class="mobile-control-label">Focus</span>
            <span class="mobile-control-value">{{ focusOpacity }}%</span>
          </div>
          <div class="mobile-control-field mobile-step-field">
            <button
              type="button"
              class="mobile-step-btn"
              :disabled="focusOpacity <= 0"
              aria-label="Decrease focus"
              @click="changeFocusOpacity(-1)"
            >
              −
            </button>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              v-model.number="focusOpacity"
              class="mobile-slider"
              title="Focus opacity gradient"
            />
            <button
              type="button"
              class="mobile-step-btn"
              :disabled="focusOpacity >= 100"
              aria-label="Increase focus"
              @click="changeFocusOpacity(1)"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div class="controls-inner">
        <button class="ctrl-btn back-btn" @click="router.push('/')" title="Back">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>

        <button class="ctrl-btn play-btn" @click="togglePlay" :title="playing ? 'Pause' : 'Play'">
          <svg v-if="!playing" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6 4l14 8-14 8V4z"/></svg>
          <svg v-else viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><rect x="5" y="3" width="4" height="18" rx="1"/><rect x="15" y="3" width="4" height="18" rx="1"/></svg>
        </button>

        <button
          v-if="voiceSyncSupported"
          class="ctrl-btn icon-btn mic-btn"
          :class="{ active: isVoiceSyncActive, listening: voiceSyncListening }"
          @click="toggleVoiceSync"
          title="Voice sync (V)"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
        </button>

        <div
          class="ctrl-group speed-control desktop-adjust-control"
          tabindex="0"
          @mouseenter="positionPopup"
          @focusin="positionPopup"
        >
          <span class="ctrl-label">Speed</span>
          <span class="ctrl-value">{{ speed }}</span>
          <div class="ctrl-popup speed-popup">
            <div class="speed-popup-header">
              <span>Scroll speed</span>
              <span class="speed-range">{{ MIN_SCROLL_SPEED }}–{{ MAX_SCROLL_SPEED }}</span>
            </div>
            <input
              id="speed-slider"
              type="range"
              :min="MIN_SCROLL_SPEED"
              :max="MAX_SCROLL_SPEED"
              :step="SCROLL_SPEED_STEP"
              v-model.number="speed"
              class="ctrl-slider speed-slider"
              title="Scroll speed"
            />
            <div class="speed-stepper">
              <button
                type="button"
                class="speed-step-btn"
                :disabled="speed <= MIN_SCROLL_SPEED"
                aria-label="Decrease speed"
                @click="changeSpeed(-1)"
              >
                −
              </button>
              <input
                type="number"
                class="speed-number"
                :min="MIN_SCROLL_SPEED"
                :max="MAX_SCROLL_SPEED"
                step="any"
                :value="speed"
                aria-label="Speed value"
                inputmode="decimal"
                @change="setSpeedFromInput"
              />
              <button
                type="button"
                class="speed-step-btn"
                :disabled="speed >= MAX_SCROLL_SPEED"
                aria-label="Increase speed"
                @click="changeSpeed(1)"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <label class="ctrl-group desktop-adjust-control" @mouseenter="positionPopup" @focusin="positionPopup">
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

        <label class="ctrl-group desktop-adjust-control" @mouseenter="positionPopup" @focusin="positionPopup">
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

        <button
          class="ctrl-btn icon-btn flip-vertical-btn"
          :class="{ active: flipVertically }"
          @click="flipVertically = !flipVertically"
          title="Flip vertically"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 7h8l-4-4z"/><path d="M16 17H8l4 4z"/><path d="M3 12h18"/></svg>
        </button>

        <OrientationControl v-model="orientation" @update:model-value="setOrientation" />

        <span class="ctrl-separator" aria-hidden="true"></span>

        <button
          class="ctrl-btn icon-btn fullscreen-btn"
          :class="{ active: isFullscreen }"
          @click="toggleFullscreen"
          :title="isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'"
        >
          <svg v-if="!isFullscreen" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 00-2 2v3"/><path d="M21 8V5a2 2 0 00-2-2h-3"/><path d="M3 16v3a2 2 0 002 2h3"/><path d="M16 21h3a2 2 0 002-2v-3"/></svg>
          <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 01-2 2H3"/><path d="M21 8h-3a2 2 0 01-2-2V3"/><path d="M3 16h3a2 2 0 012 2v3"/><path d="M16 21v-3a2 2 0 012-2h3"/></svg>
        </button>

        <!-- Remote control share button -->
        <button
          class="ctrl-btn icon-btn share-btn"
          :class="{ active: remoteConnected }"
          @click="openShareModal"
          title="Remote control"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
        </button>

        <button class="ctrl-btn icon-btn hide-btn" @click="controlsHidden = !controlsHidden" title="Toggle controls">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
        </button>
      </div>
    </div>

    <!-- Tap hint when playing -->
    <div v-if="playing && !controlsHidden && !isVoiceSyncActive" class="tap-hint">Tap text to pause</div>

    <!-- Voice sync status -->
    <div v-if="isVoiceSyncActive" class="voice-sync-hint" :class="{ listening: voiceSyncListening }">
      <span class="voice-sync-dot"></span>
      {{ voiceSyncListening ? 'Listening…' : 'Starting mic…' }}
      <span v-if="speakerWPM > 0" class="voice-sync-wpm">{{ speakerWPM }} WPM</span>
    </div>

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

    <div v-if="loading" class="loading">Loading…</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, onUnmounted, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { marked } from 'marked'
import { getScript, updateScrollProgress } from '../storage/db'
import ShareModal from './ShareModal.vue'
import ScrollTimeline from './ScrollTimeline.vue'
import OrientationControl from './OrientationControl.vue'
import { useRemoteHost, type RemoteCommand } from '../composables/useRemoteControl'
import { useVoiceSync, loadCalibratedSpeed } from '../composables/useVoiceSync'
import { useWakeLock } from '../composables/useWakeLock'
import { useDisplayOrientation } from '../composables/useDisplayOrientation'
import { useAutoScroller } from '../composables/useAutoScroller'
import { useFullscreen } from '../composables/useFullscreen'
import { useAccountSync } from '../composables/useAccountSync'
import { useTeleprompterSettings } from '../composables/useTeleprompterSettings'
import {
  MAX_SCROLL_SPEED,
  MIN_SCROLL_SPEED,
  SCROLL_SPEED_STEP,
  clampScrollSpeed,
  scrollSpeedToPixelsPerSecond,
  stepScrollSpeed,
} from '../constants/teleprompter'

const router = useRouter()
const route = useRoute()

const loading = ref(true)
const rawContent = ref('')
const playing = ref(false)
const flipVertically = ref(false)
const controlsHidden = ref(false)
const editingFrame = ref(false)
const showShareModal = ref(false)
const { speed, fontSize, mirror, focusOpacity, areaWidth, areaOffsetX } = useTeleprompterSettings()
const { orientation, orientationClass, setOrientation } = useDisplayOrientation()

useWakeLock(playing)

const PAGE_STATE_KEY = 'teleprompter-page-state'

interface TeleprompterPageState {
  scriptId: number
  scrollProgress: number
  playing: boolean
  controlsHidden: boolean
  flipVertically: boolean
  updatedAt: number
}

let restoringPageState = false

const rootEl = ref<HTMLElement | null>(null)
const scrollEl = ref<HTMLElement | null>(null)
const scrollTrackEl = ref<HTMLElement | null>(null)
const scriptId = ref<number | null>(null)
const scriptTitle = ref('Untitled')
const { isFullscreen, toggleFullscreen } = useFullscreen(rootEl)
const { publishActiveSession, syncNow } = useAccountSync()

// ── Voice sync ────────────────────────────────────────────────────────────────
const {
  isVoiceSyncActive,
  isSupported: voiceSyncSupported,
  isListening: voiceSyncListening,
  wordCursor,
  speakerWPM,
  words: voiceSyncWords,
  parseScript: voiceSyncParseScript,
  start: startVoiceSync,
  stop: stopVoiceSync,
} = useVoiceSync(() => {
  if (!scrollEl.value) return null
  return {
    scrollHeight: scrollEl.value.scrollHeight,
    clientHeight: scrollEl.value.clientHeight,
  }
})

// ── Auto-save scroll progress ─────────────────────────────────────────────────
function getScrollProgress(): number {
  if (!scrollEl.value) return 0
  const maxScroll = getMaxScrollDistance()
  if (maxScroll <= 0) return 0
  return Math.min(1, getDisplayedScrollTop() / maxScroll)
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
function scheduleSaveProgress() {
  if (!scriptId.value) return
  persistPageState()
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    if (scriptId.value) {
      updateScrollProgress(scriptId.value, getScrollProgress())
    }
  }, 500)
}

function onScroll() {
  if (!isVoiceSyncActive.value && !autoScrollAnimating.value) {
    syncScrollPosition()
  }
  scheduleSaveProgress()
  updateTimelineProgress()
}

function readPageState(id: number): TeleprompterPageState | null {
  try {
    if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') return null
    const raw = localStorage.getItem(PAGE_STATE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<TeleprompterPageState>
    if (parsed.scriptId !== id) return null
    return {
      scriptId: id,
      scrollProgress: clampProgress(parsed.scrollProgress),
      playing: parsed.playing === true,
      controlsHidden: parsed.controlsHidden === true,
      flipVertically: parsed.flipVertically === true,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
    }
  } catch {
    return null
  }
}

function persistPageState() {
  if (restoringPageState || !scriptId.value) return
  try {
    if (typeof localStorage === 'undefined' || typeof localStorage.setItem !== 'function') return
    const pageState: TeleprompterPageState = {
      scriptId: scriptId.value,
      scrollProgress: getScrollProgress(),
      playing: playing.value,
      controlsHidden: controlsHidden.value,
      flipVertically: flipVertically.value,
      updatedAt: Date.now(),
    }
    localStorage.setItem(PAGE_STATE_KEY, JSON.stringify(pageState))
  } catch {
    // Storage can be unavailable in private browsing contexts.
  }
}

function clampProgress(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.min(1, numeric))
}

// ── Scroll progress & timeline ────────────────────────────────────────────────
const scrollProgress = ref(0)  // 0–1
const timeLeft = ref(-1)        // seconds remaining at current speed

function updateTimelineProgress() {
  if (!scrollEl.value) return
  const scrollTop = getDisplayedScrollTop()
  const maxScroll = getMaxScrollDistance()
  scrollProgress.value = maxScroll > 0 ? scrollTop / maxScroll : 0
  const pps = scrollSpeedToPixelsPerSecond(speed.value)
  timeLeft.value = pps > 0 && maxScroll > 0 ? Math.max(0, maxScroll - scrollTop) / pps : -1
  maybeScrollBroadcast()
}

function onTimelineSeek(progress: number) {
  setDisplayedScrollTop(progress * getMaxScrollDistance())
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
  else if (cmd.type === 'speedUp') changeSpeed(1)
  else if (cmd.type === 'speedDown') changeSpeed(-1)
  else if (cmd.type === 'fontUp') fontSize.value = Math.min(96, fontSize.value + 4)
  else if (cmd.type === 'fontDown') fontSize.value = Math.max(24, fontSize.value - 4)
  else if (cmd.type === 'toggleMirror') mirror.value = !mirror.value
  else if (cmd.type === 'reset') setDisplayedScrollTop(0)
  else if (cmd.type === 'scrollUp') setDisplayedScrollTop(getDisplayedScrollTop() - 120)
  else if (cmd.type === 'scrollDown') setDisplayedScrollTop(getDisplayedScrollTop() + 120)
  else if (cmd.type === 'seek') setDisplayedScrollTop(cmd.progress * getMaxScrollDistance())
}

function changeSpeed(direction: -1 | 1) {
  speed.value = stepScrollSpeed(speed.value, direction)
}

function changeFontSize(direction: -1 | 1) {
  fontSize.value = clamp(fontSize.value + direction * 4, 24, 96)
}

function changeFocusOpacity(direction: -1 | 1) {
  focusOpacity.value = clamp(focusOpacity.value + direction * 5, 0, 100)
}

function setSpeedFromInput(event: Event) {
  const input = event.currentTarget as HTMLInputElement
  if (Number.isFinite(input.valueAsNumber)) {
    speed.value = clampScrollSpeed(input.valueAsNumber)
  }
  input.value = String(speed.value)
}

const { peerId: remotePeerId, connected: remoteConnected, init: initRemoteHost, broadcastState } =
  useRemoteHost(handleRemoteCommand)

const remoteUrl = computed(() => {
  if (!remotePeerId.value) return ''
  return `${window.location.origin}/remote/${remotePeerId.value}`
})

const {
  scrollTrackStyle,
  isAnimating: autoScrollAnimating,
  startScroll,
  pauseScroll,
  stopScroll,
  finishScroll,
  getMaxScrollDistance,
  getScrollOffset,
  setScrollOffset,
  syncScrollPosition,
} = useAutoScroller({
  scrollEl,
  trackEl: scrollTrackEl,
  speed,
  playing,
  onProgress: updateTimelineProgress,
})

function getDisplayedScrollTop(): number {
  return isVoiceSyncActive.value ? scrollEl.value?.scrollTop ?? 0 : getScrollOffset()
}

function setDisplayedScrollTop(offset: number) {
  const maxScroll = getMaxScrollDistance()
  const nextOffset = Math.max(0, Math.min(maxScroll, offset))
  if (isVoiceSyncActive.value && scrollEl.value) {
    scrollEl.value.scrollTop = nextOffset
    updateTimelineProgress()
    return
  }
  setScrollOffset(nextOffset)
}

function openShareModal() {
  if (!remotePeerId.value) initRemoteHost()
  showShareModal.value = true
}

function publishCurrentActiveSession() {
  if (!playing.value || !remotePeerId.value) {
    publishActiveSession(null)
    return
  }

  publishActiveSession({
    scriptId: scriptId.value,
    scriptTitle: scriptTitle.value,
    remotePeerId: remotePeerId.value,
    playing: playing.value,
  })
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

watch([playing, remotePeerId], publishCurrentActiveSession)
watch([playing, controlsHidden, flipVertically], persistPageState)

let activeSessionTimer: ReturnType<typeof setInterval> | null = null

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

// ── Voice sync toggle & scroll driver ─────────────────────────────────────────
function toggleVoiceSync() {
  if (isVoiceSyncActive.value) {
    const calibrated = stopVoiceSync()
    wordScrollPositions = []
    if (calibrated !== null) {
      speed.value = calibrated
    }
    syncScrollPosition()
  } else {
    // Stop fixed-speed auto-scroll to avoid competing scroll mechanisms
    if (playing.value) pauseScroll()
    const progress = getScrollProgress()
    if (scrollEl.value) {
      const currentOffset = getScrollOffset()
      scrollEl.value.scrollTop = currentOffset
      syncScrollPosition()
    }
    // Parse current script text (strip HTML tags from rendered markdown)
    const tmp = document.createElement('div')
    tmp.innerHTML = renderedContent.value
    const plainText = tmp.textContent || tmp.innerText || ''
    voiceSyncParseScript(plainText)
    // Estimate current word index from scroll progress
    const fromWord = Math.floor(progress * voiceSyncWords.value.length)
    startVoiceSync(fromWord)
    // Build DOM-based word position index for accurate scroll-to-center
    buildWordPositionIndex()
  }
}

// Smooth-scroll to track the current word position
let voiceSyncTarget = -1
let voiceSyncRafId: number | null = null
let componentUnmounted = false

// DOM-based word position index for accurate scroll-to-center
let wordScrollPositions: number[] = []

function buildWordPositionIndex(): void {
  wordScrollPositions = []
  if (!scrollEl.value) return
  const contentEl = scrollEl.value.querySelector('.tp-content') as HTMLElement | null
  if (!contentEl) return
  const scrollTop = scrollEl.value.scrollTop
  const containerTop = scrollEl.value.getBoundingClientRect().top
  const walker = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT, null)
  const wordRegex = /\S+/g
  while (walker.nextNode()) {
    if (wordScrollPositions.length >= voiceSyncWords.value.length) break
    const node = walker.currentNode as Text
    const text = node.textContent || ''
    wordRegex.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = wordRegex.exec(text)) !== null) {
      if (wordScrollPositions.length >= voiceSyncWords.value.length) break
      const range = document.createRange()
      range.setStart(node, match.index)
      range.setEnd(node, match.index + match[0].length)
      const rect = range.getBoundingClientRect()
      // Convert viewport-relative top to scroll-container-absolute top
      wordScrollPositions.push(scrollTop + rect.top - containerTop)
    }
  }
}

const voiceSyncHighlightStyle = computed(() => ({
  height: `${Math.round(fontSize.value * 1.5)}px`,
}))

function voiceSyncScrollTick() {
  if (!scrollEl.value || voiceSyncTarget < 0) {
    voiceSyncRafId = null
    return
  }
  const current = scrollEl.value.scrollTop
  const diff = voiceSyncTarget - current
  if (Math.abs(diff) < 1) {
    scrollEl.value.scrollTop = voiceSyncTarget
    voiceSyncRafId = null
    return
  }
  scrollEl.value.scrollTop = current + diff * 0.12
  voiceSyncRafId = requestAnimationFrame(voiceSyncScrollTick)
}

watch(wordCursor, (newIdx) => {
  if (!isVoiceSyncActive.value || !scrollEl.value) return
  const totalWords = voiceSyncWords.value.length
  if (totalWords === 0) return
  const clientHeight = scrollEl.value.clientHeight
  const maxScroll = scrollEl.value.scrollHeight - scrollEl.value.clientHeight
  let targetScrollTop: number
  if (newIdx < wordScrollPositions.length) {
    // Center the recognized word in the viewport using its exact DOM position
    targetScrollTop = wordScrollPositions[newIdx] - clientHeight / 2
  } else {
    // Fallback: linear interpolation by word progress
    const wordProgress = newIdx / totalWords
    targetScrollTop = wordProgress * maxScroll
  }
  voiceSyncTarget = Math.max(0, Math.min(targetScrollTop, maxScroll))
  if (voiceSyncRafId === null) {
    voiceSyncRafId = requestAnimationFrame(voiceSyncScrollTick)
  }
})

onMounted(async () => {
  componentUnmounted = false
  const id = Number(route.params.id)
  let shouldResumePlaying = false
  if (id) {
    scriptId.value = id
    const script = await getScript(id)
    if (componentUnmounted) return
    if (script) {
      scriptTitle.value = script.title || 'Untitled'
      rawContent.value = script.content
      await nextTick()
      if (scrollEl.value) {
        const pageState = readPageState(id)
        restoringPageState = true
        controlsHidden.value = pageState?.controlsHidden ?? controlsHidden.value
        flipVertically.value = pageState?.flipVertically ?? flipVertically.value
        clampFrameToViewport()
        const savedProgress = pageState?.scrollProgress ?? script.scrollProgress ?? 0
        setScrollOffset(clampProgress(savedProgress) * getMaxScrollDistance())
        shouldResumePlaying = pageState?.playing === true
        restoringPageState = false
      }
    }
  }
  // Load persisted calibrated speed from previous voice sync session (after content loaded)
  const savedSpeed = loadCalibratedSpeed()
  if (savedSpeed !== null) speed.value = savedSpeed

  loading.value = false
  initRemoteHost()
  activeSessionTimer = setInterval(publishCurrentActiveSession, 2_000)
  window.addEventListener('keydown', handleKey)
  window.addEventListener('beforeunload', persistPageState)
  window.addEventListener('resize', clampFrameToViewport)
  window.addEventListener('orientationchange', clampFrameToViewport)
  window.visualViewport?.addEventListener('resize', clampFrameToViewport)
  scrollEl.value?.addEventListener('scroll', onScroll, { passive: true })
  if (shouldResumePlaying) startScroll()
})

onBeforeUnmount(() => {
  // Save progress while refs are still valid
  if (scriptId.value && scrollEl.value) {
    persistPageState()
    updateScrollProgress(scriptId.value, getScrollProgress())
    syncNow()
  }
  if (saveTimer) clearTimeout(saveTimer)
})

onUnmounted(() => {
  componentUnmounted = true
  stopScroll()
  if (isVoiceSyncActive.value) stopVoiceSync()
  if (voiceSyncRafId !== null) cancelAnimationFrame(voiceSyncRafId)
  if (activeSessionTimer) clearInterval(activeSessionTimer)
  publishActiveSession(null)
  scrollEl.value?.removeEventListener('scroll', onScroll)
  window.removeEventListener('keydown', handleKey)
  window.removeEventListener('beforeunload', persistPageState)
  window.removeEventListener('resize', clampFrameToViewport)
  window.removeEventListener('orientationchange', clampFrameToViewport)
  window.visualViewport?.removeEventListener('resize', clampFrameToViewport)
  document.removeEventListener('pointermove', onFramePointerMove)
  document.removeEventListener('pointerup', onFramePointerUp)
})

function togglePlay() {
  playing.value ? pauseScroll() : startScroll()
}

function handleKey(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  if (e.code === 'Space') {
    e.preventDefault()
    togglePlay()
  } else if (e.code === 'ArrowUp') {
    e.preventDefault()
    changeSpeed(1)
  } else if (e.code === 'ArrowDown') {
    e.preventDefault()
    changeSpeed(-1)
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
  } else if (e.key === 'r' || e.key === 'R') {
    setDisplayedScrollTop(0)
  } else if (e.key === 'v' || e.key === 'V') {
    toggleVoiceSync()
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
  const maxOffset = Math.max(0, (getFrameViewportWidth() - width) / 2)
  return clamp(offset, -maxOffset, maxOffset)
}

function getFrameViewportWidth(): number {
  return rootEl.value?.clientWidth || window.visualViewport?.width || window.innerWidth
}

function getMinFrameWidth(viewportWidth = getFrameViewportWidth()): number {
  return Math.min(300, viewportWidth)
}

function clampFrameWidth(width: number, viewportWidth = getFrameViewportWidth(), minFrameWidth = getMinFrameWidth(viewportWidth)) {
  return clamp(width, minFrameWidth, viewportWidth)
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
  const viewportWidth = getFrameViewportWidth()
  const minFrameWidth = getMinFrameWidth(viewportWidth)

  if (frameAction === 'move') {
    areaOffsetX.value = clampOffset(frameStartOffsetX + dx, areaWidth.value)
  } else if (frameAction === 'resize-left') {
    const newWidth = clampFrameWidth(frameStartWidth - dx, viewportWidth, minFrameWidth)
    areaWidth.value = newWidth
    areaOffsetX.value = clampOffset(frameStartOffsetX + (frameStartWidth - newWidth) / 2, newWidth)
  } else if (frameAction === 'resize-right') {
    const newWidth = clampFrameWidth(frameStartWidth + dx, viewportWidth, minFrameWidth)
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
  if (editingFrame.value) clampFrameToViewport()
}

// Recalculate remaining time immediately when speed changes.
watch(speed, () => {
  if (playing.value && !isVoiceSyncActive.value) {
    pauseScroll()
    startScroll()
  }
  updateTimelineProgress()
})

// Keep the reading frame inside the visible teleprompter viewport after reload,
// rotation, manual resize, and frame editing.
function clampFrameToViewport() {
  const viewportWidth = getFrameViewportWidth()
  areaWidth.value = clampFrameWidth(areaWidth.value, viewportWidth)
  areaOffsetX.value = clampOffset(areaOffsetX.value, areaWidth.value)
}

watch(editingFrame, (isEditing) => {
  if (isEditing) {
    clampFrameToViewport()
  }
})

watch([areaWidth, areaOffsetX, orientation], clampFrameToViewport, { flush: 'post' })

// Position the slider popup using fixed coordinates so it escapes the
// overflow-x:auto scroll container (.controls-inner).
function positionPopup(e: Event) {
  const group = (e.currentTarget as HTMLElement)
  const rect = group.getBoundingClientRect()
  const popup = group.querySelector<HTMLElement>('.ctrl-popup')
  const popupWidth = popup?.offsetWidth ?? 0
  const halfWidth = popupWidth / 2
  const desiredLeft = rect.left + rect.width / 2
  const popupLeft = popupWidth > 0
    ? clamp(desiredLeft, halfWidth + 12, window.innerWidth - halfWidth - 12)
    : desiredLeft
  group.style.setProperty('--popup-bottom', `${window.innerHeight - rect.top + 8}px`)
  group.style.setProperty('--popup-left', `${popupLeft}px`)
}
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

@media (orientation: portrait) {
  .tp-root.orientation-landscape {
    inset: auto;
    top: 0;
    left: 100vw;
    width: 100vh;
    height: 100vw;
    transform: rotate(90deg);
    transform-origin: top left;
  }
}

@media (orientation: landscape) {
  .tp-root.orientation-portrait {
    inset: auto;
    top: 100vh;
    left: 0;
    width: 100vh;
    height: 100vw;
    transform: rotate(-90deg);
    transform-origin: top left;
  }
}

.tp-root.mirrored .tp-scroll {
  transform: scaleX(-1);
}

.tp-root.flipped-vertically .tp-scroll {
  transform: scaleY(-1);
}

.tp-root.mirrored.flipped-vertically .tp-scroll {
  transform: scale(-1, -1);
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

.tp-scroll-track {
  min-height: 100%;
  will-change: transform;
}

.tp-scroll-track.is-auto-scrolling {
  animation: tp-auto-scroll var(--scroll-duration, 0ms) linear forwards;
}

@keyframes tp-auto-scroll {
  from {
    transform: translate3d(0, calc(var(--scroll-start, 0px) * -1), 0);
  }

  to {
    transform: translate3d(0, calc(var(--scroll-end, 0px) * -1), 0);
  }
}

.tp-start-spacer {
  height: 50vh;
}

.tp-content {
  box-sizing: border-box;
  width: 100%;
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

.mobile-adjustments {
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

.ctrl-group:focus {
  outline: none;
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
  position: fixed;
  bottom: var(--popup-bottom, 0);
  left: var(--popup-left, 50%);
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
  z-index: 30;
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

.speed-popup {
  width: min(360px, calc(100vw - 24px));
  padding: 16px;
}

.speed-popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  font-weight: 600;
}

.speed-range {
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
}

.speed-slider {
  width: 100%;
  height: 8px;
  border-radius: 4px;
}

.speed-slider::-webkit-slider-thumb {
  width: 28px;
  height: 28px;
}

.speed-slider::-moz-range-thumb {
  width: 28px;
  height: 28px;
}

.speed-stepper {
  display: grid;
  grid-template-columns: 52px minmax(80px, 1fr) 52px;
  gap: 10px;
  margin-top: 18px;
}

.speed-step-btn,
.speed-number {
  min-height: 48px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.speed-step-btn {
  padding: 0;
  font-size: 26px;
  line-height: 1;
}

.speed-step-btn:disabled {
  cursor: default;
  opacity: 0.35;
}

.speed-number {
  width: 100%;
  padding: 0 8px;
  font-size: 22px;
  font-weight: 700;
  text-align: center;
  outline: none;
  appearance: textfield;
}

.speed-number:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(74, 222, 128, 0.15);
}

.speed-number::-webkit-inner-spin-button,
.speed-number::-webkit-outer-spin-button {
  margin: 0;
  appearance: none;
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

/* Mic button styles */
.mic-btn.active {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.mic-btn.listening {
  animation: mic-pulse 1.5s ease-in-out infinite;
}

@keyframes mic-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.3); }
  50% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
}

/* Voice sync status indicator */
.voice-sync-hint {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  pointer-events: none;
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  padding: 4px 12px;
  border-radius: 16px;
}

.voice-sync-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.4);
  flex-shrink: 0;
}

.voice-sync-hint.listening .voice-sync-dot {
  background: #ef4444;
  animation: dot-pulse 1s ease-in-out infinite;
}

@keyframes dot-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.voice-sync-wpm {
  color: var(--accent);
  font-weight: 600;
  margin-left: 4px;
}

/* Voice sync word highlight band – marks the center reading zone */
.voice-sync-highlight {
  position: fixed;
  left: 0;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  background: linear-gradient(
    to bottom,
    transparent,
    rgba(74, 222, 128, 0.07) 30%,
    rgba(74, 222, 128, 0.1) 50%,
    rgba(74, 222, 128, 0.07) 70%,
    transparent
  );
  border-top: 1px solid rgba(74, 222, 128, 0.18);
  border-bottom: 1px solid rgba(74, 222, 128, 0.18);
  pointer-events: none;
  z-index: 11;
  transition: height 0.2s ease;
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
  .controls {
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.96) 26%);
    padding: 12px 12px calc(12px + env(safe-area-inset-bottom));
  }
  .controls :deep(.scroll-timeline) {
    margin-bottom: 10px;
  }
  .tp-root.is-playing .controls {
    padding-top: 8px;
  }
  .tp-root.is-playing .mobile-adjustments {
    display: none;
  }
  .tp-root.is-playing .controls-inner {
    display: grid;
  }
  .tp-root.is-playing.controls-hidden .controls {
    opacity: 1;
    transform: none;
    pointer-events: none;
  }
  .tp-root.is-playing.controls-hidden .controls :deep(.scroll-timeline),
  .tp-root.is-playing.controls-hidden .play-btn {
    pointer-events: auto;
  }
  .tp-root.is-playing.controls-hidden .show-controls-btn {
    display: none;
  }
  .mobile-adjustments {
    display: grid;
    gap: 8px;
    max-width: 900px;
    margin: 0 auto 10px;
    pointer-events: auto;
  }
  .mobile-control-row {
    display: grid;
    grid-template-columns: 74px minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    min-height: 48px;
    padding: 6px 0;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }
  .mobile-control-row:first-child {
    border-top: none;
  }
  .mobile-control-meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .mobile-control-label {
    color: rgba(255, 255, 255, 0.58);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0;
    line-height: 1;
    text-transform: uppercase;
  }
  .mobile-control-value {
    color: #fff;
    font-size: 18px;
    font-weight: 750;
    line-height: 1.1;
  }
  .mobile-control-field {
    min-width: 0;
  }
  .mobile-step-field {
    display: grid;
    grid-template-columns: 46px minmax(0, 1fr) 46px;
    align-items: center;
    gap: 10px;
  }
  .mobile-step-btn {
    width: 46px;
    height: 46px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    font-size: 26px;
    line-height: 1;
    touch-action: manipulation;
  }
  .mobile-step-btn:disabled {
    opacity: 0.35;
  }
  .mobile-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 28px;
    padding: 0;
    border: none;
    border-radius: 999px;
    background: transparent;
    cursor: pointer;
    touch-action: pan-y;
  }
  .mobile-slider:focus {
    outline: none;
  }
  .mobile-slider::-webkit-slider-runnable-track {
    height: 8px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.24);
  }
  .mobile-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 30px;
    height: 30px;
    margin-top: -11px;
    border: 3px solid #101010;
    border-radius: 50%;
    background: var(--accent);
  }
  .mobile-slider::-moz-range-track {
    height: 8px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.24);
  }
  .mobile-slider::-moz-range-thumb {
    width: 30px;
    height: 30px;
    border: 3px solid #101010;
    border-radius: 50%;
    background: var(--accent);
  }
  .desktop-adjust-control {
    display: none;
  }
  .controls-inner {
    display: flex;
    align-items: center;
    gap: 3px;
    justify-content: stretch;
    overflow: visible;
  }
  .controls-inner > * {
    flex: 1 1 0;
    min-width: 0;
  }
  .ctrl-btn {
    width: 100%;
    min-width: 0;
    min-height: 40px;
    padding: 7px 4px;
  }
  .ctrl-btn.icon-btn {
    min-width: 0;
    min-height: 40px;
  }
  .play-btn {
    min-width: 0;
    min-height: 44px;
  }
  .controls-inner :deep(.orientation-control) {
    min-width: 0;
  }
  .controls-inner :deep(.orientation-trigger) {
    width: 100%;
    min-width: 0;
    min-height: 40px;
    padding: 7px 4px;
  }
  .controls-inner :deep(.orientation-value) {
    display: none;
  }
  .ctrl-group {
    padding: 4px 6px;
    gap: 3px;
  }
  .ctrl-label {
    font-size: 10px;
    letter-spacing: 0;
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
  .speed-control {
    min-width: 72px;
    justify-content: center;
  }
  .speed-popup {
    width: calc(100vw - 24px);
    padding: 18px;
  }
  .speed-slider {
    width: 100%;
    height: 10px;
  }
  .speed-slider::-webkit-slider-thumb {
    width: 32px;
    height: 32px;
  }
  .speed-slider::-moz-range-thumb {
    width: 32px;
    height: 32px;
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
