/**
 * useChartTheme
 * 
 * Returns theme-aware colors for Recharts elements.
 * Reads live CSS variable values so charts follow theme changes.
 */

import { useMemo } from 'react';
import { useUiStore } from '../store';

export interface ChartTheme {
  gridStroke: string;
  axisStroke: string;
  tooltip: {
    background: string;
    border: string;
    color: string;
  };
}

export function useChartTheme(): ChartTheme {
  const theme = useUiStore((s) => s.theme);

  return useMemo(() => {
    if (theme === 'light') {
      return {
        gridStroke: 'hsl(220, 14%, 90%)',
        axisStroke: 'hsl(220, 8%, 46%)',
        tooltip: {
          background: 'hsl(0, 0%, 100%)',
          border: '1px solid hsl(220, 14%, 88%)',
          color: 'hsl(222, 32%, 12%)',
        },
      };
    }
    // dark (default)
    return {
      gridStroke: 'hsl(220, 18%, 18%)',
      axisStroke: 'hsl(220, 10%, 55%)',
      tooltip: {
        background: 'hsl(220, 18%, 10%)',
        border: '1px solid hsl(220, 18%, 22%)',
        color: 'hsl(220, 10%, 96%)',
      },
    };
  }, [theme]);
}
