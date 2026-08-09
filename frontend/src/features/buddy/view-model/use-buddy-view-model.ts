"use client";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { getBuddyService } from "../services/buddy-service.factory";
import type { BuddyConversation, BuddyMessage, BuddyMood, BuddyPagination } from "../model/buddy.model";

interface BuddyState {
  accessStatus: "loading" | "allowed" | "blocked";
  conversations: BuddyConversation[];
  activeConversationId: string | null;
  messages: BuddyMessage[];
  pagination: BuddyPagination;
  isLoadingList: boolean;
  isLoadingMessages: boolean;
  isSending: boolean;
  isStreaming: boolean;
  streamingContent: string;
  error: string | null;
  searchQuery: string;
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
  | { type: "SET_STREAMING"; content: string }
  | { type: "STOP_STREAMING" }
  | { type: "SET_ERROR"; error: string }
  | { type: "SET_SEARCH"; query: string }
  | { type: "ADD_CONVERSATION"; conversation: BuddyConversation }
  | { type: "UPDATE_CONVERSATION"; conversation: BuddyConversation }
  | { type: "REMOVE_CONVERSATION"; id: string }
  | { type: "SET_FEEDBACK"; messageId: string; feedback: "positive" | "negative" };

const initialState: BuddyState = {
  accessStatus: "loading",
  conversations: [],
  activeConversationId: null,
  messages: [],
  pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
  isLoadingList: true,
  isLoadingMessages: false,
  isSending: false,
  isStreaming: false,
  streamingContent: "",
  error: null,
  searchQuery: "",
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
    case "SET_STREAMING": return { ...state, streamingContent: action.content, isStreaming: true };
    case "STOP_STREAMING": return { ...state, isStreaming: false, streamingContent: "" };
    case "SET_ERROR": return { ...state, error: action.error };
    case "SET_SEARCH": return { ...state, searchQuery: action.query };
    case "ADD_CONVERSATION": return { ...state, conversations: [action.conversation, ...state.conversations] };
    case "UPDATE_CONVERSATION": return { ...state, conversations: state.conversations.map((c) => c.id === action.conversation.id ? action.conversation : c) };
    case "REMOVE_CONVERSATION": return { ...state, conversations: state.conversations.filter((c) => c.id !== action.id), activeConversationId: state.activeConversationId === action.id ? null : state.activeConversationId };
    case "SET_FEEDBACK": return { ...state, messages: state.messages.map((m) => m.id === action.messageId ? { ...m, feedback: action.feedback } : m) };
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
    dispatch({ type: "SET_STREAMING", content: "" });
    const result = await service.sendMessage({ conversationId, content });
    if (result.success) {
      dispatch({ type: "SEND_SUCCESS", message: result.data });
      dispatch({ type: "STOP_STREAMING" });
    } else {
      dispatch({ type: "SEND_ERROR", optimisticId: optimistic.id, error: result.error.message });
      dispatch({ type: "STOP_STREAMING" });
    }
  }, [service]);

const createConversation = useCallback(async (title: string, mood?: BuddyMood) => {
    const result = await service.createConversation({ title, initialMood: mood });
    if (result.success) {
      dispatch({ type: "ADD_CONVERSATION", conversation: result.data });
      return result.data.id;
    }
    dispatch({ type: "SET_ERROR", error: result.error.message });
    return null;
  }, [service]);

  const renameConversation = useCallback(async (id: string, title: string) => {
    const result = await service.renameConversation(id, title);
    if (result.success) dispatch({ type: "UPDATE_CONVERSATION", conversation: result.data });
    else dispatch({ type: "SET_ERROR", error: result.error.message });
  }, [service]);

  const deleteConversation = useCallback(async (id: string) => {
    const result = await service.deleteConversation(id);
    if (result.success) dispatch({ type: "REMOVE_CONVERSATION", id });
    else dispatch({ type: "SET_ERROR", error: result.error.message });
  }, [service]);

const retryMessage = useCallback(async (conversationId: string) => {
    const lastUserMsg = [...state.messages].reverse().find((m) => m.role === "user" && !m.id.startsWith("pending-"));
    if (!lastUserMsg) return;
    const optimistic: BuddyMessage = {
      id: `pending-${Date.now()}`,
      conversationId,
      role: "user",
      content: lastUserMsg.content,
      timestamp: "Now",
    };
    dispatch({ type: "SEND_START", optimistic });
    const result = await service.retryMessage(conversationId, lastUserMsg.id);
    if (result.success) { dispatch({ type: "SEND_SUCCESS", message: result.data }); }
    else dispatch({ type: "SEND_ERROR", optimisticId: optimistic.id, error: result.error.message });
  }, [service, state.messages]);

  const sendFeedback = useCallback(async (messageId: string, feedback: "positive" | "negative") => {
    dispatch({ type: "SET_FEEDBACK", messageId, feedback });
    await service.sendFeedback(messageId, feedback);
  }, [service]);

  const searchConversations = useCallback(async (query: string) => {
    dispatch({ type: "SET_SEARCH", query });
    if (!query.trim()) { loadConversations(1); return; }
    const result = await service.searchConversations(query);
    if (result.success) dispatch({ type: "LOAD_CONVERSATIONS_SUCCESS", conversations: result.data, pagination: { page: 1, pageSize: 20, totalItems: result.data.length, totalPages: 1 } });
  }, [service, loadConversations]);

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
    createConversation,
    renameConversation,
    deleteConversation,
    retryMessage,
    sendFeedback,
    searchConversations,
  };
}
