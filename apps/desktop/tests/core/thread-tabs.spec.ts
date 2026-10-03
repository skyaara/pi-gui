import { expect, test } from "@playwright/test";
import { basename } from "node:path";
import {
  createNamedThread,
  getDesktopState,
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
  selectSession,
} from "../helpers/electron-app";

test("thread tabs switch across folders, preserve drafts, and close without deleting sessions", async () => {
  const first = await makeWorkspace("tabs-first");
  const second = await makeWorkspace("tabs-second");
  const harness = await launchDesktop(await makeUserDataDir(), {
    initialWorkspaces: [first, second],
    testMode: "background",
  });
  try {
    const page = await harness.firstWindow();
    // Seed named empty sessions through the shared Core helper; tab interactions use the UI.
    await createNamedThread(page, "First thread", { workspaceName: basename(first) });
    await createNamedThread(page, "Second thread", { workspaceName: basename(second) });
    const tabs = page.getByRole("tablist", { name: "Open threads" });
    const firstTab = tabs.getByRole("tab", { name: "First thread", exact: true });
    const secondTab = tabs.getByRole("tab", { name: "Second thread", exact: true });
    await firstTab.click();
    await page.getByTestId("composer").fill("First draft");
    await secondTab.click();
    await page.getByTestId("composer").fill("Second draft");
    await firstTab.click();
    await expect(page.getByTestId("composer")).toHaveValue("First draft");
    await secondTab.click();
    await expect(page.getByTestId("composer")).toHaveValue("Second draft");
    await selectSession(page, "Second thread");
    await expect(tabs.getByRole("tab")).toHaveCount(2);
    await secondTab.focus();
    await secondTab.press("Home");
    await expect(firstTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("composer")).toHaveValue("First draft");
    await expect(firstTab).toBeFocused();
    await firstTab.press("Home");
    await expect(firstTab).toBeFocused();
    await firstTab.press("End");
    await expect(secondTab).toHaveAttribute("aria-selected", "true");
    await page.getByRole("button", { name: "Close tab First thread", exact: true }).click();
    await expect(tabs.getByRole("tab")).toHaveCount(1);
    await expect(page.getByTestId("composer")).toHaveValue("Second draft");
    await selectSession(page, "First thread");
    await expect(firstTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("composer")).toHaveValue("First draft");
    await firstTab.press("Delete");
    await expect(secondTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("composer")).toHaveValue("Second draft");
    await page.getByRole("button", { name: "Close tab Second thread", exact: true }).click();
    await expect(tabs.getByRole("tab")).toHaveCount(0);
    await expect(page.getByTestId("new-thread-composer")).toBeVisible();
    const state = await getDesktopState(page);
    expect(
      state.workspaces.flatMap((workspace) => workspace.sessions).map((session) => session.title),
    ).toEqual(expect.arrayContaining(["First thread", "Second thread"]));
    await selectSession(page, "Second thread");
    await expect(page.getByTestId("composer")).toHaveValue("Second draft");
    await page.getByRole("button", { name: "New thread tab", exact: true }).click();
    await expect(page.getByTestId("new-thread-composer")).toBeVisible();
    await expect(tabs.getByRole("tab")).toHaveCount(1);
    await secondTab.click();
    const row = page.locator(".session-list > .session-row").filter({ hasText: "Second thread" });
    await row.hover();
    await row.getByLabel(/^Archive Second thread/).click();
    await expect(secondTab).toHaveCount(0);
  } finally {
    await harness.close();
  }
});

test("tabs lay out in one row and scroll to the selected thread in a narrow window", async () => {
  const workspace = await makeWorkspace("tabs-overflow");
  const harness = await launchDesktop(await makeUserDataDir(), {
    initialWorkspaces: [workspace],
    testMode: "background",
  });
  try {
    const page = await harness.firstWindow();
    await harness.electronApp.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.setContentSize(800, 800);
    });
    for (let index = 1; index <= 8; index++) await createNamedThread(page, `Thread ${index}`);
    const strip = page.getByRole("tablist", { name: "Open threads" });
    await expect(strip.getByRole("tab")).toHaveCount(8);
    await expect
      .poll(() => strip.evaluate((element) => element.scrollWidth > element.clientWidth))
      .toBe(true);
    await expect.poll(() => strip.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    const bounds = await strip.boundingBox();
    const selectedBounds = await strip
      .getByRole("tab", { name: "Thread 8", exact: true })
      .boundingBox();
    expect(selectedBounds!.x + selectedBounds!.width).toBeLessThanOrEqual(
      bounds!.x + bounds!.width + 1,
    );
    await page.getByRole("button", { name: "Scroll tabs left", exact: true }).click();
    await expect
      .poll(() =>
        strip.evaluate(
          (element) => element.scrollLeft + element.clientWidth < element.scrollWidth - 1,
        ),
      )
      .toBe(true);
    await strip.getByRole("tab", { name: "Thread 8", exact: true }).focus();
    await strip.getByRole("tab", { name: "Thread 8", exact: true }).press("Home");
    await expect.poll(() => strip.evaluate((element) => element.scrollLeft)).toBeLessThan(1);
    await strip.getByRole("tab", { name: "Thread 1", exact: true }).press("ArrowRight");
    await expect(strip.getByRole("tab", { name: "Thread 2", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.screenshot({ path: test.info().outputPath("narrow-tabs.png") });
    await harness.electronApp.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.setContentSize(1600, 900);
    });
    await expect(page.getByRole("button", { name: "Scroll tabs left", exact: true })).toHaveCount(
      0,
    );
    const rows = await strip
      .locator(".thread-tabs__item")
      .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().top));
    expect(new Set(rows).size).toBe(1);
    await page.getByRole("button", { name: "Toggle sidebar", exact: true }).click();
    await expect(page.locator(".sidebar")).toHaveCount(0);
    const toggleBounds = await page
      .getByRole("button", { name: "Toggle sidebar", exact: true })
      .boundingBox();
    const stripBounds = await strip.boundingBox();
    expect(stripBounds!.x).toBeGreaterThan(toggleBounds!.x + toggleBounds!.width);
    await page.screenshot({ path: test.info().outputPath("wide-tabs.png") });
  } finally {
    await harness.close();
  }
});
