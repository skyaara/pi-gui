import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  desktopShortcut,
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
  seedAgentDir,
} from "../helpers/electron-app";

test("settings and composer keep aligned containers and a consistent type scale", async () => {
  const userDataDir = await makeUserDataDir();
  const agentDir = join(userDataDir, "agent");
  const workspace = await makeWorkspace("ui-alignment");
  await seedAgentDir(agentDir);
  const harness = await launchDesktop(userDataDir, {
    agentDir,
    initialWorkspaces: [workspace],
    testMode: "background",
  });
  try {
    const page = await harness.firstWindow();
    // Outlines are diagnostic only: they do not participate in layout or ship in the UI.
    await page.addStyleTag({
      content: `
      .sidebar, .topbar, .secondary-surface__sidebar, .secondary-surface__content { outline: 1px dotted #c46020; outline-offset: -2px; }
      .new-thread, .composer__surface, .view-header, .settings-group, .theme-mode-tiles { outline: 1px dotted #178a99; outline-offset: -2px; }
      .settings-row__label, .settings-row__control, .secondary-surface__back, .secondary-surface__search, .secondary-surface__nav { outline: 1px dotted #9466c2; outline-offset: -1px; }
    `,
    });
    await page.screenshot({ path: test.info().outputPath("composer-outlines.png") });
    const measurements = [];
    for (const width of [1280, 800]) {
      if (width === 800) await page.getByRole("button", { name: "Back to app" }).click();
      await harness.electronApp.evaluate(({ BrowserWindow }, nextWidth) => {
        BrowserWindow.getAllWindows()[0]?.setContentSize(nextWidth, 800);
      }, width);
      await expect.poll(() => page.evaluate(() => innerWidth)).toBe(width);
      const composer = page.locator(".new-thread__composer");
      await expect(composer).toBeVisible();
      const composerBounds = (await composer.boundingBox())!;
      const canvasBounds = (await page.locator(".canvas--new-thread").boundingBox())!;
      expect(
        Math.abs(
          composerBounds.x + composerBounds.width / 2 - canvasBounds.x - canvasBounds.width / 2,
        ),
      ).toBeLessThan(1);
      expect(
        Math.abs(
          composerBounds.y + composerBounds.height / 2 - canvasBounds.y - canvasBounds.height / 2,
        ),
      ).toBeLessThan(4);
      await expect(page.getByTestId("new-thread-composer")).toHaveCSS("font-size", "14px");
      await page.screenshot({ path: test.info().outputPath(`${width}-composer-outlines.png`) });
      await page.keyboard.press(desktopShortcut(","));
      for (const title of [
        "General",
        "Appearance",
        "Notifications",
        "Keyboard shortcuts",
        "Providers",
        "Models",
        "MCP servers",
      ]) {
        await page.getByRole("button", { name: title, exact: true }).click();
        await expect(page.locator(".settings-view h1")).toHaveText(title);
        const measurement = await page.evaluate(() => {
          const rect = (selector: string) => {
            const element = document.querySelector(selector)!;
            const box = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return {
              left: box.left,
              right: box.right,
              top: box.top,
              bottom: box.bottom,
              height: box.height,
              fontSize: style.fontSize,
              lineHeight: style.lineHeight,
              fontFamily: style.fontFamily,
            };
          };
          const rows = [...document.querySelectorAll<HTMLElement>(".settings-row")].map((row) => {
            const label = row.querySelector<HTMLElement>(".settings-row__label");
            const control = row.querySelector<HTMLElement>(".settings-row__control");
            const bounds = row.getBoundingClientRect();
            return {
              left: label?.getBoundingClientRect().left,
              right: control?.getBoundingClientRect().right,
              overflow: row.scrollWidth - row.clientWidth,
              rowRight: bounds.right,
            };
          });
          return {
            heading: rect(".view-header"),
            back: rect(".secondary-surface__back"),
            searchIcon: rect(".secondary-surface__search svg"),
            backIcon: rect(".secondary-surface__back > :first-child"),
            navIcon: rect(".secondary-surface__nav-icon svg"),
            content: rect(".settings-view"),
            groups: [...document.querySelectorAll(".settings-group, .theme-mode-tiles")].map(
              (element) => ({
                left: element.getBoundingClientRect().left,
                right: element.getBoundingClientRect().right,
              }),
            ),
            rows,
            titleText: rect(".view-header__title"),
            label: document.querySelector(".settings-row__title")
              ? rect(".settings-row__title")
              : undefined,
          };
        });
        measurements.push({ width, title, ...measurement });
        await page.screenshot({
          path: test
            .info()
            .outputPath(`${width}-${title.toLowerCase().replaceAll(" ", "-")}-outlines.png`),
        });
      }
    }
    await writeFile(
      test.info().outputPath("alignment-measurements.json"),
      JSON.stringify(measurements, null, 2),
    );
    for (const m of measurements) {
      expect.soft(m.titleText.fontSize, `${m.width} ${m.title} heading size`).toBe("17px");
      if (m.label) expect.soft(m.label.fontSize).toBe("14px");
      expect.soft(Math.abs(m.backIcon.left - m.searchIcon.left)).toBeLessThan(1);
      expect.soft(Math.abs(m.backIcon.left - m.navIcon.left)).toBeLessThan(1);
      expect
        .soft(Math.abs(m.heading.top + m.heading.height / 2 - m.back.top - m.back.height / 2))
        .toBeLessThan(1);
      for (const group of m.groups) {
        expect.soft(Math.abs(group.left - m.content.left)).toBeLessThan(1);
        expect.soft(Math.abs(group.right - m.content.right)).toBeLessThan(1);
      }
      for (const row of m.rows)
        expect.soft(row.overflow, `${m.width} ${m.title} row overflow`).toBeLessThanOrEqual(1);
      const labelEdges = m.rows.flatMap((row) => (row.left === undefined ? [] : [row.left]));
      const controlEdges = m.rows.flatMap((row) => (row.right === undefined ? [] : [row.right]));
      if (labelEdges.length)
        expect.soft(Math.max(...labelEdges) - Math.min(...labelEdges)).toBeLessThan(1);
      if (controlEdges.length)
        expect.soft(Math.max(...controlEdges) - Math.min(...controlEdges)).toBeLessThan(1);
    }
  } finally {
    await harness.close();
  }
});
