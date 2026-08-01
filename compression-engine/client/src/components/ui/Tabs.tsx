import { useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  onChange?: (id: string) => void;
}

export function Tabs({ tabs, defaultTab, onChange }: TabsProps) {
  const [active, setActive] = useState(defaultTab || tabs[0]?.id);

  const handleChange = (id: string) => {
    setActive(id);
    onChange?.(id);
  };

  const activeTab = tabs.find((t) => t.id === active);

  return (
    <div>
      <div className="flex gap-1 border-b border-[hsl(var(--border))] mb-4 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleChange(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px whitespace-nowrap',
              active === tab.id
                ? 'text-[hsl(var(--primary))] border-[hsl(var(--primary))]'
                : 'text-[hsl(var(--muted-foreground))] border-transparent hover:text-[hsl(var(--foreground))]'
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
      <div>{activeTab?.content}</div>
    </div>
  );
}
