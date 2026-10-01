import type {
  SpeechToTextProvider,
  SpeechToTextResult,
  StartListeningOptions,
  SttEventName,
} from '@voiceflow/shared';

/**
 * Shape of the browser Web Speech API, declared locally.
 *
 * The DOM lib does not ship these types (they are not in the standard), and
 * shipping them ourselves avoids adding `@types/dom-speech-recognition` for two
 * interfaces. Only the members actually used are declared.
 */
interface SpeechRecognitionAlternativeLike {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string;
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

type RecognitionConstructor = new () => SpeechRecognitionLike;

function recognitionConstructor(): RecognitionConstructor | null {
  const scope = globalThis as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return recognitionConstructor() !== null;
}

/**
 * Browser speech-to-text.
 *
 * Prefers the engine's own recognition over shipping audio to the API: it is
 * lower latency, works offline, and keeps the recording on the device. The
 * server route remains the fallback for browsers without the API.
 *
 * Interim results are emitted as `partial` events so the UI can show live text;
 * only a final result resolves `stop()`.
 */
export class WebSpeechSttProvider implements SpeechToTextProvider {
  readonly id = 'web-speech';

  private recognition: SpeechRecognitionLike | null = null;
  private finalTranscript = '';
  private finalConfidence = 0;
  private startedAt = 0;
  private settled: ((result: SpeechToTextResult) => void) | null = null;
  private readonly listeners = new Map<SttEventName, Set<(payload: never) => void>>();

  get isSupported(): boolean {
    return isSpeechRecognitionSupported();
  }

  async start(options: StartListeningOptions = {}): Promise<void> {
    const Recognition = recognitionConstructor();
    if (!Recognition) {
      throw new Error('Speech recognition is not available in this browser');
    }
    if (this.recognition) {
      throw new Error('A recognition session is already running');
    }

    this.finalTranscript = '';
    this.finalConfidence = 0;
    this.startedAt = Date.now();

    const recognition = new Recognition();
    recognition.lang = options.locale ?? 'en-US';
    recognition.continuous = options.continuous ?? false;
    recognition.interimResults = options.interimResults ?? true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interim = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (!result) continue;
        const alternative = result[0];
        if (!alternative) continue;

        if (result.isFinal) {
          this.finalTranscript += `${alternative.transcript.trim()} `;
          // Keep the strongest confidence seen across alternatives rather than
          // the last, which is frequently the weakest.
          this.finalConfidence = Math.max(this.finalConfidence, alternative.confidence);
        } else {
          interim += alternative.transcript;
        }
      }

      this.emit('partial', interim.trim());
      if (this.finalTranscript.trim()) {
        this.emit('result', this.currentResult());
      }
    };

    recognition.onerror = (event) => {
      this.emit('error', { code: event.error } as never);
    };

    recognition.onend = () => {
      this.emit('end', undefined);
      const resolve = this.settled;
      this.settled = null;
      this.recognition = null;
      resolve?.(this.currentResult());
    };

    recognition.start();
    this.recognition = recognition;
    this.emit('start', undefined);
  }

  /** Resolves once the engine reports `end` — Chrome fires it after `stop()`. */
  async stop(): Promise<SpeechToTextResult> {
    if (!this.recognition) return this.currentResult();

    return new Promise<SpeechToTextResult>((resolve) => {
      this.settled = resolve;
      this.recognition?.stop();
    });
  }

  abort(): void {
    if (!this.recognition) return;
    this.recognition.abort();
    this.recognition = null;
    this.settled = null;
  }

  on(event: SttEventName, listener: (payload: never) => void): () => void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener);
    this.listeners.set(event, set);

    return () => {
      set.delete(listener);
    };
  }

  private currentResult(): SpeechToTextResult {
    return {
      transcript: this.finalTranscript.trim(),
      confidence: this.finalConfidence,
      locale: this.recognition?.lang ?? 'en-US',
      durationMs: Date.now() - this.startedAt,
      isFinal: true,
    };
  }

  private emit(event: SttEventName, payload: unknown): void {
    for (const listener of this.listeners.get(event) ?? []) {
      try {
        listener(payload as never);
      } catch {
        // A listener throwing must not tear down the recognition session.
      }
    }
  }
}
