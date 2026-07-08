import { ExternalLink, Heart } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { StatusMessage } from '../../components/admin/StatusMessage.jsx';
import { listFavoriteIds, listPublishedModelsForFavorites, setFavorite } from '../../services/adminService.js';

export default function AdminFavorites() {
  const { user } = useAuth();
  const [models, setModels] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [isLoading, setIsLoading] = useState(true);

  async function loadFavorites() {
    setIsLoading(true);

    try {
      const [nextModels, nextFavoriteIds] = await Promise.all([
        listPublishedModelsForFavorites(),
        listFavoriteIds(user.id),
      ]);

      setModels(nextModels);
      setFavoriteIds(nextFavoriteIds);
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (user?.id) {
      loadFavorites();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function handleToggle(modelId) {
    const isFavorite = favoriteIds.includes(modelId);
    setFeedback({ type: '', message: '' });

    try {
      await setFavorite(modelId, !isFavorite);
      setFavoriteIds((current) => (isFavorite ? current.filter((id) => id !== modelId) : [...current, modelId]));
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    }
  }

  const sortedModels = [...models].sort((first, second) => {
    const firstFavorite = favoriteIds.includes(first.id) ? 0 : 1;
    const secondFavorite = favoriteIds.includes(second.id) ? 0 : 1;
    return firstFavorite - secondFavorite || first.name.localeCompare(second.name);
  });

  return (
    <>
      <AdminPageHeader
        eyebrow="Usuario"
        title="Favoritos"
        description="Guarda modelos publicados para revisarlos rapidamente desde tu cuenta."
      />

      <StatusMessage message={feedback.message} type={feedback.type} />
      {isLoading ? <p className="mt-4 text-sm text-slate-400">Cargando favoritos...</p> : null}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sortedModels.map((model) => {
          const isFavorite = favoriteIds.includes(model.id);

          return (
            <article key={model.id} className="overflow-hidden rounded-lg border border-slate-800 bg-[#0f131a]">
              <div className="aspect-[4/5] bg-slate-950">
                <img className="h-full w-full object-cover" src={model.profileImage} alt={`Retrato de ${model.name}`} loading="lazy" />
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-serif text-2xl font-semibold text-white">{model.name}</h2>
                    <p className="mt-1 text-sm text-slate-400">{model.city} / {model.age ?? 'Edad no indicada'}</p>
                  </div>
                  <button
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-md border transition ${
                      isFavorite
                        ? 'border-rose-500 bg-rose-500 text-white'
                        : 'border-slate-800 text-slate-400 hover:border-rose-500 hover:text-white'
                    }`}
                    type="button"
                    aria-label={isFavorite ? 'Quitar favorito' : 'Agregar favorito'}
                    title={isFavorite ? 'Quitar favorito' : 'Agregar favorito'}
                    onClick={() => handleToggle(model.id)}
                  >
                    <Heart aria-hidden="true" size={18} fill={isFavorite ? 'currentColor' : 'none'} />
                  </button>
                </div>
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-400">{model.shortDescription}</p>
                <Link
                  className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-800 px-3 text-sm font-semibold text-slate-200 transition hover:border-rose-500 hover:text-white"
                  to={`/${model.slug}`}
                >
                  Ver perfil
                  <ExternalLink aria-hidden="true" size={16} />
                </Link>
              </div>
            </article>
          );
        })}
      </section>
    </>
  );
}
