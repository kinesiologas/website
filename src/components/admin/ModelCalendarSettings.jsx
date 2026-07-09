import { CalendarDays, PlugZap, Save, Trash2, Unplug } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  deleteAvailabilityBlock,
  disconnectGoogleCalendar,
  getAvailabilityRule,
  getCalendarStatus,
  listAvailabilityBlocks,
  saveAvailabilityBlock,
  saveAvailabilityRule,
  startGoogleCalendarConnection,
} from '../../services/adminService.js';
import { CheckboxInput, TextInput } from './FormControls.jsx';
import { StatusMessage } from './StatusMessage.jsx';

const weekDays = [
  { label: 'Dom', value: 0 },
  { label: 'Lun', value: 1 },
  { label: 'Mar', value: 2 },
  { label: 'Mie', value: 3 },
  { label: 'Jue', value: 4 },
  { label: 'Vie', value: 5 },
  { label: 'Sab', value: 6 },
];

const emptyBlock = {
  end_at: '',
  id: '',
  reason: '',
  start_at: '',
};

function toInputDateTime(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function toIsoDateTime(value) {
  return value ? new Date(value).toISOString() : '';
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function ModelCalendarSettings({ modelId }) {
  const [calendarStatus, setCalendarStatus] = useState(null);
  const [rule, setRule] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [blockForm, setBlockForm] = useState(emptyBlock);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  async function loadCalendarData() {
    setIsLoading(true);

    try {
      const [nextStatus, nextRule, nextBlocks] = await Promise.all([
        getCalendarStatus(modelId),
        getAvailabilityRule(modelId),
        listAvailabilityBlocks(modelId),
      ]);
      setCalendarStatus(nextStatus);
      setRule(nextRule);
      setBlocks(nextBlocks);
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadCalendarData();
    const calendarResult = new URLSearchParams(window.location.search).get('calendar');

    if (calendarResult === 'connected') {
      setFeedback({ type: 'success', message: 'Google Calendar conectado.' });
    }

    if (calendarResult === 'error') {
      setFeedback({ type: 'error', message: 'No se pudo conectar Google Calendar.' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelId]);

  function setRuleField(name, value) {
    setRule((current) => ({ ...current, [name]: value }));
  }

  function toggleDay(day) {
    setRule((current) => {
      const days = new Set(current?.days_of_week ?? []);

      if (days.has(day)) {
        days.delete(day);
      } else {
        days.add(day);
      }

      return { ...current, days_of_week: Array.from(days).sort((a, b) => a - b) };
    });
  }

  function setBlockField(name, value) {
    setBlockForm((current) => ({ ...current, [name]: value }));
  }

  async function handleConnect() {
    setIsConnecting(true);
    setFeedback({ type: '', message: '' });

    try {
      const authUrl = await startGoogleCalendarConnection();

      if (!authUrl) {
        throw new Error('No se recibio URL de Google.');
      }

      window.location.assign(authUrl);
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
      setIsConnecting(false);
    }
  }

  async function handleDisconnect() {
    setFeedback({ type: '', message: '' });

    try {
      await disconnectGoogleCalendar();
      await loadCalendarData();
      setFeedback({ type: 'success', message: 'Calendario desconectado.' });
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    }
  }

  async function handleSaveRule(event) {
    event.preventDefault();
    setFeedback({ type: '', message: '' });

    try {
      const savedRule = await saveAvailabilityRule(rule);
      setRule({
        ...savedRule,
        end_time: savedRule.end_time.slice(0, 5),
        start_time: savedRule.start_time.slice(0, 5),
      });
      setFeedback({ type: 'success', message: 'Horario actualizado.' });
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    }
  }

  async function handleSaveBlock(event) {
    event.preventDefault();
    setFeedback({ type: '', message: '' });

    try {
      await saveAvailabilityBlock({
        ...blockForm,
        end_at: toIsoDateTime(blockForm.end_at),
        model_id: modelId,
        start_at: toIsoDateTime(blockForm.start_at),
      });
      setBlockForm(emptyBlock);
      setBlocks(await listAvailabilityBlocks(modelId));
      setFeedback({ type: 'success', message: 'Bloqueo guardado.' });
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    }
  }

  async function handleDeleteBlock(blockId) {
    setFeedback({ type: '', message: '' });

    try {
      await deleteAvailabilityBlock(blockId);
      setBlocks((current) => current.filter((block) => block.id !== blockId));
      setFeedback({ type: 'success', message: 'Bloqueo eliminado.' });
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    }
  }

  if (isLoading || !rule) {
    return (
      <section className="mt-6 rounded-lg border border-slate-800 bg-[#0f131a] p-5">
        <p className="text-sm text-slate-400">Cargando calendario...</p>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-lg border border-slate-800 bg-[#0f131a] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-rose-400">
            <CalendarDays aria-hidden="true" size={16} />
            Calendario
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">Disponibilidad y Google Calendar</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            El calendario publico usa horarios, bloqueos, reservas pendientes/confirmadas y FreeBusy de Google.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {calendarStatus ? (
            <button
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-700 px-3 text-sm font-semibold text-slate-200 transition hover:border-rose-500 hover:text-white"
              type="button"
              onClick={handleDisconnect}
            >
              <Unplug aria-hidden="true" size={16} />
              Desconectar
            </button>
          ) : (
            <button
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-rose-600 px-3 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              disabled={isConnecting}
              onClick={handleConnect}
            >
              <PlugZap aria-hidden="true" size={16} />
              {isConnecting ? 'Conectando...' : 'Conectar Google Calendar'}
            </button>
          )}
        </div>
      </div>

      <StatusMessage message={feedback.message} type={feedback.type} />

      {calendarStatus ? (
        <p className="mt-4 rounded-md border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-100">
          Conectado como {calendarStatus.calendar_email || 'Google Calendar'}.
        </p>
      ) : (
        <p className="mt-4 rounded-md border border-slate-800 bg-slate-950 p-3 text-sm text-slate-400">
          Sin conexion a Google Calendar. Se usaran solo horarios, bloqueos y reservas internas.
        </p>
      )}

      <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={handleSaveRule}>
        <TextInput label="Zona horaria" value={rule.timezone} onChange={(event) => setRuleField('timezone', event.target.value)} required />
        <CheckboxInput checked={rule.enabled !== false} label="Disponibilidad activa" onChange={(value) => setRuleField('enabled', value)} />
        <TextInput label="Hora inicio" type="time" value={rule.start_time} onChange={(event) => setRuleField('start_time', event.target.value)} required />
        <TextInput label="Hora fin" type="time" value={rule.end_time} onChange={(event) => setRuleField('end_time', event.target.value)} required />
        <TextInput label="Duracion base (min)" type="number" value={rule.slot_duration_minutes} onChange={(event) => setRuleField('slot_duration_minutes', event.target.value)} min="15" />
        <TextInput label="Buffer (min)" type="number" value={rule.buffer_minutes} onChange={(event) => setRuleField('buffer_minutes', event.target.value)} min="0" />
        <TextInput label="Anticipacion minima (min)" type="number" value={rule.min_notice_minutes} onChange={(event) => setRuleField('min_notice_minutes', event.target.value)} min="0" />
        <div>
          <span className="text-sm font-medium text-slate-300">Dias activos</span>
          <div className="mt-2 grid grid-cols-7 gap-2">
            {weekDays.map((day) => {
              const isActive = (rule.days_of_week ?? []).map(Number).includes(day.value);

              return (
                <button
                  key={day.value}
                  className={`min-h-10 rounded-md border text-xs font-semibold transition ${
                    isActive
                      ? 'border-rose-500 bg-rose-500/10 text-white'
                      : 'border-slate-800 bg-slate-950 text-slate-500 hover:border-slate-700'
                  }`}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
        </div>
        <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-500 md:col-span-2" type="submit">
          <Save aria-hidden="true" size={18} />
          Guardar horario
        </button>
      </form>

      <div className="mt-6 grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        <form className="rounded-md border border-slate-800 bg-slate-950 p-4" onSubmit={handleSaveBlock}>
          <h3 className="text-sm font-semibold text-white">Bloqueo manual</h3>
          <div className="mt-4 space-y-3">
            <TextInput label="Inicio" type="datetime-local" value={blockForm.start_at} onChange={(event) => setBlockField('start_at', event.target.value)} required />
            <TextInput label="Fin" type="datetime-local" value={blockForm.end_at} onChange={(event) => setBlockField('end_at', event.target.value)} required />
            <TextInput label="Motivo interno" value={blockForm.reason} onChange={(event) => setBlockField('reason', event.target.value)} />
          </div>
          <button className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-slate-700 px-3 text-sm font-semibold text-slate-200 transition hover:border-rose-500 hover:text-white" type="submit">
            <Save aria-hidden="true" size={16} />
            Guardar bloqueo
          </button>
        </form>

        <div className="space-y-3">
          {blocks.map((block) => (
            <div key={block.id} className="grid gap-3 rounded-md border border-slate-800 bg-slate-950 p-3 sm:grid-cols-[1fr_auto] sm:items-center">
              <button
                className="min-w-0 text-left"
                type="button"
                onClick={() => setBlockForm({
                  ...block,
                  end_at: toInputDateTime(block.end_at),
                  start_at: toInputDateTime(block.start_at),
                })}
              >
                <span className="block text-sm font-medium text-white">{formatDateTime(block.start_at)} - {formatDateTime(block.end_at)}</span>
                <span className="mt-1 block truncate text-xs text-slate-500">{block.reason || 'Sin motivo'}</span>
              </button>
              <button
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-800 text-slate-400 transition hover:border-rose-500 hover:text-white"
                type="button"
                aria-label="Eliminar bloqueo"
                title="Eliminar bloqueo"
                onClick={() => handleDeleteBlock(block.id)}
              >
                <Trash2 aria-hidden="true" size={16} />
              </button>
            </div>
          ))}
          {!blocks.length ? (
            <p className="rounded-md border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
              No hay bloqueos manuales.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
