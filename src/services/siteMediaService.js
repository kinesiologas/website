import { supabase } from '../lib/supabaseClient.js';
import { runSupabaseQuery } from '../lib/supabaseQuery.js';

export const SITE_MEDIA_BUCKET = 'site-media';
export const HOME_SITE_SETTINGS_ID = 'home';

export const HERO_MEDIA_SLOTS = Object.freeze({
  hero_desktop_image: Object.freeze({
    accept: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp',
    kind: 'image',
    label: 'Imagen para escritorio',
    maxBytes: 10 * 1024 * 1024,
  }),
  hero_desktop_video: Object.freeze({
    accept: '.mp4,.webm,video/mp4,video/webm',
    kind: 'video',
    label: 'Video para escritorio',
    maxBytes: 50 * 1024 * 1024,
  }),
  hero_mobile_image: Object.freeze({
    accept: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp',
    kind: 'image',
    label: 'Imagen para celular',
    maxBytes: 10 * 1024 * 1024,
  }),
  hero_mobile_video: Object.freeze({
    accept: '.mp4,.webm,video/mp4,video/webm',
    kind: 'video',
    label: 'Video para celular',
    maxBytes: 50 * 1024 * 1024,
  }),
});

export const HERO_MEDIA_SLOT_KEYS = Object.freeze(Object.keys(HERO_MEDIA_SLOTS));

const SETTINGS_COLUMNS = ['id', ...HERO_MEDIA_SLOT_KEYS, 'updated_at'].join(', ');
const TUS_CHUNK_SIZE = 6 * 1024 * 1024;
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, '') ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

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

function ensureSupabase() {
  if (!supabase || !supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase no esta configurado. Completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.');
  }
}

function emptyHomeSiteSettings() {
  return {
    id: HOME_SITE_SETTINGS_ID,
    hero_desktop_image: null,
    hero_desktop_video: null,
    hero_mobile_image: null,
    hero_mobile_video: null,
    updated_at: null,
  };
}

function normalizeHomeSiteSettings(settings) {
  const normalized = emptyHomeSiteSettings();

  if (!settings) {
    return normalized;
  }

  normalized.id = settings.id || HOME_SITE_SETTINGS_ID;
  normalized.updated_at = settings.updated_at ?? null;

  HERO_MEDIA_SLOT_KEYS.forEach((slot) => {
    normalized[slot] = typeof settings[slot] === 'string' && settings[slot].trim()
      ? settings[slot].trim().replace(/^\/+/, '')
      : null;
  });

  return normalized;
}

function getFileExtension(fileName = '') {
  const lastDot = fileName.lastIndexOf('.');
  return lastDot >= 0 ? fileName.slice(lastDot).toLowerCase() : '';
}

function makeUuid() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isHeroObjectPath(path) {
  return typeof path === 'string' && path.startsWith('hero/') && !path.includes('..');
}

async function tryDeleteSiteMediaObjects(paths) {
  try {
    await deleteSiteMediaObjects(paths);
    return null;
  } catch (error) {
    return error;
  }
}

function settingsMatchPayload(settings, payload) {
  return Boolean(settings)
    && HERO_MEDIA_SLOT_KEYS.every((slot) => settings[slot] === payload[slot]);
}

async function verifyHomeSiteSettingsUpdate(payload) {
  let lastSettings = null;

  for (const delayMilliseconds of [0, 300, 1200]) {
    if (delayMilliseconds) {
      await new Promise((resolve) => globalThis.setTimeout(resolve, delayMilliseconds));
    }

    try {
      lastSettings = await getHomeSiteSettings();

      if (settingsMatchPayload(lastSettings, payload)) {
        return { applied: true, settings: lastSettings };
      }
    } catch {
      // Retry because a late commit or a temporary network failure can make the result ambiguous.
    }
  }

  return { applied: false, settings: lastSettings };
}

export function createEmptyHomeSiteSettings() {
  return emptyHomeSiteSettings();
}

export function resolveSiteMediaUrl(path) {
  if (!path) {
    return '';
  }

  if (/^(https?:|blob:|data:)/i.test(path)) {
    return path;
  }

  if (!supabase) {
    return '';
  }

  const objectPath = path.replace(/^\/+/, '');
  const { data } = supabase.storage.from(SITE_MEDIA_BUCKET).getPublicUrl(objectPath);

  return data?.publicUrl ?? '';
}

export async function getHomeSiteSettings() {
  ensureSupabase();

  const { data, error } = await runSupabaseQuery(
    supabase
      .from('site_settings')
      .select(SETTINGS_COLUMNS)
      .eq('id', HOME_SITE_SETTINGS_ID)
      .maybeSingle(),
    'Supabase site settings',
  );

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('No existe la fila site_settings/home. Aplica la migracion de medios del sitio.');
  }

  return normalizeHomeSiteSettings(data);
}

export async function getPublicSiteSettings() {
  if (!supabase) {
    return emptyHomeSiteSettings();
  }

  try {
    return await getHomeSiteSettings();
  } catch (error) {
    console.warn('La configuracion publica de portada no esta disponible. Se usara la imagen local.', error);
    return emptyHomeSiteSettings();
  }
}

export function validateHeroMediaFile(slot, file) {
  const slotConfig = HERO_MEDIA_SLOTS[slot];

  if (!slotConfig) {
    throw new Error('El espacio de portada seleccionado no es valido.');
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
    const maxMegabytes = Math.round(slotConfig.maxBytes / 1024 / 1024);
    throw new Error(`${slotConfig.label}: el archivo supera el limite de ${maxMegabytes} MB.`);
  }

  return {
    contentType: format.contentType,
    extension: format.extension,
    kind: slotConfig.kind,
    maxBytes: slotConfig.maxBytes,
  };
}

export function createSiteMediaObjectPath(slot, extension) {
  if (!HERO_MEDIA_SLOTS[slot]) {
    throw new Error('El espacio de portada seleccionado no es valido.');
  }

  const safeExtension = String(extension).toLowerCase().replace(/^\./, '');

  if (!['jpg', 'png', 'webp', 'mp4', 'webm'].includes(safeExtension)) {
    throw new Error('La extension del archivo de portada no es valida.');
  }

  return `hero/${slot}/${makeUuid()}.${safeExtension}`;
}

export async function uploadSiteMediaFile({ file, objectPath, onProgress, slot }) {
  ensureSupabase();
  const fileInfo = validateHeroMediaFile(slot, file);

  if (!isHeroObjectPath(objectPath)) {
    throw new Error('La ruta de destino del archivo de portada no es valida.');
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  const accessToken = sessionData?.session?.access_token;

  if (!accessToken) {
    throw new Error('Tu sesion expiro. Inicia sesion nuevamente para subir la portada.');
  }

  const { Upload } = await import('tus-js-client');

  return new Promise((resolve, reject) => {
    let activeObjectPath = objectPath;
    onProgress?.({ bytesUploaded: 0, bytesTotal: file.size, percent: 0, slot });

    const upload = new Upload(file, {
      chunkSize: TUS_CHUNK_SIZE,
      endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
      fingerprint: async (nextFile) => [
        supabaseUrl,
        SITE_MEDIA_BUCKET,
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
        bucketName: SITE_MEDIA_BUCKET,
        cacheControl: '31536000',
        contentType: fileInfo.contentType,
        objectName: objectPath,
      },
      onError(error) {
        reject(error instanceof Error ? error : new Error('No se pudo subir el archivo de portada.'));
      },
      onProgress(bytesUploaded, bytesTotal) {
        const percent = bytesTotal ? Math.round((bytesUploaded / bytesTotal) * 100) : 0;
        onProgress?.({ bytesUploaded, bytesTotal, percent, slot });
      },
      onSuccess() {
        onProgress?.({ bytesUploaded: file.size, bytesTotal: file.size, percent: 100, slot });
        resolve(activeObjectPath);
      },
      retryDelays: [0, 1000, 3000, 5000, 10000],
      removeFingerprintOnSuccess: true,
      uploadDataDuringCreation: true,
      uploadSize: file.size,
    });

    upload.findPreviousUploads()
      .then((previousUploads) => {
        const slotPrefix = `hero/${slot}/`;
        const previousUpload = previousUploads
          .filter((item) => (
            item.metadata?.bucketName === SITE_MEDIA_BUCKET
            && item.metadata?.contentType === fileInfo.contentType
            && isHeroObjectPath(item.metadata?.objectName)
            && item.metadata.objectName.startsWith(slotPrefix)
          ))
          .sort((left, right) => new Date(right.creationTime) - new Date(left.creationTime))[0];

        if (previousUpload) {
          activeObjectPath = previousUpload.metadata.objectName;
          upload.options.metadata.objectName = activeObjectPath;
          upload.resumeFromPreviousUpload(previousUpload);
        }

        upload.start();
      })
      .catch((error) => reject(error instanceof Error ? error : new Error('No se pudo reanudar la carga.')));
  });
}

export async function deleteSiteMediaObjects(paths) {
  ensureSupabase();

  const safePaths = [...new Set((paths ?? []).filter(isHeroObjectPath))];

  if (!safePaths.length) {
    return;
  }

  const { error } = await supabase.storage.from(SITE_MEDIA_BUCKET).remove(safePaths);

  if (error) {
    throw error;
  }
}

export async function saveHomeHeroMedia({ files = {}, onProgress, removals = [] } = {}) {
  ensureSupabase();

  const invalidFileSlot = Object.keys(files).find((slot) => !HERO_MEDIA_SLOTS[slot]);
  const invalidRemovalSlot = removals.find((slot) => !HERO_MEDIA_SLOTS[slot]);

  if (invalidFileSlot || invalidRemovalSlot) {
    throw new Error('Uno de los espacios de portada seleccionados no es valido.');
  }

  const currentSettings = await getHomeSiteSettings();
  const removalSet = new Set(removals);
  const preparedUploads = Object.entries(files)
    .filter(([, file]) => Boolean(file))
    .map(([slot, file]) => {
      const fileInfo = validateHeroMediaFile(slot, file);
      const objectPath = createSiteMediaObjectPath(slot, fileInfo.extension);

      return { file, objectPath, slot };
    });

  const uploadResults = await Promise.allSettled(
    preparedUploads.map(({ file, objectPath, slot }) =>
      uploadSiteMediaFile({ file, objectPath, onProgress, slot }),
    ),
  );
  const failedUpload = uploadResults.find((result) => result.status === 'rejected');
  const successfulUploads = uploadResults
    .map((result, index) => result.status === 'fulfilled'
      ? { ...preparedUploads[index], objectPath: result.value }
      : null)
    .filter(Boolean);

  if (failedUpload) {
    const rollbackError = await tryDeleteSiteMediaObjects(successfulUploads.map(({ objectPath }) => objectPath));
    const rollbackMessage = rollbackError ? ' Tambien fallo la limpieza de archivos parciales.' : '';
    throw new Error(`No se guardo ningun cambio: ${failedUpload.reason?.message || 'fallo una carga.'}${rollbackMessage}`);
  }

  const nextSettings = normalizeHomeSiteSettings(currentSettings);

  removalSet.forEach((slot) => {
    if (!files[slot]) {
      nextSettings[slot] = null;
    }
  });
  successfulUploads.forEach(({ objectPath, slot }) => {
    nextSettings[slot] = objectPath;
  });

  const payload = {};

  HERO_MEDIA_SLOT_KEYS.forEach((slot) => {
    payload[slot] = nextSettings[slot];
  });

  let updateResult;
  let updateThrew = false;

  try {
    updateResult = await supabase
      .from('site_settings')
      .update(payload)
      .eq('id', HOME_SITE_SETTINGS_ID)
      .select(SETTINGS_COLUMNS)
      .maybeSingle();
  } catch (caughtError) {
    updateThrew = true;
    updateResult = { data: null, error: caughtError, status: 0 };
  }

  const { data, error, status } = updateResult;

  let savedSettings;

  if (error || !data) {
    const verification = await verifyHomeSiteSettingsUpdate(payload);
    const verifiedSettings = verification.settings;
    const updateWasApplied = verification.applied;

    if (updateWasApplied) {
      savedSettings = verifiedSettings;
    } else {
      const updateResultIsAmbiguous = updateThrew
        || (Boolean(error) && (!status || status >= 500 || !error.code));
      const referencedPaths = new Set(
        HERO_MEDIA_SLOT_KEYS.map((slot) => verifiedSettings?.[slot]).filter(Boolean),
      );
      const rollbackPaths = updateResultIsAmbiguous
        ? []
        : successfulUploads
          .map(({ objectPath }) => objectPath)
          .filter((path) => !referencedPaths.has(path));
      const rollbackError = await tryDeleteSiteMediaObjects(rollbackPaths);
      const rollbackMessage = rollbackError
        ? ' Tambien fallo la limpieza de los archivos nuevos.'
        : updateResultIsAmbiguous
          ? ' Los archivos nuevos se conservaron porque el resultado final del guardado es ambiguo.'
          : '';
      const updateMessage = error?.message || 'No existe la fila site_settings/home o no tienes permiso para modificarla.';
      throw new Error(`No se pudo actualizar la configuracion de portada. ${updateMessage}${rollbackMessage}`);
    }
  } else {
    savedSettings = normalizeHomeSiteSettings(data);
  }

  const activePaths = new Set(HERO_MEDIA_SLOT_KEYS.map((slot) => savedSettings[slot]).filter(Boolean));
  const replacedPaths = HERO_MEDIA_SLOT_KEYS
    .filter((slot) => currentSettings[slot] && currentSettings[slot] !== savedSettings[slot])
    .map((slot) => currentSettings[slot])
    .filter((path) => !activePaths.has(path));
  const cleanupError = await tryDeleteSiteMediaObjects(replacedPaths);

  return {
    cleanupWarning: cleanupError
      ? 'La portada se guardo, pero algunos archivos anteriores no pudieron eliminarse.'
      : '',
    settings: savedSettings,
  };
}
