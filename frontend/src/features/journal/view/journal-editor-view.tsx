"use client";

import Link from "next/link";
import { type ChangeEvent, type MouseEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ImagePlus, LockKeyhole, Save } from "lucide-react";
import { analysisFixtureSchema } from "@echo/contracts";
import journalLandscape from "../../../../assets/growth-doorway-hill.png";
import { env } from "@/config/environment";
import { settingsService } from "@/services/settings";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { EchoInlineMessage } from "@/shared/components/feedback/echo-inline-message";
import { JournalMoodSelector } from "../components/journal-mood-selector";
import { JournalAutosaveStatus } from "../components/journal-autosave-status";
import { JournalPolaroid } from "../components/journal-polaroid";
import { JournalFaceCapture, type JournalFaceCaptureHandle } from "../components/journal-face-capture";
import { useJournalEditorViewModel } from "../view-model/use-journal-editor-view-model";

interface JournalPhotoPreview {
  id: string;
  file: File;
  name: string;
  src: string;
}

export function JournalEditorView() {
  const router = useRouter();
  const {
    title, body, mood, tags, analysisConsent, wordCount, charCount, isSaving,
    autosaveStatus, error, fieldErrors, draftReady, savedEntry, analysisSubmission,
    fixture, setTitle, setBody, setMood, setTags, setAnalysisConsent, setFixture,
    save, retryAutosave, saveDraftNow,
  } = useJournalEditorViewModel();
  const [photos, setPhotos] = useState<JournalPhotoPreview[]>([]);
  const [photoError, setPhotoError] = useState("");
  const photosRef = useRef<JournalPhotoPreview[]>([]);
  const faceCaptureRef = useRef<JournalFaceCaptureHandle>(null);
  const [facialAllowed, setFacialAllowed] = useState(false);
  const [facialRequested, setFacialRequested] = useState(false);

  useEffect(() => { if (savedEntry) router.push(`/journal/${savedEntry.id}`); }, [savedEntry, router]);
  useEffect(() => {
    if (!env.enableFacialAnalysis) return;
    let active = true;
    void settingsService.get().then((settings) => {
      if (active) setFacialAllowed(settings.privacy.facialAnalysisEnabled);
    }).catch(() => { if (active) setFacialAllowed(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!analysisConsent) {
      setFacialRequested(false);
      faceCaptureRef.current?.stop();
    }
  }, [analysisConsent]);
  useEffect(() => { photosRef.current = photos; }, [photos]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (photosRef.current.length && !savedEntry && !analysisSubmission) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [savedEntry, analysisSubmission]);
  useEffect(() => () => photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.src)), []);

  const addPhotos = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    const valid = selected.filter((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type) && file.size <= 5 * 1024 * 1024);
    setPhotoError(valid.length !== selected.length ? "Choose JPEG, PNG, or WebP photos up to 5 MB each." : "");
    setPhotos((current) => {
      const available = Math.max(0, 5 - current.length);
      if (valid.length > available) setPhotoError("You can add up to five photos.");
      return [...current, ...valid.slice(0, available).map((file) => ({ id: crypto.randomUUID(), file, name: file.name, src: URL.createObjectURL(file) }))];
    });
    event.target.value = "";
  };
  const removePhoto = (id: string) => {
    setPhotos((current) => {
      const photo = current.find((item) => item.id === id);
      if (photo) URL.revokeObjectURL(photo.src);
      return current.filter((item) => item.id !== id);
    });
  };
  const finish = () => {
    const capture = faceCaptureRef.current?.getCapture();
    faceCaptureRef.current?.stop();
    void save({ requested: facialRequested, capture }, photos);
  };
  const returnToJournal = async (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (isSaving) return;
    if (photos.length && !window.confirm("Selected photos are not saved in this draft. Leave without these photos?")) return;
    if (await saveDraftNow()) router.push("/journal");
  };

  if (!draftReady) return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-card p-6" role="status">
      <p>{error || "Opening your saved draft…"}</p>
      {error && <button type="button" onClick={() => window.location.reload()} className="echo-button-secondary mt-4">Retry opening draft</button>}
    </div>
  );

  return (
    <main className="mx-auto max-w-[980px] pb-28 sm:pb-10">
      <div className="mb-5 flex items-center justify-between gap-3 px-1">
        <Link href="/journal" onClick={(event: MouseEvent<HTMLAnchorElement>) => void returnToJournal(event)} className="inline-flex min-h-11 items-center gap-2 rounded-full px-2 text-sm font-semibold text-primary outline-none hover:bg-secondary focus-visible:ring-4 focus-visible:ring-primary/20"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> All reflections</Link>
        <JournalAutosaveStatus autosaveStatus={autosaveStatus} isSaving={isSaving} />
      </div>
      <article className="journal-writing-page overflow-hidden rounded-[1.5rem] border border-border/70 bg-card shadow-[0_20px_70px_rgba(31,53,42,0.09)] sm:rounded-[2rem]">
        <div className="border-b border-border/60 bg-[linear-gradient(115deg,hsl(var(--secondary)/0.65),hsl(var(--card)))] px-5 py-5 sm:px-10 sm:py-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">New reflection</p>
            <time className="text-xs text-muted-foreground" dateTime={new Date().toISOString()}>{new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date())}</time>
          </div>
          <label htmlFor="journal-title" className="sr-only">Reflection title</label>
          <input id="journal-title" value={title} onChange={(event) => setTitle(event.target.value)} onBlur={() => void saveDraftNow()} maxLength={200} placeholder="Title your reflection" className="mt-5 w-full bg-transparent font-[family-name:var(--font-echo-display)] text-3xl leading-tight text-foreground outline-none placeholder:text-muted-foreground/50 sm:text-4xl" />
          {fieldErrors.title && <p className="mt-2 text-xs text-danger" role="alert">{fieldErrors.title[0]}</p>}
        </div>
        <div className="px-5 pt-5 sm:px-10 sm:pt-8">
          <label htmlFor="journal-body" className="sr-only">Start writing</label>
          <textarea id="journal-body" value={body} onChange={(event) => setBody(event.target.value)} onBlur={() => void saveDraftNow()} placeholder="Start writing…" className="min-h-[18rem] w-full resize-y bg-transparent text-base leading-8 text-foreground outline-none placeholder:text-muted-foreground/50 sm:min-h-[23rem]" />
          {fieldErrors.body && <p className="text-xs text-danger" role="alert">{fieldErrors.body[0]}</p>}
          <p className="border-t border-border/50 py-3 text-right text-xs text-muted-foreground">{wordCount} words · {charCount} characters</p>
        </div>
        <div className="border-t border-border/60 bg-secondary/20 px-5 py-6 sm:px-10">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="font-[family-name:var(--font-echo-display)] text-xl text-foreground">Moments in pictures</h2><p className="mt-1 text-xs text-muted-foreground">Optional · up to five photos</p></div>
            <label className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold text-primary outline-none focus-within:ring-4 focus-within:ring-primary/20 ${photos.length >= 5 ? "pointer-events-none opacity-50" : ""}`}><ImagePlus className="h-4 w-4" aria-hidden="true" /> Add photos<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={addPhotos} disabled={photos.length >= 5} className="sr-only" aria-label="Upload journal photos" /></label>
          </div>
          {photoError && <p className="mt-2 text-sm text-danger" role="alert">{photoError}</p>}
          <div className="journal-photo-gallery mt-5" aria-label="Selected journal photos">
            {photos.length ? photos.map((photo, index) => (
              <JournalPolaroid key={photo.id} src={photo.src} alt={photo.name} caption={`Memory ${index + 1}`} index={index} onRemove={() => removePhoto(photo.id)} removeLabel={`Remove ${photo.name}`} />
            )) : (
              <JournalPolaroid src={journalLandscape} alt="Illustration of a doorway on a hillside" caption="Illustration · add your own photo" />
            )}
          </div>
          {photos.length > 0 && <p className="mt-4 text-xs text-muted-foreground">Photos attach when you finish this reflection. Keep this page open until uploads complete; selected photos are not part of the text draft.</p>}
        </div>
        <div className="space-y-5 px-5 py-6 sm:px-10">
          <div className="journal-mood-panel"><JournalMoodSelector value={mood} onChange={setMood} /></div>
          <details className="rounded-2xl border border-border/70 bg-background/40 px-4 py-3"><summary className="cursor-pointer text-sm font-semibold text-foreground">More options</summary>
            <div className="mt-4 space-y-4">
              <label htmlFor="journal-tags" className="block text-xs font-semibold text-muted-foreground">Tags, separated by commas</label>
              <input id="journal-tags" value={tags.join(", ")} onChange={(event) => setTags(event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean))} placeholder="rest, work" className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:ring-4 focus-visible:ring-primary/20" />
              <label className="flex items-center gap-3 text-sm text-foreground"><input type="checkbox" checked={analysisConsent} onChange={(event) => setAnalysisConsent(event.target.checked)} className="h-4 w-4 accent-primary" /> Allow a reflective summary after saving</label>
              {analysisConsent && env.enableFacialAnalysis && (facialAllowed ? <JournalFaceCapture ref={faceCaptureRef} requested={facialRequested} onRequestedChange={setFacialRequested} /> : <p className="text-xs text-muted-foreground">Face mesh is off. You can enable it in <Link href="/settings/privacy" className="underline">Privacy settings</Link>.</p>)}
              {env.enableAnalysisFixtures && analysisConsent && <label className="grid gap-1 text-xs text-muted-foreground">Development fixture<select value={fixture} onChange={(event) => setFixture(analysisFixtureSchema.parse(event.target.value))} className="h-10 rounded-xl border border-border bg-card px-3 text-foreground">{analysisFixtureSchema.options.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}</select></label>}
            </div>
          </details>
          {error && <div><EchoInlineMessage variant="error" message={error} />{autosaveStatus === "error" && <button type="button" onClick={retryAutosave} className="mt-2 min-h-11 text-sm font-semibold text-primary underline">Retry saving draft</button>}</div>}
          {analysisSubmission && <p role="status" className="rounded-xl bg-secondary p-4 text-sm">Your reflection was saved and your summary is being prepared. <Link href="/journal" className="font-semibold underline">View your journal</Link>.</p>}
        </div>
      </article>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-4 py-3 shadow-[0_-8px_30px_rgba(30,45,34,0.1)] backdrop-blur sm:static sm:mt-5 sm:rounded-2xl sm:border sm:shadow-sm">
        <div className="mx-auto flex max-w-[980px] items-center justify-between gap-3"><span className="hidden items-center gap-2 text-xs text-muted-foreground sm:inline-flex"><LockKeyhole className="h-4 w-4" aria-hidden="true" /> Private by default</span><EchoButton variant="primary" size="medium" isLoading={isSaving} onClick={finish} className="w-full sm:w-auto"><Save className="h-4 w-4" aria-hidden="true" /> Save reflection</EchoButton></div>
      </div>
    </main>
  );
}
