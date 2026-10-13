import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { buildReflectionActivityWeeks, ReflectionActivityGraph } from "./reflection-activity-graph";

describe("ReflectionActivityGraph", () => {
  it("shows the full 52-week range with empty activity intact", async () => {
    const weeks = buildReflectionActivityWeeks([], 52);
    expect(weeks).toHaveLength(52);
    expect(weeks.flat()).toHaveLength(364);
    expect(weeks.flat().every((day) => day.count === 0)).toBe(true);

    render(<ReflectionActivityGraph data={[]} weeks={52} />);
    const cells = screen.getAllByRole("gridcell");
    expect(cells).toHaveLength(364);
    expect(cells[0]).toHaveClass("echo-heatmap-tile");
    expect(Number.parseFloat(cells.at(-1)?.style.animationDelay ?? "0")).toBeGreaterThan(
      Number.parseFloat(cells[0].style.animationDelay),
    );
    fireEvent.focus(cells[0]);
    expect(cells[0].getAttribute("aria-label")).toContain("No reflections");
    expect(await screen.findByRole("tooltip")).toHaveTextContent("No reflections recorded");
  });
});
