import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fixtures } from "./fixtures";
async function navigate(page: Page, label: string, width: number) {
  if (width < 1024 && ["Resources", "Settings"].includes(label)) {
    await page.getByRole("button", { name: "Open workspace menu" }).click(); await page.getByRole("dialog", { name: "Your workspace" }).getByRole("link", { name: label, exact: true }).click();
  } else await page.getByRole("navigation", { name: width < 1024 ? "Professional mobile navigation" : "Professional workspace", exact: true }).getByRole("link", { name: label, exact: true }).click();
}
for (const width of [320,375,390,430,768,1024,1440,1690]) test(width + "px clinician demo uses shared screens, inert clinical controls and no APIs", async ({ page }) => {
  const state = await fixtures(page); await page.setViewportSize({ width, height: 1000 });
  await page.goto("/dev/professional-preview?returnOrganization=org-one");
  await expect(page.getByText("Demo Preview — Fictional Data", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Demo organization")).toBeDisabled();
  for (const label of ["My cases", "Calendar", "Resources", "Settings", "Requests", "Today"]) {
    await navigate(page,label,width); await expect(page.locator("main h1")).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await expect(page.getByRole("link", { name: "Exit Preview", exact: true })).toHaveAttribute("href", "/professional?organization=org-one");
  }
  await navigate(page,"My cases",width);
  await page.getByRole("button", { name: "Closed", exact: true }).click(); await expect(page.getByRole("heading", { name: "Case DEMO1003", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "All cases", exact: true }).click();
  await page.locator(".pro-record").filter({ has: page.getByRole("heading", { name: "Case DEMO1001", exact: true }) }).getByRole("button", { name: "Open demo case", exact: true }).click();
  await expect(page.getByRole("list", { name: "Case activity timeline" })).toContainText("Case assigned");
  await expect(page.getByLabel("New case note")).toBeDisabled(); await expect(page.getByRole("button", { name: "Save note", exact: true })).toBeDisabled(); await expect(page.getByRole("button", { name: "Record referral", exact: true })).toBeDisabled();
  await page.getByText("Fictional reflection — a calmer week", { exact: true }).click(); await expect(page.getByText(/Fictional reflection for the Echo clinician demonstration/)).toBeVisible();
  await page.getByLabel("Fictional sharing state").selectOption("revoked"); await expect(page.getByText(/Fictional reflection for the Echo clinician demonstration/)).toHaveCount(0);
  await page.getByRole("button", { name: "Messages", exact: true }).click();
  const drawer=page.getByRole("dialog", { name: "Messages", exact: true });
  await drawer.getByRole("button", { name: /Case DEMO1001/ }).click(); await expect(drawer.getByText(/Fictional message: I would like/)).toBeVisible(); await expect(drawer.getByRole("button", { name: "Send", exact: true })).toBeDisabled();
  const box=await drawer.boundingBox(); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x+box!.width).toBeLessThanOrEqual(width); expect(box!.height).toBe(1000);
  if ([390,1440].includes(width)) expect((await new AxeBuilder({ page }).include('[role="dialog"]').withTags(["wcag2a","wcag2aa"]).analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape"); await expect(page.getByRole("button", { name: "Messages", exact: true })).toBeFocused();
  await page.getByLabel("Clinician persona").selectOption("psychologist"); await expect(page.getByRole("heading", { name: "Case DEMO2001", exact: true })).toBeVisible(); await expect(page.getByRole("heading", { name: /DEMO100/ })).toHaveCount(0);
  await page.getByLabel("Clinician persona").selectOption("social_worker"); await expect(page.getByRole("heading", { name: "Case DEMO3001", exact: true })).toBeVisible();
  const stored=await page.evaluate(()=>JSON.stringify({ ...localStorage, ...sessionStorage })); expect(stored).not.toContain("DEMO3001"); expect(stored).not.toContain("demo-social_worker");
  expect(state.calls).toEqual([]);
});
for(const width of [390,1440]) test(width+"px admin enters/exits preview with unchanged real permissions", async({page})=>{
  const state=await fixtures(page); state.memberships.forEach(item=>{item.role="org_admin"});const initialMemberships=structuredClone(state.memberships);
  await page.setViewportSize({width,height:1000});await page.goto("/professional/settings?organization=org-one");
  await page.getByRole("link",{name:"Preview as Professional",exact:true}).click();await expect(page.getByText("Demo Preview — Fictional Data",{exact:true})).toBeVisible();
  const boundary=state.calls.length;await navigate(page,"My cases",width);await page.getByRole("button",{name:"Messages",exact:true}).click();await page.getByRole("dialog").getByRole("button",{name:/Case DEMO1001/}).click();await page.keyboard.press("Escape");
  expect(state.calls.slice(boundary)).toEqual([]);expect(state.memberships).toEqual(initialMemberships);
  await page.getByRole("link",{name:"Exit Preview",exact:true}).click();await expect(page).toHaveURL(/professional\?organization=org-one$/);
  await navigate(page,"My cases",width);await expect(page.getByRole("heading",{name:"A workspace for your role"})).toBeVisible();
  await page.getByRole("button",{name:"Messages",exact:true}).click();await expect(page.getByText("Conversations stay with the care team",{exact:true})).toBeVisible();
  expect(state.calls.filter(call=>["caseDetail","caseMessages","sendCaseMessage","markCaseMessagesRead","addNote","proposeAppointment","assign","claim"].includes(call.method))).toEqual([]);expect(state.memberships).toEqual(initialMemberships);
});
test("unknown URL IDs stay local; history/reload cannot retain another persona",async({page})=>{
  const state=await fixtures(page);await page.goto("/dev/professional-preview#case/real-patient-id");await expect(page.getByRole("heading",{name:"Unknown demo case"})).toBeVisible();
  await page.getByLabel("Clinician persona").selectOption("social_worker");await expect(page.getByRole("heading",{name:"Case DEMO3001",exact:true})).toBeVisible();
  await page.locator(".pro-record").filter({has:page.getByRole("heading",{name:"Case DEMO3001",exact:true})}).getByRole("button",{name:"Open demo case",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Case DEMO3001",exact:true})).toBeVisible();await page.goBack();await expect(page.getByRole("heading",{name:"My cases",exact:true})).toBeVisible();
  await page.reload();await expect(page.getByLabel("Clinician persona")).toHaveValue("counselor");await expect(page.getByRole("heading",{name:"Case DEMO1001",exact:true})).toBeVisible();expect(state.calls).toEqual([]);
});
test("the clinician preview entry is absent for real clinician settings",async({page})=>{await fixtures(page);await page.goto("/professional/settings?organization=org-one");await expect(page.getByLabel("Display name",{exact:true})).toBeVisible();await expect(page.getByRole("link",{name:"Preview as Professional",exact:true})).toHaveCount(0)});
