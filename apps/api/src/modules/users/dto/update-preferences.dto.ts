import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString, Length } from 'class-validator';
import { FONT_SCALES, THEME_MODES, type UserPreferencesDto } from '@voiceflow/shared';

/** One level of optionality, recursively. */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export type PreferencesPatch = DeepPartial<UserPreferencesDto>;

const FREE_FORM_OBJECT = { type: 'object', additionalProperties: true } as const;

/**
 * Partial preference patch.
 *
 * Every field is optional and the service performs a shallow merge, so the
 * client can send only what changed and cannot accidentally reset unrelated
 * settings.
 */
export class UpdatePreferencesDto implements PreferencesPatch {
  @ApiPropertyOptional({ enum: THEME_MODES })
  @IsOptional()
  @IsIn(THEME_MODES)
  theme?: UserPreferencesDto['theme'];

  @ApiPropertyOptional({ enum: FONT_SCALES })
  @IsOptional()
  @IsIn(FONT_SCALES)
  fontScale?: UserPreferencesDto['fontScale'];

  @ApiPropertyOptional({ example: 'en' })
  @IsOptional()
  @IsString()
  @Length(2, 16)
  language?: string;

  @ApiPropertyOptional({ example: 'Europe/London' })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  timezone?: string;

  @ApiPropertyOptional(FREE_FORM_OBJECT)
  @IsOptional()
  @IsObject()
  voice?: PreferencesPatch['voice'];

  @ApiPropertyOptional(FREE_FORM_OBJECT)
  @IsOptional()
  @IsObject()
  ai?: PreferencesPatch['ai'];

  @ApiPropertyOptional(FREE_FORM_OBJECT)
  @IsOptional()
  @IsObject()
  notifications?: PreferencesPatch['notifications'];

  @ApiPropertyOptional(FREE_FORM_OBJECT)
  @IsOptional()
  @IsObject()
  accessibility?: PreferencesPatch['accessibility'];
}
