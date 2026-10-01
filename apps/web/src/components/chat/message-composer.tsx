import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Loader2, SendHorizonal, Square } from 'lucide-react';
import { LIMITS } from '@voiceflow/shared';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface MessageComposerProps {
  readonly onSend: (content: string) => void | Promise<void>;
  readonly onStop?: () => void;
  readonly isStreaming?: boolean;
  readonly disabled?: boolean;
  readonly placeholder?: string;
}

/**
 * The composer.
 *
 * Enter sends and Shift+Enter inserts a newline, the convention every chat
 * client shares. The send button stays disabled until the box holds real
 * content, so a stray Enter cannot submit an empty turn the server would
 * reject — and the client mirrors the server's length limit so the limit is
 * visible before it is hit.
 */
export function MessageComposer({
  onSend,
  onStop,
  isStreaming = false,
  disabled = false,
  placeholder = 'Ask the assistant anything…',
}: MessageComposerProps) {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const trimmed = content.trim();
  const isTooLong = content.length > LIMITS.MESSAGE_MAX_LENGTH;
  const canSend = !disabled && !isStreaming && trimmed.length > 0 && !isTooLong;
  const isOverLimit = isTooLong || content.length > LIMITS.MESSAGE_MAX_LENGTH * 0.95;

  // Focus returns to the box after a turn completes so the next message can be
  // typed without reaching for the mouse.
  useEffect(() => {
    if (!isStreaming) textareaRef.current?.focus();
  }, [isStreaming]);

  const submit = async () => {
    if (!canSend) return;

    const value = trimmed;
    // Cleared before the await so the box is ready for the next message.
    setContent('');
    await onSend(value);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;

    event.preventDefault();
    void submit();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div
        className={cn(
          'border-input bg-background focus-within:ring-ring flex items-end gap-2 rounded-xl border p-2 shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-offset-2',
          isOverLimit && 'border-destructive focus-within:ring-destructive',
        )}
      >
        <label htmlFor="composer" className="sr-only">
          Message
        </label>
        <Textarea
          id="composer"
          ref={textareaRef}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'This conversation is read-only' : placeholder}
          disabled={disabled}
          rows={1}
          maxLength={LIMITS.MESSAGE_MAX_LENGTH + 1}
          className="max-h-40 min-h-[2.5rem] resize-none border-0 bg-transparent px-2 py-1.5 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />

        {isStreaming && onStop ? (
          <Button type="button" variant="outline" size="icon" onClick={onStop}>
            <Square aria-hidden="true" />
            <span className="sr-only">Stop generating</span>
          </Button>
        ) : (
          <Button type="submit" size="icon" disabled={!canSend}>
            {isStreaming ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <SendHorizonal aria-hidden="true" />
            )}
            <span className="sr-only">Send message</span>
          </Button>
        )}
      </div>

      <div className="text-muted-foreground flex items-center justify-between px-1 text-xs">
        <span>
          <kbd className="rounded border px-1">Enter</kbd> to send ·{' '}
          <kbd className="rounded border px-1">Shift</kbd>+
          <kbd className="rounded border px-1">Enter</kbd> for a new line
        </span>

        <span
          className={cn('tabular-nums', isOverLimit && 'text-destructive font-medium')}
          aria-live="polite"
        >
          {content.length > 0 ? `${content.length}/${LIMITS.MESSAGE_MAX_LENGTH}` : ''}
        </span>
      </div>
    </form>
  );
}
