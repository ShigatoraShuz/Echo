import { expect, test } from "@playwright/test";
import { fixtures } from "./fixtures";

// Layout regressions use the isolated RPC harness, never live clinical records.
const sizes = [[1366,768],[1440,900],[1690,900],[1920,1080],[768,1024],[390,844],[320,740]];
const routes = ["", "/requests", "/my-cases", "/calendar", "/resources", "/settings"];
for (const [width, height] of sizes) {
  test("compact workspace stays readable and contained at " + width + "x" + height, async ({ page }) => {
    const state = await fixtures(page);
    state.emptyQueue = true;
    await page.setViewportSize({width, height});
    for (const route of routes) {
      await page.goto("/professional" + route + "?organization=org-one");
      await expect(page.locator(".pro-page-heading h1")).toBeVisible();
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
      const layout = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        title: parseFloat(getComputedStyle(document.querySelector(".pro-page-heading h1")!).fontSize),
        overflow: getComputedStyle(document.documentElement).overflowY,
      }));
      expect(layout.width, route).toBe(width);
      expect(layout.title, route).toBeGreaterThanOrEqual(25);
      expect(layout.title, route).toBeLessThanOrEqual(32);
      expect(layout.overflow, route).not.toBe("hidden");
      for (const control of await page.locator('.pro-page-heading button, .pro-command-icon:visible, .pro-organization select').all()) {
        expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
    }
  });
}
for (const width of [1440,1690]) {
  test("ordinary low-data pages fit a " + width + "x900 desktop without clipping", async ({ page }) => {
    await fixtures(page);
    await page.setViewportSize({width,height:900});
    for (const route of routes) {
      await page.goto("/professional" + route + "?organization=org-one");
      await expect(page.locator(".pro-panel").first()).toBeVisible();
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollHeight), route).toBeLessThanOrEqual(900);
    }
  });
}

test("reduced motion keeps surfaces stationary and keyboard drawer entry immediate", async ({ page }) => {
  await fixtures(page);
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto("/professional?organization=org-one");
  const trigger = page.getByRole("button",{name:"Messages",exact:true});
  await trigger.focus(); await page.keyboard.press("Enter");
  const drawer = page.getByRole("dialog",{name:"Messages",exact:true});
  await expect(drawer).toBeVisible();
  expect(await drawer.evaluate(element => ({animations: element.getAnimations({subtree:true}).length,transform:getComputedStyle(element).transform}))).toEqual({animations:0,transform:"none"});
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("desktop demo disclosure precedes the dashboard and keeps Exit Preview accessible", async ({ page }) => {
  await fixtures(page);
  await page.setViewportSize({width:1690,height:900});
  await page.goto("/dev/professional-preview#today");
  const disclosure = page.locator(".pro-demo-controls");
  await expect(disclosure.getByText("Demo Preview — Fictional Data",{exact:true})).toBeVisible();
  const label = await disclosure.boundingBox();
  const heading = await page.locator(".pro-page-heading").boundingBox();
  expect(label!.y + label!.height).toBeLessThanOrEqual(heading!.y);
  const exit = await disclosure.getByRole("link",{name:"Exit Preview",exact:true}).boundingBox();
  expect(exit!.height).toBeGreaterThanOrEqual(44);
});

test("tablet content scrolls completely above the fixed bottom navigation", async ({ page }) => {
  await fixtures(page);
  await page.setViewportSize({width:768,height:1024});
  await page.goto("/professional/requests?organization=org-one");
  const action = page.getByRole("link",{name:"Open case",exact:true}).last();
  await expect(action).toBeVisible();
  await page.evaluate(() => window.scrollTo(0,document.documentElement.scrollHeight));
  const box = await action.boundingBox();
  const navigation = await page.locator(".pro-bottom-navigation").boundingBox();
  expect(box!.y + box!.height).toBeLessThan(navigation!.y);
});
