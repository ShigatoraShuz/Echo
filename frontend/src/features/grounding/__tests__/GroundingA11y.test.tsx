import { render } from "@/shared/test-utils/test-utils";
import { axe } from "jest-axe";
import { BoxBreathing } from "../components/box-breathing";

describe("BoxBreathing accessibility", () => {
  it("has no violations", async () => {
    const { container } = render(<BoxBreathing onComplete={() => {}} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
