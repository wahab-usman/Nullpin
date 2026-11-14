import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sun, Moon, Volume2, VolumeX, Clock, Copy, Check, 
  Download, Smartphone, Monitor, ChevronDown, Shield
} from 'lucide-react';
import { useTheme } from '../store/ThemeContext';
import { useNullPin } from '../store/NullPinContext';
import { sound } from '../utils/sound';

// =========================================================================
// 🚀 EASY FUTURE-PROOF APP DOWNLOAD LINKS CONFIGURATION
// Paste your direct .apk or .exe URLs below whenever your builds are ready:
// =========================================================================
export const APP_DOWNLOAD_LINKS = {
  androidApk: "", // Paste .apk direct link here in the future (e.g. "https://domain.com/nullpin.apk")
  windowsExe: "", // Paste .exe installer link here in the future (e.g. "https://domain.com/nullpin-setup.exe")
  version: "v1.0.0"
};

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function DynamicIsland() {
  const { isDark, toggle } = useTheme();
  const { activeDrop, timeLeft, soundEnabled, toggleSound, currentView } = useNullPin();
  const [copied, setCopied] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const hasActivePin = activeDrop && activeDrop.pin && currentView === 'ticket';
  const isTimeLow = timeLeft <= 60;

  const handleCopyPin = (e) => {
    e.stopPropagation();
    if (activeDrop?.pin) {
      navigator.clipboard.writeText(activeDrop.pin).catch(() => {});
      setCopied(true);
      sound.toggleSnap();
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const handleDownloadClick = (type) => {
    sound.toggleSnap();
    const link = type === 'android' ? APP_DOWNLOAD_LINKS.androidApk : APP_DOWNLOAD_LINKS.windowsExe;

    if (link && link.trim() !== '') {
      window.open(link, '_blank', 'noopener,noreferrer');
    } else {
      const name = type === 'android' ? 'Android APK' : 'Windows EXE';
      setToastMessage(`${name} build coming soon (${APP_DOWNLOAD_LINKS.version})`);
      setTimeout(() => setToastMessage(''), 2500);
    }
  };

  return (
    <header className="w-full flex justify-center pb-1 px-2 select-none relative z-40">
      <div
        className={`h-12 sm:h-14 px-3.5 sm:px-6 rounded-full inline-flex items-center justify-between gap-3 sm:gap-6 max-w-[95vw] w-[calc(100vw-1.5rem)] sm:w-auto
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
              {/* Live PIN Quick Pill */}
              <button
                type="button"
                onClick={handleCopyPin}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-emerald-500/15 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-mono text-xs font-bold cursor-pointer transition-colors whitespace-nowrap shrink-0"
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
          {/* Download dropdown button */}
          <div 
            className="relative shrink-0 whitespace-nowrap"
            onMouseEnter={() => setShowDownloadMenu(true)}
            onMouseLeave={() => setShowDownloadMenu(false)}
          >
            <button
              type="button"
              onClick={() => setShowDownloadMenu((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium whitespace-nowrap px-2.5 py-1.5 rounded-full transition-all duration-200 cursor-pointer shrink-0 ${
                showDownloadMenu
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-700 dark:text-zinc-300 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400'
              }`}
              aria-label="Download native app"
            >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 shrink-0" />
            <span className="font-semibold">Download</span>
            <ChevronDown 
              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-300 ${
                showDownloadMenu ? 'rotate-180 text-emerald-500' : 'text-slate-400 dark:text-zinc-500'
              }`} 
            />
          </button>

          {/* Floating Frosted-Glass Dropdown Panel */}
          <AnimatePresence>
            {showDownloadMenu && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="absolute top-full mt-3 right-0 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 
                           w-[calc(100vw-2rem)] max-w-xs sm:w-72 rounded-3xl p-3 z-50
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
                  onClick={() => handleDownloadClick('android')}
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
                  {APP_DOWNLOAD_LINKS.androidApk ? (
                    <Download className="w-4 h-4 text-slate-400 group-hover:text-emerald-500" />
                  ) : (
                    <span className="text-[9px] font-mono text-slate-400 dark:text-zinc-500 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                      Coming Soon
                    </span>
                  )}
                </button>

                {/* Option 2: Windows EXE */}
                <button
                  type="button"
                  onClick={() => handleDownloadClick('windows')}
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
                  {APP_DOWNLOAD_LINKS.windowsExe ? (
                    <Download className="w-4 h-4 text-slate-400 group-hover:text-cyan-500" />
                  ) : (
                    <span className="text-[9px] font-mono text-slate-400 dark:text-zinc-500 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                      Coming Soon
                    </span>
                  )}
                </button>

                {/* Inline Toast Notice */}
                {toastMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: 2 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center"
                  >
                    <span className="text-[10px] font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      {toastMessage}
                    </span>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          </div>

          <div className="hidden sm:block w-[1px] h-4 bg-slate-300 dark:bg-zinc-800 shrink-0" />

          {/* Audio FX Toggle (Desktop & Tablet) */}
          <button
            type="button"
            onClick={() => {
              sound.toggleSnap();
              toggleSound();
            }}
            className="hidden sm:flex items-center justify-center w-8 h-8 rounded-full 
                       text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 
                       hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
            title={soundEnabled ? 'Mute sounds' : 'Unmute sounds'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 opacity-40" />}
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
