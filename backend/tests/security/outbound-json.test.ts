import { EventEmitter } from "node:events";
import { beforeEach,describe,it,expect,vi } from "vitest";
import { approvedOutboundUrl,isPublicAddress,postApprovedJson } from "../../src/infrastructure/security/outbound-json.js";
const m=vi.hoisted(()=>({lookup:vi.fn(),request:vi.fn(),status:200,body:"{}"}));
vi.mock("node:dns/promises",()=>({lookup:m.lookup}));
vi.mock("node:https",()=>({request:m.request}));
beforeEach(()=>{
 vi.clearAllMocks();
 m.status=200;m.body='{"ok":true}';m.lookup.mockResolvedValue([{address:"93.184.216.34",family:4}]);
 m.request.mockImplementation((_url,_options,callback)=>{
  const req=Object.assign(new EventEmitter(),{end:()=>queueMicrotask(()=>{
   const res=Object.assign(new EventEmitter(),{statusCode:m.status,resume:vi.fn(),destroy:vi.fn()});callback(res);res.emit("data",Buffer.from(m.body));res.emit("end");
  })});return req;
 });
});
describe("outbound SSRF boundary",()=>{
 it.each(["http://provider.example/v1","https://evil.example/v1","https://user:pass@provider.example/v1","https://127.0.0.1/v1","https://[::1]/v1","https://provider.example/v1?q=secret"])("rejects unsafe or unapproved URL %s",url=>expect(()=>approvedOutboundUrl(url,["https://provider.example"])).toThrow());
 it.each(["127.0.0.1","10.0.0.1","172.16.0.1","192.168.1.1","169.254.169.254","100.64.0.1","0.0.0.0","224.0.0.1","::1","::ffff:127.0.0.1","fe80::1","fc00::1","2001:db8::1","2002:7f00:1::","2001:20::1"])("rejects nonpublic address %s",address=>expect(isPublicAddress(address)).toBe(false));
 it("pins approved DNS and retains TLS hostname verification",async()=>{
  const url=approvedOutboundUrl("https://provider.example/v1",["https://provider.example"]);
  expect(await postApprovedJson(url,{},"{}",1000)).toEqual({ok:true});
  const options=m.request.mock.calls[0][1];expect(options).toMatchObject({servername:"provider.example",rejectUnauthorized:true,agent:false});
  const callback=vi.fn();options.lookup("provider.example",{all:false},callback);expect(callback).toHaveBeenCalledWith(null,"93.184.216.34",4);
  expect(m.lookup).toHaveBeenCalledOnce();
 });
 it("rejects mixed public/private DNS without opening a connection",async()=>{
  m.lookup.mockResolvedValue([{address:"93.184.216.34",family:4},{address:"169.254.169.254",family:4}]);
  await expect(postApprovedJson(new URL("https://provider.example"),{},"{}",1000)).rejects.toThrow("not public");expect(m.request).not.toHaveBeenCalled();
 });
 it("rejects redirects without following and caps response bytes",async()=>{
  m.status=302;await expect(postApprovedJson(new URL("https://provider.example"),{},"{}",1000)).rejects.toThrow("response rejected");expect(m.request).toHaveBeenCalledOnce();
  m.status=200;m.body="x".repeat(1_000_001);await expect(postApprovedJson(new URL("https://provider.example"),{},"{}",1000)).rejects.toThrow("limit");
 });
});
