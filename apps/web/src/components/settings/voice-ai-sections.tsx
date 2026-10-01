import { useEffect, useState } from 'react';
import { LIMITS } from '@voiceflow/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { ToggleRow } from './sections';
import { useProfile, useUpdatePreferences } from '@/features/settings/use-profile';
import { useProviderOptions } from '@/features/settings/use-provider-settings';

/**
 * Voice preferences.
 *
 * These are client-side concerns: the microphone and the speech engine both
 * live in the browser. They are still persisted server-side so the same speech
 * setup applies on another device.
 */
export function VoiceSection() {
  const { data: profile } = useProfile();
  const update = useUpdatePreferences();

  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [volume, setVolume] = useState(1);
  const [locale, setLocale] = useState('en-US');

  useEffect(() => {
    const voice = profile?.preferences.voice;
    if (!voice) return;
    setRate(voice.speechRate);
    setPitch(voice.speechPitch);
    setVolume(voice.speechVolume);
    setLocale(voice.preferredLocale);
  }, [profile]);

  const voice = profile?.preferences.voice;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Behaviour</CardTitle>
          <CardDescription>What happens when you talk to the assistant.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleRow
            id="auto-listen"
            label="Auto-listen"
            description="Starts recognising speech when the voice lab opens."
            checked={voice?.autoListen ?? true}
            onCheckedChange={(value) => update.mutate({ voice: { autoListen: value } })}
          />
          <ToggleRow
            id="auto-speak"
            label="Speak replies"
            description="Reads assistant replies aloud automatically."
            checked={voice?.autoSpeak ?? true}
            onCheckedChange={(value) => update.mutate({ voice: { autoSpeak: value } })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Voice</CardTitle>
          <CardDescription>
            Speech parameters, passed through to the browser synthesis engine.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <LabelledSlider
            id="speech-rate"
            label="Rate"
            value={rate}
            min={0.5}
            max={2}
            step={0.05}
            display={`${rate.toFixed(2)}×`}
            onChange={setRate}
            onCommit={(value) => update.mutate({ voice: { speechRate: value } })}
          />
          <LabelledSlider
            id="speech-pitch"
            label="Pitch"
            value={pitch}
            min={0}
            max={2}
            step={0.05}
            display={pitch.toFixed(2)}
            onChange={setPitch}
            onCommit={(value) => update.mutate({ voice: { speechPitch: value } })}
          />
          <LabelledSlider
            id="speech-volume"
            label="Volume"
            value={volume}
            min={0}
            max={1}
            step={0.05}
            display={`${Math.round(volume * 100)}%`}
            onChange={setVolume}
            onCommit={(value) => update.mutate({ voice: { speechVolume: value } })}
          />

          <div className="space-y-2">
            <Label htmlFor="voice-locale">Preferred locale</Label>
            <select
              id="voice-locale"
              value={locale}
              onChange={(event) => {
                setLocale(event.target.value);
                update.mutate({ voice: { preferredLocale: event.target.value } });
              }}
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            >
              {['en-US', 'en-GB', 'de-DE', 'fr-FR', 'es-ES', 'ja-JP'].map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * AI provider selection.
 *
 * The picker only offers providers the API has registered. Credentials are
 * deployment configuration, not user settings, so there is deliberately no
 * field here for an API key: storing one per-user would mean the server has to
 * hold someone else's secret, and the bundled mock needs none.
 */
export function AiSection() {
  const { data: profile } = useProfile();
  const { data: providers, isLoading } = useProviderOptions();
  const update = useUpdatePreferences();

  const ai = profile?.preferences.ai;
  const [temperature, setTemperature] = useState(ai?.temperature ?? 0.7);
  const [systemPrompt, setSystemPrompt] = useState(ai?.systemPrompt ?? '');

  useEffect(() => {
    if (!ai) return;
    setTemperature(ai.temperature);
    setSystemPrompt(ai.systemPrompt ?? '');
  }, [ai]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Provider</CardTitle>
          <CardDescription>
            Which backend answers your turns. The bundled mock is deterministic and free.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading providers…</p>
          ) : (
            <div className="space-y-2">
              {(providers ?? []).map((provider) => (
                <Button
                  key={provider.id}
                  variant={ai?.providerId === provider.id ? 'default' : 'outline'}
                  className="w-full justify-between"
                  disabled={!provider.available}
                  onClick={() =>
                    update.mutate({
                      ai: { providerId: provider.id, model: provider.defaultModel },
                    })
                  }
                >
                  <span>{provider.displayName}</span>
                  <span className="text-xs opacity-70">{provider.defaultModel}</span>
                </Button>
              ))}
            </div>
          )}

          <ToggleRow
            id="streaming"
            label="Stream replies"
            description="Renders tokens as they arrive instead of waiting for the whole reply."
            checked={ai?.streamingEnabled ?? true}
            onCheckedChange={(value) => update.mutate({ ai: { streamingEnabled: value } })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Response style</CardTitle>
          <CardDescription>
            Applies to new messages unless a conversation overrides them.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <LabelledSlider
            id="temperature"
            label="Temperature"
            value={temperature}
            min={0}
            max={2}
            step={0.05}
            display={temperature.toFixed(2)}
            onChange={setTemperature}
            onCommit={(value) => update.mutate({ ai: { temperature: value } })}
          />

          <div className="space-y-2">
            <Label htmlFor="system-prompt">System prompt</Label>
            <Textarea
              id="system-prompt"
              rows={4}
              maxLength={LIMITS.SYSTEM_PROMPT_MAX_LENGTH}
              value={systemPrompt}
              onChange={(event) => setSystemPrompt(event.target.value)}
              placeholder="Optional instructions applied to every turn…"
              onBlur={() => {
                const value = systemPrompt.trim() || null;
                if (value !== (ai?.systemPrompt ?? null)) {
                  update.mutate({ ai: { systemPrompt: value } });
                }
              }}
            />
            <p className="text-muted-foreground text-xs">
              {systemPrompt.length} / {LIMITS.SYSTEM_PROMPT_MAX_LENGTH}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LabelledSlider({
  id,
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
  onCommit,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        <span className="text-muted-foreground text-xs tabular-nums">{display}</span>
      </div>
      <Slider
        id={id}
        min={min}
        max={max}
        step={step}
        value={[value]}
        // Local while dragging, persisted on release: a mutation per pixel would
        // hammer the API and roll back constantly under a slow connection.
        onValueChange={([next]) => onChange(next ?? value)}
        onValueCommit={([next]) => onCommit(next ?? value)}
      />
    </div>
  );
}
