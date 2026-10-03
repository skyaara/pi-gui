import { expect, test } from "@playwright/test";
import { basename } from "node:path";
import { writeFile } from "node:fs/promises";
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
    await expect(tabs.getByRole("tab", { name: "New thread", exact: true })).toHaveCount(1);
    await expect(page.getByTestId("new-thread-composer")).toBeVisible();
    const state = await getDesktopState(page);
    expect(
      state.workspaces.flatMap((workspace) => workspace.sessions).map((session) => session.title),
    ).toEqual(expect.arrayContaining(["First thread", "Second thread"]));
    await selectSession(page, "Second thread");
    await expect(page.getByTestId("composer")).toHaveValue("Second draft");
    await page.getByRole("button", { name: "New thread tab", exact: true }).click();
    await expect(page.getByTestId("new-thread-composer")).toBeVisible();
    await expect(tabs.getByRole("tab")).toHaveCount(2);
    await expect(tabs.getByRole("tab", { name: "New thread", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
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
    await expect(strip).toHaveClass(/thread-tabs__strip--fade-start/);
    expect(await strip.evaluate((element) => getComputedStyle(element).maskImage)).not.toBe("none");
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
    await expect(strip).toHaveClass(/thread-tabs__strip--fade-end/);
    await strip.getByRole("tab", { name: "Thread 1", exact: true }).press("ArrowRight");
    await expect(strip.getByRole("tab", { name: "Thread 2", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.screenshot({ path: test.info().outputPath("narrow-tabs.png") });
    await harness.electronApp.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.setContentSize(1800, 900);
    });
    await expect(page.getByRole("button", { name: "Scroll tabs left", exact: true })).toBeVisible();
    const rows = await strip
      .locator(".thread-tabs__item")
      .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().top));
    expect(new Set(rows).size).toBe(1);
    const canvas = (await page.locator(".canvas--thread").boundingBox())!;
    const composer = (await page.locator(".composer__surface").boundingBox())!;
    const maxWidth = await page.evaluate(
      () =>
        Number.parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue("--chat-max-width"),
        ) * Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
    );
    expect(composer.width).toBeLessThanOrEqual(maxWidth + 1);
    expect(Math.abs(composer.x + composer.width / 2 - canvas.x - canvas.width / 2)).toBeLessThan(1);
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

test("split panes stay in one window and keep their own tabs and selected conversations", async () => {
  const workspace = await makeWorkspace("split-window-tabs");
  const harness = await launchDesktop(await makeUserDataDir(), {
    initialWorkspaces: [workspace],
    testMode: "background",
  });
  try {
    const left = await harness.firstWindow();
    await createNamedThread(left, "Left thread");
    await createNamedThread(left, "Right thread");
    await left.getByRole("button", { name: "Split editor" }).click();
    await expect(left.getByTestId("split-pane-target")).toBeVisible();
    await expect
      .poll(async () =>
        harness.electronApp.evaluate(({ webContents }) =>
          webContents
            .getAllWebContents()
            .some((contents) => contents.getURL().includes("pane=secondary")),
        ),
      )
      .toBe(true);
    const leftTabs = left.getByRole("tablist", { name: "Open threads" });
    const inspectRight = (script: string) =>
      harness.electronApp.evaluate(async ({ webContents }, source) => {
        const pane = webContents
          .getAllWebContents()
          .find((contents) => contents.getURL().includes("pane=secondary"));
        if (!pane) throw new Error("Split pane is unavailable");
        return (await pane.executeJavaScript(source)) as unknown;
      }, script);
    await expect.poll(() => inspectRight('document.querySelectorAll("[role=tab]").length')).toBe(1);
    await leftTabs.getByRole("tab", { name: "Left thread" }).click();
    await expect(leftTabs.getByRole("tab", { name: "Left thread" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect
      .poll(() =>
        inspectRight(
          'document.querySelector("[role=tab][aria-selected=true]")?.textContent?.trim()',
        ),
      )
      .toBe("Right thread");
    const state = await getDesktopState(left);
    const leftSession = state.workspaces
      .flatMap((item) => item.sessions)
      .find((item) => item.title === "Left thread")!;
    const rightWorkspace = state.workspaces.find((item) =>
      item.sessions.some((session) => session.id === leftSession.id),
    )!;
    await inspectRight(
      `window.piApp.selectSession({ workspaceId: ${JSON.stringify(rightWorkspace.id)}, sessionId: ${JSON.stringify(leftSession.id)} })`,
    );
    await expect.poll(() => inspectRight('document.querySelectorAll("[role=tab]").length')).toBe(2);
    await expect
      .poll(() =>
        inspectRight(
          'document.querySelector("[role=tab][aria-selected=true]")?.textContent?.trim()',
        ),
      )
      .toBe("Left thread");
    await expect(leftTabs.getByRole("tab", { name: "Left thread" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await inspectRight('document.querySelector("[role=tab]")?.click()');
    await expect
      .poll(() =>
        inspectRight(
          'document.querySelector("[role=tab][aria-selected=true]")?.textContent?.trim()',
        ),
      )
      .toBe("Right thread");
    await expect(leftTabs.getByRole("tab", { name: "Left thread" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await inspectRight('document.querySelectorAll("[role=tab]")[1]?.click()');
    await leftTabs.getByRole("tab", { name: "Right thread" }).click();
    await expect
      .poll(() =>
        inspectRight(
          'document.querySelector("[role=tab][aria-selected=true]")?.textContent?.trim()',
        ),
      )
      .toBe("Left thread");
    const windowCount = await harness.electronApp.evaluate(
      ({ BrowserWindow }) => BrowserWindow.getAllWindows().length,
    );
    expect(windowCount).toBe(1);
    const nativeBounds = await harness.electronApp.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0]!;
      const pane = window.contentView.children.find((view) => "webContents" in view);
      return { pane: pane?.getBounds(), size: window.getContentSize() };
    });
    const targetBounds = await left.getByTestId("split-pane-target").boundingBox();
    expect(nativeBounds.pane?.x).toBeCloseTo(targetBounds!.x + 6, 0);
    expect(nativeBounds.pane?.width).toBeCloseTo(targetBounds!.width - 6, 0);
    expect(nativeBounds.pane?.height).toBe(nativeBounds.size[1]);
    await left.getByRole("separator", { name: "Resize split panes" }).focus();
    await left.getByRole("separator", { name: "Resize split panes" }).press("ArrowRight");
    await expect
      .poll(() =>
        harness.electronApp.evaluate(
          ({ BrowserWindow }) =>
            BrowserWindow.getAllWindows()[0]
              ?.contentView.children.find((view) => "webContents" in view)
              ?.getBounds().x,
        ),
      )
      .toBeGreaterThan(nativeBounds.pane!.x);
    const nativeImage = await harness.electronApp.evaluate(async ({ BrowserWindow }) =>
      (await BrowserWindow.getAllWindows()[0]!.capturePage()).toPNG().toString("base64"),
    );
    await writeFile(test.info().outputPath("split-native.png"), Buffer.from(nativeImage, "base64"));
    const paneImage = await harness.electronApp.evaluate(async ({ webContents }) => {
      const pane = webContents
        .getAllWebContents()
        .find((contents) => contents.getURL().includes("pane=secondary"));
      return (await pane!.capturePage()).toPNG().toString("base64");
    });
    await writeFile(
      test.info().outputPath("split-pane-native.png"),
      Buffer.from(paneImage, "base64"),
    );
    await left.screenshot({ path: test.info().outputPath("split-left.png") });
    await harness.electronApp.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.setContentSize(950, 800);
    });
    await expect
      .poll(() =>
        inspectRight(`(() => {
      const heading = document.querySelector('.thread-tabs__strip');
      return heading && heading.getBoundingClientRect().right <= innerWidth;
    })()`),
      )
      .toBe(true);
    await left.evaluate(() => globalThis.window.piApp?.setActiveView("settings"));
    await expect
      .poll(() =>
        harness.electronApp.evaluate(
          ({ BrowserWindow }) =>
            BrowserWindow.getAllWindows()[0]
              ?.contentView.children.find((view) => "webContents" in view)
              ?.getBounds().width,
        ),
      )
      .toBe(0);
    await left.evaluate(() => globalThis.window.piApp?.setActiveView("threads"));
    await expect(left.getByTestId("split-pane-target")).toBeVisible();
    await expect
      .poll(() =>
        harness.electronApp.evaluate(
          ({ BrowserWindow }) =>
            BrowserWindow.getAllWindows()[0]
              ?.contentView.children.find((view) => "webContents" in view)
              ?.getBounds().width,
        ),
      )
      .toBeGreaterThan(0);
    await left.getByRole("button", { name: "Close split pane" }).click();
    await expect(left.getByTestId("split-pane-target")).toHaveCount(0);
  } finally {
    await harness.close();
  }
});
