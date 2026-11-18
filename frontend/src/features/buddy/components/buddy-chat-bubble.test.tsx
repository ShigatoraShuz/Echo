import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { generationStageSchema } from "@echo/contracts";
import fixture from "../../../../../packages/contracts/fixtures/model-pipeline-v2.synthetic.json";
import { BuddyChatBubble } from "./buddy-chat-bubble";
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
it('offers message-specific read and stop controls only for completed Buddy replies',async()=>{
 const onReadAloud=vi.fn();
 const message={id:'saved',conversationId:'conversation',role:'buddy' as const,content:'Stored reply',timestamp:'Now'};
 const page=render(<BuddyChatBubble message={message} onReadAloud={onReadAloud}/>);
 await userEvent.setup().click(screen.getByRole('button',{name:'Read this reply aloud'}));expect(onReadAloud).toHaveBeenCalledOnce();
 page.rerender(<BuddyChatBubble message={message} onReadAloud={onReadAloud} speechState="preparing"/>);
 expect(screen.getByRole('button',{name:'Cancel preparing this reply'})).toBeInTheDocument();
 page.rerender(<BuddyChatBubble message={message} onReadAloud={onReadAloud} speechState="playing"/>);
 expect(screen.getByRole('button',{name:'Stop reading this reply'})).toBeInTheDocument();
 page.rerender(<BuddyChatBubble message={{...message,role:'user'}} onReadAloud={onReadAloud}/>);
 expect(screen.queryByRole('button')).not.toBeInTheDocument();
 page.rerender(<BuddyChatBubble message={{...message,isStreaming:true}} onReadAloud={onReadAloud}/>);
 expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
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
