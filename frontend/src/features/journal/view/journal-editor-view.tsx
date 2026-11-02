"use client";

import Link from "next/link";
import { type ChangeEvent, type MouseEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ImagePlus, LockKeyhole, Save } from "lucide-react";
import journalLandscape from "../../../../assets/growth-doorway-hill.png";
import { env } from "@/config/environment";
import { settingsService } from "@/services/settings";
import { getJournalService } from "@/services/journal/journal-service.factory";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { EchoInlineMessage } from "@/shared/components/feedback/echo-inline-message";
import { JournalAnalysisDock } from "../components/journal-analysis-dock";
import { JournalAutosaveStatus } from "../components/journal-autosave-status";
import { JournalPolaroid } from "../components/journal-polaroid";
import { JournalFaceCapture, type JournalFaceCaptureHandle } from "../components/journal-face-capture";
import { useJournalEditorViewModel } from "../view-model/use-journal-editor-view-model";

interface JournalPhotoPreview {
  id: string;
  file?: File;
  name: string;
  src: string;
  status: "uploading" | "saved" | "error";
}

export function JournalEditorView() {
  const router = useRouter();
  const {
    title,
    body,
    tags,
    analysisConsent,
    wordCount,
    charCount,
    isSaving,
    autosaveStatus,
    error,
    fieldErrors,
    draftReady,
    savedEntry,
    analysisSubmission,
    setTitle,
    setBody,
    setTags,
    setAnalysisConsent,
    save,
    retryAutosave,
    saveDraftNow,
  } = useJournalEditorViewModel();
  useEffect(() => {
    if (analysisSubmission) router.replace(`/journal/${analysisSubmission.journalId}`);
  }, [analysisSubmission, router]);
  const [photos, setPhotos] = useState<JournalPhotoPreview[]>([]);
  const [photoError, setPhotoError] = useState("");
  const [photosLoaded, setPhotosLoaded] = useState(false);
  const photosRef = useRef<JournalPhotoPreview[]>([]);
  const journalService = getJournalService();
  const photoBackGuardRef = useRef(false);
  const faceCaptureRef = useRef<JournalFaceCaptureHandle>(null);
  const [facialAllowed, setFacialAllowed] = useState(false);
  const [journalAiAllowed, setJournalAiAllowed] = useState<boolean | null>(null);
  const [preparingFace, setPreparingFace] = useState(false);
  const [privacyReady, setPrivacyReady] = useState(false);
  const privacyRead = useRef<ReturnType<typeof settingsService.get> | null>(null);
  const facialEnabled = privacyReady && journalAiAllowed === true && facialAllowed && analysisConsent && env.enableFacialAnalysis;
  const facialRunning = facialEnabled && Boolean(title.trim() || body.trim()) && !isSaving;

  useEffect(() => {
    if (!savedEntry) return;
    const destination = `/journal/${savedEntry.id}`;
    if (photoBackGuardRef.current) router.replace(destination);
    else router.push(destination);
  }, [savedEntry, router]);
  useEffect(() => {
    let active = true,
      revision = 0;
    const refresh = async (reusePending = false) => {
      const current = ++revision;
      setPrivacyReady(false);
      try {
        const read = reusePending && privacyRead.current ? privacyRead.current : settingsService.get();
        privacyRead.current = read;
        void read.finally(() => { if (privacyRead.current === read) privacyRead.current = null; }).catch(() => {});
        const settings = await read;
        if (!active || current !== revision) return;
        setJournalAiAllowed(settings.privacy.journalAiAnalysisEnabled ?? false);
        setFacialAllowed(settings.privacy.facialAnalysisEnabled);

      } catch {
        if (active && current === revision) {
          setFacialAllowed(false);
          setJournalAiAllowed(false);

        }
      } finally {
        if (active && current === revision) setPrivacyReady(true);
      }
    };
    const changed = () => {
      void refresh();
    };
    const visible = () => {
      if (document.hidden) {
        ++revision;
        setPrivacyReady(false);
        faceCaptureRef.current?.stop();
      } else void refresh();
    };
    const stored = (event: StorageEvent) => {
      if (event.key === "echo:privacy-updated") void refresh();
    };
    void refresh(true);
    window.addEventListener("echo:privacy-changed", changed);
    window.addEventListener("storage", stored);
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      ++revision;
      window.removeEventListener("echo:privacy-changed", changed);
      window.removeEventListener("storage", stored);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  useEffect(() => {
    // Apply authoritative consent only after restoring the draft; both reads start together.
    if (draftReady && journalAiAllowed !== null) setAnalysisConsent(journalAiAllowed);
  }, [draftReady, journalAiAllowed, setAnalysisConsent]);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  const loadDraftPhotos = useCallback(async () => {
    setPhotosLoaded(false);
    try {
      const result = await journalService.listDraftImages();
      if (!result.success) throw new Error(result.error.message);
      setPhotos((current) => [
        ...current,
        ...result.data
          .filter((image) => !current.some((photo) => photo.id === image.id))
          .map((image, index) => ({
            id: image.id,
            src: image.url,
            name: `Draft photo ${index + 1}`,
            status: "saved" as const,
          })),
      ]);
      setPhotoError("");
      setPhotosLoaded(true);
    } catch (failure) {
      setPhotoError(
        `${failure instanceof Error ? failure.message : "Draft photos could not be loaded."} Retry loading your draft photos before publishing.`,
      );
    }
  }, [journalService]);
  useEffect(() => {
    if (draftReady) void loadDraftPhotos();
  }, [draftReady, loadDraftPhotos]);
  const pendingPhotos = photos.some((photo) => photo.status !== "saved");
  useEffect(() => {
    if (!pendingPhotos || savedEntry || analysisSubmission || photoBackGuardRef.current) return;
    window.history.pushState({ echoJournalPhotoGuard: true }, "", window.location.href);
    photoBackGuardRef.current = true;
  }, [pendingPhotos, savedEntry, analysisSubmission]);
  useEffect(() => {
    const restorePhotoGuard = () => {
      window.history.pushState({ echoJournalPhotoGuard: true }, "", window.location.href);
      photoBackGuardRef.current = true;
    };
    const onBack = () => {
      if (!photoBackGuardRef.current) return;
      photoBackGuardRef.current = false;
      if (!photosRef.current.some((photo) => photo.status !== "saved") || savedEntry || analysisSubmission) {
        window.history.back();
        return;
      }
      if (isSaving || !window.confirm("Some photos have not finished saving. Leave without them?")) {
        restorePhotoGuard();
        return;
      }
      void saveDraftNow()
        .then((saved) => {
          if (saved) window.history.back();
          else restorePhotoGuard();
        })
        .catch(() => {
          setPhotoError("Your draft could not be saved. Please try again.");
          restorePhotoGuard();
        });
    };
    window.addEventListener("popstate", onBack);
    return () => window.removeEventListener("popstate", onBack);
  }, [analysisSubmission, isSaving, saveDraftNow, savedEntry]);
  useEffect(() => {
    const leaveWithPhotos = (event: globalThis.MouseEvent) => {
      if (
        !photosRef.current.length ||
        savedEntry ||
        analysisSubmission ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const target = event.target;
      const link = target instanceof Element ? target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank" || link.hasAttribute("download")) return;
      const destination = new URL(link.href, window.location.href);
      if (
        destination.origin !== window.location.origin ||
        destination.pathname === window.location.pathname ||
        destination.pathname === "/crisis" ||
        destination.pathname === "/crisis-help"
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (
        isSaving ||
        (photosRef.current.some((photo) => photo.status !== "saved") &&
          !window.confirm("Some photos have not finished saving. Leave without them?"))
      )
        return;
      void saveDraftNow().then((saved) => {
        if (saved) router.replace(`${destination.pathname}${destination.search}${destination.hash}`);
      });
    };
    document.addEventListener("click", leaveWithPhotos, true);
    return () => document.removeEventListener("click", leaveWithPhotos, true);
  }, [analysisSubmission, isSaving, router, saveDraftNow, savedEntry]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (photosRef.current.some((photo) => photo.status !== "saved") && !savedEntry && !analysisSubmission) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [savedEntry, analysisSubmission]);
  useEffect(
    () => () =>
      photosRef.current.forEach((photo) => {
        if (photo.src.startsWith("blob:")) URL.revokeObjectURL(photo.src);
      }),
    [],
  );

  const persistPhoto = async (photo: JournalPhotoPreview) => {
    if (!photo.file) return;
    setPhotos((current) => current.map((item) => (item.id === photo.id ? { ...item, status: "uploading" } : item)));
    try {
      if (!(await saveDraftNow(true))) throw new Error("Your draft could not be saved.");
      const result = await journalService.uploadDraftImage(photo.id, photo.file);
      if (!result.success) throw new Error(result.error.message);
      setPhotos((current) => current.map((item) => (item.id === photo.id ? { ...item, status: "saved" } : item)));
      setPhotoError("");
    } catch (failure) {
      setPhotos((current) => current.map((item) => (item.id === photo.id ? { ...item, status: "error" } : item)));
      setPhotoError(
        `${failure instanceof Error ? failure.message : "The photo could not be uploaded."} Retry the photo; your writing remains in the draft.`,
      );
    }
  };
  const addPhotos = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    const valid = selected.filter(
      (file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type) && file.size <= 5 * 1024 * 1024,
    );
    setPhotoError(valid.length !== selected.length ? "Choose JPEG, PNG, or WebP photos up to 5 MB each." : "");
    const available = Math.max(0, 5 - photosRef.current.length);
    if (valid.length > available) setPhotoError("You can add up to five photos.");
    const added = valid.slice(0, available).map((file) => ({
      id: crypto.randomUUID(),
      file,
      name: file.name,
      src: URL.createObjectURL(file),
      status: "uploading" as const,
    }));
    photosRef.current = [...photosRef.current, ...added];
    setPhotos(photosRef.current);
    if (added.length) void Promise.all(added.map(persistPhoto));
    event.target.value = "";
  };
  const removePhoto = async (id: string) => {
    const photo = photosRef.current.find((item) => item.id === id);
    if (!photo) return;
    if (photo.status === "uploading") {
      setPhotoError("Wait for this photo to finish uploading before removing it.");
      return;
    }
    const result = await journalService.removeDraftImage(id);
    if (!result.success) {
      setPhotoError(`${result.error.message} Retry removing the photo.`);
      return;
    }
    if (photo.src.startsWith("blob:")) URL.revokeObjectURL(photo.src);
    setPhotos((current) => current.filter((item) => item.id !== id));
    setPhotoError("");
  };
  const finish = async () => {
    if (preparingFace || isSaving) return;
    if (!photosLoaded || photos.some((photo) => photo.status !== "saved")) {
      setPhotoError("Finish uploading or retry each photo before saving this reflection.");
      return;
    }
    if (!title.trim() || !body.trim()) {
      void save();
      return;
    }
    setPreparingFace(true);
    try {
      const image = facialEnabled ? await faceCaptureRef.current?.getStill() : undefined;
      const capture = facialEnabled ? faceCaptureRef.current?.getCapture() : undefined;
      faceCaptureRef.current?.stop();
      void save({ requested: facialEnabled, capture, image });
    } finally {
      setPreparingFace(false);
    }
  };
  const returnToJournal = async (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (isSaving) return;
    if (pendingPhotos && !window.confirm("Some photos have not finished saving. Leave without them?")) return;
    if (await saveDraftNow()) {
      if (photoBackGuardRef.current) router.replace("/journal");
      else router.push("/journal");
    }
  };

  if (!draftReady)
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-card p-6" role="status">
        <p>{error || "Opening your saved draft…"}</p>
        {error && (
          <button type="button" onClick={() => window.location.reload()} className="echo-button-secondary mt-4">
            Retry opening draft
          </button>
        )}
      </div>
    );

  return (
    <main className="mx-auto journal-studio max-w-[1480px] pb-24 lg:pb-0">
      <div className="mb-5 flex items-center justify-between gap-3 px-1">
        <Link
          href="/journal"
          onClick={(event: MouseEvent<HTMLAnchorElement>) => void returnToJournal(event)}
          className="inline-flex min-h-11 items-center gap-2 rounded-full px-2 text-sm font-semibold text-primary outline-none hover:bg-secondary focus-visible:ring-4 focus-visible:ring-primary/20"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All reflections
        </Link>
        <JournalAutosaveStatus autosaveStatus={autosaveStatus} isSaving={isSaving} />
      </div>
      <div className="journal-studio-grid">
        <div className="journal-studio-writing">
          <article className="journal-writing-page overflow-hidden rounded-[1.5rem] border border-border/70 bg-card shadow-[0_20px_70px_rgba(31,53,42,0.09)] sm:rounded-[2rem]">
            <div className="border-b border-border/60 bg-[linear-gradient(115deg,hsl(var(--secondary)/0.65),hsl(var(--card)))] px-5 py-5 sm:px-10 sm:py-7">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">New reflection</p>
                <time className="text-xs text-muted-foreground" dateTime={new Date().toISOString()}>
                  {new Intl.DateTimeFormat("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  }).format(new Date())}
                </time>
              </div>
              <label htmlFor="journal-title" className="sr-only">
                Reflection title
              </label>
              <input
                id="journal-title"
                readOnly={preparingFace || isSaving}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                onBlur={() => void saveDraftNow()}
                maxLength={200}
                placeholder="Title your reflection"
                className="mt-5 w-full bg-transparent font-[family-name:var(--font-echo-display)] text-3xl leading-tight text-foreground outline-none placeholder:text-muted-foreground/50 sm:text-4xl"
              />
              {fieldErrors.title && (
                <p className="mt-2 text-xs text-danger" role="alert">
                  {fieldErrors.title[0]}
                </p>
              )}
            </div>
            <div className="px-5 pt-5 sm:px-10 sm:pt-8">
              <label htmlFor="journal-body" className="sr-only">
                Start writing
              </label>
              <textarea
                id="journal-body"
                readOnly={preparingFace || isSaving}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                onBlur={() => void saveDraftNow()}
                placeholder="Start writing…"
                className="min-h-[18rem] w-full resize-y bg-transparent text-base leading-8 text-foreground outline-none placeholder:text-muted-foreground/50 sm:min-h-[23rem]"
              />
              {fieldErrors.body && (
                <p className="text-xs text-danger" role="alert">
                  {fieldErrors.body[0]}
                </p>
              )}
              <p className="border-t border-border/50 py-3 text-right text-xs text-muted-foreground">
                {wordCount} words · {charCount} characters
              </p>
            </div>
            <div className="border-t border-border/60 bg-secondary/20 px-5 py-6 sm:px-10">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-[family-name:var(--font-echo-display)] text-xl text-foreground">
                    Moments in pictures
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">Optional · up to five photos</p>
                </div>
                <label
                  className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold text-primary outline-none focus-within:ring-4 focus-within:ring-primary/20 ${photos.length >= 5 || !photosLoaded ? "pointer-events-none opacity-50" : ""}`}
                >
                  <ImagePlus className="h-4 w-4" aria-hidden="true" /> Add photos
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={addPhotos}
                    disabled={photos.length >= 5 || !photosLoaded}
                    className="sr-only"
                    aria-label="Upload journal photos"
                  />
                </label>
              </div>
              {photoError && (
                <div className="mt-2 text-sm text-danger" role="alert">
                  {photoError}
                  {!photosLoaded && (
                    <button
                      type="button"
                      onClick={() => void loadDraftPhotos()}
                      className="ml-2 font-semibold underline"
                    >
                      Retry loading photos
                    </button>
                  )}
                </div>
              )}
              <div className="journal-photo-gallery mt-5" aria-label="Selected journal photos">
                {photos.length ? (
                  photos.map((photo, index) => (
                    <JournalPolaroid
                      key={photo.id}
                      src={photo.src}
                      alt={photo.name}
                      caption={
                        photo.status === "saved"
                          ? `Memory ${index + 1}`
                          : photo.status === "uploading"
                            ? "Saving photo…"
                            : "Upload failed"
                      }
                      index={index}
                      onRemove={() => void removePhoto(photo.id)}
                      removeLabel={`Remove ${photo.name}`}
                    />
                  ))
                ) : (
                  <JournalPolaroid
                    src={journalLandscape}
                    alt="Illustration of a doorway on a hillside"
                    caption="Illustration · add your own photo"
                  />
                )}
              </div>
              {photos.some((photo) => photo.status === "error") && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {photos
                    .filter((photo) => photo.status === "error" && photo.file)
                    .map((photo) => (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => void persistPhoto(photo)}
                        className="min-h-11 rounded-full border border-border bg-card px-4 text-sm font-semibold text-primary"
                      >
                        Retry {photo.name}
                      </button>
                    ))}
                </div>
              )}
              {photos.length > 0 && (
                <p className="mt-4 text-xs text-muted-foreground">
                  Saved photos stay with your private draft and attach when you finish this reflection.
                </p>
              )}
            </div>
            <div className="space-y-5 px-5 py-6 sm:px-10">
              <div className="space-y-3">
                <label htmlFor="journal-tags" className="block text-xs font-semibold text-muted-foreground">
                  Tags (optional)
                </label>
                <input
                  id="journal-tags"
                  readOnly={preparingFace || isSaving}
                  value={tags.join(", ")}
                  onChange={(event) =>
                    setTags(
                      event.target.value
                        .split(",")
                        .map((tag) => tag.trim())
                        .filter(Boolean),
                    )
                  }
                  placeholder="rest, work"
                  className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
                />
                <p className="text-xs leading-6 text-muted-foreground">
                  {journalAiAllowed
                    ? "Saving starts private journal analysis."
                    : "Journal analysis is off. Your reflection will be saved privately."}{" "}
                  <Link href="/settings/privacy" className="font-semibold text-primary underline">
                    Privacy settings
                  </Link>
                </p>
              </div>
              {error && (
                <div>
                  <EchoInlineMessage variant="error" message={error} />
                  {autosaveStatus === "error" && (
                    <button
                      type="button"
                      onClick={retryAutosave}
                      className="mt-2 min-h-11 text-sm font-semibold text-primary underline"
                    >
                      Retry saving draft
                    </button>
                  )}
                </div>
              )}
              {analysisSubmission && (
                <p role="status" className="rounded-xl bg-secondary p-4 text-sm">
                  Your reflection was saved and your summary is being prepared.{" "}
                  <Link href="/journal" className="font-semibold underline">
                    View your journal
                  </Link>
                  .
                </p>
              )}
            </div>
          </article>
          <div className="sticky bottom-0 z-30 border-t border-border bg-card/95 px-4 py-3 shadow-[0_-8px_30px_rgba(30,45,34,0.1)] backdrop-blur sm:static sm:mt-5 sm:rounded-2xl sm:border sm:shadow-sm">
            <div className="mx-auto flex max-w-full items-center justify-between gap-3">
              <span className="hidden items-center gap-2 text-xs text-muted-foreground sm:inline-flex">
                <LockKeyhole className="h-4 w-4" aria-hidden="true" /> Private by default
              </span>
              <EchoButton
                variant="primary"
                size="medium"
                isLoading={isSaving || preparingFace}
                disabled={!photosLoaded || pendingPhotos || !privacyReady || preparingFace}
                onClick={finish}
                className="w-full sm:w-auto"
              >
                <Save className="h-4 w-4" aria-hidden="true" /> Save reflection
              </EchoButton>
            </div>
          </div>
        </div>
        <JournalAnalysisDock
          enabled={analysisConsent}
          capture={facialEnabled ? <JournalFaceCapture ref={faceCaptureRef} running={facialRunning} /> : undefined}
        />
      </div>
    </main>
  );
}
