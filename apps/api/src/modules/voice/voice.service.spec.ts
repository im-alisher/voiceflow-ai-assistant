import { AppException } from '../../common';
import type {
  Result,
  SynthesisResultDto,
  TranscriptionResultDto,
  VoiceErrorCode,
} from '@voiceflow/shared';
import { SynthesizeDto } from './dto/voice.dto';
import { MAX_AUDIO_BYTES } from './providers/mock-voice.provider';
import type {
  ServerSynthesisProvider,
  ServerTranscriptionProvider,
} from './providers/voice-provider.interface';
import { MockVoiceProvider } from './providers/mock-voice.provider';
import { VoiceService } from './voice.service';

describe('VoiceService', () => {
  let stt: jest.Mocked<ServerTranscriptionProvider>;
  let tts: jest.Mocked<ServerSynthesisProvider>;
  let service: VoiceService;

  beforeEach(() => {
    const mock = new MockVoiceProvider();
    stt = {
      id: 'stub',
      isAvailable: jest.fn().mockResolvedValue(true),
      transcribe: jest.fn(),
    };
    tts = {
      id: 'stub',
      producesAudio: true,
      isAvailable: jest.fn().mockResolvedValue(true),
      voices: jest.fn().mockReturnValue([]),
      synthesize: jest.fn(),
    };
    service = new VoiceService(stt, tts);

    // Sanity-check the bundled provider itself; these assertions are the
    // contract the service above is written against.
    expect(mock.producesAudio).toBe(false);
  });

  describe('transcribe', () => {
    it('rejects an empty clip before calling the provider', async () => {
      await expect(service.transcribe(Buffer.alloc(0), meta())).rejects.toThrow(AppException);
      expect(stt.transcribe).not.toHaveBeenCalled();
    });

    it('rejects a clip above the upload budget', async () => {
      const oversized = Buffer.alloc(MAX_AUDIO_BYTES + 1);

      await expect(service.transcribe(oversized, meta())).rejects.toThrow(/must not exceed/);
      expect(stt.transcribe).not.toHaveBeenCalled();
    });

    it('returns the provider result unchanged', async () => {
      const result = transcription();
      if (!result.ok) throw new Error('fixture must be a success');
      stt.transcribe.mockResolvedValue(result);

      await expect(service.transcribe(Buffer.from('audio'), meta())).resolves.toEqual(result.value);
    });

    it('maps a provider failure onto the canonical envelope', async () => {
      stt.transcribe.mockResolvedValue(err('ENGINE_ERROR'));

      await expect(service.transcribe(Buffer.from('audio'), meta())).rejects.toThrow(
        /ENGINE_ERROR/,
      );
    });

    it('treats a missing provider as unavailability, not a bad request', async () => {
      stt.transcribe.mockResolvedValue(err('NOT_SUPPORTED'));

      await expect(service.transcribe(Buffer.from('audio'), meta())).rejects.toThrow(
        /No speech-to-text provider/,
      );
    });
  });

  describe('synthesize', () => {
    it('returns a no-audio result as a success', async () => {
      const result: Result<SynthesisResultDto, VoiceErrorCode> = {
        ok: true,
        value: {
          audioBase64: null,
          mimeType: null,
          characterCount: 5,
          estimatedDurationMs: 357,
          locale: 'en-US',
          rate: 1,
          pitch: 1,
          volume: 1,
          providerId: 'mock',
        },
      };
      tts.synthesize.mockResolvedValue(result);

      await expect(service.synthesize(body())).resolves.toMatchObject({ audioBase64: null });
    });

    it('propagates a cancellation as a service error', async () => {
      tts.synthesize.mockResolvedValue(err('CANCELLED'));

      await expect(service.synthesize(body())).rejects.toThrow(/CANCELLED/);
    });
  });

  describe('MockVoiceProvider', () => {
    it('labels its transcript so it cannot be mistaken for real recognition', async () => {
      const result = await new MockVoiceProvider().transcribe({
        audio: Buffer.from('0123456789'),
        mimeType: 'audio/webm',
        locale: 'en-US',
        durationMs: 1500,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.transcript).toContain('[mock transcript]');
      expect(result.value.durationMs).toBe(1500);
      // Documented sentinel, not a measured confidence.
      expect(result.value.confidence).toBe(0);
    });

    it('reports no speech for an empty clip', async () => {
      const result = await new MockVoiceProvider().transcribe({
        audio: Buffer.alloc(0),
        mimeType: 'audio/webm',
        locale: 'en-US',
        durationMs: 0,
      });

      expect(result).toEqual(err('NO_SPEECH_DETECTED'));
    });

    it('scales estimated duration by the requested rate', async () => {
      const provider = new MockVoiceProvider();
      const input = { text: 'a'.repeat(140), locale: 'en-US', pitch: 1, volume: 1 };

      const normal = await provider.synthesize({ ...input, rate: 1 });
      if (!normal.ok) throw new Error('expected success');

      const fast = await provider.synthesize({ ...input, rate: 2 });
      if (!fast.ok) throw new Error('expected success');

      expect(fast.value.estimatedDurationMs).toBeLessThan(normal.value.estimatedDurationMs);
    });

    it('honours an abort signal', async () => {
      const controller = new AbortController();
      controller.abort();

      const result = await new MockVoiceProvider().synthesize({
        text: 'hello',
        locale: 'en-US',
        rate: 1,
        pitch: 1,
        volume: 1,
        signal: controller.signal,
      });

      expect(result).toEqual(err('CANCELLED'));
    });
  });
});

function meta() {
  return { locale: 'en-US', durationMs: 1200, mimeType: 'audio/webm' };
}

function body(): SynthesizeDto {
  return Object.assign(new SynthesizeDto(), {
    text: 'hello',
    locale: 'en-US',
    rate: 1,
    pitch: 1,
    volume: 1,
  });
}

function transcription(): Result<TranscriptionResultDto, VoiceErrorCode> {
  return {
    ok: true,
    value: {
      transcript: 'hello there',
      confidence: 0.9,
      locale: 'en-US',
      durationMs: 1200,
      isFinal: true,
      providerId: 'stub',
    },
  };
}

function err(error: VoiceErrorCode): Result<never, VoiceErrorCode> {
  return { ok: false, error };
}
