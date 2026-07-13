import { Chrome, Eye, EyeOff, LogIn } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { getRoleHome } from '../constants/roles.js';

export default function Login() {
  const {
    isLoading,
    isSupabaseConfigured,
    profile,
    session,
    signInWithGoogle,
    signInWithPassword,
    signUpWithPassword,
  } = useAuth();
  const location = useLocation();
  const [mode, setMode] = useState('login');
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: '', fullName: '', password: '' });
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTo = useMemo(() => {
    return location.state?.from?.pathname || getRoleHome(profile?.role);
  }, [location.state?.from?.pathname, profile?.role]);

  if (!isLoading && session) {
    return <Navigate replace to={redirectTo} />;
  }

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFeedback({ type: '', message: '' });
    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        await signInWithPassword({ email: form.email, password: form.password });
      } else {
        await signUpWithPassword({
          email: form.email,
          fullName: form.fullName,
          password: form.password,
        });
        setFeedback({
          type: 'success',
          message: 'Cuenta creada. Revisa tu correo si Supabase solicita confirmacion.',
        });
      }
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogle() {
    setFeedback({ type: '', message: '' });

    try {
      await signInWithGoogle();
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    }
  }

  return (
    <main className="min-h-screen bg-[#0b0d10] px-5 py-10 text-slate-100">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1fr_440px]">
        <section className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-400">Panel</p>
          <h1 className="mt-5 font-serif text-5xl font-semibold leading-tight text-white md:text-7xl">
            Gestion privada del catalogo
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
            Administra modelos, ubicaciones, categorias, usuarios y favoritos con roles protegidos por Supabase.
          </p>
        </section>

        <section className="rounded-lg border border-slate-800 bg-[#0f131a] p-5 shadow-2xl shadow-black/30">
          <div className="grid grid-cols-2 rounded-md border border-slate-800 p-1">
            <button
              className={`min-h-10 rounded px-3 text-sm font-semibold transition ${
                mode === 'login' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              type="button"
              onClick={() => setMode('login')}
            >
              Ingresar
            </button>
            <button
              className={`min-h-10 rounded px-3 text-sm font-semibold transition ${
                mode === 'register' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              type="button"
              onClick={() => setMode('register')}
            >
              Crear cuenta
            </button>
          </div>

          {!isSupabaseConfigured ? (
            <div className="mt-5 rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
              Configura Supabase en `.env` para activar el login.
            </div>
          ) : null}

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            {mode === 'register' ? (
              <label className="block">
                <span className="text-sm font-medium text-slate-300">Nombre</span>
                <input
                  className="mt-2 h-11 w-full rounded-md border border-slate-800 bg-slate-950 px-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-rose-500"
                  name="fullName"
                  value={form.fullName}
                  onChange={updateField}
                  autoComplete="name"
                  required
                />
              </label>
            ) : null}

            <label className="block">
              <span className="text-sm font-medium text-slate-300">Correo</span>
              <input
                className="mt-2 h-11 w-full rounded-md border border-slate-800 bg-slate-950 px-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-rose-500"
                name="email"
                type="email"
                value={form.email}
                onChange={updateField}
                autoComplete="email"
                required
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-300">Contrasena</span>
              <span className="mt-2 flex h-11 items-center rounded-md border border-slate-800 bg-slate-950 focus-within:border-rose-500">
                <input
                  className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={updateField}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  minLength={6}
                  required
                />
                <button
                  className="inline-flex h-10 w-10 items-center justify-center text-slate-400 transition hover:text-white"
                  type="button"
                  aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                  title={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
                </button>
              </span>
            </label>

            {feedback.message ? (
              <p
                className={`rounded-md border p-3 text-sm ${
                  feedback.type === 'success'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                    : 'border-rose-500/30 bg-rose-500/10 text-rose-100'
                }`}
              >
                {feedback.message}
              </p>
            ) : null}

            <button
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={!isSupabaseConfigured || isSubmitting}
            >
              <LogIn aria-hidden="true" size={18} />
              {isSubmitting ? 'Procesando...' : mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
            </button>
          </form>

          <div className="mt-5 flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-slate-500">
            <span className="h-px flex-1 bg-slate-800" />
            OAuth
            <span className="h-px flex-1 bg-slate-800" />
          </div>

          <button
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-slate-800 px-4 text-sm font-semibold text-slate-200 transition hover:border-rose-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={!isSupabaseConfigured}
            onClick={handleGoogle}
          >
            <Chrome aria-hidden="true" size={18} />
            Continuar con Google
          </button>
        </section>
      </div>
    </main>
  );
}
