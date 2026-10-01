import { Module } from '@nestjs/common';
import { SPEECH_TO_TEXT_PROVIDER, TEXT_TO_SPEECH_PROVIDER } from '../../common';
import { MockVoiceProvider } from './providers/mock-voice.provider';
import { VoiceController } from './voice.controller';
import { VoiceService } from './voice.service';

/**
 * Voice bounded context.
 *
 * Registration order matters: the first provider bound to a port is the active
 * one. Swapping the mock for a real engine is therefore a one-line change here
 * — a new class appended *before* `MockVoiceProvider` — with no change to the
 * service, controller or web client.
 */
@Module({
  controllers: [VoiceController],
  providers: [
    MockVoiceProvider,
    { provide: SPEECH_TO_TEXT_PROVIDER, useExisting: MockVoiceProvider },
    { provide: TEXT_TO_SPEECH_PROVIDER, useExisting: MockVoiceProvider },
    VoiceService,
  ],
  exports: [VoiceService, SPEECH_TO_TEXT_PROVIDER, TEXT_TO_SPEECH_PROVIDER],
})
export class VoiceModule {}
