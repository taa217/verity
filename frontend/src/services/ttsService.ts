/**
 * TTS Service — Cartesia (via backend proxy) with browser speechSynthesis fallback.
 *
 * Exposes two plain functions that get injected into the react-live scope so
 * AI-generated lesson code can call them directly:
 *
 *   speak(text, { onEnd?, onError? })   – start speaking
 *   cancelSpeech()                      – stop whatever is playing
 */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const TTS_ENDPOINT = "http://localhost:8000/tts";

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------
let _currentAudio: HTMLAudioElement | null = null;
let _currentUtterance: SpeechSynthesisUtterance | null = null;
let _currentBlobUrl: string | null = null;
let _abortController: AbortController | null = null;

// Prefetch cache: text → blob URL (keeps last N)
const _prefetchCache = new Map<string, string>();
const MAX_PREFETCH = 12;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Clean up all active playback resources. */
function _cleanup(): void {
  // Abort in-flight fetch
  if (_abortController) {
    _abortController.abort();
    _abortController = null;
  }

  // Stop HTML Audio
  if (_currentAudio) {
    _currentAudio.pause();
    _currentAudio.removeAttribute("src");
    _currentAudio.load(); // release media resources
    _currentAudio = null;
  }

  // Revoke object URL (unless it's in the prefetch cache)
  if (_currentBlobUrl && !_prefetchCache.has(_currentBlobUrl)) {
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

/** Fall back to browser speechSynthesis. */
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
    onEnd?.(); // treat errors as "done" so scene advances
  };

  window.speechSynthesis.speak(utterance);
}

// ---------------------------------------------------------------------------
// Public API (injected into react-live scope)
// ---------------------------------------------------------------------------

export interface SpeakOptions {
  onEnd?: () => void;
  onError?: () => void;
}

/**
 * Speak the given text. First tries Cartesia via the backend proxy; if that
 * fails for any reason (no API key, network error, etc.) falls back to the
 * browser's built-in speech synthesis.
 */
export function speak(text: string, options: SpeakOptions = {}): void {
  const { onEnd, onError } = options;

  // Cancel anything currently playing
  _cleanup();

  if (!text.trim()) {
    onEnd?.();
    return;
  }

  // Check prefetch cache first
  const cached = _prefetchCache.get(text.trim());
  if (cached) {
    _playBlobUrl(cached, onEnd, onError);
    return;
  }

  // Try Cartesia via backend
  const controller = new AbortController();
  _abortController = controller;

  fetch(TTS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: text.trim() }),
    signal: controller.signal,
  })
    .then((res) => {
      if (!res.ok) throw new Error(`TTS endpoint returned ${res.status}`);
      return res.blob();
    })
    .then((blob) => {
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      _playBlobUrl(url, onEnd, onError);
    })
    .catch((err) => {
      if (controller.signal.aborted) return;
      // Cartesia unavailable — fall back to browser TTS
      console.warn("[TTS] Cartesia unavailable, falling back to browser:", err.message);
      _speakBrowser(text, onEnd, onError);
    });
}

/**
 * Cancel any in-progress speech (Cartesia audio or browser TTS).
 */
export function cancelSpeech(): void {
  _cleanup();
}

/**
 * Prefetch audio for a piece of text so it's ready to play instantly later.
 * Silently does nothing if the backend is unavailable.
 */
export function prefetchSpeech(text: string): void {
  const trimmed = text.trim();
  if (!trimmed || _prefetchCache.has(trimmed)) return;

  fetch(TTS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: trimmed }),
  })
    .then((res) => {
      if (!res.ok) return;
      return res.blob();
    })
    .then((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      _prefetchCache.set(trimmed, url);

      // Evict oldest if over limit
      if (_prefetchCache.size > MAX_PREFETCH) {
        const oldest = _prefetchCache.keys().next().value;
        if (oldest) {
          const oldUrl = _prefetchCache.get(oldest);
          if (oldUrl) URL.revokeObjectURL(oldUrl);
          _prefetchCache.delete(oldest);
        }
      }
    })
    .catch(() => {
      // Silently ignore — prefetch is best-effort
    });
}
