import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { JournalFaceCapture } from "./journal-face-capture";

const original=Object.getOwnPropertyDescriptor(navigator,"mediaDevices");
afterEach(()=>{
  vi.unstubAllGlobals();
  if(original) Object.defineProperty(navigator,"mediaDevices",original);
  else Reflect.deleteProperty(navigator,"mediaDevices");
});
it("stops a camera that resolves after the component unmounts",async()=>{
  let resolve!: (value:unknown)=>void;
  const stop=vi.fn();
  Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia:()=>new Promise(r=>{resolve=r;})}});
  const view=render(<JournalFaceCapture requested onRequestedChange={()=>{}} />);
  fireEvent.click(screen.getByRole("button",{name:"Start camera"}));
  view.unmount();
  await act(async()=>resolve({getTracks:()=>[{stop}]}));
  expect(stop).toHaveBeenCalledOnce();
});
it("stops tracks and terminates the worker after model initialization fails",async()=>{
  vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue(null);
  const stop=vi.fn();const terminate=vi.fn();
  let worker!: FakeWorker;
  class FakeWorker {
    onmessage: ((event:MessageEvent)=>void)|null=null;
    onerror: (()=>void)|null=null;
    terminate=terminate;
    postMessage=vi.fn();
    constructor(){worker=this;}
  }
  vi.stubGlobal("Worker",FakeWorker);
  Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia:async()=>({getTracks:()=>[{stop}]})}});
  render(<JournalFaceCapture requested onRequestedChange={()=>{}} />);
  fireEvent.click(screen.getByRole("button",{name:"Start camera"}));
  await waitFor(()=>expect(worker).toBeDefined());
  await act(async()=>worker.onmessage?.({data:{type:"error"}} as MessageEvent));
  expect(stop).toHaveBeenCalledOnce();expect(terminate).toHaveBeenCalledOnce();
});
