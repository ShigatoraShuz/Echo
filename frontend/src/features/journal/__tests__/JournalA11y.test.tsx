import { render } from "@/shared/test-utils/test-utils";
import { axe } from "jest-axe";
import { JournalSearch } from "../components/journal-search";

describe("JournalSearch accessibility", () => {
  it("has no violations", async () => {
    const { container } = render(<JournalSearch value="" onChange={() => {}} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
