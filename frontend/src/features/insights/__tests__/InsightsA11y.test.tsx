import { render } from "../../../test-utils/test-utils";
import { axe } from "jest-axe";
import { EmotionOverviewCard } from "../components/EmotionOverviewCard";

describe("EmotionOverviewCard accessibility", () => {
  it("has no violations", async () => {
    const { container } = render(
      <EmotionOverviewCard calmPercentage={45} anxiousPercentage={20} sadPercentage={15} happyPercentage={20} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
