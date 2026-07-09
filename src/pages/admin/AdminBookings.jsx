import { Check, RotateCcw, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { SelectInput } from '../../components/admin/FormControls.jsx';
import { StatusMessage } from '../../components/admin/StatusMessage.jsx';
import { listBookings, listLocationCatalogs, listModels, updateBookingStatus } from '../../services/adminService.js';

const statusLabels = {
  all: 'Todos',
  cancelled: 'Cancelada',
  confirmed: 'Confirmada',
  pending: 'Pendiente',
  rejected: 'Rechazada',
};

function formatDate(value) {
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [locations, setLocations] = useState({ countries: [], provinces: [] });
  const [models, setModels] = useState([]);
  const [filters, setFilters] = useState({ countryId: '', modelId: '', provinceId: '', status: 'pending' });
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [isLoading, setIsLoading] = useState(true);

  const provinces = useMemo(
    () => locations.provinces.filter((province) => !filters.countryId || province.country_id === filters.countryId),
    [filters.countryId, locations.provinces],
  );

  async function loadData() {
    setIsLoading(true);
    setFeedback({ type: '', message: '' });

    try {
      const [nextBookings, nextLocations, nextModels] = await Promise.all([
        listBookings(filters),
        listLocationCatalogs(),
        listModels(),
      ]);
      setBookings(nextBookings);
      setLocations(nextLocations);
      setModels(nextModels);
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.countryId, filters.modelId, filters.provinceId, filters.status]);

  function setFilter(name, value) {
    setFilters((current) => ({
      ...current,
      [name]: value,
      ...(name === 'countryId' ? { provinceId: '' } : {}),
    }));
  }

  async function changeStatus(bookingId, status) {
    setFeedback({ type: '', message: '' });

    try {
      await updateBookingStatus(bookingId, status);
      await loadData();
      setFeedback({ type: 'success', message: 'Reserva actualizada.' });
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    }
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="Agenda"
        title="Reservas"
        description="Revisa solicitudes pendientes y administra reservas dentro de tu alcance."
      />

      <StatusMessage message={feedback.message} type={feedback.type} />

      <section className="mt-6 rounded-lg border border-slate-800 bg-[#0f131a] p-5">
        <div className="grid gap-4 md:grid-cols-4">
          <SelectInput label="Estado" value={filters.status} onChange={(event) => setFilter('status', event.target.value)}>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </SelectInput>
          <SelectInput label="Pais" value={filters.countryId} onChange={(event) => setFilter('countryId', event.target.value)}>
            <option value="">Todos</option>
            {locations.countries.map((country) => (
              <option key={country.id} value={country.id}>{country.name}</option>
            ))}
          </SelectInput>
          <SelectInput label="Provincia" value={filters.provinceId} onChange={(event) => setFilter('provinceId', event.target.value)}>
            <option value="">Todas</option>
            {provinces.map((province) => (
              <option key={province.id} value={province.id}>{province.name}</option>
            ))}
          </SelectInput>
          <SelectInput label="Modelo" value={filters.modelId} onChange={(event) => setFilter('modelId', event.target.value)}>
            <option value="">Todas</option>
            {models.map((model) => (
              <option key={model.id} value={model.id}>{model.name}</option>
            ))}
          </SelectInput>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-lg border border-slate-800 bg-[#0f131a]">
        {isLoading ? <p className="p-5 text-sm text-slate-400">Cargando reservas...</p> : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="border-b border-slate-800 text-xs uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Modelo</th>
                <th className="px-4 py-3">Horario</th>
                <th className="px-4 py-3">Contacto</th>
                <th className="px-4 py-3">Notas</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {bookings.map((booking) => (
                <tr key={booking.id}>
                  <td className="px-4 py-3">
                    <span className="block font-medium text-white">{booking.models?.name ?? booking.model_id}</span>
                    <span className="block text-xs text-slate-500">{booking.models?.city ?? 'Sin ciudad'}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    <span className="block">{formatDate(booking.start_at)}</span>
                    <span className="block text-xs text-slate-500">hasta {formatDate(booking.end_at)}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    <span className="block">{booking.contact_name || 'Sin nombre'}</span>
                    <span className="block text-xs text-slate-500">{booking.contact_phone || 'Sin telefono'}</span>
                  </td>
                  <td className="max-w-xs px-4 py-3 text-slate-400">
                    <span className="line-clamp-2">{booking.notes || 'Sin notas'}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{statusLabels[booking.status] ?? booking.status}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-emerald-500/30 text-emerald-200 transition hover:border-emerald-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                        type="button"
                        aria-label="Confirmar"
                        title="Confirmar"
                        disabled={booking.status === 'confirmed'}
                        onClick={() => changeStatus(booking.id, 'confirmed')}
                      >
                        <Check aria-hidden="true" size={16} />
                      </button>
                      <button
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-rose-500/30 text-rose-200 transition hover:border-rose-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                        type="button"
                        aria-label="Rechazar"
                        title="Rechazar"
                        disabled={booking.status === 'rejected'}
                        onClick={() => changeStatus(booking.id, 'rejected')}
                      >
                        <X aria-hidden="true" size={16} />
                      </button>
                      <button
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-700 text-slate-300 transition hover:border-slate-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                        type="button"
                        aria-label="Cancelar"
                        title="Cancelar"
                        disabled={booking.status === 'cancelled'}
                        onClick={() => changeStatus(booking.id, 'cancelled')}
                      >
                        <RotateCcw aria-hidden="true" size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!bookings.length && !isLoading ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-400" colSpan={6}>
                    No hay reservas con estos filtros.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
