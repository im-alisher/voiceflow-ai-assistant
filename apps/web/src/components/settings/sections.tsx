import { useEffect, useState } from 'react';
import { FONT_SCALES, THEME_MODES, type FontScale, type ThemeMode } from '@voiceflow/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useTheme } from '@/components/theme/theme-provider';
import { useProfile, useUpdatePreferences } from '@/features/settings/use-profile';

const THEME_LABELS: Record<ThemeMode, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'Match system',
};

const FONT_LABELS: Record<FontScale, string> = {
  sm: 'Small',
  base: 'Default',
  lg: 'Large',
  xl: 'Extra large',
};

/**
 * Appearance.
 *
 * Theme is applied through the existing `ThemeProvider` *and* persisted to the
 * user record. The local write is what makes the switch instant; the server
 * write is what makes it survive a new device.
 */
export function AppearanceSection() {
  const { data: profile } = useProfile();
  const { setTheme } = useTheme();
  const update = useUpdatePreferences();

  const preferences = profile?.preferences;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>Applies immediately and is remembered on this device.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {THEME_MODES.map((mode) => (
            <Button
              key={mode}
              variant={preferences?.theme === mode ? 'default' : 'outline'}
              onClick={() => {
                setTheme(mode);
                update.mutate({ theme: mode });
              }}
            >
              {THEME_LABELS[mode]}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Text size</CardTitle>
          <CardDescription>
            Scales the base font size. Applies to every screen, including the transcript.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {FONT_SCALES.map((scale) => (
            <Button
              key={scale}
              variant={preferences?.fontScale === scale ? 'default' : 'outline'}
              onClick={() => update.mutate({ fontScale: scale })}
            >
              {FONT_LABELS[scale]}
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Accessibility preferences.
 *
 * A section of its own rather than a footnote under appearance: reduced motion
 * and captions are not cosmetic, and burying them is how they end up disabled.
 */
export function AccessibilitySection() {
  const { data: profile } = useProfile();
  const update = useUpdatePreferences();

  const accessibility = profile?.preferences.accessibility;
  const [reducedMotion, setReducedMotion] = useState(accessibility?.reducedMotion ?? false);
  const [highContrast, setHighContrast] = useState(accessibility?.highContrast ?? false);
  const [captions, setCaptions] = useState(accessibility?.captions ?? false);

  useEffect(() => {
    if (!accessibility) return;
    setReducedMotion(accessibility.reducedMotion);
    setHighContrast(accessibility.highContrast);
    setCaptions(accessibility.captions);
  }, [accessibility]);

  const commit = (patch: {
    reducedMotion?: boolean;
    highContrast?: boolean;
    captions?: boolean;
  }) => {
    update.mutate({ accessibility: patch });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accessibility</CardTitle>
        <CardDescription>Applied to every screen in the workspace.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ToggleRow
          id="reduced-motion"
          label="Reduce motion"
          description="Removes non-essential transitions and animation."
          checked={reducedMotion}
          onCheckedChange={(value) => {
            setReducedMotion(value);
            commit({ reducedMotion: value });
          }}
        />
        <ToggleRow
          id="high-contrast"
          label="High contrast"
          description="Increases contrast against the background."
          checked={highContrast}
          onCheckedChange={(value) => {
            setHighContrast(value);
            commit({ highContrast: value });
          }}
        />
        <ToggleRow
          id="captions"
          label="Always show captions"
          description="Displays speech text alongside synthesised audio."
          checked={captions}
          onCheckedChange={(value) => {
            setCaptions(value);
            commit({ captions: value });
          }}
        />
      </CardContent>
    </Card>
  );
}

/** Generic labelled switch, shared by every settings section. */
export function ToggleRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <Label htmlFor={id}>{label}</Label>
        {description && <p className="text-muted-foreground text-xs">{description}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}

/** General profile fields: display name, language and timezone. */
export function GeneralSection() {
  const { data: profile } = useProfile();
  const update = useUpdatePreferences();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Regional</CardTitle>
        <CardDescription>
          Used to format timestamps and pick a default speech locale.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="language">Language</Label>
          <Input
            id="language"
            defaultValue={profile?.preferences.language ?? 'en'}
            onBlur={(event) => {
              const value = event.target.value.trim();
              if (value && value !== profile?.preferences.language) {
                update.mutate({ language: value });
              }
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="timezone">Timezone</Label>
          <Input
            id="timezone"
            defaultValue={profile?.preferences.timezone ?? 'UTC'}
            onBlur={(event) => {
              const value = event.target.value.trim();
              if (value && value !== profile?.preferences.timezone) {
                update.mutate({ timezone: value });
              }
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Notification channels.
 *
 * Only the stored preference is implemented here: delivery itself has no
 * backend yet, so an enabled channel is a statement of intent rather than a
 * subscription. The copy says so instead of implying mail is being sent.
 */
export function NotificationsSection() {
  const { data: profile } = useProfile();
  const update = useUpdatePreferences();
  const notifications = profile?.preferences.notifications;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>
          Saved per account. No notifications are delivered yet — these are your standing
          preferences for when delivery ships.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ToggleRow
          id="notify-email"
          label="Email"
          description="Security notices and weekly usage summaries."
          checked={notifications?.email ?? true}
          onCheckedChange={(value) => update.mutate({ notifications: { email: value } })}
        />
        <ToggleRow
          id="notify-push"
          label="Push"
          description="Alerts in a browser or mobile push notification."
          checked={notifications?.push ?? false}
          onCheckedChange={(value) => update.mutate({ notifications: { push: value } })}
        />
        <ToggleRow
          id="notify-desktop"
          label="Desktop"
          description="Local system notifications while the app is open."
          checked={notifications?.desktop ?? false}
          onCheckedChange={(value) => update.mutate({ notifications: { desktop: value } })}
        />
      </CardContent>
    </Card>
  );
}
