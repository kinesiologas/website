import { supabase } from '../lib/supabaseClient.js';

export const GALLERY_IMAGE_ACCEPT = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';
export const GALLERY_IMAGE_MAX_BYTES = (5 * 1024 * 1024) - 1;

const GALLERY_IMAGE_FORMATS = Object.freeze({
  '.jpeg': Object.freeze({ mimeTypes: ['image/jpeg', 'image/jpg'] }),
  '.jpg': Object.freeze({ mimeTypes: ['image/jpeg', 'image/jpg'] }),
  '.png': Object.freeze({ mimeTypes: ['image/png'] }),
  '.webp': Object.freeze({ mimeTypes: ['image/webp'] }),
});

function getFileExtension(fileName = '') {
  const lastDot = fileName.lastIndexOf('.');
  return lastDot >= 0 ? fileName.slice(lastDot).toLowerCase() : '';
}

function normalizeSortOrder(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

async function functionErrorMessage(error, fallbackMessage) {
  const context = error?.context;

  if (context && typeof context.json === 'function') {
    try {
      const body = await context.json();
      const message = body?.error || body?.message;

      if (typeof message === 'string' && message.trim()) {
        return message.trim();
      }
    } catch {
      // The Functions client may already have consumed a non-JSON response.
    }
  }

  return error?.message || fallbackMessage;
}

async function defaultInvoke(body) {
  if (!supabase) {
    throw new Error('Supabase no está configurado.');
  }

  return supabase.functions.invoke('gallery-media', { body });
}

export function validateGalleryImageFile(file) {
  if (!file || typeof file.name !== 'string' || !Number.isFinite(file.size)) {
    throw new Error('Selecciona una foto para la galería.');
  }

  const extension = getFileExtension(file.name);
  const format = GALLERY_IMAGE_FORMATS[extension];
  const mimeType = (file.type || '').toLowerCase();

  if (!format || !format.mimeTypes.includes(mimeType)) {
    throw new Error('La foto de galería debe ser JPEG, PNG o WebP.');
  }

  if (file.size <= 0) {
    throw new Error('La foto de galería está vacía.');
  }

  if (file.size > GALLERY_IMAGE_MAX_BYTES) {
    throw new Error('La foto de galería debe pesar menos de 5 MB.');
  }

  return { extension, mimeType };
}

export function createGalleryMediaService({ invoke = defaultInvoke } = {}) {
  if (typeof invoke !== 'function') {
    throw new Error('El servicio de galería no está configurado correctamente.');
  }

  return Object.freeze({
    async deleteImage({ imageId, modelId }) {
      if (!imageId || !modelId) {
        throw new Error('No se pudo identificar la foto que se eliminará.');
      }

      const { data, error } = await invoke({
        action: 'delete',
        id: imageId,
        imageId,
        modelId,
      });

      if (error) {
        throw new Error(await functionErrorMessage(error, 'No se pudo eliminar la foto de la galería.'));
      }

      return data;
    },

    async saveImage({ alt = '', file = null, imageId = '', modelId, sortOrder = 0 }) {
      if (!modelId) {
        throw new Error('Guarda primero el modelo para habilitar su galería.');
      }

      if (!imageId && !file) {
        throw new Error('Selecciona una foto para agregarla a la galería.');
      }

      if (file) {
        validateGalleryImageFile(file);
      }

      const body = new FormData();
      body.set('action', 'upsert');
      body.set('alt', String(alt).trim());
      body.set('id', imageId || '');
      body.set('imageId', imageId || '');
      body.set('modelId', modelId);
      body.set('sortOrder', String(normalizeSortOrder(sortOrder)));

      if (file) {
        body.set('file', file, file.name);
      }

      const { data, error } = await invoke(body);

      if (error) {
        throw new Error(await functionErrorMessage(error, 'No se pudo guardar la foto de la galería.'));
      }

      const image = data?.image ?? data?.item;

      if (!image?.id) {
        throw new Error('La galería no devolvió la foto guardada.');
      }

      return {
        cleanupWarning: typeof data?.cleanupWarning === 'string' ? data.cleanupWarning : '',
        image,
      };
    },
  });
}

const galleryMediaService = createGalleryMediaService();

export const deleteGalleryImageFile = galleryMediaService.deleteImage;
export const saveGalleryImageFile = galleryMediaService.saveImage;
