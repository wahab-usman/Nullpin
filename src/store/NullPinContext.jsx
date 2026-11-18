import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { sound } from '../utils/sound';
import { createDemoLabReportPdfBlob, cleanupPrewarmedFrames } from '../utils/ramPrinter';
import { DEMO_PRESETS } from '../utils/demoPresets';
import { 
  saveDropRecord, 
  getDropRecord, 
  markDropStatus, 
  claimDropRecord,
  burnDropRecord 
} from '../utils/crossTabSync';
import {
  uploadDropToSupabase,
  fetchDropFromSupabase,
  burnDropInSupabase,
  subscribeToSupabaseDrop,
  cleanupExpiredSupabaseDrops,
  cleanupExpiredDrops,
  generateCollisionFreePin
} from '../utils/supabaseService';
import { isSupabaseConfigured } from '../utils/supabaseClient';

const NullPinContext = createContext(null);
const NullPinTimerContext = createContext({ timeLeft: 300, isTimerActive: false });

export function useNullPin() {
  const ctx = useContext(NullPinContext);
  if (!ctx) throw new Error('useNullPin must be used within NullPinProvider');
  return ctx;
}

export function useNullPinTimer() {
  const ctx = useContext(NullPinTimerContext);
  return ctx || { timeLeft: 300, isTimerActive: false };
}

function resolveFileType(file) {
  if (file?.type && file.type !== 'application/octet-stream' && file.type !== '') {
    return file.type;
  }
  const name = (file?.name || '').toLowerCase();
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (name.endsWith('.doc')) return 'application/msword';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.txt')) return 'text/plain';
  if (/\.(py|js|jsx|ts|tsx|html|htm|css|cpp|c|h|java|cs|php|sql|json|xml|md|log|csv|env|sh|yaml|yml)$/i.test(name)) {
    return 'text/plain';
  }
  if (/\.(zip|rar|7z|tar|gz)$/i.test(name)) {
    return 'application/zip';
  }
  return file?.type || 'application/octet-stream';
}

function calculateRemainingSeconds(drop) {
  if (!drop) return 300;
  let expireTimestamp = drop.expiresAt;
  if (!expireTimestamp && drop.expires_at) {
    expireTimestamp = new Date(drop.expires_at).getTime();
  }
  if (!expireTimestamp && drop.created_at) {
    expireTimestamp = new Date(drop.created_at).getTime() + 5 * 60 * 1000;
  }
  if (!expireTimestamp && drop.createdAt) {
    expireTimestamp = drop.createdAt + 5 * 60 * 1000;
  }
  if (expireTimestamp) {
    const diffSeconds = Math.max(0, Math.floor((expireTimestamp - Date.now()) / 1000));
    return Math.min(300, diffSeconds);
  }
  return 300;
}

export function NullPinProvider({ children }) {
  // Current mode for the central stage: default to 'send' (Send Drop opens first)
  const [activeStageTab, setActiveStageTab] = useState('send');

  // Active Drop state
  const [activeDrop, setActiveDrop] = useState(null);

  // Unlocked Drop state (when Receiver has entered valid PIN)
  const [unlockedDrop, setUnlockedDrop] = useState(null);

  // Status: 'portal' | 'ticket' | 'studio'
  const [currentView, setCurrentView] = useState('portal');

  // Global PIN entry state (for the 4-digit kinetic typography)
  const [pinDigits, setPinDigits] = useState(['', '', '', '']);
  const [pinError, setPinError] = useState(false);

  // Countdown timer in seconds (5 minutes = 300s)
  const [timeLeft, setTimeLeft] = useState(300);
  const [isTimerActive, setIsTimerActive] = useState(false);

  // Audio mute toggle
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Live cloud sync telemetry state
  const [uploadState, setUploadState] = useState({
    status: 'idle', // 'idle' | 'compressing' | 'uploading' | 'synced' | 'error'
    percent: 0,
    currentFile: 0,
    totalFiles: 0,
    message: '',
  });

  // Rate limiting states for PIN entry brute-force defense (5 failed attempts -> 30s cooldown)
  const [cooldownSeconds, setCooldownSeconds] = useState(() => {
    if (typeof window === 'undefined') return 0;
    try {
      const cooldownUntil = parseInt(sessionStorage.getItem('nullpin_cooldown_until') || '0', 10);
      if (cooldownUntil && cooldownUntil > Date.now()) {
        return Math.ceil((cooldownUntil - Date.now()) / 1000);
      }
    } catch (e) {}
    return 0;
  });

  // Mutex lock to prevent infinite burn / reset loops per PIN
  const burningPinsRef = useRef(new Set());

  // Cooldown countdown tick
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          try {
            sessionStorage.removeItem('nullpin_cooldown_until');
            sessionStorage.removeItem('nullpin_failed_attempts');
          } catch (e) {}
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  // 5-Minute countdown tick
  useEffect(() => {
    let interval = null;
    if (isTimerActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            triggerVaporize();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerActive, timeLeft]);

  // Silently run 5-minute garbage collection when app loads
  useEffect(() => {
    if (isSupabaseConfigured()) {
      cleanupExpiredSupabaseDrops().catch(() => {});
    }
  }, []);

  // Create a new drop
  const createDrop = useCallback(async (data) => {
    // 1. Generate guaranteed collision-free 4-digit PIN (1000-9999)
    const pin = await generateCollisionFreePin();
    const mode = data.mode || 'doc';

    // 1. Establish multi-file list and memory blob URLs
    let files = [];
    let rawFiles = [];

    if (Array.isArray(data.files) && data.files.length > 0) {
      files = data.files.map((f) => ({
        id: f.id || String(Math.random()),
        name: f.name || 'Document.pdf',
        size: f.size || 0,
        type: resolveFileType(f),
        rawFile: f.rawFile || null,
        blobUrl: f.blobUrl || (f.rawFile instanceof Blob ? URL.createObjectURL(f.rawFile) : null),
      }));
      rawFiles = files.map((f) => f.rawFile).filter(Boolean);
    } else if (data.file) {
      const singleRaw = data.rawFile || null;
      const singleUrl = data.blobUrl || (singleRaw instanceof Blob ? URL.createObjectURL(singleRaw) : null);
      const single = {
        id: '1',
        name: data.file.name || 'Document.pdf',
        size: data.file.size || 0,
        type: resolveFileType(data.file),
        rawFile: singleRaw,
        blobUrl: singleUrl,
      };
      files = [single];
      if (singleRaw) rawFiles = [singleRaw];
    } else if (mode === 'doc') {
      const pdfBlob = createDemoLabReportPdfBlob();
      const single = {
        id: 'demo',
        name: 'Document_Drop.pdf',
        size: pdfBlob.size,
        type: 'application/pdf',
        rawFile: pdfBlob,
        blobUrl: URL.createObjectURL(pdfBlob),
      };
      files = [single];
      rawFiles = [pdfBlob];
    }

    const primaryFile = files[0] || null;
    const blobUrl = primaryFile?.blobUrl || null;
    const rawFile = primaryFile?.rawFile || null;

    let frontBlobUrl = data.frontBlobUrl || null;
    if (data.frontFile instanceof Blob) {
      frontBlobUrl = URL.createObjectURL(data.frontFile);
    }

    let backBlobUrl = data.backBlobUrl || null;
    if (data.backFile instanceof Blob) {
      backBlobUrl = URL.createObjectURL(data.backFile);
    }

    const newDrop = {
      id: `DROP-${pin}`,
      pin,
      mode,
      file: primaryFile,
      files,
      rawFiles,
      rawFile,
      blobUrl,
      frontBlobUrl,
      backBlobUrl,
      frontFile: data.frontFile || null,
      backFile: data.backFile || null,
      frontPreview: data.frontPreview || frontBlobUrl || null,
      backPreview: data.backPreview || backBlobUrl || null,
      textContent: data.textContent || '',
      prefs: {
        colorMode: data.colorMode || 'bw',
        sides: data.sides || 'single',
        copies: data.copies || 1,
        burnAfterPrint: data.burnAfterPrint ?? true,
      },
      status: 'waiting', // 'waiting' | 'opened' | 'burned'
      createdAt: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    };

    setActiveDrop(newDrop);
    setTimeLeft(300);
    setIsTimerActive(true);
    setCurrentView('ticket');
    sound.printBeep();

    // Synchronize to other browser tabs/windows immediately
    saveDropRecord(newDrop);

    // Upload to Supabase cloud storage & database with live telemetry
    if (isSupabaseConfigured()) {
      cleanupExpiredSupabaseDrops().catch(() => {});
      uploadDropToSupabase(newDrop, (progress) => {
        setUploadState(progress);
      });
    } else {
      setUploadState({
        status: 'synced',
        percent: 100,
        currentFile: files.length,
        totalFiles: files.length,
        message: 'Volatile RAM Mode Ready',
      });
    }

    return pin;
  }, []);

  // Quick preset loader
  const loadPreset = useCallback((presetKey) => {
    const preset = DEMO_PRESETS[presetKey];
    if (!preset) return;
    createDrop({
      mode: preset.mode,
      file: preset.file,
      textContent: preset.textContent,
      frontPreview: preset.frontPreview,
      backPreview: preset.backPreview,
      colorMode: preset.prefs.colorMode,
      sides: preset.prefs.sides,
      copies: preset.prefs.copies,
      burnAfterPrint: preset.prefs.burnAfterPrint,
    });
  }, [createDrop]);

  // Lookup & Unlock PIN (Works in current tab AND across tabs/windows)
  const unlockWithPin = useCallback(async (pin) => {
    // 0. Brute-force bot rate limiting defense (5 failed attempts -> 30s cooldown)
    if (cooldownSeconds > 0) {
      return false;
    }

    const searchPin = String(pin).trim();

    const handleSuccessfulUnlock = (openedDrop) => {
      try {
        sessionStorage.removeItem('nullpin_failed_attempts');
        sessionStorage.removeItem('nullpin_cooldown_until');
      } catch (e) {}
      setCooldownSeconds(0);
      sound.unlockChime();
      const remaining = calculateRemainingSeconds(openedDrop);
      setTimeLeft(remaining);
      setIsTimerActive(true);
      setActiveDrop(openedDrop);
      setUnlockedDrop(openedDrop);
      setCurrentView('studio');
      setPinError(false);
      claimDropRecord(searchPin);
      return true;
    };

    // 1. Check if matches active drop in this tab's memory (Single-Claim: only allow if waiting)
    if (activeDrop && String(activeDrop.pin) === searchPin && activeDrop.status === 'waiting') {
      return handleSuccessfulUnlock({ ...activeDrop, status: 'opened' });
    }

    // 2. Cross-Tab Lookup: Check if another localhost tab/window created this PIN (Single-Claim: only allow if waiting)
    const crossTabDrop = await getDropRecord(searchPin);
    if (crossTabDrop && crossTabDrop.status === 'waiting') {
      return handleSuccessfulUnlock({ ...crossTabDrop, status: 'opened' });
    }

    // 3. Supabase Cloud Lookup: Check live Supabase database & storage bucket
    if (isSupabaseConfigured()) {
      const cloudDrop = await fetchDropFromSupabase(searchPin);
      if (cloudDrop && (cloudDrop.status === 'waiting' || cloudDrop.status === 'synced')) {
        return handleSuccessfulUnlock({ ...cloudDrop, status: 'opened' });
      }
    }

    // 4. Default demo fallback: 7492
    if (searchPin === '7492') {
      try {
        sessionStorage.removeItem('nullpin_failed_attempts');
        sessionStorage.removeItem('nullpin_cooldown_until');
      } catch (e) {}
      setCooldownSeconds(0);
      sound.unlockChime();
      const demoBlob = createDemoLabReportPdfBlob();
      const demoBlobUrl = URL.createObjectURL(demoBlob);

      const demo = {
        id: 'DEMO-7492',
        pin: '7492',
        mode: 'doc',
        file: {
          name: 'Univ_Lab_4_Synthesis.pdf',
          size: 2457600,
          pages: 3,
          author: 'Prof. Miller / Team 09',
          type: 'application/pdf',
        },
        rawFile: demoBlob,
        blobUrl: demoBlobUrl,
        frontBlobUrl: null,
        backBlobUrl: null,
        frontPreview: null,
        backPreview: null,
        textContent: '',
        prefs: {
          colorMode: 'bw',
          sides: 'double',
          copies: 2,
          burnAfterPrint: true,
        },
        status: 'opened',
        createdAt: Date.now(),
        expiresAt: Date.now() + 300 * 1000,
      };
      setTimeLeft(300);
      setIsTimerActive(true);
      setUnlockedDrop(demo);
      setCurrentView('studio');
      setPinError(false);
      return true;
    }

    // Invalid PIN feedback: Track consecutive failed attempts in sessionStorage
    try {
      const currentAttempts = parseInt(sessionStorage.getItem('nullpin_failed_attempts') || '0', 10) + 1;
      if (currentAttempts >= 5) {
        const cooldownUntil = Date.now() + 30 * 1000;
        sessionStorage.setItem('nullpin_cooldown_until', String(cooldownUntil));
        sessionStorage.setItem('nullpin_failed_attempts', String(currentAttempts));
        setCooldownSeconds(30);
      } else {
        sessionStorage.setItem('nullpin_failed_attempts', String(currentAttempts));
      }
    } catch (e) {}

    sound.vaporize();
    setPinError(true);
    setTimeout(() => {
      setPinDigits(['', '', '', '']);
      setPinError(false);
    }, 900);
    return false;
  }, [activeDrop, cooldownSeconds]);

  // Trigger vaporize / burn animation & reset
  const triggerVaporize = useCallback((fromRemote = false) => {
    const pinToBurn = activeDrop?.pin || unlockedDrop?.pin;
    const pinKey = pinToBurn ? String(pinToBurn).trim() : null;

    if (pinKey) {
      if (burningPinsRef.current.has(pinKey)) {
        return; // Already burning or burned — idempotent mutex
      }
      burningPinsRef.current.add(pinKey);
      setTimeout(() => {
        burningPinsRef.current.delete(pinKey);
      }, 60000);
    }

    cleanupPrewarmedFrames();
    if (!fromRemote) {
      sound.vaporize();
    }

    if (pinKey && !fromRemote) {
      burnDropRecord(pinKey);
      if (isSupabaseConfigured()) {
        burnDropInSupabase(pinKey);
      }
    }

    // Revoke object URLs from RAM memory
    if (activeDrop?.blobUrl) {
      try { URL.revokeObjectURL(activeDrop.blobUrl); } catch (e) {}
    }
    if (activeDrop?.frontBlobUrl) {
      try { URL.revokeObjectURL(activeDrop.frontBlobUrl); } catch (e) {}
    }
    if (activeDrop?.backBlobUrl) {
      try { URL.revokeObjectURL(activeDrop.backBlobUrl); } catch (e) {}
    }

    if (Array.isArray(activeDrop?.files)) {
      activeDrop.files.forEach((f) => {
        if (f.blobUrl) {
          try { URL.revokeObjectURL(f.blobUrl); } catch (e) {}
        }
      });
    }

    if (unlockedDrop?.blobUrl && unlockedDrop.blobUrl !== activeDrop?.blobUrl) {
      try { URL.revokeObjectURL(unlockedDrop.blobUrl); } catch (e) {}
    }

    if (Array.isArray(unlockedDrop?.files)) {
      unlockedDrop.files.forEach((f) => {
        if (f.blobUrl && f.blobUrl !== activeDrop?.blobUrl) {
          try { URL.revokeObjectURL(f.blobUrl); } catch (e) {}
        }
      });
    }

    if (activeDrop) {
      setActiveDrop((prev) => (prev ? { ...prev, status: 'burned' } : null));
    }
    if (unlockedDrop) {
      setUnlockedDrop((prev) => (prev ? { ...prev, status: 'burned' } : null));
    }
    setIsTimerActive(false);
    setUploadState({ status: 'idle', percent: 0, currentFile: 0, totalFiles: 0, message: '' });

    // Return to clean portal after disintegration
    setTimeout(() => {
      setActiveDrop(null);
      setUnlockedDrop(null);
      setCurrentView('portal');
      setActiveStageTab('send');
      setPinDigits(['', '', '', '']);
      setTimeLeft(300);
    }, 950);
  }, [activeDrop, unlockedDrop]);

  // Cross-tab real-time sync listener (BroadcastChannel)
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    const channel = new BroadcastChannel('nullpin_cross_tab');

    channel.onmessage = (e) => {
      const { type, pin, status } = e.data || {};
      if (!pin) return;
      const pinKey = String(pin).trim();

      if (type === 'DROP_BURNED') {
        if (burningPinsRef.current.has(pinKey)) return;
        if ((activeDrop && String(activeDrop.pin) === pinKey) || 
            (unlockedDrop && String(unlockedDrop.pin) === pinKey)) {
          triggerVaporize(true);
        }
      } else if (type === 'DROP_STATUS_CHANGED') {
        if (activeDrop && String(activeDrop.pin) === pinKey) {
          setActiveDrop((prev) => (prev ? { ...prev, status } : null));
        }
      }
    };

    return () => {
      channel.close();
    };
  }, [activeDrop, unlockedDrop, triggerVaporize]);

  // Supabase real-time cross-device sync (e.g. sender on mobile, receiver on desktop)
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const targetPin = activeDrop?.pin || unlockedDrop?.pin;
    if (!targetPin) return;
    const pinKey = String(targetPin).trim();

    const unsubscribe = subscribeToSupabaseDrop(pinKey, (updatedRecord) => {
      if (updatedRecord.status === 'burned') {
        if (burningPinsRef.current.has(pinKey)) return;
        triggerVaporize(true);
      } else if (updatedRecord.status === 'opened') {
        setActiveDrop((prev) => (prev ? { ...prev, status: 'opened' } : null));
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [activeDrop?.pin, unlockedDrop?.pin, triggerVaporize]);

  // Fast reset back to portal
  const resetToPortal = useCallback(() => {
    setCurrentView('portal');
    setActiveStageTab('send');
    setPinDigits(['', '', '', '']);
  }, []);

  // Toggle sound
  const toggleSound = useCallback(() => {
    const newState = sound.toggle();
    setSoundEnabled(newState);
  }, []);

  return (
    <NullPinContext.Provider
      value={{
        activeStageTab,
        setActiveStageTab,
        activeDrop,
        unlockedDrop,
        currentView,
        setCurrentView,
        pinDigits,
        setPinDigits,
        pinError,
        cooldownSeconds,
        isTimerActive,
        soundEnabled,
        uploadState,
        createDrop,
        loadPreset,
        unlockWithPin,
        triggerVaporize,
        resetToPortal,
        toggleSound,
      }}
    >
      <NullPinTimerContext.Provider value={{ timeLeft, isTimerActive }}>
        {children}
      </NullPinTimerContext.Provider>
    </NullPinContext.Provider>
  );
}
