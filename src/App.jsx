import { AppRouter } from './router/AppRouter.jsx';
import { AuthProvider } from './auth/AuthContext.jsx';

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
