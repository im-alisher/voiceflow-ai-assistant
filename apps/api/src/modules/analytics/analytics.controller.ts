import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  ActivityConversationDto,
  AnalyticsSummaryDto,
  AnalyticsUsageDto,
} from '@voiceflow/shared';
import { ApiResponseDto } from '../../common/dtos';
import { CurrentUser } from '../../common/decorators';
import { AnalyticsService } from './analytics.service';
import { AnalyticsActivityQueryDto, AnalyticsUsageQueryDto } from './dto/analytics.dto';

/**
 * Usage reporting for the signed-in user.
 *
 * The user id comes from the verified principal and is never a parameter:
 * an analytics endpoint that accepts a user id is a data-leak waiting to be
 * copied.
 */
@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Aggregate totals, latency and provider mix' })
  @ApiOkResponse({ description: 'Usage summary for the authenticated user' })
  async summary(
    @CurrentUser('userId') userId: string,
  ): Promise<ApiResponseDto<AnalyticsSummaryDto>> {
    return ApiResponseDto.ok(await this.analytics.summary(userId));
  }

  @Get('usage')
  @ApiOperation({ summary: 'Daily message and token totals' })
  @ApiOkResponse({ description: 'Dense daily series, zero-filled' })
  async usage(
    @CurrentUser('userId') userId: string,
    @Query() query: AnalyticsUsageQueryDto,
  ): Promise<ApiResponseDto<AnalyticsUsageDto>> {
    return ApiResponseDto.ok(await this.analytics.usage(userId, query.days));
  }

  @Get('activity')
  @ApiOperation({ summary: 'Most recently active conversations' })
  @ApiOkResponse({ description: 'Recent threads with their token cost' })
  async activity(
    @CurrentUser('userId') userId: string,
    @Query() query: AnalyticsActivityQueryDto,
  ): Promise<ApiResponseDto<readonly ActivityConversationDto[]>> {
    return ApiResponseDto.ok(await this.analytics.activity(userId, query.limit));
  }
}
