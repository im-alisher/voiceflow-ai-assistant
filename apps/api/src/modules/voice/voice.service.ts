import { Inject, Injectable } from '@nestjs/common';
import {
  LIMITS,
  type Result,
  type SynthesisResultDto,
  type TranscriptionResultDto,
  type VoiceErrorCode,
  type VoiceOptionDto,
} from '@voiceflow/shared';
import { AppException, SPEECH_TO_TEXT_PROVIDER, TEXT_TO_SPEECH_PROVIDER } from '../../common';
import type { SynthesizeDto } from './dto/voice.dto';
import { MAX_AUDIO_BYTES } from './providers/mock-voice.provider';
import type {
  ServerSynthesisProvider,
  ServerTranscriptionProvider,
  SynthesisInput,
  TranscriptionInput,
} from './providers/voice-provider.interface';

/**
 * Voice facade.
 *
 * Responsibilities kept deliberately narrow: enforce the upload budget, hand
 * off to whichever provider is registered, and translate a provider's returned
 * failure code into the canonical error envelope. Choosing *how* audio is
 * recognised belongs to the provider, not here.
 */
@Injectable()
export class VoiceService {
  constructor(
    @Inject(SPEECH_TO_TEXT_PROVIDER) private readonly stt: ServerTranscriptionProvider,
    @Inject(TEXT_TO_SPEECH_PROVIDER) private readonly tts: ServerSynthesisProvider,
  ) {}

  /** Upload ceiling, exposed so the controller can refuse early. */
  readonly maxAudioBytes = MAX_AUDIO_BYTES;

  async transcribe(
    audio: Buffer,
    meta: { locale: string; durationMs: number; mimeType: string },
    signal?: AbortSignal,
  ): Promise<TranscriptionResultDto> {
    if (audio.byteLength === 0) {
      throw AppException.unprocessable('The uploaded clip contains no audio', {
        maxBytes: MAX_AUDIO_BYTES,
      });
    }

    if (audio.byteLength > MAX_AUDIO_BYTES) {
      throw AppException.unprocessable(`Audio clips must not exceed ${MAX_AUDIO_BYTES} bytes`, {
        received: audio.byteLength,
        maxBytes: MAX_AUDIO_BYTES,
      });
    }

    const input: TranscriptionInput = {
      audio,
      mimeType: meta.mimeType,
      locale: meta.locale,
      durationMs: meta.durationMs,
      signal,
    };

    const result = await this.stt.transcribe(input);

    // A provider that cannot transcribe is a configuration gap, not a bad
    // request, so it must not be reported to the user as one.
    if (!result.ok && result.error === 'NOT_SUPPORTED') {
      throw AppException.serviceUnavailable('No speech-to-text provider is available');
    }

    return unwrap(result, 'transcription failed');
  }

  /**
   * Synthesis.
   *
   * A provider that returns no audio is a success, not a failure: the client is
   * expected to fall back to the browser's own speech engine, and throwing here
   * would turn a working fallback into an error state.
   */
  async synthesize(body: SynthesizeDto, signal?: AbortSignal): Promise<SynthesisResultDto> {
    const input: SynthesisInput = {
      text: body.text,
      locale: body.locale,
      rate: body.rate,
      pitch: body.pitch,
      volume: body.volume,
      signal,
    };

    const result = await this.tts.synthesize(input);

    if (!result.ok && result.error === 'NOT_SUPPORTED') {
      throw AppException.serviceUnavailable('No text-to-speech provider is available');
    }

    return unwrap(result, 'synthesis failed');
  }

  voices(): readonly VoiceOptionDto[] {
    return this.tts.voices();
  }

  /** True when a real engine is registered, as opposed to the bundled mock. */
  get producesServerAudio(): boolean {
    return this.tts.producesAudio;
  }
}

function unwrap<T>(result: Result<T, VoiceErrorCode>, fallbackMessage: string): T {
  if (result.ok) return result.value;
  throw AppException.serviceUnavailable(`${fallbackMessage} (${result.error})`);
}

/** Shared guard so the controller and service cannot disagree about the cap. */
export const AUDIO_UPLOAD_LIMIT = LIMITS.AUDIO_UPLOAD_MAX_BYTES;
