import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';
import { useUiStore } from './store';
import { AuthService } from './services';
import { useTheme } from './hooks';
import { Layout } from './components/layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';
import CompressPage from './pages/CompressPage';
import PromptAnalysisPage from './pages/PromptAnalysisPage';
import HistoryPage from './pages/HistoryPage';
import AnalyticsPage from './pages/AnalyticsPage';
import DocumentsPage from './pages/DocumentsPage';
import PlaygroundPage from './pages/PlaygroundPage';
import OcrPage from './pages/OcrPage';
import SettingsPage from './pages/SettingsPage';
import ProfilePage from './pages/ProfilePage';
import HelpPage from './pages/HelpPage';
import AboutPage from './pages/AboutPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  const { isAuthenticated, setUser } = useAuthStore();
  const setTheme = useUiStore((s) => s.setTheme);

  // Apply the persisted theme to <html> on mount and every change
  useTheme();

  useEffect(() => {
    if (isAuthenticated) {
      AuthService.me()
        .then((user) => {
          setUser(user);
          // Sync the saved theme from the user's profile so preferences
          // follow them across devices. Local UI store still wins if the
          // user just toggled the theme in this session.
          if (user.theme === 'dark' || user.theme === 'light') {
            setTheme(user.theme);
          }
        })
        .catch(() => {
          // Token invalid - will be handled by axios interceptor
        });
    }
  }, [isAuthenticated, setUser, setTheme]);

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
      <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
      <Route path="/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
      <Route path="/reset-password" element={<GuestRoute><ResetPasswordPage /></GuestRoute>} />

      {/* Protected routes */}
      <Route path="/*" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="compress" element={<CompressPage />} />
        <Route path="analysis" element={<PromptAnalysisPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="playground" element={<PlaygroundPage />} />
        <Route path="ocr" element={<OcrPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="help" element={<HelpPage />} />
        <Route path="about" element={<AboutPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
