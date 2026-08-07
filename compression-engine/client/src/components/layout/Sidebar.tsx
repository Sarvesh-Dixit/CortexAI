import { NavLink, Link } from 'react-router-dom';
import {
  LayoutDashboard, Minimize2, FileSearch, FileText, History,
  BarChart3, Code2, Settings, Info, HelpCircle, X, Zap,
  ChevronLeft, ChevronRight, ScanText,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useUiStore } from '../../store';
import { cn } from '../../lib/utils';
import { Tooltip } from '../ui/Tooltip';

const navGroups = [
  {
    title: 'Overview',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Compression',
    items: [
      { path: '/compress', label: 'Compress Prompt', icon: Minimize2 },
      { path: '/analysis', label: 'Prompt Analysis', icon: FileSearch },
      { path: '/history', label: 'History', icon: History },
    ],
  },
  {
    title: 'Data',
    items: [
      { path: '/documents', label: 'Documents', icon: FileText },
      { path: '/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    title: 'Tools',
    items: [
      { path: '/ocr', label: 'Image to Text', icon: ScanText },
      { path: '/playground', label: 'API Playground', icon: Code2 },
    ],
  },
  {
    title: 'Account',
    items: [
      { path: '/settings', label: 'Settings', icon: Settings },
      { path: '/help', label: 'Help', icon: HelpCircle },
      { path: '/about', label: 'About', icon: Info },
    ],
  },
];

interface SidebarProps {
  onClose: () => void;
  mobile: boolean;
}

export function Sidebar({ onClose, mobile }: SidebarProps) {
  const { sidebarCollapsed, toggleSidebar } = useUiStore();
  const collapsed = !mobile && sidebarCollapsed;

  return (
    <motion.div
      animate={{ width: collapsed ? 68 : 240 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col h-full bg-[hsl(var(--card))] border-r border-[hsl(var(--border))] relative"
    >
      {/* Logo */}
      <div className="flex items-center justify-between p-4">
        <Link to="/" className={cn('flex items-center gap-2.5 overflow-hidden hover:opacity-80 transition-opacity', collapsed && 'justify-center w-full')}>
          <div className="w-8 h-8 rounded-lg gradient-button flex items-center justify-center flex-shrink-0">
            <Zap className="w-4.5 h-4.5 text-white" />
          </div>
          {!collapsed && (
            <span className="text-base font-bold gradient-text whitespace-nowrap">
              CortexAI
            </span>
          )}
        </Link>
        {mobile && (
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[hsl(var(--secondary))] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 overflow-y-auto space-y-3 pb-4">
        {navGroups.map((group) => (
          <div key={group.title}>
            {!collapsed && (
              <p className="px-3 py-1 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                {group.title}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map(({ path, label, icon: Icon }) => {
                const link = (
                  <NavLink
                    key={path}
                    to={path}
                    onClick={mobile ? onClose : undefined}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                        collapsed && 'justify-center',
                        isActive
                          ? 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] border border-[hsl(var(--primary))]/20'
                          : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))]'
                      )
                    }
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {!collapsed && <span className="truncate">{label}</span>}
                  </NavLink>
                );

                return collapsed ? (
                  <Tooltip key={path} content={label} position="right">
                    {link}
                  </Tooltip>
                ) : (
                  link
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      {!mobile && (
        <button
          onClick={toggleSidebar}
          className="absolute -right-3 top-16 w-6 h-6 rounded-full bg-[hsl(var(--card))] border border-[hsl(var(--border))] flex items-center justify-center hover:bg-[hsl(var(--secondary))] transition-colors z-10"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="w-3 h-3" />
          ) : (
            <ChevronLeft className="w-3 h-3" />
          )}
        </button>
      )}
    </motion.div>
  );
}
