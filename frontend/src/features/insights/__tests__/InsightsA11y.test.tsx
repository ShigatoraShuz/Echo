import { render } from "@/shared/test-utils/test-utils";
import { axe } from "jest-axe";
import { EmotionTrendChart } from "../components/emotion-trend-chart";

describe("EmotionTrendChart accessibility", () => {
  it("has no violations", async () => {
    const { container } = render(
      <EmotionTrendChart points={[{ label: "Monday", value: 60, date: "2026-08-31" }]} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
