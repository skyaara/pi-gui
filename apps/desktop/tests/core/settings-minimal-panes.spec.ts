import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  desktopShortcut,
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
  seedAgentDir,
} from "../helpers/electron-app";

test("settings panes have one title and keep their primary controls accessible", async () => {
  const userDataDir = await makeUserDataDir();
  const agentDir = join(userDataDir, "agent");
  const workspace = await makeWorkspace("minimal-settings");
  await seedAgentDir(agentDir);
  const harness = await launchDesktop(userDataDir, {
    agentDir,
    initialWorkspaces: [workspace],
    testMode: "background",
  });
  try {
    const window = await harness.firstWindow();
    await window.keyboard.press(desktopShortcut(","));
    const pane = window.locator(".settings-view");
    for (const title of [
      "General",
      "Appearance",
      "Notifications",
      "Keyboard shortcuts",
      "Providers",
      "Models",
      "MCP servers",
    ]) {
      await window.getByRole("button", { name: title, exact: true }).click();
      await expect(pane.getByRole("heading")).toHaveText([title]);
      await expect(pane.locator(".view-header__body")).toHaveCount(0);
      await window.screenshot({
        path: test.info().outputPath(`${title.toLowerCase().replaceAll(" ", "-")}.png`),
      });
    }
    await expect(pane.getByLabel("Server name")).toHaveCount(0);
    await pane.getByRole("button", { name: "Add server", exact: true }).click();
    await expect(pane.getByLabel("Server name")).toBeVisible();
    await pane.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(pane.getByLabel("Server name")).toHaveCount(0);
    await window.getByRole("button", { name: "General", exact: true }).click();
    await expect(pane.getByLabel("Shell of integrated terminal")).toBeVisible();
    await window.getByRole("button", { name: "Models", exact: true }).click();
    await pane.getByLabel("Default model", { exact: true }).click();
    await expect(window.getByRole("dialog", { name: "Choose model" })).toBeVisible();
    await window.keyboard.press("Escape");
    await expect(window.getByRole("dialog", { name: "Choose model" })).toHaveCount(0);
  } finally {
    await harness.close();
  }
});
