import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  ConsoleMailTransport,
  createMailTransport,
  MAIL_TRANSPORT,
  MailService,
} from './mail.service';

function configWith(transport: string, from?: string) {
  return {
    get: (key: string) => (key === 'mail' ? { transport, from } : undefined),
  } as ConfigService;
}

describe('MailService', () => {
  interface SentMail {
    readonly to: string;
    readonly from: string;
    readonly subject: string;
    readonly text: string;
    readonly requestId?: string;
  }

  const transport = {
    name: 'test',
    send: jest.fn((_message: SentMail) => Promise.resolve(true)),
  };

  let service: MailService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: MAIL_TRANSPORT, useValue: transport },
        { provide: ConfigService, useValue: configWith('console', 'Ops <ops@voiceflow.local>') },
      ],
    })
      .setLogger({
        log: () => undefined,
        error: () => undefined,
        warn: () => undefined,
        debug: () => undefined,
        verbose: () => undefined,
      })
      .compile();

    service = moduleRef.get(MailService);
  });

  it('sends the configured sender address rather than a hardcoded one', async () => {
    await service.sendPasswordReset({
      to: 'ada@voiceflow.local',
      displayName: 'Ada',
      resetUrl: 'http://localhost:5173/reset-password?token=abc',
      ttlMinutes: 30,
    });

    expect(transport.send).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'Ops <ops@voiceflow.local>' }),
    );
  });

  it('includes the reset link and its expiry in the body', async () => {
    await service.sendPasswordReset({
      to: 'ada@voiceflow.local',
      displayName: 'Ada',
      resetUrl: 'http://localhost:5173/reset-password?token=abc',
      ttlMinutes: 30,
    });

    const { subject, text, to } = transport.send.mock.calls[0]![0];
    expect(to).toBe('ada@voiceflow.local');
    expect(subject).toBe('Reset your Voiceflow password');
    expect(text).toContain('http://localhost:5173/reset-password?token=abc');
    expect(text).toContain('30 minutes');
    expect(text).toContain('Ada');
  });

  it('reports a refused message without claiming success', async () => {
    transport.send.mockResolvedValue(false);
    const logger = { error: jest.fn() };
    jest
      .spyOn(
        (service as unknown as { logger: { error: (message: string) => void } }).logger,
        'error',
      )
      .mockImplementation(logger.error);

    const delivered = await service.sendPasswordReset({
      to: 'ada@voiceflow.local',
      displayName: 'Ada',
      resetUrl: 'http://localhost:5173/reset-password?token=abc',
      ttlMinutes: 30,
    });

    expect(delivered).toBe(false);
  });

  it('treats the console transport as not live', () => {
    expect(
      new MailService({ name: 'console', send: transport.send }, configWith('console')).isLive,
    ).toBe(false);
    expect(service.isLive).toBe(true);
  });
});

describe('createMailTransport', () => {
  it('returns the console transport by default', () => {
    expect(createMailTransport(configWith('console'))).toBeInstanceOf(ConsoleMailTransport);
  });

  it('throws for a transport this build does not implement instead of silently logging', () => {
    expect(() => createMailTransport(configWith('smtp'))).toThrow(/not implemented/i);
  });
});
