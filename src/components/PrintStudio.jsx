import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Printer, Flame, ShieldCheck, FileText, CreditCard, 
  Lock, Loader2, ArrowRight, Layers, SlidersHorizontal, Files, Check,
  FileArchive, FolderDown, Download
} from 'lucide-react';
import { useNullPin } from '../store/NullPinContext';
import { sound } from '../utils/sound';
import { fireVaporizeSparks } from './VaporizeEffect';
import { printFromRam } from '../utils/ramPrinter';

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

  const filesList = drop?.files && drop.files.length > 0
    ? drop.files
    : (drop?.file ? [drop.file] : []);
  const isMultiFile = filesList.length > 1;
  const totalBytes = filesList.reduce((acc, f) => acc + (f.size || 0), 0);

  const allAreZip = filesList.length > 0 && filesList.every(isZipFile);
  const isSingleZip = !isMultiFile && isZipFile(drop?.file);

  // Multi-file queue progress calculation
  const unprintedFiles = filesList.filter((f) => !printedFileIds.has(f.id || f.name));
  const nextTargetFile = unprintedFiles.length > 0 ? unprintedFiles[0] : filesList[0];
  const allFilesPrinted = filesList.length > 0 && filesList.every((f) => printedFileIds.has(f.id || f.name));
  const printedCount = filesList.filter((f) => printedFileIds.has(f.id || f.name)).length;

  // Auto-Burn sequence: initiates zero-trace RAM wipe once print/save completes
  const startAutoBurnSequence = useCallback((delayMs = 2000) => {
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
        startAutoBurnSequence(2000);
      }
      return nextSet;
    });
  }, [filesList, startAutoBurnSequence]);

  // Print individual file from manifest
  const handlePrintSingleFile = useCallback((fileObj) => {
    if (isZipFile(fileObj)) {
      handleSaveArchive(fileObj);
      return;
    }
    const fKey = fileObj.id || fileObj.name;
    setPrintingFileId(fKey);
    setIsPrinting(true);
    sound.printBeep();

    printFromRam({
      ...drop,
      file: fileObj,
      rawFile: fileObj.rawFile,
      blobUrl: fileObj.blobUrl,
    }, () => {
      setPrintingFileId(null);
      setIsPrinting(false);
      setPrintedFileIds((prev) => {
        const nextSet = new Set([...prev, fKey]);
        const allDone = filesList.length > 0 && filesList.every((f) => nextSet.has(f.id || f.name));
        if (allDone) {
          startAutoBurnSequence(2000);
        }
        return nextSet;
      });
    });
  }, [drop, handleSaveArchive, filesList, startAutoBurnSequence]);

  // Primary action button handler:
  // Handles single files, archives, and sequential queue execution for multi-file batches
  const handlePrint = useCallback(() => {
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
      printFromRam({
        ...drop,
        file: target,
        rawFile: target?.rawFile,
        blobUrl: target?.blobUrl,
      }, () => {
        setIsPrinting(false);
        const fKey = target?.id || target?.name || 'primary';
        setPrintedFileIds((prev) => new Set([...prev, fKey]));
        startAutoBurnSequence(2000);
      });
      return;
    }

    // For multi-file batches: direct user click dispatches next target file
    // Bypasses browser popup blocking and prevents stalled print queues
    const target = nextTargetFile;
    if (!target) return;
    handlePrintSingleFile(target);
  }, [drop, isSingleZip, allAreZip, isMultiFile, filesList, nextTargetFile, handlePrintSingleFile, handleSaveArchive, startAutoBurnSequence]);

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

  if (!drop) return null;

  const prefs = drop.prefs || {};
  const isIdCard = drop.mode === 'idcard';
  const fileName = drop.file?.name || (isIdCard ? 'National / Student ID Card' : 'Academic_Document.pdf');

  return (
    <div className="w-full max-w-[520px] mx-auto flex flex-col items-center py-1 select-none">
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
        className="w-full max-w-[520px] rounded-2xl sm:rounded-3xl bg-white/90 dark:bg-zinc-900/90 backdrop-blur-2xl 
                   border border-slate-200/90 dark:border-white/10 
                   shadow-[0_25px_60px_rgba(0,0,0,0.08)] dark:shadow-[0_25px_70px_rgba(0,0,0,0.6)]
                   overflow-hidden p-4 sm:p-5 space-y-3 sm:space-y-4"
      >
        {/* ================= 1. TERMINAL HEADER ================= */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-zinc-800/80">
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

                    <button
                      type="button"
                      onClick={() => handlePrintSingleFile(f)}
                      disabled={isItemPrinting}
                      className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 touch-manipulation min-h-[36px] ${
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
                          <span>Print File</span>
                        </>
                      )}
                    </button>
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
              : 'Zero-Disk Stream: Transferred directly to the local printer driver without saving to downloads.'}
          </span>
        </div>

        {/* ================= 4. ACTION BUTTONS ================= */}
        <div className="flex flex-col gap-2.5 pt-1">
          {isAutoBurning ? (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 sm:p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-500 animate-pulse shrink-0" />
                <span className="text-left">Print dispatched. Auto-purging RAM buffer in 2 seconds...</span>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-500 shrink-0 uppercase tracking-wider">
                AUTO-BURN
              </span>
            </motion.div>
          ) : printedFileIds.size > 0 && (
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

          {/* Primary Action Button (Print or Save ZIP) */}
          <button
            type="button"
            onClick={isAutoBurning ? handleVaporizeNow : handlePrint}
            disabled={isPrinting || isVaporizing}
            className={`relative overflow-hidden w-full py-3.5 sm:py-4 px-4 sm:px-6 rounded-2xl font-bold text-white text-xs sm:text-sm
                       active:scale-[0.98] transition-all flex items-center justify-center gap-2 sm:gap-2.5 cursor-pointer disabled:opacity-50 group min-h-[48px] touch-manipulation ${
                         isAutoBurning
                           ? 'bg-rose-500 hover:bg-rose-600 shadow-[0_10px_25px_rgba(244,63,94,0.35)] animate-pulse'
                           : 'bg-emerald-500 hover:bg-emerald-400 shadow-[0_10px_25px_rgba(16,185,129,0.3)]'
                       }`}
          >
            {/* Shimmer light sweep */}
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
            
            {isAutoBurning ? (
              <>
                <Flame className="w-4 h-4 animate-bounce text-white shrink-0" />
                <span className="truncate">Auto-Purging RAM Now (Click to Wipe Instantly)</span>
              </>
            ) : isPrinting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white shrink-0" />
                <span className="truncate">
                  {isMultiFile
                    ? `Spooling ${nextTargetFile?.name || 'File'} to Printer...`
                    : 'Spooling to Printer Driver...'}
                </span>
              </>
            ) : isSingleZip ? (
              <>
                <FolderDown className="w-4 h-4 text-emerald-100 shrink-0" />
                <span>Save ZIP Archive from RAM</span>
                <ArrowRight className="w-4 h-4 text-emerald-100 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </>
            ) : allAreZip ? (
              <>
                <FolderDown className="w-4 h-4 text-emerald-100 shrink-0" />
                <span className="truncate">
                  {allFilesPrinted
                    ? `All ${filesList.length} ZIPs Saved ✓ (Save Again)`
                    : `Save ZIP ${printedCount + 1} of ${filesList.length}: ${nextTargetFile?.name}`}
                </span>
                <ArrowRight className="w-4 h-4 text-emerald-100 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </>
            ) : isMultiFile ? (
              allFilesPrinted ? (
                <>
                  <Check className="w-4 h-4 text-emerald-100 shrink-0" />
                  <span className="truncate">All {filesList.length} Files Printed ✓ (Print Again?)</span>
                  <Printer className="w-4 h-4 text-emerald-100 ml-1 shrink-0" />
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4 text-emerald-100 shrink-0" />
                  <span className="truncate max-w-[140px] min-[380px]:max-w-[200px] sm:max-w-[320px]">
                    Print File {printedCount + 1} of {filesList.length}: {nextTargetFile?.name}
                  </span>
                  <ArrowRight className="w-4 h-4 text-emerald-100 group-hover:translate-x-0.5 transition-transform shrink-0" />
                </>
              )
            ) : (
              <>
                <Printer className="w-4 h-4 text-emerald-100 shrink-0" />
                <span>
                  {printedFileIds.size > 0
                    ? 'Print Again Direct from RAM'
                    : 'Print Direct from RAM'}
                </span>
                <ArrowRight className="w-4 h-4 text-emerald-100 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </>
            )}
          </button>

          {/* Secondary Purge Button */}
          <button
            type="button"
            onClick={handleVaporizeNow}
            disabled={isVaporizing}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-rose-500
                       hover:bg-rose-500/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation min-h-[44px]"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Purge & Wipe RAM Buffer</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
