"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bot, Save } from "lucide-react";
import { useJournalEditorViewModel } from "../view-model/use-journal-editor-view-model";
import { JournalMoodSelector } from "../components/journal-mood-selector";
import { JournalAutosaveStatus } from "../components/journal-autosave-status";
import { EchoCard } from "@/shared/components/ui/echo-card";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { EchoInlineMessage } from "@/shared/components/feedback/echo-inline-message";
import { EchoPageHeading } from "@/shared/components/data-display/echo-page-heading";
import { PrivacyNotice } from "@/shared/components/echo/privacy-notice";

export function JournalEditorView() {
  const router = useRouter();
  const {
    title, body, mood, tags, analysisConsent,
    wordCount, charCount, isSaving, autosaveStatus, error, fieldErrors,
    savedEntry,
    setTitle, setBody, setMood, setTags, setAnalysisConsent,
    save, reset,
  } = useJournalEditorViewModel();

  useEffect(() => {
    if (savedEntry) {
      reset();
      router.push(`/journal/${savedEntry.id}`);
    }
  }, [savedEntry, reset, router]);

  const tagText = tags.join(", ");

  return (
    <div>
      <EchoPageHeading
        title="New reflection"
        description="Write freely. Mood and distress summaries are signals only, not diagnosis."
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_340px]">
        <EchoCard title="Entry editor">
          <div className="space-y-5">
            {error && (
              <EchoInlineMessage variant="error" message={error} />
            )}

            <div className="space-y-2">
              <label htmlFor="journal-title" className="text-sm font-medium text-foreground">
                Title {fieldErrors.title && <span className="text-danger text-xs">({fieldErrors.title[0]})</span>}
              </label>
              <input
                id="journal-title"
                className={`h-11 w-full rounded-xl border ${fieldErrors.title ? "border-danger" : "border-input"} bg-background px-4 text-sm text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10`}
                placeholder="What would you call this moment?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="journal-body" className="text-sm font-medium text-foreground">
                  Reflection {fieldErrors.body && <span className="text-danger text-xs">({fieldErrors.body[0]})</span>}
                </label>
                <span className="text-xs text-muted-foreground">
                  {wordCount} words · {charCount} characters
                </span>
              </div>
              <textarea
                id="journal-body"
                className={`min-h-64 w-full resize-none rounded-xl border ${fieldErrors.body ? "border-danger" : "border-input"} bg-background px-4 py-3 text-sm leading-6 text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/10`}
                placeholder="Write a few honest sentences. You do not need to make it polished."
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>

            <JournalMoodSelector value={mood} onChange={setMood} />

            <div className="space-y-2">
              <label htmlFor="journal-tags" className="text-sm font-medium text-foreground">
                Tags
              </label>
              <input
                id="journal-tags"
                className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                placeholder="sleep, walk, work"
                value={tagText}
                onChange={(e) => setTags(e.target.value.split(",").map((t) => t.trim()).filter(Boolean))}
              />
            </div>

            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={analysisConsent}
                onChange={(e) => setAnalysisConsent(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-input"
              />
              <span className="text-sm text-muted-foreground">
                Allow ECHO to generate a reflective summary of this entry
              </span>
            </label>

            <div className="flex items-center justify-between gap-3">
              <JournalAutosaveStatus autosaveStatus={autosaveStatus} isSaving={isSaving} />
              <div className="flex gap-3">
                <EchoButton variant="primary" size="medium" isLoading={isSaving} onClick={save}>
                  <Save className="h-4 w-4" aria-hidden="true" />
                  Save reflection
                </EchoButton>
              </div>
            </div>
          </div>
        </EchoCard>

        <aside className="space-y-5">
          <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-subtle">
            <Bot className="h-5 w-5 text-primary" aria-hidden="true" />
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Try: What part of today felt heavy, and what helped even a little?
            </p>
          </div>
          <PrivacyNotice />
        </aside>
      </div>
    </div>
  );
}
