import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiResponseDto } from '../../common/dtos';
import { Public } from '../../common/decorators';
import { AiService } from './ai.service';

/**
 * Introspection endpoint for the AI layer.
 *
 * Marked `@Public()` because the web client uses it to populate a provider
 * picker *before* authentication has completed. It exposes capability metadata
 * only — no prompts, no keys, no user data.
 */
@ApiTags('ai')
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Public()
  @Get('providers')
  @ApiOperation({ summary: 'List registered AI providers and their capabilities' })
  @ApiOkResponse({ description: 'Registered providers with availability and limits' })
  listProviders(): Promise<ApiResponseDto<Awaited<ReturnType<AiService['listProviders']>>>> {
    return this.ai.listProviders().then((providers) => ApiResponseDto.ok(providers));
  }
}
