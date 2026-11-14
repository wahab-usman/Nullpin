import { Shield, Sun, Moon, Flame } from 'lucide-react';
import { useTheme } from '../store/ThemeContext';

export default function Navbar() {
  const { isDark, toggle } = useTheme();

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-zinc-800/80 bg-white/80 dark:bg-surface-dark/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Logo */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-500 shadow-lg shadow-emerald-500/20">
              <Shield className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-xl font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight">
                NullPin
              </span>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700/50 text-[10px] font-mono font-semibold text-slate-500 dark:text-zinc-500 uppercase tracking-wider">
                Zero-Trace v1.0
              </span>
            </div>
          </div>

          {/* Right: Timer badge + Theme toggle */}
          <div className="flex items-center gap-3">
            {/* Auto-Wipe badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20">
              <Flame className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
              <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 font-mono">
                Auto-Wipe: 5 Mins
              </span>
            </div>

            {/* Theme Toggle */}
            <button
              onClick={toggle}
              className="relative flex items-center justify-center w-10 h-10 rounded-xl 
                         bg-slate-100 dark:bg-zinc-800 
                         border border-slate-200 dark:border-zinc-700/50
                         hover:bg-slate-200 dark:hover:bg-zinc-700
                         transition-all duration-200 active:scale-[0.95]"
              aria-label="Toggle theme"
            >
              {isDark ? (
                <Sun className="w-[18px] h-[18px] text-amber-400 transition-transform duration-300 rotate-0" />
              ) : (
                <Moon className="w-[18px] h-[18px] text-slate-600 transition-transform duration-300 rotate-0" />
              )}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

