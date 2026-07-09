import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext.jsx';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { TextInput } from '../../components/admin/FormControls.jsx';
import { ModelEditor } from '../../components/admin/ModelEditor.jsx';
import { ModelCalendarSettings } from '../../components/admin/ModelCalendarSettings.jsx';
import { StatusMessage } from '../../components/admin/StatusMessage.jsx';
import { ROLE_LABELS, ROLES } from '../../constants/roles.js';
import { listCategoriesAdmin, listLocationCatalogs, listModels } from '../../services/adminService.js';

export default function AdminProfile() {
  const { profile, updateOwnProfile } = useAuth();
  const [accountForm, setAccountForm] = useState({ avatarUrl: '', fullName: '' });
  const [model, setModel] = useState(null);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState({ cities: [], countries: [], provinces: [] });
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [isModelLoading, setIsModelLoading] = useState(false);

  useEffect(() => {
    setAccountForm({
      avatarUrl: profile?.avatar_url ?? '',
      fullName: profile?.full_name ?? '',
    });
  }, [profile?.avatar_url, profile?.full_name]);

  useEffect(() => {
    let isMounted = true;

    async function loadAssignedModel() {
      if (profile?.role !== ROLES.MODEL || !profile?.model_id) {
        setModel(null);
        return;
      }

      setIsModelLoading(true);

      try {
        const [models, nextCategories, nextLocations] = await Promise.all([
          listModels({ modelId: profile.model_id }),
          listCategoriesAdmin(),
          listLocationCatalogs(),
        ]);

        if (isMounted) {
          setModel(models[0] ?? null);
          setCategories(nextCategories.filter((category) => category.active !== false));
          setLocations(nextLocations);
        }
      } catch (error) {
        if (isMounted) {
          setFeedback({ type: 'error', message: error.message });
        }
      } finally {
        if (isMounted) {
          setIsModelLoading(false);
        }
      }
    }

    loadAssignedModel();

    return () => {
      isMounted = false;
    };
  }, [profile?.model_id, profile?.role]);

  function setField(name, value) {
    setAccountForm((current) => ({ ...current, [name]: value }));
  }

  async function handleAccountSubmit(event) {
    event.preventDefault();
    setFeedback({ type: '', message: '' });

    try {
      await updateOwnProfile(accountForm);
      setFeedback({ type: 'success', message: 'Perfil actualizado.' });
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    }
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="Cuenta"
        title="Mi perfil"
        description="Actualiza tus datos de cuenta y revisa el rol asignado."
      />

      <StatusMessage message={feedback.message} type={feedback.type} />

      <section className="mt-6 grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <form className="rounded-lg border border-slate-800 bg-[#0f131a] p-5" onSubmit={handleAccountSubmit}>
          <div className="space-y-4">
            <TextInput label="Correo" value={profile?.email ?? ''} disabled readOnly />
            <TextInput label="Rol" value={ROLE_LABELS[profile?.role] ?? profile?.role ?? ''} disabled readOnly />
            <TextInput label="Nombre" value={accountForm.fullName} onChange={(event) => setField('fullName', event.target.value)} />
            <TextInput label="Avatar URL" value={accountForm.avatarUrl} onChange={(event) => setField('avatarUrl', event.target.value)} />
          </div>
          <button className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-500" type="submit">
            <Save aria-hidden="true" size={18} />
            Guardar cuenta
          </button>
        </form>

        {profile?.role === ROLES.MODEL ? (
          <div>
            {isModelLoading ? <p className="text-sm text-slate-400">Cargando modelo asignado...</p> : null}
            {model ? (
              <>
                <ModelEditor
                  canManageCatalog={false}
                  categories={categories}
                  locations={locations}
                  model={model}
                  onSaved={(savedModel) => setModel(savedModel)}
                />
                <ModelCalendarSettings modelId={model.id} />
              </>
            ) : (
              <div className="rounded-lg border border-slate-800 bg-[#0f131a] p-5 text-sm leading-6 text-slate-400">
                No hay un modelo vinculado a esta cuenta.
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-slate-800 bg-[#0f131a] p-5">
            <h2 className="text-lg font-semibold text-white">Acceso</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Tu rol actual define las opciones visibles en el panel y las politicas de Supabase limitan las operaciones permitidas.
            </p>
          </div>
        )}
      </section>
    </>
  );
}
