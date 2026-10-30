import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import fixture from "../../../../../packages/contracts/fixtures/core-v2.json";
import { journalAnalysisV2ResultSchema, journalAnalysisV3ResultSchema } from "@echo/contracts";
import { NativeAnalysis } from "./native-analysis";

it("renders native categories and eight emotions without inventing screening estimates", () => {
  render(<NativeAnalysis result={journalAnalysisV2ResultSchema.parse(fixture)} />);
  expect(screen.getByText(`Journal category: ${fixture.distressCategory}`)).toBeInTheDocument();
  for (const item of fixture.emotionDistribution) expect(screen.getAllByText(item.emotion).length).toBeGreaterThan(0);
  expect(screen.getByText(/Facial analysis is unavailable/)).toBeInTheDocument();
  expect(screen.queryByText(/of 24/)).not.toBeInTheDocument();
});

it("shows a partial subtotal and never treats null criteria as zero", () => {
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
  expect(screen.getByText(/Partial subtotal: 2/)).toBeInTheDocument();
  expect(screen.getAllByText("Not evidenced in this journal")).toHaveLength(7);
  expect(screen.queryByText(/Complete model estimate/)).not.toBeInTheDocument();
});

it.each([
  { coverage: 0, value: null, label: /No criteria evidenced in this entry/ },
  { coverage: 1, value: 0, label: /Partial subtotal: 0/ },
  { coverage: 8, value: 0, label: /Complete model estimate: 0/ },
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
  expect(screen.getByText(/Estimated on/)).toBeInTheDocument();
  expect(screen.getByText(/shortened version/)).toBeInTheDocument();
});
