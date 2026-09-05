"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import type { PolicyDocument } from "@/services/authentication/registration-api";

/** Deliberately limited Markdown: text, headings and lists. Never inject policy HTML. */
export function PolicyBody({ content }: { content: string }) {
  const blocks = content
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .trim()
    .split(/\n\s*\n/);
  return (
    <div className="space-y-5 text-sm leading-7 text-[#475448] sm:text-[15px]">
      {blocks.map((block, index) => {
        const lines = block.split("\n");
        if (/^#{1,3} /.test(lines[0])) {
          return (
            <section key={index} className="space-y-3 pt-3">
              <h3 className="text-xl font-semibold leading-snug text-[#203326]">{lines[0].replace(/^#{1,3} /, "")}</h3>
              {lines.length > 1 && <p>{lines.slice(1).join(" ")}</p>}
            </section>
          );
        }
        if (lines.every((line) => /^[-*] /.test(line))) {
          return (
            <ul key={index} className="list-disc space-y-3 pl-5 marker:text-[#526f35]">
              {lines.map((line, item) => (
                <li key={item}>{line.slice(2)}</li>
              ))}
            </ul>
          );
        }
        return <p key={index}>{lines.join(" ")}</p>;
      })}
    </div>
  );
}

/** Mount with key=policy.id so reaching the end never carries into another version. */
export function PolicyReviewDialog({
  policy,
  onAcknowledge,
  onClose,
}: {
  policy: PolicyDocument;
  onAcknowledge: (id: string) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const [reachedEnd, setReachedEnd] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const hintId = useId();
  const minutes = Math.max(1, Math.ceil(policy.sanitized_markdown.trim().split(/\s+/).length / 200));

  function checkEnd() {
    const node = scroll.current;
    if (node && node.clientHeight > 0 && node.scrollTop + node.clientHeight >= node.scrollHeight - 8) {
      setReachedEnd(true);
    }
  }

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = dialog.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    node?.showModal(); // Native top layer, inert background and keyboard focus containment.
    scroll.current?.focus();
    const frame = requestAnimationFrame(checkEnd);
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(checkEnd);
    if (scroll.current) observer?.observe(scroll.current);
    window.addEventListener("resize", checkEnd);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", checkEnd);
      node?.close();
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto flex max-h-[90svh] w-[calc(100%-1.5rem)] max-w-3xl flex-col overflow-hidden rounded-[1.5rem] border border-[#526f3525] bg-[#fffdf8] p-0 text-[#263226] shadow-2xl backdrop:bg-[#122018aa] sm:rounded-[2rem]"
    >
      <header className="flex shrink-0 items-start gap-4 border-b border-[#526f3520] px-5 py-5 sm:px-8">
        <div className="min-w-0 flex-1">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#526f35]">Read & understand</p>
          <h2 id={titleId} className="text-3xl leading-tight [font-family:var(--font-echo-display)]">
            {policy.title}
          </h2>
          <p className="mt-2 text-xs text-[#596255]">
            Version {policy.version} · About {minutes} min read
          </p>
          <p id={descriptionId} className="mt-3 text-sm leading-6 text-[#596255]">
            {policy.summary}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close for now"
          className="grid size-11 shrink-0 place-items-center rounded-full border border-[#526f3525] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#526f35]"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </header>
      <div
        ref={scroll}
        data-lenis-prevent
        role="region"
        aria-label={`${policy.title} document`}
        tabIndex={-1}
        onScroll={checkEnd}
        onKeyDown={(event) => {
          // Keep reading navigation local, including inside smooth-scroll page shells.
          if (event.target !== event.currentTarget || event.altKey || event.metaKey) return;
          const node = event.currentTarget;
          const page = Math.max(40, node.clientHeight - 40);
          const targets: Record<string, number> = {
            Home: 0,
            End: node.scrollHeight - node.clientHeight,
            PageDown: node.scrollTop + page,
            PageUp: node.scrollTop - page,
          };
          if (!(event.key in targets)) return;
          event.preventDefault();
          node.scrollTop = Math.max(0, targets[event.key]);
          checkEnd();
        }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-3 outline-offset-[-3px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#526f35] sm:px-8 [scrollbar-gutter:stable]"
      >
        <PolicyBody content={policy.sanitized_markdown} />
        <p className="mt-8 rounded-2xl bg-[#edf2e5] p-4 text-sm leading-6 text-[#3e512d]">
          End of document. Acknowledging marks this version as reviewed. It does not enable optional AI analysis.
        </p>
      </div>
      <footer className="shrink-0 border-t border-[#526f3520] bg-white px-5 py-4 sm:px-8">
        <p id={hintId} role="status" className="mb-3 text-center text-xs leading-5 text-[#596255]">
          {reachedEnd
            ? "Ready to acknowledge. You can also close and return later."
            : "Read to the end to enable acknowledgement. Use Page Down or End in the document."}
        </p>
        <button
          type="button"
          disabled={!reachedEnd}
          aria-describedby={hintId}
          onClick={() => {
            if (reachedEnd) {
              onAcknowledge(policy.id);
              onClose();
            }
          }}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#526f35] px-4 py-3 text-sm font-bold text-white transition-transform duration-150 enabled:active:scale-[.98] disabled:cursor-not-allowed disabled:bg-[#dce3d5] disabled:text-[#56624d] motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#526f35]"
        >
          <Check className="size-4" aria-hidden="true" /> Acknowledge and close
        </button>
      </footer>
    </dialog>
  );
}
