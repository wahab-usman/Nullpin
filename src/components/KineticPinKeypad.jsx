import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, AlertCircle, Lock, Loader2 } from 'lucide-react';
import { useNullPin } from '../store/NullPinContext';
import { sound } from '../utils/sound';

export default function KineticPinKeypad() {
  const { pinDigits, setPinDigits, pinError, unlockWithPin } = useNullPin();
  const [isUnlocking, setIsUnlocking] = useState(false);
  const hiddenInputRef = useRef(null);

  // Focus input automatically on mount
  useEffect(() => {
    hiddenInputRef.current?.focus();
  }, []);

  // Update digits from string
  const handleInputChange = (e) => {
    if (isUnlocking) return;
    const rawVal = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
    sound.keyPress();

    const arr = ['', '', '', ''];
    for (let i = 0; i < rawVal.length; i++) {
      arr[i] = rawVal[i];
    }
    setPinDigits(arr);

    // Auto-unlock upon 4th digit with loading feedback
    if (rawVal.length === 4) {
      setIsUnlocking(true);
      setTimeout(async () => {
        try {
          const success = await unlockWithPin(rawVal);
          if (!success) {
            setIsUnlocking(false);
          }
        } catch (err) {
          setIsUnlocking(false);
        }
      }, 100);
    }
  };

  const handleKeyDown = (e) => {
    if (isUnlocking) {
      e.preventDefault();
      return;
    }
    if (e.key === 'Backspace') {
      sound.toggleSnap();
    }
  };

  // Click card to focus input
  const handleBoxClick = () => {
    if (!isUnlocking) {
      hiddenInputRef.current?.focus();
    }
  };

  const currentPinStr = pinDigits.join('');

  return (
    <div className="w-full max-w-[500px] mx-auto flex flex-col items-center">
      {/* Hidden real input for native hardware/mobile keyboard support */}
      <input
        ref={hiddenInputRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        autoComplete="one-time-code"
        value={currentPinStr}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        disabled={isUnlocking}
        className="sr-only"
        style={{ fontSize: '16px' }}
        autoFocus
      />

      {/* Compact Main Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        onClick={handleBoxClick}
        className={`w-full max-w-[500px] p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl backdrop-blur-xl transition-all duration-200 cursor-pointer select-none
          ${
            pinError
              ? 'border-2 border-rose-500/80 bg-rose-500/[0.04]'
              : isUnlocking
              ? 'border-2 border-emerald-500/60 bg-emerald-500/[0.02] shadow-[0_20px_50px_rgba(16,185,129,0.15)]'
              : 'border border-slate-200/90 dark:border-white/10 bg-white/80 dark:bg-zinc-900/75 shadow-[0_20px_50px_rgba(0,0,0,0.06)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)]'
          }`}
      >
        {/* Card Header */}
        <div className="text-center mb-3 sm:mb-5">
          <div className="inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-1.5 sm:mb-2">
            <Lock className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <h2 className="text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight whitespace-nowrap">
            Unlock & Print
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 sm:mt-1 whitespace-nowrap">
            Type the 4-digit PIN from the sender's device
          </p>
        </div>

        {/* 4 Sleek Compact Keycap Slots */}
        <motion.div
          animate={
            pinError
              ? {
                  x: [-8, 8, -6, 6, -3, 3, 0],
                  transition: { duration: 0.35 },
                }
              : {}
          }
          className="flex items-center justify-center gap-2 sm:gap-4 mb-3 sm:mb-5"
        >
          {pinDigits.map((digit, i) => {
            const isFilled = digit !== '';
            const isCurrent = currentPinStr.length === i;

            return (
              <div
                key={i}
                className={`relative w-13 h-15 min-[380px]:w-14 min-[380px]:h-16 sm:w-18 sm:h-20 rounded-xl sm:rounded-2xl flex items-center justify-center
                  transition-all duration-150 select-none
                  ${
                    pinError
                      ? 'border-2 border-rose-500 bg-rose-500/10 text-rose-500'
                      : isFilled
                      ? 'border-2 border-emerald-500/80 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold'
                      : isCurrent
                      ? 'border-2 border-slate-400 dark:border-zinc-500 bg-slate-50 dark:bg-zinc-800/80'
                      : 'border border-slate-200 dark:border-zinc-800 bg-slate-100/60 dark:bg-zinc-800/40 text-slate-900 dark:text-zinc-100'
                  }`}
              >
                {isFilled ? (
                  <span className="font-mono font-extrabold text-2xl sm:text-4xl tracking-tighter select-none">
                    {digit}
                  </span>
                ) : (
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-zinc-700" />
                )}
              </div>
            );
          })}
        </motion.div>

        {/* Status text, Loading state, or Error */}
        <div className="h-6 mb-2 flex items-center justify-center text-center">
          <AnimatePresence mode="wait">
            {isUnlocking ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0, y: -2 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -2 }}
                className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400"
              >
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                <span>Decrypting & pulling payload into RAM...</span>
              </motion.div>
            ) : pinError ? (
              <motion.div
                key="err"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-1.5 text-xs font-bold text-rose-500"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Invalid or expired PIN</span>
              </motion.div>
            ) : (
              <motion.span
                key="hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-[11px] font-mono text-slate-400 dark:text-zinc-500"
              >
                Auto-unlocks on 4th digit
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
