import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/theme/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useTheme } from '@/components/theme/theme-provider';
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
        <TooltipProvider delayDuration={200}>
          {children}
          <AppToaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

/**
 * Toasts follow the active theme, so they are mounted inside `ThemeProvider`
 * rather than statically configured.
 */
function AppToaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      position="bottom-right"
      theme={resolvedTheme}
      richColors
      closeButton
      toastOptions={{ className: 'font-sans' }}
    />
  );
}
