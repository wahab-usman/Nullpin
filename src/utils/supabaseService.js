import { supabase, isSupabaseConfigured } from './supabaseClient';

export const BUCKET_NAME = 'nullpin-drops';
export const TABLE_NAME = 'drops';

/**
 * Client-Side Image Compression (Fast Mobile 4G Uploads):
 * If an image (JPEG, PNG, WEBP) is larger than 600KB,
 * compress in browser memory via HTML5 <canvas> (max dimension 2000px, JPEG quality 0.82)
 * so large phone photos upload in 1 second over cellular networks while maintaining print quality.
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
          resolve(blob);
          return;
        }

        // Fill white background for clean printouts & PNG alpha conversion
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (compressed) => {
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
 * Uploads drop metadata and file payloads to Supabase Storage + Database.
 * Runs in parallel with local memory stores so the UI never stalls.
 */
export async function uploadDropToSupabase(dropData) {
  if (!isSupabaseConfigured() || !supabase) return null;

  // Run garbage collector silently in background on new drop creation
  cleanupExpiredDrops().catch(() => {});

  try {
    const pin = String(dropData.pin);
    const filesToUpload = Array.isArray(dropData.files) && dropData.files.length > 0
      ? dropData.files
      : dropData.file
      ? [dropData.file]
      : [];

    const uploadedPaths = [];

    // 1. Upload file blobs to Supabase Storage bucket with client compression
    for (let i = 0; i < filesToUpload.length; i++) {
      const fileItem = filesToUpload[i];
      let rawBlob = fileItem.rawFile instanceof Blob ? fileItem.rawFile : null;

      if (rawBlob) {
        // Compress images over 600KB for fast 1s mobile 4G upload
        rawBlob = await compressImageBlobIfNeeded(rawBlob, 2000, 0.82, 600 * 1024);

        const safeName = (fileItem.name || `file_${i + 1}`).replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `${pin}/${i}_${safeName}`;

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
      }
    }

    // 2. Upload front & back ID card images if present (with compression)
    let frontPath = null;
    let backPath = null;

    if (dropData.frontFile instanceof Blob) {
      const frontBlob = await compressImageBlobIfNeeded(dropData.frontFile, 2000, 0.82, 600 * 1024);
      const path = `${pin}/id_front.jpg`;
      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(path, frontBlob, { upsert: true, contentType: 'image/jpeg' });
      if (!error) frontPath = path;
    }

    if (dropData.backFile instanceof Blob) {
      const backBlob = await compressImageBlobIfNeeded(dropData.backFile, 2000, 0.82, 600 * 1024);
      const path = `${pin}/id_back.jpg`;
      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(path, backBlob, { upsert: true, contentType: 'image/jpeg' });
      if (!error) backPath = path;
    }

    // 3. Insert record into database table with strict 5-minute expiry
    const recordPayload = {
      pin,
      id: dropData.id || `DROP-${pin}`,
      mode: dropData.mode || 'doc',
      files_meta: uploadedPaths,
      front_path: frontPath,
      back_path: backPath,
      text_content: dropData.textContent || '',
      prefs: dropData.prefs || {},
      status: 'waiting',
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    };

    const { data, error: dbErr } = await supabase
      .from(TABLE_NAME)
      .upsert(recordPayload, { onConflict: 'pin' });

    if (dbErr) {
      console.warn('[NullPin Supabase] Database insert error:', dbErr);
    }

    return data;
  } catch (err) {
    console.warn('[NullPin Supabase] Upload drop error:', err);
    return null;
  }
}

/**
 * Fetches drop payload and reconstructs in-memory Blobs on the receiving device.
 */
export async function fetchDropFromSupabase(pin) {
  if (!isSupabaseConfigured() || !supabase) return null;

  try {
    const searchPin = String(pin).trim();

    // 1. Fetch metadata record from 'drops' table
    const { data: record, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('pin', searchPin)
      .single();

    if (error || !record) {
      return null;
    }

    // Check expiration or burned status (Strict 5-minute cutoff)
    if (record.status === 'burned') {
      return null;
    }
    if (record.expires_at && new Date(record.expires_at) < new Date()) {
      await burnDropInSupabase(searchPin);
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

    // 1. Mark status as burned in database
    await supabase
      .from(TABLE_NAME)
      .update({ status: 'burned' })
      .eq('pin', searchPin);

    // 2. List and remove all files in the storage bucket folder
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
 */
export function subscribeToSupabaseDrop(pin, onStatusChange) {
  if (!isSupabaseConfigured() || !supabase) return () => {};

  const searchPin = String(pin).trim();
  const channel = supabase
    .channel(`drop-status-${searchPin}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: TABLE_NAME,
        filter: `pin=eq.${searchPin}`,
      },
      (payload) => {
        if (payload.new && typeof onStatusChange === 'function') {
          onStatusChange(payload.new);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
