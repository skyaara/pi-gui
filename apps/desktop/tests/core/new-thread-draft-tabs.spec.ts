import { expect, test } from "@playwright/test";
import {
  createNamedThread,
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
} from "../helpers/electron-app";

test("new-thread draft survives navigation and only discards after close confirmation", async () => {
  const workspace = await makeWorkspace("draft-tab-workspace");
  const harness = await launchDesktop(await makeUserDataDir(), {
    initialWorkspaces: [workspace],
    testMode: "background",
  });
  try {
    const page = await harness.firstWindow();
    await createNamedThread(page, "Greeting");
    await page.getByRole("button", { name: "New thread tab", exact: true }).click();
    const prompt = page.getByLabel("New thread prompt");
    await prompt.fill("Implement the settings layout without losing this draft");
    const tabs = page.getByRole("tablist", { name: "Open threads" });
    const draftTab = tabs.getByRole("tab", { name: "New thread", exact: true });
    await tabs.getByRole("tab", { name: "Greeting", exact: true }).click();
    await expect(draftTab).toHaveAttribute("aria-selected", "false");
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("button", { name: "Back to app", exact: true }).click();
    await draftTab.click();
    await expect(prompt).toHaveValue("Implement the settings layout without losing this draft");
    await page.getByRole("button", { name: "New thread tab", exact: true }).click();
    await expect(prompt).toHaveValue("Implement the settings layout without losing this draft");
    const cancel = page.waitForEvent("dialog").then(async (dialog) => {
      expect(dialog.message()).toContain("unsent draft");
      await dialog.dismiss();
    });
    await page.getByRole("button", { name: "Close new thread tab", exact: true }).click();
    await cancel;
    await expect(prompt).toHaveValue("Implement the settings layout without losing this draft");
    await tabs.getByRole("tab", { name: "Greeting", exact: true }).click();
    const discard = page.waitForEvent("dialog").then((dialog) => dialog.accept());
    await page.getByRole("button", { name: "Close new thread tab", exact: true }).click();
    await discard;
    await expect(draftTab).toHaveCount(0);
    await expect(tabs.getByRole("tab", { name: "Greeting", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.getByRole("button", { name: "New thread tab", exact: true }).click();
    await expect(prompt).toHaveValue("");
    await page.screenshot({ path: test.info().outputPath("fresh-draft-after-close.png") });
  } finally {
    await harness.close();
  }
});
