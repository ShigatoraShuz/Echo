import { render } from "../../../test-utils/test-utils";
import { axe } from "jest-axe";
import { EditableProfileForm } from "../components/EditableProfileForm";

describe("EditableProfileForm accessibility", () => {
  it("has no violations", async () => {
    const { container } = render(<EditableProfileForm displayName="Alex" timezone="UTC" onSubmit={() => {}} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
