import { FolderTree, MapPinned, UserRound, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { StatusMessage } from '../../components/admin/StatusMessage.jsx';
import { ROLES } from '../../constants/roles.js';
import { listAppProfiles, listCategoriesAdmin, listLocationCatalogs, listModels } from '../../services/adminService.js';

const statItems = [
  { key: 'models', label: 'Modelos', icon: UserRound },
  { key: 'categories', label: 'Categorias', icon: FolderTree },
  { key: 'locations', label: 'Ubicaciones', icon: MapPinned },
  { key: 'users', label: 'Usuarios', icon: Users },
];

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({ categories: 0, locations: 0, models: 0, users: 0 });
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadStats() {
      setIsLoading(true);

      try {
        const [models, categories, locations, users] = await Promise.all([
          listModels(),
          listCategoriesAdmin(),
          listLocationCatalogs(),
          profile?.role === ROLES.SUPER_ADMIN ? listAppProfiles() : Promise.resolve([]),
        ]);

        if (isMounted) {
          setStats({
            categories: categories.length,
            locations: locations.countries.length + locations.provinces.length + locations.cities.length,
            models: models.length,
            users: users.length,
          });
        }
      } catch (error) {
        if (isMounted) {
          setFeedback({ type: 'error', message: error.message });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    if ([ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(profile?.role)) {
      loadStats();
    }

    return () => {
      isMounted = false;
    };
  }, [profile?.role]);

  if (profile?.role === ROLES.USER) {
    return <Navigate replace to="/admin/favoritos" />;
  }

  if (profile?.role === ROLES.MODEL) {
    return <Navigate replace to="/admin/mi-perfil" />;
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="Administracion"
        title="Resumen"
        description="Estado general del contenido privado y catalogos administrables."
      />

      <StatusMessage message={feedback.message} type={feedback.type} />

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statItems.map((item) => {
          const Icon = item.icon;

          return (
            <article key={item.key} className="rounded-lg border border-slate-800 bg-[#0f131a] p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-slate-400">{item.label}</p>
                <Icon aria-hidden="true" className="text-rose-400" size={20} />
              </div>
              <p className="mt-5 text-4xl font-semibold text-white">{isLoading ? '...' : stats[item.key]}</p>
            </article>
          );
        })}
      </section>
    </>
  );
}
