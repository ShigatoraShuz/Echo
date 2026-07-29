import { render } from "../../../test-utils/test-utils";
import { axe } from "jest-axe";
import { ConsentCards } from "../components/ConsentCards";

describe("ConsentCards accessibility", () => {
  it("has no violations", async () => {
    const { container } = render(
      <ConsentCards consents={{ terms: false, privacy: false, dataProcessing: false, aiInformation: false, journalAnalysis: false }} onToggle={() => {}} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
