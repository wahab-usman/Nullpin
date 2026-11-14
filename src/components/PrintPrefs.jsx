import { Flame, Minus, Plus } from 'lucide-react';

export default function PrintPrefs({
  colorMode, setColorMode,
  sides, setSides,
  copies, setCopies,
  burnAfterPrint, setBurnAfterPrint,
}) {
  return (
    <div className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800/60">
      <p className="text-xs font-semibold text-slate-500 dark:text-zinc-500 uppercase tracking-wider">
        Print Preferences
      </p>

      <div className="flex flex-wrap items-center gap-3">
        {/* Color Mode */}
        <div className="pill-toggle">
          <button
            onClick={() => setColorMode('bw')}
            className={`pill-toggle-btn text-xs ${colorMode === 'bw' ? 'active' : ''}`}
          >
            ⚫ B&W
          </button>
          <button
            onClick={() => setColorMode('color')}
            className={`pill-toggle-btn text-xs ${colorMode === 'color' ? 'active' : ''}`}
          >
            🎨 Color
          </button>
        </div>

        {/* Sides */}
        <div className="pill-toggle">
          <button
            onClick={() => setSides('single')}
            className={`pill-toggle-btn text-xs ${sides === 'single' ? 'active' : ''}`}
          >
            📄 1-Sided
          </button>
          <button
            onClick={() => setSides('double')}
            className={`pill-toggle-btn text-xs ${sides === 'double' ? 'active' : ''}`}
          >
            📑 2-Sided
          </button>
        </div>

        {/* Copies */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCopies(Math.max(1, copies - 1))}
            className="w-8 h-8 rounded-lg flex items-center justify-center 
                       bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700/50
                       text-slate-600 dark:text-zinc-400
                       hover:bg-slate-200 dark:hover:bg-zinc-700
                       transition-all active:scale-[0.95]"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="w-8 text-center text-sm font-bold font-mono text-slate-900 dark:text-zinc-100">
            {copies}
          </span>
          <button
            onClick={() => setCopies(Math.min(99, copies + 1))}
            className="w-8 h-8 rounded-lg flex items-center justify-center 
                       bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700/50
                       text-slate-600 dark:text-zinc-400
                       hover:bg-slate-200 dark:hover:bg-zinc-700
                       transition-all active:scale-[0.95]"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs text-slate-400 dark:text-zinc-500 ml-1">copies</span>
        </div>
      </div>

      {/* Burn after print */}
      <label className="flex items-center gap-2.5 cursor-pointer group">
        <div className="relative">
          <input
            type="checkbox"
            checked={burnAfterPrint}
            onChange={(e) => setBurnAfterPrint(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 rounded-full bg-slate-200 dark:bg-zinc-700 
                          peer-checked:bg-rose-500 dark:peer-checked:bg-rose-500
                          transition-colors duration-200" />
          <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm
                          peer-checked:translate-x-4 transition-transform duration-200" />
        </div>
        <div className="flex items-center gap-1.5">
          <Flame className="w-3.5 h-3.5 text-rose-500" />
          <span className="text-xs font-medium text-slate-600 dark:text-zinc-400 group-hover:text-slate-900 dark:group-hover:text-zinc-200 transition-colors">
            Burn immediately after first print
          </span>
        </div>
      </label>
    </div>
  );
}

