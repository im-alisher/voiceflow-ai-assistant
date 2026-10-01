import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createMailTransport, MAIL_TRANSPORT, MailService } from './mail.service';

/**
 * Outbound mail.
 *
 * One token, one transport. The concrete transport is chosen from
 * `MAIL_TRANSPORT` by `createMailTransport`; adding a real provider means
 * writing a class that satisfies `MailTransport` and registering it in that
 * factory — nothing that sends mail has to change.
 */
@Module({
  providers: [
    {
      provide: MAIL_TRANSPORT,
      useFactory: createMailTransport,
      inject: [ConfigService],
    },
    MailService,
  ],
  exports: [MailService, MAIL_TRANSPORT],
})
export class MailModule {}
