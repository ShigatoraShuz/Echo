import { render } from "../../../test-utils/test-utils";
import { axe } from "jest-axe";
import { MoodCheckIn } from "../components/MoodCheckIn";

describe("MoodCheckIn accessibility", () => {
  it("has no violations", async () => {
    const { container } = render(<MoodCheckIn onSelect={() => {}} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
