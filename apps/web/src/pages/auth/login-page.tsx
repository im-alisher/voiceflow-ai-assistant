import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AuthCard, FormError } from '@/features/auth/auth-form';
import { useLogin } from '@/features/auth/use-auth';
import { ROUTES } from '@/routes/paths';

/**
 * Sign-in screen.
 *
 * The form is uncontrolled apart from the "remember me" toggle: a native submit
 * plus `FormData` keeps the component small and means the browser's own
 * validation and autofill work without reimplementation.
 */
export default function LoginPage() {
  const [rememberMe, setRememberMe] = useState(false);
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectTo = resolveRedirect(location.state);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    login.mutate(
      {
        email: String(data.get('email') ?? ''),
        password: String(data.get('password') ?? ''),
        rememberMe,
      },
      {
        onSuccess: () => navigate(redirectTo, { replace: true }),
      },
    );
  };

  return (
    <AuthCard
      title="Sign in"
      description="Access your conversations, voice settings, and preferences."
      footer={
        <p className="text-muted-foreground text-center text-sm">
          No account yet?{' '}
          <Link
            to={ROUTES.register}
            state={location.state}
            className="text-primary font-medium underline-offset-4 hover:underline"
          >
            Create one
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError error={login.error} />

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            autoFocus
            placeholder="ada@voiceflow.local"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••••••"
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="rememberMe"
              checked={rememberMe}
              onCheckedChange={setRememberMe}
              aria-label="Keep me signed in on this device"
            />
            <Label htmlFor="rememberMe" className="cursor-pointer font-normal">
              Keep me signed in
            </Label>
          </div>

          <Link
            to={ROUTES.forgotPassword}
            className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" className="w-full" disabled={login.isPending}>
          {login.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              Signing in…
            </>
          ) : (
            'Sign in'
          )}
        </Button>
      </form>
    </AuthCard>
  );
}

/** Only in-app absolute paths are honoured as a post-login destination. */
function resolveRedirect(state: unknown): string {
  if (typeof state !== 'object' || state === null) return ROUTES.dashboard;
  const from = (state as { from?: unknown }).from;
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//')
    ? from
    : ROUTES.dashboard;
}
