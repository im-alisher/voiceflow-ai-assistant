import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthCard, FormError } from '@/features/auth/auth-form';
import { useRegister } from '@/features/auth/use-auth';
import { ROUTES } from '@/routes/paths';

/**
 * Registration screen.
 *
 * The terms checkbox is required and is validated by the shared schema, which
 * refuses anything other than `true` — so the value cannot be bypassed by
 * clearing the field through devtools.
 */
export default function RegisterPage() {
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const register = useRegister();
  const navigate = useNavigate();
  const location = useLocation();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    register.mutate(
      {
        email: String(data.get('email') ?? ''),
        displayName: String(data.get('displayName') ?? ''),
        password: String(data.get('password') ?? ''),
        acceptedTerms,
      },
      {
        onSuccess: () => navigate(ROUTES.dashboard, { replace: true }),
      },
    );
  };

  return (
    <AuthCard
      title="Create your account"
      description="Your data stays on infrastructure you control."
      footer={
        <p className="text-muted-foreground text-center text-sm">
          Already registered?{' '}
          <Link
            to={ROUTES.login}
            state={location.state}
            className="text-primary font-medium underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError error={register.error} />

        <div className="space-y-2">
          <Label htmlFor="displayName">Display name</Label>
          <Input
            id="displayName"
            name="displayName"
            autoComplete="name"
            required
            minLength={2}
            maxLength={64}
            autoFocus
            placeholder="Ada Lovelace"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            placeholder="ada@voiceflow.local"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            maxLength={128}
            placeholder="At least 10 characters"
            aria-describedby="password-hint"
          />
          <p id="password-hint" className="text-muted-foreground text-xs">
            Use at least 10 characters. A short phrase of unrelated words is stronger than a
            complicated word.
          </p>
        </div>

        <div className="border-border flex items-start gap-3 rounded-md border p-3">
          <input
            id="acceptedTerms"
            name="acceptedTerms"
            type="checkbox"
            checked={acceptedTerms}
            onChange={(event) => setAcceptedTerms(event.target.checked)}
            required
            className="border-input accent-primary mt-0.5 h-4 w-4 shrink-0 rounded"
          />
          <Label htmlFor="acceptedTerms" className="cursor-pointer font-normal leading-snug">
            I understand this deployment is self-hosted and I am responsible for securing it.
          </Label>
        </div>

        <Button type="submit" className="w-full" disabled={register.isPending}>
          {register.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              Creating account…
            </>
          ) : (
            'Create account'
          )}
        </Button>
      </form>
    </AuthCard>
  );
}
