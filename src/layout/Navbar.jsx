import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { label: 'Inicio', to: '/' },
  { label: 'Modelos', to: '/modelos' },
  { label: 'Contacto', to: '/contacto' },
];

function NavItem({ item, onClick }) {
  return (
    <NavLink
      className={({ isActive }) =>
        `text-sm uppercase tracking-[0.18em] transition hover:text-white ${
          isActive ? 'text-white' : 'text-[var(--color-muted)]'
        }`
      }
      to={item.to}
      end={item.to === '/'}
      onClick={onClick}
    >
      {item.label}
    </NavLink>
  );
}

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 16);

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 border-b transition duration-300 ${
        isScrolled || isMenuOpen
          ? 'border-[var(--color-border)] bg-[#090909]/88 backdrop-blur-md'
          : 'border-transparent bg-transparent'
      }`}
    >
      <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 md:px-8" aria-label="Principal">
        <NavLink
          className="font-serif text-2xl font-semibold tracking-wide text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-ruby)]"
          to="/"
          onClick={() => setIsMenuOpen(false)}
        >
          KinesiologasS
        </NavLink>

        <div className="hidden items-center gap-8 md:flex">
          {navItems.map((item) => (
            <NavItem key={item.to} item={item} />
          ))}
        </div>

        <button
          className="inline-flex h-11 w-11 items-center justify-center border border-[var(--color-border)] text-white transition hover:border-[var(--color-ruby)] md:hidden"
          type="button"
          onClick={() => setIsMenuOpen((value) => !value)}
          aria-label={isMenuOpen ? 'Cerrar menu' : 'Abrir menu'}
          aria-expanded={isMenuOpen}
        >
          {isMenuOpen ? <X aria-hidden="true" size={20} /> : <Menu aria-hidden="true" size={20} />}
        </button>
      </nav>

      {isMenuOpen ? (
        <div className="border-t border-[var(--color-border)] bg-[#090909]/96 px-5 py-6 md:hidden">
          <div className="flex flex-col gap-5">
            {navItems.map((item) => (
              <NavItem key={item.to} item={item} onClick={() => setIsMenuOpen(false)} />
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}
