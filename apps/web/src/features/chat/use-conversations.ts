import { useCallback, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  API_ROUTES,
  LIMITS,
  type AgentStreamEvent,
  type ConversationDto,
  type ConversationStatus,
  type MessageDto,
  type Paginated,
  type TurnDto,
} from '@voiceflow/shared';
import {
  createConversationSchema,
  sendMessageSchema,
  updateConversationSchema,
  type SendMessageRequest,
} from '@voiceflow/shared';
import { FEATURE_FLAGS } from '@voiceflow/shared';
import { api } from '@/lib/api-client';
import { streamAgentEvents } from '@/lib/stream-client';

/** Query keys, namespaced so a mutation can invalidate exactly what it touched. */
export const conversationKeys = {
  all: ['conversations'] as const,
  list: (status?: ConversationStatus, search?: string) =>
    ['conversations', 'list', status ?? 'active', search ?? ''] as const,
  detail: (id: string) => ['conversations', 'detail', id] as const,
  messages: (id: string) => ['conversations', 'messages', id] as const,
};

/** Builds a query string, skipping empty values so keys stay stable. */
function toQueryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

/**
 * Sidebar listing.
 *
 * Paged with `useInfiniteQuery` so the list grows without a "load more" button;
 * `hasMore` comes from the server rather than from the page length, so the last
 * page is never mistaken for an empty result.
 */
export function useConversations(options?: { status?: ConversationStatus; search?: string }) {
  const status = options?.status ?? 'active';
  const search = options?.search?.trim() ?? '';

  return useInfiniteQuery({
    queryKey: conversationKeys.list(status, search),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.get<Paginated<ConversationDto>>(
        `${API_ROUTES.conversations.base}${toQueryString({
          status,
          search,
          limit: LIMITS.PAGE_SIZE_DEFAULT,
          cursor: pageParam,
        })}`,
      ),
    getNextPageParam: (lastPage) => lastPage.page.nextCursor ?? undefined,
  });
}

/** Flattens the pages into one list, newest page first. */
export function useConversationRows(query: ReturnType<typeof useConversations>) {
  return useMemo(() => (query.data?.pages ?? []).flatMap((page) => page.items), [query.data]);
}

export function useConversation(id: string | undefined) {
  return useQuery({
    queryKey: conversationKeys.detail(id ?? ''),
    queryFn: () => api.get<ConversationDto>(API_ROUTES.conversations.byId(id as string)),
    enabled: Boolean(id),
  });
}

/**
 * Transcript pages.
 *
 * The server returns the newest page first, ordered oldest-first *within* a
 * page, and each cursor walks further back in history. Rendering therefore
 * reverses the pages and flattens, and older pages are deduplicated because a
 * message arriving mid-scroll can appear on two pages.
 */
export function useMessages(conversationId: string | undefined) {
  const query = useInfiniteQuery({
    queryKey: conversationKeys.messages(conversationId ?? ''),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.get<Paginated<MessageDto>>(
        `${API_ROUTES.conversations.messages(conversationId as string)}${toQueryString({
          limit: LIMITS.RECENT_MESSAGE_PAGE_SIZE,
          order: 'desc',
          cursor: pageParam,
        })}`,
      ),
    getNextPageParam: (lastPage) => lastPage.page.nextCursor ?? undefined,
    enabled: Boolean(conversationId),
  });

  const messages = useMemo(() => {
    const seen = new Set<string>();
    return [...(query.data?.pages ?? [])]
      .reverse()
      .flatMap((page) => page.items)
      .filter((message) => {
        if (seen.has(message.id)) return false;
        seen.add(message.id);
        return true;
      })
      .sort((left, right) => left.sequence - right.sequence);
  }, [query.data]);

  return { ...query, messages };
}

export function useCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Partial<{ title: string }> = {}) =>
      api.post<ConversationDto>(
        API_ROUTES.conversations.base,
        createConversationSchema.parse(input),
      ),
    onSuccess: (conversation) => {
      // A new thread must appear at the top of the sidebar immediately.
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
      queryClient.setQueryData(conversationKeys.detail(conversation.id), conversation);
    },
  });
}

export function useUpdateConversation(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Parameters<typeof updateConversationSchema.parse>[0]) =>
      api.patch<ConversationDto>(
        API_ROUTES.conversations.byId(conversationId),
        updateConversationSchema.parse(input),
      ),
    onSuccess: (conversation) => {
      queryClient.setQueryData(conversationKeys.detail(conversationId), conversation);
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
    },
  });
}

export function useArchiveConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) =>
      api.post<ConversationDto>(API_ROUTES.conversations.archive(conversationId), {}),
    onSuccess: (_conversation, conversationId) => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
      queryClient.invalidateQueries({ queryKey: conversationKeys.detail(conversationId) });
    },
  });
}

export function useRestoreConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) =>
      api.post<ConversationDto>(API_ROUTES.conversations.restore(conversationId), {}),
    onSuccess: (conversation) => {
      queryClient.setQueryData(conversationKeys.detail(conversation.id), conversation);
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
    },
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) =>
      api.delete<ConversationDto>(API_ROUTES.conversations.byId(conversationId)),
    onSuccess: (conversation) => {
      queryClient.setQueryData(conversationKeys.detail(conversation.id), conversation);
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
    },
  });
}

export function useDeleteMessage(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageId: string) =>
      api.delete<{ remaining: number }>(
        API_ROUTES.conversations.message(conversationId, messageId),
      ),
    // Sequence numbers shift when a message is removed, so the transcript is
    // refetched rather than patched.
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: conversationKeys.messages(conversationId) }),
  });
}

/** The assistant turn as it is being streamed, before the server has a row for it. */
export interface StreamingTurn {
  readonly clientMessageId: string;
  readonly userMessageId: string | null;
  readonly assistantMessageId: string | null;
  readonly userContent: string;
  readonly assistantContent: string;
  readonly model: string | null;
  /** Fixed at send time so the echoed bubble's clock does not jump on re-render. */
  readonly startedAt: string;
}

export interface SendResult {
  /** The turn that was sent, or null once the server has taken it over. */
  readonly turn: StreamingTurn | null;
  readonly error: string | null;
}

/**
 * Sends a message and exposes the reply as it arrives.
 *
 * The composer needs incremental state rather than a mutation result, so this
 * hook owns the turn lifecycle: it echoes the user's message immediately, grows
 * the assistant bubble per delta, and hands back the server-assigned ids in the
 * terminal frame. The transcript query is invalidated afterwards, because the
 * ids, timestamps and token counts only exist server-side.
 *
 * `clientMessageId` is generated once per composed message, so a retry after a
 * dropped connection returns the original turn instead of duplicating it.
 */
export function useSendMessage(conversationId: string | undefined) {
  const queryClient = useQueryClient();
  const [turn, setTurn] = useState<StreamingTurn | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setTurn(null);
    setError(null);
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  /** Pulls the stored transcript and the sidebar back in line with the server. */
  const refreshTranscript = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: conversationKeys.messages(conversationId as string),
    });
    await queryClient.invalidateQueries({ queryKey: conversationKeys.all });
  }, [conversationId, queryClient]);

  const send = useCallback(
    async (input: Omit<SendMessageRequest, 'stream' | 'clientMessageId'>): Promise<SendResult> => {
      if (!conversationId) throw new Error('Cannot send without a conversation');

      const clientMessageId = crypto.randomUUID();
      const payload = sendMessageSchema.parse({ ...input, clientMessageId });

      // A superseded stream must not keep writing into the current turn.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const pending: StreamingTurn = {
        clientMessageId,
        userMessageId: null,
        assistantMessageId: null,
        userContent: payload.content,
        assistantContent: '',
        model: null,
        startedAt: new Date().toISOString(),
      };

      setError(null);
      setTurn(pending);
      setIsStreaming(true);

      const applyEvent = (event: AgentStreamEvent) => {
        setTurn((current) => {
          if (!current) return current;

          if (event.type === 'meta') return { ...current, model: event.model };
          if (event.type === 'delta') {
            return { ...current, assistantContent: current.assistantContent + event.delta };
          }
          if (event.type === 'turn') {
            return {
              ...current,
              userMessageId: event.userMessageId,
              assistantMessageId: event.assistantMessageId,
            };
          }
          return current;
        });

        if (event.type === 'error') setError(event.message);
      };

      try {
        if (FEATURE_FLAGS.streamingResponses) {
          await streamAgentEvents(API_ROUTES.conversations.messages(conversationId), {
            body: { ...payload, stream: true },
            signal: controller.signal,
            onEvent: applyEvent,
          });
        } else {
          // Buffered fallback: one request, the whole turn at once.
          const response = await api.post<TurnDto>(
            API_ROUTES.conversations.messages(conversationId),
            { ...payload, stream: false },
            { signal: controller.signal },
          );

          setTurn({
            ...pending,
            userMessageId: response.userMessage.id,
            assistantMessageId: response.assistantMessage.id,
            assistantContent: response.assistantMessage.content,
          });
        }

        // Ids, timestamps and token counts only exist once persisted. Awaiting
        // the refetch means the transcript holds the stored turn before the
        // local copy is dropped, so the reply never blinks out.
        await refreshTranscript();

        return { turn: null, error: null };
      } catch (caught) {
        if (controller.signal.aborted) {
          // A stopped stream still persists whatever arrived, so the transcript
          // has to be refreshed too — otherwise the partial reply stays hidden
          // until something else triggers a refetch.
          await refreshTranscript();
          return { turn: null, error: null };
        }
        const message = caught instanceof Error ? caught.message : 'Unable to send the message';
        setError(message);
        return { turn: null, error: message };
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [conversationId, refreshTranscript],
  );

  return { turn, error, isStreaming, send, stop, reset };
}
