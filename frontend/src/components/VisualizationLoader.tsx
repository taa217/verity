import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, RotateCcw } from "lucide-react";
import LucidLogo from "./LucidLogo";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface VisualizationLoaderProps {
  topic?: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
  onCancel?: () => void;
  onComplete?: () => void;
  onRetry?: () => void;
  error?: { message: string; details?: string } | null;
}

const PHRASES = [
  "Making it easy to understand.",
  "Choosing examples you'll recognize.",
  "Keeping it short, clear, and practical.",
  "Adding interactive elements.",
];

// ---------------------------------------------------------------------------
// VisualizationLoader
// ---------------------------------------------------------------------------
export default function VisualizationLoader({
  topic = "Personalized Lesson",
  difficulty = "intermediate",
  onCancel,
  onRetry,
  error,
}: VisualizationLoaderProps) {
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    if (error) return;
    const id = setInterval(
      () => setPhraseIndex((p) => (p + 1) % PHRASES.length),
      3500,
    );
    return () => clearInterval(id);
  }, [error]);

  return (
    <div className="loader">
      <div className="loader__bg" aria-hidden="true">
        <div className="loader__blob loader__blob--1" />
        <div className="loader__blob loader__blob--2" />
      </div>

      <AnimatePresence mode="wait">
        {error ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="loader__body"
          >
            <div className="loader__error-icon">
              <AlertCircle size={28} />
            </div>
            <h2 className="loader__title">Something went wrong</h2>
            <p className="loader__sub">
              {error.message || "Generation was interrupted. Your progress is safe."}
            </p>
            <div className="loader__actions">
              <button className="loader__btn loader__btn--ghost" onClick={onCancel}>
                Go back
              </button>
              <button className="loader__btn loader__btn--primary" onClick={onRetry}>
                <RotateCcw size={14} /> Try again
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="loading"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="loader__body"
          >
            {/* Ring spinner */}
            <div className="loader__ring-wrap">
              <svg className="loader__ring" viewBox="0 0 120 120">
                <defs>
                  <linearGradient id="lg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#2dd4bf" />
                    <stop offset="100%" stopColor="#0d9488" />
                  </linearGradient>
                </defs>
                <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
                <circle cx="60" cy="60" r="50" fill="none" stroke="url(#lg)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="80 234" className="loader__arc" />
              </svg>
              <div className="loader__logo">
                <LucidLogo size={28} />
              </div>
            </div>

            <h2 className="loader__title">Creating your lesson</h2>
            <p className="loader__sub">
              {difficulty}-level &middot; {topic}
            </p>

            {/* Rotating phrase */}
            <div className="loader__phrase">
              <AnimatePresence mode="wait">
                <motion.span
                  key={phraseIndex}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25 }}
                >
                  {PHRASES[phraseIndex]}
                </motion.span>
              </AnimatePresence>
            </div>

            <button className="loader__cancel-btn" onClick={onCancel}>
              Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
