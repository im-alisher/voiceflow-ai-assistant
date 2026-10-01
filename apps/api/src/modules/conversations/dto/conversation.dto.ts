import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ConversationSort, ConversationStatus, MessageInputMode } from '@voiceflow/shared';
import {
  CONVERSATION_SORTS,
  CONVERSATION_STATUSES,
  LIMITS,
  MESSAGE_INPUT_MODES,
} from '@voiceflow/shared';

export const MESSAGE_ORDERS = ['asc', 'desc'] as const;
export type MessageOrder = (typeof MESSAGE_ORDERS)[number];

export class CreateConversationDto {
  @ApiPropertyOptional({
    example: 'Voice model notes',
    maxLength: LIMITS.CONVERSATION_TITLE_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @Length(1, LIMITS.CONVERSATION_TITLE_MAX_LENGTH)
  title?: string;

  @ApiPropertyOptional({ example: 'mock-assistant-v1' })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  model?: string;

  @ApiPropertyOptional({ example: 'mock' })
  @IsOptional()
  @IsString()
  @Length(1, 60)
  providerId?: string;

  @ApiPropertyOptional({ maxLength: LIMITS.SYSTEM_PROMPT_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(LIMITS.SYSTEM_PROMPT_MAX_LENGTH)
  systemPrompt?: string;
}

export class UpdateConversationDto {
  @ApiPropertyOptional({ maxLength: LIMITS.CONVERSATION_TITLE_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @Length(1, LIMITS.CONVERSATION_TITLE_MAX_LENGTH)
  title?: string;

  @ApiPropertyOptional({ enum: CONVERSATION_STATUSES })
  @IsOptional()
  @IsEnum(CONVERSATION_STATUSES)
  status?: ConversationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;
}

export class ListConversationsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 120)
  search?: string;

  @ApiPropertyOptional({ enum: CONVERSATION_STATUSES, default: 'active' })
  @IsOptional()
  @IsEnum(CONVERSATION_STATUSES)
  status?: ConversationStatus = 'active';

  @ApiPropertyOptional({ enum: CONVERSATION_SORTS, default: 'updated_at' })
  @IsOptional()
  @IsIn(CONVERSATION_SORTS)
  sort?: ConversationSort = 'updated_at';
}

export class SendMessageDto {
  @ApiProperty({ example: 'How does streaming work?', maxLength: LIMITS.MESSAGE_MAX_LENGTH })
  @IsString()
  @Length(1, LIMITS.MESSAGE_MAX_LENGTH, {
    message: `Message must be between 1 and ${LIMITS.MESSAGE_MAX_LENGTH} characters`,
  })
  // `@Length` alone accepts a string of spaces, which would persist an empty
  // turn and waste a completion.
  @Matches(/\S/, { message: 'Message cannot be only whitespace' })
  content!: string;

  @ApiPropertyOptional({ enum: MESSAGE_INPUT_MODES, default: 'text' })
  @IsOptional()
  @IsEnum(MESSAGE_INPUT_MODES)
  inputMode?: MessageInputMode = 'text';

  /** Idempotency key; a retried send returns the original turn. */
  @ApiPropertyOptional({ minLength: 8, maxLength: 120 })
  @IsOptional()
  @IsString()
  @Length(8, 120)
  clientMessageId?: string;

  @ApiPropertyOptional({ default: false, description: 'Stream the reply as server-sent events' })
  @IsOptional()
  @IsBoolean()
  stream?: boolean = false;
}

export class ListMessagesQueryDto {
  @ApiPropertyOptional({ enum: MESSAGE_ORDERS, default: 'desc' })
  @IsOptional()
  @IsIn(MESSAGE_ORDERS)
  order?: MessageOrder = 'desc';
}
