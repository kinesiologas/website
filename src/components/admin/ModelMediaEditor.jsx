import { ImageIcon, RotateCcw, Save, Trash2, Upload, Video } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  MODEL_MEDIA_SLOT_KEYS,
  MODEL_MEDIA_SLOTS,
  resolveModelMediaUrl,
  saveModelMedia,
  validateModelMediaFile,
} from '../../services/modelMediaService.js';
import { StatusMessage } from './StatusMessage.jsx';

const slotPresentation = {
  cover_image: {
    description: 'Imagen principal y respaldo del video en pantallas de 768 px o más.',
    required: true,
  },
  cover_desktop_video: {
    description: 'Video opcional para escritorio. Se reproduce silenciado y en bucle.',
    required: false,
  },
  cover_mobile_image: {
    description: 'Imagen opcional para celular. Si falta, se usa la portada de escritorio.',
    required: false,
  },
  cover_mobile_video: {
    description: 'Video opcional para pantallas menores de 768 px.',
    required: false,
  },
  profile_image: {
    description: 'Foto pública utilizada en el perfil y en las tarjetas del catálogo.',
    required: true,
  },
};

function createEmptyDraft() {
  return Object.fromEntries(MODEL_MEDIA_SLOT_KEYS.map((slot) => [slot, { file: null, remove: false }]));
}

function formatLimit(maxBytes) {
  return maxBytes < 2 * 1024 * 1024 ? 'menos de 1 MiB' : 'menos de 10 MiB';
}

function MediaPreview({ kind, poster, src }) {
  if (!src) {
    return (
      <div className="flex h-full min-h-44 items-center justify-center bg-slate-950 text-sm text-slate-500">
        Sin archivo
      </div>
    );
  }

  if (kind === 'video') {
    return (
      <video
        className="h-44 w-full bg-black object-cover"
        controls
        muted
        playsInline
        poster={poster || undefined}
        preload="metadata"
        src={src}
      />
    );
  }

  return <img className="h-44 w-full bg-slate-950 object-cover" src={src} alt="Previsualización del medio" />;
}

function SlotCard({ currentValue, draft, isSaving, objectUrl, onCancel, onFile, onRemove, progress, slot, poster }) {
  const config = MODEL_MEDIA_SLOTS[slot];
  const presentation = slotPresentation[slot];
  const Icon = config.kind === 'image' ? ImageIcon : Video;
  const hasPendingChange = Boolean(draft.file || draft.remove);
  const canRemove = !presentation.required && !draft.remove && Boolean(draft.file || currentValue);
  const previewUrl = draft.remove ? '' : objectUrl || resolveModelMediaUrl(currentValue);

  return (
    <article className="overflow-hidden rounded-lg border border-slate-800 bg-[#0f131a]">
      <MediaPreview kind={config.kind} poster={poster} src={previewUrl} />

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-white">{config.label}</h3>
              {presentation.required ? (
                <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-300">
                  Obligatoria
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-400">{presentation.description}</p>
          </div>
          <Icon aria-hidden="true" className="shrink-0 text-rose-400" size={20} />
        </div>

        <p className="mt-3 text-xs text-slate-500">
          {config.kind === 'image' ? 'JPEG, PNG o WebP' : 'MP4 o WebM'} · {formatLimit(config.maxBytes)}
        </p>

        {draft.file ? (
          <p className="mt-2 truncate text-xs text-emerald-300">Nuevo: {draft.file.name}</p>
        ) : draft.remove ? (
          <p className="mt-2 text-xs text-amber-300">Se eliminará al guardar.</p>
        ) : null}

        {progress ? (
          <div className="mt-3" aria-label={`Progreso de ${config.label}`}>
            <div className="mb-1 flex justify-between text-[11px] text-slate-400">
              <span>Subiendo</span>
              <span>{progress.percent}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-rose-500 transition-[width]" style={{ width: `${progress.percent}%` }} />
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <label className={`inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md bg-rose-600 px-3 text-xs font-semibold text-white transition hover:bg-rose-500 ${isSaving ? 'pointer-events-none opacity-60' : ''}`}>
            <Upload aria-hidden="true" size={15} />
            {currentValue || draft.file ? 'Reemplazar' : 'Seleccionar'}
            <input
              accept={config.accept}
              className="sr-only"
              disabled={isSaving}
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) onFile(file);
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
              <Trash2 aria-hidden="true" size={15} />
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
              <RotateCcw aria-hidden="true" size={15} />
              Deshacer
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function ModelMediaEditor({ disabled = false, model, onSaved, onStateChange }) {
  const [draft, setDraft] = useState(createEmptyDraft);
  const [objectUrls, setObjectUrls] = useState({});
  const [progress, setProgress] = useState({});
  const [feedback, setFeedback] = useState({ message: '', type: '' });
  const [isSaving, setIsSaving] = useState(false);

  const currentMedia = useMemo(
    () => Object.fromEntries(MODEL_MEDIA_SLOT_KEYS.map((slot) => [slot, model?.[slot] || null])),
    [
      model?.cover_desktop_video,
      model?.cover_image,
      model?.cover_mobile_image,
      model?.cover_mobile_video,
      model?.profile_image,
    ],
  );
  const isDirty = MODEL_MEDIA_SLOT_KEYS.some((slot) => draft[slot].file || draft[slot].remove);

  useEffect(() => {
    setDraft(createEmptyDraft());
    setProgress({});
    setFeedback({ message: '', type: '' });
  }, [model?.id]);

  useEffect(() => {
    const nextUrls = {};

    MODEL_MEDIA_SLOT_KEYS.forEach((slot) => {
      if (draft[slot].file) {
        nextUrls[slot] = URL.createObjectURL(draft[slot].file);
      }
    });

    setObjectUrls(nextUrls);
    return () => Object.values(nextUrls).forEach((url) => URL.revokeObjectURL(url));
  }, [draft]);

  useEffect(() => {
    if (!isDirty && !isSaving) return undefined;

    const preventExit = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', preventExit);
    return () => window.removeEventListener('beforeunload', preventExit);
  }, [isDirty, isSaving]);

  useEffect(() => {
    onStateChange?.({ isDirty, isSaving });
  }, [isDirty, isSaving, onStateChange]);

  useEffect(() => {
    if (!isDirty && !isSaving) return undefined;

    const protectAdminNavigation = (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const navigationControl = target?.closest('a[href], [data-admin-navigation]');
      const link = navigationControl?.matches('a[href]') ? navigationControl : null;

      if (!navigationControl || link?.target === '_blank' || link?.hasAttribute('download')) return;

      const canNavigate = !isSaving && window.confirm(
        'Hay cambios de medios sin guardar. Si sales ahora, se descartarán.',
      );

      if (!canNavigate) {
        event.preventDefault();
        event.stopPropagation();

        if (isSaving) {
          setFeedback({
            message: 'Espera a que termine la carga antes de salir de esta página.',
            type: 'info',
          });
        }
      }
    };

    document.addEventListener('click', protectAdminNavigation, true);
    return () => document.removeEventListener('click', protectAdminNavigation, true);
  }, [isDirty, isSaving]);

  function selectFile(slot, file) {
    try {
      validateModelMediaFile(slot, file);
      setDraft((current) => ({ ...current, [slot]: { file, remove: false } }));
      setProgress((current) => {
        const next = { ...current };
        delete next[slot];
        return next;
      });
      setFeedback({ message: '', type: '' });
    } catch (error) {
      setFeedback({ message: error.message, type: 'error' });
    }
  }

  function removeSlot(slot) {
    setDraft((current) => ({ ...current, [slot]: { file: null, remove: true } }));
    setProgress((current) => {
      const next = { ...current };
      delete next[slot];
      return next;
    });
    setFeedback({ message: '', type: '' });
  }

  function cancelSlot(slot) {
    setDraft((current) => ({ ...current, [slot]: { file: null, remove: false } }));
    setProgress((current) => {
      const next = { ...current };
      delete next[slot];
      return next;
    });
  }

  async function handleSave() {
    if (disabled || !model?.id || !isDirty || isSaving) return;

    const files = {};
    const removals = [];
    const nextRequiredMedia = { ...currentMedia };

    MODEL_MEDIA_SLOT_KEYS.forEach((slot) => {
      if (draft[slot].file) {
        files[slot] = draft[slot].file;
        nextRequiredMedia[slot] = '__pending_upload__';
      } else if (draft[slot].remove) {
        removals.push(slot);
        nextRequiredMedia[slot] = null;
      }
    });

    if (!nextRequiredMedia.cover_image || !nextRequiredMedia.profile_image) {
      setFeedback({
        message: 'La imagen de portada para escritorio y la foto de perfil son obligatorias.',
        type: 'error',
      });
      return;
    }

    setIsSaving(true);
    setProgress({});
    setFeedback({ message: '', type: '' });

    try {
      const result = await saveModelMedia({
        currentMedia,
        files,
        modelId: model.id,
        removals,
        onProgress(update) {
          setProgress((current) => ({ ...current, [update.slot]: update }));
        },
      });
      await onSaved?.(result.media);
      setDraft(createEmptyDraft());
      setProgress({});
      setFeedback({
        message: result.cleanupWarning || 'Los medios del perfil se guardaron y ya están publicados.',
        type: result.cleanupWarning ? 'info' : 'success',
      });
    } catch (error) {
      setProgress({});
      setFeedback({ message: error.message, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  }

  const desktopPoster = objectUrls.cover_image || resolveModelMediaUrl(currentMedia.cover_image);
  const mobilePoster = draft.cover_mobile_image.remove
    ? desktopPoster
    : objectUrls.cover_mobile_image
      || resolveModelMediaUrl(currentMedia.cover_mobile_image)
      || desktopPoster;

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 md:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-400">Medios públicos</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Portada y foto de perfil</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Configura medios distintos para escritorio y celular. Los cinco cambios se publican juntos.
          </p>
        </div>
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
          disabled={disabled || !model?.id || !isDirty || isSaving}
          type="button"
          onClick={handleSave}
        >
          <Save aria-hidden="true" size={17} />
          {isSaving ? 'Guardando medios...' : 'Guardar medios'}
        </button>
      </div>

      {!model?.id ? (
        <StatusMessage
          message="Guarda primero el modelo como borrador para habilitar la carga de portada y foto de perfil."
          type="info"
        />
      ) : null}
      <div className="mt-4">
        <StatusMessage message={feedback.message} type={feedback.type} />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {MODEL_MEDIA_SLOT_KEYS.map((slot) => (
          <SlotCard
            currentValue={currentMedia[slot]}
            draft={draft[slot]}
            isSaving={disabled || isSaving || !model?.id}
            key={slot}
            objectUrl={objectUrls[slot]}
            poster={slot === 'cover_mobile_video' ? mobilePoster : slot === 'cover_desktop_video' ? desktopPoster : ''}
            progress={progress[slot]}
            slot={slot}
            onCancel={() => cancelSlot(slot)}
            onFile={(file) => selectFile(slot, file)}
            onRemove={() => removeSlot(slot)}
          />
        ))}
      </div>
    </section>
  );
}
