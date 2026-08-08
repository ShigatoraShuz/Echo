import { render } from "../../../test-utils/test-utils";
import { axe } from "jest-axe";
import { EditableProfileForm } from "../components/editable-profile-form";

describe("EditableProfileForm accessibility", () => {
  it("has no violations", async () => {
    const { container } = render(
      <EditableProfileForm profile={{ displayName: "Alex", timezone: "UTC", themeVariant: "echo-calm", themeMode: "system" }} onSave={() => Promise.resolve()} isSaving={false} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
