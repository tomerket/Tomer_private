import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './index.css';
import { Spinner } from './components/ui';
import { SessionProvider, useSession } from './lib/session';
import FamilyTasks from './pages/FamilyTasks';
import Home from './pages/Home';
import KidsTasks from './pages/KidsTasks';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import ParentsTasks from './pages/ParentsTasks';
import Register from './pages/Register';

/** Signed in AND family set up. */
function Private({ children }: { children: ReactNode }) {
  const { me, loading } = useSession();
  if (loading) return <Spinner />;
  if (!me) return <Navigate to="/login" replace />;
  if (me.needsOnboarding) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

/** Admin signed in but family not set up yet. */
function OnboardingGate({ children }: { children: ReactNode }) {
  const { me, loading } = useSession();
  if (loading) return <Spinner />;
  if (!me) return <Navigate to="/login" replace />;
  if (!me.needsOnboarding) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Signed-out pages: bounce signed-in users into the app. */
function Public({ children }: { children: ReactNode }) {
  const { me, loading } = useSession();
  if (loading) return <Spinner />;
  if (me) return <Navigate to={me.needsOnboarding ? '/onboarding' : '/'} replace />;
  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Public><Login /></Public>} />
      <Route path="/register" element={<Public><Register /></Public>} />
      <Route path="/onboarding" element={<OnboardingGate><Onboarding /></OnboardingGate>} />
      <Route path="/" element={<Private><Home /></Private>} />
      <Route path="/tasks" element={<Private><FamilyTasks /></Private>} />
      <Route path="/tasks/kids" element={<Private><KidsTasks /></Private>} />
      <Route path="/tasks/parents" element={<Private><ParentsTasks /></Private>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <App />
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>,
);
