import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { RequireAuth } from '../auth/RequireAuth.jsx';
import { ROLES } from '../constants/roles.js';
import { AdminLayout } from '../layout/AdminLayout.jsx';
import { MainLayout } from '../layout/MainLayout.jsx';

const Home = lazy(() => import('../pages/Home.jsx'));
const Models = lazy(() => import('../pages/Models.jsx'));
const Profile = lazy(() => import('../pages/Profile.jsx'));
const Contact = lazy(() => import('../pages/Contact.jsx'));
const Login = lazy(() => import('../pages/Login.jsx'));
const AuthCallback = lazy(() => import('../pages/AuthCallback.jsx'));
const AdminDashboard = lazy(() => import('../pages/admin/AdminDashboard.jsx'));
const AdminModels = lazy(() => import('../pages/admin/AdminModels.jsx'));
const AdminLocations = lazy(() => import('../pages/admin/AdminLocations.jsx'));
const AdminCategories = lazy(() => import('../pages/admin/AdminCategories.jsx'));
const AdminUsers = lazy(() => import('../pages/admin/AdminUsers.jsx'));
const AdminProfile = lazy(() => import('../pages/admin/AdminProfile.jsx'));
const AdminFavorites = lazy(() => import('../pages/admin/AdminFavorites.jsx'));

const allRoles = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MODEL, ROLES.USER];
const contentRoles = [ROLES.SUPER_ADMIN, ROLES.ADMIN];

function RouteLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)] px-6 text-sm text-[var(--color-muted)]">
      Cargando experiencia...
    </div>
  );
}

function LegacyProfileRedirect() {
  const { slug } = useParams();

  return <Navigate replace to={`/${slug}`} />;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          <Route path="login" element={<Login />} />
          <Route path="auth/callback" element={<AuthCallback />} />

          <Route element={<RequireAuth allowedRoles={allRoles} />}>
            <Route path="admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route element={<RequireAuth allowedRoles={contentRoles} />}>
                <Route path="modelos" element={<AdminModels />} />
                <Route path="ubicaciones" element={<AdminLocations />} />
                <Route path="categorias" element={<AdminCategories />} />
              </Route>
              <Route element={<RequireAuth allowedRoles={[ROLES.SUPER_ADMIN]} />}>
                <Route path="usuarios" element={<AdminUsers />} />
              </Route>
              <Route path="mi-perfil" element={<AdminProfile />} />
              <Route element={<RequireAuth allowedRoles={[ROLES.USER]} />}>
                <Route path="favoritos" element={<AdminFavorites />} />
              </Route>
            </Route>
          </Route>

          <Route element={<MainLayout />}>
            <Route index element={<Home />} />
            <Route path="modelos" element={<Models />} />
            <Route path="perfil/:slug" element={<LegacyProfileRedirect />} />
            <Route path="contacto" element={<Contact />} />
            <Route path=":slug" element={<Profile />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
