import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiResponseDto } from '../../common/dtos';
import { Public } from '../../common/decorators';
import { HealthService, type HealthReport } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Liveness probe — process is running' })
  @ApiOkResponse({ description: 'Liveness report' })
  liveness(): ApiResponseDto<HealthReport> {
    return ApiResponseDto.ok(this.health.liveness());
  }

  @Public()
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Readiness probe — dependencies are reachable' })
  @ApiOkResponse({ description: 'Readiness report including database connectivity' })
  async readiness(): Promise<ApiResponseDto<HealthReport>> {
    return ApiResponseDto.ok(await this.health.readiness());
  }
}
