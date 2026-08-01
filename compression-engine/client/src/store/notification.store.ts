import { create } from 'zustand';
import type { NotificationItem } from '../types';

interface NotificationState {
  items: NotificationItem[];
  add: (n: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  clearAll: () => void;
  unreadCount: () => number;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  items: [],
  add: (n) => set((s) => ({
    items: [
      {
        ...n,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        read: false,
      },
      ...s.items,
    ].slice(0, 50),
  })),
  markRead: (id) => set((s) => ({
    items: s.items.map((i) => i.id === id ? { ...i, read: true } : i),
  })),
  markAllRead: () => set((s) => ({
    items: s.items.map((i) => ({ ...i, read: true })),
  })),
  remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
  clearAll: () => set({ items: [] }),
  unreadCount: () => get().items.filter((i) => !i.read).length,
}));
