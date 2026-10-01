import { useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, KeyRound, Loader2 } from 'lucide-react';
import { LIMITS } from '@voiceflow/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthCard, FormError } from '@/features/auth/auth-form';
import { readResetToken, useResetPassword } from '@/features/auth/use-reset-password';
import { ROUTES } from '@/routes/paths';

/**
 * Redeem a reset token.
 *
 * Reachable while signed out, so it lives under the anonymous layout rather
 * than the workspace shell. All sessions are revoked server-side on success,
 * which means the user has to sign in again with the new password.
 */
export default function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const reset = useResetPassword();

  // Read once: re-deriving on every render would fight with the hash-clear
  // effect below and could repopulate the field after it has been cleared.
  const token = useMemo(
    () => readResetToken(location.search, location.hash),
    [location.search, location.hash],
  );

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (password.length < LIMITS.PASSWORD_MIN_LENGTH) {
      setLocalError(`Password must be at least ${LIMITS.PASSWORD_MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('The two passwords do not match.');
      return;
    }
    if (!token) {
      setLocalError('This reset link is missing its token. Request a new one.');
      return;
    }

    setLocalError(null);
    reset.mutate(
      { token, password },
      { onSuccess: () => window.setTimeout(() => navigate(ROUTES.login), 1500) },
    );
  };

  return (
    <AuthCard
      title="Choose a new password"
      description="Reset links are single-use and expire. All devices are signed out afterwards."
      footer={
        <p className="text-muted-foreground text-center text-sm">
          <Link
            to={ROUTES.login}
            className="text-primary font-medium underline-offset-4 hover:underline"
          >
            Back to sign in
          </Link>
        </p>
      }
    >
      {reset.isSuccess ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center" role="status">
          <CheckCircle2 className="text-primary h-8 w-8" aria-hidden="true" />
          <p className="text-muted-foreground text-sm">Password updated. Taking you to sign in…</p>
        </div>
      ) : !token ? (
        <div className="space-y-4">
          <FormError error={new Error('This reset link is missing or malformed.')} />
          <Button className="w-full" asChild>
            <Link to={ROUTES.forgotPassword}>Request a new link</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {localError ? (
            <FormError error={new Error(localError)} />
          ) : (
            <FormError error={reset.error} />
          )}

          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>

          <Button type="submit" className="w-full" disabled={reset.isPending}>
            {reset.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Updating…
              </>
            ) : (
              <>
                <KeyRound className="mr-2 h-4 w-4" aria-hidden="true" />
                Update password
              </>
            )}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
