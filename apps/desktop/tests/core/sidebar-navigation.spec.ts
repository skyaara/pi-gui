import { expect, test } from "@playwright/test";
import {
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
  stubNextOpenDialog,
} from "../helpers/electron-app";

test("sidebar destinations stay in the app and folder onboarding returns to the selected page", async () => {
  const profile = await makeUserDataDir();
  const workspace = await makeWorkspace("navigation-project");
  const harness = await launchDesktop(profile, { testMode: "background" });
  try {
    const page = await harness.firstWindow();
    for (const [label, title] of [
      ["Skills", "Skills"],
      ["Extensions", "Extensions"],
      ["Automations", "Automations"],
    ]) {
      await page.getByRole("button", { name: label, exact: true }).click();
      await expect(page.locator(".sidebar")).toBeVisible();
      await expect(page.getByRole("button", { name: label, exact: true })).toHaveAttribute(
        "aria-current",
        "page",
      );
      await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
      await expect(page.locator(".topbar")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Toggle side panel" })).toHaveCount(0);
      const openFolder = page.getByRole("button", { name: "Open folder", exact: true });
      await expect(openFolder).toBeVisible();
      await expect(page.locator(".resource-empty__body")).toHaveCSS("border-top-width", "0px");
      await stubNextOpenDialog(harness, []);
      await openFolder.click();
      await expect(openFolder).toBeEnabled();
      await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      await page.getByRole("button", { name: "Back to app", exact: true }).click();
      await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    }
    await expect(page.getByTestId("scheduled-task-create")).toBeDisabled();
    await page.getByRole("button", { name: "Skills", exact: true }).click();
    await stubNextOpenDialog(harness, [workspace]);
    await page.getByRole("button", { name: "Open folder", exact: true }).click();
    await expect(page.getByTestId("skills-surface")).toBeVisible();
    await expect(page.getByRole("button", { name: "New skill", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Skills", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeEnabled();
    await page.screenshot({ path: test.info().outputPath("skills-navigation.png") });
    await page.getByRole("button", { name: "Automations", exact: true }).click();
    await expect(page.getByTestId("scheduled-task-create")).toBeEnabled();
    await page.getByRole("button", { name: "Threads", exact: true }).click();
    await expect(page.getByTestId("skills-surface")).toHaveCount(0);
  } finally {
    await harness.close();
  }
});
