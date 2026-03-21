# Voice Sync — Implementation Plan

## Goal

Add a **voice sync** mode to the teleprompter that:
1. Listens to the speaker's voice via the microphone.
2. Matches spoken words to the script text in real time.
3. Automatically scrolls the teleprompter to follow the speaker.
4. Measures the speaker's pace and **permanently saves** an optimal scroll speed for future manual-mode sessions.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                      TeleprompterView.vue                        │
│                                                                  │
│  ┌────────────────┐    ┌──────────────────┐   ┌──────────────┐  │
│  │ useVoiceSync() │───▶│  Word Matcher     │──▶│ Scroll Driver│  │
│  │  (composable)  │    │  (fuzzy align)    │   │ (smooth RAF) │  │
│  └───────┬────────┘    └──────────────────┘   └──────────────┘  │
│          │                                                       │
│          │  mic audio                                            │
│          ▼                                                       │
│  ┌────────────────┐    ┌──────────────────┐                     │
│  │ SpeechRecog.   │    │ Speed Calibrator  │                     │
│  │ (Web Speech    │    │ (EMA WPM → speed) │                     │
│  │   API)         │    └────────┬─────────┘                     │
│  └────────────────┘             │                                │
│                                 ▼                                │
│                        ┌──────────────────┐                     │
│                        │ Persist to        │                     │
│                        │ localStorage      │                     │
│                        └──────────────────┘                     │
└──────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Core Voice Tracking

### 1.1 New composable: `src/composables/useVoiceSync.ts`

Create a self-contained composable that encapsulates all voice-sync logic.

**Exports:**
```typescript
interface UseVoiceSyncReturn {
  /** Whether voice sync is currently active */
  isVoiceSyncActive: Ref<boolean>
  /** Whether the browser supports the feature */
  isSupported: Ref<boolean>
  /** Whether the mic is actively listening */
  isListening: Ref<boolean>
  /** Index of the current word in the parsed word array */
  wordCursor: Ref<number>
  /** Start voice tracking */
  start: (fromWordIndex?: number) => void
  /** Stop voice tracking */
  stop: () => void
  /** Parse a script string into trackable words */
  parseScript: (text: string) => void
  /** Current speaker WPM (smoothed) */
  speakerWPM: Ref<number>
}
```

**Internal state:**
- `words[]`: Parsed array of `{ text: string, norm: string, element?: HTMLElement }`.
- `wordCursor`: Current position in the script.
- `recognition`: `SpeechRecognition` instance.

### 1.2 Script parsing

Parse the plain-text content (after stripping HTML from the rendered markdown) into word tokens:

```typescript
interface ScriptWord {
  text: string       // original word text
  norm: string       // lowercase, non-alpha stripped
  index: number      // position in the word array
}

function parseScript(text: string): ScriptWord[] {
  return text.split(/\s+/).filter(Boolean).map((w, i) => ({
    text: w,
    norm: w.toLowerCase().replace(/[^a-z0-9]/g, ''),
    index: i,
  }))
}
```

### 1.3 Fuzzy word matching (sliding-window approach)

Based on findings from [investigate.md](./investigate.md), use the sliding-window fuzzy match:

```
On each SpeechRecognition result:
  1. Normalize heard text → heardWords[]
  2. Search window: [cursor − 2, cursor + 30]
  3. For each alignment (scriptPos, heardStart):
     - Walk forward, matching words with fuzzy compare
     - Allow up to 3 skips (filler / recognition errors)
     - Score = matchLen + significantMatches × 0.5 + proximityBonus
  4. Advance cursor to best match, capped at max(8, heardLen × 1.5)
```

**Fuzzy compare function:**
```typescript
function wordsMatch(a: string, b: string): boolean {
  if (a === b) return true
  if (a.length < 4 || b.length < 4) return false
  // Prefix match (tolerates suffix errors)
  const minLen = Math.min(a.length, b.length)
  const prefixLen = Math.max(3, minLen - 1)
  if (a.slice(0, prefixLen) === b.slice(0, prefixLen)) return true
  return false
}
```

### 1.4 Integration with TeleprompterView.vue

**Scroll driving:**
When voice sync is active, replace the fixed-speed RAF scroll with a word-position-driven scroll:

```typescript
// In TeleprompterView.vue, watch wordCursor
watch(wordCursor, (newIdx) => {
  const wordEl = getWordElement(newIdx)
  if (wordEl && scrollEl.value) {
    const targetTop = wordEl.offsetTop - scrollEl.value.clientHeight * 0.35
    smoothScrollTo(scrollEl.value, targetTop)
  }
})
```

This requires the rendered content to have individual word elements (spans) with data attributes. We will wrap each word in a `<span data-word-idx="N">` during rendering.

**Content rendering change:**
Modify the `renderedContent` computed to wrap words in spans:

```typescript
const renderedContent = computed(() => {
  if (!voiceSyncActive.value) {
    return marked.parse(rawContent.value || '') as string
  }
  // Wrap each word in a trackable span
  return wrapWordsInSpans(marked.parse(rawContent.value || '') as string)
})
```

### 1.5 UI controls

Add a **microphone toggle button** to the control panel:

- Icon: microphone SVG (Lucide-style, matching existing icons)
- States: off (default), listening (active, pulsing indicator), unsupported (hidden/disabled)
- Position: in the `.controls-inner` bar, after the play/pause button
- Keyboard shortcut: `V` key

When toggled on:
1. Request microphone permission.
2. Start `SpeechRecognition`.
3. Disable the speed slider (speed is now driven by voice).
4. Show a small "listening" indicator (pulsing dot or mic icon highlight).

When toggled off:
1. Stop `SpeechRecognition`.
2. Re-enable the speed slider.
3. Resume fixed-speed scroll from the current position.

---

## Phase 2: Auto Speed Calibration

### 2.1 WPM measurement

While voice sync is active, track:
- `matchedWordCount`: number of words the cursor has advanced.
- `trackingStartTime`: timestamp when voice sync started.
- Calculate `rawWPM = (matchedWordCount / elapsedSeconds) × 60`.

Apply **Exponential Moving Average** for smoothing:
```typescript
smoothedWPM = 0.2 * rawWPM + 0.8 * smoothedWPM
```

Update `smoothedWPM` every ~5 seconds (not on every word match to avoid noise).

### 2.2 WPM → scroll speed mapping

The current teleprompter uses `px/s = speed × 20` where speed is 1–20.

To convert WPM to speed, we need: `speed = WPM × avgWordWidth / (20)` where `avgWordWidth` depends on font size and content width.

A more practical approach — **calibration at runtime**:
1. Compute `totalWords` in the script.
2. Compute `totalScrollDistance = scrollHeight − clientHeight` (px).
3. `pxPerWord = totalScrollDistance / totalWords`.
4. `requiredPPS = smoothedWPM / 60 × pxPerWord` (px per second).
5. `calibratedSpeed = clamp(Math.round(requiredPPS / 20), 1, 20)`.

### 2.3 Persist calibrated speed

When voice sync session ends (user toggles off or script finishes):
1. Save `calibratedSpeed` to `localStorage` under key `voice-sync-calibrated-speed`.
2. On next app load, use this as the **default speed** instead of the hardcoded default.
3. Optionally save per-script calibrated speed in the IndexedDB `Script` record.

```typescript
// Save
localStorage.setItem('voice-sync-calibrated-speed', String(calibratedSpeed))

// Load (in TeleprompterView.vue setup)
const savedSpeed = Number(localStorage.getItem('voice-sync-calibrated-speed'))
if (savedSpeed >= 1 && savedSpeed <= 20) speed.value = savedSpeed
```

---

## Phase 3: Polish & Edge Cases

### 3.1 Microphone permission handling

- Use `navigator.permissions.query({ name: 'microphone' })` to check permission status before showing the button.
- Show a clear prompt/toast when permission is denied.
- Handle `NotAllowedError` from `getUserMedia` gracefully.

### 3.2 Recognition auto-restart

`SpeechRecognition` can silently stop (e.g., after long pauses or network issues). On the `onend` event, auto-restart if voice sync is still active:

```typescript
recognition.onend = () => {
  if (isVoiceSyncActive.value) {
    try { recognition.start() } catch {}
  }
}
```

### 3.3 Language support

- Default to `'en-US'`.
- Allow user to select language (future enhancement — add a language selector when voice sync is enabled).
- The `SpeechRecognition.lang` property accepts BCP 47 language tags.

### 3.4 Visual feedback

- **Word highlight**: Optionally highlight the current word (bold or color change) in the teleprompter. This requires the span-wrapped rendering from Phase 1.
- **Confidence indicator**: Show a small bar/dot indicating match confidence (green = good tracking, yellow = searching, red = lost).

### 3.5 Remote control integration

When voice sync state changes, broadcast via the existing PeerJS remote control channel so that:
- Remote display (shared session) follows the same word position.
- Remote controller shows voice sync status.

---

## File Changes Summary

| File | Change | Phase |
|---|---|---|
| `src/composables/useVoiceSync.ts` | **New** — core voice sync composable | 1 |
| `src/components/TeleprompterView.vue` | Add mic button, integrate `useVoiceSync`, word-span rendering | 1 |
| `src/components/TeleprompterView.vue` | Persist calibrated speed to localStorage | 2 |
| `src/storage/db.ts` | Optionally add `calibratedSpeed` to `Script` interface | 2 |
| `src/composables/useRemoteControl.ts` | Broadcast voice sync state in remote protocol | 3 |
| Unit tests | `useVoiceSync` parsing and matching tests | 1 |
| E2E tests | Voice sync UI toggle test (mocked `SpeechRecognition`) | 1–2 |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Browser doesn't support Web Speech API | Feature unavailable in Firefox | Hide button, show tooltip explaining requirement |
| Poor recognition accuracy (accent, noise) | Cursor jumps incorrectly | Fuzzy matching + jump cap + proximity bonus |
| Recognition stops silently | Scroll stops following | Auto-restart on `onend` event |
| Microphone permission denied | Feature doesn't work | Graceful error handling, clear user message |
| Performance impact from DOM word wrapping | Slow rendering for long scripts | Only wrap words when voice sync is active; use `v-html` swap |
| Cloud dependency (Chrome sends audio to Google) | Privacy concern | Document clearly in UI; Safari uses on-device recognition |

---

## Estimated Effort

| Phase | Tasks | Estimate |
|---|---|---|
| Phase 1 | Composable + matching + UI + basic tests | 3–5 days |
| Phase 2 | WPM calibration + persistence | 1–2 days |
| Phase 3 | Polish, edge cases, remote integration | 2–3 days |
| **Total** | | **6–10 days** |

---

## Open Questions

1. **Should word highlighting be opt-in?** Some speakers may find it distracting.
2. **Should the audio-level fallback (no speech recognition) be implemented for Firefox?** Lower accuracy but broader support.
3. **Multi-language support priority?** Which languages to support in the initial release?
4. **Should calibrated speed be global or per-script?** Per-script is more accurate but adds DB schema changes.
