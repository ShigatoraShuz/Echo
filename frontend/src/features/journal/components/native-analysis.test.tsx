import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import fixture from "../../../../../packages/contracts/fixtures/core-v2.json";
import { journalAnalysisV2ResultSchema, journalAnalysisV3ResultSchema } from "@echo/contracts";
import { NativeAnalysis } from "./native-analysis";

it("renders native categories and eight emotions without inventing screening estimates", () => {
  render(<NativeAnalysis result={journalAnalysisV2ResultSchema.parse(fixture)} />);
  expect(screen.queryByText(`Journal category: ${fixture.distressCategory}`)).not.toBeInTheDocument();
  const meter=screen.getByRole('region',{name:'Journal PHQ8 meter'});
  fireEvent.click(screen.getByRole('switch',{name:'Deep analysis'}));
  expect(screen.getByText(`Journal category: ${fixture.distressCategory}`)).toBeInTheDocument();
  expect(screen.getByRole('region',{name:'Journal PHQ8 meter'})).toBe(meter);
  for (const item of fixture.emotionDistribution) expect(screen.getAllByText(item.emotion).length).toBeGreaterThan(0);
  expect(screen.getByText(/Facial analysis is unavailable/)).toBeInTheDocument();
  expect(screen.queryByText(/of 24/)).not.toBeInTheDocument();
});
it('resets Deep analysis on another entry while keeping the meter present',()=>{
 const result=journalAnalysisV2ResultSchema.parse(fixture);
 const view=render(<NativeAnalysis result={result} entryId="first"/>);
 fireEvent.click(screen.getByRole('switch',{name:'Deep analysis'}));
 expect(screen.getByRole('switch')).toBeChecked();
 view.rerender(<NativeAnalysis result={result} entryId="second"/>);
 expect(screen.getByRole('switch')).not.toBeChecked();
 expect(screen.queryByText(`Journal category: ${fixture.distressCategory}`)).not.toBeInTheDocument();
  expect(screen.getByRole('region',{name:'Journal PHQ8 meter'})).toBeInTheDocument();
  view.rerender(<NativeAnalysis result={result} entryId="first"/>);
  expect(screen.getByRole('switch')).not.toBeChecked();view.unmount();
});

it("shows a partial classification span without treating null criteria as zero", () => {
  const names = [
    "anhedonia",
    "depressed_mood",
    "sleep",
    "fatigue",
    "appetite",
    "worthlessness_guilt",
    "concentration",
    "psychomotor",
  ];
  const items = Object.fromEntries(names.map((k) => [k, k === "sleep" ? 2 : null]));
  render(
    <NativeAnalysis
      result={
        {
          ...fixture,
          schemaVersion: "echo-journal-analysis-v3",
          journalScreening: {
            status: "available",
            experimental: true,
            inferenceVersion: "test",
            items,
            coverage: 1,
            subtotal: 2,
            total: null,
          },
        } as never
      }
    />,
  );
  expect(screen.getByText('Partial estimate: minimal to severe')).toBeInTheDocument();
  expect(screen.queryByRole('meter')).not.toBeInTheDocument();
  expect(screen.getByRole('img',{name:/Journal-based PHQ8 estimate/})).not.toHaveAttribute('aria-valuenow');
  expect(screen.queryByText(/Partial subtotal/)).not.toBeInTheDocument();
  expect(screen.getAllByText("Not evidenced in this journal")).toHaveLength(7);
  expect(screen.getByText("Evidenced")).toBeInTheDocument();
  expect(screen.queryByText(/Complete model estimate/)).not.toBeInTheDocument();
});

it.each([
  { coverage: 0, value: null, label: /No criteria evidenced in this entry/ },
  { coverage: 1, value: 0, label: /Partial estimate: minimal to severe/ },
  { coverage: 8, value: 0, label: /^minimal$/ },
])("renders nulls and actual zeros distinctly ($coverage numeric criteria)", ({ coverage, value, label }) => {
  const names = [
    "anhedonia",
    "depressed_mood",
    "sleep",
    "fatigue",
    "appetite",
    "worthlessness_guilt",
    "concentration",
    "psychomotor",
  ];
  const items = Object.fromEntries(names.map((k, i) => [k, i < coverage ? value : null]));
  const result = journalAnalysisV3ResultSchema.parse({
    ...fixture,
    schemaVersion: "echo-journal-analysis-v3",
    journalScreening: {
      status: "available",
      experimental: true,
      inferenceVersion: "test",
      items,
      coverage,
      subtotal: coverage ? 0 : null,
      total: coverage === 8 ? 0 : null,
      generatedAt: "2026-10-30T00:00:00Z",
      truncated: true,
    },
  });
  render(<NativeAnalysis result={result} />);
  expect(screen.getByText(label)).toBeInTheDocument();
  expect(screen.queryAllByText("Not evidenced in this journal")).toHaveLength(8 - coverage);
  if (coverage > 0) expect(screen.getAllByText("Evidenced").length).toBe(coverage);
  expect(screen.getByText(/Estimated on/)).toBeInTheDocument();
  expect(screen.getByText(/shortened version/)).toBeInTheDocument();
});


it("presents complete and partial result states with accessible provenance", async () => {
  const { axe } = await import("jest-axe");
  const { container } = render(<NativeAnalysis result={journalAnalysisV3ResultSchema.parse({
    ...fixture, schemaVersion: "echo-journal-analysis-v3", journalScreening: {
      status: "failed", experimental: true, inferenceVersion: "fictional-unit", items: null, coverage: 0, subtotal: null, total: null,
    },
  })} />);
  expect(screen.getByText("Partial analysis")).toBeInTheDocument();
  expect(screen.getByText(/Journal estimate failed/)).toBeInTheDocument();
  expect(screen.getByText("Model provenance")).toBeInTheDocument();
  expect(screen.queryByText(/Complete model estimate/)).not.toBeInTheDocument();
  expect(await axe(container)).toHaveNoViolations();
});
