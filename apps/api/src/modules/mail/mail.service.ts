import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CONFIG_NAMESPACE, type MailConfig } from '../../config';
import { AppLogger } from '../../common/logger';

/** A message reduced to what any transport actually needs. */
export interface MailMessage {
  readonly to: string;
  readonly from: string;
  readonly subject: string;
  readonly text: string;
  /** Correlation id, so a log line can be tied back to a request. */
  readonly requestId?: string;
}

/**
 * Delivery port.
 *
 * Implementations must not throw for an unreachable server: a password-reset
 * email that failed to send is an operational problem, not a reason to fail the
 * request that triggered it. Failures are reported through the boolean return
 * so the caller can decide how loudly to complain.
 */
export interface MailTransport {
  readonly name: string;
  send(message: MailMessage): Promise<boolean>;
}

export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT');

/**
 * Writes the message to the application log.
 *
 * The default transport. A reset link in the log is still a usable link on a
 * developer machine, which keeps the flow exercisable with no SMTP credentials
 * — and it makes the production failure mode obvious, since an operator seeing
 * `console` knows no mail is leaving the box.
 */
@Injectable()
export class ConsoleMailTransport implements MailTransport {
  readonly name = 'console';

  /**
   * Created directly rather than injected: `AppLogger` takes its context as a
   * constructor argument, so binding it as a provider would need a factory that
   * exists only to supply a constant.
   */
  private readonly logger = new AppLogger('Mail').child('ConsoleTransport');

  private readonly from: string;

  constructor(config: ConfigService) {
    this.from = config.get<MailConfig>(CONFIG_NAMESPACE.MAIL)?.from ?? DEFAULT_FROM;
  }

  send(message: MailMessage): Promise<boolean> {
    this.logger.log(
      [
        '',
        '──────── mail (console transport) ────────',
        `to:      ${message.to}`,
        `from:    ${message.from || this.from}`,
        `subject: ${message.subject}`,
        ...(message.requestId ? [`request: ${message.requestId}`] : []),
        '',
        message.text,
        '─────────────────────────────────────────',
      ].join('\n'),
    );
    return Promise.resolve(true);
  }
}

const DEFAULT_FROM = 'Voiceflow <no-reply@voiceflow.local>';

/**
 * Resolves the configured transport.
 *
 * `console` is the only transport this build implements. Anything else fails
 * fast and loudly rather than silently downgrading to the log: a deployment
 * that asked for real delivery and got a console transport instead would
 * believe password-reset emails were being sent when none were.
 *
 * Adding `smtp` means writing a `MailTransport`, registering it in the
 * `switch`, and nothing else.
 */
export function createMailTransport(config: ConfigService): MailTransport {
  const configured = config.get<MailConfig>(CONFIG_NAMESPACE.MAIL)?.transport ?? 'console';

  switch (configured) {
    case 'console':
      return new ConsoleMailTransport(config);
    default:
      throw new Error(
        `MAIL_TRANSPORT=${String(configured)} is not implemented in this build. ` +
          'Only "console" ships here; add a MailTransport and register it in createMailTransport to enable real delivery.',
      );
  }
}

/**
 * Template-rendering mail facade.
 *
 * Owns *what* a message says; a transport owns *how* it is delivered. Callers
 * never build a subject or body inline, so the wording of a security-critical
 * email lives in exactly one auditable place.
 */
@Injectable()
export class MailService {
  /**
   * Created directly rather than injected: `AppLogger` takes its context as a
   * constructor argument, so binding it as a provider would need a factory that
   * exists only to supply a constant.
   */
  private readonly logger = new AppLogger('Mail').child('MailService');

  private readonly from: string;

  constructor(
    @Inject(MAIL_TRANSPORT) private readonly transport: MailTransport,
    config: ConfigService,
  ) {
    this.from = config.get<MailConfig>(CONFIG_NAMESPACE.MAIL)?.from ?? DEFAULT_FROM;
  }

  async sendPasswordReset(input: {
    to: string;
    displayName: string;
    resetUrl: string;
    ttlMinutes: number;
    requestId?: string;
  }): Promise<boolean> {
    const delivered = await this.transport.send({
      to: input.to,
      from: this.from,
      subject: 'Reset your Voiceflow password',
      text: [
        `Hi ${input.displayName},`,
        '',
        'Someone requested a password reset for your Voiceflow account.',
        'Open the link below to choose a new password:',
        '',
        input.resetUrl,
        '',
        `This link expires in ${input.ttlMinutes} minutes and can only be used once.`,
        '',
        'If this was not you, no action is needed — your password has not changed.',
      ].join('\n'),
      requestId: input.requestId,
    });

    if (!delivered) {
      // Deliberately without the address: this line ends up in shared logs.
      this.logger.error('Password reset message could not be delivered');
    }

    return delivered;
  }

  /** False when messages are only being written to the log. */
  get isLive(): boolean {
    return this.transport.name !== 'console';
  }
}
