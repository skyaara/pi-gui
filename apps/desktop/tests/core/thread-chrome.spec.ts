import { basename } from "node:path";
import { expect, test } from "@playwright/test";
import {
  createNamedThread,
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
  seedTranscriptMessages,
} from "../helpers/electron-app";

test("minimal header and composer retain working Pi controls", async () => {
  const first = await makeWorkspace("chrome-first");
  const second = await makeWorkspace("chrome-second");
  const harness = await launchDesktop(await makeUserDataDir(), {
    initialWorkspaces: [first, second],
    testMode: "background",
  });
  try {
    const page = await harness.firstWindow();
    await harness.electronApp.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.setContentSize(1920, 1080);
    });
    await createNamedThread(page, "Alpha", { workspaceName: basename(first) });
    await createNamedThread(page, "Bravo", { workspaceName: basename(second) });
    const row = page.locator(".thread-tabs");
    const tabs = page.getByRole("tablist", { name: "Open threads" });
    await tabs.getByRole("tab", { name: "Alpha", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(tabs).toBeVisible();
    await expect(page.locator(".sidebar__footer button")).toHaveCount(1);
    await expect(
      page.locator(".sidebar__footer").getByRole("button", { name: "Settings" }),
    ).toBeVisible();
    await expect(tabs.getByRole("tab", { name: "Alpha", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const environment = page.getByRole("complementary", { name: "Environment" });
    await expect(environment).toBeVisible();
    await environment.getByRole("button", { name: "Changes" }).click();
    await expect(page.getByTestId("workbench")).toBeVisible();
    await row.getByRole("button", { name: "Hide Review", exact: true }).click();
    await expect(environment).toBeVisible();
    for (const [label, surface] of [
      ["Files", "file-workbench"],
      ["Terminal", "integrated-terminal"],
    ]) {
      await environment.getByRole("button", { name: label, exact: true }).click();
      await expect(page.getByTestId(surface!)).toBeVisible();
      await row.getByRole("button", { name: `Hide ${label}`, exact: true }).click();
    }
    await row.getByRole("button", { name: "Thread actions", exact: true }).click();
    await expect(page.locator(".chat-header__menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".chat-header__menu")).toHaveCount(0);
    await page.evaluate(() => window.piApp!.setThemeMode("light"));
    await page.evaluate(() => window.piApp!.setThreadGrouping("workspace"));
    await seedTranscriptMessages(harness, page, {
      count: 2,
      textFactory: (index) =>
        index === 0
          ? "Review the desktop UI and preserve Pi as the backend."
          : "The desktop uses a compact header and a focused conversation column.\n\n**What is connected:**\n- Pi models and reasoning controls\n- Skills and extensions\n- Files, changes, and terminal\n\nAll session state remains owned by Pi.",
    });
    await expect(page.getByTestId("transcript")).toContainText("What is connected");
    await page.getByTestId("composer").fill("Continue with the remaining screens");
    await page.locator('.composer .model-selector__badge[aria-haspopup="dialog"]').click();
    const modelMenu = page.getByRole("dialog", { name: "Choose model", exact: true });
    await expect(modelMenu).toBeVisible();
    await expect(modelMenu.getByRole("navigation")).toHaveCount(0);
    await modelMenu.getByRole("textbox", { name: "Search models" }).fill("no-such-pi-model");
    await expect(modelMenu).toContainText("No matching models");
    await modelMenu.getByRole("textbox", { name: "Search models" }).fill("");
    await page.screenshot({ path: test.info().outputPath("model-picker.png") });
    await page.keyboard.press("Escape");
    await expect(modelMenu).toHaveCount(0);

    for (const width of [1920, 1280, 800]) {
      await harness.electronApp.evaluate(({ BrowserWindow }, nextWidth) => {
        BrowserWindow.getAllWindows()[0]?.setContentSize(nextWidth, 1080);
      }, width);
      await expect.poll(() => page.evaluate(() => innerWidth)).toBe(width);
      const rowBounds = (await row.boundingBox())!;
      const canvasBounds = (await page.locator(".canvas--thread").boundingBox())!;
      expect(rowBounds.height).toBe(38);
      expect(Math.abs(canvasBounds.y - rowBounds.y - rowBounds.height)).toBeLessThan(1);
      await expect(page.getByTestId("composer")).toBeVisible();
      await expect(page.getByRole("button", { name: "Send message", exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      await page.mouse.move(0, 0);
      await page.screenshot({ path: test.info().outputPath(`${width}-thread-chrome.png`) });
    }
    await harness.electronApp.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.setContentSize(1200, 800);
    });
    await page.getByRole("button", { name: "Keyboard shortcuts", exact: true }).click();
    await expect(page.getByTestId("settings-surface")).toBeVisible();
    await page.getByRole("button", { name: "Appearance", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Appearance", exact: true })).toBeVisible();
    await page.mouse.move(0, 0);
    await page.screenshot({ path: test.info().outputPath("appearance.png") });
    await page.getByRole("button", { name: "Back to app", exact: true }).click();
    await page.getByRole("button", { name: "New thread", exact: true }).click();
    await expect(page.getByTestId("new-thread-composer")).toBeVisible();
    await page.screenshot({ path: test.info().outputPath("new-session.png") });
    for (const label of ["Automations", "Skills", "Extensions"]) {
      await page.locator(".sidebar").getByRole("button", { name: label, exact: true }).click();
      await expect(page.getByRole("heading", { name: label, exact: true })).toBeVisible();
      await page.screenshot({ path: test.info().outputPath(`${label.toLowerCase()}.png`) });
    }
  } finally {
    await harness.close();
  }
});
