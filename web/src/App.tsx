import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useAuthStore } from './store/auth';
import { api } from './lib/api';
import { AuthScreen }          from './features/auth/AuthScreen';
import { VerifyEmailScreen }       from './features/auth/VerifyEmailScreen';
import { VerifyEmailChangeScreen } from './features/auth/VerifyEmailChangeScreen';
import { ForgotPasswordScreen }    from './features/auth/ForgotPasswordScreen';
import { ResetPasswordScreen }     from './features/auth/ResetPasswordScreen';
import { WeekScreen }    from './features/week/WeekScreen';
import { TasksScreen }   from './features/tasks/TasksScreen';
import { EventsScreen }  from './features/events/EventsScreen';
import { ProgressScreen } from './features/progress/ProgressScreen';
import { ProfileScreen } from './features/profile/ProfileScreen';
import { GoalsScreen } from './features/goals/GoalsScreen';
import { StudyTimerScreen } from './features/study-timer/StudyTimerScreen';
import { HistoryScreen } from './features/study-timer/HistoryScreen';
import { SplashScreen, isPWA } from './components/SplashScreen';
import { OfflineBanner } from './components/OfflineBanner';
import { PullToRefresh } from './components/PullToRefresh';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (Notification.permission !== 'granted') return;
    navigator.serviceWorker.ready.then((reg) =>
      reg.pushManager.getSubscription().then((sub) => {
        if (!sub) return;
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
        api('/push/timezone', { method: 'PATCH', body: JSON.stringify({ timezone }) }).catch(() => {});
      })
    ).catch(() => {});
  }, [user?.id]);

  return user ? <>{children}</> : <Navigate to="/auth" replace />;
}

function StudyTimerRoute({ children }: { children: ReactNode }) {
  const { data: profile, isLoading } = useQuery<{ studyTimerEnabled: boolean }>({
    queryKey: ['profile'],
    queryFn: () => api('/auth/me'),
    staleTime: 30_000,
  });

  if (isLoading) return null;
  return profile?.studyTimerEnabled ? <>{children}</> : <Navigate to="/perfil" replace />;
}

const WIDE_SCREEN_PATHS = new Set(['/foco', '/foco/historico']);

export default function App() {
  const [showSplash, setShowSplash] = useState(() =>
    isPWA() && !sessionStorage.getItem('splashShown')
  );
  const location = useLocation();
  const isWideScreen = WIDE_SCREEN_PATHS.has(location.pathname);

  return (
    <ErrorBoundary>
    <div className={`app-shell${isWideScreen ? ' app-shell--wide' : ''}`}>
      <OfflineBanner />
      {showSplash && <SplashScreen onDone={() => { sessionStorage.setItem('splashShown', '1'); setShowSplash(false); }} />}
      <PullToRefresh>
      <Routes>
        <Route path="/auth"            element={<AuthScreen />} />
        <Route path="/verificar-email"        element={<VerifyEmailScreen />} />
        <Route path="/verificar-troca-email"  element={<VerifyEmailChangeScreen />} />
        <Route path="/esqueci-senha"          element={<ForgotPasswordScreen />} />
        <Route path="/redefinir-senha" element={<ResetPasswordScreen />} />
        <Route path="/"          element={<ProtectedRoute><WeekScreen /></ProtectedRoute>} />
        <Route path="/rotinas"   element={<ProtectedRoute><TasksScreen /></ProtectedRoute>} />
        <Route path="/eventos"   element={<ProtectedRoute><EventsScreen /></ProtectedRoute>} />
        <Route path="/progresso" element={<ProtectedRoute><ProgressScreen /></ProtectedRoute>} />
        <Route path="/perfil"    element={<ProtectedRoute><ProfileScreen /></ProtectedRoute>} />
        <Route path="/metas"     element={<ProtectedRoute><GoalsScreen /></ProtectedRoute>} />
        <Route path="/foco"      element={<ProtectedRoute><StudyTimerRoute><StudyTimerScreen /></StudyTimerRoute></ProtectedRoute>} />
        <Route path="/foco/historico" element={<ProtectedRoute><StudyTimerRoute><HistoryScreen /></StudyTimerRoute></ProtectedRoute>} />
      </Routes>
      </PullToRefresh>
    </div>
    </ErrorBoundary>
  );
}
