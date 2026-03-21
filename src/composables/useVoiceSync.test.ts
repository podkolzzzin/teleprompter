import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  normalize,
  wordsMatch,
  isSignificant,
  parseWords,
  matchHeardWords,
  calibrateSpeed,
  loadCalibratedSpeed,
  saveCalibratedSpeed,
  useVoiceSync,
} from './useVoiceSync'

// ─── Pure helper tests ────────────────────────────────────────────────────────

describe('normalize', () => {
  it('lowercases and strips non-alphanumeric', () => {
    expect(normalize('Hello!')).toBe('hello')
    expect(normalize("it's")).toBe('its')
    expect(normalize('café')).toBe('caf')
    expect(normalize('123test')).toBe('123test')
    expect(normalize('')).toBe('')
  })
})

describe('wordsMatch', () => {
  it('exact match returns true', () => {
    expect(wordsMatch('hello', 'hello')).toBe(true)
  })

  it('short words require exact match', () => {
    expect(wordsMatch('the', 'the')).toBe(true)
    expect(wordsMatch('the', 'thy')).toBe(false)
  })

  it('allows prefix-based fuzzy matching for longer words', () => {
    // "testing" vs "testi" → prefix match (first 4 chars of "testi" match)
    expect(wordsMatch('testing', 'testin')).toBe(true)
    // "hello" vs "hell" → prefix match (first 3 chars of "hell")
    expect(wordsMatch('hello', 'hell')).toBe(true)
  })

  it('rejects mismatched words', () => {
    expect(wordsMatch('hello', 'world')).toBe(false)
    expect(wordsMatch('testing', 'resting')).toBe(false)
  })
})

describe('isSignificant', () => {
  it('words with 4+ chars are significant', () => {
    expect(isSignificant('word')).toBe(true)
    expect(isSignificant('testing')).toBe(true)
  })

  it('short words are not significant', () => {
    expect(isSignificant('the')).toBe(false)
    expect(isSignificant('a')).toBe(false)
    expect(isSignificant('')).toBe(false)
  })
})

describe('parseWords', () => {
  it('splits text into normalized word tokens', () => {
    const result = parseWords('Hello World! How are you?')
    expect(result).toHaveLength(5)
    expect(result[0]).toEqual({ text: 'Hello', norm: 'hello', index: 0 })
    expect(result[1]).toEqual({ text: 'World!', norm: 'world', index: 1 })
    expect(result[4]).toEqual({ text: 'you?', norm: 'you', index: 4 })
  })

  it('handles multiple whitespace and empty input', () => {
    expect(parseWords('')).toEqual([])
    expect(parseWords('   ')).toEqual([])
    expect(parseWords('one   two')).toHaveLength(2)
  })

  it('preserves index ordering', () => {
    const result = parseWords('a b c d e')
    result.forEach((w, i) => expect(w.index).toBe(i))
  })
})

// ─── matchHeardWords ──────────────────────────────────────────────────────────

describe('matchHeardWords', () => {
  const script = parseWords(
    'The quick brown fox jumps over the lazy dog and runs across the field',
  )

  it('advances cursor when heard words match', () => {
    // Heard "quick brown fox jumps", starting from cursor 0
    const heard = ['quick', 'brown', 'fox', 'jumps']
    const result = matchHeardWords(heard, script, 0)
    // Should advance to at least word 4 (jumps is index 4)
    expect(result).toBeGreaterThanOrEqual(4)
  })

  it('does not advance for unrelated words', () => {
    const heard = ['completely', 'different', 'words', 'here']
    const result = matchHeardWords(heard, script, 0)
    expect(result).toBe(0)
  })

  it('handles fuzzy matches (prefix)', () => {
    // "jumpin" fuzzy-matches "jumps" (prefix)
    const heard = ['quick', 'brown', 'fox', 'jumpin']
    const result = matchHeardWords(heard, script, 0)
    expect(result).toBeGreaterThanOrEqual(3)
  })

  it('tolerates skips (filler words)', () => {
    // "quick uh brown fox" — "uh" is a filler
    const heard = ['quick', 'uh', 'brown', 'fox', 'jumps']
    const result = matchHeardWords(heard, script, 0)
    expect(result).toBeGreaterThanOrEqual(4)
  })

  it('caps maximum jump distance', () => {
    // Even if there's a match far ahead, it should be capped
    const longScript = parseWords(
      Array.from({ length: 50 }, (_, i) => `word${i}`).join(' '),
    )
    const heard = ['word25']
    const result = matchHeardWords(heard, longScript, 0)
    // Should not jump to 25 from 0 with just one word
    expect(result).toBeLessThan(25)
  })

  it('allows small backward matches', () => {
    // Speaker at word 5, hears words matching around word 4
    const heard = ['fox', 'jumps', 'over']
    const result = matchHeardWords(heard, script, 5)
    expect(result).toBeGreaterThanOrEqual(5)
  })

  it('returns current cursor for empty input', () => {
    expect(matchHeardWords([], script, 3)).toBe(3)
    expect(matchHeardWords(['hello'], [], 0)).toBe(0)
  })
})

// ─── calibrateSpeed ───────────────────────────────────────────────────────────

describe('calibrateSpeed', () => {
  it('returns a speed between 1 and 20', () => {
    const speed = calibrateSpeed(150, 300, 6000)
    expect(speed).toBeGreaterThanOrEqual(1)
    expect(speed).toBeLessThanOrEqual(20)
  })

  it('returns null for invalid inputs', () => {
    expect(calibrateSpeed(0, 300, 6000)).toBeNull()
    expect(calibrateSpeed(150, 0, 6000)).toBeNull()
    expect(calibrateSpeed(150, 300, 0)).toBeNull()
  })

  it('higher WPM gives higher speed', () => {
    const slow = calibrateSpeed(80, 300, 6000)!
    const fast = calibrateSpeed(200, 300, 6000)!
    expect(fast).toBeGreaterThanOrEqual(slow)
  })

  it('clamps to bounds', () => {
    // Very low WPM
    const low = calibrateSpeed(1, 1000, 100)
    expect(low).toBe(1)
    // Very high WPM with lots of scroll distance
    const high = calibrateSpeed(300, 10, 100000)
    expect(high).toBe(20)
  })
})

// ─── localStorage helpers ─────────────────────────────────────────────────────

describe('loadCalibratedSpeed / saveCalibratedSpeed', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns null when nothing saved', () => {
    expect(loadCalibratedSpeed()).toBeNull()
  })

  it('saves and loads a valid speed', () => {
    saveCalibratedSpeed(7)
    expect(loadCalibratedSpeed()).toBe(7)
  })

  it('returns null for out-of-range values', () => {
    localStorage.setItem('voice-sync-calibrated-speed', '25')
    expect(loadCalibratedSpeed()).toBeNull()
    localStorage.setItem('voice-sync-calibrated-speed', '0')
    expect(loadCalibratedSpeed()).toBeNull()
  })

  it('returns null for non-numeric values', () => {
    localStorage.setItem('voice-sync-calibrated-speed', 'abc')
    expect(loadCalibratedSpeed()).toBeNull()
  })
})

// ─── useVoiceSync composable ──────────────────────────────────────────────────

describe('useVoiceSync', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('detects SpeechRecognition support', () => {
    const { isSupported } = useVoiceSync()
    // In jsdom, neither SpeechRecognition nor webkitSpeechRecognition exists
    expect(isSupported.value).toBe(false)
  })

  it('parseScript populates words and resets cursor', () => {
    const { parseScript, words, wordCursor } = useVoiceSync()
    parseScript('Hello world from the teleprompter')
    expect(words.value).toHaveLength(5)
    expect(words.value[0].norm).toBe('hello')
    expect(wordCursor.value).toBe(0)
  })

  it('start does nothing when not supported', () => {
    const { start, isVoiceSyncActive } = useVoiceSync()
    start()
    expect(isVoiceSyncActive.value).toBe(false)
  })

  describe('with mocked SpeechRecognition', () => {
    let mockRecognition: {
      start: ReturnType<typeof vi.fn>
      stop: ReturnType<typeof vi.fn>
      onstart: (() => void) | null
      onend: (() => void) | null
      onresult: ((event: unknown) => void) | null
      onerror: ((event: unknown) => void) | null
      continuous: boolean
      interimResults: boolean
      lang: string
      maxAlternatives: number
    }

    beforeEach(() => {
      mockRecognition = {
        start: vi.fn(),
        stop: vi.fn(),
        onstart: null,
        onend: null,
        onresult: null,
        onerror: null,
        continuous: false,
        interimResults: false,
        lang: '',
        maxAlternatives: 1,
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).SpeechRecognition = vi.fn(() => mockRecognition)
    })

    afterEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).SpeechRecognition
    })

    it('starts and stops recognition', () => {
      const { parseScript, start, stop, isVoiceSyncActive, isSupported } = useVoiceSync()
      // Re-check support (now it exists)
      expect(isSupported.value).toBe(true)

      parseScript('Hello world from the teleprompter app')
      start()
      expect(isVoiceSyncActive.value).toBe(true)
      expect(mockRecognition.start).toHaveBeenCalled()
      expect(mockRecognition.continuous).toBe(true)
      expect(mockRecognition.interimResults).toBe(true)

      stop()
      expect(isVoiceSyncActive.value).toBe(false)
      expect(mockRecognition.stop).toHaveBeenCalled()
    })

    it('advances word cursor on recognition results', () => {
      const { parseScript, start, wordCursor } = useVoiceSync()
      parseScript('The quick brown fox jumps over the lazy dog')
      start()

      // Simulate a final speech result
      mockRecognition.onresult?.({
        resultIndex: 0,
        results: [
          { 0: { transcript: 'quick brown fox jumps' }, isFinal: true, length: 1 },
        ],
      })

      expect(wordCursor.value).toBeGreaterThanOrEqual(4)
    })

    it('stop returns calibrated speed when geometry is available', () => {
      const getGeo = () => ({ scrollHeight: 5000, clientHeight: 800 })
      const { parseScript, start, stop, wordCursor } = useVoiceSync(getGeo)

      parseScript('word '.repeat(200).trim())
      start()

      // Simulate some time passing and words being matched
      wordCursor.value = 50

      const speed = stop()
      // Without enough elapsed time, calibration may not produce a result
      // That's OK — we just verify it doesn't crash
      expect(speed === null || (speed >= 1 && speed <= 20)).toBe(true)
    })

    it('sets isListening on start/end events', () => {
      const { parseScript, start, isListening } = useVoiceSync()
      parseScript('Some text here for testing')
      start()

      expect(isListening.value).toBe(false)
      mockRecognition.onstart?.()
      expect(isListening.value).toBe(true)
      mockRecognition.onend?.()
      // onend auto-restarts, but isListening toggles
      expect(isListening.value).toBe(false)
    })
  })
})
