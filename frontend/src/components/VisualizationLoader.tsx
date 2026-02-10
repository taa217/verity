import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, AlertCircle, ChevronRight, FileText, Bell } from 'lucide-react';
import { useGenerationStages } from '../hooks/useGenerationStages';
import type { GenerationMode } from '../hooks/useGenerationStages';

interface LessonGeneratingScreenProps {
  topic?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  onCancel?: () => void;
  onComplete?: () => void;
  onRetry?: () => void;
  error?: { message: string; details?: string } | null;
  mode?: GenerationMode;
}

const ROTATING_PHRASES = [
  "Making it easy to understand.",
  "Choosing examples you’ll recognize.",
  "Keeping it short, clear, and practical."
];

export default function VisualizationLoader({
  topic = "Personalized Lesson",
  difficulty = "intermediate",
  onCancel,
  onComplete,
  onRetry,
  error: propError,
  mode: propMode
}: LessonGeneratingScreenProps) {
  // Use our hook, but allow props to override mode/control
  const { 
    mode: internalMode, 
    stages, 
    triggerSuccess, 
    triggerError, 
    retry 
  } = useGenerationStages({ onComplete });

  const activeMode = propMode || internalMode;
  const activeError = propError;

  // Rotating phrase logic
  const [phraseIndex, setPhraseIndex] = useState(0);
  useEffect(() => {
    if (activeMode !== 'generating' && activeMode !== 'long_wait') return;
    const interval = setInterval(() => {
      setPhraseIndex(prev => (prev + 1) % ROTATING_PHRASES.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [activeMode]);

  // Sync prop error with hook state if needed (optional, mostly for display)
  useEffect(() => {
    if (propError) triggerError();
  }, [propError, triggerError]);
  
  // Sync prop success if needed
  useEffect(() => {
    if (propMode === 'success') triggerSuccess();
  }, [propMode, triggerSuccess]);

  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [notifyOnReady, setNotifyOnReady] = useState(false);
  const [showOutline, setShowOutline] = useState(false);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: "easeOut" } },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.3 } }
  };

  const listVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-8 bg-neutral-50 dark:bg-slate-900 font-sans text-slate-800 dark:text-slate-100">
      <AnimatePresence mode="wait">
        <motion.div 
          key="card"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden relative"
          role="region"
          aria-live="polite"
        >
          {/* Header */}
          <div className="p-8 pb-4 text-center">
            <div className="mb-4 flex justify-center">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-200 dark:shadow-indigo-900">
                L
              </div>
            </div>
            
            <h1 className="text-2xl font-bold tracking-tight mb-2">
              {activeMode === 'error' ? 'Something interrupted the generation' : 'Creating your lesson'}
            </h1>
            
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
              {activeMode === 'error' 
                ? 'Your progress is safe. Try again or save a draft.'
                : `Tailoring ${difficulty} level examples for "${topic}"`
              }
            </p>
          </div>

          <div className="px-8 py-4">
            {activeMode === 'error' ? (
              // Error State UI
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-100 dark:border-red-900/30 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-red-800 dark:text-red-200 font-medium">
                      {activeError?.message || "Connection timeout"}
                    </p>
                    {activeError?.details && (
                      <div className="mt-2">
                        <button 
                          onClick={() => setShowErrorDetails(!showErrorDetails)}
                          className="text-xs text-red-600 dark:text-red-400 underline hover:text-red-800"
                        >
                          {showErrorDetails ? 'Hide details' : 'Show details'}
                        </button>
                        {showErrorDetails && (
                          <pre className="mt-2 text-xs bg-white dark:bg-black/20 p-2 rounded border border-red-100 dark:border-red-900/30 font-mono overflow-auto max-h-32">
                            {activeError.details}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              // Generation Pipeline
              <div className="relative">
                 {/* Progress Stages */}
                <motion.ul variants={listVariants} initial="hidden" animate="visible" className="space-y-4 mb-8">
                  {stages.map((stage) => {
                    const isActive = stage.status === 'active';
                    const isCompleted = stage.status === 'completed';
                    
                    return (
                      <motion.li 
                        key={stage.id} 
                        variants={itemVariants}
                        className={`flex items-center gap-3 text-sm transition-colors duration-300 ${
                          isActive || isCompleted ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-600'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all duration-300 ${
                          isCompleted 
                            ? 'bg-emerald-500 border-emerald-500 text-white' 
                            : isActive 
                              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
                              : 'border-slate-200 dark:border-slate-700'
                        }`}>
                          {isCompleted ? (
                            <Check className="w-3 h-3" strokeWidth={3} />
                          ) : isActive ? (
                            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                          ) : null}
                        </div>
                        
                        <span className={`font-medium ${isActive ? 'bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent' : ''}`}>
                          {stage.label}
                        </span>
                        
                        {isActive && (
                          <motion.div 
                            layoutId="active-glow"
                            className="ml-auto w-1.5 h-1.5 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.6)]"
                          />
                        )}
                      </motion.li>
                    );
                  })}
                </motion.ul>

                {/* Skeleton Preview Area */}
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-5 border border-slate-100 dark:border-slate-800 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 dark:via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                  
                  <div className="space-y-3">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700/50 rounded w-1/3" />
                    <div className="space-y-2 pt-2">
                      <div className="h-2.5 bg-slate-200 dark:bg-slate-700/50 rounded w-full" />
                      <div className="h-2.5 bg-slate-200 dark:bg-slate-700/50 rounded w-5/6" />
                      <div className="h-2.5 bg-slate-200 dark:bg-slate-700/50 rounded w-4/6" />
                    </div>
                    {/* Exercise Box Skeleton */}
                    <div className="mt-4 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-3">
                       <div className="h-2.5 bg-slate-200 dark:bg-slate-700/50 rounded w-1/4 mb-2" />
                       <div className="h-8 bg-slate-200 dark:bg-slate-700/50 rounded w-full" />
                    </div>
                  </div>
                </div>

                {/* Rotating Microcopy */}
                <div className="h-8 mt-6 flex items-center justify-center text-center">
                   <AnimatePresence mode="wait">
                      <motion.p
                        key={activeMode === 'long_wait' ? 'long' : phraseIndex}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="text-xs text-slate-400 dark:text-slate-500 font-medium"
                      >
                        {activeMode === 'long_wait' 
                          ? "This can take a little longer for complex topics. You can keep this tab open." 
                          : ROTATING_PHRASES[phraseIndex]
                        }
                      </motion.p>
                   </AnimatePresence>
                </div>
              </div>
            )}
          </div>

          {/* Footer / Controls */}
          <div className="p-6 bg-slate-50/50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-4">
             {activeMode === 'error' ? (
                <div className="flex gap-3 justify-end">
                   <button 
                    onClick={onCancel}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                   >
                     Back
                   </button>
                   <button 
                    onClick={() => console.log('Save draft')}
                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-sm transition-all"
                   >
                     Save draft
                   </button>
                   <button 
                    onClick={() => {
                       onRetry?.();
                       retry();
                    }}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md shadow-indigo-200 dark:shadow-indigo-900 transition-all flex items-center gap-2"
                   >
                     <Loader2 className="w-4 h-4" /> Retry
                   </button>
                </div>
             ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                     {activeMode === 'long_wait' && (
                        <button 
                          onClick={() => setNotifyOnReady(!notifyOnReady)}
                          className={`flex items-center gap-2 text-xs font-medium transition-colors ${notifyOnReady ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          <Bell className={`w-3.5 h-3.5 ${notifyOnReady ? 'fill-indigo-600' : ''}`} />
                          {notifyOnReady ? 'We’ll notify you' : 'Notify me when ready'}
                        </button>
                     )}
                     
                     <span className="text-[10px] text-slate-300 dark:text-slate-600 select-none">
                        We don’t train on your content.
                     </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={onCancel}
                      className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={() => setShowOutline(!showOutline)}
                      className="px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                    >
                      View outline
                    </button>
                  </div>
                </div>
             )}
          </div>
          
          {/* Lightweight Outline Drawer (Simulated) */}
          <AnimatePresence>
            {showOutline && (
               <motion.div 
                 initial={{ y: "100%" }}
                 animate={{ y: 0 }}
                 exit={{ y: "100%" }}
                 className="absolute inset-0 z-10 bg-white dark:bg-slate-800 pt-12 px-8 pb-8"
               >
                 <button 
                   onClick={() => setShowOutline(false)}
                   className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
                 >
                   Close
                 </button>
                 <h3 className="font-bold text-lg mb-4 text-indigo-900 dark:text-indigo-100">Draft Outline</h3>
                 <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                       <div key={i} className="flex gap-3">
                          <div className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-300 shrink-0" />
                          <div className="space-y-2 w-full">
                             <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded w-3/4" />
                             <div className="h-3 bg-slate-50 dark:bg-slate-800 rounded w-1/2" />
                          </div>
                       </div>
                    ))}
                 </div>
               </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
