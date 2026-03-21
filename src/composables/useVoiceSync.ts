import { ref, type Ref } from 'vue'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScriptWord {
  text: string
  norm: string
  index: number
}

export interface UseVoiceSyncReturn {
  /** Whether voice sync is currently active */
  isVoiceSyncActive: Ref<boolean>
  /** Whether the browser supports the Web Speech API */
  isSupported: Ref<boolean>
  /** Whether the mic is actively listening */
  isListening: Ref<boolean>
  /** Index of the current word in the parsed word array */
  wordCursor: Ref<number>
  /** Current speaker WPM (EMA-smoothed) */
  speakerWPM: Ref<number>
  /** The parsed word list */
  words: Ref<ScriptWord[]>
  /** Parse a plain-text script into trackable word tokens */
  parseScript: (text: string) => void
  /** Start voice tracking (optionally from a specific word index) */
  start: (fromWordIndex?: number) => void
  /** Stop voice tracking and return calibrated speed (1–20), or null if insufficient data */
  stop: () => number | null
}

// ─── Pure helpers (exported for testing) ──────────────────────────────────────

/** Normalize a word: lowercase, strip non-alphanumeric */
export function normalize(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Fuzzy word comparison — tolerates suffix recognition errors */
export function wordsMatch(a: string, b: string): boolean {
  if (a === b) return true
  if (a.length < 4 || b.length < 4) return false
  const minLen = Math.min(a.length, b.length)
  const prefixLen = Math.max(3, minLen - 1)
  if (a.slice(0, prefixLen) === b.slice(0, prefixLen)) return true
  return false
}

/** Whether a word is "significant" (long enough to be a reliable match anchor) */
export function isSignificant(word: string): boolean {
  return word.length >= 4
}

/** Parse plain text into word tokens */
export function parseWords(text: string): ScriptWord[] {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => ({
      text: w,
      norm: normalize(w),
      index: i,
    }))
}

/**
 * Given heard words, the current script word array and cursor position,
 * find the best new cursor position using a sliding-window fuzzy match.
 * Returns the new cursor, or the existing cursor if no good match was found.
 */
export function matchHeardWords(
  heardWords: string[],
  scriptWords: ScriptWord[],
  currentCursor: number,
): number {
  if (heardWords.length === 0 || scriptWords.length === 0) return currentCursor

  const searchStart = Math.max(0, currentCursor - 2)
  const searchEnd = Math.min(scriptWords.length - 1, currentCursor + 30)

  let bestPos = -1
  let bestScore = -1

  for (let scriptPos = searchStart; scriptPos <= searchEnd; scriptPos++) {
    for (let heardStart = 0; heardStart < heardWords.length; heardStart++) {
      let matchLen = 0
      let significantMatches = 0
      let si = scriptPos
      let hi = heardStart
      let skips = 0

      while (si <= searchEnd && hi < heardWords.length && skips < 3) {
        const scriptWord = scriptWords[si].norm
        const heardWord = heardWords[hi]

        if (!heardWord) {
          hi++
          continue
        }
        if (!scriptWord) {
          si++
          continue
        }

        if (wordsMatch(scriptWord, heardWord)) {
          matchLen++
          if (isSignificant(scriptWord)) significantMatches++
          si++
          hi++
          skips = 0
        } else {
          let skipped = false
          // Try skipping one heard word
          if (hi + 1 < heardWords.length) {
            const nextHeard = heardWords[hi + 1]
            if (wordsMatch(scriptWord, nextHeard)) {
              hi++
              skips++
              skipped = true
            }
          }
          // Try skipping one script word
          if (!skipped && si + 1 <= searchEnd) {
            const nextScript = scriptWords[si + 1]?.norm ?? ''
            if (nextScript && wordsMatch(nextScript, heardWord)) {
              si++
              skips++
              skipped = true
            }
          }
          if (!skipped) break
        }
      }

      const effectiveEnd = si - 1
      if (matchLen < 2 || significantMatches < 1) continue

      const jumpDistance = scriptPos - currentCursor
      if (jumpDistance < -2) continue
      if (jumpDistance > 15 && matchLen < 4) continue
      if (jumpDistance > 10 && matchLen < 3) continue

      const proximityBonus = 1.0 - (Math.max(0, jumpDistance) / 100)
      const score = matchLen + (significantMatches * 0.5) + proximityBonus

      if (score > bestScore) {
        bestScore = score
        bestPos = effectiveEnd
      }
    }
  }

  if (bestPos >= 0 && bestPos >= currentCursor - 1) {
    const newPos = Math.max(currentCursor, bestPos)
    const maxJump = Math.max(8, Math.round(heardWords.length * 1.5))
    return Math.min(newPos, currentCursor + maxJump)
  }

  return currentCursor
}

/**
 * Calculate calibrated speed (1–20) from WPM + scroll geometry.
 * Returns null if WPM is 0 or geometry is unavailable.
 */
export function calibrateSpeed(
  wpm: number,
  totalWords: number,
  totalScrollDistance: number,
): number | null {
  if (wpm <= 0 || totalWords <= 0 || totalScrollDistance <= 0) return null
  const pxPerWord = totalScrollDistance / totalWords
  const requiredPPS = (wpm / 60) * pxPerWord
  const calibrated = Math.round(requiredPPS / 20)
  return Math.max(1, Math.min(20, calibrated))
}

// ─── localStorage key ─────────────────────────────────────────────────────────

const CALIBRATED_SPEED_KEY = 'voice-sync-calibrated-speed'

/** Read persisted calibrated speed (1–20), or null if none saved */
export function loadCalibratedSpeed(): number | null {
  try {
    const raw = localStorage.getItem(CALIBRATED_SPEED_KEY)
    if (!raw) return null
    const n = Number(raw)
    return n >= 1 && n <= 20 ? n : null
  } catch {
    return null
  }
}

/** Persist calibrated speed */
export function saveCalibratedSpeed(speed: number): void {
  try {
    localStorage.setItem(CALIBRATED_SPEED_KEY, String(speed))
  } catch {
    // localStorage may be unavailable
  }
}

// ─── Composable ───────────────────────────────────────────────────────────────

/**
 * Voice sync composable: manages SpeechRecognition lifecycle, word matching,
 * WPM tracking, and speed calibration.
 *
 * @param getScrollGeometry – callback to read scroll container metrics; only
 *   called when stopping (to compute calibrated speed).
 */
export function useVoiceSync(
  getScrollGeometry?: () => { scrollHeight: number; clientHeight: number } | null,
): UseVoiceSyncReturn {
  const isSupported = ref(
    typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window),
  )
  const isVoiceSyncActive = ref(false)
  const isListening = ref(false)
  const wordCursor = ref(0)
  const speakerWPM = ref(0)
  const words = ref<ScriptWord[]>([])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let recognition: any = null
  let trackingStartTime = 0
  let startCursor = 0
  let smoothedWPM = 0
  let wpmInterval: ReturnType<typeof setInterval> | null = null

  // ── Script parsing ────────────────────────────────────────────────────────

  function parseScript(text: string): void {
    words.value = parseWords(text)
    wordCursor.value = 0
    smoothedWPM = 0
    speakerWPM.value = 0
  }

  // ── Process speech results ────────────────────────────────────────────────

  function processResult(transcript: string): void {
    const heard = transcript
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.replace(/[^a-z0-9]/g, ''))
      .filter(Boolean)
    if (heard.length === 0) return
    const newCursor = matchHeardWords(heard, words.value, wordCursor.value)
    if (newCursor !== wordCursor.value) {
      wordCursor.value = newCursor
    }
  }

  // ── WPM tracking ──────────────────────────────────────────────────────────

  function updateWPM(): void {
    const elapsed = (Date.now() - trackingStartTime) / 1000
    if (elapsed < 2) return // need at least 2 s of data
    const wordsMatched = wordCursor.value - startCursor
    if (wordsMatched <= 0) return
    const rawWPM = (wordsMatched / elapsed) * 60
    smoothedWPM = smoothedWPM === 0 ? rawWPM : 0.2 * rawWPM + 0.8 * smoothedWPM
    speakerWPM.value = Math.round(smoothedWPM)
  }

  // ── Start / Stop ──────────────────────────────────────────────────────────

  function start(fromWordIndex = 0): void {
    if (!isSupported.value) return
    if (isVoiceSyncActive.value) return

    wordCursor.value = fromWordIndex
    startCursor = fromWordIndex
    trackingStartTime = Date.now()
    smoothedWPM = 0
    speakerWPM.value = 0
    isVoiceSyncActive.value = true

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      isListening.value = true
    }

    recognition.onend = () => {
      isListening.value = false
      // Auto-restart if still active
      if (isVoiceSyncActive.value) {
        try {
          recognition.start()
        } catch {
          // already running or permission lost
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript: string = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          processResult(transcript)
        } else {
          // Process interim results too for responsive tracking
          processResult(transcript)
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return
      console.error('SpeechRecognition error:', event.error)
    }

    recognition.start()
    wpmInterval = setInterval(updateWPM, 5000)
  }

  function stop(): number | null {
    isVoiceSyncActive.value = false
    isListening.value = false

    if (recognition) {
      recognition.onend = null // prevent auto-restart
      try {
        recognition.stop()
      } catch {
        // ignore — may already be stopped
      }
      recognition = null
    }

    if (wpmInterval) {
      clearInterval(wpmInterval)
      wpmInterval = null
    }

    // Final WPM update
    updateWPM()

    // Compute calibrated speed
    let calibrated: number | null = null
    if (smoothedWPM > 0 && getScrollGeometry) {
      const geo = getScrollGeometry()
      if (geo) {
        const totalScrollDistance = geo.scrollHeight - geo.clientHeight
        calibrated = calibrateSpeed(smoothedWPM, words.value.length, totalScrollDistance)
        if (calibrated !== null) {
          saveCalibratedSpeed(calibrated)
        }
      }
    }

    return calibrated
  }

  return {
    isVoiceSyncActive,
    isSupported,
    isListening,
    wordCursor,
    speakerWPM,
    words,
    parseScript,
    start,
    stop,
  }
}
