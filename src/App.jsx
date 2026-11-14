import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ThemeProvider, useTheme } from './store/ThemeContext';
import { NullPinProvider, useNullPin } from './store/NullPinContext';
import DynamicIsland from './components/DynamicIsland';
import SpatialStage from './components/SpatialStage';
import InteractiveCursorGrid from './components/InteractiveCursorGrid';

function AtmosphericCanvas() {
  const { isDark } = useTheme();
  const { resetToPortal } = useNullPin();

  // Escape key resets to portal
  useEffect(() => {
    const handleGlobalKey = (e) => {
      if (['TEXTAREA', 'INPUT'].includes(e.target.tagName)) return;
      if (e.key === 'Escape') {
        resetToPortal();
      }
    };

    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [resetToPortal]);

  return (
    <div
      className={`min-h-[100dvh] relative overflow-x-hidden font-sans transition-colors duration-200 selection:bg-emerald-500/30 flex flex-col justify-between ${
        isDark ? 'bg-[#09090B] text-zinc-100' : 'bg-[#F8F9FA] text-slate-900'
      }`}
    >
      {/* ================= INTERACTIVE CURSOR-FOLLOWING GRID SPOTLIGHT ================= */}
      <InteractiveCursorGrid isDark={isDark} />

      {/* ================= SUBTLE AMBIENT AURORA DEPTH ================= */}
      <div className="fixed inset-0 -z-20 overflow-hidden pointer-events-none opacity-70">
        {/* Animated Floating Emerald Aurora Orb */}
        <motion.div
          animate={{
            x: [0, 40, -25, 0],
            y: [0, -30, 15, 0],
            scale: [1, 1.05, 0.96, 1],
          }}
          transition={{
            duration: 22,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute -top-24 left-1/4 w-[480px] h-[480px] rounded-full bg-emerald-400/15 dark:bg-emerald-500/10 blur-[110px]"
        />

        {/* Animated Floating Cyan/Teal Aurora Orb */}
        <motion.div
          animate={{
            x: [0, -35, 25, 0],
            y: [0, 25, -25, 0],
            scale: [1, 0.95, 1.05, 1],
          }}
          transition={{
            duration: 26,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute top-16 right-1/4 w-[480px] h-[480px] rounded-full bg-cyan-400/15 dark:bg-cyan-500/8 blur-[110px]"
        />
      </div>

      {/* Top Capsule Header (Properly spaced, zero overlap!) */}
      <div className="relative z-30 pt-2 sm:pt-4 w-full">
        <DynamicIsland />
      </div>

      {/* Main Content Stage (Fixed top alignment - prevents jumping between tabs) */}
      <main className="relative z-10 max-w-4xl w-full mx-auto px-3.5 sm:px-6 md:px-8 pt-2 sm:pt-6 pb-4 flex-1 flex flex-col items-center justify-start">
        <SpatialStage />
      </main>

      {/* Minimalist Telemetry Footer */}
      <footer className="relative z-10 max-w-4xl w-full mx-auto px-3.5 sm:px-6 md:px-8 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[9px] min-[380px]:text-[10px] font-mono text-slate-400 dark:text-zinc-500 border-t border-slate-200/60 dark:border-zinc-800/60 text-center sm:text-left">
        <div className="flex items-center gap-1.5 justify-center sm:justify-start">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span>NULLPIN • ZERO-TRACE VOLATILE RAM</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-center sm:justify-end">
          <span>NO LOGINS</span>
          <span>•</span>
          <span>NO DOWNLOADS</span>
          <span>•</span>
          <span>5-MIN AUTO-WIPE</span>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <NullPinProvider>
        <AtmosphericCanvas />
      </NullPinProvider>
    </ThemeProvider>
  );
}
