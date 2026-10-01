import { Module } from '@nestjs/common';
import { CLOCK } from '../../common';
import { ConversationsModule } from '../conversations/conversations.module';
import { AnalyticsController } from './analytics.controller';
import { ANALYTICS_READER } from './analytics.reader';
import { AnalyticsService } from './analytics.service';
import { TypeOrmAnalyticsReader } from './typeorm-analytics.reader';

/**
 * Analytics read model.
 *
 * Read-only by construction: nothing in this module can write, so no analytics
 * path can alter the data it reports on.
 */
@Module({
  imports: [ConversationsModule],
  controllers: [AnalyticsController],
  providers: [
    TypeOrmAnalyticsReader,
    { provide: ANALYTICS_READER, useExisting: TypeOrmAnalyticsReader },
    { provide: CLOCK, useFactory: () => ({ now: () => new Date(), nowMs: () => Date.now() }) },
    AnalyticsService,
  ],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
