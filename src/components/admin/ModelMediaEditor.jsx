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
    action: 'imagen de escritorio',
    description: 'Imagen principal y respaldo del vídeo en pantallas de 768 px o más.',
    emptyLabel: 'Sin imagen de escritorio',
    required: true,
    title: 'Imagen',
  },
  cover_desktop_video: {
    action: 'vídeo de escritorio',
    description: 'Vídeo opcional para escritorio. Se reproduce silenciado y en bucle.',
    emptyLabel: 'Sin vídeo de escritorio',
    required: false,
    title: 'Vídeo',
  },
  cover_mobile_image: {
    action: 'imagen para celular',
    description: 'Imagen opcional para celular. Si falta, se usa la portada de escritorio.',
    emptyLabel: 'Sin imagen para celular',
    required: false,
    title: 'Imagen',
  },
  cover_mobile_video: {
    action: 'vídeo para celular',
    description: 'Vídeo opcional para pantallas menores de 768 px.',
    emptyLabel: 'Sin vídeo para celular',
    required: false,
    title: 'Vídeo',
  },
  profile_image: {
    action: 'foto de perfil',
    description: 'Foto pública utilizada en el perfil y en las tarjetas del catálogo.',
    emptyLabel: 'Sin foto de perfil',
    required: true,
    title: 'Foto de perfil',
  },
};

const mediaGroups = [
  {
    description: 'Se muestra en computadoras y también sirve de respaldo si el vídeo no carga.',
    id: 'desktop',
    slots: ['cover_image', 'cover_desktop_video'],
    title: 'Portada para escritorio',
  },
  {
    description: 'Se usa en pantallas menores de 768 px. Si está vacía, se utiliza la versión de escritorio.',
    id: 'mobile',
    slots: ['cover_mobile_image', 'cover_mobile_video'],
    title: 'Portada para celular',
  },
  {
    description: 'Es la foto que identifica a la modelo en su perfil y en el catálogo.',
    id: 'profile',
    slots: ['profile_image'],
    title: 'Foto pública de perfil',
  },
];

function createEmptyDraft() {
  return Object.fromEntries(MODEL_MEDIA_SLOT_KEYS.map((slot) => [slot, { file: null, remove: false }]));
}

function formatLimit(maxBytes) {
  return maxBytes < 2 * 1024 * 1024 ? 'menos de 1 MiB' : 'menos de 10 MiB';
}

function MediaPreview({ emptyLabel, kind, poster, src }) {
  if (!src) {
    const Icon = kind === 'video' ? Video : ImageIcon;

    return (
      <div className="flex h-44 flex-col items-center justify-center gap-2 border-t border-slate-800 bg-slate-950 px-4 text-center">
        <Icon aria-hidden="true" className="text-slate-700" size={28} />
        <span className="text-sm font-medium text-slate-400">{emptyLabel}</span>
        <span className="text-xs text-slate-600">Usa el botón de subida situado arriba.</span>
      </div>
    );
  }

  if (kind === 'video') {
    return (
      <video
        className="h-44 w-full border-t border-slate-800 bg-black object-cover"
        controls
        muted
        playsInline
        poster={poster || undefined}
        preload="metadata"
        src={src}
      />
    );
  }

  return <img className="h-44 w-full border-t border-slate-800 bg-slate-950 object-cover" src={src} alt="Previsualización del medio" />;
}

function SlotCard({ currentValue, draft, isSaving, objectUrl, onCancel, onFile, onRemove, progress, slot, poster }) {
  const config = MODEL_MEDIA_SLOTS[slot];
  const presentation = slotPresentation[slot];
  const Icon = config.kind === 'image' ? ImageIcon : Video;
  const hasPendingChange = Boolean(draft.file || draft.remove);
  const canRemove = !presentation.required && !draft.remove && Boolean(draft.file || currentValue);
  const previewUrl = draft.remove ? '' : objectUrl || resolveModelMediaUrl(currentValue);
  const actionLabel = `${draft.file || currentValue ? 'Cambiar' : 'Subir'} ${presentation.action}`;

  return (
    <article className="overflow-hidden rounded-lg border border-slate-800 bg-[#0f131a]">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-base font-semibold text-white">{presentation.title}</h4>
              {presentation.required ? (
                <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-300">
                  Obligatoria
                </span>
              ) : (
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Opcional
                </span>
              )}
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-400">{presentation.description}</p>
          </div>
          <Icon aria-hidden="true" className="shrink-0 text-rose-400" size={20} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <label className={`inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md bg-rose-600 px-3 text-xs font-semibold text-white transition hover:bg-rose-500 ${isSaving ? 'pointer-events-none opacity-60' : ''}`}>
            <Upload aria-hidden="true" size={15} />
            {actionLabel}
            <input
              accept={config.accept}
              aria-label={actionLabel}
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
              aria-label={`Eliminar ${presentation.action}`}
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
              aria-label={`Deshacer cambios de ${presentation.action}`}
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

        <p className="mt-3 text-xs text-slate-500">
          {config.kind === 'image' ? 'JPEG, PNG o WebP' : 'MP4 o WebM'} · {formatLimit(config.maxBytes)}
        </p>

        {draft.file ? (
          <p className="mt-2 truncate text-xs text-emerald-300">Nuevo archivo: {draft.file.name}</p>
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
      </div>

      <MediaPreview
        emptyLabel={presentation.emptyLabel}
        kind={config.kind}
        poster={poster}
        src={previewUrl}
      />
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
    onStateChange?.({ isDirty, isSaving });
  }, [isDirty, isSaving, onStateChange]);

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
          <h2 className="mt-2 text-xl font-semibold text-white">Fotos y vídeos del perfil</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Cada bloque indica dónde se mostrará el archivo. Puedes subir imágenes y vídeos distintos para escritorio y celular.
          </p>
        </div>
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
          disabled={disabled || !model?.id || !isDirty || isSaving}
          type="button"
          onClick={handleSave}
        >
          <Save aria-hidden="true" size={17} />
          {isSaving ? 'Guardando medios...' : 'Guardar todos los medios'}
        </button>
      </div>

      {!model?.id ? (
        <StatusMessage
          message="Guarda primero el modelo como borrador para habilitar la carga de imágenes y vídeos."
          type="info"
        />
      ) : null}
      <div className="mt-4">
        <StatusMessage message={feedback.message} type={feedback.type} />
      </div>

      <div className="mt-6 space-y-7">
        {mediaGroups.map((group, index) => (
          <section aria-labelledby={`model-media-${group.id}`} key={group.id}>
            <div className="mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {index + 1}. {group.id === 'profile' ? 'Identidad' : 'Portada del perfil'}
              </p>
              <h3 className="mt-1 text-lg font-semibold text-white" id={`model-media-${group.id}`}>
                {group.title}
              </h3>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">{group.description}</p>
            </div>

            <div className={`grid gap-4 md:grid-cols-2 ${group.id === 'profile' ? 'max-w-xl' : ''}`}>
              {group.slots.map((slot) => (
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
        ))}
      </div>
    </section>
  );
}
