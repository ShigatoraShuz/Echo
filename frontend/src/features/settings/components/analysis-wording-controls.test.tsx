import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import { AnalysisWordingControls } from "./analysis-wording-controls";
import { useAnalysisWording, formatAnalysisWording } from "@/shared/hooks/use-analysis-wording";
function Example() {
  const { label } = useAnalysisWording();
  return <p data-testid="analysis-label">{label("Depressed")}</p>;
}
afterEach(() => localStorage.clear());
it("defaults to gentle wording, switches live to original labels, and persists the choice", async () => {
  render(
    <>
      <AnalysisWordingControls />
      <Example />
    </>,
  );
  const toggle = screen.getByRole("switch", { name: "Use gentler analysis wording" });
  expect(toggle).toHaveAttribute("aria-checked", "true");
  expect(screen.getByTestId("analysis-label")).toHaveTextContent("Cloudy days");
  await userEvent.setup().click(toggle);
  expect(toggle).toHaveAttribute("aria-checked", "false");
  expect(screen.getByTestId("analysis-label")).toHaveTextContent("Depressed");
  expect(localStorage.getItem("echo:analysis-wording")).toBe("original");
  await userEvent.setup().click(toggle);
  expect(screen.getByTestId("analysis-label")).toHaveTextContent("Cloudy days");
});
it("maps display phrases without modifying source labels", () => {
  const original = "Depression / Depressed";
  expect(formatAnalysisWording(original, true)).toBe("Cloudy days / Cloudy days");
  expect(formatAnalysisWording(original, false)).toBe(original);
  expect(original).toBe("Depression / Depressed");
});
