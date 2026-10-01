import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { UserDto } from '@voiceflow/shared';
import { ApiResponseDto } from '../../common/dtos';
import { CurrentUser } from '../../common/decorators';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

/**
 * Profile and preference surface.
 *
 * Every handler is keyed by the principal's own id. There is deliberately no
 * `:id` route: `/users/:id` would invite a future handler to trust a
 * caller-supplied identifier, and this API has no use case for reading another
 * user's settings.
 */
@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'The authenticated user, including preferences' })
  @ApiOkResponse({ description: 'Current profile' })
  async me(@CurrentUser('userId') userId: string): Promise<ApiResponseDto<UserDto>> {
    return ApiResponseDto.ok(this.users.toDto(await this.users.findByIdOrFail(userId)));
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update display name or avatar' })
  @ApiOkResponse({ description: 'Updated profile' })
  async updateProfile(
    @CurrentUser('userId') userId: string,
    @Body() body: UpdateProfileDto,
  ): Promise<ApiResponseDto<UserDto>> {
    return ApiResponseDto.ok(this.users.toDto(await this.users.updateProfile(userId, body)));
  }

  @Patch('me/preferences')
  @ApiOperation({ summary: 'Merge a partial preferences patch' })
  @ApiOkResponse({ description: 'Preferences after the merge' })
  async updatePreferences(
    @CurrentUser('userId') userId: string,
    @Body() body: UpdatePreferencesDto,
  ): Promise<ApiResponseDto<UserDto>> {
    return ApiResponseDto.ok(this.users.toDto(await this.users.updatePreferences(userId, body)));
  }
}
