/** Reproducible UI evidence only: real Professional components, fictional RPC fixtures. No live credentials or backend. Start the existing Vite harness on127.0.0.1:3101. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { fixtures, caseId, secondCaseId } from '../e2e/fixtures.ts';
const root = fileURLToPath(new URL('../../', import.meta.url));
const phase = process.argv[2];
if (!['before','after'].includes(phase)) throw Error('Use before or after.');
const output = path.join(root,'artifacts/professional-refinement',phase);
await fs.mkdir(output,{recursive:true});
const sizes = [[1366,768],[1440,900],[1690,900],[1920,1080],[768,1024],[390,844],[320,740]];
const scenes = [
  ['today-empty','/professional','empty'],['today-populated','/professional','populated'],
  ['requests-empty','/professional/requests','empty'],['requests-populated','/professional/requests','populated'],
  ['my-cases-empty','/professional/my-cases','empty'],['my-cases-populated','/professional/my-cases','populated'],
  ['calendar-empty','/professional/calendar','empty'],['calendar-clinician','/professional/calendar','populated'],['calendar-admin','/professional/calendar','admin'],
  ['resources-empty','/professional/resources','empty'],['resources-populated','/professional/resources','populated'],
  ['settings-profile','/professional/settings','populated'],['settings-identity','/professional/settings','identity'],
  ['notifications-empty','/professional','empty','notifications'],['notifications-populated','/professional','populated','notifications'],
  ['messages-empty','/professional','empty','messages'],['messages-list','/professional','populated','messages'],['messages-thread','/professional','populated','thread'],
  ['case-detail','/professional/cases/'+caseId,'case'],
  ['preview-today','/dev/professional-preview#today','preview'],['preview-my-cases','/dev/professional-preview#my-cases','preview'],['preview-calendar','/dev/professional-preview#calendar','preview']
];
// Load the unchanged real Echo font binaries already present locally. No font/network replacement in application source.
let fontCss = ':root{--font-echo-sans:"Manrope";--font-echo-display:"Cormorant Garamond"}';
for (const name of ['manrope_4b9c85e1','cormorant_garamond_82c3326b']) {
  const css = await fs.readFile(path.join(root,'frontend/tmp/professional-next/dev/static/chunks/[next]_internal_font_google_'+name+'_module_css_1igg3k2._.single.css'),'utf8');
  for (const face of css.match(/@font-face\s*\{[^}]*\}/g) ?? []) {
    const filename = face.match(/\.\.\/media\/([^"()]+\.woff2)/)?.[1];
    if (!filename) continue;
    const bytes = await fs.readFile(path.join(root,'frontend/.next-perf-build/static/media',filename));
    fontCss += face.replace(/url\("[^"()]+"\)/,'url(data:font/woff2;base64,'+bytes.toString('base64')+')').replaceAll('U+??,','U+0000-00FF,');
  }
}
const browser = await chromium.launch({ executablePath: process.env.ECHO_PERF_BROWSER_EXECUTABLE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true });
const results=[];
try {
 for (const [width,height] of sizes) for (const [scene,url,stateKind,overlay] of scenes) {
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',locale:'en-US',timezoneId:'Asia/Manila'});
  const page=await context.newPage(); const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await context.addInitScript(()=>{window.__professionalProfile=[];window.__layoutShifts=[];new PerformanceObserver(list=>{for(const entry of list.getEntries())if(!entry.hadRecentInput)window.__layoutShifts.push(entry.value)}).observe({type:'layout-shift',buffered:true})});
  const state=await fixtures(page);
  state.memberships=state.memberships.map(m=>({...m,organization:{...m.organization,name:'Fictional Echo Care Center'},displayName:'Fictional clinician'}));
  state.paginatedQueue=true;state.emptyQueue=stateKind==='empty';
  if(stateKind==='admin')state.memberships=state.memberships.map(m=>({...m,role:'org_admin'}));
  const third='fe000000-0000-4000-8000-000000000003';
  state.queueOverrides['org-one']=[
    {id:caseId,organizationId:'org-one',status:'assigned',assignedTo:'actor-one',createdAt:'2026-10-20T08:00:00Z',updatedAt:'2026-10-21T08:00:00Z'},
    {id:secondCaseId,organizationId:'org-one',status:'submitted',assignedTo:null,createdAt:'2026-10-21T08:00:00Z',updatedAt:'2026-10-21T08:00:00Z'},
    {id:third,organizationId:'org-one',status:'scheduled',assignedTo:'actor-one',createdAt:'2026-10-19T08:00:00Z',updatedAt:'2026-10-21T08:00:00Z'}
  ];
  if(stateKind==='populated')state.resources=[1,2].map(i=>({id:'fictional-resource-'+i,type:'crisis_hotline',countryCode:'PH',regionCode:null,organizationName:'Fictional support organization',name:'Fictional resource '+i,description:'Visual fixture only. No actual service or contact details.',availability:'Demo only — no actual availability',phoneNumber:null,smsNumber:null,websiteUrl:null,verificationSource:'https://example.invalid/source',lastVerifiedAt:'2026-01-01T00:00:00Z'}));
  state.notifications=stateKind==='empty'?[]:[{id:'fictional-update',kind:'case_updated',caseId,readAt:null,createdAt:'2026-10-21T08:00:00Z'},{id:'fictional-appointment',kind:'appointment_changed',caseId,readAt:'2026-10-21T09:00:00Z',createdAt:'2026-10-20T08:00:00Z'}];
  state.detail.messagingAvailable=true;
  const appointment={id:'fictional-appointment',requestId:third,startsAt:'2026-10-22T06:00:00Z',endsAt:'2026-10-22T07:00:00Z',mode:'online',status:'confirmed'};
  // Override the existing fictional aggregation to make capture counts internally consistent.
  await page.route('**/__fixtures/rpc', async route=>{
    const {method,args}=route.request().postDataJSON();
    if(method!=='dashboard')return route.fallback();
    state.calls.push({method,args});
    return route.fulfill({json:{organizationId:args[0],userId:'actor-one',asOf:'2026-10-21T04:00:00Z',counts:stateKind==='empty'?{pendingCount:0,activeCount:0,scheduledCount:0}:{pendingCount:1,activeCount:2,scheduledCount:1},appointments:stateKind==='empty'?[]:[appointment],appointmentTotal:stateKind==='empty'?0:1,appointmentLimit:5,scheduledCases:stateKind==='empty'?[]:[state.queueOverrides['org-one'][2]],scheduledLimit:3,clinicalAccess:stateKind!=='admin',followUpsAvailable:false}});
  });
  const start=performance.now();await page.goto('http://127.0.0.1:3101'+url,{waitUntil:'networkidle'});
  await page.addStyleTag({content:fontCss});await page.evaluate(()=>document.fonts.ready);
  await expect(page.locator('.pro-page-heading').first()).toBeVisible();
  await expect.poll(()=>page.locator('[aria-busy="true"]').count()).toBe(0);
  if(stateKind==='identity')await page.getByRole('button',{name:'Organization',exact:true}).click();
  if(overlay==='notifications'){await page.getByRole('button',{name:'Notifications',exact:true}).click();await expect(page.getByRole('dialog',{name:'Notifications',exact:true})).toBeVisible();await expect.poll(()=>page.locator('[aria-busy="true"]').count()).toBe(0);}
  if(overlay==='messages'||overlay==='thread'){
    await page.getByRole('button',{name:'Messages',exact:true}).click();await expect(page.getByRole('dialog',{name:'Messages',exact:true})).toBeVisible();
    if(stateKind==='empty')await expect(page.getByText('A quieter inbox',{exact:true})).toBeVisible();else await expect(page.locator('.pro-conversation').first()).toBeVisible();
    if(overlay==='thread'){await page.locator('.pro-conversation').first().click();await expect(page.locator('.pro-message-composer')).toBeVisible();}
  }
  const metrics=await page.evaluate(()=>{
    const round=n=>Math.round(n*10)/10;
    const rect=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {height:round(r.height),width:round(r.width),top:round(r.top),bottom:round(r.bottom),fontSize:s.fontSize,lineHeight:s.lineHeight,paddingTop:s.paddingTop,paddingBottom:s.paddingBottom,marginBottom:s.marginBottom}};
    const main=document.querySelector('#professional-content');
    return {viewport:{width:innerWidth,height:innerHeight},documentHeight:document.documentElement.scrollHeight,documentWidth:document.documentElement.scrollWidth,fit:document.documentElement.scrollHeight<=innerHeight+1,horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1,heading:rect(document.querySelector('.pro-page-heading')),title:rect(document.querySelector('.pro-page-heading h1')),header:rect(document.querySelector('.pro-command-header')),main:rect(main),panels:[...document.querySelectorAll('.pro-panel')].map(el=>({title:el.querySelector('h2')?.textContent,...rect(el)})),headings:[...document.querySelectorAll('h1,h2,h3')].map(el=>({text:el.textContent,...rect(el)})),scrollRegions:[...document.querySelectorAll('main *,[role="dialog"] *')].filter(el=>['auto','scroll'].includes(getComputedStyle(el).overflowY)&&el.scrollHeight>el.clientHeight+1).map(el=>({className:el.className,height:el.clientHeight,scrollHeight:el.scrollHeight})),layoutShift:window.__layoutShifts.reduce((a,b)=>a+b,0),renderMs:window.__professionalProfile.reduce((n,e)=>n+e.actualDuration,0),commits:window.__professionalProfile.length};
  });
  const filename=scene+'-'+width+'x'+height+'.png';await page.screenshot({path:path.join(output,filename),fullPage:false});
  results.push({scene,width,height,filename,phase,mode:'Mocked RPC UI QA; fictional data; unchanged locally cached Echo fonts',elapsedMs:Math.round(performance.now()-start),calls:state.calls.map(c=>c.method),errors,...metrics});
  await context.close();console.log(JSON.stringify({phase,scene,width,fit:metrics.fit,documentHeight:metrics.documentHeight,title:metrics.title.fontSize,horizontalOverflow:metrics.horizontalOverflow}));
  await fs.writeFile(path.join(root,'artifacts/professional-refinement',phase+'-measurements.json'),JSON.stringify({browser:browser.version(),mode:'Vite development / mocked RPC / no live backend or clinical records',results},null,2));
 }
} finally {await browser.close();}
console.log(JSON.stringify({phase,captures:results.length,errors:results.flatMap(r=>r.errors)}));
