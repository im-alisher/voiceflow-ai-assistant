import { LIMITS } from '@voiceflow/shared';

/**
 * Microphone capture with a live input level.
 *
 * Level metering is read from the same `MediaStream` as the recording rather
 * than inferred from silence timers: an `AnalyserNode` reports what the
 * microphone is actually picking up, which is what someone watching a level
 * meter expects to see.
 */
export interface LevelMeter {
  /** 0–1, smoothed. Call while the recorder is running. */
  read(): number;
  dispose(): void;
}

export function isRecordingSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof window.MediaRecorder !== 'undefined'
  );
}

export class AudioCaptureError extends Error {
  constructor(
    message: string,
    readonly reason: 'denied' | 'unsupported' | 'failed',
  ) {
    super(message);
    this.name = 'AudioCaptureError';
  }
}

export class MicrophoneRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private context: AudioContext | null = null;
  private chunks: Blob[] = [];
  private readonly maxMs: number;

  constructor(maxDurationMs: number = LIMITS.SPEECH_MAX_DURATION_MS) {
    this.maxMs = maxDurationMs;
  }

  get isRecording(): boolean {
    return this.recorder?.state === 'recording';
  }

  async start(): Promise<LevelMeter> {
    if (this.isRecording) throw new AudioCaptureError('Already recording', 'failed');

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (error) {
      throw toCaptureError(error);
    }

    this.chunks = [];

    // Safari only implements the `audio/` MIME negotiation; picking an
    // unsupported type makes `MediaRecorder` throw rather than fall back.
    const mimeType = pickMimeType();
    this.recorder = mimeType
      ? new MediaRecorder(this.stream, { mimeType })
      : new MediaRecorder(this.stream);

    this.recorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.chunks.push(event.data);
    };

    this.recorder.start(250);
    return this.createMeter(this.stream);
  }

  /** Stops capture and resolves with the recorded clip. */
  async stop(): Promise<Blob> {
    const recorder = this.recorder;
    if (!recorder) throw new AudioCaptureError('Not recording', 'failed');

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(this.chunks, { type: recorder.mimeType || 'audio/webm' }));
      };
      recorder.stop();
    });

    this.release();
    return blob;
  }

  abort(): void {
    if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop();
    this.release();
    this.chunks = [];
  }

  get maxDurationMs(): number {
    return this.maxMs;
  }

  private release(): void {
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;
    this.recorder = null;
    void this.context?.close();
    this.context = null;
  }

  /**
   * Builds the analyser chain.
   *
   * The source node is kept referenced for the lifetime of the meter: without
   * it the browser is free to garbage-collect the graph and the level silently
   * reads zero.
   */
  private createMeter(stream: MediaStream): LevelMeter {
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.75;

    const source = context.createMediaStreamSource(stream);
    source.connect(analyser);

    this.context = context;
    const samples = new Uint8Array(analyser.frequencyBinCount);

    return {
      read: () => {
        if (!this.recorder || this.recorder.state !== 'recording') return 0;
        analyser.getByteFrequencyData(samples);

        let sum = 0;
        for (const sample of samples) sum += sample * sample;
        const rms = Math.sqrt(sum / samples.length) / 255;

        // Perceptual curve: raw RMS leaves speech barely moving the meter.
        return Math.min(1, Math.pow(rms, 0.6) * 1.8);
      },
      dispose: () => {
        source.disconnect();
        analyser.disconnect();
      },
    };
  }
}

function pickMimeType(): string | null {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

function toCaptureError(error: unknown): AudioCaptureError {
  const name = (error as { name?: string } | null)?.name ?? '';

  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return new AudioCaptureError(
      'Microphone access was denied. Allow it in your browser settings to record.',
      'denied',
    );
  }
  if (name === 'NotFoundError' || name === 'NotReadableError') {
    return new AudioCaptureError('No microphone was found or it is in use elsewhere.', 'failed');
  }
  if (!isRecordingSupported()) {
    return new AudioCaptureError('This browser cannot record audio.', 'unsupported');
  }

  return new AudioCaptureError('The microphone could not be started.', 'failed');
}
