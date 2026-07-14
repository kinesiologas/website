import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GALLERY_IMAGE_MAX_BYTES,
  createGalleryMediaService,
  validateGalleryImageFile,
} from '../src/services/galleryMediaService.js';

function makeFile({ name = 'foto.jpg', size = 100, type = 'image/jpeg' } = {}) {
  return { name, size, type };
}

test('validates gallery image format, MIME type, size and empty files', () => {
  assert.deepEqual(validateGalleryImageFile(makeFile()), {
    extension: '.jpg',
    mimeType: 'image/jpeg',
  });
  assert.throws(
    () => validateGalleryImageFile(makeFile({ name: 'foto.jpg', type: 'image/png' })),
    /JPEG, PNG o WebP/,
  );
  assert.throws(
    () => validateGalleryImageFile(makeFile({ name: 'foto.gif', type: 'image/gif' })),
    /JPEG, PNG o WebP/,
  );
  assert.throws(() => validateGalleryImageFile(makeFile({ size: 0 })), /vacía/);
  assert.throws(
    () => validateGalleryImageFile(makeFile({ size: GALLERY_IMAGE_MAX_BYTES + 1 })),
    /menos de 5 MB/,
  );
});

test('requires a file for a new gallery item but allows metadata-only edits', async () => {
  const calls = [];
  const service = createGalleryMediaService({
    async invoke(body) {
      calls.push(body);
      return {
        data: {
          image: {
            alt: body.get('alt'),
            id: body.get('imageId'),
            model_slug: 'isabella',
            sort_order: Number(body.get('sortOrder')),
            src: 'r2://models/model-001/gallery/photo.jpg',
          },
        },
        error: null,
      };
    },
  });

  await assert.rejects(
    service.saveImage({ modelId: 'model-001' }),
    /Selecciona una foto/,
  );

  const result = await service.saveImage({
    alt: 'Retrato editorial',
    imageId: 'image-001',
    modelId: 'model-001',
    sortOrder: '20',
  });

  assert.equal(calls.length, 1);
  assert.ok(calls[0] instanceof FormData);
  assert.equal(calls[0].get('action'), 'upsert');
  assert.equal(calls[0].get('modelId'), 'model-001');
  assert.equal(result.image.id, 'image-001');
  assert.equal(result.image.sort_order, 20);
  assert.equal(result.cleanupWarning, '');
});

test('sends a selected file as multipart data when adding a gallery photo', async () => {
  let requestBody;
  const service = createGalleryMediaService({
    async invoke(body) {
      requestBody = body;
      return {
        data: {
          image: {
            alt: body.get('alt'),
            id: 'image-new',
            model_slug: 'isabella',
            sort_order: 10,
            src: 'r2://models/model-001/gallery/photo.jpg',
          },
        },
        error: null,
      };
    },
  });
  const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], 'retrato.jpg', {
    type: 'image/jpeg',
  });

  const result = await service.saveImage({
    alt: 'Retrato',
    file,
    modelId: 'model-001',
    sortOrder: 10,
  });

  assert.ok(requestBody instanceof FormData);
  assert.equal(requestBody.get('action'), 'upsert');
  assert.equal(requestBody.get('file').name, 'retrato.jpg');
  assert.equal(result.image.id, 'image-new');
});

test('deletion always sends both the gallery item and owning model identifiers', async () => {
  let requestBody;
  const service = createGalleryMediaService({
    async invoke(body) {
      requestBody = body;
      return { data: { deleted: true, id: body.imageId, r2Deleted: true }, error: null };
    },
  });

  const result = await service.deleteImage({ imageId: 'image-001', modelId: 'model-001' });

  assert.deepEqual(requestBody, {
    action: 'delete',
    id: 'image-001',
    imageId: 'image-001',
    modelId: 'model-001',
  });
  assert.equal(result.deleted, true);
  assert.equal(result.r2Deleted, true);
  await assert.rejects(service.deleteImage({ imageId: 'image-001' }), /identificar/);
});

test('surfaces the server error returned by the protected R2 function', async () => {
  const service = createGalleryMediaService({
    async invoke() {
      return {
        data: null,
        error: {
          context: new Response(JSON.stringify({ error: 'R2 no respondió; no se eliminó la foto.' }), {
            headers: { 'Content-Type': 'application/json' },
            status: 502,
          }),
          message: 'Edge Function returned a non-2xx status code',
        },
      };
    },
  });

  await assert.rejects(
    service.deleteImage({ imageId: 'image-001', modelId: 'model-001' }),
    /R2 no respondió/,
  );
});
