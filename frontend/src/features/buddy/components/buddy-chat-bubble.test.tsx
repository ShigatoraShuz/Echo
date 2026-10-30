import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { generationStageSchema } from "@echo/contracts";
import fixture from "../../../../../packages/contracts/fixtures/model-pipeline-v2.synthetic.json";
import { BuddyChatBubble } from "./buddy-chat-bubble";
describe("actual Buddy conversation attribution", () => {
  it("renders explicitly synthetic attribution in the actual chat bubble", () => {
    render(
      <BuddyChatBubble
        message={{
          id: "fixture",
          conversationId: "fictional",
          role: "buddy",
          content: "Fictional response",
          timestamp: "Now",
          generation: generationStageSchema.parse(fixture.stages.cbt),
        }}
      />,
    );
    expect(screen.getByText("SYNTHETIC E2E FIXTURE — no trained generation")).toBeInTheDocument();
  });
  it("does not describe an ordinary greeting as model generated", () => {
    render(
      <BuddyChatBubble
        message={{ id: "welcome", conversationId: "fictional", role: "buddy", content: "Welcome", timestamp: "Now" }}
      />,
    );
    expect(screen.queryByText(/trained generation|Experimental/)).not.toBeInTheDocument();
  });
});
