import { MailPlus, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { CheckboxInput, SelectInput, TextInput } from '../../components/admin/FormControls.jsx';
import { StatusMessage } from '../../components/admin/StatusMessage.jsx';
import { ROLE_LABELS, ROLE_OPTIONS, ROLES } from '../../constants/roles.js';
import { inviteUser, listAppProfiles, listModels, updateAppProfileAdmin } from '../../services/adminService.js';

const emptyInvite = {
  email: '',
  fullName: '',
  modelId: '',
  role: ROLES.USER,
};

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [models, setModels] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [inviteForm, setInviteForm] = useState(emptyInvite);
  const [editForm, setEditForm] = useState(null);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [isLoading, setIsLoading] = useState(true);

  const selectedUser = useMemo(() => users.find((user) => user.id === selectedId) ?? null, [selectedId, users]);

  async function loadData(nextSelectedId = selectedId) {
    setIsLoading(true);

    try {
      const [nextUsers, nextModels] = await Promise.all([listAppProfiles(), listModels()]);
      setUsers(nextUsers);
      setModels(nextModels);

      const selected = nextUsers.find((user) => user.id === nextSelectedId) ?? nextUsers[0] ?? null;
      setSelectedId(selected?.id ?? '');
      setEditForm(selected);
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

  useEffect(() => {
    setEditForm(selectedUser);
  }, [selectedUser]);

  function setInviteField(name, value) {
    setInviteForm((current) => ({ ...current, [name]: value }));
  }

  function setEditField(name, value) {
    setEditForm((current) => ({ ...current, [name]: value }));
  }

  async function handleInvite(event) {
    event.preventDefault();
    setFeedback({ type: '', message: '' });

    try {
      await inviteUser(inviteForm);
      setInviteForm(emptyInvite);
      await loadData();
      setFeedback({ type: 'success', message: 'Invitacion enviada.' });
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    }
  }

  async function handleSaveUser(event) {
    event.preventDefault();

    if (!editForm) {
      return;
    }

    setFeedback({ type: '', message: '' });

    try {
      await updateAppProfileAdmin(editForm);
      await loadData(editForm.id);
      setFeedback({ type: 'success', message: 'Usuario actualizado.' });
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    }
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="Accesos"
        title="Usuarios"
        description="Invita usuarios y administra roles, estado y vinculacion con modelos."
      />

      <StatusMessage message={feedback.message} type={feedback.type} />

      <div className="mt-6 grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="space-y-6">
          <form className="rounded-lg border border-slate-800 bg-[#0f131a] p-5" onSubmit={handleInvite}>
            <div className="mb-4 flex items-center gap-3">
              <MailPlus aria-hidden="true" className="text-rose-400" size={22} />
              <h2 className="text-lg font-semibold text-white">Invitar</h2>
            </div>
            <div className="space-y-4">
              <TextInput label="Correo" type="email" value={inviteForm.email} onChange={(event) => setInviteField('email', event.target.value)} required />
              <TextInput label="Nombre" value={inviteForm.fullName} onChange={(event) => setInviteField('fullName', event.target.value)} />
              <SelectInput label="Rol" value={inviteForm.role} onChange={(event) => setInviteField('role', event.target.value)}>
                {ROLE_OPTIONS.map((role) => (
                  <option key={role.value} value={role.value}>{role.label}</option>
                ))}
              </SelectInput>
              <SelectInput label="Modelo vinculado" value={inviteForm.modelId} onChange={(event) => setInviteField('modelId', event.target.value)} disabled={inviteForm.role !== ROLES.MODEL}>
                <option value="">Sin modelo</option>
                {models.map((model) => (
                  <option key={model.id} value={model.id}>{model.name}</option>
                ))}
              </SelectInput>
            </div>
            <button className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-500" type="submit">
              <MailPlus aria-hidden="true" size={18} />
              Enviar invitacion
            </button>
          </form>

          {editForm ? (
            <form className="rounded-lg border border-slate-800 bg-[#0f131a] p-5" onSubmit={handleSaveUser}>
              <h2 className="mb-4 text-lg font-semibold text-white">Editar usuario</h2>
              <div className="space-y-4">
                <TextInput label="Correo" value={editForm.email ?? ''} disabled readOnly />
                <TextInput label="Nombre" value={editForm.full_name ?? ''} onChange={(event) => setEditField('full_name', event.target.value)} />
                <SelectInput label="Rol" value={editForm.role} onChange={(event) => setEditField('role', event.target.value)}>
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </SelectInput>
                <SelectInput label="Modelo vinculado" value={editForm.model_id ?? ''} onChange={(event) => setEditField('model_id', event.target.value)} disabled={editForm.role !== ROLES.MODEL}>
                  <option value="">Sin modelo</option>
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>{model.name}</option>
                  ))}
                </SelectInput>
                <CheckboxInput checked={editForm.active !== false} label="Cuenta activa" onChange={(value) => setEditField('active', value)} />
              </div>
              <button className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-500" type="submit">
                <Save aria-hidden="true" size={18} />
                Guardar usuario
              </button>
            </form>
          ) : null}
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-800 bg-[#0f131a]">
          {isLoading ? <p className="p-5 text-sm text-slate-400">Cargando usuarios...</p> : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-800 text-xs uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Modelo</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Accion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {users.map((user) => {
                  const linkedModel = models.find((model) => model.id === user.model_id);

                  return (
                    <tr key={user.id}>
                      <td className="px-4 py-3">
                        <span className="block font-medium text-white">{user.full_name || user.email}</span>
                        <span className="block text-xs text-slate-500">{user.email}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{ROLE_LABELS[user.role] ?? user.role}</td>
                      <td className="px-4 py-3 text-slate-400">{linkedModel?.name ?? 'Sin modelo'}</td>
                      <td className="px-4 py-3 text-slate-400">{user.active === false ? 'Inactivo' : 'Activo'}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          className="min-h-9 rounded-md border border-slate-800 px-3 text-xs font-semibold text-slate-200 transition hover:border-rose-500 hover:text-white"
                          type="button"
                          onClick={() => setSelectedId(user.id)}
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
