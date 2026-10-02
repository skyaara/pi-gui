import { expect, test } from "@playwright/test";
import {
  desktopShortcut,
  getDesktopState,
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
} from "../helpers/electron-app";

test("records, validates, saves, restores and resets custom shortcuts", async () => {
  const profile = await makeUserDataDir();
  const workspace = await makeWorkspace("custom-shortcuts");
  let harness = await launchDesktop(profile, {
    initialWorkspaces: [workspace],
    testMode: "background",
  });
  try {
    const page = await harness.firstWindow();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("button", { name: "Keyboard shortcuts", exact: true }).click();
    await page.getByRole("button", { name: "Change Toggle sidebar shortcut" }).click();
    const recorder = page.getByRole("textbox", { name: "Record shortcut" });
    await expect(recorder).toHaveValue("Press a key combination");
    await recorder.press(desktopShortcut("K"));
    await expect(page.getByRole("alert")).toContainText("Command palette");
    await expect(page.getByRole("button", { name: "Save shortcut" })).toBeDisabled();
    await expect(page.getByTestId("command-palette")).toHaveCount(0);
    await recorder.press(desktopShortcut("Shift+Y"));
    await page.getByRole("button", { name: "Save shortcut" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect((await getDesktopState(page)).keyboardShortcuts["toggle-sidebar"]).toBe("Shift+Y");
    await expect(
      page.getByRole("button", { name: "Change Toggle sidebar shortcut" }),
    ).toBeFocused();
    await page.getByRole("button", { name: "Back to app", exact: true }).click();
    await page.keyboard.press(desktopShortcut("B"));
    await expect(page.locator(".sidebar")).toBeVisible();
    await page.keyboard.press(desktopShortcut("Shift+Y"));
    await expect(page.locator(".sidebar")).toHaveCount(0);
    await page.keyboard.press(desktopShortcut("Shift+Y"));
    await expect(page.locator(".sidebar")).toBeVisible();
  } finally {
    await harness.close();
  }
  harness = await launchDesktop(profile, { testMode: "background" });
  try {
    const page = await harness.firstWindow();
    expect((await getDesktopState(page)).keyboardShortcuts["toggle-sidebar"]).toBe("Shift+Y");
    // Exercise Electron's native input route as well as renderer key events.
    await harness.electronApp.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win?.webContents.sendInputEvent({
        type: "keyDown",
        keyCode: "Y",
        modifiers: [process.platform === "darwin" ? "meta" : "control", "shift"],
      });
      win?.webContents.sendInputEvent({
        type: "keyUp",
        keyCode: "Y",
        modifiers: [process.platform === "darwin" ? "meta" : "control", "shift"],
      });
    });
    await expect(page.locator(".sidebar")).toHaveCount(0);
    await page.keyboard.press(desktopShortcut("Shift+Y"));
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("button", { name: "Keyboard shortcuts", exact: true }).click();
    await page.getByRole("button", { name: "Reset Toggle sidebar shortcut" }).click();
    await expect(page.getByRole("button", { name: "Reset Toggle sidebar shortcut" })).toHaveCount(
      0,
    );
    await page.getByRole("button", { name: "Change New thread shortcut" }).click();
    const recorder = page.getByRole("textbox", { name: "Record shortcut" });
    await expect(recorder).toHaveValue("Press a key combination");
    await recorder.press(desktopShortcut("Shift+Y"));
    await page.getByRole("button", { name: "Save shortcut" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    if (process.platform === "darwin") {
      expect(
        await harness.electronApp.evaluate(
          ({ Menu }) => Menu.getApplicationMenu()?.getMenuItemById("file.new-thread")?.accelerator,
        ),
      ).toBe("CommandOrControl+Shift+Y");
    }
    await page.getByRole("button", { name: "Change Command palette shortcut" }).click();
    await expect(recorder).toHaveValue("Press a key combination");
    await page.getByRole("button", { name: "Remove binding" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect((await getDesktopState(page)).keyboardShortcuts["open-command-palette"]).toBe("");
    await page.screenshot({ path: test.info().outputPath("custom-shortcuts.png") });
    await page.getByRole("button", { name: "Back to app", exact: true }).click();
    await page.keyboard.press(desktopShortcut("K"));
    await expect(page.getByTestId("command-palette")).toHaveCount(0);
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("button", { name: "Keyboard shortcuts", exact: true }).click();
    await page.getByRole("button", { name: "Reset all shortcuts" }).click();
    await expect(page.getByRole("button", { name: "Reset all shortcuts" })).toBeDisabled();
    expect((await getDesktopState(page)).keyboardShortcuts).toEqual({});
    await page.getByRole("button", { name: "Change Toggle sidebar shortcut" }).click();
    await expect(recorder).toHaveValue("Press a key combination");
    await page.screenshot({ path: test.info().outputPath("shortcut-recorder.png") });
    await recorder.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "Back to app", exact: true }).click();
    await page.keyboard.press(desktopShortcut("B"));
    await expect(page.locator(".sidebar")).toHaveCount(0);
  } finally {
    await harness.close();
  }
});
