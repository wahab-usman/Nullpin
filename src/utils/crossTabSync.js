/**
 * crossTabSync.js
 * High-performance, zero-server cross-tab synchronization for NullPin.
 * 
 * Supports:
 * - Single and multi-file document drops (PDFs, DOCX, images, etc.).
 * - Volatile Blob storage in IndexedDB across tabs.
 * - Real-time BroadcastChannel events for instant status sync and burn.
 */

const DB_NAME = 'nullpin_volatile_store';
const DB_VERSION = 1;
const STORE_NAME = 'active_drops';

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'pin' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Saves a drop to local browser store so other tabs can access it
 */
export async function saveDropRecord(drop) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // Multi-file Blobs support
    const rawBlobs = [];
    if (Array.isArray(drop.rawFiles)) {
      drop.rawFiles.forEach((f) => {
        if (f instanceof Blob) rawBlobs.push(f);
      });
    } else if (drop.rawFile instanceof Blob) {
      rawBlobs.push(drop.rawFile);
    }

    const filesMeta = Array.isArray(drop.files) && drop.files.length > 0
      ? drop.files.map((f, idx) => ({ id: f.id || `file-${idx}`, name: f.name, size: f.size, type: f.type }))
      : drop.file
      ? [{ id: drop.file.id || 'primary', name: drop.file.name, size: drop.file.size, type: drop.file.type }]
      : [];

    const record = {
      pin: String(drop.pin),
      id: drop.id,
      mode: drop.mode,
      file: drop.file || filesMeta[0] || null,
      files: filesMeta,
      prefs: drop.prefs,
      rawBlobs,
      rawBlob: rawBlobs[0] || null,
      frontBlob: drop.frontFile instanceof Blob ? drop.frontFile : null,
      backBlob: drop.backFile instanceof Blob ? drop.backFile : null,
      textContent: drop.textContent || '',
      status: 'waiting',
      createdAt: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000, // exactly 5 minutes
    };

    store.put(record);

    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });

    // Notify other tabs
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel('nullpin_cross_tab');
      channel.postMessage({ type: 'DROP_CREATED', pin: String(drop.pin) });
      channel.close();
    }
  } catch (err) {
    console.error('Failed to save drop to cross-tab store:', err);
  }
}

// Registry of active Blob URLs per PIN to prevent memory leaks across multiple reads
const activeCrossTabUrls = new Map(); // pin -> Set<string>

function registerUrlForPin(pin, url) {
  if (!url) return;
  const p = String(pin).trim();
  if (!activeCrossTabUrls.has(p)) {
    activeCrossTabUrls.set(p, new Set());
  }
  activeCrossTabUrls.get(p).add(url);
}

export function revokeUrlsForPin(pin) {
  const p = String(pin).trim();
  if (activeCrossTabUrls.has(p)) {
    activeCrossTabUrls.get(p).forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {}
    });
    activeCrossTabUrls.delete(p);
  }
}

/**
 * Looks up a drop by 4-digit PIN across all tabs
 */
export async function getDropRecord(pin) {
  try {
    const searchPin = String(pin).trim();
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(searchPin);

    const record = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = reject;
    });

    if (!record) return null;

    // Check expiration (5 minutes) or already claimed/burned status (Single-Claim Enforcement)
    if (Date.now() > record.expiresAt || record.status === 'burned' || record.status === 'claimed' || record.status === 'opened') {
      if (Date.now() > record.expiresAt) {
        burnDropRecord(searchPin);
      }
      return null;
    }

    // Revoke any previously minted URLs for this PIN to avoid leaks
    revokeUrlsForPin(searchPin);

    // Reconstruct memory blob URLs for all files
    const rawBlobs = Array.isArray(record.rawBlobs) && record.rawBlobs.length > 0
      ? record.rawBlobs
      : (record.rawBlob ? [record.rawBlob] : []);

    const metaList = Array.isArray(record.files) && record.files.length > 0
      ? record.files
      : (record.file ? [record.file] : []);

    const reconstructedFiles = metaList.map((meta, idx) => {
      const blob = rawBlobs[idx] || (rawBlobs.length === 1 ? rawBlobs[0] : null);
      let url = null;
      if (blob) {
        url = URL.createObjectURL(blob);
        registerUrlForPin(searchPin, url);
      }
      return {
        id: meta.id || `file-${idx}`,
        name: meta.name || `Document_${idx + 1}.pdf`,
        size: meta.size || (blob ? blob.size : 0),
        type: meta.type || (blob ? blob.type : 'application/octet-stream'),
        rawFile: blob,
        blobUrl: url,
      };
    });

    const primaryFile = reconstructedFiles[0] || null;
    let primaryBlobUrl = primaryFile?.blobUrl || null;
    if (!primaryBlobUrl && record.rawBlob) {
      primaryBlobUrl = URL.createObjectURL(record.rawBlob);
      registerUrlForPin(searchPin, primaryBlobUrl);
    }

    let frontBlobUrl = null;
    if (record.frontBlob) {
      frontBlobUrl = URL.createObjectURL(record.frontBlob);
      registerUrlForPin(searchPin, frontBlobUrl);
    }
    let backBlobUrl = null;
    if (record.backBlob) {
      backBlobUrl = URL.createObjectURL(record.backBlob);
      registerUrlForPin(searchPin, backBlobUrl);
    }

    return {
      id: record.id,
      pin: record.pin,
      mode: record.mode,
      file: reconstructedFiles[0] || null,
      files: reconstructedFiles,
      rawFiles: rawBlobs,
      rawFile: rawBlobs[0] || null,
      blobUrl: primaryBlobUrl,
      frontBlobUrl,
      backBlobUrl,
      frontPreview: frontBlobUrl,
      backPreview: backBlobUrl,
      textContent: record.textContent,
      prefs: record.prefs,
      status: record.status,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      created_at: record.created_at,
      expires_at: record.expires_at,
    };
  } catch (err) {
    console.error('Failed to get drop from cross-tab store:', err);
    return null;
  }
}

/**
 * Marks a drop as opened or burned across all tabs
 */
export async function markDropStatus(pin, status) {
  try {
    const searchPin = String(pin).trim();
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(searchPin);

    request.onsuccess = () => {
      const record = request.result;
      if (record) {
        record.status = status;
        store.put(record);
      }
    };

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel('nullpin_cross_tab');
      channel.postMessage({ type: 'DROP_STATUS_CHANGED', pin: searchPin, status });
      channel.close();
    }
  } catch (err) {
    console.error('Failed to update drop status:', err);
  }
}

/**
 * Immediately marks a drop as claimed so no other tab can unlock it (Single-Claim)
 */
export async function claimDropRecord(pin) {
  return markDropStatus(pin, 'claimed');
}

/**
 * Permanently purges a drop from browser memory across all tabs
 */
export async function burnDropRecord(pin) {
  try {
    const searchPin = String(pin).trim();
    revokeUrlsForPin(searchPin);
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(searchPin);

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel('nullpin_cross_tab');
      channel.postMessage({ type: 'DROP_BURNED', pin: searchPin });
      channel.close();
    }
  } catch (err) {
    console.error('Failed to burn drop record:', err);
  }
}
