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
      className={`min-h-[100dvh] relative overflow-x-hidden font-sans transition-colors duration-200 selection:bg-emerald-500/30 flex flex-col items-center justify-between py-3 sm:py-5 px-3.5 sm:px-6 ${
        isDark ? 'bg-[#09090B] text-zinc-100' : 'bg-[#F8F9FA] text-slate-900'
      }`}
    >
      {/* ================= INTERACTIVE CURSOR-FOLLOWING GRID SPOTLIGHT ================= */}
      <InteractiveCursorGrid isDark={isDark} />

      {/* ================= SUBTLE AMBIENT AURORA DEPTH ================= */}
      <div className="fixed inset-0 -z-20 overflow-hidden pointer-events-none flex items-center justify-center">
        <div className="w-[500px] h-[500px] rounded-full bg-emerald-500/[0.06] blur-[140px]" />
      </div>

      {/* Top Capsule Header */}
      <div className="relative z-30 w-full flex justify-center">
        <DynamicIsland />
      </div>

      {/* Main Content Stage (Fixed top alignment - stops switcher and card from jumping down on Enter PIN) */}
      <main className="relative z-10 w-full max-w-[500px] mx-auto flex-1 flex flex-col items-center justify-start pt-2.5 sm:pt-4 pb-2">
        <SpatialStage />
      </main>

      {/* Minimalist Telemetry Footer */}
      <footer className="relative z-10 w-full max-w-[500px] mx-auto pt-2 pb-0.5 flex flex-col sm:flex-row items-center justify-between gap-1 text-[9px] min-[380px]:text-[10px] font-mono text-slate-400 dark:text-zinc-500 border-t border-slate-200/50 dark:border-zinc-800/50 text-center sm:text-left">
        <div className="flex items-center gap-1.5 justify-center sm:justify-start shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span className="whitespace-nowrap">NULLPIN • ZERO-TRACE VOLATILE RAM</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap justify-center sm:justify-end shrink-0">
          <span className="whitespace-nowrap">NO LOGINS</span>
          <span>•</span>
          <span className="whitespace-nowrap">NO DOWNLOADS</span>
          <span>•</span>
          <span className="whitespace-nowrap">5-MIN AUTO-WIPE</span>
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
