import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { sound } from '../utils/sound';
import { createDemoLabReportPdfBlob, cleanupPrewarmedFrames } from '../utils/ramPrinter';
import { DEMO_PRESETS } from '../utils/demoPresets';
import { 
  saveDropRecord, 
  getDropRecord, 
  markDropStatus, 
  burnDropRecord 
} from '../utils/crossTabSync';
import {
  uploadDropToSupabase,
  fetchDropFromSupabase,
  burnDropInSupabase,
  subscribeToSupabaseDrop,
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
  if (name.endsWith('.zip')) return 'application/zip';
  return file?.type || 'application/octet-stream';
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
      cleanupExpiredDrops().catch(() => {});
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
      cleanupExpiredDrops().catch(() => {});
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
    const searchPin = String(pin).trim();

    // 1. Check if matches active drop in this tab's memory
    if (activeDrop && String(activeDrop.pin) === searchPin && activeDrop.status !== 'burned') {
      sound.unlockChime();
      const updated = { ...activeDrop, status: 'opened' };
      setActiveDrop(updated);
      setUnlockedDrop(updated);
      setCurrentView('studio');
      setPinError(false);
      markDropStatus(searchPin, 'opened');
      return true;
    }

    // 2. Cross-Tab Lookup: Check if another localhost tab/window created this PIN
    const crossTabDrop = await getDropRecord(searchPin);
    if (crossTabDrop && crossTabDrop.status !== 'burned') {
      sound.unlockChime();
      const openedDrop = { ...crossTabDrop, status: 'opened' };
      setActiveDrop(openedDrop);
      setUnlockedDrop(openedDrop);
      setCurrentView('studio');
      setPinError(false);
      markDropStatus(searchPin, 'opened');
      return true;
    }

    // 3. Supabase Cloud Lookup: Check live Supabase database & storage bucket
    if (isSupabaseConfigured()) {
      const cloudDrop = await fetchDropFromSupabase(searchPin);
      if (cloudDrop && cloudDrop.status !== 'burned') {
        sound.unlockChime();
        const openedDrop = { ...cloudDrop, status: 'opened' };
        setActiveDrop(openedDrop);
        setUnlockedDrop(openedDrop);
        setCurrentView('studio');
        setPinError(false);
        return true;
      }
    }

    // 3. Default demo fallback: 7492
    if (searchPin === '7492') {
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
      };
      setUnlockedDrop(demo);
      setCurrentView('studio');
      setPinError(false);
      return true;
    }

    // Invalid PIN feedback
    sound.vaporize();
    setPinError(true);
    setTimeout(() => {
      setPinDigits(['', '', '', '']);
      setPinError(false);
    }, 900);
    return false;
  }, [activeDrop]);

  // Trigger vaporize / burn animation & reset
  const triggerVaporize = useCallback((fromRemote = false) => {
    cleanupPrewarmedFrames();
    if (!fromRemote) {
      sound.vaporize();
    }

    const pinToBurn = activeDrop?.pin || unlockedDrop?.pin;
    if (pinToBurn && !fromRemote) {
      burnDropRecord(pinToBurn);
      if (isSupabaseConfigured()) {
        burnDropInSupabase(pinToBurn);
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

      if (type === 'DROP_BURNED') {
        if ((activeDrop && String(activeDrop.pin) === String(pin)) || 
            (unlockedDrop && String(unlockedDrop.pin) === String(pin))) {
          triggerVaporize(true);
        }
      } else if (type === 'DROP_STATUS_CHANGED') {
        if (activeDrop && String(activeDrop.pin) === String(pin)) {
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

    const unsubscribe = subscribeToSupabaseDrop(targetPin, (updatedRecord) => {
      if (updatedRecord.status === 'burned') {
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
