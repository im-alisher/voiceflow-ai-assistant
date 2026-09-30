import type { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { describeError } from '@/features/auth/auth-errors';
import { cn } from '@/lib/utils';

interface FormErrorProps {
  error: unknown;
  className?: string;
}

/**
 * Inline error banner.
 *
 * `role="alert"` makes it announced immediately, which matters because the form
 * has already taken focus and the failure would otherwise be silent.
 */
export function FormError({ error, className }: FormErrorProps) {
  if (!error) return null;

  return (
    <div
      role="alert"
      className={cn(
        'border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-2 rounded-md border p-3 text-sm',
        className,
      )}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{describeError(error)}</span>
    </div>
  );
}

interface AuthCardProps {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Shared shell for the sign-in, registration and reset screens. */
export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {children}
        {footer ? <div className="border-border border-t pt-4">{footer}</div> : null}
      </CardContent>
    </Card>
  );
}
