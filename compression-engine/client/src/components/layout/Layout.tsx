import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { FloatingAssistant } from './FloatingAssistant';

export function Layout() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-[hsl(var(--background))]">
      {/* Mobile sidebar (visible only below lg) */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out lg:hidden ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar onClose={() => setMobileSidebarOpen(false)} mobile />
      </aside>

      {/* Desktop sidebar (visible only from lg up) */}
      <aside className="hidden lg:block flex-shrink-0">
        <Sidebar onClose={() => setMobileSidebarOpen(false)} mobile={false} />
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <Topbar onMobileMenuToggle={() => setMobileSidebarOpen(true)} />
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6 max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </div>
      </main>

      <FloatingAssistant />
    </div>
  );
}
