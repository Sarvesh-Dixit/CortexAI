import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, Sun, Moon, User as UserIcon, LogOut, Settings as SettingsIcon, Zap, Menu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore, useUiStore, useNotificationStore } from '../../store';
import { useClickOutside, useKeyboardShortcut } from '../../hooks';
import { GlobalSearch } from './GlobalSearch';
import { NotificationsPanel } from './NotificationsPanel';

interface TopbarProps {
  onMobileMenuToggle: () => void;
}

export function Topbar({ onMobileMenuToggle }: TopbarProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme, searchOpen, setSearchOpen, notificationsOpen, setNotificationsOpen } = useUiStore();
  const unreadCount = useNotificationStore((s) => s.unreadCount());

  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useClickOutside(profileRef, () => setProfileOpen(false));
  useClickOutside(notifRef, () => setNotificationsOpen(false));

  useKeyboardShortcut('k', () => setSearchOpen(true), { ctrl: true });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <div className="h-14 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]/50 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-4 lg:px-6">
        {/* Left */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMobileMenuToggle}
            className="lg:hidden p-1.5 rounded-lg hover:bg-[hsl(var(--secondary))] transition-colors"
          >
            <Menu className="w-4.5 h-4.5" />
          </button>
          <div className="flex items-center gap-2 lg:hidden">
            <div className="w-7 h-7 rounded-lg gradient-button flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold gradient-text">CortexAI</span>
          </div>
        </div>

        {/* Center - Search */}
        <div className="hidden md:flex flex-1 max-w-md mx-4">
          <button
            onClick={() => setSearchOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-1.5 bg-[hsl(var(--input))] border border-[hsl(var(--border))] rounded-lg text-sm text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))]/30 transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">Search history, documents, prompts...</span>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono border border-[hsl(var(--border))] rounded bg-[hsl(var(--secondary))]">
              âŒ˜K
            </kbd>
          </button>
        </div>

        {/* Right */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSearchOpen(true)}
            className="md:hidden p-2 rounded-lg hover:bg-[hsl(var(--secondary))] transition-colors"
          >
            <Search className="w-4 h-4" />
          </button>

          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-xs text-emerald-400 font-medium">API Online</span>
          </div>

          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-[hsl(var(--secondary))] transition-colors"
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Notifications */}
          <div ref={notifRef} className="relative">
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="p-2 rounded-lg hover:bg-[hsl(var(--secondary))] transition-colors relative"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[hsl(var(--primary))] text-white text-[10px] flex items-center justify-center font-medium">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <AnimatePresence>
              {notificationsOpen && (
                <NotificationsPanel onClose={() => setNotificationsOpen(false)} />
              )}
            </AnimatePresence>
          </div>

          {/* Profile */}
          <div ref={profileRef} className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg hover:bg-[hsl(var(--secondary))] transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center text-xs font-semibold text-white">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
            </button>
            <AnimatePresence>
              {profileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-64 glass-card p-2 z-40"
                >
                  <div className="px-3 py-2 border-b border-[hsl(var(--border))] mb-1">
                    <p className="text-sm font-medium truncate">{user?.name}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
                      {user?.email}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      navigate('/profile');
                      setProfileOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-[hsl(var(--secondary))] transition-colors text-left"
                  >
                    <UserIcon className="w-4 h-4" />
                    Profile
                  </button>
                  <button
                    onClick={() => {
                      navigate('/settings');
                      setProfileOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-[hsl(var(--secondary))] transition-colors text-left"
                  >
                    <SettingsIcon className="w-4 h-4" />
                    Settings
                  </button>
                  <div className="border-t border-[hsl(var(--border))] my-1" />
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-red-500/10 text-red-400 transition-colors text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
