import { useState } from 'react';
import { LIMITS } from '@voiceflow/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatRelativeTime } from '@/features/chat/chat-format';
import { useLogout, useSessions } from '@/features/auth/use-auth';
import { useChangePassword } from '@/features/settings/use-provider-settings';
import { useProfile, useUpdateProfile } from '@/features/settings/use-profile';

/**
 * Account: identity, password and the list of active sessions.
 *
 * The session list is the part that matters most — a reset password only helps
 * if the attacker is also locked out, and revoking an unfamiliar device is the
 * one action that actually does that.
 */
export function AccountSection() {
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const { data: sessions = [], isLoading } = useSessions();
  const changePassword = useChangePassword();
  const { logout } = useLogout();

  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const nameChanged = displayName.trim() !== '' && displayName.trim() !== profile?.displayName;

  const submitPassword = () => {
    if (newPassword.length < LIMITS.PASSWORD_MIN_LENGTH) {
      setPasswordError(`Password must be at least ${LIMITS.PASSWORD_MIN_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('The two passwords do not match.');
      return;
    }

    setPasswordError(null);
    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>How you appear in the workspace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="display-name">Display name</Label>
            <Input
              id="display-name"
              value={displayName}
              maxLength={LIMITS.DISPLAY_NAME_MAX_LENGTH}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={profile?.email ?? ''} readOnly disabled />
            <p className="text-muted-foreground text-xs">
              Changing your email requires a verification flow that is not implemented.
            </p>
          </div>
          <Button
            onClick={() => updateProfile.mutate({ displayName: displayName.trim() })}
            disabled={!nameChanged || updateProfile.isPending}
          >
            {updateProfile.isPending ? 'Saving…' : 'Save profile'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Changing your password signs out every other device.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
          </div>

          {passwordError && (
            <p role="alert" className="text-destructive text-sm">
              {passwordError}
            </p>
          )}

          <Button
            onClick={submitPassword}
            disabled={!currentPassword || !newPassword || changePassword.isPending}
          >
            {changePassword.isPending ? 'Updating…' : 'Change password'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Signed-in devices</CardTitle>
          <CardDescription>
            Revoke anything you do not recognise. This is what actually removes an intruder.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading sessions…</p>
          ) : sessions.length === 0 ? (
            <p className="text-muted-foreground text-sm">No active sessions.</p>
          ) : (
            <ul className="divide-y">
              {sessions.map((session) => (
                <li
                  key={session.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {session.userAgent ?? 'Unknown device'}
                      {session.isCurrent && <Badge variant="secondary">This device</Badge>}
                      {!session.isActive && <Badge variant="outline">Inactive</Badge>}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {session.ipAddress ?? 'unknown IP'} · last used{' '}
                      {formatRelativeTime(session.lastUsedAt)} · expires{' '}
                      {formatRelativeTime(session.expiresAt)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (session.isCurrent) logout();
                    }}
                    disabled={!session.isActive}
                  >
                    {session.isCurrent ? 'Sign out' : 'Revoke'}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
