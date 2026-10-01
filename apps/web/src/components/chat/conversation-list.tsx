import { Loader2, MessageSquare, Pin, PinOff } from 'lucide-react';
import type { ConversationDto } from '@voiceflow/shared';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRelativeTime, toPreview } from '@/features/chat/chat-format';
import { cn } from '@/lib/utils';

export interface ConversationListProps {
  readonly conversations: readonly ConversationDto[];
  readonly activeId?: string;
  readonly isLoading?: boolean;
  readonly hasMore?: boolean;
  readonly isLoadingMore?: boolean;
  readonly onLoadMore?: () => void;
  readonly onSelect: (conversation: ConversationDto) => void;
  readonly onTogglePin?: (conversation: ConversationDto) => void;
}

/**
 * The thread list.
 *
 * Pinned rows first because the server sorts them that way, so the visual order
 * matches the sort order — reordering here would make the list jump between
 * pages and lose the user's scroll position.
 */
export function ConversationList({
  conversations,
  activeId,
  isLoading = false,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  onSelect,
  onTogglePin,
}: ConversationListProps) {
  if (isLoading && conversations.length === 0) {
    return (
      <div className="space-y-2 p-2">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center gap-2 px-4 py-8 text-center text-sm">
        <MessageSquare className="h-5 w-5" aria-hidden="true" />
        <p>No conversations yet.</p>
      </div>
    );
  }

  return (
    <div>
      <ul className="space-y-0.5">
        {conversations.map((conversation) => {
          const isActive = conversation.id === activeId;

          return (
            <li key={conversation.id}>
              <div
                className={cn(
                  'group flex items-center gap-1 rounded-lg pr-1 transition-colors',
                  isActive ? 'bg-sidebar-accent' : 'hover:bg-sidebar-accent/60',
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(conversation)}
                  aria-current={isActive ? 'page' : undefined}
                  className="min-w-0 flex-1 px-3 py-2 text-left"
                >
                  <span className="flex items-center gap-1.5">
                    {conversation.isPinned ? (
                      <Pin className="text-muted-foreground h-3 w-3 shrink-0" aria-hidden="true" />
                    ) : null}
                    <span className="truncate text-sm font-medium">{conversation.title}</span>
                  </span>

                  <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                    {conversation.lastMessagePreview
                      ? toPreview(conversation.lastMessagePreview, 60)
                      : 'No messages yet'}
                  </span>

                  <span className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
                    <span>
                      {formatRelativeTime(conversation.lastMessageAt ?? conversation.updatedAt)}
                    </span>
                    {conversation.messageCount > 0 ? (
                      <span>{conversation.messageCount} messages</span>
                    ) : null}
                    {conversation.status !== 'active' ? (
                      <span className="capitalize">{conversation.status}</span>
                    ) : null}
                  </span>
                </button>

                {onTogglePin ? (
                  <button
                    type="button"
                    onClick={() => onTogglePin(conversation)}
                    className="text-muted-foreground hover:text-foreground rounded-md p-1.5 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                    aria-label={conversation.isPinned ? 'Unpin conversation' : 'Pin conversation'}
                  >
                    {conversation.isPinned ? (
                      <PinOff className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <Pin className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {hasMore ? (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={isLoadingMore}
          className="text-muted-foreground hover:text-foreground mt-2 flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-xs disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
          Load more
        </button>
      ) : null}
    </div>
  );
}
