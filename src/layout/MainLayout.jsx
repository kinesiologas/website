import { Outlet } from 'react-router-dom';
import { Footer } from './Footer.jsx';
import { Navbar } from './Navbar.jsx';

export function MainLayout() {
  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] antialiased">
      <Navbar />
      <Outlet />
      <Footer />
    </div>
  );
}
