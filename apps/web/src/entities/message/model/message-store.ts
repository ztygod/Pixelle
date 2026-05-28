import {create} from "zustand";
import type {Message} from "@/entities/message/model/types";

interface MessageState {
  messagesById: Record<string, Message>;
  appendAssistantDelta: (messageId: string, delta: string) => void;
  upsertMessage: (message: Message) => void;
}

export const useMessageStore = create<MessageState>((set) => ({
  messagesById: {},
  appendAssistantDelta: (messageId, delta) =>
    set((state) => {
      const current = state.messagesById[messageId];
      if (!current) {
        return state;
      }

      return {
        messagesById: {
          ...state.messagesById,
          [messageId]: {...current, content: `${current.content}${delta}`},
        },
      };
    }),
  upsertMessage: (message) =>
    set((state) => ({
      messagesById: {...state.messagesById, [String(message.id)]: message},
    })),
}));
