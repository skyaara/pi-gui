import { basename } from "node:path";
import { expect, test } from "@playwright/test";
import {
  createNamedThread,
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
} from "../helpers/electron-app";

test("one tab row holds thread controls and the prompt identifies its workspace", async () => {
  const first = await makeWorkspace("chrome-first");
  const second = await makeWorkspace("chrome-second");
  const harness = await launchDesktop(await makeUserDataDir(), {
    initialWorkspaces: [first, second],
    testMode: "background",
  });
  try {
    const page = await harness.firstWindow();
    await expect(page.locator(".topbar")).toHaveCount(0);
    await expect(
      page.locator(".new-thread__composer .composer__surface").getByTestId("composer-workspace"),
    ).toBeVisible();
    await createNamedThread(page, "Alpha", { workspaceName: basename(first) });
    await createNamedThread(page, "Bravo", { workspaceName: basename(second) });
    const row = page.locator(".thread-tabs");
    const tabs = page.getByRole("tablist", { name: "Open threads" });
    const context = page.locator(".composer__surface").getByTestId("composer-workspace");
    await expect(context).toHaveText(basename(second));
    await expect(context).toHaveAttribute("title", second);
    await tabs.getByRole("tab", { name: "Alpha", exact: true }).click();
    await expect(context).toHaveText(basename(first));
    await expect(context).toHaveAttribute("title", first);
    for (const [label, surface] of [
      ["Files", "file-workbench"],
      ["Review", "review-panel"],
      ["Terminal", "integrated-terminal"],
    ]) {
      const button = row.getByRole("button", { name: `Show ${label}`, exact: true });
      await expect(button).toHaveText("");
      await expect(button.locator("svg")).toHaveAttribute("viewBox", "0 0 256 256");
      await button.click();
      await expect(
        surface === "review-panel" ? page.locator(".review-panel") : page.getByTestId(surface),
      ).toBeVisible();
      await row.getByRole("button", { name: `Hide ${label}`, exact: true }).click();
      await expect(page.getByTestId("workbench")).toHaveCount(0);
    }
    await row.getByRole("button", { name: "Thread actions", exact: true }).click();
    await expect(page.locator(".chat-header__menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".chat-header__menu")).toHaveCount(0);
    for (const width of [1280, 800]) {
      await harness.electronApp.evaluate(({ BrowserWindow }, nextWidth) => {
        BrowserWindow.getAllWindows()[0]?.setContentSize(nextWidth, 800);
      }, width);
      await expect.poll(() => page.evaluate(() => innerWidth)).toBe(width);
      const rowBounds = (await row.boundingBox())!;
      const canvasBounds = (await page.locator(".canvas--thread").boundingBox())!;
      const controlsBounds = (await row.locator(".thread-tabs__actions").boundingBox())!;
      const tabsBounds = (await tabs.boundingBox())!;
      expect(rowBounds.height).toBe(44);
      expect(Math.abs(canvasBounds.y - rowBounds.y - rowBounds.height)).toBeLessThan(1);
      expect(controlsBounds.x).toBeGreaterThan(tabsBounds.x + tabsBounds.width);
      expect(controlsBounds.x + controlsBounds.width).toBeLessThanOrEqual(width);
      await page.screenshot({ path: test.info().outputPath(`${width}-thread-chrome.png`) });
    }
  } finally {
    await harness.close();
  }
});
