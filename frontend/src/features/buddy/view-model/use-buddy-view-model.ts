"use client";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { getBuddyService } from "@/services/buddy/buddy-service.factory";
import type { BuddyConversation, BuddyMessage, BuddyPagination } from "../model/buddy.model";

interface BuddyState {
  accessStatus: "loading" | "allowed" | "blocked";
  conversations: BuddyConversation[];
  activeConversationId: string | null;
  messages: BuddyMessage[];
  pagination: BuddyPagination;
  isLoadingList: boolean;
  isLoadingMessages: boolean;
  isSending: boolean;
  error: string | null;
}

type BuddyAction =
  | { type: "SET_ACCESS_STATUS"; status: "allowed" | "blocked" }
  | { type: "LOAD_CONVERSATIONS_START" }
  | { type: "LOAD_CONVERSATIONS_SUCCESS"; conversations: BuddyConversation[]; pagination: BuddyPagination }
  | { type: "LOAD_MESSAGES_START" }
  | { type: "LOAD_MESSAGES_SUCCESS"; messages: BuddyMessage[] }
  | { type: "SET_ACTIVE_CONVERSATION"; id: string }
  | { type: "SEND_START"; optimistic: BuddyMessage }
  | { type: "SEND_SUCCESS"; message: BuddyMessage }
  | { type: "SEND_ERROR"; optimisticId: string; error: string }
  | { type: "SET_ERROR"; error: string };

const initialState: BuddyState = {
  accessStatus: "loading",
  conversations: [],
  activeConversationId: null,
  messages: [],
  pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
  isLoadingList: true,
  isLoadingMessages: false,
  isSending: false,
  error: null,
};

function reducer(state: BuddyState, action: BuddyAction): BuddyState {
  switch (action.type) {
    case "SET_ACCESS_STATUS": return { ...state, accessStatus: action.status };
    case "LOAD_CONVERSATIONS_START": return { ...state, isLoadingList: true, error: null };
    case "LOAD_CONVERSATIONS_SUCCESS": return { ...state, conversations: action.conversations, pagination: action.pagination, isLoadingList: false };
    case "LOAD_MESSAGES_START": return { ...state, isLoadingMessages: true, error: null };
    case "LOAD_MESSAGES_SUCCESS": return { ...state, messages: action.messages, isLoadingMessages: false };
    case "SET_ACTIVE_CONVERSATION": return { ...state, activeConversationId: action.id };
    case "SEND_START": return { ...state, isSending: true, error: null, messages: [...state.messages, action.optimistic] };
    case "SEND_SUCCESS": return { ...state, messages: [...state.messages, action.message], isSending: false };
    case "SEND_ERROR": return { ...state, isSending: false, error: action.error, messages: state.messages.filter((message) => message.id !== action.optimisticId) };
    case "SET_ERROR": return { ...state, error: action.error };
    default: return state;
  }
}

export function useBuddyViewModel() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const service = getBuddyService();
  const abortRef = useRef<AbortController | null>(null);

const selectConversation = useCallback(async (id: string) => {
    dispatch({ type: "SET_ACTIVE_CONVERSATION", id });
    dispatch({ type: "LOAD_MESSAGES_START" });
    const result = await service.getConversation(id);
    if (result.success) dispatch({ type: "LOAD_MESSAGES_SUCCESS", messages: result.data.messages });
    else dispatch({ type: "SET_ERROR", error: result.error.message });
  }, [service]);

  const loadConversations = useCallback(async (page = 1) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    dispatch({ type: "LOAD_CONVERSATIONS_START" });
    const result = await service.listConversations(page, 20, abortRef.current.signal);
    if (result.success) {
      dispatch({ type: "LOAD_CONVERSATIONS_SUCCESS", conversations: result.data.conversations, pagination: result.data.pagination });
      if (!state.activeConversationId && result.data.conversations.length > 0) {
        void selectConversation(result.data.conversations[0].id);
      }
    } else {
      dispatch({ type: "SET_ERROR", error: result.error.message });
    }
  }, [service, state.activeConversationId, selectConversation]);

  const sendMessage = useCallback(async (conversationId: string, content: string) => {
    const optimistic: BuddyMessage = {
      id: `pending-${Date.now()}`,
      conversationId,
      role: "user",
      content,
      timestamp: "Now",
    };
    dispatch({ type: "SEND_START", optimistic });
    const result = await service.sendMessage({ conversationId, content });
    if (result.success) {
      dispatch({ type: "SEND_SUCCESS", message: result.data });
    } else {
      dispatch({ type: "SEND_ERROR", optimisticId: optimistic.id, error: result.error.message });
    }
  }, [service]);

  useEffect(() => {
    let active = true;
    void service.getAccessStatus().then((result) => {
      if (!active) return;
      dispatch({ type: "SET_ACCESS_STATUS", status: result.success && result.data.canAccessAi ? "allowed" : "blocked" });
    });
    return () => { active = false; };
  }, [service]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  return {
    ...state,
    loadConversations,
    selectConversation,
    sendMessage,
  };
}
