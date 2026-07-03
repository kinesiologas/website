import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] bg-[#080808] px-5 py-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-serif text-2xl font-semibold text-white">Maison Ruby</p>
          <p className="mt-2 max-w-md text-sm leading-6 text-[var(--color-muted)]">
            Catalogo editorial premium con perfiles, galerias y contacto directo.
          </p>
        </div>
        <div className="flex gap-5 text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
          <Link className="transition hover:text-white" to="/">
            Inicio
          </Link>
          <Link className="transition hover:text-white" to="/modelos">
            Modelos
          </Link>
          <Link className="transition hover:text-white" to="/contacto">
            Contacto
          </Link>
        </div>
      </div>
    </footer>
  );
}
