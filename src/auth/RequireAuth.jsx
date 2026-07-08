import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getRoleHome, hasRole } from '../constants/roles.js';
import { useAuth } from './AuthContext.jsx';

function AuthLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b0d10] px-6 text-sm text-slate-300">
      Cargando sesion...
    </div>
  );
}

export function RequireAuth({ allowedRoles }) {
  const { isLoading, profile, session } = useAuth();
  const location = useLocation();

  if (isLoading || (session && !profile)) {
    return <AuthLoader />;
  }

  if (!session) {
    return <Navigate replace to="/login" state={{ from: location }} />;
  }

  if (profile?.active === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0d10] px-6 text-center text-slate-200">
        <div className="max-w-md rounded-lg border border-slate-800 bg-slate-950 p-6">
          <p className="text-lg font-semibold text-white">Cuenta desactivada</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Tu acceso esta pausado. Contacta con un administrador para reactivarlo.
          </p>
        </div>
      </div>
    );
  }

  if (allowedRoles?.length && !hasRole(profile, allowedRoles)) {
    return <Navigate replace to={getRoleHome(profile?.role)} />;
  }

  return <Outlet />;
}
