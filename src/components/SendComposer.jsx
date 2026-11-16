import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, CreditCard, Upload, Minus, Plus,
  Sparkles, ArrowRight, X, AlertCircle, PlusCircle, Trash2, Files, Image as ImageIcon,
  FileArchive, Camera, Scissors, Loader2
} from 'lucide-react';
import { useNullPin } from '../store/NullPinContext';
import { sound } from '../utils/sound';
import { processImageWithAI, reprocessWithFilter } from '../utils/aiScanner';
import CameraScannerModal from './CameraScannerModal';

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
  const [frontPreview, setFrontPreview] = useState(null);
  const [frontOriginalFile, setFrontOriginalFile] = useState(null);
  const [frontOriginalDataUrl, setFrontOriginalDataUrl] = useState(null);
  const [frontBounds, setFrontBounds] = useState(null);
  const [frontAutoCrop, setFrontAutoCrop] = useState(true);
  const [frontAiMode, setFrontAiMode] = useState('magic');
  const [frontIsProcessing, setFrontIsProcessing] = useState(false);
  const frontInputRef = useRef(null);

  const [backFile, setBackFile] = useState(null);
  const [backBlobUrl, setBackBlobUrl] = useState(null);
  const [backPreview, setBackPreview] = useState(null);
  const [backOriginalFile, setBackOriginalFile] = useState(null);
  const [backOriginalDataUrl, setBackOriginalDataUrl] = useState(null);
  const [backBounds, setBackBounds] = useState(null);
  const [backAutoCrop, setBackAutoCrop] = useState(true);
  const [backAiMode, setBackAiMode] = useState('magic');
  const [backIsProcessing, setBackIsProcessing] = useState(false);
  const backInputRef = useRef(null);

  // In-App Camera Scanner Modal state
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [cameraModalMode, setCameraModalMode] = useState('idcard'); // 'idcard' | 'document'
  const [cameraTargetSide, setCameraTargetSide] = useState(null); // 'front' | 'back' | null

  // Validation feedback
  const [dropError, setDropError] = useState('');

  // Print controls
  const [colorMode, setColorMode] = useState('bw');
  const [sides, setSides] = useState('double');
  const [copies, setCopies] = useState(1);
  const [burnAfterPrint, setBurnAfterPrint] = useState(false);

  // Drag and drop handler
  const [dragOver, setDragOver] = useState(false);

  // Open camera scanner modal
  const openCamera = useCallback((scanMode = 'idcard', targetSide = null) => {
    sound.toggleSnap();
    setCameraModalMode(scanMode);
    setCameraTargetSide(targetSide);
    setCameraModalOpen(true);
  }, []);

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
        const entryId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const entry = {
          id: entryId,
          name: f.name,
          size: f.size,
          type: f.type || 'application/octet-stream',
          rawFile: f,
          blobUrl: url,
          preview: url,
          originalFile: f,
          originalDataUrl: null,
          aiMode: 'magic',
          bounds: null,
          isAiProcessed: false,
        };

        // Eagerly enhance image files with AI Clean in background
        if (f.type && f.type.startsWith('image/')) {
          processImageWithAI(f, { mode: 'magic', autoCrop: false, isIdCard: false })
            .then((aiRes) => {
              const aiBlobUrl = URL.createObjectURL(aiRes.processedFile);
              setFilesList((curr) =>
                curr.map((item) => {
                  if (item.id === entryId) {
                    return {
                      ...item,
                      rawFile: aiRes.processedFile,
                      blobUrl: aiBlobUrl,
                      preview: aiRes.processedDataUrl,
                      originalDataUrl: aiRes.originalDataUrl,
                      aiMode: 'magic',
                      bounds: aiRes.bounds,
                      isAiProcessed: true,
                    };
                  }
                  return item;
                })
              );
            })
            .catch((err) => {
              console.warn('[SendComposer] Document image AI enhancement notice:', err);
            });
        }

        return entry;
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

  // AI-process and assign ID card Front or Back side
  const processAndSetCardSide = useCallback(async (file, side) => {
    if (!file) return;
    if (side === 'front') {
      setFrontIsProcessing(true);
    } else {
      setBackIsProcessing(true);
    }
    sound.toggleSnap();

    try {
      const aiRes = await processImageWithAI(file, {
        mode: 'magic',
        autoCrop: true,
        isIdCard: true,
      });

      const blobUrl = URL.createObjectURL(aiRes.processedFile);

      if (side === 'front') {
        setFrontFile(aiRes.processedFile);
        setFrontBlobUrl(blobUrl);
        setFrontPreview(aiRes.processedDataUrl);
        setFrontOriginalFile(file);
        setFrontOriginalDataUrl(aiRes.originalDataUrl);
        setFrontBounds(aiRes.bounds);
        setFrontAutoCrop(aiRes.cropApplied);
        setFrontAiMode('magic');
        setFrontIsProcessing(false);
      } else {
        setBackFile(aiRes.processedFile);
        setBackBlobUrl(blobUrl);
        setBackPreview(aiRes.processedDataUrl);
        setBackOriginalFile(file);
        setBackOriginalDataUrl(aiRes.originalDataUrl);
        setBackBounds(aiRes.bounds);
        setBackAutoCrop(aiRes.cropApplied);
        setBackAiMode('magic');
        setBackIsProcessing(false);
      }
    } catch (err) {
      console.warn('[SendComposer] AI card processing fallback:', err);
      const rawUrl = URL.createObjectURL(file);
      if (side === 'front') {
        setFrontFile(file);
        setFrontBlobUrl(rawUrl);
        setFrontPreview(rawUrl);
        setFrontOriginalFile(file);
        setFrontIsProcessing(false);
      } else {
        setBackFile(file);
        setBackBlobUrl(rawUrl);
        setBackPreview(rawUrl);
        setBackOriginalFile(file);
        setBackIsProcessing(false);
      }
    }
  }, []);

  // ID Card upload handler from gallery/file picker
  const handleCardUpload = (e, side) => {
    const f = e.target.files?.[0];
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
      setDropError('');
      processAndSetCardSide(f, side);
    }
    e.target.value = '';
  };

  // Switch AI filter mode for ID Card side ('magic' | 'bw' | 'original')
  const handleFilterChange = useCallback(async (side, newMode) => {
    const origData = side === 'front' ? frontOriginalDataUrl : backOriginalDataUrl;
    const origFile = side === 'front' ? frontOriginalFile : backOriginalFile;
    const currentCrop = side === 'front' ? frontAutoCrop : backAutoCrop;
    const bounds = side === 'front' ? frontBounds : backBounds;

    if (!origData && !origFile) return;

    if (side === 'front') {
      setFrontIsProcessing(true);
      setFrontAiMode(newMode);
    } else {
      setBackIsProcessing(true);
      setBackAiMode(newMode);
    }

    sound.toggleSnap();
    try {
      const res = await reprocessWithFilter(origData || origFile, {
        mode: newMode,
        autoCrop: currentCrop,
        bounds,
        isIdCard: true,
        originalName: origFile?.name || 'idcard.jpg',
      });

      const newUrl = URL.createObjectURL(res.processedFile);
      if (side === 'front') {
        setFrontFile(res.processedFile);
        setFrontBlobUrl(newUrl);
        setFrontPreview(res.processedDataUrl);
        setFrontIsProcessing(false);
      } else {
        setBackFile(res.processedFile);
        setBackBlobUrl(newUrl);
        setBackPreview(res.processedDataUrl);
        setBackIsProcessing(false);
      }
    } catch (err) {
      console.warn('[SendComposer] Filter change failed:', err);
      if (side === 'front') setFrontIsProcessing(false);
      else setBackIsProcessing(false);
    }
  }, [frontOriginalDataUrl, backOriginalDataUrl, frontOriginalFile, backOriginalFile, frontAutoCrop, backAutoCrop, frontBounds, backBounds]);

  // Toggle Auto-Crop on/off for ID Card side
  const handleCropToggle = useCallback(async (side) => {
    const origData = side === 'front' ? frontOriginalDataUrl : backOriginalDataUrl;
    const origFile = side === 'front' ? frontOriginalFile : backOriginalFile;
    const currentMode = side === 'front' ? frontAiMode : backAiMode;
    const currentCrop = side === 'front' ? frontAutoCrop : backAutoCrop;
    const nextCrop = !currentCrop;
    const bounds = side === 'front' ? frontBounds : backBounds;

    if (!origData && !origFile) return;

    if (side === 'front') {
      setFrontIsProcessing(true);
      setFrontAutoCrop(nextCrop);
    } else {
      setBackIsProcessing(true);
      setBackAutoCrop(nextCrop);
    }

    sound.toggleSnap();
    try {
      const res = await reprocessWithFilter(origData || origFile, {
        mode: currentMode,
        autoCrop: nextCrop,
        bounds,
        isIdCard: true,
        originalName: origFile?.name || 'idcard.jpg',
      });

      const newUrl = URL.createObjectURL(res.processedFile);
      if (side === 'front') {
        setFrontFile(res.processedFile);
        setFrontBlobUrl(newUrl);
        setFrontPreview(res.processedDataUrl);
        setFrontIsProcessing(false);
      } else {
        setBackFile(res.processedFile);
        setBackBlobUrl(newUrl);
        setBackPreview(res.processedDataUrl);
        setBackIsProcessing(false);
      }
    } catch (err) {
      console.warn('[SendComposer] Crop toggle failed:', err);
      if (side === 'front') setFrontIsProcessing(false);
      else setBackIsProcessing(false);
    }
  }, [frontOriginalDataUrl, backOriginalDataUrl, frontOriginalFile, backOriginalFile, frontAiMode, backAiMode, frontAutoCrop, backAutoCrop, frontBounds, backBounds]);

  // Remove / clear ID Card side
  const handleClearCardSide = useCallback((e, side) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    sound.toggleSnap();
    if (side === 'front') {
      if (frontBlobUrl) {
        try { URL.revokeObjectURL(frontBlobUrl); } catch { }
      }
      setFrontFile(null);
      setFrontBlobUrl(null);
      setFrontPreview(null);
      setFrontOriginalFile(null);
      setFrontOriginalDataUrl(null);
      setFrontBounds(null);
      setFrontAutoCrop(true);
      setFrontAiMode('magic');
      setFrontIsProcessing(false);
    } else {
      if (backBlobUrl) {
        try { URL.revokeObjectURL(backBlobUrl); } catch { }
      }
      setBackFile(null);
      setBackBlobUrl(null);
      setBackPreview(null);
      setBackOriginalFile(null);
      setBackOriginalDataUrl(null);
      setBackBounds(null);
      setBackAutoCrop(true);
      setBackAiMode('magic');
      setBackIsProcessing(false);
    }
  }, [frontBlobUrl, backBlobUrl]);

  // Switch filter mode for document image item in Document list
  const handleDocImageFilterChange = useCallback(async (fileId, newMode) => {
    const target = filesList.find((f) => f.id === fileId);
    if (!target) return;

    sound.toggleSnap();
    try {
      const src = target.originalDataUrl || target.originalFile || target.rawFile;
      const res = await reprocessWithFilter(src, {
        mode: newMode,
        autoCrop: false,
        bounds: target.bounds,
        isIdCard: false,
        originalName: target.name,
      });

      const newBlobUrl = URL.createObjectURL(res.processedFile);
      setFilesList((prev) =>
        prev.map((item) => {
          if (item.id === fileId) {
            return {
              ...item,
              rawFile: res.processedFile,
              blobUrl: newBlobUrl,
              preview: res.processedDataUrl,
              aiMode: newMode,
            };
          }
          return item;
        })
      );
    } catch (err) {
      console.warn('[SendComposer] Doc image filter failed:', err);
    }
  }, [filesList]);

  // Handle capture from CameraScannerModal
  const handleCameraCapture = useCallback((capturedFile) => {
    if (cameraModalMode === 'idcard') {
      if (cameraTargetSide === 'front') {
        processAndSetCardSide(capturedFile, 'front');
      } else if (cameraTargetSide === 'back') {
        processAndSetCardSide(capturedFile, 'back');
      }
    } else {
      processIncomingFiles([capturedFile]);
    }
  }, [cameraModalMode, cameraTargetSide, processAndSetCardSide, processIncomingFiles]);

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
      <div className="flex justify-center mb-2 sm:mb-3 w-full px-1">
        <div className="relative inline-flex p-0.5 sm:p-1 rounded-full bg-slate-200/70 dark:bg-zinc-900/80 backdrop-blur-md border border-slate-300/60 dark:border-white/[0.08] shadow-xs">
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
                   shadow-[0_20px_50px_rgba(0,0,0,0.06)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] space-y-3 sm:space-y-4"
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
                className="flex flex-col items-center justify-center cursor-pointer py-7 sm:py-8 px-4"
              >
                <motion.div
                  animate={{ y: [0, -3, 0] }}
                  transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
                  className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-1.5 sm:mb-2 shrink-0"
                >
                  <Upload className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 dark:text-emerald-400" />
                </motion.div>
                <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-zinc-200 text-center whitespace-nowrap">
                  Drop Documents, Images, or ZIP
                </p>
                <p className="text-[10px] sm:text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5 text-center font-mono whitespace-nowrap">
                  Multi-file & ZIP • Strictly No Videos
                </p>

                <div className="mt-2.5 sm:mt-3 flex flex-wrap items-center justify-center gap-2">
                  <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-slate-100/80 dark:bg-zinc-800/60 text-[10px] sm:text-[11px] font-mono text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                    <span>Click or drag files</span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openCamera('document');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-[10px] sm:text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 transition-all cursor-pointer min-h-[28px] touch-manipulation"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>📷 Scan with Camera</span>
                  </button>
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
                        <div className="flex items-center gap-2 min-w-0 pr-1">
                          <span className="text-[10px] font-mono text-slate-400 w-4 text-center shrink-0">
                            {idx + 1}
                          </span>
                          {isZip ? (
                            <FileArchive className="w-4 h-4 text-emerald-500 shrink-0" />
                          ) : isImg ? (
                            <ImageIcon className="w-4 h-4 text-emerald-500 shrink-0" />
                          ) : (
                            <FileText className="w-4 h-4 text-emerald-500 shrink-0" />
                          )}
                          <span className="font-semibold text-slate-800 dark:text-zinc-200 truncate max-w-[110px] min-[380px]:max-w-[150px] sm:max-w-[200px]">
                            {f.name}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500 shrink-0">
                            {formatBytes(f.size)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* AI Magic Filter Toggle Pills for Image files */}
                          {isImg && (
                            <div className="inline-flex p-0.5 rounded-md bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700/60 text-[9px] font-medium shrink-0">
                              <button
                                type="button"
                                onClick={() => handleDocImageFilterChange(f.id, 'magic')}
                                className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                                  (f.aiMode || 'magic') === 'magic'
                                    ? 'bg-emerald-500 text-zinc-950 font-bold shadow-xs'
                                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
                                }`}
                                title="AI Magic Clean"
                              >
                                ✨ Magic
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDocImageFilterChange(f.id, 'bw')}
                                className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                                  f.aiMode === 'bw'
                                    ? 'bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-950 font-bold shadow-xs'
                                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
                                }`}
                                title="AI B&W Laser"
                              >
                                ⚫ B&W
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDocImageFilterChange(f.id, 'original')}
                                className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                                  f.aiMode === 'original'
                                    ? 'bg-slate-300 dark:bg-zinc-700 text-slate-900 dark:text-white font-bold shadow-xs'
                                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
                                }`}
                                title="Original Raw"
                              >
                                Raw
                              </button>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={(e) => handleRemoveFile(f.id, e)}
                            title="Remove file"
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Add more files row */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/60 dark:border-zinc-800">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-semibold text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
                    >
                      <PlusCircle className="w-3.5 h-3.5 text-emerald-500" />
                      <span>+ Add Files</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openCamera('document')}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-xs font-semibold text-emerald-600 dark:text-emerald-400 transition-colors cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>+ Camera Scan</span>
                    </button>
                  </div>

                  <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">
                    Max 15 files • 50 MB
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
                Auto-Centered A4 • AI Enhanced
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              {/* ================= FRONT SLOT ================= */}
              {!frontPreview ? (
                // Empty Front Slot
                <div className="relative flex flex-col items-center justify-center p-3.5 sm:p-4 rounded-2xl border border-dashed border-slate-300 dark:border-zinc-700 bg-slate-50/60 dark:bg-zinc-950/40 hover:border-emerald-500/60 transition-all text-center">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-1.5 text-emerald-600 dark:text-emerald-400">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 mb-0.5">Front Side</span>
                  <span className="text-[10px] text-slate-400 font-mono mb-2.5">Upload image or scan with camera</span>

                  <div className="flex items-center gap-1.5 w-full">
                    <button
                      type="button"
                      onClick={() => frontInputRef.current?.click()}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-slate-200/70 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-[11px] font-semibold transition-all cursor-pointer min-h-[32px] touch-manipulation"
                    >
                      <Upload className="w-3 h-3 text-slate-500 dark:text-zinc-400" />
                      <span>Upload</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openCamera('idcard', 'front')}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-[11px] font-bold shadow-xs transition-all cursor-pointer min-h-[32px] touch-manipulation"
                    >
                      <Camera className="w-3 h-3 text-zinc-950" />
                      <span>Camera</span>
                    </button>
                  </div>

                  <input
                    ref={frontInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleCardUpload(e, 'front')}
                    className="hidden"
                  />
                </div>
              ) : (
                // Filled Front Slot with AI Controls
                <div className="relative flex flex-col p-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.03] dark:bg-zinc-900/90 shadow-xs transition-all space-y-2">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-zinc-800">
                    <div className="flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">Front Side</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {frontIsProcessing && (
                        <span className="text-[10px] font-mono text-emerald-500 animate-pulse font-semibold flex items-center gap-1">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          <span>AI Processing...</span>
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleClearCardSide(e, 'front')}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Remove Front Side"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Image Preview */}
                  <div className="relative w-full aspect-[85.6/54] rounded-xl overflow-hidden bg-slate-100 dark:bg-zinc-950 flex items-center justify-center border border-slate-200/80 dark:border-zinc-800">
                    <img src={frontPreview} alt="Front" className="w-full h-full object-contain" />
                  </div>

                  {/* AI Controls: Filter & Auto-Crop */}
                  <div className="flex flex-wrap items-center justify-between gap-1 pt-0.5">
                    {/* Filter Pills */}
                    <div className="inline-flex p-0.5 rounded-lg bg-slate-100 dark:bg-zinc-800/80 text-[10px] font-medium border border-slate-200 dark:border-zinc-700/60">
                      <button
                        type="button"
                        onClick={() => handleFilterChange('front', 'magic')}
                        className={`px-1.5 py-0.5 rounded-md transition-all cursor-pointer ${
                          frontAiMode === 'magic'
                            ? 'bg-emerald-500 text-zinc-950 font-bold shadow-xs'
                            : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                        }`}
                      >
                        ✨ Magic
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFilterChange('front', 'bw')}
                        className={`px-1.5 py-0.5 rounded-md transition-all cursor-pointer ${
                          frontAiMode === 'bw'
                            ? 'bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-950 font-bold shadow-xs'
                            : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                        }`}
                      >
                        ⚫ B&W
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFilterChange('front', 'original')}
                        className={`px-1.5 py-0.5 rounded-md transition-all cursor-pointer ${
                          frontAiMode === 'original'
                            ? 'bg-slate-300 dark:bg-zinc-700 text-slate-900 dark:text-white font-bold shadow-xs'
                            : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                        }`}
                      >
                        Raw
                      </button>
                    </div>

                    {/* Auto-Crop Toggle Pill */}
                    <button
                      type="button"
                      onClick={() => handleCropToggle('front')}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer border ${
                        frontAutoCrop
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                          : 'bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-400 dark:text-zinc-500'
                      }`}
                      title="Toggle AI Auto-Crop"
                    >
                      <Scissors className="w-2.5 h-2.5" />
                      <span>{frontAutoCrop ? 'Cropped' : 'Full'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ================= BACK SLOT ================= */}
              {!backPreview ? (
                // Empty Back Slot
                <div className="relative flex flex-col items-center justify-center p-3.5 sm:p-4 rounded-2xl border border-dashed border-slate-300 dark:border-zinc-700 bg-slate-50/60 dark:bg-zinc-950/40 hover:border-emerald-500/60 transition-all text-center">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-1.5 text-emerald-600 dark:text-emerald-400">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 mb-0.5">Back Side</span>
                  <span className="text-[10px] text-slate-400 font-mono mb-2.5">Upload image or scan with camera</span>

                  <div className="flex items-center gap-1.5 w-full">
                    <button
                      type="button"
                      onClick={() => backInputRef.current?.click()}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-slate-200/70 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-[11px] font-semibold transition-all cursor-pointer min-h-[32px] touch-manipulation"
                    >
                      <Upload className="w-3 h-3 text-slate-500 dark:text-zinc-400" />
                      <span>Upload</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openCamera('idcard', 'back')}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-[11px] font-bold shadow-xs transition-all cursor-pointer min-h-[32px] touch-manipulation"
                    >
                      <Camera className="w-3 h-3 text-zinc-950" />
                      <span>Camera</span>
                    </button>
                  </div>

                  <input
                    ref={backInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleCardUpload(e, 'back')}
                    className="hidden"
                  />
                </div>
              ) : (
                // Filled Back Slot with AI Controls
                <div className="relative flex flex-col p-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.03] dark:bg-zinc-900/90 shadow-xs transition-all space-y-2">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-zinc-800">
                    <div className="flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">Back Side</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {backIsProcessing && (
                        <span className="text-[10px] font-mono text-emerald-500 animate-pulse font-semibold flex items-center gap-1">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          <span>AI Processing...</span>
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleClearCardSide(e, 'back')}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Remove Back Side"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Image Preview */}
                  <div className="relative w-full aspect-[85.6/54] rounded-xl overflow-hidden bg-slate-100 dark:bg-zinc-950 flex items-center justify-center border border-slate-200/80 dark:border-zinc-800">
                    <img src={backPreview} alt="Back" className="w-full h-full object-contain" />
                  </div>

                  {/* AI Controls: Filter & Auto-Crop */}
                  <div className="flex flex-wrap items-center justify-between gap-1 pt-0.5">
                    {/* Filter Pills */}
                    <div className="inline-flex p-0.5 rounded-lg bg-slate-100 dark:bg-zinc-800/80 text-[10px] font-medium border border-slate-200 dark:border-zinc-700/60">
                      <button
                        type="button"
                        onClick={() => handleFilterChange('back', 'magic')}
                        className={`px-1.5 py-0.5 rounded-md transition-all cursor-pointer ${
                          backAiMode === 'magic'
                            ? 'bg-emerald-500 text-zinc-950 font-bold shadow-xs'
                            : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                        }`}
                      >
                        ✨ Magic
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFilterChange('back', 'bw')}
                        className={`px-1.5 py-0.5 rounded-md transition-all cursor-pointer ${
                          backAiMode === 'bw'
                            ? 'bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-950 font-bold shadow-xs'
                            : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                        }`}
                      >
                        ⚫ B&W
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFilterChange('back', 'original')}
                        className={`px-1.5 py-0.5 rounded-md transition-all cursor-pointer ${
                          backAiMode === 'original'
                            ? 'bg-slate-300 dark:bg-zinc-700 text-slate-900 dark:text-white font-bold shadow-xs'
                            : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                        }`}
                      >
                        Raw
                      </button>
                    </div>

                    {/* Auto-Crop Toggle Pill */}
                    <button
                      type="button"
                      onClick={() => handleCropToggle('back')}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer border ${
                        backAutoCrop
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                          : 'bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-400 dark:text-zinc-500'
                      }`}
                      title="Toggle AI Auto-Crop"
                    >
                      <Scissors className="w-2.5 h-2.5" />
                      <span>{backAutoCrop ? 'Cropped' : 'Full'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= PRINT CONTROLS ================= */}
        <div className="pt-2.5 sm:pt-3 border-t border-slate-100 dark:border-zinc-800/80 space-y-2.5 sm:space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 items-center">
            {/* Color Toggle */}
            <div className="col-span-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 opacity-75 text-zinc-600 dark:text-zinc-400 block select-none">
                Color
              </span>
              <div className="relative flex p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-white/10 h-11 items-center">
                <button
                  type="button"
                  onClick={() => { sound.toggleSnap(); setColorMode('bw'); }}
                  className={`relative z-10 flex-1 h-full rounded-lg text-xs sm:text-[13px] font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap flex items-center justify-center touch-manipulation select-none ${
                    colorMode === 'bw'
                      ? 'text-zinc-900 dark:text-white'
                      : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                  }`}
                >
                  {colorMode === 'bw' && (
                    <motion.div
                      layoutId="printColorPill"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      className="absolute inset-0 rounded-lg bg-white dark:bg-zinc-800 shadow-sm border border-zinc-200/60 dark:border-white/10"
                    />
                  )}
                  <span className="relative z-10 whitespace-nowrap">B&W</span>
                </button>
                <button
                  type="button"
                  onClick={() => { sound.toggleSnap(); setColorMode('color'); }}
                  className={`relative z-10 flex-1 h-full rounded-lg text-xs sm:text-[13px] font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap flex items-center justify-center touch-manipulation select-none ${
                    colorMode === 'color'
                      ? 'text-zinc-900 dark:text-white'
                      : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                  }`}
                >
                  {colorMode === 'color' && (
                    <motion.div
                      layoutId="printColorPill"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      className="absolute inset-0 rounded-lg bg-white dark:bg-zinc-800 shadow-sm border border-zinc-200/60 dark:border-white/10"
                    />
                  )}
                  <span className="relative z-10 whitespace-nowrap">Color</span>
                </button>
              </div>
            </div>

            {/* Sides / Duplex */}
            <div className="col-span-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 opacity-75 text-zinc-600 dark:text-zinc-400 block select-none">
                Sides
              </span>
              <div className="relative flex p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-white/10 h-11 items-center">
                <button
                  type="button"
                  onClick={() => { sound.toggleSnap(); setSides('single'); }}
                  className={`relative z-10 flex-1 h-full rounded-lg text-xs sm:text-[13px] font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap flex items-center justify-center touch-manipulation select-none ${
                    sides === 'single'
                      ? 'text-zinc-900 dark:text-white'
                      : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                  }`}
                >
                  {sides === 'single' && (
                    <motion.div
                      layoutId="printSidesPill"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      className="absolute inset-0 rounded-lg bg-white dark:bg-zinc-800 shadow-sm border border-zinc-200/60 dark:border-white/10"
                    />
                  )}
                  <span className="relative z-10 whitespace-nowrap">1-Sided</span>
                </button>
                <button
                  type="button"
                  onClick={() => { sound.toggleSnap(); setSides('double'); }}
                  className={`relative z-10 flex-1 h-full rounded-lg text-xs sm:text-[13px] font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap flex items-center justify-center touch-manipulation select-none ${
                    sides === 'double'
                      ? 'text-zinc-900 dark:text-white'
                      : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                  }`}
                >
                  {sides === 'double' && (
                    <motion.div
                      layoutId="printSidesPill"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      className="absolute inset-0 rounded-lg bg-white dark:bg-zinc-800 shadow-sm border border-zinc-200/60 dark:border-white/10"
                    />
                  )}
                  <span className="relative z-10 whitespace-nowrap">2-Sided</span>
                </button>
              </div>
            </div>

            {/* Copies Counter */}
            <div className="col-span-2 sm:col-span-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 opacity-75 text-zinc-600 dark:text-zinc-400 block select-none">
                Copies
              </span>
              <div className="relative flex items-center justify-between p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-white/10 h-11">
                <button
                  type="button"
                  onClick={() => { sound.toggleSnap(); setCopies(Math.max(1, copies - 1)); }}
                  className="w-10 sm:w-9 h-full rounded-lg bg-white hover:bg-zinc-50 text-zinc-900 shadow-sm border border-zinc-200/60 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-white dark:border-white/10 flex items-center justify-center cursor-pointer touch-manipulation active:scale-95 transition-all shrink-0"
                  aria-label="Decrease copies"
                >
                  <Minus className="w-4 h-4 stroke-[2.5]" />
                </button>
                <span className="font-mono font-bold text-sm tabular-nums text-zinc-900 dark:text-zinc-100 px-2 select-none">
                  {copies}
                </span>
                <button
                  type="button"
                  onClick={() => { sound.toggleSnap(); setCopies(Math.min(20, copies + 1)); }}
                  className="w-10 sm:w-9 h-full rounded-lg bg-white hover:bg-zinc-50 text-zinc-900 shadow-sm border border-zinc-200/60 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-white dark:border-white/10 flex items-center justify-center cursor-pointer touch-manipulation active:scale-95 transition-all shrink-0"
                  aria-label="Increase copies"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
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
          className="relative overflow-hidden w-full h-12 rounded-xl font-bold text-zinc-950 text-sm sm:text-base
                     bg-emerald-500 hover:bg-emerald-400
                     shadow-lg shadow-emerald-500/20
                     flex items-center justify-center gap-2 cursor-pointer transition-all group shrink-0 whitespace-nowrap select-none"
        >
          {/* Shimmer light sweep */}
          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />
          <Sparkles className="w-4 h-4 text-zinc-950 relative z-10 shrink-0" />
          <span className="relative z-10">Generate 4-Digit PIN</span>
          <ArrowRight className="w-4 h-4 text-zinc-950 relative z-10 group-hover:translate-x-0.5 transition-transform shrink-0" />
        </motion.button>
      </motion.div>

      {/* ================= LIVE AI CAMERA SCANNER MODAL ================= */}
      <CameraScannerModal
        isOpen={cameraModalOpen}
        onClose={() => setCameraModalOpen(false)}
        onCapture={handleCameraCapture}
        mode={cameraModalMode}
        title={
          cameraModalMode === 'idcard'
            ? cameraTargetSide === 'front'
              ? 'Scan ID Card Front'
              : 'Scan ID Card Back'
            : 'Scan Document Page'
        }
      />
    </div>
  );
}
