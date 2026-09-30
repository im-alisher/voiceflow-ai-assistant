import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UiState {
  /** Whether the mobile navigation drawer is open. */
  isSidebarOpen: boolean;
  /** Whether the conversation list is expanded in the sidebar. */
  isConversationListOpen: boolean;
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
  toggleConversationList: () => void;
}

/**
 * Ephemeral presentation state.
 *
 * Only the conversation-list expansion is persisted: the drawer is a transient
 * overlay and must never re-open by itself on a phone after a reload.
 */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      isSidebarOpen: false,
      isConversationListOpen: true,
      openSidebar: () => set({ isSidebarOpen: true }),
      closeSidebar: () => set({ isSidebarOpen: false }),
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      toggleConversationList: () =>
        set((state) => ({ isConversationListOpen: !state.isConversationListOpen })),
    }),
    {
      name: 'voiceflow.ui',
      partialize: (state) => ({ isConversationListOpen: state.isConversationListOpen }),
    },
  ),
);
