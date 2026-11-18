import { afterEach, describe, expect, it, vi } from "vitest";
import native from "../../../../packages/contracts/fixtures/core-v2.json";
import pipeline from "../../../../packages/contracts/fixtures/model-pipeline-v2.synthetic.json";
import { CoreClient } from "./core-client.js";

const token = "synthetic-core-contract-token-32-characters";
afterEach(() => vi.unstubAllGlobals());

describe("native core HTTP ownership", () => {
  it('distinguishes invalid speech requests and logs their actual status without private text',async()=>{
    const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('private text and traceback',{status:422})));
    try{
      await expect(new CoreClient('http://127.0.0.1:8000',token).talk({task:'prepare',text:'private approved text'})).rejects.toMatchObject({code:'BUDDY_SPEECH_REQUEST_INVALID'});
      const logs=warn.mock.calls.map(([value])=>String(value)).join(' ');
      expect(logs).toContain('"httpStatus":422');expect(logs).not.toContain('private text');expect(logs).not.toContain('private approved text');
    }finally{warn.mockRestore();}
  });
  it('retries typed Chat with fresh IDs and the same conversation',async()=>{
    const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
    const fetcher=vi.fn()
      .mockResolvedValueOnce(Response.json({detail:{code:'BUDDY_RESPONSE_WITHHELD',diagnostics:{blockingIssues:['unfinished_structure_or_clause'],attempts:2}}},{status:503}))
      .mockResolvedValueOnce(Response.json({text:'Open the document and write one heading.',supportRequired:'false'}));
    vi.stubGlobal('fetch',fetcher);
    const messages=[{role:'user' as const,content:'Synthetic assignment concern'}];
    try {
      const reply=await new CoreClient('http://127.0.0.1:8000',token).chat(messages);
      expect(reply.reply).toBe('Open the document and write one heading.');
      expect(fetcher.mock.calls.map(([,options])=>JSON.parse(options.body))).toEqual([{messages,generationAttempt:1},{messages,generationAttempt:2}]);
      expect(warn.mock.calls.map(([value])=>String(value)).join(' ')).toContain('unfinished_structure_or_clause');
    } finally {warn.mockRestore();}
  });
  it('stops typed Chat after five withholding responses',async()=>{
    const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
    const fetcher=vi.fn(async()=>Response.json({detail:{code:'BUDDY_RESPONSE_WITHHELD',diagnostics:{blockingIssues:['incomplete_list_item'],attempts:2}}},{status:503}));
    vi.stubGlobal('fetch',fetcher);
    try {
      await expect(new CoreClient('http://127.0.0.1:8000',token).chat([{role:'user',content:'Synthetic'}])).rejects.toMatchObject({code:'BUDDY_RESPONSE_WITHHELD'});
      expect(fetcher).toHaveBeenCalledTimes(5);
    } finally {warn.mockRestore();}
  });
  it('does not retry typed Chat safety withholding or rejected authentication',async()=>{
    const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
    const fetcher=vi.fn().mockResolvedValueOnce(Response.json({detail:{code:'BUDDY_RESPONSE_WITHHELD',diagnostics:{blockingIssues:['unqualified_give_up_requires_human_safety_review']}}},{status:503}));
    vi.stubGlobal('fetch',fetcher);
    const client=new CoreClient('http://127.0.0.1:8000',token);
    try {
      await expect(client.chat([{role:'user',content:'Synthetic'}])).rejects.toMatchObject({code:'BUDDY_RESPONSE_WITHHELD'});
      expect(fetcher).toHaveBeenCalledTimes(1);
      fetcher.mockClear();fetcher.mockResolvedValueOnce(new Response('',{status:401}));
      await expect(client.chat([{role:'user',content:'Synthetic'}])).rejects.toMatchObject({code:'AI_TRANSPORT_AUTH_FAILED'});
      expect(fetcher).toHaveBeenCalledTimes(1);
    } finally {warn.mockRestore();}
  });
  it('logs allowlisted Talk withholding reasons without exposing drafts',async()=>{
    const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({detail:{code:'BUDDY_RESPONSE_WITHHELD',diagnostics:{blockingIssues:['unfinished_structure_or_clause','private draft'],advisoryIssues:['stock_reassurance'],attempts:2,rawReply:'private draft'}}}),{status:503})));
    try {
      await expect(new CoreClient('http://127.0.0.1:8000',token).talk({task:'chat',deliveryMode:'voice',generationAttempt:2})).rejects.toMatchObject({code:'BUDDY_RESPONSE_WITHHELD'});
      const logs=warn.mock.calls.map(([value])=>String(value)).join(' ');
      expect(logs).toContain('unfinished_structure_or_clause');expect(logs).toContain('stock_reassurance');expect(logs).not.toContain('private draft');
    } finally {warn.mockRestore();}
  });
  it('forwards the existing classifier result with the unchanged analysis text',async()=>{
    const classification={distress_category:'Others',suicidal_language_flag:false,all_category_scores_relative_not_diagnoses:{Others:1,Anxious:0,Depressed:0,Frustrated:0,Suicidal:0},number_of_windows:1,validation_selected_suicidal_flag_threshold:.4};
    const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify(native)));vi.stubGlobal('fetch',fetcher);
    await new CoreClient('http://127.0.0.1:8000',token).analyze('Fictional',undefined,undefined,classification);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({text:'Fictional',classification});
  });
  it("uses only the native route and contract, without redirects or caching", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(native)));
    vi.stubGlobal("fetch", fetcher);
    expect(await new CoreClient("http://127.0.0.1:8000", token).analyze("Fictional")).toEqual(native);
    expect(fetcher).toHaveBeenCalledExactlyOnceWith("http://127.0.0.1:8000/v2/analyze", expect.objectContaining({
      redirect: "error", cache: "no-store", body: JSON.stringify({ text: "Fictional", language: "unknown" }),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    }));
  });

  it.each([pipeline, { unexpected: "fictional-private-output" }])("rejects wrong contracts with a sanitized unavailable error", async (output) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(output))));
    const failure = new CoreClient("http://127.0.0.1:8000", token).analyze("Fictional");
    await expect(failure).rejects.toMatchObject({ code: "AI_UNAVAILABLE", statusCode: 503, details: undefined });
    await expect(failure).rejects.not.toThrow("fictional-private-output");
  });

  it("does not fall back to engineering or a generated success when native is unavailable", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(new CoreClient("http://127.0.0.1:8000", token).analyze("Fictional")).rejects.toMatchObject({ code: "AI_UNAVAILABLE" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});


it("preserves the sanitized Talk-busy signal so Journal can wait without losing a valid job", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: { code: "TALK_BUSY" } }), { status: 503 })));
  await expect(new CoreClient("http://127.0.0.1:8000", token).analyze("Fictional")).rejects.toMatchObject({ code: "TALK_BUSY", statusCode: 503 });
});

it.each(["https://example.com", "http://127.0.0.1.example.com", "http://user:password@127.0.0.1:8000", "http://127.0.0.1:8000/other"]) ("rejects non-loopback origins and embedded credentials: %s", url => {
  expect(() => new CoreClient(url, token)).toThrow();
});
it("rejects oversized streamed model results without exposing them", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("x".repeat(1024 * 1024 + 1))));
  await expect(new CoreClient("http://127.0.0.1:8000", token).analyze("Fictional")).rejects.toMatchObject({ code: "AI_UNAVAILABLE" });
});

it("does not transmit an oversized text payload", async () => {
  const fetcher=vi.fn(); vi.stubGlobal("fetch", fetcher);
  await expect(new CoreClient("http://127.0.0.1:8000",token).analyze("x".repeat(65537))).rejects.toMatchObject({code:"AI_UNAVAILABLE"});
  expect(fetcher).not.toHaveBeenCalled();
});


it.each(['unavailable','failed'] as const)('keeps native emotion/distress results when optional PHQ is %s',async(status)=>{
  const partial={...native,schemaVersion:'echo-journal-analysis-v3',journalScreening:{status,experimental:true,
    inferenceVersion:'journal-nullable-v1',items:null,coverage:0,subtotal:null,total:null}};
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify(partial))));
  const result=await new CoreClient('http://127.0.0.1:8000',token).analyze('Synthetic reflection');
  expect(result.emotionDistribution).toEqual(native.emotionDistribution);
  expect(result.distressCategory).toEqual(native.distressCategory);
  expect(result.schemaVersion).toBe('echo-journal-analysis-v3');
  if(result.schemaVersion==='echo-journal-analysis-v3')expect(result.journalScreening).toMatchObject({status,items:null,total:null});
});


it.each([[401,'AI_TRANSPORT_AUTH_FAILED'],[403,'AI_TRANSPORT_AUTH_FAILED'],[429,'AI_TRANSPORT_RATE_LIMITED']] as const)('preserves sanitized transport status %s',async(status,code)=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('secret rejected draft',{status})));
 const pending=new CoreClient('http://127.0.0.1:8002',token).talk({task:'warm_nano',sessionId:'synthetic'});
 await expect(pending).rejects.toMatchObject({code});
 await expect(pending).rejects.not.toThrow('secret rejected draft');
});
it.each([['TimeoutError','AI_TRANSPORT_TIMEOUT'],['TypeError','AI_TRANSPORT_CONNECTION_FAILED']] as const)('preserves sanitized speech %s',async(name,code)=>{
 const failure=name==='TypeError'?new TypeError('secret path'):new DOMException('secret path',name);
 vi.stubGlobal('fetch',vi.fn().mockRejectedValue(failure));
 const pending=new CoreClient('http://127.0.0.1:8002',token).talk({task:'warm_nano'});
 await expect(pending).rejects.toMatchObject({code});await expect(pending).rejects.not.toThrow('secret path');
});
it('preserves Nano failures and accepts delayed warm-up without a second request',async()=>{
 let release!:(r:Response)=>void;
 const fetcher=vi.fn(()=>new Promise<Response>(r=>release=r));vi.stubGlobal('fetch',fetcher);
 const pending=new CoreClient('http://127.0.0.1:8002',token).talk({task:'warm_nano'});
 expect(fetcher).toHaveBeenCalledTimes(1);
 release(Response.json({detail:{code:'BUDDY_NANO_LOAD_TIMEOUT'}},{status:503}));
 await expect(pending).rejects.toMatchObject({code:'BUDDY_NANO_LOAD_TIMEOUT'});
 expect(fetcher).toHaveBeenCalledTimes(1);
});

it('distinguishes unavailable speech runtime from malformed successful output',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('private internal exception',{status:503})));
 await expect(new CoreClient('http://127.0.0.1:8002',token).talk({task:'warm_nano'})).rejects.toMatchObject({code:'AI_TRANSPORT_UNAVAILABLE'});
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('not-json')));
 await expect(new CoreClient('http://127.0.0.1:8002',token).talk({task:'warm_nano'})).rejects.toMatchObject({code:'AI_TRANSPORT_INVALID_RESPONSE'});
});

it('forwards journal preparation cancellation without adding client-supplied model data',async()=>{
 let received!:AbortSignal;
 const fetcher=vi.fn((_url,options)=>{received=options.signal;return new Promise((_resolve,reject)=>received.addEventListener('abort',()=>reject(new DOMException('Cancelled','AbortError')),{once:true}));});vi.stubGlobal('fetch',fetcher);
 const controller=new AbortController();const pending=new CoreClient('http://127.0.0.1:8002',token).journalRuntime('prepare',['a'.repeat(64)],[],controller.signal);
 expect(received.aborted).toBe(false);controller.abort();await expect(pending).rejects.toMatchObject({code:'AI_UNAVAILABLE'});
 expect(received.aborted).toBe(true);expect(fetcher).toHaveBeenCalledTimes(1);
 expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({action:'prepare',owners:['a'.repeat(64)],faceOwners:[]});
});

it('labels isolated Buddy safety failures without calling them Journal failures',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({detail:{code:'NATIVE_SAFETY_IMPORT_FAILED'}},{status:503})));
 const pending=new CoreClient('http://127.0.0.1:8002',token).talk({task:'warm_chat'});
 await expect(pending).rejects.toMatchObject({code:'NATIVE_SAFETY_IMPORT_FAILED'});
 await expect(pending).rejects.toThrow('Buddy safety screening failed');
});

it("preserves the optional experimental distress estimate through the native client", async () => {
  const output = { ...native, schemaVersion: "echo-journal-analysis-v3",
    journalScreening: { status: "unavailable", experimental: true, inferenceVersion: "test", items: null, coverage: 0, subtotal: null, total: null },
    distressEstimate: { status: "available", band: "high", experimental: true, method: "seallms-base-prompt",
      inferenceVersion: "journal-distress-rubric-v1", baseModel: "SeaLLMs/SeaLLMs-v3-7B-Chat", modelVersion: "a".repeat(64) },
  };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(output))));
  expect(await new CoreClient("http://127.0.0.1:8000", token).analyze("Fictional")).toEqual(output);
});
