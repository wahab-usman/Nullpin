import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Printer, Flame, ShieldCheck, FileText, CreditCard, 
  Lock, Loader2, ArrowRight, Layers, SlidersHorizontal, Files, Check,
  FileArchive, FolderDown, Download
} from 'lucide-react';
import { useNullPin } from '../store/NullPinContext';
import { sound } from '../utils/sound';
import { fireVaporizeSparks } from './VaporizeEffect';
import { printFromRam, preloadDropBlobs } from '../utils/ramPrinter';

function formatSize(bytes) {
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

export default function PrintStudio() {
  const { unlockedDrop, triggerVaporize } = useNullPin();
  const [isVaporizing, setIsVaporizing] = useState(false);
  const [isAutoBurning, setIsAutoBurning] = useState(false);
  const [autoBurnTimer, setAutoBurnTimer] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printingFileId, setPrintingFileId] = useState(null);
  const [printedFileIds, setPrintedFileIds] = useState(new Set());

  const drop = unlockedDrop;

  // Eagerly pre-fetch & cache all drop files into memory upon PIN unlock
  useEffect(() => {
    if (drop) {
      preloadDropBlobs(drop).catch((err) => {
        console.warn('[PrintStudio] Background preload warning:', err);
      });
    }
  }, [drop]);

  const filesList = drop?.files && drop.files.length > 0
    ? drop.files
    : (drop?.file ? [drop.file] : []);
  const isMultiFile = filesList.length > 1;
  const totalBytes = filesList.reduce((acc, f) => acc + (f.size || 0), 0);

  const allAreZip = filesList.length > 0 && filesList.every(isZipFile);
  const isSingleZip = !isMultiFile && isZipFile(drop?.file);

  // Runtime environment detection: Enforces strict zero-download print-only mode on Desktop / PC
  const isElectron =
    typeof window !== 'undefined' &&
    (window.navigator.userAgent.toLowerCase().includes('electron') ||
      window.location.protocol === 'file:');

  const isCapacitorNative =
    typeof window !== 'undefined' &&
    (window.Capacitor?.isNativePlatform?.() || window.Capacitor?.isNativePlatform === true);

  const isMobileDevice =
    (typeof window !== 'undefined' &&
      !isElectron &&
      /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        window.navigator.userAgent
      )) || isCapacitorNative;

  // Multi-file queue progress calculation
  const unprintedFiles = filesList.filter((f) => !printedFileIds.has(f.id || f.name));
  const nextTargetFile = unprintedFiles.length > 0 ? unprintedFiles[0] : filesList[0];
  const allFilesPrinted = filesList.length > 0 && filesList.every((f) => printedFileIds.has(f.id || f.name));
  const printedCount = filesList.filter((f) => printedFileIds.has(f.id || f.name)).length;
  const [burnStatusMessage, setBurnStatusMessage] = useState('Print complete. Auto-purging RAM buffer in 3 seconds...');

  // Auto-Burn sequence: initiates zero-trace RAM wipe once print/save completes
  const startAutoBurnSequence = useCallback((delayMs = 3000, customMessage = null) => {
    if (customMessage) {
      setBurnStatusMessage(customMessage);
    } else {
      setBurnStatusMessage('Print complete. Auto-purging RAM buffer in 3 seconds...');
    }
    setIsAutoBurning(true);
    const timer = setTimeout(() => {
      setIsVaporizing(true);
      sound.vaporize();
      fireVaporizeSparks();
      setTimeout(() => {
        triggerVaporize();
      }, 750);
    }, delayMs);
    setAutoBurnTimer(timer);
  }, [triggerVaporize]);

  // Save / extract ZIP archive from RAM
  const handleSaveArchive = useCallback((fileObj) => {
    if (isVaporizing) return;
    const fKey = fileObj.id || fileObj.name;
    const url = fileObj.blobUrl || (fileObj.rawFile instanceof Blob ? URL.createObjectURL(fileObj.rawFile) : null);
    if (!url) return;

    sound.printBeep();
    const a = document.createElement('a');
    a.href = url;
    a.download = fileObj.name || 'archive.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setPrintedFileIds((prev) => {
      const nextSet = new Set([...prev, fKey]);
      const allDone = filesList.length > 0 && filesList.every((f) => nextSet.has(f.id || f.name));
      if (allDone) {
        startAutoBurnSequence(3000, 'Archive saved to device! Auto-purging RAM buffer in 3 seconds...');
      }
      return nextSet;
    });
  }, [filesList, startAutoBurnSequence, isVaporizing]);

  // Save single file or payload directly to device memory / filesystem
  const handleSaveToDevice = useCallback((fileObj = null) => {
    if (isVaporizing) return;
    const target = fileObj || drop?.file || filesList[0];

    // Special ID Card front + back download handling
    if (!target && drop?.mode === 'idcard') {
      const front = drop.frontBlobUrl || drop.frontPreview;
      if (front) {
        sound.printBeep();
        const a = document.createElement('a');
        a.href = front;
        a.download = 'NullPin_ID_Card_Front.jpg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        if (drop.backBlobUrl) {
          setTimeout(() => {
            const b = document.createElement('a');
            b.href = drop.backBlobUrl;
            b.download = 'NullPin_ID_Card_Back.jpg';
            document.body.appendChild(b);
            b.click();
            document.body.removeChild(b);
          }, 300);
        }

        setPrintedFileIds((prev) => new Set([...prev, 'idcard']));
        startAutoBurnSequence(3000, 'ID Card saved to device! Auto-purging RAM buffer in 3 seconds...');
        return;
      }
    }

    if (!target) return;
    const fKey = target.id || target.name || 'primary';
    const url = target.blobUrl || drop?.blobUrl || (target.rawFile instanceof Blob ? URL.createObjectURL(target.rawFile) : null);
    if (!url) return;

    sound.printBeep();
    const a = document.createElement('a');
    a.href = url;
    a.download = target.name || drop?.file?.name || 'NullPin_Payload';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setPrintedFileIds((prev) => {
      const nextSet = new Set([...prev, fKey]);
      const allDone = filesList.length === 0 || filesList.every((f) => nextSet.has(f.id || f.name));
      if (allDone) {
        startAutoBurnSequence(3000, 'Payload saved to device! Auto-purging RAM buffer in 3 seconds...');
      }
      return nextSet;
    });
  }, [drop, filesList, isVaporizing, startAutoBurnSequence]);

  // Save all files in multi-file batch to device
  const handleSaveAllToDevice = useCallback(() => {
    if (isVaporizing || filesList.length === 0) return;
    sound.printBeep();

    filesList.forEach((fileObj, index) => {
      setTimeout(() => {
        const url = fileObj.blobUrl || (fileObj.rawFile instanceof Blob ? URL.createObjectURL(fileObj.rawFile) : null);
        if (!url) return;
        const a = document.createElement('a');
        a.href = url;
        a.download = fileObj.name || `file_${index + 1}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, index * 250);
    });

    const allKeys = filesList.map((f) => f.id || f.name);
    setPrintedFileIds(new Set(allKeys));
    startAutoBurnSequence(3000, `All ${filesList.length} files saved! Auto-purging RAM buffer in 3 seconds...`);
  }, [filesList, isVaporizing, startAutoBurnSequence]);

  const handleVaporizeNow = useCallback(() => {
    if (autoBurnTimer) clearTimeout(autoBurnTimer);
    setIsAutoBurning(false);
    setIsVaporizing(true);
    sound.vaporize();
    fireVaporizeSparks();
    setTimeout(() => {
      triggerVaporize();
    }, 800);
  }, [autoBurnTimer, triggerVaporize]);

  // Print individual file from manifest
  const handlePrintSingleFile = useCallback((fileObj) => {
    if (isPrinting || isAutoBurning || isVaporizing) return;
    if (isZipFile(fileObj)) {
      handleSaveArchive(fileObj);
      return;
    }
    const fKey = fileObj.id || fileObj.name;
    setPrintingFileId(fKey);
    setIsPrinting(true);
    sound.printBeep();

    // Safety watchdog: ensures isPrinting is not stuck permanently
    let watchdogTimer = setTimeout(() => {
      setPrintingFileId(null);
      setIsPrinting(false);
    }, 60000);

    printFromRam({
      ...drop,
      file: fileObj,
      rawFile: fileObj.rawFile || drop?.rawFile,
      blobUrl: fileObj.blobUrl || drop?.blobUrl,
    }, () => {
      clearTimeout(watchdogTimer);
      setPrintingFileId(null);
      setIsPrinting(false);
      setPrintedFileIds((prev) => {
        const nextSet = new Set([...prev, fKey]);
        const allDone = filesList.length > 0 && filesList.every((f) => nextSet.has(f.id || f.name));
        if (allDone || !isMultiFile) {
          // Auto-Burn drop & redirect to Home Page immediately after print dialog finishes
          setTimeout(() => {
            handleVaporizeNow();
          }, 350);
        }
        return nextSet;
      });
    });
  }, [drop, handleSaveArchive, filesList, isMultiFile, handleVaporizeNow, isPrinting, isAutoBurning, isVaporizing]);

  // Primary action button handler:
  // Handles single files, archives, and sequential queue execution for multi-file batches
  const handlePrint = useCallback(() => {
    if (isPrinting || isAutoBurning || isVaporizing) return;

    if (isSingleZip) {
      handleSaveArchive(drop.file || filesList[0]);
      return;
    }

    if (allAreZip) {
      const targetZip = nextTargetFile || filesList[0];
      handleSaveArchive(targetZip);
      return;
    }

    if (!isMultiFile) {
      setIsPrinting(true);
      sound.printBeep();
      const target = drop?.file || filesList[0];
      const fKey = target?.id || target?.name || 'primary';

      // Safety watchdog: ensures isPrinting is not stuck permanently
      let watchdogTimer = setTimeout(() => {
        setIsPrinting(false);
      }, 60000);

      printFromRam({
        ...drop,
        file: target,
        rawFile: target?.rawFile || drop?.rawFile,
        blobUrl: target?.blobUrl || drop?.blobUrl,
      }, () => {
        clearTimeout(watchdogTimer);
        setIsPrinting(false);
        setPrintedFileIds((prev) => new Set([...prev, fKey]));
        // Auto-Burn drop & redirect to Home Page immediately after print dialog finishes
        setTimeout(() => {
          handleVaporizeNow();
        }, 350);
      });
      return;
    }

    // For multi-file batches: direct user click dispatches next target file
    // Bypasses browser popup blocking and prevents stalled print queues
    const target = nextTargetFile;
    if (!target) return;
    handlePrintSingleFile(target);
  }, [drop, isSingleZip, allAreZip, isMultiFile, filesList, nextTargetFile, handlePrintSingleFile, handleSaveArchive, handleVaporizeNow, isPrinting, isAutoBurning, isVaporizing]);

  // Block Ctrl+S / Cmd+S on desktop to enforce strict Zero-Download policy
  useEffect(() => {
    if (isMobileDevice) return;
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileDevice]);

  if (!drop) return null;

  const prefs = drop.prefs || {};
  const isIdCard = drop.mode === 'idcard';
  const fileName = drop.file?.name || (isIdCard ? 'National / Student ID Card' : 'Academic_Document.pdf');

  return (
    <div 
      className="w-full max-w-[500px] mx-auto flex flex-col items-center py-1 select-none"
      onContextMenu={(e) => {
        if (!isMobileDevice) e.preventDefault();
      }}
    >
      <motion.div
        animate={
          isVaporizing
            ? {
                scale: [1, 0.95, 0.85],
                opacity: [1, 0.6, 0],
                filter: ['brightness(1)', 'brightness(1.5)', 'brightness(2)'],
                transition: { duration: 0.6, ease: 'easeOut' },
              }
            : { scale: 1, opacity: 1 }
        }
        transition={{ duration: 0.2 }}
        className="w-full max-w-[500px] rounded-2xl sm:rounded-3xl bg-white/90 dark:bg-zinc-900/90 backdrop-blur-2xl 
                   border border-slate-200/90 dark:border-white/10 
                   shadow-[0_25px_60px_rgba(0,0,0,0.08)] dark:shadow-[0_25px_70px_rgba(0,0,0,0.6)]
                   overflow-hidden p-3.5 sm:p-5 space-y-2.5 sm:space-y-4"
      >
        {/* ================= 1. TERMINAL HEADER ================= */}
        <div className="flex items-center justify-between pb-2.5 sm:pb-3.5 border-b border-slate-100 dark:border-zinc-800/80">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <div className="flex flex-col">
              <span className="text-xs font-mono font-extrabold uppercase tracking-wider text-slate-900 dark:text-zinc-100">
                RAM Decryption Terminal
              </span>
              <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                PAYLOAD SECURED IN VOLATILE BUFFER
              </span>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-xs font-mono font-bold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>UNLOCKED</span>
          </div>
        </div>

        {/* ================= 2. FILE MANIFEST CARD ================= */}
        {isMultiFile ? (
          <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/80 dark:bg-zinc-950/50 border border-slate-200/80 dark:border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-zinc-800">
              <div className="flex items-center gap-2 sm:gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Files className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-zinc-100">
                    {filesList.length} Files Ready to Print
                  </p>
                  <p className="text-[10px] sm:text-xs font-mono text-slate-500 dark:text-zinc-400 mt-0.5">
                    {formatSize(totalBytes)} Total • Ephemeral Memory Buffer
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 sm:px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                {filesList.length} ATTACHED
              </span>
            </div>

            {/* List of files with individual print/save actions */}
            <div className="max-h-40 overflow-y-auto pr-1 space-y-1.5 custom-scrollbar">
              {filesList.map((f, idx) => {
                const fKey = f.id || f.name || String(idx);
                const isItemPrinting = printingFileId === fKey;
                const isItemPrinted = printedFileIds.has(fKey);
                const isZip = isZipFile(f);
                return (
                  <div
                    key={fKey}
                    className="flex items-center justify-between p-2 sm:p-2.5 rounded-xl bg-white/90 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800 text-xs text-left"
                  >
                    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 pr-2">
                      <span className="text-[10px] font-mono text-slate-400 w-4 text-center">
                        {idx + 1}
                      </span>
                      {isZip ? (
                        <FileArchive className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-emerald-500 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 dark:text-zinc-200 truncate max-w-[120px] min-[380px]:max-w-[180px] sm:max-w-[260px]">
                          {f.name}
                        </p>
                        <p className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">
                          {formatSize(f.size)} {isZip ? '• ZIP Archive' : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isZip && isMobileDevice && (
                        <button
                          type="button"
                          title="Save to Device"
                          onClick={() => handleSaveToDevice(f)}
                          disabled={isItemPrinting || isVaporizing}
                          className="p-1.5 sm:p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 transition-all cursor-pointer touch-manipulation min-h-[34px] min-w-[34px] flex items-center justify-center border border-slate-200 dark:border-zinc-700/60"
                        >
                          <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handlePrintSingleFile(f)}
                        disabled={isItemPrinting}
                        className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 touch-manipulation min-h-[34px] ${
                          isItemPrinted
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                            : 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-xs'
                        }`}
                      >
                        {isItemPrinting ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Spooling...</span>
                          </>
                        ) : isItemPrinted ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-500" />
                            <span>{isZip ? 'Saved' : 'Printed'}</span>
                          </>
                        ) : isZip ? (
                          <>
                            <FolderDown className="w-3 h-3" />
                            <span>Save ZIP</span>
                          </>
                        ) : (
                          <>
                            <Printer className="w-3 h-3" />
                            <span>Print</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/80 dark:bg-zinc-950/50 border border-slate-200/80 dark:border-zinc-800/80 flex items-center gap-3 sm:gap-3.5">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              {isSingleZip ? (
                <FileArchive className="w-5 h-5 sm:w-6 sm:h-6" />
              ) : isIdCard ? (
                <CreditCard className="w-5 h-5 sm:w-6 sm:h-6" />
              ) : (
                <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
              )}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-zinc-100 truncate max-w-[130px] min-[380px]:max-w-[200px] sm:max-w-md">
                {fileName}
              </p>
              <p className="text-[10px] sm:text-xs font-mono text-slate-500 dark:text-zinc-400 mt-0.5">
                {formatSize(drop.file?.size)} • {
                  isSingleZip
                    ? 'Encrypted ZIP Archive in RAM'
                    : isIdCard
                    ? 'ID Card Sheet (A4 Auto-Merged)'
                    : 'PDF / Document Stream'
                }
              </p>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 sm:px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
              {isSingleZip ? 'ZIP READY' : 'READY'}
            </span>
          </div>
        )}

        {/* ================= 3. CLEAN PRINT SPECIFICATIONS GRID ================= */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 px-0.5">
            <SlidersHorizontal className="w-3 h-3 text-slate-400 dark:text-zinc-500" />
            <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
              {isSingleZip || allAreZip ? 'Security & RAM Parameters' : 'Print Execution Parameters'}
            </span>
          </div>

          <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-2 sm:gap-2.5">
            {/* Color Profile */}
            <div className="p-2.5 sm:p-3 rounded-2xl bg-slate-50/80 dark:bg-zinc-950/40 border border-slate-200/70 dark:border-zinc-800/70 text-left">
              <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500 block">
                {isSingleZip || allAreZip ? 'ENCRYPTION' : 'PROFILE'}
              </span>
              <p className="text-xs font-bold text-slate-900 dark:text-zinc-100 mt-0.5">
                {isSingleZip || allAreZip ? 'RAM Ephemeral' : prefs.colorMode === 'bw' ? 'B&W Grayscale' : 'Full Color'}
              </p>
            </div>

            {/* Duplex / Sides */}
            <div className="p-2.5 sm:p-3 rounded-2xl bg-slate-50/80 dark:bg-zinc-950/40 border border-slate-200/70 dark:border-zinc-800/70 text-left">
              <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500 block">
                {isSingleZip || allAreZip ? 'STORAGE' : 'SIDES'}
              </span>
              <p className="text-xs font-bold text-slate-900 dark:text-zinc-100 mt-0.5">
                {isSingleZip || allAreZip ? 'Zero Disk Log' : prefs.sides === 'single' ? '1-Sided Sheet' : '2-Sided Duplex'}
              </p>
            </div>

            {/* Copies */}
            <div className="p-2.5 sm:p-3 rounded-2xl bg-slate-50/80 dark:bg-zinc-950/40 border border-slate-200/70 dark:border-zinc-800/70 text-left">
              <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500 block">
                {isSingleZip || allAreZip ? 'WIPE ON' : 'QUANTITY'}
              </span>
              <p className="text-xs font-bold text-slate-900 dark:text-zinc-100 mt-0.5">
                {isSingleZip || allAreZip ? 'Save / Timeout' : `${prefs.copies} ${prefs.copies === 1 ? 'Copy' : 'Copies'}`}
              </p>
            </div>
          </div>
        </div>

        {/* Security Footnote */}
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-100/60 dark:bg-zinc-800/30 text-slate-500 dark:text-zinc-400 text-left">
          <Lock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span className="text-[10px] sm:text-[11px] font-mono">
            {isSingleZip || allAreZip
              ? 'Zero-Trace Buffer: Decrypted directly into memory and purged on complete.'
              : isMobileDevice
              ? 'Zero-Trace RAM Stream: Ready to print direct or save to mobile storage.'
              : 'Zero-Download Stream: Transferred directly to local printer spooler without saving to PC storage.'}
          </span>
        </div>

        {/* ================= 4. ACTION BUTTONS ================= */}
        <div className="flex flex-col gap-2.5 pt-1">
          {printedFileIds.size > 0 && (
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="text-left">Job dispatched. Document remains safely in RAM buffer.</span>
              </div>
              <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-zinc-500 shrink-0">
                ACTIVE
              </span>
            </div>
          )}

          {isSingleZip || allAreZip ? (
            /* ZIP Archive Save Button */
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting || isVaporizing}
              className="relative overflow-hidden w-full py-3.5 sm:py-4 px-4 sm:px-6 rounded-2xl font-bold text-white text-xs sm:text-sm bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] transition-all flex items-center justify-center gap-2 sm:gap-2.5 cursor-pointer disabled:opacity-50 shadow-[0_10px_25px_rgba(16,185,129,0.3)] min-h-[48px] touch-manipulation group"
            >
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
              <FolderDown className="w-4 h-4 text-emerald-100 shrink-0" />
              <span>
                {isSingleZip
                  ? 'Save ZIP Archive from RAM'
                  : allFilesPrinted
                  ? `All ${filesList.length} ZIPs Saved ✓ (Save Again)`
                  : `Save ZIP ${printedCount + 1} of ${filesList.length}: ${nextTargetFile?.name}`}
              </span>
              <ArrowRight className="w-4 h-4 text-emerald-100 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </button>
          ) : (
            /* Action Buttons: Strict Print-Only on Desktop, Dual Print + Save on Mobile */
            <div className={isMobileDevice ? "grid grid-cols-1 sm:grid-cols-2 gap-2.5" : "w-full"}>
              {/* 1. Print Button */}
              <button
                type="button"
                onClick={handlePrint}
                disabled={isPrinting || isVaporizing}
                className="relative overflow-hidden w-full py-3 sm:py-3.5 px-4 rounded-xl font-bold text-white text-xs sm:text-sm bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(16,185,129,0.3)] cursor-pointer disabled:opacity-50 min-h-[46px] touch-manipulation group"
              >
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
                {isPrinting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white shrink-0" />
                    <span className="truncate">Spooling...</span>
                  </>
                ) : isMultiFile ? (
                  allFilesPrinted ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-100 shrink-0" />
                      <span className="truncate">Printed ✓ (Again)</span>
                    </>
                  ) : (
                    <>
                      <Printer className="w-4 h-4 text-emerald-100 shrink-0" />
                      <span className="truncate">
                        Print {printedCount + 1}/{filesList.length}
                      </span>
                    </>
                  )
                ) : (
                  <>
                    <Printer className="w-4 h-4 text-emerald-100 shrink-0" />
                    <span className="truncate">
                      {printedFileIds.size > 0 ? 'Print Again' : isIdCard ? 'Print ID Card' : 'Print Document'}
                    </span>
                  </>
                )}
              </button>

              {/* 2. Save to Device Button (Strictly Mobile Only) */}
              {isMobileDevice && (
                <button
                  type="button"
                  onClick={isMultiFile ? handleSaveAllToDevice : () => handleSaveToDevice()}
                  disabled={isPrinting || isVaporizing}
                  className="relative overflow-hidden w-full py-3 sm:py-3.5 px-4 rounded-xl font-bold text-slate-800 dark:text-zinc-200 text-xs sm:text-sm bg-slate-100 hover:bg-slate-200/80 dark:bg-zinc-800 dark:hover:bg-zinc-700/80 active:scale-[0.98] transition-all border border-slate-300/80 dark:border-zinc-700 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 min-h-[46px] touch-manipulation shadow-xs"
                >
                  <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="truncate">
                    {isMultiFile ? `Save All (${filesList.length})` : 'Save to Device'}
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Secondary Purge Button */}
          <button
            type="button"
            onClick={handleVaporizeNow}
            disabled={isVaporizing}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-500/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation min-h-[40px]"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Purge & Wipe RAM Buffer</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
