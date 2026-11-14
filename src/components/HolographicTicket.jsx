import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Copy, Check, Flame, Clock, 
  FileText, CreditCard, ShieldCheck, Printer, Files, FileArchive, Loader2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useNullPin, useNullPinTimer } from '../store/NullPinContext';
import { sound } from '../utils/sound';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatFileSize(bytes) {
  if (!bytes) return '1.8 MB';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function isZipFile(file) {
  if (!file) return false;
  const name = file.name || '';
  const type = file.type || '';
  return (
    name.toLowerCase().endsWith('.zip') ||
    type === 'application/zip' ||
    type === 'application/x-zip-compressed' ||
    type === 'multipart/x-zip'
  );
}

export default function HolographicTicket() {
  const { 
    activeDrop, 
    triggerVaporize, 
    uploadState 
  } = useNullPin();
  const { timeLeft } = useNullPinTimer();

  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!activeDrop) return;
    navigator.clipboard.writeText(activeDrop.pin).catch(() => {});
    sound.toggleSnap();
    setCopied(true);

    try {
      confetti({
        particleCount: 24,
        spread: 40,
        origin: { y: 0.55 },
        colors: ['#10b981', '#34d399', '#6ee7b7'],
        disableForReducedMotion: true
      });
    } catch {}

    setTimeout(() => setCopied(false), 2200);
  };

  if (!activeDrop) return null;

  const pin = activeDrop.pin;
  const prefs = activeDrop.prefs || {};
  const isTimeLow = timeLeft <= 60;
  const isIdCard = activeDrop.mode === 'idcard';

  const filesList = activeDrop.files && activeDrop.files.length > 0
    ? activeDrop.files
    : (activeDrop.file ? [activeDrop.file] : []);
  const isMultiFile = filesList.length > 1;
  const totalBytes = filesList.reduce((acc, f) => acc + (f.size || 0), 0);
  const primaryFileName = activeDrop.file?.name || (isIdCard ? 'National / Student ID Card' : 'Academic_Document.pdf');
  const primaryFileSize = formatFileSize(activeDrop.file?.size);

  return (
    <div className="w-full max-w-[500px] mx-auto flex flex-col items-center py-1 select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[500px] rounded-2xl sm:rounded-3xl bg-white/90 dark:bg-zinc-900/90 backdrop-blur-2xl 
                   border border-slate-200/90 dark:border-white/10 
                   shadow-[0_25px_60px_rgba(0,0,0,0.08)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.55)]
                   overflow-hidden"
      >
        {/* TICKET TOP HEADER */}
        <div className="px-4 sm:px-6 pt-3.5 sm:pt-4 pb-2.5 sm:pb-3 border-b border-slate-100 dark:border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <div className="flex flex-col">
              <span className="text-xs font-mono font-extrabold uppercase tracking-wider text-slate-800 dark:text-zinc-100 whitespace-nowrap">
                ACTIVE PIN PASS
              </span>
              <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold tracking-tight whitespace-nowrap">
                ZERO-TRACE RAM PIPE ARMED
              </span>
            </div>
          </div>

          {/* COUNTDOWN TIMER BADGE */}
          <div
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full font-mono text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
              isTimeLow
                ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30 animate-pulse'
                : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
            }`}
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>{formatTime(timeLeft)}</span>
          </div>
        </div>

        {/* LIVE CLOUD VAULT SYNC TELEMETRY BAR */}
        {uploadState && uploadState.status !== 'idle' && (
          <div className="mx-4 sm:mx-6 mt-3 p-2.5 rounded-xl bg-slate-100/80 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-700/60 text-left">
            <div className="flex items-center justify-between text-[11px] font-mono mb-1.5">
              <span className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-zinc-200">
                {uploadState.status === 'synced' ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-emerald-600 dark:text-emerald-400">🟢 Cloud Vault Ready — Instant 4G Unlock Active</span>
                  </>
                ) : uploadState.status === 'error' ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-amber-600 dark:text-amber-400">Offline / Local RAM Pipe Active</span>
                  </>
                ) : (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                    <span>Syncing to Cloud Vault: {uploadState.percent}% ({uploadState.currentFile}/{uploadState.totalFiles} files)...</span>
                  </>
                )}
              </span>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                {uploadState.percent}%
              </span>
            </div>
            {/* Progress bar line */}
            <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-zinc-700 overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                style={{ width: `${Math.max(5, uploadState.percent)}%` }}
              />
            </div>
          </div>
        )}

        {/* 4-DIGIT PIN SHOWCASE */}
        <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 text-center">
          <p className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-400 mb-3 sm:mb-4 whitespace-nowrap">
            SHARE THIS 4-DIGIT PIN WITH THE PRINT TERMINAL
          </p>

          {/* GIANT KINETIC PIN KEYCAPS */}
          <div className="flex items-center justify-center gap-2.5 sm:gap-4 mb-3 sm:mb-4">
            {pin.split('').map((digit, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.2 }}
                className="relative w-14 h-16 sm:w-18 sm:h-20 rounded-2xl sm:rounded-3xl
                           bg-slate-100/90 dark:bg-zinc-800/80 
                           border-2 border-emerald-500/30 dark:border-emerald-500/35 
                           flex items-center justify-center font-mono font-black text-3xl sm:text-4xl 
                           text-slate-900 dark:text-emerald-400 
                           shadow-[0_8px_20px_rgba(16,185,129,0.08)] dark:shadow-[0_0_30px_rgba(16,185,129,0.18)]"
              >
                {/* Specular subtle highlight */}
                <div className="absolute top-1.5 inset-x-2 sm:inset-x-3 h-[1px] bg-white/40 dark:bg-white/15 rounded-full" />
                <span className="relative z-10 select-none">{digit}</span>
              </motion.div>
            ))}
          </div>

          {/* COPY PIN BUTTON */}
          <button
            type="button"
            onClick={handleCopy}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full 
                       border text-xs font-bold transition-all duration-200 cursor-pointer touch-manipulation min-h-[44px] ${
                         copied
                           ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 scale-105'
                           : 'bg-slate-100/90 dark:bg-zinc-800/80 border-slate-200 dark:border-zinc-700/80 text-slate-700 dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-700'
                       }`}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span>Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy 4-Digit PIN</span>
              </>
            )}
          </button>
        </div>

        {/* PERFORATED TICKET DIVIDER NOTCHES */}
        <div className="relative w-full my-1">
          <div className="ticket-cutout-left top-1/2 -translate-y-1/2 bg-slate-50 dark:bg-[#060608] border-r border-slate-200 dark:border-zinc-800" />
          <div className="mx-4 sm:mx-8 border-b border-dashed border-slate-300 dark:border-zinc-800" />
          <div className="ticket-cutout-right top-1/2 -translate-y-1/2 bg-slate-50 dark:bg-[#060608] border-l border-slate-200 dark:border-zinc-800" />
        </div>

        {/* PAYLOAD INFO & PRINT SPECS */}
        <div className="px-4 sm:px-8 py-4 sm:py-5 space-y-3.5 sm:space-y-4">
          {/* File summary card (Multi-file or Single file) */}
          {isMultiFile ? (
            <div className="p-3.5 rounded-2xl bg-slate-100/70 dark:bg-zinc-800/50 border border-slate-200/80 dark:border-zinc-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Files className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                      {filesList.length} Files Attached
                    </p>
                    <p className="text-[10px] font-mono text-slate-500 dark:text-zinc-400">
                      {formatFileSize(totalBytes)} • Volatile RAM Stream
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 uppercase">
                  Multi-Doc
                </span>
              </div>

              {/* Scrollable list of attached files */}
              <div className="max-h-24 overflow-y-auto pr-1 space-y-1 custom-scrollbar pt-1.5 border-t border-slate-200/60 dark:border-zinc-700/60 text-left">
                {filesList.map((f, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[11px] font-mono text-slate-700 dark:text-zinc-300 py-0.5">
                    <span className="truncate max-w-[140px] min-[380px]:max-w-[190px] sm:max-w-[230px] font-medium">
                      {idx + 1}. {f.name}
                    </span>
                    <span className="text-slate-400 dark:text-zinc-500 text-[10px] shrink-0 ml-2">
                      {formatFileSize(f.size)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-100/70 dark:bg-zinc-800/50 border border-slate-200/80 dark:border-zinc-800">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                {isZipFile(activeDrop.file) ? (
                  <FileArchive className="w-5 h-5" />
                ) : isIdCard ? (
                  <CreditCard className="w-5 h-5" />
                ) : (
                  <FileText className="w-5 h-5" />
                )}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate max-w-[140px] min-[380px]:max-w-[190px] sm:max-w-xs">
                  {primaryFileName}
                </p>
                <p className="text-[11px] font-mono text-slate-500 dark:text-zinc-400">
                  {isZipFile(activeDrop.file)
                    ? `${primaryFileSize} • Encrypted ZIP Archive in RAM`
                    : isIdCard
                    ? 'Front & Back ID Sheet • A4 Format'
                    : `${primaryFileSize} • Volatile RAM Stream`}
                </p>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 uppercase shrink-0">
                {isZipFile(activeDrop.file) ? 'ZIP Archive' : isIdCard ? 'ID Card' : 'PDF / Doc'}
              </span>
            </div>
          )}

          {/* Specs pills row */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
            <span className="px-2.5 sm:px-3 py-1 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200/60 dark:border-zinc-700/60 text-xs font-mono font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
              <Printer className="w-3 h-3 text-emerald-500" />
              <span>{prefs.colorMode === 'bw' ? 'B&W (Grayscale)' : 'CMYK Color'}</span>
            </span>

            <span className="px-2.5 sm:px-3 py-1 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200/60 dark:border-zinc-700/60 text-xs font-mono font-semibold text-slate-700 dark:text-zinc-300">
              {prefs.sides === 'single' ? '1-Sided Sheet' : '2-Sided Duplex'}
            </span>

            <span className="px-2.5 sm:px-3 py-1 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200/60 dark:border-zinc-700/60 text-xs font-mono font-semibold text-slate-700 dark:text-zinc-300">
              {prefs.copies} {prefs.copies === 1 ? 'Copy' : 'Copies'}
            </span>

            {prefs.burnAfterPrint && (
              <span className="px-2.5 sm:px-3 py-1 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-mono font-semibold flex items-center gap-1">
                <Flame className="w-3 h-3" />
                <span>Auto-Burn Armed</span>
              </span>
            )}
          </div>

          {/* SENDER STATUS & CANCEL ACTION */}
          <div className="flex flex-col gap-2.5 sm:gap-3 pt-2">
            <div className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl border text-xs font-mono select-none transition-colors ${
              activeDrop?.status === 'opened'
                ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-600 dark:text-emerald-400 font-bold'
                : 'bg-slate-100/70 dark:bg-zinc-800/60 border-slate-200/80 dark:border-zinc-700/60 text-slate-700 dark:text-zinc-300'
            }`}>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>
                {activeDrop?.status === 'opened'
                  ? '✓ Unlocked at print terminal!'
                  : 'Waiting for terminal to enter PIN...'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                triggerVaporize();
              }}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-rose-500 
                         hover:bg-rose-500/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation min-h-[44px]"
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Cancel & Burn Drop Now</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
