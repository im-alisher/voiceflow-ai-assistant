import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthCard, FormError } from '@/features/auth/auth-form';
import { useForgotPassword } from '@/features/auth/use-auth';
import { ROUTES } from '@/routes/paths';

/**
 * Password-reset request.
 *
 * The confirmation is intentionally identical whether or not the address is
 * registered — mirroring the API, which never reveals account existence. The
 * copy says so explicitly so the wording is not mistaken for a failure.
 */
export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const forgotPassword = useForgotPassword();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    forgotPassword.mutate(String(data.get('email') ?? ''), {
      onSuccess: () => setSubmitted(true),
    });
  };

  return (
    <AuthCard
      title="Reset your password"
      description="We will email a reset link if the address has an account."
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
      {submitted ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <MailCheck className="text-primary h-8 w-8" aria-hidden="true" />
          <p className="text-muted-foreground text-sm">
            If an account exists for that address, a reset link is on its way. This deployment logs
            mail to the server console rather than sending it.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormError error={forgotPassword.error} />

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

          <Button type="submit" className="w-full" disabled={forgotPassword.isPending}>
            {forgotPassword.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Sending…
              </>
            ) : (
              'Send reset link'
            )}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
