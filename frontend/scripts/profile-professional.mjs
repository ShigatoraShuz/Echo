/** Local real-component profiling with synthetic HTTP fixtures. No credentials, live backend, or clinical records. Start the existing Vite harness on port 3101 first. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const memberships = ['org-one','org-two'].map(id=>({id:'membership-'+id,organizationId:id,organization:{id,slug:id,name:'Fictional '+id+' organization',description:'Synthetic',serviceHours:'Synthetic',status:'active'},role:'counselor',status:'active',displayName:'Fictional practitioner',credentialLabel:'Synthetic',credentialExpiresAt:'2099-12-31',accessState:'active'}));
const root = fileURLToPath(new URL('../../', import.meta.url));
const phase = process.argv[2] || 'current';
if (!/^[a-z0-9_-]+$/i.test(phase)) throw new Error('Use a simple alphanumeric output label.');
const nap = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ ...(process.env.ECHO_PERF_BROWSER_EXECUTABLE ? { executablePath: process.env.ECHO_PERF_BROWSER_EXECUTABLE } : { channel: process.env.ECHO_E2E_BROWSER_CHANNEL || 'msedge' }), headless: true });
  try {
  const results = [];
  for (const width of [1440,390]) for (const delay of [0,150]) for (let sample=0;sample<3;sample++) {
    const context = await browser.newContext({ viewport:{width,height:1000}, reducedMotion:'reduce' });
    await context.addInitScript(() => { window.__professionalProfile=[]; window.__longTasks=[]; new PerformanceObserver(list => window.__longTasks.push(...list.getEntries().map(e=>({startTime:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true}); });
    const page = await context.newPage();
    const calls=[]; const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname !== '127.0.0.1') return route.abort();
      if (url.pathname !== '/__fixtures/rpc') return route.continue();
      const {method,args} = route.request().postDataJSON();
      const call={method,organization:typeof args[0]==='string'?args[0]:undefined,start:performance.now()}; calls.push(call);
      if(delay) await nap(delay);
      let result;
      const request={id:'fe000000-0000-4000-8000-000000000001',organizationId:args[0],status:'assigned',assignedTo:'actor-one',createdAt:'2026-10-01T08:00:00Z',updatedAt:'2026-10-02T08:00:00Z'};
      if(method==='memberships') result={userId:'actor-one',mfaRequired:false,memberships};
      else if(method==='queue') result={requests:[request],page:{offset:0,limit:100,total:1,hasMore:false}};
      else if(method==='dashboard') result={organizationId:args[0],userId:'actor-one',asOf:new Date().toISOString(),counts:{pendingCount:0,activeCount:1,scheduledCount:0},appointments:[],appointmentTotal:0,appointmentLimit:5,scheduledCases:[],scheduledLimit:3,clinicalAccess:true,followUpsAvailable:false};
      else if(method==='resources') result=[];
      else throw new Error('Unexpected RPC '+method);
      call.end=performance.now(); return route.fulfill({json:result});
    });
    const ready=async kind=>{
      await page.waitForFunction(kind => {
        const text=document.body.innerText;
        if(kind==='resources') return text.includes('No reviewed crisis resources are available in this response.');
        if(kind==='calendar') return text.includes('No upcoming appointments');
        return /matching (requests|cases) from 1 loaded/.test(text);
      },kind,{polling:'raf'});
      await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    };
    const measure=async(label,kind,action)=>{
      const start=performance.now(), first=calls.length;
      const index=label === 'initial dashboard' ? 0 : await page.evaluate(()=>window.__professionalProfile.length).catch(()=>0);
      await action(); await ready(kind);
      const ms=performance.now()-start;
      const rendering=await page.evaluate(index=>({commits:window.__professionalProfile.slice(index).length,renderMs:window.__professionalProfile.slice(index).reduce((n,e)=>n+e.actualDuration,0)}),index);
      console.log(JSON.stringify({width,delay,sample,label,ms})); results.push({width,delay,sample,label,ms,...rendering,calls:calls.slice(first).map(c=>({method:c.method,organization:c.organization,startMs:c.start-start,durationMs:c.end-c.start})),errors:[...errors]});
    };
    // Warm modules using an unmeasured navigation, then use a fresh document for initial-load sampling.
    await page.goto('http://127.0.0.1:3101/professional?organization=org-one'); await ready('queue');
    await measure('initial dashboard','queue',()=>page.reload({waitUntil:'domcontentloaded'}));
    const click=async name=>{
      if(width<1024 && name==='Resources') { await page.getByRole('button',{name:'Open workspace menu'}).click(); await page.getByRole('dialog').getByRole('link',{name,exact:true}).click(); }
      else await page.getByRole('navigation',{name:width<1024?'Professional mobile navigation':'Professional workspace',exact:true}).getByRole('link',{name,exact:true}).click();
    };
    for (const [label,kind] of [['Requests','queue'],['My cases','queue'],['Calendar','calendar'],['Resources','resources'],['Today','queue']]) await measure('navigate '+label,kind,()=>click(label));
    await measure('switch organization','queue',()=>page.getByLabel('Active organization',{exact:true}).selectOption('org-two'));
    const nav = await page.evaluate(()=>{const n=performance.getEntriesByType('navigation')[0];return {ttfb:n.responseStart-n.startTime,domContentLoaded:n.domContentLoadedEventEnd-n.startTime,longTasks:window.__longTasks}});
    results.push({width,delay,sample,label:'document metrics',...nav});
    await context.close();
  }
  await fs.mkdir(path.join(root,'artifacts/professional-performance'),{recursive:true});
  await fs.writeFile(path.join(root,'artifacts/professional-performance',phase+'.json'),JSON.stringify({environment:{browser:browser.version(),mode:'Vite development harness, real portal components, synthetic HTTP RPC fixtures',delayDescription:'Fixed per-response delay in milliseconds; NOT observed backend latency',samples:3},results},null,2));
  console.log(JSON.stringify({phase,samples:results.length,errors:results.flatMap(r=>r.errors||[]) }));
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
