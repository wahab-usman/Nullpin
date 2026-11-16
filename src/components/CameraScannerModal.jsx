import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, X, RefreshCw, Zap, ZapOff, Sparkles, AlertCircle } from 'lucide-react';
import { sound } from '../utils/sound';

export default function CameraScannerModal({
  isOpen,
  onClose,
  onCapture,
  mode = 'idcard', // 'idcard' | 'document'
  title = null,
}) {
  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState('environment');
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const guideRef = useRef(null);
  const fallbackInputRef = useRef(null);

  // Stop camera tracks cleanly
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch { }
      });
      streamRef.current = null;
    }
    setStream(null);
    setTorchOn(false);
    setHasTorch(false);
  }, []);

  // Start device camera
  const startCamera = useCallback(async (facing) => {
    stopCamera();
    setCameraError('');

    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraError('Direct camera access is not supported on this browser. Use gallery/camera upload instead.');
      fallbackInputRef.current?.click();
      return;
    }

    try {
      const constraints = {
        audio: false,
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = mediaStream;
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      // Check for torch/flashlight capability
      const track = mediaStream.getVideoTracks()[0];
      if (track?.getCapabilities) {
        const capabilities = track.getCapabilities();
        if (capabilities.torch) {
          setHasTorch(true);
        }
      }
    } catch (err) {
      console.warn('[CameraScannerModal] Camera error:', err);
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access in browser settings.'
          : 'Unable to start camera stream. Opening native camera/file picker...'
      );
      // Auto-open native mobile camera fallback after brief message
      setTimeout(() => {
        fallbackInputRef.current?.click();
      }, 600);
    }
  }, [stopCamera]);

  useEffect(() => {
    if (isOpen) {
      startCamera(facingMode);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode, startCamera, stopCamera]);

  // Handle Torch / Flash toggle
  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextState = !torchOn;
      await track.applyConstraints({
        advanced: [{ torch: nextState }],
      });
      setTorchOn(nextState);
      sound.toggleSnap();
    } catch (err) {
      console.warn('Torch toggle failed:', err);
    }
  };

  // Flip camera between environment and user
  const toggleCamera = () => {
    sound.toggleSnap();
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Capture frame from active video stream
  const handleCapture = () => {
    if (!videoRef.current || isCapturing) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    setIsCapturing(true);
    sound.printBeep();

    const vidW = video.videoWidth;
    const vidH = video.videoHeight;

    // Check guide alignment rect to crop precisely if aligned
    let cropX = 0;
    let cropY = 0;
    let cropW = vidW;
    let cropH = vidH;

    if (guideRef.current && videoRef.current) {
      const guideBox = guideRef.current.getBoundingClientRect();
      const videoBox = videoRef.current.getBoundingClientRect();

      if (videoBox.width > 0 && videoBox.height > 0) {
        // Map displayed video coordinates to intrinsic video frame
        const scaleX = vidW / videoBox.width;
        const scaleY = vidH / videoBox.height;

        const relX = (guideBox.left - videoBox.left) * scaleX;
        const relY = (guideBox.top - videoBox.top) * scaleY;
        const relW = guideBox.width * scaleX;
        const relH = guideBox.height * scaleY;

        // Add 5% comfortable margin
        const padX = relW * 0.05;
        const padY = relH * 0.05;

        cropX = Math.max(0, Math.round(relX - padX));
        cropY = Math.max(0, Math.round(relY - padY));
        cropW = Math.min(vidW - cropX, Math.round(relW + padX * 2));
        cropH = Math.min(vidH - cropY, Math.round(relH + padY * 2));
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = cropW;
    canvas.height = cropH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    canvas.toBlob(
      (blob) => {
        setIsCapturing(false);
        if (!blob) return;

        const fileName = mode === 'idcard' ? `idcard_scan_${Date.now()}.jpg` : `document_scan_${Date.now()}.jpg`;
        const capturedFile = new File([blob], fileName, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });

        stopCamera();
        onCapture(capturedFile);
        onClose();
      },
      'image/jpeg',
      0.94
    );
  };

  // Fallback native input handler
  const handleFallbackChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      stopCamera();
      onCapture(file);
      onClose();
    }
  };

  if (!isOpen) return null;

  const displayTitle = title || (mode === 'idcard' ? 'Scan ID Card' : 'Scan Document');

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex flex-col justify-between bg-black/95 select-none touch-none overflow-hidden">
        {/* ================= TOP CONTROLS BAR ================= */}
        <div className="relative z-20 flex items-center justify-between px-4 py-3 sm:py-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white transition-all cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
            aria-label="Close Camera"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{displayTitle}</span>
          </div>

          <div className="flex items-center gap-2">
            {hasTorch && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`p-2 rounded-full transition-all cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center ${
                  torchOn ? 'bg-amber-400 text-black' : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
                title="Toggle Flash / Torch"
              >
                {torchOn ? <Zap className="w-5 h-5 fill-current" /> : <ZapOff className="w-5 h-5" />}
              </button>
            )}

            <button
              type="button"
              onClick={toggleCamera}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white transition-all cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
              title="Flip Camera"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ================= VIEWFINDER & AI ALIGNMENT GUIDE ================= */}
        <div className="relative flex-1 flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* AI Alignment Guide Overlay */}
          <div className="relative z-10 w-full h-full flex flex-col items-center justify-center pointer-events-none p-4">
            {mode === 'idcard' ? (
              // ID Card Horizontal Guide (Aspect ratio: 85.6 : 54 ~ 1.585)
              <div
                ref={guideRef}
                className="relative w-full max-w-[340px] sm:max-w-[420px] aspect-[85.6/54] rounded-2xl border-2 border-emerald-400/80 shadow-[0_0_25px_rgba(16,185,129,0.35)] flex flex-col justify-between p-3"
              >
                {/* 4 Corner Brackets */}
                <div className="absolute -top-1 -left-1 w-5 h-5 border-t-3 border-l-3 border-emerald-400 rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-5 h-5 border-t-3 border-r-3 border-emerald-400 rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-3 border-l-3 border-emerald-400 rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-3 border-r-3 border-emerald-400 rounded-br-lg" />

                {/* Animated Laser Scanning Beam */}
                <motion.div
                  animate={{ y: ['0%', '100%', '0%'] }}
                  transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
                  className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_#34d399]"
                />

                <div className="w-full text-center">
                  <span className="inline-block px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-emerald-300 font-mono text-[11px] sm:text-xs font-bold border border-emerald-500/30">
                    Align ID Card Inside Frame
                  </span>
                </div>
              </div>
            ) : (
              // Document Portrait Guide (A4 Aspect Ratio: 1 : 1.414)
              <div
                ref={guideRef}
                className="relative w-full max-w-[280px] sm:max-w-[340px] aspect-[1/1.414] rounded-2xl border-2 border-emerald-400/80 shadow-[0_0_25px_rgba(16,185,129,0.35)] flex flex-col justify-between p-3"
              >
                <div className="absolute -top-1 -left-1 w-5 h-5 border-t-3 border-l-3 border-emerald-400 rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-5 h-5 border-t-3 border-r-3 border-emerald-400 rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-3 border-l-3 border-emerald-400 rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-3 border-r-3 border-emerald-400 rounded-br-lg" />

                <motion.div
                  animate={{ y: ['0%', '100%', '0%'] }}
                  transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut' }}
                  className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_#34d399]"
                />

                <div className="w-full text-center">
                  <span className="inline-block px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-emerald-300 font-mono text-[11px] sm:text-xs font-bold border border-emerald-500/30">
                    Align Document Page Inside Frame
                  </span>
                </div>
              </div>
            )}

            {/* Error or Hint Notification */}
            {cameraError && (
              <div className="mt-4 p-2.5 rounded-xl bg-black/75 border border-rose-500/50 text-rose-300 text-xs text-center max-w-xs flex items-center justify-center gap-1.5 pointer-events-auto">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{cameraError}</span>
              </div>
            )}
          </div>
        </div>

        {/* ================= BOTTOM SHUTTER CONTROLS ================= */}
        <div className="relative z-20 flex items-center justify-center px-6 py-6 sm:py-8 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
          <div className="flex items-center justify-center">
            {/* Shutter Button */}
            <button
              type="button"
              onClick={handleCapture}
              disabled={isCapturing}
              className="relative p-1 rounded-full bg-white/20 border-2 border-white/60 active:scale-95 transition-all cursor-pointer min-h-[72px] min-w-[72px] flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.3)] disabled:opacity-50"
              aria-label="Capture Photo"
            >
              <div className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-400 flex items-center justify-center transition-colors">
                <Camera className="w-7 h-7 text-zinc-950" />
              </div>
            </button>
          </div>
        </div>

        {/* Hidden Native Camera Fallback Input */}
        <input
          ref={fallbackInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFallbackChange}
          className="hidden"
        />
      </div>
    </AnimatePresence>
  );
}
