import { Injectable } from '@nestjs/common';
import {
  LIMITS,
  err,
  ok,
  type Result,
  type SynthesisResultDto,
  type TranscriptionResultDto,
  type VoiceOptionDto,
  type VoiceErrorCode,
} from '@voiceflow/shared';
import type {
  ServerSynthesisProvider,
  ServerTranscriptionProvider,
  SynthesisInput,
  TranscriptionInput,
} from './voice-provider.interface';

/**
 * Deterministic voice provider.
 *
 * This cannot actually recognise or produce speech, and it does not pretend to:
 * the transcript it returns is plainly labelled as a mock, and synthesis
 * returns no audio at all. That matters more than it might look — a mock that
 * returned plausible-looking words would let a real integration ship believing
 * its accuracy had been validated.
 *
 * Its job is to keep the voice pipeline exercisable end to end with no vendor
 * credentials, and to give the client a working fallback shape to code against.
 */
@Injectable()
export class MockVoiceProvider implements ServerTranscriptionProvider, ServerSynthesisProvider {
  readonly id = 'mock';

  readonly producesAudio = false;

  /** Always ready: there is nothing upstream to be down. */
  isAvailable(): Promise<boolean> {
    return Promise.resolve(true);
  }

  transcribe(input: TranscriptionInput): Promise<Result<TranscriptionResultDto, VoiceErrorCode>> {
    return Promise.resolve(this.buildTranscription(input));
  }

  /** Pure and synchronous so the contract can be reasoned about without promises. */
  private buildTranscription(
    input: TranscriptionInput,
  ): Result<TranscriptionResultDto, VoiceErrorCode> {
    if (input.signal?.aborted) return err('CANCELLED');

    const bytes = input.audio.byteLength;
    if (bytes === 0) return err('NO_SPEECH_DETECTED');

    const durationMs = input.durationMs > 0 ? input.durationMs : bytes;

    return ok({
      transcript: `[mock transcript] received ${formatBytes(bytes)} of ${input.mimeType} (${durationMs} ms)`,
      // Not a confidence score. Fixed and documented so a UI cannot present it
      // as a measured likelihood.
      confidence: 0,
      locale: input.locale,
      durationMs,
      isFinal: true,
      providerId: this.id,
    });
  }

  synthesize(input: SynthesisInput): Promise<Result<SynthesisResultDto, VoiceErrorCode>> {
    return Promise.resolve(this.buildSynthesis(input));
  }

  private buildSynthesis(input: SynthesisInput): Result<SynthesisResultDto, VoiceErrorCode> {
    if (input.signal?.aborted) return err('CANCELLED');

    return ok({
      audioBase64: null,
      mimeType: null,
      characterCount: input.text.length,
      // ~14 characters per second at rate 1, which is a typical reading pace.
      estimatedDurationMs: Math.round((input.text.length / 14 / input.rate) * 1000),
      locale: input.locale,
      rate: input.rate,
      pitch: input.pitch,
      volume: input.volume,
      providerId: this.id,
    });
  }

  voices(): readonly VoiceOptionDto[] {
    return [
      {
        id: 'mock-en-us',
        name: 'Mock (en-US)',
        locale: 'en-US',
        gender: 'neutral',
        providerId: this.id,
        isDefault: true,
      },
      {
        id: 'mock-en-gb',
        name: 'Mock (en-GB)',
        locale: 'en-GB',
        gender: 'neutral',
        providerId: this.id,
        isDefault: false,
      },
      {
        id: 'mock-de-de',
        name: 'Mock (de-DE)',
        locale: 'de-DE',
        gender: 'neutral',
        providerId: this.id,
        isDefault: false,
      },
    ];
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

/** Re-exported so callers do not need a second import for the upload cap. */
export const MAX_AUDIO_BYTES = LIMITS.AUDIO_UPLOAD_MAX_BYTES;
