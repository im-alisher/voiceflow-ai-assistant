import type {
  SpeakOptions,
  SpeechToTextProvider,
  SpeechToTextResult,
  StartListeningOptions,
  SttEventName,
  TextToSpeechProvider,
  TtsEventName,
} from '@voiceflow/shared';

/**
 * Deterministic stand-ins for the browser speech engines.
 *
 * Used when the Web Speech API is missing (Firefox, most non-Chromium browsers)
 * so the voice lab is still explorable instead of dead. The transcript is
 * visibly synthetic and the confidence is a fixed sentinel: nothing here should
 * ever be mistaken for real recognition, and the UI labels the active provider.
 */
export class MockSttProvider implements SpeechToTextProvider {
  readonly id = 'mock';

  private timer: number | null = null;
  private settled: ((result: SpeechToTextResult) => void) | null = null;
  private startedAt = 0;
  private readonly listeners = new Map<SttEventName, Set<(payload: never) => void>>();

  readonly isSupported = true;

  async start(options: StartListeningOptions = {}): Promise<void> {
    if (this.timer !== null) throw new Error('A recognition session is already running');

    this.startedAt = Date.now();
    this.emit('start', undefined);

    // Resolves early when `stop()` lands first, so the promise below never hangs.
    await new Promise<void>((resolve) => {
      this.timer = window.setTimeout(resolve, options.maxDurationMs ?? 4000);
    });
    this.timer = null;
    this.settle(options.locale ?? 'en-US');
  }

  async stop(): Promise<SpeechToTextResult> {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    return this.current('en-US');
  }

  abort(): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
    this.settled = null;
  }

  on(event: SttEventName, listener: (payload: never) => void): () => void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener);
    this.listeners.set(event, set);
    return () => set.delete(listener);
  }

  private settle(locale: string): void {
    this.emit('partial', 'listening…');
    this.emit('result', this.current(locale));
    this.emit('end', undefined);
    const resolve = this.settled;
    this.settled = null;
    resolve?.(this.current(locale));
  }

  private current(locale: string): SpeechToTextResult {
    return {
      transcript: '[mock transcript] speech recognition is unavailable in this browser',
      confidence: 0,
      locale,
      durationMs: Date.now() - this.startedAt,
      isFinal: true,
    };
  }

  private emit(event: SttEventName, payload: unknown): void {
    for (const listener of this.listeners.get(event) ?? []) {
      try {
        listener(payload as never);
      } catch {
        // Listener errors are not the caller's problem.
      }
    }
  }
}

/**
 * Browser speech synthesis, guarded.
 *
 * Chrome ships `speechSynthesis` but leaves the voice list empty until the
 * first `voiceschanged` event fires asynchronously, so a voice is resolved
 * lazily at speak time rather than at construction.
 */
export class WebSpeechTtsProvider implements TextToSpeechProvider {
  readonly id = 'web-speech';

  private readonly listeners = new Map<TtsEventName, Set<(payload: never) => void>>();

  constructor(private readonly synth: SpeechSynthesis = window.speechSynthesis) {}

  get isSupported(): boolean {
    return typeof this.synth !== 'undefined' && typeof window !== 'undefined';
  }

  async speak(options: SpeakOptions): Promise<void> {
    if (!this.isSupported) {
      this.emit('error', undefined);
      return;
    }

    // Chrome queues utterances rather than interrupting; without this a rapid
    // replay would read every message aloud in sequence.
    this.synth.cancel();

    const utterance = new SpeechSynthesisUtterance(options.text);
    utterance.lang = options.locale ?? 'en-US';
    utterance.rate = options.rate ?? 1;
    utterance.pitch = options.pitch ?? 1;
    utterance.volume = options.volume ?? 1;

    const voice = pickVoice(this.synth, utterance.lang);
    if (voice) utterance.voice = voice;

    await new Promise<void>((resolve) => {
      const finish = () => {
        utterance.onend = null;
        utterance.onerror = null;
        resolve();
      };

      utterance.onboundary = (event) => {
        if (options.onBoundary) options.onBoundary(event.charIndex);
      };
      utterance.onstart = () => this.emit('start', undefined);
      utterance.onend = () => {
        this.emit('end', undefined);
        finish();
      };
      utterance.onerror = () => {
        this.emit('error', undefined);
        finish();
      };

      this.synth.speak(utterance);
    });
  }

  pause(): void {
    this.synth.pause();
  }

  resume(): void {
    this.synth.resume();
  }

  stop(): void {
    this.synth.cancel();
  }

  on(event: TtsEventName, listener: (payload: never) => void): () => void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener);
    this.listeners.set(event, set);
    return () => set.delete(listener);
  }

  private emit(event: TtsEventName, payload: unknown): void {
    for (const listener of this.listeners.get(event) ?? []) {
      try {
        listener(payload as never);
      } catch {
        // Ignored: a UI listener must not break playback.
      }
    }
  }
}

function pickVoice(synth: SpeechSynthesis, lang: string): SpeechSynthesisVoice | null {
  const voices = synth.getVoices();
  if (voices.length === 0) return null;

  return (
    voices.find((voice) => voice.lang === lang && voice.default) ??
    voices.find((voice) => voice.lang === lang) ??
    voices.find((voice) => voice.lang.startsWith(lang.slice(0, 2))) ??
    null
  );
}
