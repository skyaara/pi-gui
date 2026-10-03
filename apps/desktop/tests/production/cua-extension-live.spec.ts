import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import {
  getRealAuthConfig,
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
  type DesktopHarness,
} from "../helpers/electron-app";

test("a real model views and controls PiUI through the Cua extension", async ({}, testInfo) => {
  test.setTimeout(240_000);
  const authConfig = getRealAuthConfig();
  test.skip(!authConfig.enabled, authConfig.skipReason);
  test.skip(process.platform !== "darwin", "Native macOS Cua verification");
  const provider = process.env.PI_GUI_PROVIDER;
  const model = process.env.PI_GUI_MODEL;
  if (!authConfig.sourceDir || !provider || !model)
    throw new Error("Set real-auth source, PI_GUI_PROVIDER and PI_GUI_MODEL.");

  const auth: unknown = JSON.parse(
    await readFile(join(authConfig.sourceDir, "auth.json"), "utf8"),
  ) as unknown;
  if (!auth || typeof auth !== "object" || Array.isArray(auth) || !(provider in auth))
    throw new Error(`The selected provider has no saved credentials: ${provider}`);

  const privateRoot = await mkdtemp(join(tmpdir(), "pi-gui-cua-live-private-"));
  await chmod(privateRoot, 0o700);
  const agentDir = join(privateRoot, "agent");
  await mkdir(agentDir, { mode: 0o700 });
  const credential: unknown = Reflect.get(auth, provider) as unknown;
  await writeFile(join(agentDir, "auth.json"), JSON.stringify({ [provider]: credential }), {
    mode: 0o600,
  });
  await writeFile(
    join(agentDir, "settings.json"),
    JSON.stringify({
      defaultProvider: provider,
      defaultModel: model,
      defaultThinkingLevel: "off",
      enabledModels: [`${provider}/${model}`],
      extensions: [resolve("packages/cua-extension")],
      packages: [],
      cacheWarming: "off",
    }),
  );

  const workspace = await makeWorkspace("cua-live");
  const harness = await launchDesktop(join(privateRoot, "profile"), {
    agentDir,
    initialWorkspaces: [workspace],
    scrubProviderEnv: true,
    envOverrides: { PI_APP_TEST_MODE: undefined },
  });
  let targetHarness: DesktopHarness | undefined;
  try {
    await harness.focusWindow();
    const window = await harness.firstWindow();
    const identity = await harness.electronApp.evaluate(({ app, BrowserWindow }) => ({
      pid: process.pid,
      appPath: app.getAppPath(),
      userData: app.getPath("userData"),
      visible: BrowserWindow.getAllWindows()[0]?.isVisible(),
      focused: BrowserWindow.getAllWindows()[0]?.isFocused(),
      testMode: process.env.PI_APP_TEST_MODE ?? null,
    }));
    expect(identity).toMatchObject({
      appPath: resolve("apps/desktop"),
      userData: join(privateRoot, "profile"),
      visible: true,
      testMode: null,
    });
    expect(identity.focused || (await window.evaluate(() => document.hasFocus()))).toBe(true);

    await window
      .locator(".sidebar")
      .getByRole("button", { name: "New thread", exact: true })
      .click();
    await window
      .getByLabel("New thread prompt", { exact: true })
      .fill(
        "Use the cua_get_desktop_state tool exactly once with max_image_dimension 1024. Look at its returned screenshot. Then report the screenshot dimensions and one visible detail. Do not use any other tool.",
      );
    await window.getByRole("button", { name: "Start thread", exact: true }).click();

    const cuaTool = window.locator(".timeline-tool").filter({ hasText: "cua_get_desktop_state" });
    await expect(cuaTool).toBeVisible({ timeout: 120_000 });
    await expect(cuaTool).toHaveClass(/timeline-tool--success/, { timeout: 120_000 });
    await expect(cuaTool.getByTestId("timeline-tool-images").locator("img")).toHaveCount(1);
    await expect(window.locator(".session-row--active")).toHaveAttribute(
      "data-sidebar-indicator",
      "none",
      { timeout: 120_000 },
    );
    await expect(window.locator(".timeline-tool")).toHaveCount(1);
    await expect(
      window.locator(".timeline-item--assistant .message__content").last(),
    ).toContainText("1024");
    await expect(window.getByTestId("composer-error-banner")).toHaveCount(0);

    const screenshot = testInfo.outputPath("cua-real-model-result.png");
    await window.screenshot({ path: screenshot });
    await testInfo.attach("Cua screenshot returned in PiUI", {
      path: screenshot,
      contentType: "image/png",
    });

    const targetProfile = await makeUserDataDir();
    const targetWorkspace = await makeWorkspace("cua-target");
    targetHarness = await launchDesktop(targetProfile, {
      initialWorkspaces: [targetWorkspace],
      scrubProviderEnv: true,
      envOverrides: { PI_APP_TEST_MODE: undefined },
    });
    const targetWindow = await targetHarness.firstWindow();
    const targetPid = targetHarness.electronApp.process().pid;
    expect(targetPid).toBeTruthy();
    await harness.focusWindow();

    const composer = window.getByTestId("composer");
    await composer.fill(
      `Now use only Cua computer tools to open Settings in a second, disposable PiUI process, PID ${targetPid}. First call cua_list_windows with pid ${targetPid}; choose its visible main window. Inspect that window with cua_get_window_state, then use cua_click on its Settings button. Do not interact with any other process or change a setting. Reply SETTINGS_OPENED after the click.`,
    );
    await composer.press("Enter");
    await expect(window.locator(".timeline-tool").filter({ hasText: "cua_click" })).toBeVisible({
      timeout: 120_000,
    });
    await expect(targetWindow.getByTestId("settings-surface")).toBeVisible({ timeout: 120_000 });
    const settingsScreenshot = testInfo.outputPath("cua-opened-settings.png");
    await targetWindow.screenshot({ path: settingsScreenshot });
    await testInfo.attach("Cua opened PiUI Settings", {
      path: settingsScreenshot,
      contentType: "image/png",
    });
  } finally {
    try {
      await targetHarness?.close();
    } finally {
      await harness.close();
    }
  }
});
