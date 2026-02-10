import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTTSWithPrefetch, useBrowserTTSFallback } from '../hooks/useTTSWithPrefetch';

interface ChainRuleExplainerProps {
  isActive: boolean;
  onComplete?: () => void;
}

// Scene Configuration
interface SceneConfig {
    id: number;
    duration: number;
    narration: string;
}

const scenes: SceneConfig[] = [
  { id: 1, duration: 3000, narration: "Let’s build an intuition for the chain rule — the idea behind differentiating functions inside functions." },
  { id: 2, duration: 6000, narration: "When we have a function inside another function, we call it a composite. Think of it as a process: x goes into g, and the result goes into f." },
  { id: 3, duration: 10000, narration: "When x changes a little, g of x changes a little. That change then flows into f. The chain rule measures how fast f changes, by watching how g changes beneath it." },
  { id: 4, duration: 12000, narration: "So we look at two slopes: How fast g changes with x — that’s g-prime. And how fast f changes with g — that’s f-prime. The total rate is the product of both." },
  { id: 5, duration: 6000, narration: "Differentiating a composite means: differentiate the outside, keep the inside the same… then multiply by the derivative of the inside." },
  { id: 6, duration: 10000, narration: "For example, take sine of x squared. Outer function: sine becomes cosine. Inner function: x squared becomes two x. Multiply them." },
  { id: 7, duration: 4000, narration: "The chain rule simply links how one change flows into the next. A small change in x echoes through each step." },
  { id: 8, duration: 3000, narration: "This is Lucid — transforming understanding into clarity." }
];

export const ChainRuleExplainer: React.FC<ChainRuleExplainerProps> = ({ isActive, onComplete }) => {
  const [currentScene, setCurrentScene] = useState(0);
  const [sceneData, setSceneData] = useState<SceneConfig | undefined>(undefined);

  // Scene State Management
  useEffect(() => {
    if (isActive) {
      setCurrentScene(1);
    } else {
      setCurrentScene(0);
    }
  }, [isActive]);

  useEffect(() => {
    setSceneData(scenes.find(s => s.id === currentScene));
  }, [currentScene]);

  const handleSceneComplete = () => {
    if (currentScene < scenes.length) {
      setCurrentScene(prev => prev + 1);
    } else if (onComplete) {
      onComplete();
    }
  };

  // Cartesia TTS with Prefetching - loads next scenes while current plays
  const { hasError: cartesiaError } = useTTSWithPrefetch({
    scenes: scenes,
    currentSceneId: currentScene,
    isPlaying: isActive && currentScene > 0,
    onComplete: handleSceneComplete,
    voiceId: "694f9389-aac1-45b6-b726-9d9369183238",
    prefetchCount: 2
  });

  useBrowserTTSFallback({
    text: cartesiaError ? (sceneData?.narration || "") : "",
    isPlaying: isActive && !!sceneData && currentScene > 0 && cartesiaError,
    onComplete: handleSceneComplete
  });

  // Colors & Styles
  const c = {
    bg: "#0c0f14",
    cyan: "#00F6BB",
    purple: "#7C3AED",
    yellow: "#EAB308", 
    white: "#F5F7FA",
    faint: "rgba(255,255,255,0.1)",
    textMain: "#F5F7FA"
  };

  if (!isActive) return null;

  return (
    <div style={{ 
      width: '100%', height: '100%', background: c.bg, color: c.textMain, 
      position: 'relative', overflow: 'hidden', fontFamily: 'Inter, sans-serif',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <AnimatePresence mode="wait">
        
        {/* --- SCENE 1: TITLE --- */}
        {currentScene === 1 && (
          <motion.div key="s1" style={{ width: '100%', height: '100%', position: 'relative' }}
            exit={{ opacity: 0 }}
          >
            <svg viewBox="0 0 800 450" style={{ width: '100%', height: '100%' }}>
               <motion.path 
                 d="M 100,300 Q 400,100 700,300"
                 fill="none" stroke={c.cyan} strokeWidth="4"
                 initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2, ease: "easeInOut" }}
               />
            </svg>
            <motion.div 
              style={{ position: 'absolute', top: '60%', left: 0, width: '100%', textAlign: 'center' }}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}
            >
              <h1 style={{ fontSize: '36px', fontWeight: 700 }}>Understanding the Chain Rule</h1>
            </motion.div>
          </motion.div>
        )}

        {/* --- SCENE 2: COMPOSITE FUNCTION --- */}
        {currentScene === 2 && (
          <motion.div key="s2" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '40px' }}
             exit={{ opacity: 0 }}
          >
            {/* Input X */}
            <motion.div initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} style={{ fontSize: 32 }}>x</motion.div>
            <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} style={{ color: c.faint }}>→</motion.div>
            
            {/* Function G */}
            <motion.div 
              initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.5 }}
              style={{ border: `2px solid ${c.yellow}`, borderRadius: 12, padding: '20px 30px', color: c.yellow, fontSize: 24 }}
            >
              g(x)
            </motion.div>
            
            <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 1.5 }} style={{ color: c.faint }}>→</motion.div>

            {/* Function F */}
            <motion.div 
              initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 2 }}
              style={{ border: `2px solid ${c.cyan}`, borderRadius: 12, padding: '20px 30px', color: c.cyan, fontSize: 24 }}
            >
              f(u)
            </motion.div>

            <motion.div 
               style={{ position: 'absolute', bottom: '20%', fontSize: 32, fontWeight: 'bold' }}
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 4 }}
            >
              <span style={{ color: c.cyan }}>f</span>(<span style={{ color: c.yellow }}>g(x)</span>)
            </motion.div>
          </motion.div>
        )}

        {/* --- SCENE 3: GRAPHICAL INTUITION --- */}
        {currentScene === 3 && (
          <motion.div key="s3" style={{ width: '100%', height: '100%', display: 'flex', position: 'relative' }} exit={{ opacity: 0 }}>
            {/* Graph G */}
            <div style={{ flex: 1, borderRight: `1px solid ${c.faint}`, position: 'relative' }}>
               <svg viewBox="0 0 400 450" style={{ width: '100%', height: '100%' }}>
                 <motion.path d="M 50,350 Q 200,50 350,350" fill="none" stroke={c.yellow} strokeWidth="3" />
                 <motion.circle r="6" fill={c.white}
                   initial={{ cx: 100, cy: 250 }} // Approx point on curve
                   animate={{ cx: [100, 200, 100] }}
                   // This needs to follow the path mathematically, simplified here for demo
                   transition={{ duration: 4, repeat: Infinity }}
                   style={{ offsetPath: "path('M 50,350 Q 200,50 350,350')", offsetDistance: "20%" }}
                 >
                    <animate attributeName="offsetDistance" values="20%; 50%; 20%" dur="4s" repeatCount="indefinite" />
                 </motion.circle>
                 <text x="20" y="50" fill={c.yellow} fontSize="20">g(x)</text>
               </svg>
            </div>
            {/* Graph F */}
            <div style={{ flex: 1, position: 'relative' }}>
               <svg viewBox="0 0 400 450" style={{ width: '100%', height: '100%' }}>
                 <motion.path d="M 50,200 C 150,100 250,300 350,150" fill="none" stroke={c.cyan} strokeWidth="3" />
                  <motion.circle r="6" fill={c.white}
                   style={{ offsetPath: "path('M 50,200 C 150,100 250,300 350,150')" }}
                 >
                    <animate attributeName="offsetDistance" values="20%; 50%; 20%" dur="4s" repeatCount="indefinite" />
                 </motion.circle>
                 <text x="20" y="50" fill={c.cyan} fontSize="20">f(g(x))</text>
               </svg>
            </div>
            
            <motion.div 
              style={{ position: 'absolute', top: '50%', left: '45%', padding: '8px 16px', background: '#000', border: `1px solid ${c.faint}`, borderRadius: 8 }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }}
            >
              Change flows →
            </motion.div>
          </motion.div>
        )}

        {/* --- SCENE 4: SLOPE BREAKDOWN --- */}
        {currentScene === 4 && (
          <motion.div key="s4" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 40 }} exit={{ opacity: 0 }}>
             <div style={{ display: 'flex', gap: 40, alignItems: 'center' }}>
               <motion.div 
                 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}
                 style={{ color: c.cyan, fontSize: 32 }}
               >
                 f '(g(x))
               </motion.div>
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3 }} style={{ fontSize: 32 }}>×</motion.div>
               <motion.div 
                 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 5 }}
                 style={{ color: c.yellow, fontSize: 32 }}
               >
                 g '(x)
               </motion.div>
             </div>
             
             <motion.div 
               initial={{ width: 0 }} animate={{ width: 300 }} transition={{ delay: 8 }}
               style={{ height: 2, background: c.white }}
             />
             
             <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 9 }}
               style={{ fontSize: 24, color: c.faint }}
             >
               Rate of f  ×  Rate of g
             </motion.div>
          </motion.div>
        )}

        {/* --- SCENE 5: FORMULA --- */}
        {currentScene === 5 && (
          <motion.div key="s5" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} exit={{ opacity: 0 }}>
            <motion.div style={{ fontSize: 42, fontFamily: 'JetBrains Mono' }}>
               <span style={{ opacity: 0.5 }}>d/dx</span> 
               [ <span style={{ color: c.cyan }}>f</span>(<span style={{ color: c.yellow }}>g(x)</span>) ] 
               = 
               <motion.span 
                 initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
                 style={{ color: c.cyan }}
               > f '(g(x)) </motion.span>
               · 
               <motion.span 
                 initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }}
                 style={{ color: c.yellow }}
               > g '(x) </motion.span>
            </motion.div>
            
            {/* Pulse Circle */}
            <motion.div 
              style={{ position: 'absolute', borderRadius: '50%', border: `2px solid ${c.cyan}`, width: 400, height: 100 }}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1.1, opacity: [0, 1, 0] }}
              transition={{ duration: 2, delay: 3 }}
            />
          </motion.div>
        )}

        {/* --- SCENE 6: EXAMPLE SIN(X^2) --- */}
        {currentScene === 6 && (
           <motion.div key="s6" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }} exit={{ opacity: 0 }}>
              <div style={{ fontSize: 36, marginBottom: 40, fontFamily: 'JetBrains Mono' }}>
                 <span style={{ color: c.cyan }}>sin</span>( <span style={{ color: c.yellow }}>x²</span> )
              </div>

              <div style={{ display: 'flex', gap: 60 }}>
                 <motion.div 
                   initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2 }}
                   style={{ textAlign: 'center' }}
                 >
                   <div style={{ color: c.cyan, fontSize: 24, marginBottom: 10 }}>Outer</div>
                   <div style={{ fontSize: 32 }}>cos( <span style={{ color: c.yellow }}>x²</span> )</div>
                 </motion.div>

                 <motion.div 
                   initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 4 }}
                   style={{ textAlign: 'center' }}
                 >
                   <div style={{ color: c.yellow, fontSize: 24, marginBottom: 10 }}>Inner</div>
                   <div style={{ fontSize: 32 }}>2x</div>
                 </motion.div>
              </div>

              <motion.div 
                initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 6 }}
                style={{ marginTop: 40, fontSize: 42, fontFamily: 'JetBrains Mono', border: `2px solid ${c.white}`, padding: '16px 32px', borderRadius: 12 }}
              >
                 <span style={{ color: c.cyan }}>cos(x²)</span> · <span style={{ color: c.yellow }}>2x</span>
              </motion.div>
           </motion.div>
        )}

        {/* --- SCENE 7: SUMMARY --- */}
        {currentScene === 7 && (
           <motion.div key="s7" style={{ width: '100%', height: '100%', position: 'relative' }} exit={{ opacity: 0 }}>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                 <h2 style={{ fontSize: 36, textAlign: 'center' }}>The Chain Reaction</h2>
              </div>
              {/* Orbiting elements */}
              {[0, 120, 240].map((deg, i) => (
                <motion.div 
                  key={i}
                  style={{ 
                    position: 'absolute', top: '50%', left: '50%', width: 60, height: 60, marginLeft: -30, marginTop: -30,
                    border: `1px solid ${c.faint}`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.bg
                  }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                >
                   <div style={{ transform: `rotate(${deg}deg) translate(150px) rotate(-${deg}deg)` }}>
                      {i===0 && <span style={{ color: c.cyan, fontSize: 20 }}>f '(g)</span>}
                      {i===1 && <span style={{ color: c.yellow, fontSize: 20 }}>g '(x)</span>}
                      {i===2 && <span style={{ color: c.white, fontSize: 24 }}>×</span>}
                   </div>
                </motion.div>
              ))}
           </motion.div>
        )}

        {/* --- SCENE 8: OUTRO --- */}
        {currentScene === 8 && (
          <motion.div key="s8" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }} exit={{ opacity: 0 }}>
             <motion.div 
               initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1 }}
               style={{ fontSize: 48, fontWeight: 800, letterSpacing: -1 }}
             >
               Lucid<span style={{ color: c.cyan }}>.</span>
             </motion.div>
             <motion.div 
               initial={{ width: 0 }} animate={{ width: 80 }} transition={{ delay: 0.5, duration: 1 }}
               style={{ height: 2, background: c.cyan, marginTop: 20 }}
             />
          </motion.div>
        )}

      </AnimatePresence>

      {/* Progress Bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, height: 4, background: c.faint, width: '100%' }}>
         <motion.div 
           style={{ height: '100%', background: c.cyan }}
           initial={{ width: 0 }}
           animate={{ width: `${(currentScene / 8) * 100}%` }}
         />
      </div>
    </div>
  );
};
