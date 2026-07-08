import { ImagePlus, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  deleteGalleryImage,
  listGalleryImages,
  saveGalleryImage,
  saveModel,
  slugify,
} from '../../services/adminService.js';
import { resolveAssetUrl } from '../../utils/assetUrl.js';
import { CheckboxInput, SelectInput, TextInput } from './FormControls.jsx';
import { StatusMessage } from './StatusMessage.jsx';

const emptyModel = {
  age: '',
  category: '',
  city: '',
  city_id: '',
  country_id: '',
  cover_image: '',
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

export function ModelEditor({ canManageCatalog, categories, locations, model, onSaved }) {
  const [form, setForm] = useState(() => normalizeModel(model));
  const [gallery, setGallery] = useState([]);
  const [imageForm, setImageForm] = useState(emptyImage);
  const [isSaving, setIsSaving] = useState(false);
  const [isGalleryLoading, setIsGalleryLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const provinces = useMemo(
    () => (locations?.provinces ?? []).filter((province) => province.country_id === form.country_id),
    [form.country_id, locations?.provinces],
  );
  const cities = useMemo(
    () => (locations?.cities ?? []).filter((city) => city.province_id === form.province_id),
    [form.province_id, locations?.cities],
  );

  useEffect(() => {
    setForm(normalizeModel(model));
    setFeedback({ type: '', message: '' });
  }, [model]);

  useEffect(() => {
    let isMounted = true;

    async function loadGallery() {
      if (!form.slug) {
        setGallery([]);
        setImageForm(emptyImage);
        return;
      }

      setIsGalleryLoading(true);

      try {
        const images = await listGalleryImages(form.slug);

        if (isMounted) {
          setGallery(images);
          setImageForm({ ...emptyImage, model_slug: form.slug });
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
  }, [form.slug]);

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

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSaving(true);
    setFeedback({ type: '', message: '' });

    try {
      const savedModel = await saveModel(form);
      setForm(normalizeModel(savedModel));
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
    setFeedback({ type: '', message: '' });

    try {
      const savedImage = await saveGalleryImage({ ...imageForm, model_slug: form.slug });
      setGallery((current) => {
        const exists = current.some((item) => item.id === savedImage.id);
        return exists
          ? current.map((item) => (item.id === savedImage.id ? savedImage : item))
          : [...current, savedImage].sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
      });
      setImageForm({ ...emptyImage, model_slug: form.slug });
      setFeedback({ type: 'success', message: 'Imagen guardada.' });
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    }
  }

  async function handleDeleteImage(imageId) {
    setFeedback({ type: '', message: '' });

    try {
      await deleteGalleryImage(imageId);
      setGallery((current) => current.filter((image) => image.id !== imageId));
      setFeedback({ type: 'success', message: 'Imagen eliminada.' });
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    }
  }

  return (
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
          <TextInput label="WhatsApp" value={form.whatsapp_number} onChange={(event) => setField('whatsapp_number', event.target.value)} />
          <TextInput label="Instagram" value={form.instagram_url} onChange={(event) => setField('instagram_url', event.target.value)} />
          <TextInput label="Portada URL/Ruta" value={form.cover_image} onChange={(event) => setField('cover_image', event.target.value)} required />
          <TextInput label="Perfil URL/Ruta" value={form.profile_image} onChange={(event) => setField('profile_image', event.target.value)} required />
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
            disabled={isSaving}
          >
            <Save aria-hidden="true" size={18} />
            {isSaving ? 'Guardando...' : 'Guardar modelo'}
          </button>
          <StatusMessage message={feedback.message} type={feedback.type} />
        </div>
      </form>

      <aside className="rounded-lg border border-slate-800 bg-[#0f131a] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Galeria</h2>
            <p className="mt-1 text-sm text-slate-400">{form.slug ? form.slug : 'Guarda el modelo primero'}</p>
          </div>
          <ImagePlus aria-hidden="true" className="text-rose-400" size={22} />
        </div>

        {form.slug ? (
          <>
            <form className="mt-5 space-y-3" onSubmit={handleSaveImage}>
              <TextInput label="Imagen URL/Ruta" value={imageForm.src} onChange={(event) => setImageField('src', event.target.value)} required />
              <TextInput label="Texto alt" value={imageForm.alt} onChange={(event) => setImageField('alt', event.target.value)} />
              <TextInput label="Orden" type="number" value={imageForm.sort_order} onChange={(event) => setImageField('sort_order', event.target.value)} />
              <button
                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-slate-700 px-3 text-sm font-semibold text-slate-200 transition hover:border-rose-500 hover:text-white"
                type="submit"
              >
                <Save aria-hidden="true" size={16} />
                {imageForm.id ? 'Actualizar imagen' : 'Agregar imagen'}
              </button>
            </form>

            <div className="mt-5 space-y-3">
              {isGalleryLoading ? <p className="text-sm text-slate-400">Cargando galeria...</p> : null}
              {gallery.map((image) => (
                <div key={image.id} className="grid grid-cols-[72px_1fr_auto] gap-3 rounded-md border border-slate-800 bg-slate-950 p-2">
                  <div className="h-20 overflow-hidden rounded bg-slate-900">
                    <img className="h-full w-full object-cover" src={resolveAssetUrl(image.src)} alt={image.alt || ''} loading="lazy" />
                  </div>
                  <button
                    className="min-w-0 text-left"
                    type="button"
                    onClick={() => setImageForm(image)}
                  >
                    <span className="block truncate text-sm font-medium text-white">{image.alt || image.src}</span>
                    <span className="mt-1 block truncate text-xs text-slate-500">{image.src}</span>
                  </button>
                  <button
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-800 text-slate-400 transition hover:border-rose-500 hover:text-white"
                    type="button"
                    aria-label="Eliminar imagen"
                    title="Eliminar imagen"
                    onClick={() => handleDeleteImage(image.id)}
                  >
                    <Trash2 aria-hidden="true" size={16} />
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-5 rounded-md border border-slate-800 bg-slate-950 p-4 text-sm leading-6 text-slate-400">
            La galeria se habilita cuando el modelo tiene slug guardado.
          </p>
        )}
      </aside>
    </div>
  );
}
