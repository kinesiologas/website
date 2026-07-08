import { Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { CheckboxInput, TextInput } from '../../components/admin/FormControls.jsx';
import { StatusMessage } from '../../components/admin/StatusMessage.jsx';
import { deleteCategory, listCategoriesAdmin, saveCategory, slugify } from '../../services/adminService.js';

const emptyCategory = {
  active: true,
  id: '',
  label: '',
  sort_order: 0,
};

export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(emptyCategory);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [isLoading, setIsLoading] = useState(true);

  async function loadCategories() {
    setIsLoading(true);

    try {
      setCategories(await listCategoriesAdmin());
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadCategories();
  }, []);

  function setField(name, value) {
    setForm((current) => ({
      ...current,
      [name]: value,
      id: name === 'label' && !current.id ? slugify(value) : current.id,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFeedback({ type: '', message: '' });

    try {
      await saveCategory(form);
      setForm(emptyCategory);
      await loadCategories();
      setFeedback({ type: 'success', message: 'Categoria guardada.' });
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    }
  }

  async function handleDelete(categoryId) {
    setFeedback({ type: '', message: '' });

    try {
      await deleteCategory(categoryId);
      await loadCategories();
      setFeedback({ type: 'success', message: 'Categoria eliminada.' });
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    }
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="Catalogos"
        title="Categorias"
        description="Administra las etiquetas que se muestran en modelos y filtros del catalogo."
      />

      <StatusMessage message={feedback.message} type={feedback.type} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <form className="rounded-lg border border-slate-800 bg-[#0f131a] p-5" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <TextInput label="Etiqueta" value={form.label} onChange={(event) => setField('label', event.target.value)} required />
            <TextInput label="ID" value={form.id} onChange={(event) => setField('id', event.target.value)} required />
            <TextInput label="Orden" type="number" value={form.sort_order} onChange={(event) => setField('sort_order', event.target.value)} />
            <CheckboxInput checked={form.active !== false} label="Activa" onChange={(value) => setField('active', value)} />
          </div>
          <button
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-500"
            type="submit"
          >
            <Save aria-hidden="true" size={18} />
            Guardar categoria
          </button>
        </form>

        <section className="overflow-hidden rounded-lg border border-slate-800 bg-[#0f131a]">
          {isLoading ? <p className="p-5 text-sm text-slate-400">Cargando categorias...</p> : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="border-b border-slate-800 text-xs uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Etiqueta</th>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Orden</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td className="px-4 py-3 font-medium text-white">{category.label}</td>
                    <td className="px-4 py-3 text-slate-400">{category.id}</td>
                    <td className="px-4 py-3 text-slate-400">{category.sort_order}</td>
                    <td className="px-4 py-3 text-slate-400">{category.active === false ? 'Inactiva' : 'Activa'}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          className="min-h-9 rounded-md border border-slate-800 px-3 text-xs font-semibold text-slate-200 transition hover:border-rose-500 hover:text-white"
                          type="button"
                          onClick={() => setForm(category)}
                        >
                          Editar
                        </button>
                        <button
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-800 text-slate-400 transition hover:border-rose-500 hover:text-white"
                          type="button"
                          aria-label="Eliminar categoria"
                          title="Eliminar categoria"
                          onClick={() => handleDelete(category.id)}
                        >
                          <Trash2 aria-hidden="true" size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
