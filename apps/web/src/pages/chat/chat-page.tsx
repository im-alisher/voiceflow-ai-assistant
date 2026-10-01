import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArchiveRestore, MessageSquarePlus } from 'lucide-react';
import { toast } from 'sonner';
import type { ConversationDto } from '@voiceflow/shared';
import { ConversationList } from '@/components/chat/conversation-list';
import { MessageComposer } from '@/components/chat/message-composer';
import { MessageList } from '@/components/chat/message-list';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/dashboard/stat-card';
import { Badge } from '@/components/ui/badge';
import {
  useConversation,
  useConversationRows,
  useConversations,
  useCreateConversation,
  useMessages,
  useRestoreConversation,
  useSendMessage,
  useUpdateConversation,
} from '@/features/chat/use-conversations';
import { ROUTES } from '@/routes/paths';

/**
 * Conversation surface.
 *
 * The URL is the source of truth for which thread is open, so a reload or a
 * shared link lands on the same conversation. A visit to `/chat` with no
 * conversations opens the newest one rather than an empty panel, and creating a
 * thread is a single action from anywhere in the app.
 */
export default function ChatPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();

  const conversations = useConversations();
  const conversation = useConversation(conversationId);
  const { messages, fetchNextPage, hasNextPage, isFetchingNextPage } = useMessages(conversationId);
  const createConversation = useCreateConversation();
  const updateConversation = useUpdateConversation(conversationId ?? '');
  const restoreConversation = useRestoreConversation();

  const { turn, error, isStreaming, send, stop, reset } = useSendMessage(conversationId);

  const scrollRef = useRef<HTMLDivElement>(null);
  // Only follow new content while the reader is already at the bottom, so
  // scrolling back through history is not yanked away by an incoming delta.
  const isPinnedToBottom = useRef(true);

  const rows = useConversationRows(conversations);
  const activeConversation = conversation.data;

  const handleScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;

    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    isPinnedToBottom.current = distanceFromBottom < 80;
  }, []);

  // Runs before paint so the new message appears in the same frame as the
  // delta, which avoids a visible jump when tokens arrive quickly.
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (element && isPinnedToBottom.current) element.scrollTop = element.scrollHeight;
  }, [messages.length, turn?.assistantContent]);

  // A fresh conversation means the previous turn's leftovers must not linger.
  useEffect(() => {
    reset();
  }, [conversationId, reset]);

  // `/chat` on its own has nothing to render, so open the newest thread.
  useEffect(() => {
    const newest = rows[0];
    if (conversationId || !newest) return;

    navigate(ROUTES.conversation(newest.id), { replace: true });
  }, [conversationId, rows, navigate]);

  const startConversation = useCallback(async () => {
    const created = await createConversation.mutateAsync({});
    navigate(ROUTES.conversation(created.id));
  }, [createConversation, navigate]);

  const handleSend = useCallback(
    async (content: string) => {
      isPinnedToBottom.current = true;

      const result = await send({ content, inputMode: 'text' });
      if (result.error) {
        toast.error('Message failed', { description: result.error });
        return;
      }

      reset();
    },
    [send, reset],
  );

  const handleTogglePin = useCallback(
    (target: ConversationDto) => {
      updateConversation.mutate({ isPinned: !target.isPinned });
    },
    [updateConversation],
  );

  const isArchived = activeConversation?.status === 'archived';
  const isDeleted = activeConversation?.status === 'deleted';

  return (
    <div className="flex min-h-0 flex-1 lg:grid lg:grid-cols-[18rem_1fr]">
      <aside
        className="border-border hidden min-h-0 flex-col border-r lg:flex"
        aria-label="Conversations"
      >
        <div className="border-border shrink-0 border-b p-3">
          <Button
            className="w-full justify-start"
            onClick={() => void startConversation()}
            disabled={createConversation.isPending}
          >
            <MessageSquarePlus aria-hidden="true" />
            New conversation
          </Button>
        </div>

        <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto p-2">
          <ConversationList
            conversations={rows}
            activeId={conversationId}
            isLoading={conversations.isLoading}
            hasMore={conversations.hasNextPage}
            isLoadingMore={conversations.isFetchingNextPage}
            onLoadMore={() => void conversations.fetchNextPage()}
            onSelect={(target) => navigate(ROUTES.conversation(target.id))}
            onTogglePin={handleTogglePin}
          />
        </div>
      </aside>

      <section className="flex min-h-0 flex-1 flex-col">
        {!conversationId ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <EmptyState
              icon={<MessageSquarePlus className="h-6 w-6" />}
              title="Pick a conversation"
              description="Choose a thread from the list, or start a new one to get started."
              action={<Button onClick={() => void startConversation()}>New conversation</Button>}
            />
          </div>
        ) : isDeleted ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <EmptyState
              icon={<AlertTriangle className="h-6 w-6" />}
              title="This conversation was deleted"
              description="Its messages are no longer available."
              action={<Button onClick={() => navigate(ROUTES.chat)}>Back to conversations</Button>}
            />
          </div>
        ) : (
          <>
            <header className="border-border flex shrink-0 items-center gap-3 border-b px-4 py-3">
              <div className="min-w-0 flex-1">
                <h1 className="truncate font-semibold">
                  {activeConversation?.title ?? 'Conversation'}
                </h1>
                {activeConversation ? (
                  <p className="text-muted-foreground truncate text-xs">
                    {activeConversation.model} · {activeConversation.providerId}
                  </p>
                ) : null}
              </div>

              {activeConversation ? (
                <Badge variant={isArchived ? 'warning' : 'secondary'}>
                  {activeConversation.status}
                </Badge>
              ) : null}

              {isArchived ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => restoreConversation.mutate(conversationId)}
                  disabled={restoreConversation.isPending}
                >
                  <ArchiveRestore aria-hidden="true" />
                  Restore
                </Button>
              ) : null}
            </header>

            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="scrollbar-slim min-h-0 flex-1 overflow-y-auto px-4 py-6"
            >
              {messages.length === 0 && !turn ? (
                <EmptyState
                  icon={<MessageSquarePlus className="h-6 w-6" />}
                  title="No messages yet"
                  description="Ask a question to start the thread. Replies stream in token by token."
                />
              ) : (
                <MessageList
                  messages={messages}
                  pending={turn}
                  isStreaming={isStreaming}
                  hasMoreHistory={hasNextPage}
                  isLoadingHistory={isFetchingNextPage}
                  onLoadHistory={() => void fetchNextPage()}
                />
              )}
            </div>

            {isArchived ? (
              <div className="border-border shrink-0 border-t p-4">
                <p className="text-muted-foreground text-sm">
                  This conversation is archived. Restore it to keep the thread going.
                </p>
              </div>
            ) : (
              <div className="border-border shrink-0 border-t p-4">
                <MessageComposer
                  onSend={handleSend}
                  onStop={stop}
                  isStreaming={isStreaming}
                  disabled={isDeleted || conversation.isLoading}
                />
                {error ? (
                  <p className="text-destructive mt-2 text-sm" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
