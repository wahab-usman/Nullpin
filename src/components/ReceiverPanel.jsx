import { useState, useRef, useCallback, useEffect } from 'react';
import { Lock, ShieldCheck, Printer, Flame, Copy, Check, FileText, Code, AlertTriangle } from 'lucide-react';
import { useNullPin } from '../store/NullPinContext';

function formatFileSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function PinKeypad({ onUnlock }) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const refs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  useEffect(() => {
    refs[0].current?.focus();
  }, []);

  const handleChange = useCallback((index, value) => {
    // Only allow digits
    const digit = value.replace(/[^0-9]/g, '').slice(-1);
    setError('');

    setDigits((prev) => {
      const next = [...prev];
      next[index] = digit;

      // Auto-advance
      if (digit && index < 3) {
        setTimeout(() => refs[index + 1].current?.focus(), 10);
      }

      // Auto-submit when 4th digit entered
      if (digit && index === 3 && next.every((d) => d !== '')) {
        const pin = next.join('');
        setTimeout(() => {
          setChecking(true);
          // Simulate a brief check
          setTimeout(() => {
            const result = onUnlock(pin);
            if (!result) {
              setError('PIN not found or expired');
              setDigits(['', '', '', '']);
              refs[0].current?.focus();
            }
            setChecking(false);
          }, 400);
        }, 100);
      }

      return next;
    });
  }, [onUnlock]);

  const handleKeyDown = useCallback((index, e) => {
    if (e.key === 'Backspace') {
      setDigits((prev) => {
        const next = [...prev];
        if (!next[index] && index > 0) {
          next[index - 1] = '';
          setTimeout(() => refs[index - 1].current?.focus(), 10);
        } else {
          next[index] = '';
        }
        return next;
      });
      setError('');
    }
  }, []);

  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 4);
    if (pasted.length === 4) {
      const arr = pasted.split('');
      setDigits(arr);
      refs[3].current?.focus();
      setTimeout(() => {
        setChecking(true);
        setTimeout(() => {
          const result = onUnlock(pasted);
          if (!result) {
            setError('PIN not found or expired');
            setDigits(['', '', '', '']);
            refs[0].current?.focus();
          }
          setChecking(false);
        }, 400);
      }, 100);
    }
  }, [onUnlock]);

  return (
    <div className="glass-card p-6 animate-fade-in">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700/50 mb-4">
          <Lock className="w-7 h-7 text-slate-400 dark:text-zinc-500" />
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight">
          Unlock & Print
        </h2>
        <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1.5 max-w-xs mx-auto">
          Type the 4-digit PIN shown on the sender's phone
        </p>
      </div>

      {/* OTP Boxes */}
      <div className="flex items-center justify-center gap-3 sm:gap-4 mb-4" onPaste={handlePaste}>
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={refs[i]}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            disabled={checking}
            className={`w-14 h-18 sm:w-16 sm:h-20 rounded-xl text-center text-3xl font-mono font-bold
                       transition-all duration-200 outline-none
                       ${error
                         ? 'border-2 border-rose-400 bg-rose-50 dark:bg-rose-500/10 text-rose-500 animate-[shake_0.3s_ease-in-out]'
                         : digit
                           ? 'border-2 border-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                           : 'border-2 border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100'
                       }
                       focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10
                       disabled:opacity-60`}
          />
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center justify-center gap-1.5 mb-4 animate-scale-in">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
          <p className="text-xs font-semibold text-rose-500">{error}</p>
        </div>
      )}

      {/* Checking indicator */}
      {checking && (
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="w-4 h-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Looking up PIN...</p>
        </div>
      )}

      {/* Helper text */}
      <div className="text-center">
        <p className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700/50 text-[11px] text-slate-400 dark:text-zinc-500">
          💡 Try entering the generated PIN from the left panel
        </p>
      </div>
    </div>
  );
}

function UnlockedDock({ drop, onBurn }) {
  const [printed, setPrinted] = useState(false);
  const [burning, setBurning] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const { updateDropStatus } = useNullPin();

  const handlePrint = useCallback(() => {
    if (printed) return;
    setPrinted(true);

    const onAfterPrint = () => {
      window.removeEventListener('afterprint', onAfterPrint);
      if (drop.prefs?.burnAfterPrint) {
        setTimeout(() => {
          updateDropStatus('burned');
          setBurning(true);
          setTimeout(() => onBurn(), 600);
        }, 1500);
      }
    };

    window.addEventListener('afterprint', onAfterPrint, { once: true });
    window.print();
  }, [drop, updateDropStatus, onBurn, printed]);

  const handleBurnNow = useCallback(() => {
    updateDropStatus('burned');
    setBurning(true);
    setTimeout(() => onBurn(), 600);
  }, [updateDropStatus, onBurn]);

  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(drop.textContent || '').catch(() => {});
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }, [drop]);

  const prefs = drop.prefs;
  const isCodeMode = drop.mode === 'code';

  return (
    <div className={`glass-card overflow-hidden animate-scale-in glow-emerald ${burning ? 'animate-burn' : ''}`}>
      {/* Unlocked header */}
      <div className="bg-emerald-500 dark:bg-emerald-500/90 px-6 py-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-white" />
          <span className="text-sm font-bold text-white uppercase tracking-wider">PIN Verified — Drop Unlocked</span>
        </div>
      </div>

      <div className="p-6">
        {/* Print Instructions Banner */}
        <div className="flex flex-wrap gap-2 mb-5 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
          <span className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider mr-1 self-center">
            Print Instructions:
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white dark:bg-zinc-800 border border-amber-200 dark:border-amber-500/30 text-xs font-bold text-slate-700 dark:text-zinc-200">
            {prefs.colorMode === 'bw' ? 'B&W PRINT' : 'COLOR PRINT'}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white dark:bg-zinc-800 border border-amber-200 dark:border-amber-500/30 text-xs font-bold text-slate-700 dark:text-zinc-200">
            {prefs.sides === 'single' ? 'SINGLE-SIDED' : 'DOUBLE-SIDED'}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white dark:bg-zinc-800 border border-amber-200 dark:border-amber-500/30 text-xs font-bold text-slate-700 dark:text-zinc-200">
            {prefs.copies} {prefs.copies === 1 ? 'COPY' : 'COPIES'}
          </span>
        </div>

        {/* File / Content Preview */}
        <div className="mb-5 p-4 rounded-xl bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800/60 print-zone">
          {isCodeMode ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Code className="w-4 h-4 text-slate-400 dark:text-zinc-500" />
                  <span className="text-xs font-semibold text-slate-500 dark:text-zinc-500 uppercase tracking-wider">Code / Link</span>
                </div>
                <button
                  onClick={handleCopyCode}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg
                             bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700/50
                             text-xs font-semibold text-slate-600 dark:text-zinc-400
                             hover:bg-slate-100 dark:hover:bg-zinc-700
                             transition-all active:scale-[0.97]"
                >
                  {codeCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  {codeCopied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="p-3 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700/50 text-sm font-mono text-slate-800 dark:text-zinc-200 overflow-x-auto whitespace-pre-wrap break-words max-h-40">
                {drop.textContent || 'No content'}
              </pre>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-500/20">
                  <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">
                    {drop.file?.name || drop.frontFile?.name || 'Document'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    {formatFileSize(drop.file?.size || drop.frontFile?.size)}
                  </p>
                </div>
              </div>
              {/* RAM badge */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  Loaded in Browser RAM — Won't save to PC Downloads
                </span>
              </div>
              {/* Visual preview placeholder */}
              <div className="mt-3 w-full h-32 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700/50 flex items-center justify-center">
                <div className="text-center">
                  <FileText className="w-8 h-8 text-slate-300 dark:text-zinc-700 mx-auto mb-1" />
                  <span className="text-xs text-slate-400 dark:text-zinc-600">Preview Area</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          <button
            onClick={handlePrint}
            disabled={printed}
            className="btn-primary flex items-center justify-center gap-2.5 text-base py-4"
          >
            <Printer className="w-5 h-5" />
            {printed ? '🔥 File Burned & Wiped from Memory' : '🖨️ Print Direct (Zero-Save)'}
          </button>
          <button
            onClick={handleBurnNow}
            className="btn-danger flex items-center justify-center gap-2"
          >
            <Flame className="w-4 h-4" />
            Burn & Close Now
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ReceiverPanel() {
  const { activeDrop, updateDropStatus, burnDrop, resetDrop } = useNullPin();
  const [unlockedDrop, setUnlockedDrop] = useState(null);

  const handleUnlock = useCallback((pin) => {
    // Check if entered PIN matches the active drop
    if (activeDrop && activeDrop.pin === pin && activeDrop.status !== 'burned') {
      updateDropStatus('opened');
      setUnlockedDrop(activeDrop);
      return true;
    }
    // Demo PIN fallback
    if (pin === '7492' && !activeDrop) {
      const demo = {
        pin: '7492',
        mode: 'file',
        file: { name: 'Lab_Report_Final.pdf', size: 2457600 },
        textContent: '',
        prefs: { colorMode: 'bw', sides: 'double', copies: 2, burnAfterPrint: true },
        status: 'opened',
        createdAt: Date.now(),
      };
      setUnlockedDrop(demo);
      return true;
    }
    return false;
  }, [activeDrop, updateDropStatus]);

  const handleBurn = useCallback(() => {
    setUnlockedDrop(null);
    burnDrop();
  }, [burnDrop]);

  if (unlockedDrop) {
    return <UnlockedDock drop={unlockedDrop} onBurn={handleBurn} />;
  }

  return <PinKeypad onUnlock={handleUnlock} />;
}

