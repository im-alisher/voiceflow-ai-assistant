import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { SynthesisResultDto, TranscriptionResultDto, VoiceOptionDto } from '@voiceflow/shared';
import { ApiResponseDto } from '../../common/dtos';
import { SynthesizeDto, TranscribeQueryDto } from './dto/voice.dto';
import { VoiceService } from './voice.service';

/**
 * The uploaded part, described locally.
 *
 * Declared structurally rather than as `Express.Multer.File` so the API package
 * does not need `@types/multer` at build time just to describe one property.
 */
interface UploadedAudio {
  readonly buffer: Buffer;
  readonly mimetype: string;
  readonly size: number;
}

@ApiTags('voice')
@Controller('voice')
export class VoiceController {
  constructor(private readonly voice: VoiceService) {}

  @Get('voices')
  @ApiOperation({ summary: 'List synthesis voices offered by the API' })
  @ApiOkResponse({ description: 'Voices from the active provider' })
  listVoices(): ApiResponseDto<readonly VoiceOptionDto[]> {
    return ApiResponseDto.ok(this.voice.voices());
  }

  @Post('synthesize')
  @ApiOperation({ summary: 'Synthesise speech from text' })
  @ApiOkResponse({ description: 'Audio, or timing metadata when the provider has no engine' })
  async synthesize(
    @Body() body: SynthesizeDto,
    @Req() request: Request,
  ): Promise<ApiResponseDto<SynthesisResultDto>> {
    return ApiResponseDto.ok(await this.voice.synthesize(body, abortSignalFor(request)));
  }

  @Post('transcribe')
  @UseInterceptors(FileInterceptor('audio'))
  @ApiConsumes('multipart/form-data', 'audio/*')
  @ApiOperation({ summary: 'Transcribe an uploaded audio clip' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { audio: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOkResponse({ description: 'Transcript produced by the active provider' })
  async transcribe(
    @UploadedFile() file: UploadedAudio | undefined,
    @Query() query: TranscribeQueryDto,
    @Req() request: Request,
  ): Promise<ApiResponseDto<TranscriptionResultDto>> {
    return ApiResponseDto.ok(
      await this.voice.transcribe(
        file?.buffer ?? Buffer.alloc(0),
        {
          locale: query.locale,
          durationMs: query.durationMs,
          mimeType: file?.mimetype ?? 'audio/webm',
        },
        abortSignalFor(request),
      ),
    );
  }
}

/**
 * Bridges request cancellation to the provider.
 *
 * The upload is already in memory by the time a handler runs, so the only work
 * worth cancelling is the provider call itself; aborting it stops a slow engine
 * from holding a connection open after the client has gone.
 */
function abortSignalFor(request: Request): AbortSignal {
  const controller = new AbortController();

  const abort = () => {
    if (!controller.signal.aborted) controller.abort();
  };

  const bodyFinished = () => (request as unknown as { writableEnded?: boolean }).writableEnded;
  request.once('aborted', abort);
  request.once('close', () => {
    if (!bodyFinished()) abort();
  });

  return controller.signal;
}
