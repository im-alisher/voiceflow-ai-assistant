import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CLOCK, systemClock } from '../../common';
import { AiModule } from '../ai/ai.module';
import { ConversationTurnService } from './conversation-turn.service';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { SseWriter } from './sse-writer';

/**
 * Conversations bounded context.
 *
 * Owns both tables because a message is meaningless without its thread: the
 * sequence allocation and the conversation's denormalised summary have to be
 * written together, which a module boundary would otherwise prevent.
 *
 * The controller is protected by the globally registered `JwtAuthGuard`; there
 * is no `@Public()` route in this module, so adding an endpoint here is
 * authenticated by default.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Conversation, Message]), AiModule],
  controllers: [ConversationsController],
  providers: [
    ConversationsService,
    ConversationTurnService,
    SseWriter,
    { provide: CLOCK, useValue: systemClock },
  ],
  exports: [
    ConversationsService,
    ConversationTurnService,
    // Read-side consumers (analytics) need the repositories. Exporting the
    // module rather than the entities keeps them going through TypeORM's
    // injection token rather than an entity instance.
    TypeOrmModule,
  ],
})
export class ConversationsModule {}

export { Conversation } from './entities/conversation.entity';
export { Message } from './entities/message.entity';
