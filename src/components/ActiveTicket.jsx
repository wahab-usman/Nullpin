import { useState, useEffect, useCallback } from 'react';
import { Copy, Check, Flame, Radio, Eye, Printer } from 'lucide-react';
import { useNullPin } from '../store/NullPinContext';

const STATUS_STEPS = [
  { key: 'waiting', emoji: '🟢', label: 'PIN Live', sub: 'Waiting for Shop/Lab PC...' },
  { key: 'opened', emoji: '🟡', label: 'PIN Opened', sub: 'Opened on Receiver Terminal' },
  { key: 'burned', emoji: '🔥', label: 'Printed & Burned', sub: 'Permanently Burned' },
];

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function ActiveTicket({ onReset }) {
  const { activeDrop, burnDrop, resetDrop } = useNullPin();
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  const [burning, setBurning] = useState(false);

  // Countdown timer
  useEffect(() => {
    if (!activeDrop || activeDrop.status === 'burned') return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          burnDrop();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeDrop, burnDrop]);

  const handleCopy = useCallback(() => {
    if (!activeDrop) return;
    navigator.clipboard.writeText(activeDrop.pin).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [activeDrop]);

  const handleBurn = useCallback(() => {
    setBurning(true);
    setTimeout(() => {
      burnDrop();
      onReset();
      setBurning(false);
    }, 600);
  }, [burnDrop, onReset]);

  const handleCancel = useCallback(() => {
    resetDrop();
    onReset();
  }, [resetDrop, onReset]);

  if (!activeDrop) return null;

  const pin = activeDrop.pin;
  const prefs = activeDrop.prefs;
  const statusIdx = STATUS_STEPS.findIndex((s) => s.key === activeDrop.status);
  const isTimeLow = timeLeft <= 60;

  return (
    <div className={`glass-card overflow-hidden animate-scale-in glow-emerald ${burning ? 'animate-burn' : ''}`}>
      {/* Thermal ticket header bar */}
      <div className="bg-emerald-500 dark:bg-emerald-500/90 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-white animate-pulse" />
            <span className="text-sm font-bold text-white uppercase tracking-wider">Digital Parchi — Live</span>
          </div>
          <span className="text-xs font-mono text-emerald-100">PIN Active</span>
        </div>
      </div>

      <div className="p-6">
        {/* Giant PIN Display */}
        <div className="text-center mb-6">
          <p className="text-xs font-semibold text-slate-500 dark:text-zinc-500 uppercase tracking-widest mb-3">
            Your 4-Digit PIN
          </p>
          <div className="flex items-center justify-center gap-3 sm:gap-4 mb-4">
            {pin.split('').map((digit, i) => (
              <div
                key={i}
                className="w-14 h-[4.5rem] sm:w-16 sm:h-20 flex items-center justify-center 
                           rounded-xl bg-slate-100 dark:bg-zinc-800 
                           border-2 border-slate-200 dark:border-zinc-700
                           text-3xl sm:text-4xl font-mono font-bold 
                           text-slate-900 dark:text-emerald-400
                           shadow-sm"
              >
                {digit}
              </div>
            ))}
          </div>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg
                       bg-slate-100 dark:bg-zinc-800 
                       border border-slate-200 dark:border-zinc-700/50
                       text-xs font-semibold text-slate-600 dark:text-zinc-400
                       hover:bg-slate-200 dark:hover:bg-zinc-700
                       transition-all active:scale-[0.97]"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Copy PIN'}
          </button>
        </div>

        {/* Countdown Timer */}
        <div className={`text-center mb-5 p-3 rounded-xl ${isTimeLow ? 'bg-rose-50 dark:bg-rose-500/10' : 'bg-slate-50 dark:bg-zinc-900/50'} transition-colors`}>
          <div className="flex items-center justify-center gap-2">
            <Flame className={`w-4 h-4 ${isTimeLow ? 'text-rose-500 animate-ticker' : 'text-slate-400 dark:text-zinc-500'}`} />
            <span className={`text-2xl font-mono font-bold tracking-wider ${isTimeLow ? 'text-rose-500' : 'text-slate-900 dark:text-zinc-100'}`}>
              {formatTime(timeLeft)}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5 uppercase tracking-wider">
            Self-destructs when timer hits zero
          </p>
        </div>

        {/* Print Specs Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-5">
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700/50 text-xs font-semibold text-slate-600 dark:text-zinc-400">
            {prefs.colorMode === 'bw' ? '⚫ B&W' : '🎨 Color'}
          </span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700/50 text-xs font-semibold text-slate-600 dark:text-zinc-400">
            {prefs.sides === 'single' ? '📄 1-Sided' : '📑 2-Sided'}
          </span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700/50 text-xs font-semibold text-slate-600 dark:text-zinc-400">
            🖨 {prefs.copies} {prefs.copies === 1 ? 'Copy' : 'Copies'}
          </span>
          {prefs.burnAfterPrint && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-xs font-semibold text-rose-600 dark:text-rose-400">
              🔥 Burn after print
            </span>
          )}
        </div>

        {/* Status Stepper */}
        <div className="space-y-0 mb-6">
          <p className="text-xs font-semibold text-slate-500 dark:text-zinc-500 uppercase tracking-widest mb-3">
            Live Status
          </p>
          {STATUS_STEPS.map((step, i) => {
            const isActive = i === statusIdx;
            const isPast = i < statusIdx;
            const isFuture = i > statusIdx;
            return (
              <div key={step.key} className="flex items-start gap-3 relative">
                {/* Connector line */}
                {i < STATUS_STEPS.length - 1 && (
                  <div className={`absolute left-[11px] top-6 w-0.5 h-6 ${isPast ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-zinc-800'}`} />
                )}
                <span className="text-base mt-0.5 flex-shrink-0">{step.emoji}</span>
                <div className="pb-4">
                  <p className={`text-sm font-semibold ${isActive ? 'text-slate-900 dark:text-zinc-100' : isFuture ? 'text-slate-400 dark:text-zinc-600' : 'text-slate-500 dark:text-zinc-400'}`}>
                    {step.label}
                  </p>
                  <p className={`text-xs ${isActive ? 'text-slate-500 dark:text-zinc-400' : 'text-slate-400 dark:text-zinc-600'}`}>
                    {step.sub}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <button onClick={handleBurn} className="btn-danger flex items-center justify-center gap-2">
          <Flame className="w-4 h-4" />
          Cancel / Burn Now
        </button>
      </div>

      {/* Dashed tear line */}
      <div className="border-t-2 border-dashed border-slate-200 dark:border-zinc-800 mx-4" />
      <div className="px-6 py-3 text-center">
        <p className="text-[10px] text-slate-400 dark:text-zinc-600 font-mono uppercase tracking-widest">
          NullPin • Zero-Trace • {new Date().toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}

