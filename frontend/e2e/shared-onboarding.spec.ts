import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {fixtures, secondCaseId} from "./fixtures";

// Browser/controller integration with intercepted fictional RPC; never live Supabase E2E.
for(const width of [390,1440]) {
 test("applicant completes MFA and submits one pending application at "+width+"px",async({page},testInfo)=>{
  const state=await fixtures(page);state.memberships=[];state.mfaRequired=true;
  const applications:unknown[]=[];const applicationOrg="fc000000-0000-4000-8000-000000000001";
  await page.route('**/__fixtures/rpc',async route=>{
   const {method,args}=route.request().postDataJSON();
   if(method==='organizations')return route.fulfill({json:{organizations:[{id:applicationOrg,name:'Fictional organization',status:'active'}]}});
   if(method==='credentials')return route.fulfill({json:{credentials:applications}});
   if(method==='submitCredential'){state.calls.push({method,args});applications.push({id:'fictional-credential',userId:'actor-one',...args[0],status:'pending',reviewStatus:'pending',submittedAt:'2026-10-22T00:00:00Z',reviewedAt:null,reviewedBy:null,reasonCode:null,evidenceReference:undefined});return route.fulfill({json:{credential:applications[0]}});}
   return route.fallback();
  });
  await page.setViewportSize({width,height:900});await page.goto('/professional/access');
  await expect(page.getByRole('form',{name:'Professional application'})).toHaveCount(0);
  await page.getByRole('button',{name:'Verify authenticator to apply'}).click();await page.getByLabel('Authenticator code').fill('123456');await page.getByRole('button',{name:'Verify and continue'}).click();
  const form=page.getByRole('form',{name:'Professional application'});await expect(form).toBeVisible();
  await form.getByLabel('Organization',{exact:false}).selectOption(applicationOrg);await form.getByLabel('Professional role',{exact:false}).selectOption('counselor');await form.getByLabel('Qualification label',{exact:false}).fill('SYNTHETIC THESIS DEMO — not a license');await form.getByLabel('Credential expiry date',{exact:false}).fill('2099-01-01');await form.getByLabel('Evidence reference',{exact:false}).fill('Fictional owner-approved manifest reference for local QA only.');
  await form.getByRole('button',{name:'Submit application',exact:true}).click();await expect(page.getByText('Pending approval',{exact:true})).toBeVisible();
  expect(state.calls.filter(call=>call.method==='submitCredential')).toHaveLength(1);expect(state.calls.filter(call=>call.method==='approveMember')).toHaveLength(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
  expect((await new AxeBuilder({page}).include('main').withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
  await page.screenshot({path:testInfo.outputPath('mocked-application-'+width+'.png'),fullPage:true});
 });
 test("org_admin assigns from Requests without clinical access at "+width+"px",async({page},testInfo)=>{
  const state=await fixtures(page);state.memberships.forEach(item=>{item.role='org_admin'});
  await page.setViewportSize({width,height:900});await page.goto('/professional/requests?organization=org-one');
  expect(state.calls.filter(call=>call.method==='caseDetail')).toHaveLength(0);
  await page.getByRole('button',{name:'Assign practitioner',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Assign practitioner',exact:true});
  await dialog.getByLabel('Practitioner',{exact:true}).selectOption('fictional-profile');await dialog.getByRole('button',{name:'Confirm assignment'}).click();
  await expect(page.getByText(/Assigned Fictional clinician to request/)).toBeVisible();expect(state.calls.filter(call=>call.method==='assign')).toEqual([{method:'assign',args:[secondCaseId,'fictional-profile']}]);expect(state.calls.filter(call=>call.method==='caseDetail')).toHaveLength(0);await expect(page.getByRole('link',{name:'Open case',exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);await page.screenshot({path:testInfo.outputPath('mocked-assignment-'+width+'.png'),fullPage:true});
 });
 test("reviewer makes separate credential and membership decisions at "+width+"px",async({page},testInfo)=>{
  const state=await fixtures(page);let credential={id:'fictional-credential',organizationId:'org-one',userId:'fictional-applicant',role:'counselor',credentialLabel:'SYNTHETIC THESIS DEMO — not a license',expiresAt:'2099-01-01',status:'pending',reviewStatus:'pending',submittedAt:'2026-10-22T00:00:00Z',reviewedAt:null,reviewedBy:null,reasonCode:null};
  await page.route('**/__fixtures/rpc',async route=>{const {method,args}=route.request().postDataJSON();if(!['adminCredentials','adminCredential','decideCredential','approveMember'].includes(method))return route.fallback();state.calls.push({method,args});if(method==='adminCredentials')return route.fulfill({json:{credentials:[credential]}});if(method==='adminCredential')return route.fulfill({json:{credential:{...credential,evidenceReference:'Fictional demo manifest reference. Not a professional license.'}}});if(method==='decideCredential'){credential={...credential,status:'approved',reviewStatus:'approved'};return route.fulfill({json:{credential}})}return route.fulfill({json:{membershipId:'fictional-membership'}});});
  await page.setViewportSize({width,height:900});await page.goto('/__qa/professional-review');
  await page.getByRole('button',{name:'Review application',exact:true}).click();await page.getByRole('checkbox',{name:/independently checked/}).check();await page.getByRole('button',{name:'Approve synthetic reference',exact:true}).click();await expect(page.getByText(/Review decision saved/)).toBeVisible();expect(state.calls.filter(call=>call.method==='approveMember')).toHaveLength(0);
  await page.getByRole('button',{name:'Review application',exact:true}).click();await page.getByLabel('Approved professional display name').fill('Echo Demo Counselor');await page.getByRole('checkbox',{name:/separate membership activation/}).check();
  // Exercise browser visibility events that Alt-Tab produces; RPC stays fictional.
  const readsBeforeHide=state.calls.filter(call=>call.method==='adminCredential').length;
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
  await expect(page.getByText('Fictional demo manifest reference. Not a professional license.',{exact:true})).toHaveCount(0);
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('focus'));});
  await expect(page.getByLabel('Approved professional display name')).toHaveValue('Echo Demo Counselor');
  await expect(page.getByRole('checkbox',{name:/separate membership activation/})).toBeChecked();
  await expect(page.getByRole('button',{name:'Activate approved membership',exact:true})).toBeDisabled();
  expect(state.calls.filter(call=>call.method==='adminCredential')).toHaveLength(readsBeforeHide);
  await page.getByRole('button',{name:'Reopen protected evidence',exact:true}).click();
  await expect(page.getByText('Fictional demo manifest reference. Not a professional license.',{exact:true})).toBeVisible();
  await expect(page.getByLabel('Approved professional display name')).toHaveValue('Echo Demo Counselor');
  await page.getByRole('button',{name:'Activate approved membership',exact:true}).click();await expect(page.getByText(/Professional membership activated/)).toBeVisible();
  expect((state.calls.find(call=>call.method==='approveMember')!.args[0] as {credentialId:string}).credentialId).toBe('fictional-credential');expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
  await page.screenshot({path:testInfo.outputPath('mocked-review-'+width+'.png'),fullPage:true});
 });
}
