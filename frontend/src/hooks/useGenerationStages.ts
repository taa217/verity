import { useState, useEffect, useCallback } from 'react';

export type GenerationMode = 'generating' | 'long_wait' | 'success' | 'error';

export interface GenerationStage {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed';
}

interface UseGenerationStagesProps {
  onComplete?: () => void;
  initialMode?: GenerationMode;
  stages?: string[];
}

const DEFAULT_STAGES = [
  "Understanding your request",
  "Selecting the best explanation style",
  "Building examples + exercises",
  "Checking clarity + correctness",
  "Final polish"
];

export function useGenerationStages({ 
  onComplete, 
  initialMode = 'generating',
  stages: customStages = DEFAULT_STAGES 
}: UseGenerationStagesProps = {}) {
  const [mode, setMode] = useState<GenerationMode>(initialMode);
  const [stages, setStages] = useState<GenerationStage[]>(() => 
    customStages.map((label, index) => ({
      id: `stage-${index}`,
      label,
      status: index === 0 ? 'active' : 'pending'
    }))
  );
  
  // Track elapsed time for long_wait
  useEffect(() => {
    if (mode !== 'generating') return;

    const timer = setTimeout(() => {
      setMode('long_wait');
    }, 12000); // 12 seconds

    return () => clearTimeout(timer);
  }, [mode]);

  // Simulate progress through stages
  useEffect(() => {
    if (mode === 'success' || mode === 'error') return;

    const interval = setInterval(() => {
      setStages(prev => {
        const activeIndex = prev.findIndex(s => s.status === 'active');
        if (activeIndex === -1) return prev;

        // If we are at the last stage and it's active, we wait for external completion 
        // OR we can auto-complete if this is just a demo.
        // For this hook, let's just cycle through until the last one remains active.
        
        if (activeIndex === prev.length - 1) {
          // Last stage is active. 
          return prev;
        }

        const next = [...prev];
        next[activeIndex] = { ...next[activeIndex], status: 'completed' };
        next[activeIndex + 1] = { ...next[activeIndex + 1], status: 'active' };
        return next;
      });
    }, 2500); // Advance every 2.5s for demo purposes

    return () => clearInterval(interval);
  }, [mode]);

  // Handle manual completion trigger
  const triggerSuccess = useCallback(() => {
    setMode('success');
    setStages(prev => prev.map(s => ({ ...s, status: 'completed' })));
    
    // Call onComplete after transition
    setTimeout(() => {
      onComplete?.();
    }, 800);
  }, [onComplete]);

  const triggerError = useCallback(() => {
    setMode('error');
  }, []);

  const retry = useCallback(() => {
    setMode('generating');
    setStages(customStages.map((label, index) => ({
      id: `stage-${index}`,
      label,
      status: index === 0 ? 'active' : 'pending'
    })));
  }, [customStages]);

  return {
    mode,
    stages,
    triggerSuccess,
    triggerError,
    retry
  };
}
