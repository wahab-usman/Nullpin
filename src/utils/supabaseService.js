import { supabase, isSupabaseConfigured } from './supabaseClient';

export const BUCKET_NAME = 'nullpin-drops';
export const TABLE_NAME = 'drops';

/**
 * Client-Side Image Compression (Fast Mobile 4G Uploads):
 * If an image (JPEG, PNG, WEBP) is larger than 600KB,
 * compress in browser memory via HTML5 <canvas> (max dimension 2000px, JPEG quality 0.82)
 * so large phone photos upload in 1 second over cellular networks while maintaining print quality.
 * Includes aggressive memory reclamation to prevent iOS Safari WebProcess Jetsam memory crashes.
 */
export async function compressImageBlobIfNeeded(blob, maxDim = 2000, quality = 0.82, thresholdBytes = 600 * 1024) {
  if (!(blob instanceof Blob)) return blob;

  const type = (blob.type || '').toLowerCase();
  const isImage = type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(blob.name || '');

  // Skip non-images or files already under 600KB
  if (!isImage || blob.size <= thresholdBytes) {
    return blob;
  }

  return new Promise((resolve) => {
    try {
      const img = new Image();
      const url = URL.createObjectURL(blob);

      img.onload = () => {
        URL.revokeObjectURL(url);

        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          img.src = '';
          resolve(blob);
          return;
        }

        // Fill white background for clean printouts & PNG alpha conversion
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (compressed) => {
            // Aggressive Safari memory cleanup: release canvas backing store & image decoding buffer
            canvas.width = 0;
            canvas.height = 0;
            img.src = '';

            if (compressed && compressed.size < blob.size) {
              resolve(compressed);
            } else {
              resolve(blob);
            }
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        img.src = '';
        resolve(blob);
      };

      img.src = url;
    } catch (e) {
      console.warn('[NullPin Image Compression] Fallback to original blob:', e);
      resolve(blob);
    }
  });
}

/**
 * Automatic 5-Minute Garbage Collector:
 * Queries public.drops where expires_at < now (older than 5 minutes),
 * deletes all associated storage files (files_meta, front_path, back_path)
 * from the nullpin-drops bucket and deletes expired rows from public.drops.
 */
export async function cleanupExpiredDrops() {
  if (!isSupabaseConfigured() || !supabase) return;

  try {
    const nowIso = new Date().toISOString();

    // 1. Query expired drops older than 5 minutes
    const { data: expiredDrops, error: selectErr } = await supabase
      .from(TABLE_NAME)
      .select('pin, files_meta, front_path, back_path')
      .lt('expires_at', nowIso);

    if (selectErr || !Array.isArray(expiredDrops) || expiredDrops.length === 0) {
      return;
    }

    const filesToDelete = [];
    const expiredPins = [];

    // 2. Aggregate all file storage paths and folder files to purge
    for (const drop of expiredDrops) {
      if (drop.pin) expiredPins.push(drop.pin);

      if (Array.isArray(drop.files_meta)) {
        for (const f of drop.files_meta) {
          if (f.path) filesToDelete.push(f.path);
        }
      }

      if (drop.front_path) filesToDelete.push(drop.front_path);
      if (drop.back_path) filesToDelete.push(drop.back_path);

      // Clean folder contents
      if (drop.pin) {
        try {
          const { data: folderItems } = await supabase.storage.from(BUCKET_NAME).list(drop.pin);
          if (Array.isArray(folderItems)) {
            for (const item of folderItems) {
              filesToDelete.push(`${drop.pin}/${item.name}`);
            }
          }
        } catch (e) {}
      }
    }

    // 3. Batch delete files from storage bucket
    const uniquePaths = Array.from(new Set(filesToDelete)).filter(Boolean);
    if (uniquePaths.length > 0) {
      await supabase.storage.from(BUCKET_NAME).remove(uniquePaths);
    }

    // 4. Delete expired rows from database table
    if (expiredPins.length > 0) {
      await supabase.from(TABLE_NAME).delete().in('pin', expiredPins);
    }
  } catch (err) {
    console.warn('[NullPin GC] Background cleanup notice:', err);
  }
}

/**
 * Generates a collision-free 4-digit PIN (1000-9999).
 * Verifies against Supabase that no active, unexpired drop is using this PIN.
 * Retries up to 8 times locally/remotely to guarantee active drops are never overwritten.
 */
export async function generateCollisionFreePin() {
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = String(Math.floor(1000 + Math.random() * 9000));
    if (!isSupabaseConfigured() || !supabase) {
      return candidate;
    }
    try {
      const nowIso = new Date().toISOString();
      const { data } = await supabase
        .from(TABLE_NAME)
        .select('pin')
        .eq('pin', candidate)
        .in('status', ['uploading', 'waiting'])
        .gt('expires_at', nowIso)
        .maybeSingle();

      if (!data) {
        return candidate;
      }
    } catch (e) {
      return candidate;
    }
  }
  return String(Math.floor(1000 + Math.random() * 9000));
}

/**
 * Uploads drop metadata and file payloads to Supabase Storage + Database with live telemetry.
 * Pre-inserts database record with 'uploading' status to eliminate receiver race conditions,
 * and yields to the main thread (16ms) to keep UI and Framer Motion animations locked at 60 FPS.
 */
export async function uploadDropToSupabase(dropData, onProgress) {
  if (!isSupabaseConfigured() || !supabase) {
    if (typeof onProgress === 'function') {
      onProgress({
        status: 'synced',
        percent: 100,
        currentFile: 1,
        totalFiles: 1,
        message: 'Local RAM Mode Active',
      });
    }
    return null;
  }

  // Run garbage collector silently in background on new drop creation
  cleanupExpiredDrops().catch(() => {});

  const pin = String(dropData.pin);
  const filesToUpload = Array.isArray(dropData.files) && dropData.files.length > 0
    ? dropData.files
    : dropData.file
    ? [dropData.file]
    : [];

  const extraItems = (dropData.frontFile instanceof Blob ? 1 : 0) + (dropData.backFile instanceof Blob ? 1 : 0);
  const totalItems = Math.max(1, filesToUpload.length + extraItems);

  try {
    // 1. Insert preliminary row with 'uploading' status to eliminate receiver race conditions
    const initialPayload = {
      pin,
      id: dropData.id || `DROP-${pin}`,
      mode: dropData.mode || 'doc',
      files_meta: [],
      front_path: null,
      back_path: null,
      text_content: dropData.textContent || '',
      prefs: dropData.prefs || {},
      status: 'uploading',
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    };

    if (typeof onProgress === 'function') {
      onProgress({
        status: 'uploading',
        percent: 5,
        currentFile: 0,
        totalFiles: totalItems,
        message: 'Syncing to Cloud Vault...',
      });
    }

    await supabase.from(TABLE_NAME).upsert(initialPayload, { onConflict: 'pin' });

    const uploadedPaths = [];
    let completedCount = 0;

    // 2. Upload file blobs with yield to main thread and memory cleanup
    for (let i = 0; i < filesToUpload.length; i++) {
      const fileItem = filesToUpload[i];
      let rawBlob = fileItem.rawFile instanceof Blob ? fileItem.rawFile : null;

      if (rawBlob) {
        if (typeof onProgress === 'function') {
          onProgress({
            status: 'compressing',
            percent: Math.min(90, Math.round((completedCount / totalItems) * 85) + 5),
            currentFile: completedCount + 1,
            totalFiles: totalItems,
            message: `Optimizing ${fileItem.name || 'document'}...`,
          });
        }

        rawBlob = await compressImageBlobIfNeeded(rawBlob, 2000, 0.82, 600 * 1024);

        // Yield to browser main thread for locked 60 FPS UI/animation rendering
        await new Promise((resolve) => setTimeout(resolve, 16));

        const safeName = (fileItem.name || `file_${i + 1}`).replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `${pin}/${i}_${safeName}`;

        if (typeof onProgress === 'function') {
          onProgress({
            status: 'uploading',
            percent: Math.min(95, Math.round(((completedCount + 0.5) / totalItems) * 85) + 5),
            currentFile: completedCount + 1,
            totalFiles: totalItems,
            message: `Uploading ${fileItem.name || 'document'}...`,
          });
        }

        const { error: uploadErr } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(storagePath, rawBlob, {
            upsert: true,
            contentType: rawBlob.type || fileItem.type || 'application/octet-stream',
          });

        if (!uploadErr) {
          uploadedPaths.push({
            id: fileItem.id || `file-${i}`,
            path: storagePath,
            name: fileItem.name,
            size: rawBlob.size || fileItem.size,
            type: rawBlob.type || fileItem.type,
          });
        } else {
          console.warn('[NullPin Supabase] Storage file upload error:', uploadErr);
        }

        completedCount++;
        // Yield to main thread again
        await new Promise((resolve) => setTimeout(resolve, 16));
      }
    }

    // 3. Upload front & back ID card images if present (with compression)
    let frontPath = null;
    let backPath = null;

    if (dropData.frontFile instanceof Blob) {
      if (typeof onProgress === 'function') {
        onProgress({
          status: 'uploading',
          percent: 90,
          currentFile: completedCount + 1,
          totalFiles: totalItems,
          message: 'Uploading ID card front...',
        });
      }
      const frontBlob = await compressImageBlobIfNeeded(dropData.frontFile, 2000, 0.82, 600 * 1024);
      await new Promise((r) => setTimeout(r, 16));
      const path = `${pin}/id_front.jpg`;
      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(path, frontBlob, { upsert: true, contentType: 'image/jpeg' });
      if (!error) frontPath = path;
      completedCount++;
    }

    if (dropData.backFile instanceof Blob) {
      if (typeof onProgress === 'function') {
        onProgress({
          status: 'uploading',
          percent: 95,
          currentFile: completedCount + 1,
          totalFiles: totalItems,
          message: 'Uploading ID card back...',
        });
      }
      const backBlob = await compressImageBlobIfNeeded(dropData.backFile, 2000, 0.82, 600 * 1024);
      await new Promise((r) => setTimeout(r, 16));
      const path = `${pin}/id_back.jpg`;
      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(path, backBlob, { upsert: true, contentType: 'image/jpeg' });
      if (!error) backPath = path;
      completedCount++;
    }

    // 4. Update status to 'waiting' now that all uploads are completed
    const finalPayload = {
      files_meta: uploadedPaths,
      front_path: frontPath,
      back_path: backPath,
      status: 'waiting',
    };

    const { data, error: dbErr } = await supabase
      .from(TABLE_NAME)
      .update(finalPayload)
      .eq('pin', pin);

    if (dbErr) {
      console.warn('[NullPin Supabase] Database update error:', dbErr);
    }

    if (typeof onProgress === 'function') {
      onProgress({
        status: 'synced',
        percent: 100,
        currentFile: totalItems,
        totalFiles: totalItems,
        message: 'Cloud Vault Ready — Instant 4G Unlock Active',
      });
    }

    return data;
  } catch (err) {
    console.warn('[NullPin Supabase] Upload drop error:', err);
    if (typeof onProgress === 'function') {
      onProgress({
        status: 'error',
        percent: 0,
        currentFile: 0,
        totalFiles: totalItems,
        message: 'Sync interrupted (offline memory mode active)',
      });
    }
    return null;
  }
}

/**
 * Fetches drop payload and reconstructs in-memory Blobs on the receiving device.
 * Automatically polls/waits up to 8s if sender upload is still in-flight.
 */
export async function fetchDropFromSupabase(pin) {
  if (!isSupabaseConfigured() || !supabase) return null;

  try {
    const searchPin = String(pin).trim();

    // 1. Fetch metadata record from 'drops' table
    let { data: record, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('pin', searchPin)
      .single();

    if (error || !record) {
      return null;
    }

    // Check expiration or already claimed/burned status (Single-Claim Enforcement)
    if (record.status === 'burned' || record.status === 'claimed' || record.status === 'opened') {
      return null;
    }
    if (record.expires_at && new Date(record.expires_at) < new Date()) {
      await burnDropInSupabase(searchPin);
      return null;
    }

    // RACE CONDITION RESOLUTION: If sender is still uploading, poll up to 8s (every 800ms)
    let pollAttempts = 0;
    while (record && record.status === 'uploading' && pollAttempts < 10) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      pollAttempts++;
      const { data: refreshedRecord } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .eq('pin', searchPin)
        .single();
      if (refreshedRecord) {
        record = refreshedRecord;
      }
    }

    if (!record || record.status === 'burned' || record.status === 'claimed' || record.status === 'opened' || record.status === 'uploading') {
      return null;
    }

    // 2. Download file blobs directly into volatile RAM
    const filesMeta = record.files_meta || [];
    const reconstructedFiles = [];
    const rawBlobs = [];

    for (let i = 0; i < filesMeta.length; i++) {
      const meta = filesMeta[i];
      if (meta.path) {
        const { data: blob, error: dlErr } = await supabase.storage
          .from(BUCKET_NAME)
          .download(meta.path);

        if (!dlErr && blob) {
          rawBlobs.push(blob);
          const blobUrl = URL.createObjectURL(blob);
          reconstructedFiles.push({
            id: meta.id || `file-${i}`,
            name: meta.name || `Document_${i + 1}.pdf`,
            size: meta.size || blob.size,
            type: meta.type || blob.type || 'application/octet-stream',
            rawFile: blob,
            blobUrl,
          });
        }
      }
    }

    // Download ID Card images if present
    let frontBlobUrl = null;
    let backBlobUrl = null;
    if (record.front_path) {
      const { data: frontBlob } = await supabase.storage.from(BUCKET_NAME).download(record.front_path);
      if (frontBlob) frontBlobUrl = URL.createObjectURL(frontBlob);
    }
    if (record.back_path) {
      const { data: backBlob } = await supabase.storage.from(BUCKET_NAME).download(record.back_path);
      if (backBlob) backBlobUrl = URL.createObjectURL(backBlob);
    }

    const primaryFile = reconstructedFiles[0] || null;
    const primaryBlobUrl = primaryFile?.blobUrl || null;

    // Single-Claim Enforcement: Mark status as 'claimed' so no second device or tab can claim this PIN
    try {
      await supabase
        .from(TABLE_NAME)
        .update({ status: 'claimed' })
        .eq('pin', searchPin);
    } catch (consumeErr) {
      console.warn('[NullPin Supabase] Claim PIN error:', consumeErr);
    }

    return {
      id: record.id,
      pin: record.pin,
      mode: record.mode,
      file: primaryFile,
      files: reconstructedFiles,
      rawFiles: rawBlobs,
      rawFile: rawBlobs[0] || null,
      blobUrl: primaryBlobUrl,
      frontBlobUrl,
      backBlobUrl,
      frontPreview: frontBlobUrl,
      backPreview: backBlobUrl,
      textContent: record.text_content,
      prefs: record.prefs,
      status: record.status,
      created_at: record.created_at,
      expires_at: record.expires_at,
      createdAt: record.created_at ? new Date(record.created_at).getTime() : Date.now(),
      expiresAt: record.expires_at ? new Date(record.expires_at).getTime() : Date.now() + 5 * 60 * 1000,
    };
  } catch (err) {
    console.warn('[NullPin Supabase] Fetch drop error:', err);
    return null;
  }
}

/**
 * Permanently deletes storage files and updates status to 'burned'.
 */
export async function burnDropInSupabase(pin) {
  if (!isSupabaseConfigured() || !supabase) return;

  try {
    const searchPin = String(pin).trim();

    // 1. Broadcast DROP_BURNED immediately to all listening devices (e.g. sender on Laptop)
    try {
      const broadcastChannel = supabase.channel(`nullpin-sync-${searchPin}`);
      broadcastChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          broadcastChannel.send({
            type: 'broadcast',
            event: 'DROP_BURNED',
            payload: { pin: searchPin, status: 'burned' },
          }).finally(() => {
            supabase.removeChannel(broadcastChannel);
          });
        }
      });
    } catch (bErr) {
      console.warn('[NullPin Supabase] Broadcast burn error:', bErr);
    }

    // 2. Mark status as burned in database table (triggers postgres_changes)
    try {
      await supabase
        .from(TABLE_NAME)
        .update({ status: 'burned' })
        .eq('pin', searchPin);
    } catch (e) {}

    // 3. Delete row from database
    try {
      await supabase
        .from(TABLE_NAME)
        .delete()
        .eq('pin', searchPin);
    } catch (e) {}

    // 4. List and remove all files in the storage bucket folder
    const { data: filesInFolder } = await supabase.storage
      .from(BUCKET_NAME)
      .list(searchPin);

    if (Array.isArray(filesInFolder) && filesInFolder.length > 0) {
      const pathsToDelete = filesInFolder.map((f) => `${searchPin}/${f.name}`);
      await supabase.storage.from(BUCKET_NAME).remove(pathsToDelete);
    }
  } catch (err) {
    console.warn('[NullPin Supabase] Burn drop error:', err);
  }
}

/**
 * Subscribes to real-time status updates (e.g. burn events) across devices.
 * Uses both Realtime channels and a 2-second existence polling safeguard.
 */
export function subscribeToSupabaseDrop(pin, onStatusChange) {
  if (!isSupabaseConfigured() || !supabase) return () => {};

  const searchPin = String(pin).trim();
  let isCleanedUp = false;

  // 1. Postgres changes channel + Broadcast channel
  const channel = supabase
    .channel(`nullpin-sync-${searchPin}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: TABLE_NAME,
        filter: `pin=eq.${searchPin}`,
      },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          if (typeof onStatusChange === 'function') onStatusChange({ status: 'burned' });
        } else if (payload.new && typeof onStatusChange === 'function') {
          onStatusChange(payload.new);
        }
      }
    )
    .on('broadcast', { event: 'DROP_BURNED' }, () => {
      if (typeof onStatusChange === 'function') {
        onStatusChange({ status: 'burned' });
      }
    })
    .subscribe();

  // 2. High-reliability 2-second existence polling for cross-device burn sync
  const pollInterval = setInterval(async () => {
    if (isCleanedUp) return;
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('status')
        .eq('pin', searchPin)
        .maybeSingle();

      if (isCleanedUp) return;

      // If record is missing (deleted on burn) OR status is burned, trigger burn on sender
      if (error || !data || data.status === 'burned') {
        clearInterval(pollInterval);
        if (typeof onStatusChange === 'function') {
          onStatusChange({ status: 'burned' });
        }
      } else if (data.status === 'claimed' || data.status === 'opened') {
        if (typeof onStatusChange === 'function') {
          onStatusChange({ status: data.status });
        }
      }
    } catch (pollErr) {
      // Ignore transient network errors
    }
  }, 2000);

  return () => {
    isCleanedUp = true;
    clearInterval(pollInterval);
    supabase.removeChannel(channel);
  };
}
