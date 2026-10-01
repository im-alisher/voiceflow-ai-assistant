import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LIMITS } from '@voiceflow/shared';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Length, Max, Min } from 'class-validator';

/** Synthesize request body. */
export class SynthesizeDto {
  @ApiProperty({ example: 'Welcome to the voice lab.' })
  @IsString()
  @Length(1, LIMITS.SYNTHESIS_MAX_LENGTH)
  text!: string;

  @ApiPropertyOptional({ example: 'en-US', default: 'en-US' })
  @IsOptional()
  @IsString()
  @Length(2, 35)
  locale: string = 'en-US';

  @ApiPropertyOptional({ minimum: 0.5, maximum: 2, default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(2)
  rate: number = 1;

  @ApiPropertyOptional({ minimum: 0, maximum: 2, default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  pitch: number = 1;

  @ApiPropertyOptional({ minimum: 0, maximum: 1, default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  volume: number = 1;
}

/**
 * Transcription metadata.
 *
 * The audio itself arrives as the raw request body (see the controller) rather
 * than as multipart form data: no multipart parser is needed, and a raw body
 * can be size-capped while it streams instead of after it has been buffered.
 */
export class TranscribeQueryDto {
  @ApiPropertyOptional({ example: 'en-US', default: 'en-US' })
  @IsOptional()
  @IsString()
  @Length(2, 35)
  locale: string = 'en-US';

  @ApiPropertyOptional({ example: 4200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(LIMITS.SPEECH_MAX_DURATION_MS)
  durationMs: number = 0;
}
