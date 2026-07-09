import { CalendarDays, ChevronLeft, ChevronRight, Clock, Send } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import {
  createBookingRequest,
  listAvailabilityDays,
  listAvailabilitySlots,
} from '../../services/availabilityService.js';

const weekDays = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

function toDateOnly(year, monthIndex, day) {
  return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);
}

function getMonthMeta(cursor) {
  const year = cursor.getUTCFullYear();
  const month = cursor.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const firstWeekDay = new Date(Date.UTC(year, month, 1)).getUTCDay();

  return {
    daysInMonth,
    firstWeekDay,
    month,
    startDate: toDateOnly(year, month, 1),
    year,
  };
}

function formatMonth(cursor) {
  return new Intl.DateTimeFormat('es-PE', {
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(cursor);
}

function formatDateLabel(date) {
  return new Intl.DateTimeFormat('es-PE', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

export function PublicAvailabilityCalendar({ modelId, modelName, modelSlug }) {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1)));
  const [days, setDays] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookingForm, setBookingForm] = useState({ contactName: '', contactPhone: '', notes: '' });
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [isDaysLoading, setIsDaysLoading] = useState(false);
  const [isSlotsLoading, setIsSlotsLoading] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const { daysInMonth, firstWeekDay, month, startDate, year } = useMemo(() => getMonthMeta(cursor), [cursor]);
  const { isSupabaseConfigured, session } = useAuth();
  const navigate = useNavigate();

  const availabilityByDate = useMemo(() => new Map(days.map((day) => [day.date, day.isAvailable])), [days]);

  useEffect(() => {
    let isMounted = true;

    async function loadDays() {
      if (!isSupabaseConfigured || !modelId) {
        return;
      }

      setIsDaysLoading(true);
      setFeedback({ type: '', message: '' });

      try {
        const nextDays = await listAvailabilityDays({
          days: daysInMonth,
          modelId,
          modelSlug,
          startDate,
        });

        if (isMounted) {
          setDays(nextDays);
        }
      } catch (error) {
        if (isMounted) {
          setFeedback({ type: 'error', message: 'No se pudo cargar la disponibilidad.' });
        }
      } finally {
        if (isMounted) {
          setIsDaysLoading(false);
        }
      }
    }

    loadDays();

    return () => {
      isMounted = false;
    };
  }, [daysInMonth, isSupabaseConfigured, modelId, modelSlug, startDate]);

  function moveMonth(amount) {
    setCursor((current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + amount, 1)));
    setSelectedDate('');
    setSelectedSlot(null);
    setSlots([]);
  }

  async function handleDayClick(date, isAvailable) {
    if (!isAvailable) {
      return;
    }

    if (!session) {
      navigate('/login', { state: { from: { pathname: `/${modelSlug}` } } });
      return;
    }

    setSelectedDate(date);
    setSelectedSlot(null);
    setSlots([]);
    setIsSlotsLoading(true);
    setFeedback({ type: '', message: '' });

    try {
      const data = await listAvailabilitySlots({ date, modelId, modelSlug });
      setSlots(data.slots ?? []);

      if (data.calendarUnavailable) {
        setFeedback({ type: 'error', message: 'El calendario conectado no esta disponible ahora.' });
      }
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setIsSlotsLoading(false);
    }
  }

  function setBookingField(name, value) {
    setBookingForm((current) => ({ ...current, [name]: value }));
  }

  async function handleBooking(event) {
    event.preventDefault();

    if (!selectedSlot) {
      return;
    }

    setIsBooking(true);
    setFeedback({ type: '', message: '' });

    try {
      await createBookingRequest({
        ...bookingForm,
        modelId,
        modelSlug,
        startAt: selectedSlot.startAt,
      });
      setBookingForm({ contactName: '', contactPhone: '', notes: '' });
      setSelectedSlot(null);
      setSlots((current) => current.filter((slot) => slot.startAt !== selectedSlot.startAt));
      setFeedback({ type: 'success', message: 'Reserva solicitada. Quedara pendiente de confirmacion.' });
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setIsBooking(false);
    }
  }

  if (!isSupabaseConfigured) {
    return null;
  }

  return (
    <section className="border-t border-[var(--color-border)] px-5 py-16 md:px-8 md:py-20">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-ruby)]">Disponibilidad</p>
              <h2 className="mt-3 font-serif text-4xl font-semibold text-white md:text-5xl">
                Agenda de {modelName}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="inline-flex h-10 w-10 items-center justify-center border border-[var(--color-border)] text-white transition hover:border-[var(--color-ruby)]"
                type="button"
                aria-label="Mes anterior"
                title="Mes anterior"
                onClick={() => moveMonth(-1)}
              >
                <ChevronLeft aria-hidden="true" size={18} />
              </button>
              <button
                className="inline-flex h-10 w-10 items-center justify-center border border-[var(--color-border)] text-white transition hover:border-[var(--color-ruby)]"
                type="button"
                aria-label="Mes siguiente"
                title="Mes siguiente"
                onClick={() => moveMonth(1)}
              >
                <ChevronRight aria-hidden="true" size={18} />
              </button>
            </div>
          </div>

          <div className="mt-8 border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-white">
                <CalendarDays aria-hidden="true" size={18} />
                {formatMonth(cursor)}
              </p>
              {isDaysLoading ? <span className="text-xs text-[var(--color-muted)]">Actualizando...</span> : null}
            </div>
            <div className="grid grid-cols-7 gap-2 text-center">
              {weekDays.map((day) => (
                <span key={day} className="py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  {day}
                </span>
              ))}
              {Array.from({ length: firstWeekDay }).map((_, index) => (
                <span key={`empty-${index}`} className="aspect-square border border-transparent" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, index) => {
                const day = index + 1;
                const date = toDateOnly(year, month, day);
                const isAvailable = availabilityByDate.get(date) === true;
                const isSelected = selectedDate === date;

                return (
                  <button
                    key={date}
                    className={`aspect-square border p-1 text-sm transition ${
                      isSelected
                        ? 'border-[var(--color-ruby)] bg-[var(--color-ruby)] text-white'
                        : isAvailable
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100 hover:border-emerald-300'
                          : 'border-[var(--color-border)] bg-[#111] text-[var(--color-muted)]'
                    }`}
                    type="button"
                    disabled={!isAvailable}
                    onClick={() => handleDayClick(date, isAvailable)}
                  >
                    <span className="block font-semibold">{day}</span>
                    <span className="mt-1 block text-[10px] uppercase tracking-[0.08em]">
                      {isAvailable ? 'Disponible' : 'No disponible'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <aside className="h-fit border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">Reservar</p>
          {selectedDate ? (
            <h3 className="mt-3 text-xl font-semibold text-white">{formatDateLabel(selectedDate)}</h3>
          ) : (
            <h3 className="mt-3 text-xl font-semibold text-white">Elige un dia disponible</h3>
          )}

          {feedback.message ? (
            <p
              className={`mt-4 border p-3 text-sm leading-6 ${
                feedback.type === 'success'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                  : 'border-rose-500/30 bg-rose-500/10 text-rose-100'
              }`}
            >
              {feedback.message}
            </p>
          ) : null}

          {isSlotsLoading ? <p className="mt-4 text-sm text-[var(--color-muted)]">Cargando horarios...</p> : null}

          {selectedDate && !isSlotsLoading ? (
            <div className="mt-5 grid grid-cols-2 gap-2">
              {slots.map((slot) => (
                <button
                  key={slot.startAt}
                  className={`inline-flex min-h-10 items-center justify-center gap-2 border px-3 text-sm font-semibold transition ${
                    selectedSlot?.startAt === slot.startAt
                      ? 'border-[var(--color-ruby)] bg-[var(--color-ruby)] text-white'
                      : 'border-[var(--color-border)] text-white hover:border-[var(--color-ruby)]'
                  }`}
                  type="button"
                  onClick={() => setSelectedSlot(slot)}
                >
                  <Clock aria-hidden="true" size={16} />
                  {slot.label}
                </button>
              ))}
              {!slots.length ? (
                <p className="col-span-2 text-sm leading-6 text-[var(--color-muted)]">
                  No quedan horarios disponibles para este dia.
                </p>
              ) : null}
            </div>
          ) : null}

          {selectedSlot ? (
            <form className="mt-5 space-y-3" onSubmit={handleBooking}>
              <input
                className="h-11 w-full border border-[var(--color-border)] bg-[#0d0d0d] px-3 text-sm text-white outline-none transition placeholder:text-[var(--color-muted)] focus:border-[var(--color-ruby)]"
                placeholder="Nombre de contacto"
                value={bookingForm.contactName}
                onChange={(event) => setBookingField('contactName', event.target.value)}
              />
              <input
                className="h-11 w-full border border-[var(--color-border)] bg-[#0d0d0d] px-3 text-sm text-white outline-none transition placeholder:text-[var(--color-muted)] focus:border-[var(--color-ruby)]"
                placeholder="Telefono"
                value={bookingForm.contactPhone}
                onChange={(event) => setBookingField('contactPhone', event.target.value)}
              />
              <textarea
                className="min-h-24 w-full border border-[var(--color-border)] bg-[#0d0d0d] px-3 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-[var(--color-muted)] focus:border-[var(--color-ruby)]"
                placeholder="Notas privadas"
                value={bookingForm.notes}
                onChange={(event) => setBookingField('notes', event.target.value)}
              />
              <button
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 bg-[var(--color-ruby)] px-4 text-sm font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[var(--color-ruby-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={isBooking}
              >
                <Send aria-hidden="true" size={17} />
                {isBooking ? 'Enviando...' : 'Solicitar reserva'}
              </button>
            </form>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
