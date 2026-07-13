import {
  Image as ImageIcon,
  Monitor,
  RotateCcw,
  Save,
  Smartphone,
  Trash2,
  Upload,
  Video,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { StatusMessage } from '../../components/admin/StatusMessage.jsx';
import {
  HERO_MEDIA_SLOT_KEYS,
  HERO_MEDIA_SLOTS,
  getHomeSiteSettings,
  resolveSiteMediaUrl,
  saveHomeHeroMedia,
  validateHeroMediaFile,
} from '../../services/siteMediaService.js';
import { getBundledHeroImageUrl, selectHeroMedia } from '../../utils/heroMedia.js';

const deviceGroups = [
  {
    description: 'Se muestra desde 768 px. El video tiene prioridad sobre la imagen.',
    icon: Monitor,
    isMobile: false,
    key: 'desktop',
    slots: ['hero_desktop_image', 'hero_desktop_video'],
    title: 'Escritorio',
  },
  {
    description: 'Se muestra hasta 767 px. Si no hay imagen movil, usa la imagen de escritorio.',
    icon: Smartphone,
    isMobile: true,
    key: 'mobile',
    slots: ['hero_mobile_image', 'hero_mobile_video'],
    title: 'Celular',
  },
];

function createEmptyDraft() {
  return Object.fromEntries(
    HERO_MEDIA_SLOT_KEYS.map((slot) => [slot, { file: null, remove: false }]),
  );
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 MB';
  }

  return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 1 : 2)} MB`;
}

function formatSettingsError(error) {
  const message = error?.message || 'No se pudo cargar la configuracion de portada.';

  if (/site_settings|schema cache|relation .* does not exist/i.test(message)) {
    return 'La portada aun no esta configurada en Supabase. Aplica primero la migracion incremental de site_settings y site-media.';
  }

  return message;
}

function MediaFrame({ kind, label, poster, src, variant = 'slot' }) {
  const frameClass = variant === 'mobile'
    ? 'mx-auto aspect-[9/16] max-h-[520px] w-full max-w-[292px]'
    : variant === 'desktop'
      ? 'aspect-video w-full'
      : 'aspect-video w-full';

  if (!src) {
    return (
      <div className={`${frameClass} flex items-center justify-center rounded-md border border-dashed border-slate-700 bg-slate-950 px-5 text-center text-sm text-slate-500`}>
        Sin archivo en este espacio
      </div>
    );
  }

  if (kind === 'video') {
    return (
      <video
        aria-label={label}
        className={`${frameClass} rounded-md bg-black object-cover`}
        controls
        loop
        muted
        playsInline
        poster={poster || undefined}
        preload="metadata"
        src={src}
      />
    );
  }

  return <img alt={label} className={`${frameClass} rounded-md bg-black object-cover`} src={src} />;
}

function EffectivePreview({ group, media }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Resultado efectivo</p>
        <span className="rounded-full border border-slate-700 px-2 py-1 text-[11px] text-slate-400">
          {media.kind === 'video' ? 'Video' : 'Imagen'}
        </span>
      </div>
      <MediaFrame
        kind={media.kind}
        label={`Vista previa de portada para ${group.title.toLowerCase()}`}
        poster={media.poster}
        src={media.src}
        variant={group.isMobile ? 'mobile' : 'desktop'}
      />
    </div>
  );
}

function SlotEditor({ currentPath, draft, isSaving, onCancel, onFile, onRemove, previewUrl, progress, slot }) {
  const config = HERO_MEDIA_SLOTS[slot];
  const Icon = config.kind === 'image' ? ImageIcon : Video;
  const hasPendingChange = Boolean(draft.file || draft.remove);
  const canRemove = Boolean(draft.file || currentPath) && !draft.remove;
  const status = draft.file
    ? `Nuevo archivo: ${draft.file.name}`
    : draft.remove
      ? 'Se eliminara al guardar.'
      : currentPath
        ? 'Archivo guardado actualmente.'
        : 'Este espacio esta vacio.';

  return (
    <article className="rounded-lg border border-slate-800 bg-[#0b0d10] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-900 text-rose-400">
            <Icon aria-hidden="true" size={19} />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-white">{config.label}</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {config.kind === 'image' ? 'JPEG, PNG o WebP; maximo 10 MB.' : 'MP4 o WebM; maximo 50 MB.'}
            </p>
          </div>
        </div>
        {hasPendingChange ? (
          <span className="rounded-full bg-amber-400/10 px-2 py-1 text-[11px] font-semibold text-amber-200">Sin guardar</span>
        ) : null}
      </div>

      <div className="mt-4">
        <MediaFrame
          kind={config.kind}
          label={`Vista previa de ${config.label.toLowerCase()}`}
          src={draft.remove ? '' : previewUrl}
        />
      </div>

      <p className={`mt-3 break-all text-xs leading-5 ${draft.remove ? 'text-amber-200' : 'text-slate-400'}`}>{status}</p>

      {progress ? (
        <div className="mt-3" aria-label={`Progreso de ${config.label.toLowerCase()}`}>
          <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
            <span>{formatBytes(progress.bytesUploaded)} / {formatBytes(progress.bytesTotal)}</span>
            <span>{progress.percent}%</span>
          </div>
          <div
            aria-valuemax="100"
            aria-valuemin="0"
            aria-valuenow={progress.percent}
            className="h-2 overflow-hidden rounded-full bg-slate-800"
            role="progressbar"
          >
            <div className="h-full rounded-full bg-rose-500 transition-[width]" style={{ width: `${progress.percent}%` }} />
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <label className={`inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md bg-rose-600 px-3 text-xs font-semibold text-white transition hover:bg-rose-500 ${isSaving ? 'pointer-events-none opacity-60' : ''}`}>
          <Upload aria-hidden="true" size={16} />
          {currentPath || draft.file ? 'Reemplazar' : 'Seleccionar'}
          <input
            accept={config.accept}
            className="sr-only"
            disabled={isSaving}
            type="file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) {
                onFile(file);
              }
            }}
          />
        </label>

        {canRemove ? (
          <button
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-700 px-3 text-xs font-semibold text-slate-300 transition hover:border-rose-500 hover:text-white disabled:opacity-60"
            disabled={isSaving}
            type="button"
            onClick={onRemove}
          >
            <Trash2 aria-hidden="true" size={16} />
            Eliminar
          </button>
        ) : null}

        {hasPendingChange ? (
          <button
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-700 px-3 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white disabled:opacity-60"
            disabled={isSaving}
            type="button"
            onClick={onCancel}
          >
            <RotateCcw aria-hidden="true" size={16} />
            Deshacer
          </button>
        ) : null}
      </div>
    </article>
  );
}

export default function AdminHomeHero() {
  const [settings, setSettings] = useState(null);
  const [draft, setDraft] = useState(createEmptyDraft);
  const [objectUrls, setObjectUrls] = useState({});
  const [progress, setProgress] = useState({});
  const [feedback, setFeedback] = useState({ message: '', type: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      setIsLoading(true);

      try {
        const nextSettings = await getHomeSiteSettings();

        if (isMounted) {
          setSettings(nextSettings);
          setFeedback({ message: '', type: '' });
        }
      } catch (error) {
        if (isMounted) {
          setFeedback({ message: formatSettingsError(error), type: 'error' });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const urls = {};

    HERO_MEDIA_SLOT_KEYS.forEach((slot) => {
      if (draft[slot].file) {
        urls[slot] = URL.createObjectURL(draft[slot].file);
      }
    });
    setObjectUrls(urls);

    return () => {
      Object.values(urls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [draft]);

  const fallbackImageUrl = getBundledHeroImageUrl(import.meta.env.BASE_URL || '/');
  const draftMediaUrls = useMemo(() => {
    const urls = {};

    HERO_MEDIA_SLOT_KEYS.forEach((slot) => {
      if (draft[slot].remove) {
        urls[slot] = '';
      } else if (objectUrls[slot]) {
        urls[slot] = objectUrls[slot];
      } else {
        urls[slot] = resolveSiteMediaUrl(settings?.[slot]);
      }
    });

    return urls;
  }, [draft, objectUrls, settings]);
  const effectiveMedia = useMemo(
    () => Object.fromEntries(
      deviceGroups.map((group) => [
        group.key,
        selectHeroMedia({
          fallbackImageUrl,
          isMobile: group.isMobile,
          resolveMediaUrl: (value) => value || '',
          settings: draftMediaUrls,
        }),
      ]),
    ),
    [draftMediaUrls, fallbackImageUrl],
  );
  const isDirty = HERO_MEDIA_SLOT_KEYS.some((slot) => draft[slot].file || draft[slot].remove);

  useEffect(() => {
    if (!isDirty && !isSaving) {
      return undefined;
    }

    const preventAccidentalExit = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', preventAccidentalExit);
    return () => window.removeEventListener('beforeunload', preventAccidentalExit);
  }, [isDirty, isSaving]);

  function selectFile(slot, file) {
    try {
      validateHeroMediaFile(slot, file);
      setDraft((current) => ({
        ...current,
        [slot]: { file, remove: false },
      }));
      setFeedback({ message: '', type: '' });
    } catch (error) {
      setFeedback({ message: error.message, type: 'error' });
    }
  }

  function removeSlot(slot) {
    setDraft((current) => ({
      ...current,
      [slot]: { file: null, remove: true },
    }));
    setFeedback({ message: '', type: '' });
  }

  function cancelSlot(slot) {
    setDraft((current) => ({
      ...current,
      [slot]: { file: null, remove: false },
    }));
    setProgress((current) => {
      const next = { ...current };
      delete next[slot];
      return next;
    });
  }

  async function handleSave() {
    if (!isDirty || isSaving) {
      return;
    }

    const files = {};
    const removals = [];

    HERO_MEDIA_SLOT_KEYS.forEach((slot) => {
      if (draft[slot].file) {
        files[slot] = draft[slot].file;
      } else if (draft[slot].remove) {
        removals.push(slot);
      }
    });

    setIsSaving(true);
    setProgress({});
    setFeedback({ message: '', type: '' });

    try {
      const result = await saveHomeHeroMedia({
        files,
        removals,
        onProgress(update) {
          setProgress((current) => ({ ...current, [update.slot]: update }));
        },
      });

      setSettings(result.settings);
      setDraft(createEmptyDraft());
      setProgress({});
      setFeedback({
        message: result.cleanupWarning || 'Portada guardada correctamente.',
        type: result.cleanupWarning ? 'info' : 'success',
      });
    } catch (error) {
      setFeedback({ message: formatSettingsError(error), type: 'error' });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <AdminPageHeader
        actions={(
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
            disabled={!isDirty || isLoading || isSaving || !settings}
            type="button"
            onClick={handleSave}
          >
            <Save aria-hidden="true" size={18} />
            {isSaving ? 'Guardando...' : 'Guardar portada'}
          </button>
        )}
        description="Configura por separado la imagen y el video principal para escritorio y celular. Los cuatro cambios se guardan juntos."
        eyebrow="Sitio publico"
        title="Portada de Inicio"
      />

      <StatusMessage message={feedback.message} type={feedback.type} />

      {isLoading ? <p className="mt-6 text-sm text-slate-400">Cargando configuracion de portada...</p> : null}

      {!isLoading && settings ? (
        <div className="space-y-6">
          {settings.updated_at ? (
            <p className="text-xs text-slate-500">
              Ultima actualizacion: {new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(settings.updated_at))}
            </p>
          ) : null}

          {deviceGroups.map((group) => {
            const GroupIcon = group.icon;

            return (
              <section className="rounded-xl border border-slate-800 bg-[#0f131a] p-4 md:p-5" key={group.key}>
                <div className="mb-5 flex items-start gap-3">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-rose-600/10 text-rose-400">
                    <GroupIcon aria-hidden="true" size={21} />
                  </span>
                  <div>
                    <h2 className="font-serif text-2xl font-semibold text-white">{group.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-400">{group.description}</p>
                  </div>
                </div>

                <div className={`grid gap-5 ${group.isMobile ? 'xl:grid-cols-[minmax(250px,360px)_minmax(0,1fr)]' : 'xl:grid-cols-[minmax(340px,0.9fr)_minmax(0,1.4fr)]'}`}>
                  <EffectivePreview group={group} media={effectiveMedia[group.key]} />
                  <div className="grid gap-4 md:grid-cols-2">
                    {group.slots.map((slot) => (
                      <SlotEditor
                        currentPath={settings[slot]}
                        draft={draft[slot]}
                        isSaving={isSaving}
                        key={slot}
                        previewUrl={draftMediaUrls[slot]}
                        progress={progress[slot]}
                        slot={slot}
                        onCancel={() => cancelSlot(slot)}
                        onFile={(file) => selectFile(slot, file)}
                        onRemove={() => removeSlot(slot)}
                      />
                    ))}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
