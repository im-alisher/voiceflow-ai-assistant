import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, Mic, MicOff, Send, Square, Volume2 } from 'lucide-react';
import { LIMITS } from '@voiceflow/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/layout/page-header';
import { ROUTES } from '@/routes/paths';
import { useSpeaker, useVoiceLab } from '@/features/voice/use-voice-lab';

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Voice lab.
 *
 * Capture, live level, transcript, and a synthesis audition. Recognition runs in
 * the browser where the Web Speech API exists; the meter is driven by a real
 * `AnalyserNode` rather than a timer, so a silent microphone genuinely shows a
 * flat bar instead of a convincing animation.
 */
export default function VoicePage() {
  const { state, start, stop, cancel, clear } = useVoiceLab();
  const speaker = useSpeaker();

  const navigate = useNavigate();

  const [draft, setDraft] = useState('');
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);

  const listening = state.status === 'listening';
  const processing = state.status === 'processing';

  // The transcript travels in the URL rather than router state, because router
  // state does not survive a reload and a dictated message is exactly the thing
  // someone will lose by refreshing.
  const sendToChat = () => {
    const content = state.transcript.trim();
    if (!content) return;

    const params = new URLSearchParams({ draft: content.slice(0, LIMITS.MESSAGE_MAX_LENGTH) });
    navigate(`${ROUTES.chat}?${params.toString()}`);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Voice lab"
        description="Capture speech, inspect the transcript, and audition synthesis voices."
        badge={<Badge variant="secondary">Phase 6</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Capture</CardTitle>
            <CardDescription>
              Speech recognition uses the browser engine where available. Audio never leaves the
              device unless you ask for server-side transcription.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-4">
              <Button
                size="lg"
                variant={listening ? 'destructive' : 'default'}
                disabled={processing}
                onClick={() => (listening ? void stop() : void start())}
              >
                {processing ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : listening ? (
                  <Square className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Mic className="h-4 w-4" aria-hidden="true" />
                )}
                {listening ? 'Stop' : processing ? 'Transcribing…' : 'Start recording'}
              </Button>

              {listening && (
                <Button variant="ghost" onClick={cancel}>
                  <MicOff className="h-4 w-4" aria-hidden="true" />
                  Cancel
                </Button>
              )}

              <span className="text-muted-foreground ml-auto font-mono text-sm tabular-nums">
                {formatElapsed(state.elapsedMs)}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="level-meter">Input level</Label>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {Math.round(state.level * 100)}%
                </span>
              </div>
              <div
                id="level-meter"
                role="meter"
                aria-valuenow={Math.round(state.level * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Microphone input level"
                className="bg-muted h-3 w-full overflow-hidden rounded-full"
              >
                <div
                  className="bg-primary h-full rounded-full transition-[width] duration-75"
                  style={{ width: `${Math.max(2, state.level * 100)}%` }}
                />
              </div>
              {!state.canRecord && (
                <p className="text-muted-foreground text-xs">
                  This browser cannot record audio, so the level meter stays flat.
                </p>
              )}
            </div>

            {state.interim && (
              <p className="text-muted-foreground border-l-2 pl-3 text-sm italic">
                {state.interim}
              </p>
            )}

            {state.error && (
              <div
                role="alert"
                className="text-destructive flex items-start gap-2 rounded-md border p-3 text-sm"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {state.error}
              </div>
            )}

            {state.transcript && (
              <div className="bg-muted/40 space-y-3 rounded-md border p-4">
                <p className="text-sm leading-relaxed">{state.transcript}</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={sendToChat}>
                    <Send className="h-4 w-4" aria-hidden="true" />
                    Continue in chat
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void speaker.speak(state.transcript, { rate, pitch })}
                    disabled={!speaker.isSupported}
                  >
                    <Volume2 className="h-4 w-4" aria-hidden="true" />
                    Speak it back
                  </Button>
                  <Button size="sm" variant="ghost" onClick={clear}>
                    Clear
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Synthesis</CardTitle>
            <CardDescription>
              Audition how a reply will sound. Uses the browser speech engine; the bundled mock
              provider reports timing only and produces no audio.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="tts-text">Text</Label>
              <Textarea
                id="tts-text"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={5}
                maxLength={LIMITS.SYNTHESIS_MAX_LENGTH}
                placeholder="Type something to hear it read aloud…"
              />
              <p className="text-muted-foreground text-right text-xs tabular-nums">
                {draft.length} / {LIMITS.SYNTHESIS_MAX_LENGTH}
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="tts-rate">Rate</Label>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {rate.toFixed(2)}×
                  </span>
                </div>
                <Slider
                  id="tts-rate"
                  min={0.5}
                  max={2}
                  step={0.05}
                  value={[rate]}
                  onValueChange={([value]) => setRate(value ?? 1)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="tts-pitch">Pitch</Label>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {pitch.toFixed(2)}
                  </span>
                </div>
                <Slider
                  id="tts-pitch"
                  min={0}
                  max={2}
                  step={0.05}
                  value={[pitch]}
                  onValueChange={([value]) => setPitch(value ?? 1)}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => {
                  void speaker.speak(draft, { rate, pitch });
                }}
                disabled={!draft.trim() || !speaker.isSupported}
              >
                <Volume2 className="h-4 w-4" aria-hidden="true" />
                Speak
              </Button>
              <Button variant="outline" onClick={speaker.stop} disabled={!speaker.isSupported}>
                Stop
              </Button>
            </div>

            {!speaker.isSupported && (
              <p className="text-muted-foreground text-xs">
                This browser has no speech synthesis engine, so playback is unavailable.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
