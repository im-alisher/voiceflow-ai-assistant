import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiGoneResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { ConversationDto, MessageDto, Paginated } from '@voiceflow/shared';
import { LIMITS } from '@voiceflow/shared';
import type { Request, Response } from 'express';
import { ApiResponseDto } from '../../common/dtos';
import { CurrentUser, SkipTransform } from '../../common/decorators';
import type { AuthenticatedRequest } from '../../common/interfaces';
import { AiService } from '../ai/ai.service';
import { ConversationTurnService } from './conversation-turn.service';
import { ConversationsService } from './conversations.service';
import {
  CreateConversationDto,
  ListConversationsQueryDto,
  ListMessagesQueryDto,
  SendMessageDto,
  UpdateConversationDto,
} from './dto/conversation.dto';
import { SseWriter } from './sse-writer';
import type { ModelDefaults } from './types';

/**
 * Conversation and message HTTP surface.
 *
 * Every handler takes the caller from the validated access token rather than
 * from the request body, so a user cannot address another user's thread by
 * sending a different id.
 */
@ApiTags('conversations')
@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly conversations: ConversationsService,
    private readonly turns: ConversationTurnService,
    private readonly sse: SseWriter,
    private readonly ai: AiService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Start a conversation' })
  @ApiCreatedResponse({ description: 'The new conversation' })
  async create(
    @CurrentUser('userId') userId: string,
    @Body() body: CreateConversationDto,
  ): Promise<ApiResponseDto<ConversationDto>> {
    // Taken from the AI registry rather than repeated here, so a deployment that
    // configures a different provider does not get mock defaults baked in.
    const defaults: ModelDefaults = {
      model: body.model ?? this.ai.defaultModel,
      providerId: body.providerId ?? this.ai.defaultProviderId,
    };

    return ApiResponseDto.ok(await this.conversations.create({ userId, ...body }, defaults));
  }

  @Get()
  @ApiOperation({ summary: 'List conversations' })
  @ApiOkResponse({ description: 'A cursor-paginated page of conversations' })
  async list(
    @CurrentUser('userId') userId: string,
    @Query() query: ListConversationsQueryDto,
    @Query('limit') rawLimit?: string,
    @Query('cursor') cursor?: string,
  ): Promise<ApiResponseDto<Paginated<ConversationDto>>> {
    const limit = clampLimit(rawLimit);

    return ApiResponseDto.ok(
      await this.conversations.list({
        userId,
        limit,
        cursor,
        status: query.status,
        search: query.search,
        sort: query.sort,
      }),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fetch one conversation' })
  @ApiOkResponse({ description: 'The conversation' })
  async findOne(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<ConversationDto>> {
    return ApiResponseDto.ok(await this.conversations.findOwnedDto(userId, id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update title, status or pinning' })
  @ApiOkResponse({ description: 'The updated conversation' })
  async update(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateConversationDto,
  ): Promise<ApiResponseDto<ConversationDto>> {
    return ApiResponseDto.ok(await this.conversations.update(userId, id, body));
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive a conversation' })
  @ApiOkResponse({ description: 'The archived conversation' })
  async archive(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<ConversationDto>> {
    return ApiResponseDto.ok(await this.conversations.archive(userId, id));
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore an archived conversation' })
  @ApiOkResponse({ description: 'The restored conversation' })
  async restore(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<ConversationDto>> {
    return ApiResponseDto.ok(await this.conversations.restore(userId, id));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a conversation' })
  @ApiOkResponse({ description: 'The conversation, marked deleted' })
  @ApiGoneResponse({ description: 'Already deleted' })
  async remove(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<ConversationDto>> {
    return ApiResponseDto.ok(await this.conversations.softDelete(userId, id));
  }

  // ------------------------------------------------------------------ messages

  @Get(':id/messages')
  @ApiOperation({ summary: 'List the messages in a conversation' })
  @ApiOkResponse({ description: 'A cursor-paginated page of messages, oldest first' })
  async listMessages(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListMessagesQueryDto,
    @Query('limit') rawLimit?: string,
    @Query('cursor') cursor?: string,
  ): Promise<ApiResponseDto<Paginated<MessageDto>>> {
    // Ownership is checked before listing so a foreign thread cannot be probed.
    await this.conversations.findOwned(userId, id);

    return ApiResponseDto.ok(
      await this.conversations.listMessages({
        conversationId: id,
        limit: clampLimit(rawLimit, LIMITS.RECENT_MESSAGE_PAGE_SIZE),
        // The DTO defaults apply at runtime; the fallback only narrows the type.
        order: query.order ?? 'desc',
        cursor,
      }),
    );
  }

  /**
   * Sends a turn and returns the assistant's reply.
   *
   * Buffered by default; `stream: true` switches the same route to SSE so the
   * client needs only one endpoint regardless of transport.
   */
  @Post(':id/messages')
  @HttpCode(HttpStatus.OK)
  @SkipTransform()
  @ApiOperation({ summary: 'Send a message and receive the reply' })
  @ApiOkResponse({ description: 'The user turn and the assistant turn it produced' })
  @ApiConflictResponse({ description: 'The conversation is archived' })
  async send(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SendMessageDto,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const turnRequest = {
      userId,
      conversationId: id,
      content: body.content,
      // Defaults live on the DTO, which class-transformer instantiates; the
      // fallback only narrows the declared type.
      inputMode: body.inputMode ?? 'text',
      clientMessageId: body.clientMessageId,
      contextTurns: LIMITS.CONTEXT_TURNS_DEFAULT,
      requestId: (request as AuthenticatedRequest).context?.requestId ?? 'unknown',
      signal: abortOnDisconnect(response),
    };

    if (!body.stream) {
      const turn = await this.turns.send(turnRequest);
      response.status(HttpStatus.OK).json(ApiResponseDto.ok(turn));
      return;
    }

    await this.sse.stream(response, this.turns.sendStream(turnRequest));
  }

  @Delete(':conversationId/messages/:messageId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a single message' })
  @ApiOkResponse({ description: 'The number of messages that remain' })
  async deleteMessage(
    @CurrentUser('userId') userId: string,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ): Promise<ApiResponseDto<{ remaining: number }>> {
    return ApiResponseDto.ok(
      await this.conversations.deleteMessage(userId, conversationId, messageId),
    );
  }
}

/** Mirrors `paginationQuerySchema.limit` so a hostile value cannot widen a page. */
function clampLimit(raw: string | undefined, fallback: number = LIMITS.PAGE_SIZE_DEFAULT): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, LIMITS.PAGE_SIZE_MAX);
}

/**
 * Cancels the upstream call when the client goes away.
 *
 * Without this, closing the tab mid-stream would leave the provider burning
 * tokens for a reply nobody will read.
 *
 * Listens on the *response* rather than the request: a request emits `close`
 * once its body has been fully read, which for a buffered send is before the
 * model has produced anything, so aborting there would cancel every turn.
 */
function abortOnDisconnect(response: Response): AbortSignal {
  const controller = new AbortController();
  response.on('close', () => {
    // `writableEnded` is true once the response completed normally.
    if (!response.writableEnded) controller.abort();
  });
  return controller.signal;
}
