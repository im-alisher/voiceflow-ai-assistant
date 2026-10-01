import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ANALYTICS_DEFAULT_DAYS, ANALYTICS_MAX_DAYS } from '@voiceflow/shared';

export class AnalyticsUsageQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: ANALYTICS_MAX_DAYS, default: ANALYTICS_DEFAULT_DAYS })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(ANALYTICS_MAX_DAYS)
  days: number = ANALYTICS_DEFAULT_DAYS;
}

export class AnalyticsActivityQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 25, default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(25)
  limit: number = 5;
}
