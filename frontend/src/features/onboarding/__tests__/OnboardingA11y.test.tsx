import { render } from "../../../test-utils/test-utils";
import { axe } from "jest-axe";
import { ConsentCards } from "../components/consent-cards";

describe("ConsentCards accessibility", () => {
  it("has no violations", async () => {
    const { container } = render(
      <ConsentCards consentValues={{ terms: false, privacy: false, dataProcessing: false, aiInformation: false, journalAnalysis: false }} onConsentChange={() => {}} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
