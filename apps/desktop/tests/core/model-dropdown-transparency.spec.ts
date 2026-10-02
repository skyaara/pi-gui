import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  createNamedThread,
  desktopShortcut,
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
  openNewThread,
  seedAgentDir,
} from "../helpers/electron-app";

test("model and effort menus remain usable above a transparent composer", async () => {
  const userDataDir = await makeUserDataDir();
  const agentDir = join(userDataDir, "agent");
  const workspace = await makeWorkspace("transparent-model-menu");
  await seedAgentDir(agentDir);
  const harness = await launchDesktop(userDataDir, {
    agentDir,
    initialWorkspaces: [workspace],
    testMode: "background",
  });
  try {
    const window = await harness.firstWindow();
    await window.keyboard.press(desktopShortcut(","));
    await window.getByRole("button", { name: "Appearance", exact: true }).click();
    await window.getByLabel("Window transparency").click();
    await expect(window.getByLabel("Window transparency")).toBeChecked();
    await window.getByRole("button", { name: "Back to app" }).click();
    await openNewThread(window);
    for (const context of ["draft", "session"] as const) {
      if (context === "session") await createNamedThread(window, "Transparent model controls");
      const composer = window.locator(context === "draft" ? ".new-thread__composer" : ".composer");
      const trigger = composer.locator(".model-selector__badge").first();
      await trigger.click();
      const menu = window.getByRole("dialog", { name: "Choose model", exact: true });
      await expect(menu).toBeVisible();
      await expect
        .poll(() => menu.evaluate((element) => getComputedStyle(element).backgroundColor))
        .toMatch(/^rgb\(/);
      const box = (await menu.boundingBox())!;
      const viewport = await window.evaluate(() => ({ width: innerWidth, height: innerHeight }));
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      await window.screenshot({ path: test.info().outputPath(`model-menu-${context}.png`) });
      await expect(menu.getByRole("textbox")).toHaveCount(0);
      await expect(menu.getByRole("navigation")).toHaveCount(0);
      await expect(menu.locator(".model-selector__group-title")).toHaveCount(0);
      await expect(menu.locator(".model-selector__item-meta")).toHaveCount(0);
      await expect(menu.locator(".model-selector__item")).toHaveText(["GPT-5", "GPT-4o"]);
      await expect(menu.locator(".model-selector__item").first()).toBeVisible();
      await menu.locator(".model-selector__item").first().click();
      await expect(menu).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await composer.locator(".model-selector__badge").nth(1).click();
      const effort = window.getByRole("dialog", { name: "Thinking level" });
      await effort.getByRole("button", { name: "Low", exact: true }).click();
      await expect(composer.getByRole("button", { name: "Low", exact: true })).toBeVisible();
      await trigger.click();
      await window.keyboard.press("ArrowDown");
      await expect(menu.locator(".model-selector__item").first()).toBeFocused();
      await window.keyboard.press("Escape");
      await expect(menu).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await trigger.click();
      await window.getByTestId("topbar").click();
      await expect(menu).toHaveCount(0);
    }
    await window.screenshot({ path: test.info().outputPath("transparent-model-controls.png") });
  } finally {
    await harness.close();
  }
});
