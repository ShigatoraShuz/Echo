import { render } from "../../../test-utils/test-utils";
import { axe } from "jest-axe";
import { EmotionOverviewCard } from "../components/emotion-overview-card";
import type { EmotionInsightSummary } from "../model/insights.model";

const summary: EmotionInsightSummary = {
  emotionWheel: [
    { label: "Calm", mood: "good", value: 45, color: "hsl(150, 30%, 65%)" },
    { label: "Anxious", mood: "bad", value: 20, color: "hsl(280, 20%, 60%)" },
    { label: "Sad", mood: "awful", value: 15, color: "hsl(220, 25%, 55%)" },
    { label: "Happy", mood: "great", value: 20, color: "hsl(45, 60%, 65%)" },
  ],
  moodTrend: [],
  summary: "Test summary",
  mostFrequentEmotions: [],
  positiveVsDifficult: { positive: 0, difficult: 0 },
};

describe("EmotionOverviewCard accessibility", () => {
  it("has no violations", async () => {
    const { container } = render(<EmotionOverviewCard summary={summary} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
