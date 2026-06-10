import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import { AuthScreen }    from './features/auth/AuthScreen';
import { WeekScreen }    from './features/week/WeekScreen';
import { TasksScreen }   from './features/tasks/TasksScreen';
import { EventsScreen }  from './features/events/EventsScreen';
import { ProgressScreen } from './features/progress/ProgressScreen';
import { ProfileScreen } from './features/profile/ProfileScreen';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  return user ? <>{children}</> : <Navigate to="/auth" replace />;
}

export default function App() {
  return (
    <div className="app-shell">
      <Routes>
        <Route path="/auth" element={<AuthScreen />} />
        <Route path="/"          element={<ProtectedRoute><WeekScreen /></ProtectedRoute>} />
        <Route path="/afazeres"  element={<ProtectedRoute><TasksScreen /></ProtectedRoute>} />
        <Route path="/eventos"   element={<ProtectedRoute><EventsScreen /></ProtectedRoute>} />
        <Route path="/progresso" element={<ProtectedRoute><ProgressScreen /></ProtectedRoute>} />
        <Route path="/perfil"    element={<ProtectedRoute><ProfileScreen /></ProtectedRoute>} />
      </Routes>
    </div>
  );
}
