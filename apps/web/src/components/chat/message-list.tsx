import { Bot, User } from 'lucide-react';
import type { MessageDto } from '@voiceflow/shared';
import { Badge } from '@/components/ui/badge';
import { formatClockTime, formatDayHeading, needsDaySeparator } from '@/features/chat/chat-format';
import { cn } from '@/lib/utils';
import type { StreamingTurn } from '@/features/chat/use-conversations';

export interface MessageListProps {
  readonly messages: readonly MessageDto[];
  /** Echo of the in-flight turn, which the server has not stored yet. */
  readonly pending?: StreamingTurn | null;
  readonly isStreaming?: boolean;
  readonly hasMoreHistory?: boolean;
  readonly isLoadingHistory?: boolean;
  readonly onLoadHistory?: () => void;
}

/**
 * The transcript.
 *
 * A message being streamed is not a `MessageDto` yet, so it is rendered from
 * the pending turn instead: the user's echo appears at once, and the assistant
 * bubble grows as deltas arrive. Both are excluded from the persisted list by
 * id so the reply is not shown twice once the server hands back its own row.
 */
export function MessageList({
  messages,
  pending,
  isStreaming = false,
  hasMoreHistory = false,
  isLoadingHistory = false,
  onLoadHistory,
}: MessageListProps) {
  const visible = pending
    ? messages.filter(
        (message) =>
          message.id !== pending.userMessageId && message.id !== pending.assistantMessageId,
      )
    : messages;

  return (
    <div className="space-y-4">
      {hasMoreHistory ? (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={onLoadHistory}
            disabled={isLoadingHistory}
            className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4 disabled:opacity-50"
          >
            {isLoadingHistory ? 'Loading earlier messages…' : 'Load earlier messages'}
          </button>
        </div>
      ) : null}

      {visible.map((message, index) => (
        <MessageRow
          key={message.id}
          message={message}
          showDaySeparator={needsDaySeparator(
            index > 0 ? visible[index - 1]?.createdAt : undefined,
            message.createdAt,
          )}
        />
      ))}

      {pending ? (
        <>
          <MessageRow
            message={syntheticUserMessage(pending)}
            showDaySeparator={visible.length === 0}
          />
          <MessageRow
            message={syntheticAssistantMessage(pending)}
            showDaySeparator={false}
            isStreaming={isStreaming}
          />
        </>
      ) : null}
    </div>
  );
}

interface MessageRowProps {
  readonly message: MessageDto;
  readonly showDaySeparator: boolean;
  readonly isStreaming?: boolean;
}

function MessageRow({ message, showDaySeparator, isStreaming = false }: MessageRowProps) {
  const isUser = message.role === 'user';

  return (
    <>
      {showDaySeparator ? (
        <div className="flex items-center gap-3 py-1" role="separator">
          <span className="bg-border h-px flex-1" />
          <span className="text-muted-foreground text-xs font-medium">
            {formatDayHeading(message.createdAt)}
          </span>
          <span className="bg-border h-px flex-1" />
        </div>
      ) : null}

      <article
        className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}
        aria-label={isUser ? 'Your message' : 'Assistant message'}
      >
        {!isUser ? (
          <span
            className="bg-primary/10 text-primary mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            aria-hidden="true"
          >
            <Bot className="h-4 w-4" />
          </span>
        ) : null}

        <div className={cn('min-w-0 max-w-[85%] space-y-1', isUser && 'items-end')}>
          <div
            className={cn(
              'whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
              isUser
                ? 'bg-primary text-primary-foreground rounded-br-sm'
                : 'bg-muted text-foreground rounded-bl-sm',
            )}
          >
            {message.content}
            {isStreaming ? (
              <span
                className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-current align-middle"
                aria-hidden="true"
              />
            ) : null}
          </div>

          <div
            className={cn(
              'text-muted-foreground flex flex-wrap items-center gap-2 px-1 text-xs',
              isUser && 'justify-end',
            )}
          >
            <time dateTime={message.createdAt} title={formatClockTime(message.createdAt)}>
              {formatClockTime(message.createdAt)}
            </time>

            {message.inputMode === 'voice' ? <Badge variant="outline">Voice</Badge> : null}

            {message.latencyMs !== null ? (
              <span title="Provider latency">{(message.latencyMs / 1000).toFixed(1)}s</span>
            ) : null}

            {message.tokenCount > 0 ? (
              <span title="Completion tokens">{message.tokenCount} tokens</span>
            ) : null}
          </div>
        </div>

        {isUser ? (
          <span
            className="bg-secondary text-secondary-foreground mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            aria-hidden="true"
          >
            <User className="h-4 w-4" />
          </span>
        ) : null}
      </article>
    </>
  );
}

/** The echoed user turn, shaped like a `MessageDto` so one renderer serves both. */
function syntheticUserMessage(turn: StreamingTurn): MessageDto {
  return {
    id: `pending-user-${turn.clientMessageId}`,
    conversationId: '',
    role: 'user',
    content: turn.userContent,
    inputMode: 'text',
    sequence: Number.MAX_SAFE_INTEGER - 1,
    confidence: null,
    tokenCount: 0,
    model: null,
    providerId: null,
    latencyMs: null,
    createdAt: turn.startedAt,
    updatedAt: turn.startedAt,
  };
}

function syntheticAssistantMessage(turn: StreamingTurn): MessageDto {
  return {
    id: `pending-assistant-${turn.clientMessageId}`,
    conversationId: '',
    role: 'assistant',
    content: turn.assistantContent,
    inputMode: 'text',
    sequence: Number.MAX_SAFE_INTEGER,
    confidence: null,
    tokenCount: 0,
    model: turn.model,
    providerId: null,
    latencyMs: null,
    createdAt: turn.startedAt,
    updatedAt: turn.startedAt,
  };
}
