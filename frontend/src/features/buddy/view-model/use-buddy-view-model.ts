"use client";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { getBuddyService } from "@/services/buddy/buddy-service.factory";
import type { BuddyConversation, BuddyMessage, BuddyPagination } from "../model/buddy.model";

interface BuddyState {
  historyEnabled: boolean;
  accessStatus: "loading" | "allowed" | "verification" | "trusted_contact" | "error";
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
  | { type: "SET_ACCESS_STATUS"; status: BuddyState["accessStatus"]; historyEnabled?: boolean; error?: string }
  | { type: "LOAD_CONVERSATIONS_START" }
  | { type: "LOAD_CONVERSATIONS_SUCCESS"; conversations: BuddyConversation[]; pagination: BuddyPagination }
  | { type: "LOAD_CONVERSATIONS_ERROR"; error: string }
  | { type: "LOAD_MESSAGES_START" }
  | { type: "LOAD_MESSAGES_SUCCESS"; messages: BuddyMessage[] }
  | { type: "LOAD_MESSAGES_ERROR"; error: string }
  | { type: "SET_ACTIVE_CONVERSATION"; id: string }
  | { type: "NEW_TEMPORARY_CONVERSATION" }
  | { type: "SEND_START"; optimistic: BuddyMessage }
  | { type: "SEND_SUCCESS"; optimisticId: string; messages: BuddyMessage[] }
  | { type: "SEND_ERROR"; optimisticId: string; error: string }
  | { type: "SET_STREAMING"; content: string }
  | { type: "STOP_STREAMING" }
  | { type: "SET_ERROR"; error: string }
  | { type: "SET_SEARCH"; query: string }
  | { type: "ADD_CONVERSATION"; conversation: BuddyConversation }
  | { type: "UPDATE_CONVERSATION"; conversation: BuddyConversation }
  | { type: "PIN_CONVERSATION"; id: string; pinnedAt: string | null }
  | { type: "REMOVE_CONVERSATION"; id: string }
  | { type: "SET_FEEDBACK"; messageId: string; feedback: "positive" | "negative" };

const initialState: BuddyState = {
  historyEnabled: true,
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
    case "SET_ACCESS_STATUS": return { ...state, accessStatus: action.status, historyEnabled: action.historyEnabled ?? state.historyEnabled, error: action.error ?? null };
    case "LOAD_CONVERSATIONS_START": return { ...state, isLoadingList: true, error: null };
    case "LOAD_CONVERSATIONS_SUCCESS": return { ...state, conversations: action.conversations, pagination: action.pagination, isLoadingList: false };
    case "LOAD_CONVERSATIONS_ERROR": return { ...state, isLoadingList: false, error: action.error };
    case "LOAD_MESSAGES_START": return { ...state, isLoadingMessages: true, messages: [], error: null };
    case "LOAD_MESSAGES_SUCCESS": return { ...state, messages: action.messages, isLoadingMessages: false };
    case "LOAD_MESSAGES_ERROR": return { ...state, isLoadingMessages: false, error: action.error };
    case "SET_ACTIVE_CONVERSATION": return { ...state, activeConversationId: action.id };
    case "NEW_TEMPORARY_CONVERSATION": return { ...state, activeConversationId: null, messages: [], error: null };
    case "SEND_START": return { ...state, isSending: true, error: null, messages: [...state.messages, action.optimistic] };
    case "SEND_SUCCESS": return { ...state, messages: [...state.messages.filter((message) => message.id !== action.optimisticId), ...action.messages], isSending: false };
    case "SEND_ERROR": return { ...state, isSending: false, error: action.error, messages: state.messages.filter((message) => message.id !== action.optimisticId) };
    case "SET_STREAMING": return { ...state, streamingContent: action.content, isStreaming: true };
    case "STOP_STREAMING": return { ...state, isStreaming: false, streamingContent: "" };
    case "SET_ERROR": return { ...state, error: action.error };
    case "SET_SEARCH": return { ...state, searchQuery: action.query };
    case "ADD_CONVERSATION": return { ...state, conversations: [action.conversation, ...state.conversations] };
    case "UPDATE_CONVERSATION": return { ...state, conversations: state.conversations.map((c) => c.id === action.conversation.id ? action.conversation : c) };
    case "PIN_CONVERSATION": return { ...state, conversations: state.conversations.map((c) => c.id === action.id ? { ...c, pinnedAt: action.pinnedAt } : c) };
    case "REMOVE_CONVERSATION": return { ...state, conversations: state.conversations.filter((c) => c.id !== action.id), activeConversationId: state.activeConversationId === action.id ? null : state.activeConversationId };
    case "SET_FEEDBACK": return { ...state, messages: state.messages.map((m) => m.id === action.messageId ? { ...m, feedback: action.feedback } : m) };
    default: return state;
  }
}

export function useBuddyViewModel() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const service = getBuddyService();
  const abortRef = useRef<AbortController | null>(null);
  const activeConversationIdRef = useRef<string | null>(null);
  const searchQueryRef = useRef("");

const selectConversation = useCallback(async (id: string) => {
    activeConversationIdRef.current = id;
    dispatch({ type: "SET_ACTIVE_CONVERSATION", id });
    dispatch({ type: "LOAD_MESSAGES_START" });
    const result = await service.getConversation(id);
    if (activeConversationIdRef.current !== id) return;
    if (result.success) dispatch({ type: "LOAD_MESSAGES_SUCCESS", messages: result.data.messages });
    else dispatch({ type: "LOAD_MESSAGES_ERROR", error: result.error.message });
  }, [service]);

  const loadConversations = useCallback(async (page = 1) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    dispatch({ type: "LOAD_CONVERSATIONS_START" });
    const result = await service.listConversations(page, 20, controller.signal, searchQueryRef.current);
    if (controller.signal.aborted) return;
    if (result.success) {
      dispatch({ type: "LOAD_CONVERSATIONS_SUCCESS", conversations: result.data.conversations, pagination: result.data.pagination });
    } else {
      dispatch({ type: "LOAD_CONVERSATIONS_ERROR", error: result.error.message });
    }
  }, [service]);

  const createConversation = useCallback(async () => {
    activeConversationIdRef.current = null;
    dispatch({ type: "NEW_TEMPORARY_CONVERSATION" });
    if (!state.historyEnabled) {
      return null;
    }
    const result = await service.createConversation();
    if (result.success) {
      activeConversationIdRef.current = result.data.id;
      dispatch({ type: "ADD_CONVERSATION", conversation: result.data });
      dispatch({ type: "SET_ACTIVE_CONVERSATION", id: result.data.id });
      dispatch({ type: "LOAD_MESSAGES_SUCCESS", messages: [] });
      return result.data.id;
    }
    dispatch({ type: "SET_ERROR", error: result.error.message });
    return null;
  }, [service, state.historyEnabled]);

  const clearConversation = useCallback(() => {
    activeConversationIdRef.current = null;
    dispatch({ type: "NEW_TEMPORARY_CONVERSATION" });
  }, []);

  const sendMessage = useCallback(async (conversationId: string | null, content: string) => {
    let targetId = conversationId;
    if (state.historyEnabled && !targetId) {
      const created = await service.createConversation();
      if (!created.success) {
        dispatch({ type: "SET_ERROR", error: created.error.message });
        return false;
      }
      targetId = created.data.id;
      activeConversationIdRef.current = targetId;
      dispatch({ type: "ADD_CONVERSATION", conversation: created.data });
      dispatch({ type: "SET_ACTIVE_CONVERSATION", id: targetId });
    }
    const optimistic: BuddyMessage = {
      id: `pending-${Date.now()}`,
      conversationId: targetId ?? "temporary",
      role: "user",
      content,
      timestamp: "Now",
    };
    dispatch({ type: "SEND_START", optimistic });
    dispatch({ type: "SET_STREAMING", content: "" });
    const result = await service.sendMessage({ ...(targetId ? { conversationId: targetId } : {}), content });
    if (result.success) {
      dispatch({ type: "SEND_SUCCESS", optimisticId: optimistic.id, messages: result.data.messages });
      dispatch({ type: "STOP_STREAMING" });
      void loadConversations();
      return true;
    } else {
      dispatch({ type: "SEND_ERROR", optimisticId: optimistic.id, error: result.error.message });
      dispatch({ type: "STOP_STREAMING" });
      return false;
    }
  }, [service, state.historyEnabled, loadConversations]);

  const renameConversation = useCallback(async (id: string, title: string) => {
    const result = await service.renameConversation(id, title);
    if (result.success) { dispatch({ type: "UPDATE_CONVERSATION", conversation: result.data }); void loadConversations(state.pagination.page); return true; }
    dispatch({ type: "SET_ERROR", error: result.error.message });
    return false;
  }, [service, loadConversations, state.pagination.page]);

  const pinConversation = useCallback(async (id: string, pinned: boolean) => {
    const result = await service.pinConversation(id, pinned);
    if (result.success) { dispatch({ type: "PIN_CONVERSATION", id, pinnedAt: result.data }); void loadConversations(state.pagination.page); }
    else dispatch({ type: "SET_ERROR", error: result.error.message });
  }, [service, loadConversations, state.pagination.page]);

  const deleteConversation = useCallback(async (id: string) => {
    const result = await service.deleteConversation(id);
    if (result.success) {
      dispatch({ type: "REMOVE_CONVERSATION", id });
      const page = state.conversations.length === 1 ? Math.max(1, state.pagination.page - 1) : state.pagination.page;
      void loadConversations(page);
      return true;
    }
    dispatch({ type: "SET_ERROR", error: result.error.message });
    return false;
  }, [service, loadConversations, state.conversations.length, state.pagination.page]);

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
    if (result.success) { dispatch({ type: "SEND_SUCCESS", optimisticId: optimistic.id, messages: [result.data] }); }
    else dispatch({ type: "SEND_ERROR", optimisticId: optimistic.id, error: result.error.message });
  }, [service, state.messages]);

  const sendFeedback = useCallback(async (messageId: string, feedback: "positive" | "negative") => {
    dispatch({ type: "SET_FEEDBACK", messageId, feedback });
    await service.sendFeedback(messageId, feedback);
  }, [service]);

  const searchConversations = useCallback(async (query: string) => {
    dispatch({ type: "SET_SEARCH", query });
    searchQueryRef.current = query.trim();
    await loadConversations(1);
  }, [loadConversations]);

  useEffect(() => {
    let active = true;
    void service.getAccessStatus().then((result) => {
      if (!active) return;
      dispatch(result.success
        ? { type: "SET_ACCESS_STATUS", status: result.data.canAccessAi ? "allowed" : result.data.accessRequirement === "trusted_contact" ? "trusted_contact" : "verification", historyEnabled: result.data.buddyHistoryEnabled ?? true }
        : { type: "SET_ACCESS_STATUS", status: "error", error: result.error.message });
    });
    return () => { active = false; };
  }, [service]);

  useEffect(() => { if (state.accessStatus === "allowed") void loadConversations(); }, [state.accessStatus, loadConversations]);

  return {
    ...state,
    loadConversations,
    selectConversation,
    sendMessage,
    createConversation,
    clearConversation,
    renameConversation,
    pinConversation,
    deleteConversation,
    retryMessage,
    sendFeedback,
    searchConversations,
  };
}
