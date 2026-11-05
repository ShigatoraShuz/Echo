"use client";
import { supabaseAuthTokenProvider } from "@/infrastructure/api/supabase-auth-token-provider";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { JournalPrivacyStatus, CreateJournalInput, JournalEntry, JournalDraft } from "../model/journal.model";
import { JOURNAL_AUTOSAVE_INTERVAL_MS } from "../model/journal.constants";
import { validateCreateJournalInput } from "../model/journal.schema";
import { getJournalService } from "@/services/journal/journal-service.factory";
import type { AnalysisFixture, FaceMeshCapture, JournalSubmissionResponse } from "@echo/contracts";
import { env } from "@/config/environment";

export type AutosaveStatus = "idle" | "unsaved" | "saving" | "saved" | "error";

interface EditorState {
  title: string;
  body: string;
  emotions: string[];
  tags: string[];
  privacyStatus: JournalPrivacyStatus;
  analysisConsent: boolean;
  wordCount: number;
  charCount: number;
  isSaving: boolean;
  autosaveStatus: AutosaveStatus;
  error: string | null;
  savedEntry: JournalEntry | null;
  analysisSubmission: JournalSubmissionResponse | null;
  fixture: AnalysisFixture;
  fieldErrors: Record<string, string[]>;
}

type EditorAction =
  | { type: "RESTORE_DRAFT"; draft: JournalDraft }
  | { type: "SET_FIELD"; field: "title" | "body" | "privacyStatus"; value: string }
  | { type: "SET_EMOTIONS"; emotions: string[] }
  | { type: "SET_TAGS"; tags: string[] }
  | { type: "SET_ANALYSIS_CONSENT"; analysisConsent: boolean }
  | { type: "UPDATE_COUNTS" }
  | { type: "SAVE_START" }
  | { type: "SAVE_SUCCESS"; entry: JournalEntry }
  | { type: "ANALYSIS_SUBMITTED"; submission: JournalSubmissionResponse }
  | { type: "SET_FIXTURE"; fixture: AnalysisFixture }
  | { type: "SAVE_ERROR"; error: string }
  | { type: "SET_FIELD_ERRORS"; fieldErrors: Record<string, string[]> }
  | { type: "SET_AUTOSAVE_STATUS"; status: AutosaveStatus }
  | { type: "CLEAR_ERROR" }
  | { type: "CLEAR_SAVE_ERROR" }
  | { type: "RESET" };

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function hasContent(state: EditorState): boolean {
  return state.title.trim().length > 0 || state.body.trim().length > 0;
}

function reducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "RESTORE_DRAFT":
      return {
        ...state,
        ...action.draft,
        wordCount: countWords(action.draft.body),
        charCount: action.draft.body.length,
        autosaveStatus: "saved",
      };
    case "SET_FIELD": {
      const next = { ...state, [action.field]: action.value };
      const bodyText = action.field === "body" ? action.value : state.body;
      next.wordCount = countWords(bodyText);
      next.charCount = bodyText.length;
      next.autosaveStatus = "unsaved";
      return next;
    }
    case "SET_EMOTIONS":
      return { ...state, emotions: action.emotions, autosaveStatus: "unsaved" };
    case "SET_TAGS":
      return { ...state, tags: action.tags, autosaveStatus: "unsaved" };
    case "SET_ANALYSIS_CONSENT":
      return { ...state, analysisConsent: action.analysisConsent, autosaveStatus: "unsaved" };
    case "UPDATE_COUNTS": {
      return { ...state, wordCount: countWords(state.body), charCount: state.body.length };
    }
    case "SAVE_START":
      return { ...state, isSaving: true, error: null, fieldErrors: {} };
    case "SAVE_SUCCESS":
      return { ...state, title:"",body:"",tags:[],emotions:[],wordCount:0,charCount:0,isSaving: false, autosaveStatus: "saved", savedEntry: action.entry };
    case "ANALYSIS_SUBMITTED":
      return { ...state, title:"",body:"",tags:[],emotions:[],wordCount:0,charCount:0,isSaving: false, autosaveStatus: "saved", analysisSubmission: action.submission };
    case "SET_FIXTURE":
      return { ...state, fixture: action.fixture, autosaveStatus: "unsaved" };
    case "SAVE_ERROR":
      return { ...state, isSaving: false, autosaveStatus: "error", error: action.error };
    case "SET_FIELD_ERRORS":
      return { ...state, fieldErrors: action.fieldErrors, isSaving: false };
    case "SET_AUTOSAVE_STATUS":
      return { ...state, autosaveStatus: action.status };
    case "CLEAR_ERROR":
      return { ...state, error: null, fieldErrors: {} };
    case "CLEAR_SAVE_ERROR":
      return { ...state, error: null };
    case "RESET":
      return { ...initialEditorState,analysisConsent:state.analysisConsent };
    default:
      return state;
  }
}

const initialEditorState: EditorState = {
  title: "",
  body: "",

  emotions: [],
  tags: [],
  privacyStatus: "private",
  analysisConsent: false,
  wordCount: 0,
  charCount: 0,
  isSaving: false,
  autosaveStatus: "idle",
  error: null,
  savedEntry: null,
  analysisSubmission: null,
  fixture: "standard_low_distress",
  fieldErrors: {},
};

export function useJournalEditorViewModel({resumeDraft=false}:{resumeDraft?:boolean}={}) {
  const [state, dispatch] = useReducer(reducer, initialEditorState);
  const service = getJournalService();
  const [draftReady, setDraftReady] = useState(false);
  const [autosaveEpoch, setAutosaveEpoch] = useState(0);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const restored = useRef(false);
  const edited = useRef(false);
  const submitting = useRef(false);
  const finalized = useRef(false);
  const accepted = useRef<Awaited<ReturnType<typeof service.createEntry>> | null>(null);
  const draftExists = useRef(false);
  const autosaveInFlight = useRef<Promise<boolean> | null>(null);
  const revision = useRef(0);
  const savedRevision = useRef(0);

  const [previousDraft,setPreviousDraft]=useState<JournalDraft|null>(null);
  const previousDraftRef=useRef<JournalDraft|null>(null);
  const expectedDraftKey=useRef<string|null>(null);
  const lastSavedDraft=useRef<JournalDraft|null>(null);
  const generation=useRef(0);
  const [editorGeneration,setEditorGeneration]=useState(0);
  const [shouldRestorePhotos,setShouldRestorePhotos]=useState(false);
  useEffect(()=>()=>{generation.current++;},[]);
  const draftRead = useRef<ReturnType<NonNullable<typeof service.getDraft>> | null>(null);
  useEffect(() => {
    let active = true;
    const epoch=generation.current;
    if (!draftRead.current && service.getDraft) {
      const read = service.getDraft("current");
      draftRead.current = read;
      void read.finally(() => { if (draftRead.current === read) draftRead.current = null; }).catch(() => {});
    }
    void draftRead.current
      ?.then((result) => {
        if (!active || epoch!==generation.current) return;
        if (result.success && result.data && !edited.current) {
          if(resumeDraft){
            idempotencyKeyRef.current=result.data.submissionKey??crypto.randomUUID();
            expectedDraftKey.current=result.data.submissionKey??null;
            lastSavedDraft.current=result.data;draftExists.current=true;
            setShouldRestorePhotos(true);
            dispatch({type:'RESTORE_DRAFT',draft:result.data});
          }else{previousDraftRef.current=result.data;setPreviousDraft(result.data);}
        } else if (!result.success) dispatch({ type: "SAVE_ERROR", error: result.error.message });
        if (result.success && !result.data) draftExists.current=false;
        restored.current = result.success;
        setDraftReady(result.success);
      })
      .catch(() => {
        if (active)
          dispatch({
            type: "SAVE_ERROR",
            error: "Your saved draft could not be loaded. Please reload before editing.",
          });
      });
    if (!service.getDraft) {
      restored.current = true;
      setDraftReady(true);
    }
    return () => {
      active = false;
    };
  }, [service,resumeDraft]);

  const requestChanged = useCallback(() => {
    if (!restored.current || submitting.current || accepted.current?.success) return false;
    edited.current = true;
    revision.current += 1;
    idempotencyKeyRef.current = null;
    return true;
  }, []);

  const setField = useCallback(
    (field: "title" | "body" | "privacyStatus", value: string) => {
      if (!requestChanged()) return;
      dispatch({ type: "SET_FIELD", field, value });
    },
    [requestChanged],
  );

  const setTitle = useCallback((title: string) => setField("title", title), [setField]);
  const setBody = useCallback((body: string) => setField("body", body), [setField]);
  const setPrivacyStatus = useCallback(
    (privacyStatus: JournalPrivacyStatus) => setField("privacyStatus", privacyStatus),
    [setField],
  );
  const setEmotions = useCallback(
    (emotions: string[]) => {
      if (!requestChanged()) return;
      dispatch({ type: "SET_EMOTIONS", emotions });
    },
    [requestChanged],
  );
  const setTags = useCallback(
    (tags: string[]) => {
      if (!requestChanged()) return;
      dispatch({ type: "SET_TAGS", tags });
    },
    [requestChanged],
  );
  const setAnalysisConsent = useCallback(
    (analysisConsent: boolean) => {
      if(state.analysisConsent===analysisConsent)return;
      if((draftExists.current||edited.current)&&!requestChanged())return;
      dispatch({ type: "SET_ANALYSIS_CONSENT", analysisConsent });
    },
    [requestChanged,state.analysisConsent],
  );
  const setFixture = useCallback(
    (fixture: AnalysisFixture) => {
      if (!requestChanged()) return;
      dispatch({ type: "SET_FIXTURE", fixture });
    },
    [requestChanged],
  );

  const performAutosave = useCallback((): Promise<boolean> => {
    if (autosaveInFlight.current) return autosaveInFlight.current;
    if (finalized.current || accepted.current?.success || !restored.current) return Promise.resolve(false);
    if(previousDraftRef.current){dispatch({type:'SAVE_ERROR',error:'Your earlier draft is preserved. Resume or explicitly discard it before saving a new reflection.'});return Promise.resolve(false);}
    const epoch=generation.current;
    const savingRevision = revision.current;
    dispatch({ type: "SET_AUTOSAVE_STATUS", status: "saving" });

    const operation = Promise.resolve().then(async () => {
      try {
        const draft: JournalDraft = {
          draftIntent:draftExists.current?"update":"create",expectedSubmissionKey:expectedDraftKey.current,
          submissionKey: (idempotencyKeyRef.current ??= crypto.randomUUID()),
          id: "current",
          title: state.title.trim(),
          body: state.body.trim(),

          emotions: state.emotions,
          tags: state.tags,
          privacyStatus: state.privacyStatus,
          analysisConsent: state.analysisConsent,
          updatedAt: new Date().toISOString().split("T")[0],
        };

        const result = await service.saveDraft(draft);
        if(epoch!==generation.current)return false;
        if (result.success) {
          draftExists.current = true;
          expectedDraftKey.current=result.data?.submissionKey??draft.submissionKey??null;
          lastSavedDraft.current=result.data??draft;
          savedRevision.current = savingRevision;
          dispatch({ type: "CLEAR_SAVE_ERROR" });
          dispatch({ type: "SET_AUTOSAVE_STATUS", status: savingRevision === revision.current ? "saved" : "unsaved" });
          return savingRevision === revision.current;
        } else dispatch({ type: "SAVE_ERROR", error: result.error.message });
      } catch {
        if(epoch!==generation.current)return false;
        dispatch({
          type: "SAVE_ERROR",
          error: "The draft could not be saved. Retry when your connection is available.",
        });
      } finally {
        if(epoch===generation.current)autosaveInFlight.current = null;
        if (epoch===generation.current && savingRevision !== revision.current) setAutosaveEpoch((value) => value + 1);
      }
      return false;
    });
    autosaveInFlight.current = operation;
    return operation;
  }, [
    state.title,
    state.body,
    state.emotions,
    state.tags,
    state.privacyStatus,
    state.analysisConsent,
    state.savedEntry?.id,
    previousDraft,
    service,
  ]);

  const saveDraftNow = useCallback(
    async (force = false) => {
      if (!force && !hasContent(state) && !draftExists.current) return true;
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      if (autosaveInFlight.current) await autosaveInFlight.current;
      if (draftExists.current && savedRevision.current === revision.current) return true;
      return performAutosave();
    },
    [state, performAutosave],
  );

  // Debounced autosave
  useEffect(() => {
    if (
      state.isSaving ||
      state.savedEntry ||
      state.analysisSubmission ||
      finalized.current ||
      state.autosaveStatus !== "unsaved"
    )
      return;
    if (!state.title.trim() && !state.body.trim() && !draftExists.current) return;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      if (!submitting.current && !finalized.current) void performAutosave();
    }, JOURNAL_AUTOSAVE_INTERVAL_MS);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [
    state.title,
    state.body,
    state.tags,
    state.privacyStatus,
    state.analysisConsent,
    state.autosaveStatus,
    state.isSaving,
    state.savedEntry,
    state.analysisSubmission,
    autosaveEpoch,
    performAutosave,
  ]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (
        (hasContent(state) || edited.current) &&
        !finalized.current &&
        (state.autosaveStatus !== "saved" || state.isSaving)
      ) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state]);

  const save = useCallback(
    async (facial?: { requested: boolean; capture?: FaceMeshCapture; image?: Blob }) => {
      if (submitting.current || finalized.current) return;
      if (!restored.current) {
        dispatch({ type: "SAVE_ERROR", error: "Please wait for your saved draft to load before submitting." });
        return;
      }
      if(previousDraftRef.current){dispatch({type:'SAVE_ERROR',error:'Resume or explicitly discard the earlier saved draft before saving a new reflection.'});return;}
      const epoch=generation.current;
      const input: Record<string, unknown> = {
        title: state.title,
        body: state.body,

        privacyStatus: state.privacyStatus,
      };
      const validation = validateCreateJournalInput(input);
      if (!validation.valid) {
        dispatch({ type: "SET_FIELD_ERRORS", fieldErrors: validation.errors });
        return;
      }

      submitting.current = true;
      try {
        dispatch({ type: "SAVE_START" });
        if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
        await autosaveInFlight.current;
        if(epoch!==generation.current)return;
        const createInput: CreateJournalInput = {
          title: state.title.trim(),
          body: state.body.trim(),

          emotions: state.emotions,
          tags: state.tags,
          privacyStatus: state.privacyStatus,
          analysisConsent: state.analysisConsent,
          facialAnalysisRequested: state.analysisConsent && facial?.requested === true,
          ...(state.analysisConsent && facial?.capture ? { facialCapture: facial.capture } : {}),
        };
        idempotencyKeyRef.current ??= crypto.randomUUID();
        // Save the retry identity before submission so reopening a failed draft replays safely.
        const draftResult = await service.saveDraft({
          id: "current",
          ...createInput,
          draftIntent:draftExists.current?'update':'create',expectedSubmissionKey:expectedDraftKey.current,
          submissionKey: idempotencyKeyRef.current,
          updatedAt: new Date().toISOString(),
        });
        if(epoch!==generation.current)return;
        if (!draftResult.success) {
          submitting.current = false;
          dispatch({ type: "SAVE_ERROR", error: draftResult.error.message });
          return;
        }
        draftExists.current=true;
        expectedDraftKey.current=draftResult.data?.submissionKey??idempotencyKeyRef.current;
        lastSavedDraft.current=draftResult.data;
        const result =
          accepted.current ??
          (await service.createEntry(createInput, {
            idempotencyKey: idempotencyKeyRef.current,
            ...(env.enableAnalysisFixtures && state.analysisConsent ? { fixture: state.fixture } : {}),
          }));
        if(epoch!==generation.current)return;
        if (result.success) {
          accepted.current = result;
          const data = result.data;
          const journalId =
            "kind" in data && data.kind === "analysis" ? data.submission.journalId : (data as JournalEntry).id;
          if (
            facial?.image &&
            state.analysisConsent &&
            facial.requested &&
            "kind" in data &&
            data.kind === "analysis"
          ) {
            const token = await supabaseAuthTokenProvider.getAccessToken();
            if(epoch!==generation.current)return;
            try {
              const deadline = Date.now() + 65000;
              while (true) {
                const faceResponse = await fetch(env.apiBaseUrl + "/journals/" + journalId + "/face", {
                  method: "POST",
                  headers: { Authorization: "Bearer " + token, "Content-Type": "image/jpeg" },
                  body: facial.image,
                  signal: AbortSignal.timeout(Math.max(1, deadline - Date.now())),
                });
                if(epoch!==generation.current)return;
                if (faceResponse.ok) break;
                const failure = await faceResponse.json().catch(() => null);
                if(epoch!==generation.current)return;
                if (failure?.error?.code !== "FACE_BUSY" || Date.now() + 1000 >= deadline)
                  throw new Error("Face result was not saved.");
                await new Promise((resolve) => setTimeout(resolve, 1000));
                if(epoch!==generation.current)return;
              }
              window.dispatchEvent(new CustomEvent("echo:analysis-completed", { detail: { journalId } }));
            } catch {
              if(epoch!==generation.current)return;
              dispatch({
                type: "SAVE_ERROR",
                error: "Your reflection is saved, but face analysis was not saved. Check your camera and retry saving.",
              });
              return;
            }
          }
          const attached = await service.attachDraftImages(journalId);
          if(epoch!==generation.current)return;
          if (!attached.success) {
            dispatch({
              type: "SAVE_ERROR",
              error: `${attached.error.message} Your reflection is saved; retry to attach its photos.`,
            });
            return;
          }
          const cleared = await service.deleteDraft(idempotencyKeyRef.current);
          if(epoch!==generation.current)return;
          if (!cleared.success) {
            dispatch({
              type: "SAVE_ERROR",
              error:
                "Your journal was saved. Draft cleanup could not finish; retry to finalize without creating another journal.",
            });
            return;
          }
          if(epoch!==generation.current)return;
          draftExists.current=false;expectedDraftKey.current=null;lastSavedDraft.current=null;
          finalized.current = true;
          if ("kind" in data && data.kind === "analysis") {
            dispatch({ type: "ANALYSIS_SUBMITTED", submission: data.submission });
            try {
              localStorage.setItem("echo:active-analysis", JSON.stringify(data.submission));
            } catch {
              /* Backend notifications retain discovery if browser storage is unavailable. */
            }
            window.dispatchEvent(new CustomEvent("echo:analysis-submitted", { detail: data.submission }));
          } else {
            dispatch({ type: "SAVE_SUCCESS", entry: data as JournalEntry });
          }
        } else {
          dispatch({ type: "SAVE_ERROR", error: result.error.message });
        }
      } catch {
        if(epoch!==generation.current)return;
        dispatch({
          type: "SAVE_ERROR",
          error: "The save could not be confirmed. Your draft and retry information are preserved; please retry.",
        });
      } finally {
        submitting.current = false;
      }
    },
    [
      state.title,
      state.body,
      state.emotions,
      state.tags,
      state.privacyStatus,
      state.analysisConsent,
      state.fixture,
      service,
    ],
  );

  const clearError = useCallback(() => {
    dispatch({ type: "CLEAR_ERROR" });
  }, []);

  const reset = useCallback(() => {
    if (submitting.current || autosaveInFlight.current) return;
    generation.current++;setEditorGeneration(generation.current);
    if(autosaveTimerRef.current)clearTimeout(autosaveTimerRef.current);
    previousDraftRef.current=draftExists.current&&!finalized.current?lastSavedDraft.current:null;
    setPreviousDraft(previousDraftRef.current);
    draftExists.current=false;expectedDraftKey.current=null;
    setShouldRestorePhotos(false);
    revision.current=0;savedRevision.current=0;
    idempotencyKeyRef.current = null;
    accepted.current = null;
    finalized.current = false;
    edited.current = false;
    dispatch({ type: "RESET" });
  }, []);

  const discardPreviousDraft=useCallback(async()=>{
    const previous=previousDraftRef.current;if(!previous||submitting.current)return false;
    const epoch=generation.current;
    try{
      const result=await service.deleteDraft(previous.id,{expectedSubmissionKey:previous.submissionKey??null});
      if(epoch!==generation.current)return false;
      if(!result.success){dispatch({type:'SAVE_ERROR',error:result.error.message});return false;}
      previousDraftRef.current=null;setPreviousDraft(null);draftExists.current=false;
      expectedDraftKey.current=null;lastSavedDraft.current=null;
      dispatch({type:'CLEAR_SAVE_ERROR'});return true;
    }catch{if(epoch!==generation.current)return false;dispatch({type:'SAVE_ERROR',error:'The saved draft could not be discarded. It has been preserved.'});return false;}
  },[service]);

  const retryAutosave = useCallback(() => {
    if (hasContent(state) || edited.current) {
      performAutosave();
    }
  }, [state, performAutosave]);

  return {
    previousDraft,discardPreviousDraft,shouldRestorePhotos,editorGeneration,
    draftReady,
    title: state.title,
    body: state.body,
    emotions: state.emotions,
    tags: state.tags,
    privacyStatus: state.privacyStatus,
    analysisConsent: state.analysisConsent,
    wordCount: state.wordCount,
    charCount: state.charCount,
    isSaving: state.isSaving,
    autosaveStatus: state.autosaveStatus,
    error: state.error,
    fieldErrors: state.fieldErrors,
    savedEntry: state.savedEntry,
    analysisSubmission: state.analysisSubmission,
    fixture: state.fixture,
    setTitle,
    setBody,
    setEmotions,
    setTags,
    setPrivacyStatus,
    setAnalysisConsent,
    setFixture,
    save,
    clearError,
    reset,
    retryAutosave,
    saveDraftNow,
  };
}
