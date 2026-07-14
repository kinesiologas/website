import { ImagePlus, RotateCcw, Save, Trash2, Upload } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import {
  listGalleryImages,
  saveModel,
  slugify,
} from '../../services/adminService.js';
import {
  deleteGalleryImageFile,
  GALLERY_IMAGE_ACCEPT,
  saveGalleryImageFile,
  validateGalleryImageFile,
} from '../../services/galleryMediaService.js';
import { resolveAssetUrl } from '../../utils/assetUrl.js';
import { CheckboxInput, SelectInput, TextInput } from './FormControls.jsx';
import { ModelMediaEditor } from './ModelMediaEditor.jsx';
import { StatusMessage } from './StatusMessage.jsx';

const emptyModel = {
  age: '',
  category: '',
  city: '',
  city_id: '',
  country_id: '',
  cover_desktop_video: null,
  cover_image: '',
  cover_mobile_image: null,
  cover_mobile_video: null,
  description: '',
  featured: false,
  id: '',
  instagram_url: '',
  name: '',
  profile_image: '',
  province_id: '',
  short_description: '',
  slug: '',
  sort_order: 0,
  status: 'draft',
  whatsapp_number: '',
};

const emptyImage = {
  alt: '',
  id: '',
  model_slug: '',
  sort_order: 0,
  src: '',
};

const modelMediaFields = [
  'cover_image',
  'cover_desktop_video',
  'cover_mobile_image',
  'cover_mobile_video',
  'profile_image',
];
const modelMetadataFields = Object.keys(emptyModel).filter((field) => !modelMediaFields.includes(field));

function pickModelMedia(model) {
  return Object.fromEntries(modelMediaFields.map((field) => [field, model?.[field] ?? null]));
}

function normalizeModel(model) {
  return {
    ...emptyModel,
    ...model,
    age: model?.age ?? '',
    city_id: model?.city_id ?? '',
    country_id: model?.country_id ?? '',
    province_id: model?.province_id ?? '',
    sort_order: model?.sort_order ?? 0,
  };
}

export function ModelEditor({
  canManageCatalog,
  categories,
  locations,
  model,
  onMediaSaved,
  onMediaStateChange,
  onSaved,
}) {
  const [form, setForm] = useState(() => normalizeModel(model));
  const [gallery, setGallery] = useState([]);
  const [imageForm, setImageForm] = useState(emptyImage);
  const [galleryFile, setGalleryFile] = useState(null);
  const [galleryPreviewUrl, setGalleryPreviewUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isGalleryLoading, setIsGalleryLoading] = useState(false);
  const [isGallerySaving, setIsGallerySaving] = useState(false);
  const [deletingGalleryId, setDeletingGalleryId] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [profileMediaState, setProfileMediaState] = useState({ isDirty: false, isSaving: false });
  const previousModel = useRef(model);

  const provinces = useMemo(
    () => (locations?.provinces ?? []).filter((province) => province.country_id === form.country_id),
    [form.country_id, locations?.provinces],
  );
  const cities = useMemo(
    () => (locations?.cities ?? []).filter((city) => city.province_id === form.province_id),
    [form.province_id, locations?.cities],
  );

  useEffect(() => {
    const previous = normalizeModel(previousModel.current);
    const next = normalizeModel(model);
    const onlyMediaChanged = previous.id && previous.id === next.id
      && modelMetadataFields.every((field) => Object.is(previous[field], next[field]));

    previousModel.current = model;

    if (onlyMediaChanged) {
      setForm((current) => normalizeModel({ ...current, ...pickModelMedia(next) }));
    } else {
      setForm(next);
      setFeedback({ type: '', message: '' });
    }
  }, [model]);

  const editingGalleryImage = useMemo(
    () => gallery.find((image) => image.id === imageForm.id) ?? null,
    [gallery, imageForm.id],
  );
  const isGalleryDirty = Boolean(galleryFile) || (imageForm.id
    ? imageForm.alt !== (editingGalleryImage?.alt ?? '')
      || Number(imageForm.sort_order) !== Number(editingGalleryImage?.sort_order ?? 0)
    : Boolean(imageForm.alt?.trim()) || Number(imageForm.sort_order) !== 0);
  const mediaState = {
    isDirty: profileMediaState.isDirty || isGalleryDirty,
    isSaving: profileMediaState.isSaving || isGallerySaving || Boolean(deletingGalleryId),
  };
  const isGalleryBusy = isGalleryLoading || isGallerySaving || Boolean(deletingGalleryId);
  const shouldBlockNavigation = useCallback(
    ({ currentLocation, nextLocation }) => (
      (mediaState.isDirty || mediaState.isSaving)
      && currentLocation.pathname !== nextLocation.pathname
    ),
    [mediaState.isDirty, mediaState.isSaving],
  );
  const blocker = useBlocker(shouldBlockNavigation);

  const handleMediaStateChange = useCallback((nextState) => {
    setProfileMediaState((current) => (
      current.isDirty === nextState.isDirty && current.isSaving === nextState.isSaving
        ? current
        : nextState
    ));
  }, []);

  useEffect(() => {
    onMediaStateChange?.(mediaState);
  }, [mediaState.isDirty, mediaState.isSaving, onMediaStateChange]);

  useEffect(() => {
    if (blocker.state !== 'blocked') return;

    if (mediaState.isSaving) {
      setFeedback({
        type: 'info',
        message: 'Espera a que termine la carga o el borrado antes de salir de esta página.',
      });
      blocker.reset();
      return;
    }

    if (window.confirm('Hay cambios sin guardar en la galería o en los medios del perfil. Si sales ahora, se descartarán.')) {
      blocker.proceed();
    } else {
      blocker.reset();
    }
  }, [blocker, mediaState.isSaving]);

  useEffect(() => {
    if (!mediaState.isDirty && !mediaState.isSaving) return undefined;

    const preventExit = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const protectAdminNavigation = (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const navigationControl = target?.closest('[data-admin-navigation]');

      if (!navigationControl) return;

      const canNavigate = !mediaState.isSaving && window.confirm(
        'Hay cambios sin guardar en la galería o en los medios del perfil. Si sales ahora, se descartarán.',
      );

      if (!canNavigate) {
        event.preventDefault();
        event.stopPropagation();

        if (mediaState.isSaving) {
          setFeedback({
            type: 'info',
            message: 'Espera a que termine la carga o el borrado antes de salir de esta página.',
          });
        }
      }
    };

    window.addEventListener('beforeunload', preventExit);
    document.addEventListener('click', protectAdminNavigation, true);
    return () => {
      window.removeEventListener('beforeunload', preventExit);
      document.removeEventListener('click', protectAdminNavigation, true);
    };
  }, [mediaState.isDirty, mediaState.isSaving]);

  useEffect(() => {
    if (!galleryFile) {
      setGalleryPreviewUrl('');
      return undefined;
    }

    const objectUrl = URL.createObjectURL(galleryFile);
    setGalleryPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [galleryFile]);

  useEffect(() => {
    let isMounted = true;

    async function loadGallery() {
      if (!form.id || !form.slug) {
        setGallery([]);
        setImageForm(emptyImage);
        setGalleryFile(null);
        setIsGalleryLoading(false);
        return;
      }

      setGallery([]);
      setImageForm({ ...emptyImage, model_slug: form.slug });
      setGalleryFile(null);
      setIsGalleryLoading(true);

      try {
        const images = await listGalleryImages({ modelId: form.id });

        if (isMounted) {
          setGallery(images);
          setImageForm({ ...emptyImage, model_slug: form.slug });
          setGalleryFile(null);
        }
      } catch (error) {
        if (isMounted) {
          setFeedback({ type: 'error', message: error.message });
        }
      } finally {
        if (isMounted) {
          setIsGalleryLoading(false);
        }
      }
    }

    loadGallery();

    return () => {
      isMounted = false;
    };
  }, [form.id]);

  function setField(name, value) {
    setForm((current) => {
      const next = { ...current, [name]: value };

      if (name === 'name' && !current.id) {
        next.slug = slugify(value);
      }

      if (name === 'country_id') {
        next.province_id = '';
        next.city_id = '';
      }

      if (name === 'province_id') {
        next.city_id = '';
      }

      return next;
    });
  }

  function setImageField(name, value) {
    setImageForm((current) => ({ ...current, [name]: value }));
  }

  function selectGalleryFile(file) {
    try {
      validateGalleryImageFile(file);
      setGalleryFile(file);
      setFeedback({ type: '', message: '' });
    } catch (error) {
      setGalleryFile(null);
      setFeedback({ type: 'error', message: error.message });
    }
  }

  function editGalleryImage(image) {
    if (imageForm.id === image.id) return;

    if (isGalleryDirty && !window.confirm('Hay cambios sin guardar en la foto actual. ¿Quieres descartarlos y editar otra?')) {
      return;
    }

    setImageForm(image);
    setGalleryFile(null);
    setFeedback({ type: '', message: '' });
  }

  function resetGalleryForm() {
    setImageForm({ ...emptyImage, model_slug: form.slug });
    setGalleryFile(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (mediaState.isSaving) {
      setFeedback({ type: 'info', message: 'Espera a que termine la carga de medios.' });
      return;
    }

    if (form.status === 'published') {
      const missingRequirements = [];

      if (!form.whatsapp_number?.trim()) missingRequirements.push('celular/WhatsApp');
      if (!form.cover_image?.trim()) missingRequirements.push('portada de escritorio');
      if (!form.profile_image?.trim()) missingRequirements.push('foto de perfil');

      if (missingRequirements.length) {
        setFeedback({
          type: 'error',
          message: `Para publicar faltan: ${missingRequirements.join(', ')}.`,
        });
        return;
      }
    }

    setIsSaving(true);
    setFeedback({ type: '', message: '' });

    try {
      const savedModel = await saveModel(form);
      setForm((current) => normalizeModel({ ...savedModel, ...pickModelMedia(current) }));
      onSaved?.(savedModel);
      setFeedback({ type: 'success', message: 'Modelo guardado.' });
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveImage(event) {
    event.preventDefault();

    if (isGalleryBusy) return;

    if (!form.id) {
      setFeedback({ type: 'error', message: 'Guarda primero el modelo para habilitar su galería.' });
      return;
    }

    setFeedback({ type: '', message: '' });
    setIsGallerySaving(true);

    try {
      const wasEditing = Boolean(imageForm.id);
      const result = await saveGalleryImageFile({
        alt: imageForm.alt,
        file: galleryFile,
        imageId: imageForm.id,
        modelId: form.id,
        sortOrder: imageForm.sort_order,
      });
      const savedImage = result.image;
      setGallery((current) => {
        const exists = current.some((item) => item.id === savedImage.id);
        const next = exists
          ? current.map((item) => (item.id === savedImage.id ? savedImage : item))
          : [...current, savedImage];

        return next.sort((left, right) => (
          Number(left.sort_order) - Number(right.sort_order) || left.id.localeCompare(right.id)
        ));
      });
      resetGalleryForm();
      setFeedback({
        type: result.cleanupWarning ? 'info' : 'success',
        message: result.cleanupWarning
          || (wasEditing ? 'Foto de galería actualizada.' : 'Foto subida a la galería y guardada en R2.'),
      });
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setIsGallerySaving(false);
    }
  }

  async function handleDeleteImage(image) {
    if (isGalleryBusy) return;

    if (!window.confirm('La foto se eliminará de la galería y también de R2. ¿Continuar?')) {
      return;
    }

    setFeedback({ type: '', message: '' });
    setDeletingGalleryId(image.id);

    try {
      const result = await deleteGalleryImageFile({ imageId: image.id, modelId: form.id });
      setGallery((current) => current.filter((item) => item.id !== image.id));

      if (imageForm.id === image.id) {
        resetGalleryForm();
      }

      setFeedback({
        type: result?.r2Deleted ? 'success' : 'info',
        message: result?.r2Deleted
          ? 'Foto eliminada de la galería y de R2.'
          : 'Foto eliminada de la galería. Este registro no estaba vinculado a un archivo R2 administrado.',
      });
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setDeletingGalleryId('');
    }
  }

  async function handleMediaSaved(savedMedia) {
    setForm((current) => normalizeModel({ ...current, ...savedMedia }));
    await onMediaSaved?.(form.id, savedMedia);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <form className="rounded-lg border border-slate-800 bg-[#0f131a] p-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput label="Nombre" value={form.name} onChange={(event) => setField('name', event.target.value)} required />
          <TextInput label="Slug" value={form.slug} onChange={(event) => setField('slug', event.target.value)} required />

          {canManageCatalog ? (
            <SelectInput label="Estado" value={form.status} onChange={(event) => setField('status', event.target.value)}>
              <option value="draft">Borrador</option>
              <option value="published">Publicado</option>
              <option value="archived">Archivado</option>
            </SelectInput>
          ) : (
            <TextInput label="Estado" value={form.status} disabled readOnly />
          )}

          {categories?.length ? (
            <SelectInput
              label="Categoria"
              value={form.category}
              onChange={(event) => setField('category', event.target.value)}
              disabled={!canManageCatalog}
            >
              <option value="">Seleccionar</option>
              {categories.map((category) => (
                <option key={category.id} value={category.label}>
                  {category.label}
                </option>
              ))}
            </SelectInput>
          ) : (
            <TextInput
              label="Categoria"
              value={form.category}
              onChange={(event) => setField('category', event.target.value)}
              disabled={!canManageCatalog}
            />
          )}

          <TextInput label="Edad" type="number" value={form.age} onChange={(event) => setField('age', event.target.value)} />
          <TextInput label="Ciudad visible" value={form.city} onChange={(event) => setField('city', event.target.value)} required />

          <SelectInput
            label="Pais"
            value={form.country_id}
            onChange={(event) => setField('country_id', event.target.value)}
            disabled={!canManageCatalog}
          >
            <option value="">Sin pais</option>
            {(locations?.countries ?? []).map((country) => (
              <option key={country.id} value={country.id}>
                {country.name}
              </option>
            ))}
          </SelectInput>

          <SelectInput
            label="Provincia"
            value={form.province_id}
            onChange={(event) => setField('province_id', event.target.value)}
            disabled={!canManageCatalog || !form.country_id}
          >
            <option value="">Sin provincia</option>
            {provinces.map((province) => (
              <option key={province.id} value={province.id}>
                {province.name}
              </option>
            ))}
          </SelectInput>

          <SelectInput
            label="Ciudad catalogada"
            value={form.city_id}
            onChange={(event) => setField('city_id', event.target.value)}
            disabled={!canManageCatalog || !form.province_id}
          >
            <option value="">Sin ciudad</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </SelectInput>

          <TextInput label="Orden" type="number" value={form.sort_order} onChange={(event) => setField('sort_order', event.target.value)} disabled={!canManageCatalog} />
          <TextInput
            label="Celular/WhatsApp"
            value={form.whatsapp_number}
            onChange={(event) => setField('whatsapp_number', event.target.value)}
            onInvalid={() => {
              if (form.status === 'published') {
                setFeedback({
                  type: 'error',
                  message: 'El celular/WhatsApp es obligatorio para publicar una modelo.',
                });
              }
            }}
            required={form.status === 'published'}
          />
          <TextInput label="Instagram" value={form.instagram_url} onChange={(event) => setField('instagram_url', event.target.value)} />
          <div className="md:col-span-2">
            <TextInput
              label="Descripcion breve"
              value={form.short_description}
              onChange={(event) => setField('short_description', event.target.value)}
              textarea
            />
          </div>
          <div className="md:col-span-2">
            <TextInput
              label="Descripcion"
              value={form.description}
              onChange={(event) => setField('description', event.target.value)}
              textarea
            />
          </div>
          {canManageCatalog ? (
            <CheckboxInput checked={Boolean(form.featured)} label="Destacada" onChange={(value) => setField('featured', value)} />
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={isSaving || mediaState.isSaving}
          >
            <Save aria-hidden="true" size={18} />
            {isSaving ? 'Guardando...' : 'Guardar modelo'}
          </button>
          <StatusMessage message={feedback.message} type={feedback.type} />
        </div>
        </form>

        <aside className="rounded-lg border border-slate-800 bg-[#0f131a] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-white">Galería de {form.name || 'la modelo'}</h2>
                <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-300">
                  R2
                </span>
              </div>
              <p className="mt-1 text-sm leading-5 text-slate-400">
                Sube, ordena y elimina las fotos de este perfil.
              </p>
            </div>
            <ImagePlus aria-hidden="true" className="shrink-0 text-rose-400" size={22} />
          </div>

          {form.id && form.slug ? (
            <>
              <form className="mt-5 space-y-4" onSubmit={handleSaveImage}>
                <div>
                  <span className="block text-sm font-medium text-slate-200">Foto de galería</span>
                  <label className={`mt-2 flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed px-3 text-sm font-semibold transition ${
                    isGalleryBusy
                      ? 'pointer-events-none border-slate-800 text-slate-600'
                      : 'border-slate-600 text-slate-200 hover:border-rose-500 hover:text-white'
                  }`}>
                    <Upload aria-hidden="true" size={17} />
                    {galleryFile
                      ? galleryFile.name
                      : imageForm.id
                        ? 'Elegir otra foto (opcional)'
                        : 'Seleccionar foto para subir'}
                    <input
                      accept={GALLERY_IMAGE_ACCEPT}
                      className="sr-only"
                      disabled={isGalleryBusy}
                      type="file"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = '';
                        if (file) selectGalleryFile(file);
                      }}
                    />
                  </label>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    JPEG, PNG o WebP · menos de 5 MB. El archivo se guarda directamente en R2.
                  </p>
                </div>

                {galleryPreviewUrl || imageForm.src ? (
                  <div className="relative aspect-[4/3] overflow-hidden rounded-md border border-slate-800 bg-slate-950">
                    <img
                      alt="Vista previa de la foto de galería"
                      className="h-full w-full object-cover"
                      src={galleryPreviewUrl || resolveAssetUrl(imageForm.src)}
                    />
                    {galleryFile ? (
                      <span className="absolute left-2 top-2 rounded bg-emerald-500 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                        Nueva foto
                      </span>
                    ) : null}
                  </div>
                ) : null}

                <TextInput disabled={isGalleryBusy} label="Descripción de la foto (texto alt)" value={imageForm.alt} onChange={(event) => setImageField('alt', event.target.value)} />
                <TextInput disabled={isGalleryBusy} label="Orden en la galería" type="number" value={imageForm.sort_order} onChange={(event) => setImageField('sort_order', event.target.value)} />

                <div className="flex gap-2">
                  <button
                    className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-rose-600 px-3 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
                    disabled={isGalleryBusy || (!imageForm.id && !galleryFile)}
                    type="submit"
                  >
                    <Save aria-hidden="true" size={16} />
                    {isGallerySaving
                      ? 'Subiendo...'
                      : imageForm.id
                        ? 'Guardar cambios'
                        : 'Subir a la galería'}
                  </button>

                  {imageForm.id || galleryFile ? (
                    <button
                      aria-label="Cancelar edición de la foto"
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-700 px-3 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white disabled:opacity-60"
                      disabled={isGalleryBusy}
                      title="Cancelar edición"
                      type="button"
                      onClick={resetGalleryForm}
                    >
                      <RotateCcw aria-hidden="true" size={16} />
                      <span className="sr-only sm:not-sr-only">Cancelar</span>
                    </button>
                  ) : null}
                </div>
              </form>

              <div className="mt-6 border-t border-slate-800 pt-5">
                <h3 className="text-sm font-semibold text-white">Fotos publicadas ({gallery.length})</h3>
                <div className="mt-3 space-y-3">
                  {isGalleryLoading ? <p className="text-sm text-slate-400">Cargando galería...</p> : null}
                  {!isGalleryLoading && !gallery.length ? (
                    <p className="rounded-md border border-dashed border-slate-800 p-4 text-sm leading-6 text-slate-500">
                      Este perfil todavía no tiene fotos de galería.
                    </p>
                  ) : null}
                  {gallery.map((image) => (
                    <div key={image.id} className={`grid grid-cols-[72px_1fr_auto] gap-3 rounded-md border bg-slate-950 p-2 ${
                      imageForm.id === image.id ? 'border-rose-500' : 'border-slate-800'
                    }`}>
                      <div className="h-20 overflow-hidden rounded bg-slate-900">
                        <img className="h-full w-full object-cover" src={resolveAssetUrl(image.src)} alt={image.alt || ''} loading="lazy" />
                      </div>
                      <button
                        className="min-w-0 text-left disabled:opacity-60"
                        disabled={isGalleryBusy}
                        type="button"
                        onClick={() => editGalleryImage(image)}
                      >
                        <span className="block truncate text-sm font-medium text-white">{image.alt || 'Sin descripción'}</span>
                        <span className="mt-1 block text-xs text-slate-500">Orden {image.sort_order ?? 0} · Editar</span>
                      </button>
                      <button
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-800 text-slate-400 transition hover:border-rose-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                        type="button"
                        aria-label="Eliminar foto de la galería y de R2"
                        disabled={isGalleryBusy}
                        title="Eliminar de la galería y de R2"
                        onClick={() => handleDeleteImage(image)}
                      >
                        <Trash2 aria-hidden="true" size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="mt-5 rounded-md border border-slate-800 bg-slate-950 p-4 text-sm leading-6 text-slate-400">
              Guarda primero el modelo como borrador. Después podrás subir y administrar su galería.
            </p>
          )}
        </aside>
      </div>

      <ModelMediaEditor
        disabled={isSaving}
        model={form}
        onSaved={handleMediaSaved}
        onStateChange={handleMediaStateChange}
      />
    </div>
  );
}
