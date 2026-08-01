import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'dark' | 'light';

interface UiState {
  theme: Theme;
  sidebarCollapsed: boolean;
  searchOpen: boolean;
  notificationsOpen: boolean;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  setSearchOpen: (v: boolean) => void;
  setNotificationsOpen: (v: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'dark',
      sidebarCollapsed: false,
      searchOpen: false,
      notificationsOpen: false,
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      setSearchOpen: (v) => set({ searchOpen: v }),
      setNotificationsOpen: (v) => set({ notificationsOpen: v }),
    }),
    { name: 'ui-storage' }
  )
);
