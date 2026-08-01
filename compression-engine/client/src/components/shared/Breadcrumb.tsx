import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  showHome?: boolean;
}

export function Breadcrumb({ items, showHome = true }: BreadcrumbProps) {
  const allItems = showHome
    ? [{ label: 'Home', href: '/dashboard' }, ...items]
    : items;

  return (
    <nav className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
      {allItems.map((item, i) => {
        const isLast = i === allItems.length - 1;
        return (
          <div key={i} className="flex items-center gap-1.5">
            {i === 0 && showHome && <Home className="w-3 h-3" />}
            {item.href && !isLast ? (
              <Link to={item.href} className="hover:text-[hsl(var(--foreground))] transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'text-[hsl(var(--foreground))] font-medium' : ''}>
                {item.label}
              </span>
            )}
            {!isLast && <ChevronRight className="w-3 h-3" />}
          </div>
        );
      })}
    </nav>
  );
}
