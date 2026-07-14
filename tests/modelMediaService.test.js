import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MODEL_IMAGE_BUCKET,
  MODEL_MEDIA_SLOT_KEYS,
  MODEL_MEDIA_SLOTS,
  MODEL_VIDEO_BUCKET,
  createModelMediaService,
  createModelMediaObjectPath,
  normalizeModelMedia,
  parseModelMediaKey,
  resolveModelMediaUrl,
  saveModelMedia,
  validateModelMediaFile,
} from '../src/services/modelMediaService.js';

const MODEL_ID = 'model-001';

function makeFile({ name, size, type }) {
  return { lastModified: 1, name, size, type };
}

const VERSIONED_KEYS = Object.freeze({
  cover_image: 'model-images://models/model-001/cover-desktop/00000000-0000-4000-8000-000000000001.jpg',
  cover_desktop_video: 'model-videos://models/model-001/cover-desktop/00000000-0000-4000-8000-000000000002.mp4',
  cover_mobile_image: 'model-images://models/model-001/cover-mobile/00000000-0000-4000-8000-000000000003.webp',
  cover_mobile_video: 'model-videos://models/model-001/cover-mobile/00000000-0000-4000-8000-000000000004.webm',
  profile_image: 'model-images://models/model-001/profile/00000000-0000-4000-8000-000000000005.jpg',
});

function makeCurrentMedia(overrides = {}) {
  return {
    cover_image: VERSIONED_KEYS.cover_image,
    cover_desktop_video: VERSIONED_KEYS.cover_desktop_video,
    cover_mobile_image: VERSIONED_KEYS.cover_mobile_image,
    cover_mobile_video: VERSIONED_KEYS.cover_mobile_video,
    profile_image: VERSIONED_KEYS.profile_image,
    ...overrides,
  };
}

function createMockClient({ readResults = [], updateResult, updateThrows } = {}) {
  const calls = {
    conditions: [],
    reads: 0,
    updates: [],
  };
  let readIndex = 0;

  const client = {
    from(table) {
      assert.equal(table, 'models');
      let operation = 'read';
      let updatePayload = null;

      const builder = {
        eq(column, value) {
          calls.conditions.push({ column, operator: 'eq', value });
          if (column === 'id') {
            assert.equal(value, MODEL_ID);
          }
          return builder;
        },
        is(column, value) {
          calls.conditions.push({ column, operator: 'is', value });
          return builder;
        },
        async maybeSingle() {
          if (operation === 'update') {
            if (updateThrows) {
              throw updateThrows;
            }

            return typeof updateResult === 'function'
              ? updateResult(updatePayload, calls)
              : updateResult;
          }

          calls.reads += 1;
          const result = readResults[Math.min(readIndex, readResults.length - 1)];
          readIndex += 1;
          return typeof result === 'function' ? result(calls) : result;
        },
        select() {
          return builder;
        },
        update(payload) {
          operation = 'update';
          updatePayload = payload;
          calls.updates.push(payload);
          return builder;
        },
      };

      return builder;
    },
  };

  return { calls, client };
}

function makeTransactionalService({
  client,
  deleteObjects = async () => {},
  uploadFile = async ({ mediaKey }) => mediaKey,
  verificationDelays = [0],
  wait = async () => {},
}) {
  return createModelMediaService({
    deleteObjects,
    getClient: async () => client,
    uploadFile,
    verificationDelays,
    wait,
  });
}

test('declares the five media slots in the editor order and with server-aligned limits', () => {
  assert.deepEqual(MODEL_MEDIA_SLOT_KEYS, [
    'cover_image',
    'cover_desktop_video',
    'cover_mobile_image',
    'cover_mobile_video',
    'profile_image',
  ]);
  assert.equal(MODEL_MEDIA_SLOTS.cover_image.maxBytes, 1_048_575);
  assert.equal(MODEL_MEDIA_SLOTS.cover_desktop_video.maxBytes, 10_485_759);
  assert.equal(MODEL_MEDIA_SLOTS.cover_image.required, true);
  assert.equal(MODEL_MEDIA_SLOTS.profile_image.required, true);
  assert.equal(MODEL_MEDIA_SLOTS.cover_mobile_image.required, false);
});

test('accepts supported images below 1 MiB and rejects the exact 1 MiB boundary', () => {
  const accepted = validateModelMediaFile('cover_image', makeFile({
    name: 'portada.JPEG',
    size: 1_048_575,
    type: 'image/jpeg',
  }));

  assert.deepEqual(accepted, {
    bucket: MODEL_IMAGE_BUCKET,
    contentType: 'image/jpeg',
    extension: 'jpg',
    kind: 'image',
    maxBytes: 1_048_575,
  });
  assert.throws(
    () => validateModelMediaFile('profile_image', makeFile({
      name: 'perfil.webp',
      size: 1_048_576,
      type: 'image/webp',
    })),
    /menos de 1 MB/,
  );
});

test('accepts supported videos below 10 MiB and rejects the exact 10 MiB boundary', () => {
  const accepted = validateModelMediaFile('cover_mobile_video', makeFile({
    name: 'portada.webm',
    size: 10_485_759,
    type: 'video/webm',
  }));

  assert.equal(accepted.bucket, MODEL_VIDEO_BUCKET);
  assert.equal(accepted.contentType, 'video/webm');
  assert.equal(accepted.extension, 'webm');
  assert.throws(
    () => validateModelMediaFile('cover_desktop_video', makeFile({
      name: 'portada.mp4',
      size: 10_485_760,
      type: 'video/mp4',
    })),
    /menos de 10 MB/,
  );
});

test('validates extension and MIME together and rejects empty files', () => {
  assert.throws(
    () => validateModelMediaFile('cover_image', makeFile({
      name: 'portada.jpg',
      size: 100,
      type: 'image/png',
    })),
    /formato no valido/,
  );
  assert.throws(
    () => validateModelMediaFile('cover_desktop_video', makeFile({
      name: 'portada.mov',
      size: 100,
      type: 'video/quicktime',
    })),
    /MP4 o WebM/,
  );
  assert.throws(
    () => validateModelMediaFile('profile_image', makeFile({
      name: 'perfil.png',
      size: 0,
      type: 'image/png',
    })),
    /archivo esta vacio/,
  );
});

test('creates versioned bucket keys and parses each slot without crossing models', () => {
  const cases = [
    ['cover_image', 'jpg', MODEL_IMAGE_BUCKET, 'cover-desktop'],
    ['cover_desktop_video', 'mp4', MODEL_VIDEO_BUCKET, 'cover-desktop'],
    ['cover_mobile_image', 'png', MODEL_IMAGE_BUCKET, 'cover-mobile'],
    ['cover_mobile_video', 'webm', MODEL_VIDEO_BUCKET, 'cover-mobile'],
    ['profile_image', 'webp', MODEL_IMAGE_BUCKET, 'profile'],
  ];

  cases.forEach(([slot, extension, bucket, storageSubdir]) => {
    const mediaKey = createModelMediaObjectPath(MODEL_ID, slot, extension);
    const expectedPrefix = `${bucket}://models/${MODEL_ID}/${storageSubdir}/`;

    assert.ok(mediaKey.startsWith(expectedPrefix));
    assert.match(
      mediaKey.slice(expectedPrefix.length),
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp|mp4|webm)$/i,
    );
    assert.equal(parseModelMediaKey(mediaKey, { modelId: MODEL_ID, slot })?.mediaKey, mediaKey);
    assert.equal(parseModelMediaKey(mediaKey, { modelId: 'model-002' }), null);
  });

  assert.equal(parseModelMediaKey('model-images://models/model-001/profile/not-a-uuid.jpg'), null);
  assert.equal(parseModelMediaKey('model-images://models/model-001/../file.jpg'), null);
  assert.throws(() => createModelMediaObjectPath(MODEL_ID, 'cover_image', 'mp4'), /extension/);
});

test('resolves Supabase keys and preserves URL, R2 and bundled legacy behavior', () => {
  const mediaKey = 'model-images://models/model-001/profile/123e4567-e89b-42d3-a456-426614174000.jpg';

  assert.equal(
    resolveModelMediaUrl(mediaKey, { supabaseUrl: 'https://project.supabase.co/' }),
    'https://project.supabase.co/storage/v1/object/public/model-images/models/model-001/profile/123e4567-e89b-42d3-a456-426614174000.jpg',
  );
  assert.equal(
    resolveModelMediaUrl('r2://models/legacy.jpg', { r2PublicUrl: 'https://cdn.example/' }),
    'https://cdn.example/models/legacy.jpg',
  );
  assert.equal(
    resolveModelMediaUrl('/images/legacy.jpg', { baseUrl: '/catalogo/', r2PublicUrl: '' }),
    '/catalogo/images/legacy.jpg',
  );
  assert.equal(resolveModelMediaUrl('https://images.example/profile.jpg'), 'https://images.example/profile.jpg');
});

test('normalizes exactly the five database fields and a no-op save keeps that contract', async () => {
  const currentMedia = {
    cover_image: ' r2://cover.jpg ',
    cover_mobile_image: '',
    cover_desktop_video: null,
    cover_mobile_video: undefined,
    profile_image: 'r2://profile.jpg',
    unrelated: 'ignored',
  };
  const expected = {
    cover_image: 'r2://cover.jpg',
    cover_desktop_video: null,
    cover_mobile_image: null,
    cover_mobile_video: null,
    profile_image: 'r2://profile.jpg',
  };

  assert.deepEqual(normalizeModelMedia(currentMedia), expected);
  assert.deepEqual(await saveModelMedia({ modelId: MODEL_ID, currentMedia }), {
    cleanupWarning: '',
    media: expected,
  });
});

test('prevents removing or omitting required images before attempting any upload', async () => {
  await assert.rejects(
    saveModelMedia({
      modelId: MODEL_ID,
      currentMedia: { cover_image: 'r2://cover.jpg', profile_image: 'r2://profile.jpg' },
      removals: ['profile_image'],
    }),
    /obligatoria y no se puede eliminar/,
  );

  const { client } = createMockClient({
    readResults: [{
      data: makeCurrentMedia({ cover_image: null }),
      error: null,
      status: 200,
    }],
  });
  const service = makeTransactionalService({ client });

  await assert.rejects(
    service.saveModelMedia({
      modelId: MODEL_ID,
      currentMedia: { profile_image: 'r2://profile.jpg' },
      removals: ['cover_mobile_image'],
    }),
    /Imagen de portada para escritorio es obligatoria/,
  );
});

test('uploads with progress, merges removals and performs one compare-and-swap update', async () => {
  const freshMedia = makeCurrentMedia();
  const progressEvents = [];
  const uploadedKeys = {};
  const deleted = [];
  const { calls, client } = createMockClient({
    readResults: [{ data: freshMedia, error: null, status: 200 }],
    updateResult(payload) {
      return { data: payload, error: null, status: 200 };
    },
  });
  const service = makeTransactionalService({
    client,
    async deleteObjects(keys, options) {
      deleted.push({ keys, options });
    },
    async uploadFile({ mediaKey, onProgress, slot }) {
      uploadedKeys[slot] = mediaKey;
      onProgress?.({ bytesTotal: 100, bytesUploaded: 50, percent: 50, slot });
      onProgress?.({ bytesTotal: 100, bytesUploaded: 100, percent: 100, slot });
      return mediaKey;
    },
  });

  const result = await service.saveModelMedia({
    modelId: MODEL_ID,
    currentMedia: freshMedia,
    files: {
      cover_image: makeFile({ name: 'desktop.jpg', size: 500, type: 'image/jpeg' }),
      cover_mobile_video: makeFile({ name: 'mobile.webm', size: 1_000, type: 'video/webm' }),
    },
    onProgress(event) {
      progressEvents.push(event);
    },
    removals: ['cover_mobile_image'],
  });

  assert.equal(calls.reads, 1);
  assert.equal(calls.updates.length, 1);
  assert.equal(result.media.cover_image, uploadedKeys.cover_image);
  assert.equal(result.media.cover_mobile_video, uploadedKeys.cover_mobile_video);
  assert.equal(result.media.cover_mobile_image, null);
  assert.equal(result.media.cover_desktop_video, freshMedia.cover_desktop_video);
  assert.equal(result.media.profile_image, freshMedia.profile_image);
  assert.deepEqual(progressEvents.map(({ percent, slot }) => [slot, percent]), [
    ['cover_image', 50],
    ['cover_image', 100],
    ['cover_mobile_video', 50],
    ['cover_mobile_video', 100],
  ]);

  const updateConditions = calls.conditions.filter(({ column }) => column !== 'id');
  assert.equal(updateConditions.length, MODEL_MEDIA_SLOT_KEYS.length);
  MODEL_MEDIA_SLOT_KEYS.forEach((slot) => {
    assert.ok(updateConditions.some(({ column, operator, value }) => (
      column === slot
      && operator === (freshMedia[slot] === null ? 'is' : 'eq')
      && value === freshMedia[slot]
    )));
  });
  assert.equal(deleted.length, 1);
  assert.deepEqual(new Set(deleted[0].keys), new Set([
    freshMedia.cover_image,
    freshMedia.cover_mobile_image,
    freshMedia.cover_mobile_video,
  ]));
  assert.deepEqual(deleted[0].options, { modelId: MODEL_ID });
});

test('rolls back completed uploads and skips the database when another upload fails', async () => {
  const deleted = [];
  let getClientCalls = 0;
  const { calls, client } = createMockClient();
  const service = createModelMediaService({
    async deleteObjects(keys, options) {
      deleted.push({ keys, options });
    },
    async getClient() {
      getClientCalls += 1;
      return client;
    },
    async uploadFile({ mediaKey, slot }) {
      if (slot === 'cover_mobile_video') {
        throw new Error('fallo el video movil');
      }
      return mediaKey;
    },
    verificationDelays: [0],
    wait: async () => {},
  });

  await assert.rejects(
    service.saveModelMedia({
      modelId: MODEL_ID,
      currentMedia: makeCurrentMedia(),
      files: {
        cover_image: makeFile({ name: 'desktop.jpg', size: 500, type: 'image/jpeg' }),
        cover_mobile_video: makeFile({ name: 'mobile.webm', size: 1_000, type: 'video/webm' }),
      },
    }),
    /fallo el video movil/,
  );

  assert.equal(getClientCalls, 0);
  assert.equal(calls.updates.length, 0);
  assert.equal(deleted.length, 1);
  assert.equal(deleted[0].keys.length, 1);
  assert.ok(parseModelMediaKey(deleted[0].keys[0], { modelId: MODEL_ID, slot: 'cover_image' }));
});

test('rolls back a new object after a deterministic database rejection', async () => {
  const freshMedia = makeCurrentMedia();
  const deleted = [];
  let uploadedKey;
  const { calls, client } = createMockClient({
    readResults: [
      { data: freshMedia, error: null, status: 200 },
      { data: freshMedia, error: null, status: 200 },
    ],
    updateResult: {
      data: null,
      error: { code: '42501', message: 'permiso denegado' },
      status: 403,
    },
  });
  const service = makeTransactionalService({
    client,
    async deleteObjects(keys) {
      deleted.push(keys);
    },
    async uploadFile({ mediaKey }) {
      uploadedKey = mediaKey;
      return mediaKey;
    },
  });

  await assert.rejects(
    service.saveModelMedia({
      modelId: MODEL_ID,
      currentMedia: freshMedia,
      files: { cover_image: makeFile({ name: 'desktop.jpg', size: 500, type: 'image/jpeg' }) },
    }),
    /permiso denegado/,
  );

  assert.equal(calls.updates.length, 1);
  assert.equal(calls.reads, 2);
  assert.deepEqual(deleted, [[uploadedKey]]);
});

test('keeps new objects when a thrown update remains ambiguous after verification', async () => {
  const freshMedia = makeCurrentMedia();
  const deleted = [];
  const { calls, client } = createMockClient({
    readResults: [
      { data: freshMedia, error: null, status: 200 },
      { data: freshMedia, error: null, status: 200 },
    ],
    updateThrows: new Error('conexion interrumpida'),
  });
  const service = makeTransactionalService({
    client,
    async deleteObjects(keys) {
      deleted.push(keys);
    },
  });

  await assert.rejects(
    service.saveModelMedia({
      modelId: MODEL_ID,
      currentMedia: freshMedia,
      files: { cover_image: makeFile({ name: 'desktop.jpg', size: 500, type: 'image/jpeg' }) },
    }),
    /se conservaron porque el resultado final del guardado es ambiguo/,
  );

  assert.equal(calls.updates.length, 1);
  assert.equal(calls.reads, 2);
  assert.deepEqual(deleted, []);
});

test('accepts a commit found by verification and only cleans the replaced old object', async () => {
  const freshMedia = makeCurrentMedia();
  const deleted = [];
  const waited = [];
  const { calls, client } = createMockClient({
    readResults: [
      { data: freshMedia, error: null, status: 200 },
      { data: freshMedia, error: null, status: 200 },
      (nextCalls) => ({ data: nextCalls.updates[0], error: null, status: 200 }),
    ],
    updateThrows: new Error('respuesta perdida despues del commit'),
  });
  const service = makeTransactionalService({
    client,
    async deleteObjects(keys) {
      deleted.push(keys);
    },
    verificationDelays: [0, 25],
    async wait(milliseconds) {
      waited.push(milliseconds);
    },
  });

  const result = await service.saveModelMedia({
    modelId: MODEL_ID,
    currentMedia: freshMedia,
    files: { cover_image: makeFile({ name: 'desktop.jpg', size: 500, type: 'image/jpeg' }) },
  });

  assert.equal(calls.updates.length, 1);
  assert.equal(calls.reads, 3);
  assert.deepEqual(waited, [25]);
  assert.deepEqual(result.media, calls.updates[0]);
  assert.deepEqual(deleted, [[freshMedia.cover_image]]);
});

test('merges against fresh database media and does not restore stale concurrent values', async () => {
  const staleMedia = makeCurrentMedia();
  const concurrentCover = 'model-images://models/model-001/cover-desktop/00000000-0000-4000-8000-000000000099.jpg';
  const freshMedia = makeCurrentMedia({ cover_image: concurrentCover });
  const deleted = [];
  const { calls, client } = createMockClient({
    readResults: [{ data: freshMedia, error: null, status: 200 }],
    updateResult(payload) {
      return { data: payload, error: null, status: 200 };
    },
  });
  const service = makeTransactionalService({
    client,
    async deleteObjects(keys) {
      deleted.push(keys);
    },
  });

  const result = await service.saveModelMedia({
    modelId: MODEL_ID,
    currentMedia: staleMedia,
    files: { cover_mobile_image: makeFile({ name: 'mobile.webp', size: 500, type: 'image/webp' }) },
  });

  assert.equal(calls.updates.length, 1);
  assert.equal(calls.updates[0].cover_image, concurrentCover);
  assert.equal(result.media.cover_image, concurrentCover);
  assert.ok(!deleted.flat().includes(staleMedia.cover_image));
  assert.ok(!deleted.flat().includes(concurrentCover));
  assert.deepEqual(deleted, [[freshMedia.cover_mobile_image]]);
});

test('returns a warning when post-commit cleanup fails without reverting saved media', async () => {
  const freshMedia = makeCurrentMedia();
  const { client } = createMockClient({
    readResults: [{ data: freshMedia, error: null, status: 200 }],
    updateResult(payload) {
      return { data: payload, error: null, status: 200 };
    },
  });
  const service = makeTransactionalService({
    client,
    async deleteObjects() {
      throw new Error('storage no disponible');
    },
  });

  const result = await service.saveModelMedia({
    modelId: MODEL_ID,
    currentMedia: freshMedia,
    removals: ['cover_desktop_video'],
  });

  assert.equal(result.media.cover_desktop_video, null);
  assert.match(result.cleanupWarning, /algunos archivos anteriores no pudieron eliminarse/);
});
