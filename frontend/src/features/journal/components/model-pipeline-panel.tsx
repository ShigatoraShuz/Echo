"use client";
import type { ModelPipelineResult } from "@echo/contracts";

const titles = {
  peak: "Text emotion",
  distress: "Distress classification",
  phq8: "Experimental model-estimated PHQ-8",
  cbt: "CBT-informed reflection",
  face: "Face analysis",
};
export function ModelPipelinePanel({ result }: { result: ModelPipelineResult }) {
  return (
    <section
      className="min-w-0 rounded-3xl border border-primary/10 bg-card p-5 text-foreground sm:p-7"
      aria-label="Independent model analysis"
    >
      <h2 className="font-[family-name:var(--font-echo-display)] text-2xl font-semibold">Private journal analysis</h2>
      <p className="mt-2 text-sm text-foreground/80">
        {result.isSimulated
          ? "SYNTHETIC E2E FIXTURE — fictional outputs, no trained inference."
          : "Provisional research outputs — not clinically validated or a risk assessment."}
      </p>
      <p className="mt-2 text-sm font-semibold">Analysis status: {result.overallStatus}</p>
      <div className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2">
        {Object.entries(result.stages).map(([key, stage]) => (
          <article key={key} className="min-w-0 rounded-2xl border border-border bg-background p-4">
            <h3 className="text-sm font-semibold">{titles[key as keyof typeof titles]}</h3>
            <p className="mt-1 text-xs capitalize text-foreground/80">
              {stage.status} · {stage.executionMode}
            </p>
            <p className="mt-1 text-xs font-semibold">{stage.executionState ?? (stage.status === "completed" ? stage.executionMode === "synthetic" ? "DEMO_FALLBACK" : "REAL_PROVISIONAL_MODEL" : "UNAVAILABLE")}</p>
            <p className="mt-2 break-words text-xs text-foreground/80">
              {stage.modelId ?? "No model enabled"}
              {stage.modelVersion ? ` @ ${stage.modelVersion}` : ""}
            </p>
            {stage.errorCode ? (
              <p className="mt-2 break-words text-sm text-foreground/80">
                Unavailable: {stage.errorCode.replaceAll("_", " ").toLowerCase()}.{" "}
                {key === "face" ? "Trusted face export is not ready." : "Other available stages are preserved."}
                {key === "peak" ? " Your journal mood is self-reported, not inferred emotion." : ""}
                {key === "phq8" ? " The separate self-reported questionnaire is available from Dashboard Check-in." : ""}
              </p>
            ) : null}
            {key === "peak" || key === "distress"
              ? (() => {
                  const output = result.stages[key].result;
                  return output ? (
                    <>
                      <ul className="mt-3 space-y-2" aria-label={`${titles[key]} top five`}>
                        {output.topFive.map((score) => (
                          <li key={score.label} className="flex min-w-0 justify-between gap-3 text-sm">
                            <span className="break-words">{score.label}</span>
                            <span className="shrink-0 tabular-nums">{(score.probability * 100).toFixed(1)}%</span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3 text-xs text-foreground/80">{output.calibration}</p>
                      {key === "distress" ? (
                        <p className="mt-2 text-xs text-foreground/80">
                          {output.supportFlags === null
                            ? "Support mapping unavailable; no flags inferred."
                            : output.supportFlags.length
                              ? `Reviewed support flags: ${output.supportFlags.join(", ")}`
                              : "No mapped support flags."}{" "}
                          This is not a suicide or self-harm risk assessment.
                        </p>
                      ) : null}
                    </>
                  ) : null;
                })()
              : null}
            {key === "phq8" && result.stages.phq8.result ? (
              <>
                <p className="mt-3 text-lg font-semibold">
                  {result.stages.phq8.result.complete
                    ? `Model-estimated total: ${result.stages.phq8.result.total} / 24`
                    : `Partial subtotal: ${result.stages.phq8.result.subtotal}`}
                </p>
                <p className="mt-1 text-sm">{result.stages.phq8.result.scored_symptom_count} of 8 symptoms scored</p>
                <dl className="mt-3 space-y-1 text-xs">
                  {Object.entries(result.stages.phq8.result.items).map(([name, value]) => (
                    <div key={name} className="flex justify-between gap-2">
                      <dt className="break-words">{name.replaceAll("_", " ")}</dt>
                      <dd>{value === null ? "Unknown" : value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-xs text-foreground/80">
                  {result.stages.phq8.result.timeFrame}{" "}
                  {result.stages.phq8.result.complete
                    ? ""
                    : "No complete score or severity is inferred from this subtotal."}{" "}
                  Separate from your self-reported questionnaire.
                </p>
              </>
            ) : null}
            {key === "cbt" && result.stages.cbt.result ? (
              <>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">
                  {result.stages.cbt.result.text}
                </p>
                <p className="mt-3 text-xs text-foreground/80">{result.stages.cbt.result.disclaimer}</p>
              </>
            ) : null}
            <p className="mt-3 break-words text-[11px] text-foreground/80">
              {new Date(stage.timestamp).toLocaleString()} · {stage.durationMs} ms
            </p>
          </article>
        ))}
      </div>
      {result.researchDiagnostic ? <section className="mt-5 rounded-2xl border border-border p-4" aria-label="Local fictional research demonstration">
        <h3 className="font-semibold">REAL_PROVISIONAL_MODEL · Local fictional research demonstration</h3>
        <p className="mt-2 text-sm">Unvalidated raw classifier outputs. Dataset class names are not diagnoses or suicide-risk findings. No probabilities, calibration, thresholds, clinical decisions or eligibility decisions are derived from these logits.</p>
        <p className="mt-2 break-words text-xs">{result.researchDiagnostic.modelId} @ {result.researchDiagnostic.modelVersion}</p>
        <ul className="mt-3 space-y-1 text-sm" aria-label="Raw dataset class logits">{result.researchDiagnostic.labels.map((label, index) => <li key={label} className="flex justify-between gap-3"><span>{label}</span><span>{result.researchDiagnostic!.rawLogits[index].toFixed(5)} raw logit</span></li>)}</ul>
        <p className="mt-3 text-xs">Verified: exact tensor loading, saved tokenizer, {result.researchDiagnostic.windows} window(s), {result.researchDiagnostic.inputTokens} input tokens{result.researchDiagnostic.maxInputTokens ? ` / ${result.researchDiagnostic.maxInputTokens} limit` : ""}, repeated full classifier forward. Unverified: training preprocessing, classification semantics and reference parity. {result.researchDiagnostic.calibrationBinding === "mismatch_unresolved" ? "Calibration hash mismatch remains unresolved." : "No verified calibration is applied."}</p>
        <p className="mt-2 text-xs">Validation/load {result.researchDiagnostic.validationAndLoadMs} ms · repeated forwards {result.researchDiagnostic.forwardMs.join(" / ")} ms</p>
      </section> : null}
      {result.researchDiagnosticError ? <p role="status" className="mt-4 text-sm">Research demo unavailable: {result.researchDiagnosticError.replaceAll("_", " ").toLowerCase()}. Check the selected model and documented input limit. Your reflection and other results are preserved.</p> : null}
      <p className="mt-4 text-xs text-foreground/80">
        Grounding remains available as a separately reviewed static resource. It is not a model-generated
        recommendation. These results are private to your authorized account.
      </p>
    </section>
  );
}
