import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { MainLayout } from '../layout/MainLayout.jsx';

const Home = lazy(() => import('../pages/Home.jsx'));
const Models = lazy(() => import('../pages/Models.jsx'));
const Profile = lazy(() => import('../pages/Profile.jsx'));
const Contact = lazy(() => import('../pages/Contact.jsx'));

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
