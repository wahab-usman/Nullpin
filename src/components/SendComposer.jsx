import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, CreditCard, Upload, Minus, Plus,
  Sparkles, ArrowRight, X, AlertCircle, PlusCircle, Trash2, Files, Image as ImageIcon,
  FileArchive
} from 'lucide-react';
import { useNullPin } from '../store/NullPinContext';
import { sound } from '../utils/sound';

const MODES = [
  { key: 'doc', label: 'Document', icon: FileText },
  { key: 'idcard', label: 'ID Card A4', icon: CreditCard },
];

const MAX_FILES_LIMIT = 15;
const MAX_SINGLE_FILE_BYTES = 25 * 1024 * 1024; // 25 MB
const MAX_TOTAL_PAYLOAD_BYTES = 50 * 1024 * 1024; // 50 MB

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function isVideoFile(file) {
  if (!file) return false;
  if (file.type && file.type.toLowerCase().startsWith('video/')) return true;
  const name = file.name || '';
  return /\.(mp4|mov|avi|mkv|webm|flv|wmv|m4v|3gp|ogv|mpg|mpeg|ts|m4p)$/i.test(name);
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

export default function SendComposer() {
  const { createDrop } = useNullPin();

  // Mode: 'doc' | 'idcard'
  const [mode, setMode] = useState('doc');

  // Multi-file state for Document mode
  const [filesList, setFilesList] = useState([]);
  const fileInputRef = useRef(null);

  // ID Card states
  const [frontFile, setFrontFile] = useState(null);
  const [frontBlobUrl, setFrontBlobUrl] = useState(null);
  const [backFile, setBackFile] = useState(null);
  const [backBlobUrl, setBackBlobUrl] = useState(null);
  const [frontPreview, setFrontPreview] = useState(null);
  const [backPreview, setBackPreview] = useState(null);

  // Validation feedback
  const [dropError, setDropError] = useState('');

  // Print controls
  const [colorMode, setColorMode] = useState('bw');
  const [sides, setSides] = useState('double');
  const [copies, setCopies] = useState(1);
  const [burnAfterPrint, setBurnAfterPrint] = useState(false);

  // Drag and drop handler
  const [dragOver, setDragOver] = useState(false);

  // Process incoming files from file picker or drag-and-drop with pre-flight bounds
  const processIncomingFiles = useCallback((rawIncomingFiles) => {
    if (!rawIncomingFiles || rawIncomingFiles.length === 0) return;
    const filesArray = Array.from(rawIncomingFiles);

    // 1. Strictly block video files
    const videoFiles = filesArray.filter(isVideoFile);
    if (videoFiles.length > 0) {
      sound.vaporize();
      const sampleNames = videoFiles.map((v) => v.name).slice(0, 2).join(', ');
      setDropError(
        `Video files are not allowed (${sampleNames}${videoFiles.length > 2 ? '...' : ''}). Only documents and images can be printed.`
      );
      setTimeout(() => setDropError(''), 4500);
    }

    // 2. Accept only valid non-video files
    const validFiles = filesArray.filter((f) => !isVideoFile(f));
    if (validFiles.length === 0) return;

    // 3. Pre-flight check: Max single file size (25 MB)
    const oversizedFiles = validFiles.filter((f) => (f.size || 0) > MAX_SINGLE_FILE_BYTES);
    if (oversizedFiles.length > 0) {
      sound.vaporize();
      setDropError(
        `"${oversizedFiles[0].name}" exceeds the 25 MB limit. Please compress or remove large files.`
      );
      setTimeout(() => setDropError(''), 4500);
    }
    const sizeCompliantFiles = validFiles.filter((f) => (f.size || 0) <= MAX_SINGLE_FILE_BYTES);
    if (sizeCompliantFiles.length === 0) return;

    setFilesList((prev) => {
      // 4. Pre-flight check: Max file count (15 files)
      const currentCount = prev.length;
      const availableSlots = Math.max(0, MAX_FILES_LIMIT - currentCount);
      if (sizeCompliantFiles.length > availableSlots) {
        sound.vaporize();
        setDropError(`Maximum ${MAX_FILES_LIMIT} files allowed per drop. Excess files were omitted.`);
        setTimeout(() => setDropError(''), 4500);
      }
      const countCompliantFiles = sizeCompliantFiles.slice(0, availableSlots);
      if (countCompliantFiles.length === 0) return prev;

      // 5. Pre-flight check: Max total payload size (50 MB)
      let runningTotal = prev.reduce((acc, f) => acc + (f.size || 0), 0);
      const finalAccepted = [];

      for (const f of countCompliantFiles) {
        if (runningTotal + (f.size || 0) <= MAX_TOTAL_PAYLOAD_BYTES) {
          runningTotal += (f.size || 0);
          finalAccepted.push(f);
        } else {
          sound.vaporize();
          setDropError('Total payload exceeds the 50 MB limit. Remaining files were omitted.');
          setTimeout(() => setDropError(''), 4500);
          break;
        }
      }

      if (finalAccepted.length === 0) return prev;

      sound.toggleSnap();
      if (videoFiles.length === 0 && oversizedFiles.length === 0) setDropError('');

      const newEntries = finalAccepted.map((f) => {
        const url = URL.createObjectURL(f);
        return {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          name: f.name,
          size: f.size,
          type: f.type || 'application/octet-stream',
          rawFile: f,
          blobUrl: url,
        };
      });

      return [...prev, ...newEntries];
    });
  }, []);

  const handleFileDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer && e.dataTransfer.files) {
      processIncomingFiles(e.dataTransfer.files);
    }
  }, [processIncomingFiles]);

  const handleFileInput = useCallback((e) => {
    if (e.target && e.target.files) {
      processIncomingFiles(e.target.files);
      e.target.value = '';
    }
  }, [processIncomingFiles]);

  // Remove single file from the multi-file list
  const handleRemoveFile = useCallback((idToRemove, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    sound.toggleSnap();
    setFilesList((prev) => {
      const target = prev.find((f) => f.id === idToRemove);
      if (target?.blobUrl) {
        try { URL.revokeObjectURL(target.blobUrl); } catch { }
      }
      return prev.filter((f) => f.id !== idToRemove);
    });
  }, []);

  // Clear all attached files
  const handleClearAllFiles = useCallback((e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    sound.toggleSnap();
    filesList.forEach((f) => {
      if (f.blobUrl) {
        try { URL.revokeObjectURL(f.blobUrl); } catch { }
      }
    });
    setFilesList([]);
  }, [filesList]);

  // ID Card upload handlers
  const handleCardUpload = (e, side) => {
    const f = e.target.files[0];
    if (f) {
      if (isVideoFile(f)) {
        sound.vaporize();
        setDropError('Video files are not allowed. Please upload an image (PNG, JPG) for the ID card.');
        setTimeout(() => setDropError(''), 4000);
        return;
      }
      if (f.size > MAX_SINGLE_FILE_BYTES) {
        sound.vaporize();
        setDropError('ID card image exceeds 25 MB limit. Please compress before uploading.');
        setTimeout(() => setDropError(''), 4000);
        return;
      }
      sound.toggleSnap();
      setDropError('');
      const objectUrl = URL.createObjectURL(f);
      if (side === 'front') {
        setFrontFile(f);
        setFrontBlobUrl(objectUrl);
        setFrontPreview(objectUrl);
      } else {
        setBackFile(f);
        setBackBlobUrl(objectUrl);
        setBackPreview(objectUrl);
      }
    }
  };

  const handleClearCardSide = (e, side) => {
    e.preventDefault();
    e.stopPropagation();
    sound.toggleSnap();
    if (side === 'front') {
      if (frontBlobUrl) {
        try { URL.revokeObjectURL(frontBlobUrl); } catch { }
      }
      setFrontFile(null);
      setFrontBlobUrl(null);
      setFrontPreview(null);
    } else {
      if (backBlobUrl) {
        try { URL.revokeObjectURL(backBlobUrl); } catch { }
      }
      setBackFile(null);
      setBackBlobUrl(null);
      setBackPreview(null);
    }
  };

  const totalFilesSize = filesList.reduce((acc, f) => acc + (f.size || 0), 0);

  const handleGenerate = () => {
    // Validation: Require real file input
    if (mode === 'doc' && filesList.length === 0) {
      sound.vaporize();
      setDropError('Please drop or select at least one document or image.');
      setTimeout(() => setDropError(''), 3500);
      return;
    }

    if (mode === 'idcard' && !frontPreview && !backPreview) {
      sound.vaporize();
      setDropError('Please upload at least the Front side of the ID card.');
      setTimeout(() => setDropError(''), 3500);
      return;
    }

    setDropError('');
    sound.printBeep();

    createDrop({
      mode,
      file: filesList[0] || null,
      files: filesList,
      rawFiles: filesList.map((f) => f.rawFile),
      rawFile: filesList[0]?.rawFile || null,
      blobUrl: filesList[0]?.blobUrl || null,
      frontFile,
      frontBlobUrl,
      backFile,
      backBlobUrl,
      frontPreview,
      backPreview,
      colorMode,
      sides,
      copies,
      burnAfterPrint,
    });
  };

  return (
    <div className="w-full max-w-[500px] mx-auto flex flex-col items-center">
      {/* ================= 1. SLIDING PILL TABS ================= */}
      <div className="flex justify-center mb-2.5 sm:mb-3.5 w-full px-1">
        <div className="relative inline-flex p-1 rounded-full bg-slate-200/70 dark:bg-zinc-900/80 backdrop-blur-md border border-slate-300/60 dark:border-white/[0.08] shadow-sm">
          {MODES.map((m) => {
            const Icon = m.icon;
            const isActive = mode === m.key;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => {
                  sound.toggleSnap();
                  setMode(m.key);
                  setDropError('');
                  if (m.key === 'idcard') {
                    setColorMode('color');
                    setSides('single');
                  }
                }}
                className={`relative z-10 flex items-center justify-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${isActive
                    ? 'text-slate-900 dark:text-white'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                  }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="contentModePill"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className="absolute inset-0 rounded-full bg-white dark:bg-zinc-800 shadow-sm border border-slate-200 dark:border-zinc-700/60"
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5 whitespace-nowrap">
                  <Icon className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>{m.label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ================= 2. WORKSPACE CARD ================= */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="w-full max-w-[500px] rounded-2xl sm:rounded-3xl p-4 sm:p-5 bg-white/80 dark:bg-zinc-900/75 backdrop-blur-xl 
                   border border-slate-200/90 dark:border-white/10 
                   shadow-[0_20px_50px_rgba(0,0,0,0.06)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] space-y-3 sm:space-y-3.5"
      >
        {/* ================= MULTI-FILE DOCUMENT DROPZONE ================= */}
        {mode === 'doc' && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleFileDrop}
            className={`relative flex flex-col rounded-2xl border-2 border-dashed transition-all ${dragOver
                ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                : filesList.length > 0
                  ? 'border-emerald-500/40 bg-emerald-500/[0.03] dark:bg-emerald-950/20 p-3 sm:p-4'
                  : 'border-slate-300 dark:border-zinc-700 bg-slate-50/60 dark:bg-zinc-950/40 hover:border-emerald-500/60 hover:shadow-[0_0_15px_rgba(16,185,129,0.08)]'
              }`}
          >
            {filesList.length === 0 ? (
              // Empty Dropzone Prompt
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center cursor-pointer py-6 sm:py-7 px-4"
              >
                <motion.div
                  animate={{ y: [0, -3, 0] }}
                  transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-2 shrink-0"
                >
                  <Upload className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </motion.div>
                <p className="text-sm font-bold text-slate-800 dark:text-zinc-200 text-center whitespace-nowrap">
                  Drop Documents, Images, or ZIP
                </p>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5 text-center font-mono whitespace-nowrap">
                  Multi-file & ZIP • Strictly No Videos
                </p>

                <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100/80 dark:bg-zinc-800/60 text-[11px] font-mono text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                  <span>Click or drag to select files</span>
                </div>
              </div>
            ) : (
              // Multi-File Selected List View
              <div className="w-full flex flex-col space-y-3">
                {/* Header info */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/70 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Files className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                        {filesList.length} {filesList.length === 1 ? 'File' : 'Files'} Attached
                      </span>
                      <span className="text-[11px] font-mono text-slate-400 dark:text-zinc-500 ml-1.5">
                        ({formatBytes(totalFilesSize)})
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleClearAllFiles}
                    className="text-[11px] font-mono font-semibold text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer px-2 py-0.5 rounded-md hover:bg-rose-500/10"
                  >
                    Clear All
                  </button>
                </div>

                {/* Scrollable File List */}
                <div className="max-h-40 overflow-y-auto pr-1 space-y-1.5 custom-scrollbar">
                  {filesList.map((f, idx) => {
                    const isImg = f.type.startsWith('image/');
                    const isZip = isZipFile(f);
                    return (
                      <motion.div
                        key={f.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="group flex items-center justify-between p-2 rounded-xl bg-white/90 dark:bg-zinc-800/80 border border-slate-200/80 dark:border-zinc-700/60 text-xs shadow-xs hover:border-emerald-500/40 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-[10px] font-mono text-slate-400 w-4 text-center">
                            {idx + 1}
                          </span>
                          {isZip ? (
                            <FileArchive className="w-4 h-4 text-emerald-500 shrink-0" />
                          ) : isImg ? (
                            <ImageIcon className="w-4 h-4 text-emerald-500 shrink-0" />
                          ) : (
                            <FileText className="w-4 h-4 text-emerald-500 shrink-0" />
                          )}
                          <span className="font-semibold text-slate-800 dark:text-zinc-200 truncate max-w-[130px] min-[380px]:max-w-[190px] sm:max-w-[270px]">
                            {f.name}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500 shrink-0">
                            {formatBytes(f.size)}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => handleRemoveFile(f.id, e)}
                          title="Remove file"
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Add more files row */}
                <div className="pt-2 flex items-center justify-between border-t border-slate-200/60 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-semibold text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-emerald-500" />
                    <span>+ Add More Files / ZIP</span>
                  </button>
                  <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">
                    Or drop more files anywhere
                  </span>
                </div>
              </div>
            )}

            {/* Hidden multi-file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileInput}
              className="hidden"
              accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg,.xlsx,.xls,.pptx,.ppt,.zip"
            />
          </div>
        )}

        {/* ================= ID CARD UPLOAD SLOTS ================= */}
        {mode === 'idcard' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                Front & Back A4 Merger
              </span>
              <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                Auto-Centered A4
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              {/* Front Slot */}
              <label className="relative flex flex-col items-center justify-center p-4 rounded-2xl border border-dashed border-slate-300 dark:border-zinc-700 bg-slate-50/60 dark:bg-zinc-950/40 hover:border-emerald-500 transition-colors cursor-pointer">
                <div className="relative w-12 h-12 rounded-xl bg-slate-200 dark:bg-zinc-800 overflow-hidden mb-1.5 flex items-center justify-center">
                  {frontPreview ? (
                    <>
                      <img src={frontPreview} alt="Front" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={(e) => handleClearCardSide(e, 'front')}
                        className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/60 text-white hover:bg-rose-500 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <Upload className="w-5 h-5 text-slate-400" />
                  )}
                </div>
                <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Front Side</span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {frontPreview ? 'Change Image' : 'Click to Upload'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleCardUpload(e, 'front')}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </label>

              {/* Back Slot */}
              <label className="relative flex flex-col items-center justify-center p-4 rounded-2xl border border-dashed border-slate-300 dark:border-zinc-700 bg-slate-50/60 dark:bg-zinc-950/40 hover:border-emerald-500 transition-colors cursor-pointer">
                <div className="relative w-12 h-12 rounded-xl bg-slate-200 dark:bg-zinc-800 overflow-hidden mb-1.5 flex items-center justify-center">
                  {backPreview ? (
                    <>
                      <img src={backPreview} alt="Back" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={(e) => handleClearCardSide(e, 'back')}
                        className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/60 text-white hover:bg-rose-500 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <Upload className="w-5 h-5 text-slate-400" />
                  )}
                </div>
                <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Back Side</span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {backPreview ? 'Change Image' : 'Click to Upload'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleCardUpload(e, 'back')}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </label>
            </div>
          </div>
        )}

        {/* ================= PRINT CONTROLS ================= */}
        <div className="pt-2.5 border-t border-slate-100 dark:border-zinc-800/80 space-y-2.5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 items-center">
            {/* Color Toggle */}
            <div>
              <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 block mb-1">Color</span>
              <div className="relative flex p-0.5 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 h-10 items-center">
                <button
                  type="button"
                  onClick={() => { sound.toggleSnap(); setColorMode('bw'); }}
                  className={`relative z-10 flex-1 h-full rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center ${colorMode === 'bw' ? 'text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  {colorMode === 'bw' && (
                    <motion.div
                      layoutId="printColorPill"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      className="absolute inset-0 rounded-lg bg-white dark:bg-zinc-700 shadow-xs"
                    />
                  )}
                  <span className="relative z-10 whitespace-nowrap">B&W</span>
                </button>
                <button
                  type="button"
                  onClick={() => { sound.toggleSnap(); setColorMode('color'); }}
                  className={`relative z-10 flex-1 h-full rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center ${colorMode === 'color' ? 'text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  {colorMode === 'color' && (
                    <motion.div
                      layoutId="printColorPill"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      className="absolute inset-0 rounded-lg bg-white dark:bg-zinc-700 shadow-xs"
                    />
                  )}
                  <span className="relative z-10 whitespace-nowrap">Color</span>
                </button>
              </div>
            </div>

            {/* Sides / Duplex */}
            <div>
              <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 block mb-1">Sides</span>
              <div className="relative flex p-0.5 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 h-10 items-center">
                <button
                  type="button"
                  onClick={() => { sound.toggleSnap(); setSides('single'); }}
                  className={`relative z-10 flex-1 h-full rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center ${sides === 'single' ? 'text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  {sides === 'single' && (
                    <motion.div
                      layoutId="printSidesPill"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      className="absolute inset-0 rounded-lg bg-white dark:bg-zinc-700 shadow-xs"
                    />
                  )}
                  <span className="relative z-10 whitespace-nowrap">1-Sided</span>
                </button>
                <button
                  type="button"
                  onClick={() => { sound.toggleSnap(); setSides('double'); }}
                  className={`relative z-10 flex-1 h-full rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center ${sides === 'double' ? 'text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  {sides === 'double' && (
                    <motion.div
                      layoutId="printSidesPill"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      className="absolute inset-0 rounded-lg bg-white dark:bg-zinc-700 shadow-xs"
                    />
                  )}
                  <span className="relative z-10 whitespace-nowrap">2-Sided</span>
                </button>
              </div>
            </div>

            {/* Copies Counter - Mobile: col-span-2, Desktop: col-span-1 */}
            <div className="col-span-2 sm:col-span-1">
              <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 block mb-1">Copies</span>
              <div className="flex items-center justify-between p-1 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 h-10">
                <button
                  type="button"
                  onClick={() => { sound.toggleSnap(); setCopies(Math.max(1, copies - 1)); }}
                  className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-700 flex items-center justify-center text-slate-700 dark:text-zinc-200 shadow-xs cursor-pointer touch-manipulation hover:bg-slate-50 dark:hover:bg-zinc-600 transition-colors shrink-0"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono font-bold text-xs text-slate-900 dark:text-zinc-100 px-2 select-none">
                  {copies}
                </span>
                <button
                  type="button"
                  onClick={() => { sound.toggleSnap(); setCopies(Math.min(20, copies + 1)); }}
                  className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-700 flex items-center justify-center text-slate-700 dark:text-zinc-200 shadow-xs cursor-pointer touch-manipulation hover:bg-slate-50 dark:hover:bg-zinc-600 transition-colors shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Validation error feedback */}
        <AnimatePresence>
          {dropError && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-500 text-xs font-semibold flex items-center justify-center gap-1.5"
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{dropError}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ================= PRIMARY CTA ================= */}
        <motion.button
          type="button"
          onClick={handleGenerate}
          whileHover={{ scale: 1.012, y: -1 }}
          whileTap={{ scale: 0.98 }}
          className="relative overflow-hidden w-full h-11 sm:h-12 rounded-xl sm:rounded-2xl font-bold text-white text-xs sm:text-sm
                     bg-emerald-500 hover:bg-emerald-400
                     shadow-[0_8px_20px_rgba(16,185,129,0.28)]
                     flex items-center justify-center gap-2 cursor-pointer transition-all group shrink-0 whitespace-nowrap"
        >
          {/* Shimmer light sweep */}
          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />
          <Sparkles className="w-4 h-4 text-emerald-100 relative z-10 shrink-0" />
          <span className="relative z-10">Generate 4-Digit PIN</span>
          <ArrowRight className="w-4 h-4 relative z-10 group-hover:translate-x-0.5 transition-transform shrink-0" />
        </motion.button>
      </motion.div>
    </div>
  );
}
