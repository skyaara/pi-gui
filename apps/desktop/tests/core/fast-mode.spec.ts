import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  createNamedThread,
  openNewThread,
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
  seedAgentDir,
  selectSession,
} from "../helpers/electron-app";

test("Fast toggle is off by default, preserves drafts and persists across restart", async () => {
  const userDataDir = await makeUserDataDir();
  const agentDir = join(userDataDir, "agent");
  const workspacePath = await makeWorkspace("fast-toggle");
  await seedAgentDir(agentDir);
  let harness = await launchDesktop(userDataDir, {
    agentDir,
    initialWorkspaces: [workspacePath],
    testMode: "background",
  });
  try {
    let window = await harness.firstWindow();
    await openNewThread(window);
    await expect(window.getByRole("switch", { name: "Fast mode" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    await window.getByRole("switch", { name: "Fast mode" }).click();
    await expect(window.getByRole("switch", { name: "Fast mode" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    // Seed an empty session without sending a provider request; exercise its controls through UI.
    await createNamedThread(window, "Fast toggle session");
    const composer = window.getByTestId("composer");
    await composer.fill("Keep this draft");
    const toggle = window.getByRole("switch", { name: "Fast mode" });
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect(composer).toHaveValue("Keep this draft");
    await window.locator(".composer__bar .model-selector__badge").nth(1).click();
    const menu = window.getByRole("dialog", { name: "Thinking level" });
    await expect(menu.locator(".model-selector__item-meta")).toHaveCount(0);
    await expect(menu.getByRole("button", { name: "Minimal", exact: true })).toBeVisible();
    await window.keyboard.press("Escape");
    await harness.close();
    harness = await launchDesktop(userDataDir, {
      agentDir,
      initialWorkspaces: [workspacePath],
      testMode: "background",
    });
    window = await harness.firstWindow();
    await selectSession(window, "Fast toggle session");
    const restoredToggle = window.getByRole("switch", { name: "Fast mode" });
    await expect(restoredToggle).toHaveAttribute("aria-checked", "true");
    await expect(window.getByTestId("composer")).toHaveValue("Keep this draft");
    await restoredToggle.click();
    await expect(restoredToggle).toHaveAttribute("aria-checked", "false");
    await window.screenshot({ path: test.info().outputPath("fast-mode.png") });
  } finally {
    await harness.close();
  }
});
