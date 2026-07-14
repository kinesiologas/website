const runtimeEnv = import.meta.env ?? {};

export const MODEL_IMAGE_BUCKET = 'model-images';
export const MODEL_VIDEO_BUCKET = 'model-videos';

const IMAGE_MAX_BYTES = (1 * 1024 * 1024) - 1;
const VIDEO_MAX_BYTES = (10 * 1024 * 1024) - 1;
const TUS_CHUNK_SIZE = 6 * 1024 * 1024;
const supabaseUrl = (runtimeEnv.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '');
const supabaseAnonKey = runtimeEnv.VITE_SUPABASE_ANON_KEY ?? '';

export const MODEL_MEDIA_SLOTS = Object.freeze({
  cover_image: Object.freeze({
    accept: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp',
    bucket: MODEL_IMAGE_BUCKET,
    kind: 'image',
    label: 'Imagen de portada para escritorio',
    maxBytes: IMAGE_MAX_BYTES,
    required: true,
    storageSubdir: 'cover-desktop',
  }),
  cover_desktop_video: Object.freeze({
    accept: '.mp4,.webm,video/mp4,video/webm',
    bucket: MODEL_VIDEO_BUCKET,
    kind: 'video',
    label: 'Video de portada para escritorio',
    maxBytes: VIDEO_MAX_BYTES,
    required: false,
    storageSubdir: 'cover-desktop',
  }),
  cover_mobile_image: Object.freeze({
    accept: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp',
    bucket: MODEL_IMAGE_BUCKET,
    kind: 'image',
    label: 'Imagen de portada para celular',
    maxBytes: IMAGE_MAX_BYTES,
    required: false,
    storageSubdir: 'cover-mobile',
  }),
  cover_mobile_video: Object.freeze({
    accept: '.mp4,.webm,video/mp4,video/webm',
    bucket: MODEL_VIDEO_BUCKET,
    kind: 'video',
    label: 'Video de portada para celular',
    maxBytes: VIDEO_MAX_BYTES,
    required: false,
    storageSubdir: 'cover-mobile',
  }),
  profile_image: Object.freeze({
    accept: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp',
    bucket: MODEL_IMAGE_BUCKET,
    kind: 'image',
    label: 'Foto publica de perfil',
    maxBytes: IMAGE_MAX_BYTES,
    required: true,
    storageSubdir: 'profile',
  }),
});

export const MODEL_MEDIA_SLOT_KEYS = Object.freeze(Object.keys(MODEL_MEDIA_SLOTS));

const MODEL_MEDIA_COLUMNS = MODEL_MEDIA_SLOT_KEYS.join(', ');
const FILE_FORMATS = Object.freeze({
  image: Object.freeze({
    '.jpeg': Object.freeze({ contentType: 'image/jpeg', extension: 'jpg', mimeTypes: ['image/jpeg', 'image/jpg'] }),
    '.jpg': Object.freeze({ contentType: 'image/jpeg', extension: 'jpg', mimeTypes: ['image/jpeg', 'image/jpg'] }),
    '.png': Object.freeze({ contentType: 'image/png', extension: 'png', mimeTypes: ['image/png'] }),
    '.webp': Object.freeze({ contentType: 'image/webp', extension: 'webp', mimeTypes: ['image/webp'] }),
  }),
  video: Object.freeze({
    '.mp4': Object.freeze({ contentType: 'video/mp4', extension: 'mp4', mimeTypes: ['video/mp4'] }),
    '.webm': Object.freeze({ contentType: 'video/webm', extension: 'webm', mimeTypes: ['video/webm'] }),
  }),
});

function joinUrl(baseUrl, path) {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${normalizedBase}${path.replace(/^\/+/, '')}`;
}

function resolveLegacyAssetUrl(path, { baseUrl, r2PublicUrl } = {}) {
  if (/^(https?:|data:|blob:)/i.test(path)) {
    return path;
  }

  const normalizedPath = path.replace(/^r2:\/\//i, '').replace(/^\/+/, '');
  const configuredR2Url = r2PublicUrl ?? runtimeEnv.VITE_R2_PUBLIC_URL;

  if (configuredR2Url) {
    return joinUrl(configuredR2Url, normalizedPath);
  }

  return joinUrl(baseUrl ?? runtimeEnv.BASE_URL ?? '/', normalizedPath);
}

function getFileExtension(fileName = '') {
  const lastDot = fileName.lastIndexOf('.');
  return lastDot >= 0 ? fileName.slice(lastDot).toLowerCase() : '';
}

function makeUuid() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  const randomBytes = new Uint8Array(16);

  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(randomBytes);
  } else {
    for (let index = 0; index < randomBytes.length; index += 1) {
      randomBytes[index] = Math.floor(Math.random() * 256);
    }
  }

  randomBytes[6] = (randomBytes[6] & 0x0f) | 0x40;
  randomBytes[8] = (randomBytes[8] & 0x3f) | 0x80;
  const hexadecimal = [...randomBytes].map((value) => value.toString(16).padStart(2, '0')).join('');

  return [
    hexadecimal.slice(0, 8),
    hexadecimal.slice(8, 12),
    hexadecimal.slice(12, 16),
    hexadecimal.slice(16, 20),
    hexadecimal.slice(20),
  ].join('-');
}

function normalizeModelId(modelId) {
  const normalized = typeof modelId === 'string' ? modelId.trim() : '';

  if (!normalized || !/^[a-z0-9_-]+$/i.test(normalized)) {
    throw new Error('El identificador del modelo no es valido para almacenar medios.');
  }

  return normalized;
}

function formatMediaKey(bucket, objectPath) {
  return `${bucket}://${objectPath}`;
}

function mediaMatchPayload(media, payload) {
  return Boolean(media) && MODEL_MEDIA_SLOT_KEYS.every((slot) => media[slot] === payload[slot]);
}

async function getSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase no esta configurado. Completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.');
  }

  const { supabase } = await import('../lib/supabaseClient.js');

  if (!supabase) {
    throw new Error('Supabase no esta configurado. Completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.');
  }

  return supabase;
}

async function readModelMedia(client, modelId) {
  const { data, error } = await client
    .from('models')
    .select(MODEL_MEDIA_COLUMNS)
    .eq('id', modelId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? normalizeModelMedia(data) : null;
}

async function verifyModelMediaUpdate(
  client,
  modelId,
  payload,
  { verificationDelays, wait },
) {
  let lastMedia = null;

  for (const delayMilliseconds of verificationDelays) {
    if (delayMilliseconds) {
      await wait(delayMilliseconds);
    }

    try {
      lastMedia = await readModelMedia(client, modelId);

      if (mediaMatchPayload(lastMedia, payload)) {
        return { applied: true, media: lastMedia };
      }
    } catch {
      // A late commit or a temporary network failure can make the update result ambiguous.
    }
  }

  return { applied: false, media: lastMedia };
}

async function tryDeleteModelMediaObjects(mediaKeys, modelId, deleteObjects) {
  if (!mediaKeys?.length) {
    return null;
  }

  try {
    await deleteObjects(mediaKeys, { modelId });
    return null;
  } catch (error) {
    return error;
  }
}

export function normalizeModelMedia(media = {}) {
  return MODEL_MEDIA_SLOT_KEYS.reduce((normalized, slot) => {
    normalized[slot] = typeof media?.[slot] === 'string' && media[slot].trim()
      ? media[slot].trim()
      : null;
    return normalized;
  }, {});
}

export function parseModelMediaKey(mediaKey, { modelId, slot } = {}) {
  if (typeof mediaKey !== 'string' || mediaKey.includes('..')) {
    return null;
  }

  const match = mediaKey.trim().match(/^(model-images|model-videos):\/\/(.+)$/);

  if (!match) {
    return null;
  }

  const [, bucket, objectPath] = match;
  const pathParts = objectPath.split('/');

  if (pathParts.length !== 4 || pathParts[0] !== 'models') {
    return null;
  }

  const [, storedModelId, storageSubdir, fileName] = pathParts;

  const versionedFileMatch = fileName.match(
    /^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.(jpe?g|png|webp|mp4|webm)$/i,
  );

  if (!/^[a-z0-9_-]+$/i.test(storedModelId) || !versionedFileMatch) {
    return null;
  }

  const matchedSlot = MODEL_MEDIA_SLOT_KEYS.find((candidate) => {
    const config = MODEL_MEDIA_SLOTS[candidate];
    return config.bucket === bucket && config.storageSubdir === storageSubdir;
  });

  if (!matchedSlot || (modelId && storedModelId !== modelId) || (slot && matchedSlot !== slot)) {
    return null;
  }

  const extension = getFileExtension(fileName);

  if (!FILE_FORMATS[MODEL_MEDIA_SLOTS[matchedSlot].kind][extension]) {
    return null;
  }

  return {
    bucket,
    mediaKey: formatMediaKey(bucket, objectPath),
    modelId: storedModelId,
    objectPath,
    slot: matchedSlot,
  };
}

export function resolveModelMediaUrl(path, options = {}) {
  if (typeof path !== 'string' || !path.trim()) {
    return '';
  }

  const normalizedPath = path.trim();
  const parsed = parseModelMediaKey(normalizedPath);

  if (!parsed) {
    return resolveLegacyAssetUrl(normalizedPath, options);
  }

  const configuredSupabaseUrl = (options.supabaseUrl ?? supabaseUrl).replace(/\/+$/, '');

  if (!configuredSupabaseUrl) {
    return '';
  }

  const encodedObjectPath = parsed.objectPath.split('/').map(encodeURIComponent).join('/');
  return `${configuredSupabaseUrl}/storage/v1/object/public/${parsed.bucket}/${encodedObjectPath}`;
}

export function validateModelMediaFile(slot, file) {
  const slotConfig = MODEL_MEDIA_SLOTS[slot];

  if (!slotConfig) {
    throw new Error('El espacio de medios del perfil seleccionado no es valido.');
  }

  if (!file || typeof file.name !== 'string' || !Number.isFinite(file.size)) {
    throw new Error(`Selecciona un archivo para ${slotConfig.label.toLowerCase()}.`);
  }

  const extension = getFileExtension(file.name);
  const format = FILE_FORMATS[slotConfig.kind][extension];
  const mimeType = (file.type || '').toLowerCase();

  if (!format || !format.mimeTypes.includes(mimeType)) {
    const allowed = slotConfig.kind === 'image' ? 'JPEG, PNG o WebP' : 'MP4 o WebM';
    throw new Error(`${slotConfig.label}: formato no valido. Usa ${allowed}.`);
  }

  if (file.size <= 0) {
    throw new Error(`${slotConfig.label}: el archivo esta vacio.`);
  }

  if (file.size > slotConfig.maxBytes) {
    const limit = slotConfig.kind === 'image' ? '1 MB' : '10 MB';
    throw new Error(`${slotConfig.label}: el archivo debe pesar menos de ${limit}.`);
  }

  return {
    bucket: slotConfig.bucket,
    contentType: format.contentType,
    extension: format.extension,
    kind: slotConfig.kind,
    maxBytes: slotConfig.maxBytes,
  };
}

export function createModelMediaObjectPath(modelId, slot, extension) {
  const normalizedModelId = normalizeModelId(modelId);
  const slotConfig = MODEL_MEDIA_SLOTS[slot];

  if (!slotConfig) {
    throw new Error('El espacio de medios del perfil seleccionado no es valido.');
  }

  const safeExtension = String(extension).toLowerCase().replace(/^\./, '');
  const format = FILE_FORMATS[slotConfig.kind][`.${safeExtension}`];

  if (!format) {
    throw new Error('La extension del medio del perfil no es valida para este espacio.');
  }

  const objectPath = `models/${normalizedModelId}/${slotConfig.storageSubdir}/${makeUuid()}.${format.extension}`;
  return formatMediaKey(slotConfig.bucket, objectPath);
}

export async function uploadModelMediaFile({ file, mediaKey, modelId, onProgress, slot }) {
  const normalizedModelId = normalizeModelId(modelId);
  const fileInfo = validateModelMediaFile(slot, file);
  const parsedMediaKey = parseModelMediaKey(mediaKey, { modelId: normalizedModelId, slot });

  if (!parsedMediaKey || parsedMediaKey.bucket !== fileInfo.bucket) {
    throw new Error('La ruta de destino del medio del perfil no es valida.');
  }

  const client = await getSupabaseClient();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  const accessToken = sessionData?.session?.access_token;

  if (!accessToken) {
    throw new Error('Tu sesion expiro. Inicia sesion nuevamente para subir medios.');
  }

  const { Upload } = await import('tus-js-client');

  return new Promise((resolve, reject) => {
    let activeMediaKey = parsedMediaKey.mediaKey;
    onProgress?.({ bytesUploaded: 0, bytesTotal: file.size, percent: 0, slot });

    const upload = new Upload(file, {
      chunkSize: TUS_CHUNK_SIZE,
      endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
      fingerprint: async (nextFile) => [
        supabaseUrl,
        fileInfo.bucket,
        normalizedModelId,
        slot,
        nextFile.name,
        nextFile.type,
        nextFile.size,
        nextFile.lastModified ?? 0,
      ].join('::'),
      headers: {
        apikey: supabaseAnonKey,
        authorization: `Bearer ${accessToken}`,
        'x-upsert': 'false',
      },
      metadata: {
        bucketName: fileInfo.bucket,
        cacheControl: '31536000',
        contentType: fileInfo.contentType,
        objectName: parsedMediaKey.objectPath,
      },
      onError(error) {
        reject(error instanceof Error ? error : new Error('No se pudo subir el medio del perfil.'));
      },
      onProgress(bytesUploaded, bytesTotal) {
        const percent = bytesTotal ? Math.round((bytesUploaded / bytesTotal) * 100) : 0;
        onProgress?.({ bytesUploaded, bytesTotal, percent, slot });
      },
      onSuccess() {
        onProgress?.({ bytesUploaded: file.size, bytesTotal: file.size, percent: 100, slot });
        resolve(activeMediaKey);
      },
      removeFingerprintOnSuccess: true,
      retryDelays: [0, 1000, 3000, 5000, 10000],
      uploadDataDuringCreation: true,
      uploadSize: file.size,
    });

    upload.findPreviousUploads()
      .then((previousUploads) => {
        const slotPrefix = `models/${normalizedModelId}/${MODEL_MEDIA_SLOTS[slot].storageSubdir}/`;
        const previousUpload = previousUploads
          .filter((item) => (
            item.metadata?.bucketName === fileInfo.bucket
            && item.metadata?.contentType === fileInfo.contentType
            && typeof item.metadata?.objectName === 'string'
            && item.metadata.objectName.startsWith(slotPrefix)
            && parseModelMediaKey(formatMediaKey(fileInfo.bucket, item.metadata.objectName), {
              modelId: normalizedModelId,
              slot,
            })
          ))
          .sort((left, right) => new Date(right.creationTime) - new Date(left.creationTime))[0];

        if (previousUpload) {
          activeMediaKey = formatMediaKey(fileInfo.bucket, previousUpload.metadata.objectName);
          upload.options.metadata.objectName = previousUpload.metadata.objectName;
          upload.resumeFromPreviousUpload(previousUpload);
        }

        upload.start();
      })
      .catch((error) => reject(error instanceof Error ? error : new Error('No se pudo reanudar la carga.')));
  });
}

export async function deleteModelMediaObjects(mediaKeys, { modelId } = {}) {
  const normalizedModelId = modelId ? normalizeModelId(modelId) : null;
  const objectsByBucket = new Map();

  [...new Set(mediaKeys ?? [])].forEach((mediaKey) => {
    const parsed = parseModelMediaKey(mediaKey, { modelId: normalizedModelId ?? undefined });

    if (!parsed) {
      return;
    }

    const bucketPaths = objectsByBucket.get(parsed.bucket) ?? [];
    bucketPaths.push(parsed.objectPath);
    objectsByBucket.set(parsed.bucket, bucketPaths);
  });

  if (!objectsByBucket.size) {
    return;
  }

  const client = await getSupabaseClient();
  const results = await Promise.all(
    [...objectsByBucket.entries()].map(([bucket, objectPaths]) => client.storage.from(bucket).remove(objectPaths)),
  );
  const failedResult = results.find(({ error }) => error);

  if (failedResult?.error) {
    throw failedResult.error;
  }
}

function resolveTransactionDependencies(dependencies = {}) {
  const resolved = {
    deleteObjects: dependencies.deleteObjects ?? deleteModelMediaObjects,
    getClient: dependencies.getClient ?? getSupabaseClient,
    uploadFile: dependencies.uploadFile ?? uploadModelMediaFile,
    verificationDelays: dependencies.verificationDelays ?? [0, 300, 1200],
    wait: dependencies.wait ?? ((milliseconds) => new Promise((resolve) => {
      globalThis.setTimeout(resolve, milliseconds);
    })),
  };

  if (
    typeof resolved.deleteObjects !== 'function'
    || typeof resolved.getClient !== 'function'
    || typeof resolved.uploadFile !== 'function'
    || typeof resolved.wait !== 'function'
    || !Array.isArray(resolved.verificationDelays)
    || !resolved.verificationDelays.length
    || resolved.verificationDelays.some((delay) => !Number.isFinite(delay) || delay < 0)
  ) {
    throw new Error('Las dependencias del servicio de medios no son validas.');
  }

  return Object.freeze({
    ...resolved,
    verificationDelays: Object.freeze([...resolved.verificationDelays]),
  });
}

async function saveModelMediaTransaction({
  modelId,
  currentMedia = {},
  files = {},
  removals = [],
  onProgress,
} = {}, dependencies) {
  const {
    deleteObjects,
    getClient,
    uploadFile,
    verificationDelays,
    wait,
  } = dependencies;
  const normalizedModelId = normalizeModelId(modelId);
  const selectedFiles = files && typeof files === 'object' ? files : {};

  if (!Array.isArray(removals)) {
    throw new Error('La lista de medios que se eliminaran no es valida.');
  }

  const invalidFileSlot = Object.keys(selectedFiles).find((slot) => !MODEL_MEDIA_SLOTS[slot]);
  const invalidRemovalSlot = removals.find((slot) => !MODEL_MEDIA_SLOTS[slot]);

  if (invalidFileSlot || invalidRemovalSlot) {
    throw new Error('Uno de los espacios de medios del perfil no es valido.');
  }

  const requiredRemovalSlot = removals.find((slot) => MODEL_MEDIA_SLOTS[slot].required);

  if (requiredRemovalSlot) {
    throw new Error(`${MODEL_MEDIA_SLOTS[requiredRemovalSlot].label} es obligatoria y no se puede eliminar.`);
  }

  const normalizedCurrentMedia = normalizeModelMedia(currentMedia);
  const removalSet = new Set(removals);
  const preparedUploads = Object.entries(selectedFiles)
    .filter(([, file]) => Boolean(file))
    .map(([slot, file]) => {
      const fileInfo = validateModelMediaFile(slot, file);
      const mediaKey = createModelMediaObjectPath(normalizedModelId, slot, fileInfo.extension);
      return { file, mediaKey, slot };
    });

  for (const slot of MODEL_MEDIA_SLOT_KEYS.filter((candidate) => MODEL_MEDIA_SLOTS[candidate].required)) {
    const hasReplacement = preparedUploads.some((upload) => upload.slot === slot);

    if (!hasReplacement && !normalizedCurrentMedia[slot]) {
      throw new Error(`${MODEL_MEDIA_SLOTS[slot].label} es obligatoria.`);
    }
  }

  if (!preparedUploads.length && !removalSet.size) {
    return { cleanupWarning: '', media: normalizedCurrentMedia };
  }

  const uploadResults = await Promise.allSettled(
    preparedUploads.map(({ file, mediaKey, slot }) => uploadFile({
      file,
      mediaKey,
      modelId: normalizedModelId,
      onProgress,
      slot,
    })),
  );
  const failedUpload = uploadResults.find((result) => result.status === 'rejected');
  const successfulUploads = uploadResults
    .map((result, index) => result.status === 'fulfilled'
      ? { ...preparedUploads[index], mediaKey: result.value }
      : null)
    .filter(Boolean);

  if (failedUpload) {
    const rollbackError = await tryDeleteModelMediaObjects(
      successfulUploads.map(({ mediaKey }) => mediaKey),
      normalizedModelId,
      deleteObjects,
    );
    const rollbackMessage = rollbackError ? ' Tambien fallo la limpieza de archivos parciales.' : '';
    throw new Error(`No se guardo ningun cambio: ${failedUpload.reason?.message || 'fallo una carga.'}${rollbackMessage}`);
  }

  const client = await getClient();
  let freshMedia;

  try {
    freshMedia = await readModelMedia(client, normalizedModelId);

    if (!freshMedia) {
      throw new Error('El modelo no existe o no tienes permiso para modificarlo.');
    }
  } catch (error) {
    const rollbackError = await tryDeleteModelMediaObjects(
      successfulUploads.map(({ mediaKey }) => mediaKey),
      normalizedModelId,
      deleteObjects,
    );
    const rollbackMessage = rollbackError ? ' Tambien fallo la limpieza de los archivos nuevos.' : '';
    throw new Error(`No se pudo comprobar el estado actual de los medios. ${error?.message || 'Fallo la consulta.'}${rollbackMessage}`);
  }

  const nextMedia = normalizeModelMedia(freshMedia);

  removalSet.forEach((slot) => {
    if (!selectedFiles[slot]) {
      nextMedia[slot] = null;
    }
  });
  successfulUploads.forEach(({ mediaKey, slot }) => {
    nextMedia[slot] = mediaKey;
  });

  const missingRequiredSlot = MODEL_MEDIA_SLOT_KEYS.find((slot) => (
    MODEL_MEDIA_SLOTS[slot].required && !nextMedia[slot]
  ));

  if (missingRequiredSlot) {
    const rollbackError = await tryDeleteModelMediaObjects(
      successfulUploads.map(({ mediaKey }) => mediaKey),
      normalizedModelId,
      deleteObjects,
    );
    const rollbackMessage = rollbackError ? ' Tambien fallo la limpieza de los archivos nuevos.' : '';
    throw new Error(`${MODEL_MEDIA_SLOTS[missingRequiredSlot].label} es obligatoria.${rollbackMessage}`);
  }

  const payload = normalizeModelMedia(nextMedia);
  let updateResult;
  let updateThrew = false;

  try {
    let updateQuery = client
      .from('models')
      .update(payload)
      .eq('id', normalizedModelId);

    MODEL_MEDIA_SLOT_KEYS.forEach((slot) => {
      updateQuery = freshMedia[slot] === null
        ? updateQuery.is(slot, null)
        : updateQuery.eq(slot, freshMedia[slot]);
    });

    updateResult = await updateQuery.select(MODEL_MEDIA_COLUMNS).maybeSingle();
  } catch (caughtError) {
    updateThrew = true;
    updateResult = { data: null, error: caughtError, status: 0 };
  }

  const { data, error, status } = updateResult;
  let savedMedia;

  if (error || !data) {
    const verification = await verifyModelMediaUpdate(client, normalizedModelId, payload, {
      verificationDelays,
      wait,
    });

    if (verification.applied) {
      savedMedia = verification.media;
    } else {
      const updateResultIsAmbiguous = updateThrew
        || (Boolean(error) && (!status || status >= 500 || !error.code));
      const referencedKeys = new Set(
        MODEL_MEDIA_SLOT_KEYS.map((slot) => verification.media?.[slot]).filter(Boolean),
      );
      const rollbackKeys = updateResultIsAmbiguous
        ? []
        : successfulUploads
          .map(({ mediaKey }) => mediaKey)
          .filter((mediaKey) => !referencedKeys.has(mediaKey));
      const rollbackError = await tryDeleteModelMediaObjects(
        rollbackKeys,
        normalizedModelId,
        deleteObjects,
      );
      const rollbackMessage = rollbackError
        ? ' Tambien fallo la limpieza de los archivos nuevos.'
        : updateResultIsAmbiguous
          ? ' Los archivos nuevos se conservaron porque el resultado final del guardado es ambiguo.'
          : '';
      const updateMessage = error?.message || 'El modelo no existe o no tienes permiso para modificarlo.';
      throw new Error(`No se pudieron actualizar los medios del perfil. ${updateMessage}${rollbackMessage}`);
    }
  } else {
    savedMedia = normalizeModelMedia(data);
  }

  const activeKeys = new Set(MODEL_MEDIA_SLOT_KEYS.map((slot) => savedMedia[slot]).filter(Boolean));
  const replacedKeys = MODEL_MEDIA_SLOT_KEYS
    .filter((slot) => freshMedia[slot] && freshMedia[slot] !== savedMedia[slot])
    .map((slot) => freshMedia[slot])
    .filter((mediaKey) => !activeKeys.has(mediaKey));
  const cleanupError = await tryDeleteModelMediaObjects(
    replacedKeys,
    normalizedModelId,
    deleteObjects,
  );

  return {
    cleanupWarning: cleanupError
      ? 'Los medios se guardaron, pero algunos archivos anteriores no pudieron eliminarse.'
      : '',
    media: savedMedia,
  };
}

export function createModelMediaService(dependencies = {}) {
  const resolvedDependencies = resolveTransactionDependencies(dependencies);

  return Object.freeze({
    saveModelMedia(options) {
      return saveModelMediaTransaction(options, resolvedDependencies);
    },
  });
}

export async function saveModelMedia(options = {}) {
  return saveModelMediaTransaction(options, resolveTransactionDependencies());
}
