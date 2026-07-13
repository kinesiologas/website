import {
  Boxes,
  CalendarDays,
  ChevronRight,
  FolderTree,
  Heart,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Menu,
  Shield,
  User,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ROLE_LABELS, ROLES } from '../constants/roles.js';
import { useAuth } from '../auth/AuthContext.jsx';

const navItems = [
  {
    label: 'Resumen',
    to: '/admin',
    icon: LayoutDashboard,
    roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN],
    end: true,
  },
  {
    label: 'Portada',
    to: '/admin/portada',
    icon: ImageIcon,
    roles: [ROLES.SUPER_ADMIN],
  },
  {
    label: 'Modelos',
    to: '/admin/modelos',
    icon: Boxes,
    roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  },
  {
    label: 'Ubicaciones',
    to: '/admin/ubicaciones',
    icon: MapPinned,
    roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  },
  {
    label: 'Categorias',
    to: '/admin/categorias',
    icon: FolderTree,
    roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  },
  {
    label: 'Reservas',
    to: '/admin/reservas',
    icon: CalendarDays,
    roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MODEL],
  },
  {
    label: 'Usuarios',
    to: '/admin/usuarios',
    icon: Users,
    roles: [ROLES.SUPER_ADMIN],
  },
  {
    label: 'Mi perfil',
    to: '/admin/mi-perfil',
    icon: User,
    roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MODEL, ROLES.USER],
  },
  {
    label: 'Favoritos',
    to: '/admin/favoritos',
    icon: Heart,
    roles: [ROLES.USER],
  },
];

function SidebarNav({ onNavigate }) {
  const { profile } = useAuth();
  const visibleItems = navItems.filter((item) => item.roles.includes(profile?.role));

  return (
    <nav className="mt-8 flex flex-col gap-1" aria-label="Administracion">
      {visibleItems.map((item) => {
        const Icon = item.icon;

        return (
          <NavLink
            key={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex min-h-11 items-center justify-between rounded-md px-3 text-sm transition ${
                isActive
                  ? 'bg-rose-600 text-white'
                  : 'text-slate-300 hover:bg-slate-900 hover:text-white'
              }`
            }
            to={item.to}
            onClick={onNavigate}
          >
            <span className="flex items-center gap-3">
              <Icon aria-hidden="true" size={18} />
              {item.label}
            </span>
            <ChevronRight aria-hidden="true" size={16} />
          </NavLink>
        );
      })}
    </nav>
  );
}

export function AdminLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-[#0b0d10] text-slate-100">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-slate-800 bg-[#0f131a] px-5 py-6 lg:block">
        <Link className="flex items-center gap-3 text-white" to="/admin">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-rose-600">
            <Shield aria-hidden="true" size={20} />
          </span>
          <span>
            <span className="block font-serif text-2xl font-semibold">KinesiologasS</span>
            <span className="block text-xs uppercase tracking-[0.18em] text-slate-400">Panel</span>
          </span>
        </Link>
        <SidebarNav />
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-slate-800 bg-[#0b0d10]/92 backdrop-blur">
          <div className="flex min-h-16 items-center justify-between gap-4 px-4 md:px-6">
            <button
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-800 text-white transition hover:border-rose-500 lg:hidden"
              type="button"
              aria-label={isMenuOpen ? 'Cerrar menu' : 'Abrir menu'}
              aria-expanded={isMenuOpen}
              onClick={() => setIsMenuOpen((value) => !value)}
            >
              {isMenuOpen ? <X aria-hidden="true" size={20} /> : <Menu aria-hidden="true" size={20} />}
            </button>

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{profile?.full_name || profile?.email}</p>
              <p className="text-xs text-slate-400">{ROLE_LABELS[profile?.role] ?? 'Usuario'}</p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                className="hidden min-h-10 items-center rounded-md border border-slate-800 px-3 text-sm text-slate-300 transition hover:border-rose-500 hover:text-white sm:inline-flex"
                to="/"
              >
                Sitio publico
              </Link>
              <button
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-800 text-slate-300 transition hover:border-rose-500 hover:text-white"
                type="button"
                aria-label="Cerrar sesion"
                title="Cerrar sesion"
                onClick={handleSignOut}
              >
                <LogOut aria-hidden="true" size={18} />
              </button>
            </div>
          </div>

          {isMenuOpen ? (
            <div className="border-t border-slate-800 bg-[#0f131a] px-4 pb-5 lg:hidden">
              <SidebarNav onNavigate={() => setIsMenuOpen(false)} />
            </div>
          ) : null}
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
