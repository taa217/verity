/**
 * TTS Service — Cartesia (via backend proxy) with browser speechSynthesis fallback.
 *
 * Exposes plain functions injected into the react-live scope so
 * AI-generated lesson code can call them directly:
 *
 *   speak(text, { onEnd?, onError? })     – start speaking
 *   cancelSpeech()                        – stop whatever is playing
 *   prefetchSpeech(text)                  – pre-load single scene audio
 *   prefetchAllScenes(narrations)         – pre-load ALL scene audio in parallel
 *   cancelAllPrefetches()                 – abort in-flight prefetches
 *
 * Browser TTS is ONLY used when Cartesia genuinely fails (API error, no key,
 * network down) — never as a speed/timeout fallback.
 */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const TTS_ENDPOINT = "http://localhost:8000/tts";
const PREFETCH_STAGGER_MS = 150;

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------
let _currentAudio: HTMLAudioElement | null = null;
let _currentUtterance: SpeechSynthesisUtterance | null = null;
let _currentBlobUrl: string | null = null;
let _abortController: AbortController | null = null;

/**
 * Generation counter — incremented every time playback is cleaned up.
 * Any async callback whose captured gen !== _speakGen is stale and must bail.
 */
let _speakGen = 0;

// Prefetch cache: trimmed text → blob URL
const _prefetchCache = new Map<string, string>();
const MAX_PREFETCH = 30;

// Fast lookup set of all blob URLs currently held in the prefetch cache,
// so _cleanup() can avoid revoking URLs that are still reusable.
const _prefetchBlobUrls = new Set<string>();

// Pending prefetches: trimmed text → Promise<blobUrl | null>
const _pendingPrefetches = new Map<string, Promise<string | null>>();

// Per-prefetch abort controllers (keyed by trimmed text)
const _prefetchAbortControllers = new Map<string, AbortController>();

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Clean up all active playback resources and bump the generation counter. */
function _cleanup(): void {
  _speakGen++;

  // Abort in-flight speak() fetch (NOT prefetches — those stay alive)
  if (_abortController) {
    _abortController.abort();
    _abortController = null;
  }

  // Stop HTML Audio
  if (_currentAudio) {
    _currentAudio.pause();
    _currentAudio.removeAttribute("src");
    _currentAudio.load();
    _currentAudio = null;
  }

  // Revoke object URL only if it's NOT in the prefetch cache
  if (_currentBlobUrl && !_prefetchBlobUrls.has(_currentBlobUrl)) {
    URL.revokeObjectURL(_currentBlobUrl);
  }
  _currentBlobUrl = null;

  // Stop browser TTS
  if (_currentUtterance) {
    window.speechSynthesis.cancel();
    _currentUtterance = null;
  }
}

/** Play an audio blob URL and wire callbacks. */
function _playBlobUrl(
  blobUrl: string,
  onEnd?: () => void,
  onError?: () => void,
): void {
  const audio = new Audio(blobUrl);
  _currentAudio = audio;
  _currentBlobUrl = blobUrl;

  audio.onended = () => {
    _currentAudio = null;
    onEnd?.();
  };

  audio.onerror = () => {
    _currentAudio = null;
    onError?.();
  };

  audio.play().catch(() => {
    _currentAudio = null;
    onError?.();
  });
}

/** Fall back to browser speechSynthesis (only on genuine API failure). */
function _speakBrowser(
  text: string,
  onEnd?: () => void,
  onError?: () => void,
): void {
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 1.0;
  _currentUtterance = utterance;

  utterance.onend = () => {
    _currentUtterance = null;
    onEnd?.();
  };

  utterance.onerror = () => {
    _currentUtterance = null;
    onError?.();
    onEnd?.(); // treat errors as "done" so scene advances
  };

  window.speechSynthesis.speak(utterance);
}

/**
 * Fetch audio for a single text from the backend.
 * Returns the blob URL on success, null on failure / abort.
 */
function _fetchAudio(
  text: string,
  signal?: AbortSignal,
): Promise<string | null> {
  return fetch(TTS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal,
  })
    .then((res) => {
      if (!res.ok) return null;
      return res.blob();
    })
    .then((blob) => {
      if (!blob) return null;
      return URL.createObjectURL(blob);
    })
    .catch((err) => {
      if (err.name === "AbortError") return null;
      console.warn("[TTS] Fetch failed:", err.message);
      return null;
    });
}

/** Store a blob URL in the prefetch cache with LRU eviction. */
function _cacheStore(text: string, blobUrl: string): void {
  _prefetchCache.set(text, blobUrl);
  _prefetchBlobUrls.add(blobUrl);

  while (_prefetchCache.size > MAX_PREFETCH) {
    const oldest = _prefetchCache.keys().next().value;
    if (!oldest) break;
    const oldUrl = _prefetchCache.get(oldest);
    if (oldUrl) {
      _prefetchBlobUrls.delete(oldUrl);
      URL.revokeObjectURL(oldUrl);
    }
    _prefetchCache.delete(oldest);
  }
}

// ---------------------------------------------------------------------------
// Public API (injected into react-live scope)
// ---------------------------------------------------------------------------

export interface SpeakOptions {
  onEnd?: () => void;
  onError?: () => void;
}

/**
 * Speak the given text using Cartesia AI voice.
 *
 * Flow:
 * 1. Check prefetch cache → play instantly
 * 2. Check pending prefetches → await the in-flight fetch, then play
 * 3. Neither → start a fresh fetch and wait for it to complete
 * 4. Only on genuine API failure → fall back to browser TTS
 */
export function speak(text: string, options: SpeakOptions = {}): void {
  const { onEnd, onError } = options;

  // Cancel anything currently playing (bumps _speakGen)
  _cleanup();

  const trimmed = text.trim();
  if (!trimmed) {
    onEnd?.();
    return;
  }

  // Capture generation so async callbacks can detect staleness
  const gen = _speakGen;

  // 1. Cache hit — play instantly
  const cached = _prefetchCache.get(trimmed);
  if (cached) {
    _playBlobUrl(cached, onEnd, onError);
    return;
  }

  // 2. Pending prefetch — await it instead of duplicating the request
  const pending = _pendingPrefetches.get(trimmed);
  if (pending) {
    pending.then((blobUrl) => {
      if (gen !== _speakGen) return; // stale — another speak/cancel happened
      if (blobUrl) {
        _playBlobUrl(blobUrl, onEnd, onError);
      } else {
        console.warn("[TTS] Prefetch failed, falling back to browser TTS");
        _speakBrowser(trimmed, onEnd, onError);
      }
    });
    return;
  }

  // 3. No cache, no pending — fresh fetch (no timeout, wait for completion)
  const controller = new AbortController();
  _abortController = controller;

  _fetchAudio(trimmed, controller.signal).then((blobUrl) => {
    if (gen !== _speakGen) return; // stale
    if (blobUrl) {
      _cacheStore(trimmed, blobUrl);
      _playBlobUrl(blobUrl, onEnd, onError);
    } else {
      console.warn("[TTS] Cartesia unavailable, falling back to browser TTS");
      _speakBrowser(trimmed, onEnd, onError);
    }
  });
}

/**
 * Cancel any in-progress speech (Cartesia audio or browser TTS).
 */
export function cancelSpeech(): void {
  _cleanup();
}

/**
 * Prefetch audio for a single piece of text.
 * If already cached or in-flight, this is a no-op.
 */
export function prefetchSpeech(text: string): void {
  const trimmed = text.trim();
  if (!trimmed || _prefetchCache.has(trimmed) || _pendingPrefetches.has(trimmed)) return;

  const controller = new AbortController();
  _prefetchAbortControllers.set(trimmed, controller);

  const promise = _fetchAudio(trimmed, controller.signal).then((blobUrl) => {
    _pendingPrefetches.delete(trimmed);
    _prefetchAbortControllers.delete(trimmed);
    if (blobUrl) {
      _cacheStore(trimmed, blobUrl);
    }
    return blobUrl;
  });

  _pendingPrefetches.set(trimmed, promise);
}

/**
 * Prefetch ALL scene narrations in parallel with a small stagger.
 * speak() will automatically find and await any pending prefetches.
 */
export function prefetchAllScenes(narrations: string[]): void {
  const unique = [...new Set(narrations.map((n) => n.trim()).filter(Boolean))];

  unique.forEach((text, i) => {
    if (_prefetchCache.has(text) || _pendingPrefetches.has(text)) return;

    // Stagger requests to avoid flooding the API
    if (i === 0) {
      // First scene — fetch immediately (no delay)
      prefetchSpeech(text);
    } else {
      setTimeout(() => {
        if (_prefetchCache.has(text) || _pendingPrefetches.has(text)) return;
        prefetchSpeech(text);
      }, i * PREFETCH_STAGGER_MS);
    }
  });
}

/**
 * Cancel all in-flight prefetch requests.
 * Use when starting a new lesson or navigating away.
 */
export function cancelAllPrefetches(): void {
  for (const [, controller] of _prefetchAbortControllers) {
    controller.abort();
  }
  _prefetchAbortControllers.clear();
  _pendingPrefetches.clear();
}
