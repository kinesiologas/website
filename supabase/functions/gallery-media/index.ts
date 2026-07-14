import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_IMAGE_BYTES + (128 * 1024);
const MAX_IMAGES_PER_MODEL = 60;
const IMAGE_COLUMNS = [
  'id',
  'model_id',
  'model_slug',
  'src',
  'alt',
  'sort_order',
  'storage_provider',
  'object_key',
  'cleanup_pending_key',
  'delete_pending',
  'created_at',
  'updated_at',
].join(', ');

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

type AdminClient = ReturnType<typeof createClient>;
type AppProfile = {
  active: boolean;
  model_id: string | null;
  role: string;
};
type GalleryImage = {
  alt: string;
  cleanup_pending_key: string | null;
  created_at: string;
  delete_pending: boolean;
  id: string;
  model_id: string;
  model_slug: string;
  object_key: string | null;
  sort_order: number;
  src: string;
  storage_provider: string | null;
  updated_at: string;
};
type ModelRecord = {
  country_id: string | null;
  id: string;
  province_id: string | null;
  slug: string;
};
type R2Config = {
  accountId: string;
  bucketName: string;
  client: AwsClient;
  publicBaseUrl: URL;
};

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    status,
  });
}

function requiredEnvironment(name: string) {
  const value = Deno.env.get(name)?.trim();

  if (!value) {
    throw new HttpError(500, 'La funcion de galeria no esta configurada correctamente.');
  }

  return value;
}

function loadR2Config(): R2Config {
  const accountId = requiredEnvironment('R2_ACCOUNT_ID').toLowerCase();
  const bucketName = requiredEnvironment('R2_BUCKET_NAME');
  const accessKeyId = requiredEnvironment('R2_ACCESS_KEY_ID');
  const secretAccessKey = requiredEnvironment('R2_SECRET_ACCESS_KEY');
  let publicBaseUrl: URL;

  try {
    publicBaseUrl = new URL(requiredEnvironment('R2_PUBLIC_URL'));
  } catch {
    throw new HttpError(500, 'La URL publica de R2 no es valida.');
  }

  if (
    !/^[a-f0-9]{32}$/.test(accountId)
    || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucketName)
    || publicBaseUrl.protocol !== 'https:'
    || publicBaseUrl.search
    || publicBaseUrl.hash
  ) {
    throw new HttpError(500, 'La configuracion de R2 no es valida.');
  }

  publicBaseUrl.pathname = `${publicBaseUrl.pathname.replace(/\/+$/, '')}/`;

  return {
    accountId,
    bucketName,
    client: new AwsClient({
      accessKeyId,
      region: 'auto',
      secretAccessKey,
      service: 's3',
    }),
    publicBaseUrl,
  };
}

function getString(formData: FormData, ...keys: string[]) {
  for (const key of keys) {
    const value = formData.get(key);

    if (typeof value === 'string') {
      return value.trim();
    }
  }

  return '';
}

function hasAny(formData: FormData, ...keys: string[]) {
  return keys.some((key) => formData.has(key));
}

function getFile(formData: FormData) {
  for (const key of ['file', 'image']) {
    const value = formData.get(key);

    if (value instanceof File) {
      return value;
    }
  }

  return null;
}

function parseSortOrder(value: unknown, fallback: number) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < -2147483648 || parsed > 2147483647) {
    throw new HttpError(400, 'El orden de la imagen no es valido.');
  }

  return parsed;
}

function parseAlt(value: unknown, fallback: string) {
  if (value === undefined || value === null) {
    return fallback;
  }

  const alt = String(value).trim();

  if (alt.length > 500) {
    throw new HttpError(400, 'El texto alternativo es demasiado largo.');
  }

  return alt;
}

function isSafePathSegment(value: string) {
  return /^[A-Za-z0-9_-]+$/.test(value);
}

const immutableFilenamePattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/i;

function isLegacyImageKey(key: string) {
  if (
    key.includes('\\')
    || !/^images\/models\/[A-Za-z0-9_-]+\/(?:gallery[-_][A-Za-z0-9._-]+|gallery\/[A-Za-z0-9._/-]+)\.(?:jpe?g|png|webp)$/i.test(key)
  ) {
    return false;
  }

  const segments = key.split('/');

  return (
    segments.every((segment) => segment.length > 0 && segment !== '.' && segment !== '..' && /^[A-Za-z0-9._-]+$/.test(segment))
    && !key.includes('//')
  );
}

function isOwnedR2Key(key: string, model: ModelRecord) {
  const prefix = `models/${model.id}/gallery/`;
  const filename = key.startsWith(prefix) ? key.slice(prefix.length) : '';

  return immutableFilenamePattern.test(filename) || isLegacyImageKey(key);
}

function isConfiguredR2Source(src: string, config: R2Config) {
  const value = src.trim();

  if (!value) return false;
  if (/^r2:\/\//i.test(value)) return true;
  if (value.startsWith('//')) return true;

  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    return true;
  }

  try {
    const url = new URL(value);
    return url.origin === config.publicBaseUrl.origin
      && url.pathname.startsWith(config.publicBaseUrl.pathname);
  } catch {
    return false;
  }
}

function managedObjectKey(image: GalleryImage, model: ModelRecord, config: R2Config) {
  if (image.storage_provider === null && image.object_key === null) {
    if (isConfiguredR2Source(image.src, config)) {
      throw new HttpError(
        409,
        'Esta imagen de R2 es heredada y no tiene una clave segura. Un administrador debe vincularla antes de reemplazarla o eliminarla.',
      );
    }

    return null;
  }

  if (
    image.storage_provider !== 'r2'
    || !image.object_key
    || !isOwnedR2Key(image.object_key, model)
  ) {
    throw new HttpError(409, 'Los metadatos de almacenamiento de la imagen no son seguros.');
  }

  return image.object_key;
}

function pendingCleanupKey(image: GalleryImage, model: ModelRecord) {
  const key = image.cleanup_pending_key;

  if (!key) {
    return null;
  }

  if (image.storage_provider !== 'r2' || !isOwnedR2Key(key, model) || key === image.object_key) {
    throw new HttpError(409, 'La referencia de limpieza pendiente de la imagen no es segura.');
  }

  return key;
}

function bytesMatch(bytes: Uint8Array, expected: number[]) {
  return expected.every((value, index) => bytes[index] === value);
}

async function validateImage(file: File) {
  if (file.size <= 0) {
    throw new HttpError(400, 'La imagen esta vacia.');
  }

  if (file.size >= MAX_IMAGE_BYTES) {
    throw new HttpError(413, 'La imagen debe pesar menos de 5 MiB.');
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  let contentType = '';
  let extension = '';

  if (bytesMatch(bytes, [0xff, 0xd8, 0xff])) {
    contentType = 'image/jpeg';
    extension = 'jpg';
  } else if (bytesMatch(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    contentType = 'image/png';
    extension = 'png';
  } else if (
    bytesMatch(bytes, [0x52, 0x49, 0x46, 0x46])
    && bytesMatch(bytes.slice(8), [0x57, 0x45, 0x42, 0x50])
  ) {
    contentType = 'image/webp';
    extension = 'webp';
  } else {
    throw new HttpError(415, 'Formato no valido. Usa JPEG, PNG o WebP.');
  }

  const declaredType = file.type.toLowerCase();

  if (declaredType && declaredType !== contentType && !(declaredType === 'image/jpg' && contentType === 'image/jpeg')) {
    throw new HttpError(415, 'El contenido de la imagen no coincide con su tipo de archivo.');
  }

  return { bytes, contentType, extension };
}

function encodeAwsPath(value: string) {
  return value
    .split('/')
    .map((segment) => encodeURIComponent(segment).replace(/[!'()*]/g, (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`))
    .join('/');
}

async function signedR2Request(
  config: R2Config,
  method: 'DELETE' | 'PUT',
  objectKey: string,
  body = new Uint8Array(),
  contentType = '',
) {
  const pathname = `/${encodeAwsPath(config.bucketName)}/${encodeAwsPath(objectKey)}`;
  const url = new URL(`https://${config.accountId}.r2.cloudflarestorage.com${pathname}`);
  const headers = new Headers();

  if (contentType) {
    headers.set('Content-Type', contentType);
  }

  return config.client.fetch(url.toString(), {
    body: method === 'PUT' ? body : undefined,
    headers,
    method,
  });
}

async function uploadR2Object(
  config: R2Config,
  objectKey: string,
  bytes: Uint8Array,
  contentType: string,
) {
  const response = await signedR2Request(config, 'PUT', objectKey, bytes, contentType);

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error('R2 gallery upload failed.', response.status, detail.slice(0, 500));
    throw new HttpError(502, 'No se pudo subir la imagen a R2.');
  }
}

async function deleteR2Object(config: R2Config, objectKey: string) {
  const response = await signedR2Request(config, 'DELETE', objectKey);

  if (!response.ok && response.status !== 404) {
    const detail = await response.text().catch(() => '');
    console.error('R2 gallery delete failed.', response.status, detail.slice(0, 500));
    throw new HttpError(502, 'No se pudo eliminar la imagen de R2.');
  }
}

async function bestEffortDelete(config: R2Config, objectKey: string) {
  try {
    await deleteR2Object(config, objectKey);
    return true;
  } catch (error) {
    console.error('R2 gallery rollback failed.', error);
    return false;
  }
}

async function getModel(adminClient: AdminClient, modelId: string) {
  const { data, error } = await adminClient
    .from('models')
    .select('id, slug, country_id, province_id')
    .eq('id', modelId)
    .maybeSingle();

  if (error) {
    console.error('Gallery model lookup failed.', error);
    throw new HttpError(500, 'No se pudo comprobar el modelo.');
  }

  if (!data) {
    throw new HttpError(404, 'El modelo no existe.');
  }

  return data as ModelRecord;
}

async function getImage(adminClient: AdminClient, imageId: string) {
  const { data, error } = await adminClient
    .from('gallery_images')
    .select(IMAGE_COLUMNS)
    .eq('id', imageId)
    .maybeSingle();

  if (error) {
    console.error('Gallery image lookup failed.', error);
    throw new HttpError(500, 'No se pudo comprobar la imagen.');
  }

  if (!data) {
    throw new HttpError(404, 'La imagen no existe.');
  }

  return data as GalleryImage;
}

async function finishPendingCleanup(
  adminClient: AdminClient,
  r2Config: R2Config,
  image: GalleryImage,
  model: ModelRecord,
) {
  const cleanupKey = pendingCleanupKey(image, model);

  if (!cleanupKey) {
    return image;
  }

  await deleteR2Object(r2Config, cleanupKey);

  const { data, error } = await adminClient
    .from('gallery_images')
    .update({ cleanup_pending_key: null })
    .eq('id', image.id)
    .eq('updated_at', image.updated_at)
    .eq('cleanup_pending_key', cleanupKey)
    .select(IMAGE_COLUMNS)
    .maybeSingle();

  if (error) {
    console.error('Gallery pending cleanup clear failed.', error);
    throw new HttpError(500, 'El archivo anterior se elimino, pero no se pudo confirmar su limpieza. Vuelve a intentarlo.');
  }

  if (!data) {
    throw new HttpError(409, 'La galeria cambio mientras se completaba una limpieza pendiente. Recarga e intentalo de nuevo.');
  }

  return data as GalleryImage;
}

async function assertCanManageModel(
  adminClient: AdminClient,
  userId: string,
  profile: AppProfile,
  model: ModelRecord,
) {
  if (profile.role === 'super_admin') {
    return;
  }

  if (profile.role === 'model' && profile.model_id === model.id) {
    return;
  }

  if (profile.role === 'admin' && model.country_id) {
    const { data, error } = await adminClient
      .from('admin_territory_assignments')
      .select('province_id')
      .eq('user_id', userId)
      .eq('country_id', model.country_id);

    if (error) {
      console.error('Gallery territory lookup failed.', error);
      throw new HttpError(500, 'No se pudo comprobar el territorio.');
    }

    if ((data ?? []).some((assignment) =>
      assignment.province_id === null || assignment.province_id === model.province_id)) {
      return;
    }
  }

  throw new HttpError(403, 'No tienes permiso para modificar la galeria de este modelo.');
}

async function handleUpsert(
  request: Request,
  adminClient: AdminClient,
  userId: string,
  profile: AppProfile,
  r2Config: R2Config,
) {
  if (!request.headers.get('content-type')?.toLowerCase().includes('multipart/form-data')) {
    throw new HttpError(415, 'La galeria debe enviarse como multipart/form-data.');
  }

  const formData = await request.formData().catch(() => {
    throw new HttpError(400, 'El formulario de galeria no es valido.');
  });
  const imageId = getString(formData, 'imageId', 'image_id', 'id');
  const requestedModelId = getString(formData, 'modelId', 'model_id');
  const file = getFile(formData);
  const hasAlt = hasAny(formData, 'alt');
  const hasSortOrder = hasAny(formData, 'sortOrder', 'sort_order');
  let current = imageId ? await getImage(adminClient, imageId) : null;
  const modelId = current?.model_id ?? requestedModelId;

  if (!modelId) {
    throw new HttpError(400, 'Selecciona el modelo de la galeria.');
  }

  if (current && requestedModelId && requestedModelId !== current.model_id) {
    throw new HttpError(409, 'Una imagen no se puede transferir a otro modelo.');
  }

  if (!current && imageId) {
    throw new HttpError(404, 'La imagen no existe.');
  }

  if (!current && !file) {
    throw new HttpError(400, 'Selecciona una imagen para la galeria.');
  }

  const model = await getModel(adminClient, modelId);

  if (current && current.model_slug !== model.slug) {
    throw new HttpError(409, 'La imagen no pertenece al modelo indicado.');
  }

  await assertCanManageModel(adminClient, userId, profile, model);

  if (!isSafePathSegment(model.id)) {
    throw new HttpError(409, 'El identificador del modelo no permite crear una ruta segura.');
  }

  if (current?.delete_pending) {
    throw new HttpError(409, 'Esta imagen se esta eliminando. Recarga la galeria antes de editarla.');
  }

  if (current?.cleanup_pending_key) {
    current = await finishPendingCleanup(adminClient, r2Config, current, model);
  }

  if (!current) {
    const { count, error: countError } = await adminClient
      .from('gallery_images')
      .select('id', { count: 'exact', head: true })
      .eq('model_id', model.id);

    if (countError) {
      console.error('Gallery quota lookup failed.', countError);
      throw new HttpError(500, 'No se pudo comprobar el limite de la galeria.');
    }

    if ((count ?? 0) >= MAX_IMAGES_PER_MODEL) {
      throw new HttpError(409, `La galeria admite hasta ${MAX_IMAGES_PER_MODEL} fotos por modelo.`);
    }
  }

  if (current && !file && !hasAlt && !hasSortOrder) {
    return jsonResponse({ image: current });
  }

  const payload: Record<string, unknown> = {
    alt: parseAlt(hasAlt ? getString(formData, 'alt') : undefined, current?.alt ?? ''),
    model_id: model.id,
    model_slug: model.slug,
    sort_order: parseSortOrder(
      hasSortOrder ? getString(formData, 'sortOrder', 'sort_order') : undefined,
      current?.sort_order ?? 0,
    ),
  };
  let uploadedKey = '';
  const previousKey = current && file ? managedObjectKey(current, model, r2Config) : null;

  if (file) {
    const validated = await validateImage(file);
    uploadedKey = `models/${model.id}/gallery/${crypto.randomUUID()}.${validated.extension}`;
    await uploadR2Object(r2Config, uploadedKey, validated.bytes, validated.contentType);
    payload.src = `r2://${uploadedKey}`;
    payload.storage_provider = 'r2';
    payload.object_key = uploadedKey;
    payload.cleanup_pending_key = previousKey;
  }

  let result: { data: unknown; error: unknown };

  if (current) {
    result = await adminClient
      .from('gallery_images')
      .update(payload)
      .eq('id', current.id)
      .eq('updated_at', current.updated_at)
      .select(IMAGE_COLUMNS)
      .maybeSingle();
  } else {
    result = await adminClient
      .from('gallery_images')
      .insert({
        ...payload,
        id: crypto.randomUUID(),
      })
      .select(IMAGE_COLUMNS)
      .maybeSingle();
  }

  if (result.error || !result.data) {
    const databaseError = result.error as { code?: string } | null;
    const quotaExceeded = !current && databaseError?.code === '23514';

    if (uploadedKey) {
      await bestEffortDelete(r2Config, uploadedKey);
    }

    console.error('Gallery database upsert failed.', result.error);
    throw new HttpError(
      quotaExceeded || (current && !result.error) ? 409 : 500,
      quotaExceeded
        ? `La galeria admite hasta ${MAX_IMAGES_PER_MODEL} fotos por modelo.`
        : current && !result.error
        ? 'La imagen cambio mientras se estaba guardando. Intentalo de nuevo.'
        : 'No se pudo guardar la imagen de la galeria.',
    );
  }

  let cleanupWarning = '';
  let savedImage = result.data as GalleryImage;

  if (current && uploadedKey && previousKey) {
    try {
      await deleteR2Object(r2Config, previousKey);

      const { data: cleanedImage, error: cleanupStateError } = await adminClient
        .from('gallery_images')
        .update({ cleanup_pending_key: null })
        .eq('id', savedImage.id)
        .eq('updated_at', savedImage.updated_at)
        .eq('object_key', uploadedKey)
        .eq('cleanup_pending_key', previousKey)
        .select(IMAGE_COLUMNS)
        .maybeSingle();

      if (cleanupStateError || !cleanedImage) {
        console.error('Gallery cleanup state clear failed.', cleanupStateError);
        cleanupWarning = 'La imagen anterior se elimino de R2, pero su limpieza quedo pendiente de confirmacion.';
      } else {
        savedImage = cleanedImage as GalleryImage;
      }
    } catch (error) {
      console.error('Previous gallery object cleanup failed.', error);
      cleanupWarning = 'La imagen se guardo, pero el archivo anterior quedo pendiente de eliminar en R2. Vuelve a intentarlo.';
    }
  }

  return jsonResponse(
    {
      cleanupWarning,
      image: savedImage as unknown as Record<string, unknown>,
    },
    current ? 200 : 201,
  );
}

async function parseDeleteBody(request: Request) {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData().catch(() => {
      throw new HttpError(400, 'El formulario de galeria no es valido.');
    });
    return {
      imageId: getString(formData, 'imageId', 'image_id', 'id'),
      modelId: getString(formData, 'modelId', 'model_id'),
    };
  }

  const body = await request.json().catch(() => {
    throw new HttpError(400, 'La solicitud de borrado no es valida.');
  }) as Record<string, unknown>;

  return {
    imageId: String(body.imageId ?? body.image_id ?? body.id ?? '').trim(),
    modelId: String(body.modelId ?? body.model_id ?? '').trim(),
  };
}

async function handleDelete(
  request: Request,
  adminClient: AdminClient,
  userId: string,
  profile: AppProfile,
  r2Config: R2Config,
) {
  const { imageId, modelId: requestedModelId } = await parseDeleteBody(request);

  if (!imageId) {
    throw new HttpError(400, 'Indica la imagen que quieres eliminar.');
  }

  const current = await getImage(adminClient, imageId);

  if (requestedModelId && requestedModelId !== current.model_id) {
    throw new HttpError(409, 'La imagen no pertenece al modelo indicado.');
  }

  const model = await getModel(adminClient, current.model_id);

  if (current.model_slug !== model.slug) {
    throw new HttpError(409, 'La identidad del modelo de la imagen no es valida.');
  }

  await assertCanManageModel(adminClient, userId, profile, model);
  const objectKey = managedObjectKey(current, model, r2Config);
  const cleanupKey = pendingCleanupKey(current, model);
  const wasPending = current.delete_pending;
  let claimed = current;

  if (!wasPending) {
    const { data, error } = await adminClient
      .from('gallery_images')
      .update({ delete_pending: true })
      .eq('id', current.id)
      .eq('updated_at', current.updated_at)
      .eq('delete_pending', false)
      .select(IMAGE_COLUMNS)
      .maybeSingle();

    if (error) {
      console.error('Gallery delete claim failed.', error);
      throw new HttpError(500, 'No se pudo preparar el borrado de la imagen.');
    }

    if (!data) {
      throw new HttpError(409, 'La imagen cambio mientras se estaba eliminando. Recarga e intentalo de nuevo.');
    }

    claimed = data as GalleryImage;
  }

  if (cleanupKey) {
    await deleteR2Object(r2Config, cleanupKey);
  }

  if (objectKey && objectKey !== cleanupKey) {
    await deleteR2Object(r2Config, objectKey);
  }

  let deleteQuery = adminClient
    .from('gallery_images')
    .delete()
    .eq('id', claimed.id)
    .eq('updated_at', claimed.updated_at)
    .eq('delete_pending', true);

  deleteQuery = objectKey
    ? deleteQuery.eq('storage_provider', 'r2').eq('object_key', objectKey)
    : deleteQuery.is('storage_provider', null).is('object_key', null);

  const { data, error } = await deleteQuery.select('id').maybeSingle();

  if (error) {
    console.error('Gallery database delete failed after R2 delete.', error);
    throw new HttpError(500, 'El archivo se elimino de R2, pero el registro quedo pendiente. Vuelve a intentarlo.');
  }

  if (!data) {
    const { data: latest, error: latestError } = await adminClient
      .from('gallery_images')
      .select('id, object_key')
      .eq('id', current.id)
      .maybeSingle();

    if (latestError) {
      console.error('Gallery delete verification failed.', latestError);
      throw new HttpError(500, 'No se pudo verificar el borrado de la imagen.');
    }

    if (latest) {
      throw new HttpError(409, 'El archivo se elimino de R2, pero el registro quedo pendiente. Vuelve a intentarlo.');
    }
  }

  return jsonResponse({
    deleted: true,
    id: current.id,
    r2Deleted: Boolean(objectKey || cleanupKey),
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  try {
    const supabaseUrl = requiredEnvironment('SUPABASE_URL');
    const supabaseAnonKey = requiredEnvironment('SUPABASE_ANON_KEY');
    const serviceRoleKey = requiredEnvironment('SUPABASE_SERVICE_ROLE_KEY');
    const authorization = request.headers.get('Authorization') ?? '';
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authorization } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      throw new HttpError(401, 'Tu sesion no es valida.');
    }

    const { data: profile, error: profileError } = await adminClient
      .from('app_profiles')
      .select('role, active, model_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Gallery profile lookup failed.', profileError);
      throw new HttpError(500, 'No se pudo comprobar tu perfil.');
    }

    if (!profile?.active) {
      throw new HttpError(403, 'Tu perfil no esta activo.');
    }

    if (!['super_admin', 'admin', 'model'].includes(profile.role)) {
      throw new HttpError(403, 'Tu perfil no puede administrar galerias.');
    }

    const contentLength = Number(request.headers.get('content-length') ?? 0);

    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
      throw new HttpError(413, 'La solicitud de galeria es demasiado grande.');
    }

    const r2Config = loadR2Config();

    const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
    const requestedAction = new URL(request.url).searchParams.get('action')?.trim().toLowerCase() ?? '';
    const inferredAction = contentType.includes('multipart/form-data')
      ? 'upsert'
      : contentType.includes('application/json')
        ? 'delete'
        : '';
    const action = requestedAction || inferredAction;

    if (action === 'upsert') {
      return await handleUpsert(request, adminClient, user.id, profile as AppProfile, r2Config);
    }

    if (action === 'delete') {
      return await handleDelete(request, adminClient, user.id, profile as AppProfile, r2Config);
    }

    throw new HttpError(400, 'La accion de galeria no es valida.');
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse({ error: error.message }, error.status);
    }

    console.error('Unexpected gallery-media error.', error);
    return jsonResponse({ error: 'No se pudo procesar la galeria.' }, 500);
  }
});
