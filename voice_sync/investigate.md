# Voice Sync — Investigation

## Overview

**Voice sync** (also called "voice-tracking" or "mic-sync") is a feature where the teleprompter listens to the speaker's voice through the microphone and automatically scrolls the script to match the words being spoken in real time. Instead of scrolling at a fixed speed, the text follows the speaker — speeding up when they speak faster, slowing down or pausing when they pause, and even recovering when they skip or repeat words.

Several open-source teleprompter apps implement this feature. Below is a summary of publicly available approaches, the underlying browser APIs, and key trade-offs.

---

## Browser API: Web Speech API — `SpeechRecognition`

All surveyed implementations use the **Web Speech API** (`SpeechRecognition` / `webkitSpeechRecognition`), a browser-native API that converts speech to text in real time.

### Key configuration

| Property | Recommended value | Why |
|---|---|---|
| `continuous` | `true` | Keep recognizing until explicitly stopped |
| `interimResults` | `true` | Get partial (non-final) results for low-latency feedback |
| `lang` | e.g. `'en-US'` | Must match the script language |
| `maxAlternatives` | `1`–`3` | Multiple alternatives improve fuzzy matching |

### How it works

1. The browser streams microphone audio to a cloud-based speech engine (Google's servers in Chrome).
2. The engine returns `SpeechRecognitionResult` objects with `isFinal` (committed text) and interim (tentative text) transcripts.
3. Our code matches these transcripts against the known script text and advances a word cursor.

### Browser support

| Browser | Support |
|---|---|
| Chrome / Edge / Opera | ✅ Full (uses Google's backend) |
| Safari (macOS/iOS 14.5+) | ✅ On-device recognition |
| Firefox | ❌ Not supported |
| Firefox Android | ❌ Not supported |

> **Takeaway:** Voice sync must be presented as an optional enhancement with a clear fallback (manual speed control). A "browser not supported" message should be shown when `SpeechRecognition` is unavailable.

---

## Approach 1: Word-Pointer with Fuzzy Sliding-Window Match

**Used by:** [chgeuer/voice_prompt](https://github.com/chgeuer/voice_prompt) (Phoenix LiveView)

This is the most robust approach found. The algorithm:

### Script preprocessing

```
parse script → array of { text, norm, sentenceIdx, paraBreakAfter }
norm(word) = lowercase + strip non-alphanumeric
```

### On each speech result

1. **Normalize** heard text into an array of words.
2. **Define a search window** around the current word cursor: `[cursor − 2, cursor + 30]`.
3. **Slide** over all possible alignments between heard words and script words within this window.
4. For each alignment, count **match length** and **significant matches** (words ≥ 4 chars).
5. Allow **up to 3 skips** (filler words, recognition errors) in alignment.
6. Score each alignment: `matchLen + (significantMatches × 0.5) + proximityBonus`.
7. Advance cursor to the best-scoring match position, capped at `max(8, heardWords.length × 1.5)` to prevent wild jumps.

### Word matching (fuzzy)

```javascript
wordsMatch(a, b) {
  if (a === b) return true;
  if (a.length < 4 || b.length < 4) return false;
  if (a.startsWith(b.slice(0, -1)) || b.startsWith(a.slice(0, -1))) return true;
  // also: substring containment for words > 5 chars
}
```

### Scrolling

Smooth scroll using `requestAnimationFrame` with lerp (linear interpolation): `current += (target − current) × 0.08`.

### Strengths
- Handles filler words, minor recognition errors, and speaker hesitations gracefully.
- Proximity bonus prevents jumping far ahead on coincidental matches.
- Jump cap prevents catastrophic misalignment.

### Weaknesses
- O(n × m) per speech result (window × heard words) — fine in practice since windows are small.
- Prefix-based fuzzy matching may miss heavily misrecognized words.

---

## Approach 2: Sequential Similarity Scoring

**Used by:** [JasonHughes94/prompt-d](https://github.com/JasonHughes94/prompt-d) (React + Tauri)

A simpler approach:

1. Split the script into an array of words.
2. Maintain a `progress` index (next expected word).
3. On each interim transcript, split it into words and iterate sequentially:
   ```
   for each heard word:
     similarity = stringSimilarity(heard, script[progress])
     if similarity > 0.75: progress++
   ```
4. Scroll the word at `progress + 3` into view using `scrollIntoView({ behavior: 'smooth' })`.

### Similarity function

Uses **Dice coefficient** (bigram overlap) via `string-similarity-js`:
```
dice(a, b) = 2 × |bigrams(a) ∩ bigrams(b)| / (|bigrams(a)| + |bigrams(b)|)
```

### Strengths
- Very simple to implement and understand.
- Dice coefficient handles common recognition errors well.

### Weaknesses
- Strictly sequential — cannot recover if the speaker skips ahead or goes back.
- No tolerance for filler words or insertions.
- Fixed threshold (0.75) may be too strict or too loose depending on language/accent.

---

## Approach 3: Dual-Mode with Pointer + Lookahead

**Used by:** [Atanu789/Scriptum](https://github.com/Atanu789/Scriptum) (React/Next.js)

A middle-ground approach:

1. Pre-parse script into `{ clean, charStart }` word tokens.
2. Maintain a `recogPtr` (recognition pointer) into the word array.
3. On **final** results: search ahead up to **20 words** from pointer; advance pointer on exact match or 3-char prefix match.
4. On **interim** results: search ahead up to **12 words** from pointer; only update the highlight (not the pointer) for live feedback.
5. Scroll is driven by the character-level highlight position, not the recognition pointer directly.

### Strengths
- Separates "committed position" (final results) from "tentative highlight" (interim results), reducing jitter.
- Dual-mode: can switch between TTS-driven scroll and mic-sync at runtime.

### Weaknesses
- No fuzzy matching beyond prefix — misrecognized words are simply skipped.
- No backward search — cannot recover if speaker repeats a line.

---

## Auto Speed Adjustment (Permanent)

The issue mentions **permanently adjusting speed** based on the speaker's pace. None of the surveyed implementations do this directly, but the concept can be derived from the voice-tracking data:

### Approach: Measure Words-Per-Minute (WPM) and Map to Scroll Speed

1. While voice sync is active, track:
   - `wordsSpoken` (how many script words matched).
   - `elapsedTime` (wall-clock time since tracking started).
2. Compute `WPM = (wordsSpoken / elapsedTime) × 60`.
3. Map WPM to a scroll speed using a calibration formula:
   ```
   speed = WPM × avgCharsPerWord × charWidthPx / (fontSize × lineHeightRatio × viewportHeight)
   ```
   Or more practically: run a calibration pass, then store the resulting `px/s ↔ WPM` mapping.
4. **Persist** the computed speed to localStorage/IndexedDB so it is used as the default for future sessions.

### Adaptive approach (EMA)

Use an **Exponential Moving Average** to smooth WPM measurements:
```
smoothedWPM = α × currentWPM + (1 − α) × smoothedWPM   (α ≈ 0.2)
```

This adapts to the speaker over time without reacting to momentary pauses or bursts.

---

## Alternative: Audio-Level Scroll (No Speech Recognition)

Some apps use a simpler approach: analyze the raw audio level (volume) from the microphone and use it to modulate scroll speed:

- Louder → scroll faster
- Silence → pause or slow down

This can be done with the **Web Audio API** (`AudioContext` + `AnalyserNode`) and requires no speech-to-text at all.

### Strengths
- Works in all browsers (Web Audio API is universal)
- Zero latency, no cloud dependency
- Language-agnostic

### Weaknesses
- No word-level accuracy — cannot highlight specific words
- Ambient noise affects behavior
- Cannot detect when the speaker skips ahead

---

## Comparison Summary

| Aspect | Sliding-Window Fuzzy | Sequential Similarity | Pointer + Lookahead | Audio-Level |
|---|---|---|---|---|
| **Accuracy** | High | Medium | Medium-High | Low |
| **Recovery from skips** | ✅ Yes | ❌ No | Partial | ❌ No |
| **Handles filler words** | ✅ Yes | ❌ No | Partial | N/A |
| **Complexity** | Medium | Low | Medium | Low |
| **Browser support** | Chrome/Edge/Safari | Chrome/Edge/Safari | Chrome/Edge/Safari | All |
| **Language support** | Depends on API | Depends on API | Depends on API | All |
| **Word highlighting** | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No |
| **Latency** | ~300ms | ~300ms | ~300ms | ~50ms |
| **Cloud dependency** | Yes (Chrome) | Yes (Chrome) | Yes (Chrome) | No |

---

## Recommendation

For this teleprompter app, the **Sliding-Window Fuzzy Match** approach (Approach 1) offers the best balance of accuracy, robustness, and user experience. It can be combined with **auto speed calibration** to permanently adjust scroll speed.

The **Audio-Level** approach can serve as a lightweight fallback for unsupported browsers.

---

## References

| Source | URL | Notes |
|---|---|---|
| voice_prompt (Elixir/LiveView) | https://github.com/chgeuer/voice_prompt | Most complete open-source implementation |
| prompt-d (React/Tauri) | https://github.com/JasonHughes94/prompt-d | Simple Dice-coefficient approach |
| Scriptum (React/Next.js) | https://github.com/Atanu789/Scriptum | Dual TTS + mic-sync mode |
| Web Speech API spec | https://wicg.github.io/speech-api/ | W3C Community Group specification |
| MDN SpeechRecognition | https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition | API documentation |
| Web Audio API (AnalyserNode) | https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode | For audio-level fallback |
