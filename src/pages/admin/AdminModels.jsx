import { Archive, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { ModelEditor } from '../../components/admin/ModelEditor.jsx';
import { StatusMessage } from '../../components/admin/StatusMessage.jsx';
import {
  archiveModel,
  listCategoriesAdmin,
  listLocationCatalogs,
  listModels,
} from '../../services/adminService.js';

export default function AdminModels() {
  const [models, setModels] = useState([]);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState({ cities: [], countries: [], provinces: [] });
  const [selectedId, setSelectedId] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [isLoading, setIsLoading] = useState(true);

  const selectedModel = useMemo(() => models.find((model) => model.id === selectedId) ?? null, [models, selectedId]);

  async function loadData(nextSelectedId = selectedId) {
    setIsLoading(true);
    setFeedback({ type: '', message: '' });

    try {
      const [nextModels, nextCategories, nextLocations] = await Promise.all([
        listModels(),
        listCategoriesAdmin(),
        listLocationCatalogs(),
      ]);

      setModels(nextModels);
      setCategories(nextCategories.filter((category) => category.active !== false));
      setLocations(nextLocations);

      const hasSelected = nextModels.some((model) => model.id === nextSelectedId);
      setSelectedId(hasSelected ? nextSelectedId : nextModels[0]?.id ?? '');
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleArchive() {
    if (!selectedModel) {
      return;
    }

    setFeedback({ type: '', message: '' });

    try {
      await archiveModel(selectedModel.id);
      await loadData(selectedModel.id);
      setFeedback({ type: 'success', message: 'Modelo archivado.' });
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    }
  }

  async function handleSaved(savedModel) {
    await loadData(savedModel.id);
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="Catalogo"
        title="Modelos"
        description="Crea, edita, publica y archiva perfiles. Las imagenes se guardan como URL o ruta."
        actions={
          <>
            <button
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-rose-600 px-3 text-sm font-semibold text-white transition hover:bg-rose-500"
              type="button"
              onClick={() => setSelectedId('')}
            >
              <Plus aria-hidden="true" size={17} />
              Nuevo
            </button>
            <button
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-800 px-3 text-sm font-semibold text-slate-200 transition hover:border-rose-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={!selectedModel || selectedModel.status === 'archived'}
              onClick={handleArchive}
            >
              <Archive aria-hidden="true" size={17} />
              Archivar
            </button>
          </>
        }
      />

      <StatusMessage message={feedback.message} type={feedback.type} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-lg border border-slate-800 bg-[#0f131a] p-3">
          {isLoading ? <p className="p-3 text-sm text-slate-400">Cargando modelos...</p> : null}
          <div className="space-y-2">
            {models.map((model) => (
              <button
                key={model.id}
                className={`w-full rounded-md border px-3 py-3 text-left transition ${
                  selectedId === model.id
                    ? 'border-rose-500 bg-rose-500/10'
                    : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                }`}
                type="button"
                onClick={() => setSelectedId(model.id)}
              >
                <span className="block text-sm font-semibold text-white">{model.name}</span>
                <span className="mt-1 block text-xs text-slate-500">{model.status} / {model.slug}</span>
              </button>
            ))}
          </div>
        </aside>

        <ModelEditor
          canManageCatalog
          categories={categories}
          locations={locations}
          model={selectedModel}
          onSaved={handleSaved}
        />
      </div>
    </>
  );
}
