import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sun, Moon, Volume2, VolumeX, Clock, Copy, Check, 
  Download, ChevronDown, Smartphone, Monitor
} from 'lucide-react';
import { useTheme } from '../store/ThemeContext';
import { useNullPin, useNullPinTimer } from '../store/NullPinContext';
import { sound } from '../utils/sound';

// =========================================================================
// 🚀 EASY FUTURE-PROOF APP DOWNLOAD LINKS CONFIGURATION
// Direct .apk same-origin link & .exe binary download URLs:
// =========================================================================
export const APP_DOWNLOAD_LINKS = {
  androidApk: "/NullPin.apk",
  windowsExe: "/api/download-exe",
  version: "v1.0.2"
};

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function DynamicIsland() {
  const { isDark, toggle } = useTheme();
  const { activeDrop, soundEnabled, toggleSound, currentView, setCurrentView } = useNullPin();
  const { timeLeft } = useNullPinTimer();
  const [copied, setCopied] = useState(false);
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  const downloadRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isDownloadOpen) return;

    const handleClickOutside = (e) => {
      if (downloadRef.current && !downloadRef.current.contains(e.target)) {
        setIsDownloadOpen(false);
      }
    };

    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [isDownloadOpen]);

  // Detect if running inside installed Windows Electron .EXE, native Android Capacitor app, or standalone PWA
  const isStandaloneApp =
    typeof window !== 'undefined' &&
    (window.navigator.userAgent.toLowerCase().includes('electron') ||
      window.location.protocol === 'file:' ||
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      window.Capacitor?.isNativePlatform?.() ||
      window.Capacitor?.isNativePlatform === true);

  const hasActivePin = Boolean(activeDrop?.pin && activeDrop?.status !== 'burned');
  const isTimeLow = timeLeft <= 60;

  const handleCopyPin = (e) => {
    e.stopPropagation();
    if (activeDrop?.pin) {
      navigator.clipboard.writeText(activeDrop.pin).catch(() => {});
      setCopied(true);
      sound.toggleSnap();
      if (currentView !== 'ticket') {
        setCurrentView('ticket');
      }
      setTimeout(() => setCopied(false), 1800);
    }
  };

  // Android APK Direct Download
  const handleDownloadAndroid = (e) => {
    e?.stopPropagation?.();
    sound.toggleSnap();
    setIsDownloadOpen(false);

    const link = APP_DOWNLOAD_LINKS.androidApk || '/NullPin.apk';
    try {
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = link;
      a.download = 'NullPin.apk';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (document.body.contains(a)) document.body.removeChild(a);
      }, 150);
    } catch {
      window.location.assign(link);
    }
  };

  // Windows Setup .EXE Direct Download via Edge Streaming Proxy
  const handleDownloadWindows = (e) => {
    e?.stopPropagation?.();
    sound.toggleSnap();
    setIsDownloadOpen(false);

    const link = APP_DOWNLOAD_LINKS.windowsExe || '/api/download-exe';
    try {
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = link;
      a.download = 'NullPin-Setup.exe';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (document.body.contains(a)) document.body.removeChild(a);
      }, 150);
    } catch {
      window.location.assign(link);
    }
  };

  return (
    <header className="w-full flex justify-center pb-1 px-2 select-none relative z-40">
      <div
        className={`h-12 sm:h-14 px-4 sm:px-6 rounded-full inline-flex items-center justify-between gap-3 sm:gap-6 max-w-[95vw] w-[calc(100vw-1.5rem)] sm:w-auto
          transition-all duration-300 whitespace-nowrap
          ${
            isDark
              ? 'bg-zinc-900/65 backdrop-blur-2xl backdrop-saturate-150 border border-white/15 shadow-[0_16px_50px_rgba(0,0,0,0.65)]'
              : 'bg-white/65 backdrop-blur-2xl backdrop-saturate-150 border border-slate-200/80 shadow-[0_12px_40px_rgba(0,0,0,0.08)]'
          }`}
      >
        {/* ================= 1. BRAND LOGO (Left) ================= */}
        <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
          <div className="relative flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 shrink-0">
            <span className="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_#10B981]" />
          </div>
          <span className="font-bold text-sm sm:text-base tracking-tight text-slate-900 dark:text-zinc-100 font-sans whitespace-nowrap shrink-0">
            NullPin
          </span>
        </div>

        {/* ================= 2. CENTER STATUS BADGE (Desktop only) ================= */}
        <AnimatePresence mode="wait">
          {hasActivePin ? (
            <motion.div
              key="active-telemetry"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="inline-flex items-center gap-2 shrink-0 whitespace-nowrap"
            >
              {/* Live PIN Quick Pill (Hidden on extra-small mobile to prevent navbar crowding; visible on sm+) */}
              <button
                type="button"
                onClick={handleCopyPin}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-emerald-500/15 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-mono text-xs font-bold cursor-pointer transition-colors whitespace-nowrap shrink-0"
                title="Click to copy active PIN"
              >
                <span>PIN {activeDrop.pin}</span>
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 opacity-70" />}
              </button>

              {/* 5-Minute Countdown Timer */}
              <div
                className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full font-mono text-xs font-bold whitespace-nowrap shrink-0 ${
                  isTimeLow
                    ? 'bg-rose-500/15 text-rose-500 animate-pulse'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{formatTime(timeLeft)}</span>
              </div>
            </motion.div>
          ) : (
            <div className="hidden md:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100/90 dark:bg-zinc-800/80 border border-slate-200/80 dark:border-zinc-700/50 text-[11px] font-mono text-slate-600 dark:text-zinc-300 font-semibold whitespace-nowrap shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="whitespace-nowrap">ZERO-TRACE RAM • 5M AUTO-WIPE</span>
            </div>
          )}
        </AnimatePresence>

        {/* ================= 3. RIGHT CONTROLS ================= */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 whitespace-nowrap">
          {/* Download Dropdown Button & Menu (Hidden inside installed native .EXE and .APK) */}
          {!isStandaloneApp && (
            <>
              <div 
                ref={downloadRef}
                className="relative shrink-0 whitespace-nowrap"
                onPointerEnter={(e) => {
                  if (e.pointerType === 'mouse') setIsDownloadOpen(true);
                }}
                onPointerLeave={(e) => {
                  if (e.pointerType === 'mouse') setIsDownloadOpen(false);
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    sound.toggleSnap();
                    setIsDownloadOpen((prev) => !prev);
                  }}
                  className={`inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium whitespace-nowrap px-2.5 py-1.5 rounded-full transition-all duration-200 cursor-pointer shrink-0 ${
                    isDownloadOpen
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-700 dark:text-zinc-300 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400'
                  }`}
                  aria-label="Download native app"
                  aria-expanded={isDownloadOpen}
                  title="Download NullPin App"
                >
                  <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 shrink-0" />
                  <span className="font-semibold">Download</span>
                  <ChevronDown 
                    className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-300 ${
                      isDownloadOpen ? 'rotate-180 text-emerald-500' : 'text-slate-400 dark:text-zinc-500'
                    }`} 
                  />
                </button>

                {/* Floating Frosted-Glass Dropdown Panel */}
                <AnimatePresence>
                  {isDownloadOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.96 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className="absolute top-full mt-3 right-0 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 
                                 w-[calc(100vw-2rem)] max-w-[280px] sm:w-72 rounded-3xl p-3 z-50
                                 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-2xl backdrop-saturate-150
                                 border border-slate-200/90 dark:border-white/15 
                                 shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.7)]"
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between px-2.5 py-1 mb-2 border-b border-slate-100 dark:border-zinc-800">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                          Native Apps
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[10px] font-bold">
                          {APP_DOWNLOAD_LINKS.version}
                        </span>
                      </div>

                      {/* Option 1: Android APK */}
                      <button
                        type="button"
                        onClick={handleDownloadAndroid}
                        className="w-full flex items-center justify-between p-2.5 rounded-2xl text-left 
                                   hover:bg-slate-100/90 dark:hover:bg-zinc-800/90 transition-colors group cursor-pointer mb-1"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                            <Smartphone className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900 dark:text-zinc-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                              Android (.APK)
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-zinc-400">
                              Fast mobile file & ID card drops
                            </p>
                          </div>
                        </div>
                        <Download className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 shrink-0" />
                      </button>

                      {/* Option 2: Windows EXE */}
                      <button
                        type="button"
                        onClick={handleDownloadWindows}
                        className="w-full flex items-center justify-between p-2.5 rounded-2xl text-left 
                                   hover:bg-slate-100/90 dark:hover:bg-zinc-800/90 transition-colors group cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 dark:bg-cyan-500/15 flex items-center justify-center text-cyan-600 dark:text-cyan-400 flex-shrink-0">
                            <Monitor className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900 dark:text-zinc-100 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                              Windows (.EXE)
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-zinc-400">
                              Dedicated print shop PC terminal
                            </p>
                          </div>
                        </div>
                        <Download className="w-4 h-4 text-slate-400 group-hover:text-cyan-500 shrink-0" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="w-[1px] h-4 bg-slate-300 dark:bg-zinc-800 shrink-0" />
            </>
          )}

          {/* Audio FX Toggle (Permanently visible across ALL screens: mobile, tablet & desktop) */}
          <button
            type="button"
            onClick={() => {
              sound.toggleSnap();
              toggleSound();
            }}
            className="flex items-center justify-center w-8 h-8 rounded-full 
                       hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0 touch-manipulation"
            title={soundEnabled ? 'Mute sounds' : 'Unmute sounds'}
            aria-label={soundEnabled ? 'Mute sounds' : 'Unmute sounds'}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-400 dark:text-zinc-500" />
            )}
          </button>

          {/* Theme Switcher Button */}
          <button
            type="button"
            onClick={() => {
              sound.toggleSnap();
              toggle();
            }}
            className="flex items-center justify-center w-8 h-8 rounded-full 
                       bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700/60
                       text-slate-700 dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-700
                       transition-colors cursor-pointer shrink-0"
            aria-label="Toggle dark/light theme"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
