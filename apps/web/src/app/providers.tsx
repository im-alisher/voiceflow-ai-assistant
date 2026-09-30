import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ThemeProvider } from '@/components/theme/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { queryClient } from '@/lib/query-client';

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * Composes the app-wide contexts, outermost first.
 *
 * `QueryClientProvider` sits outside `ThemeProvider` so a theme-triggered
 * refetch still has a client available, and `TooltipProvider` is last because
 * tooltips are used by the header, which renders inside the theme context.
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
