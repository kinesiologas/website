import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { getRoleHome } from '../constants/roles.js';

export default function AuthCallback() {
  const { isLoading, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading) {
      navigate(getRoleHome(profile?.role), { replace: true });
    }
  }, [isLoading, navigate, profile?.role]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b0d10] px-6 text-sm text-slate-300">
      Cerrando autenticacion...
    </main>
  );
}
