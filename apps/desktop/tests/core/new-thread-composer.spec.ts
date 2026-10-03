import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { basename, join } from "node:path";
import {
  desktopShortcut,
  getDesktopState,
  getSelectedTranscript,
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
  openNewThread,
  pasteTinyPng,
  seedAgentDir,
} from "../helpers/electron-app";

test("empty projects open the composer on startup, folder selection, and restart", async () => {
  const userDataDir = await makeUserDataDir();
  const agentDir = join(userDataDir, "agent");
  const firstWorkspace = await makeWorkspace("composer-landing-first");
  const secondWorkspace = await makeWorkspace("composer-landing-second");
  await seedAgentDir(agentDir);
  let harness = await launchDesktop(userDataDir, {
    agentDir,
    initialWorkspaces: [firstWorkspace, secondWorkspace],
    testMode: "background",
  });
  try {
    let window = await harness.firstWindow();
    const composer = window.getByTestId("new-thread-composer");
    await expect(composer).toBeVisible();
    await expect(window.getByText("Create a thread for this folder", { exact: false })).toHaveCount(
      0,
    );
    await window
      .locator(".sidebar")
      .getByRole("button", { name: basename(secondWorkspace), exact: true })
      .click();
    await expect(
      window.getByRole("button", { name: `Workspace: ${basename(secondWorkspace)}`, exact: true }),
    ).toBeVisible();
    await expect(composer).toBeVisible();
    const geometry = await window.locator(".new-thread__composer").boundingBox();
    const canvas = await window.locator(".canvas--new-thread").boundingBox();
    expect(geometry).not.toBeNull();
    expect(canvas).not.toBeNull();
    expect(geometry!.width).toBeLessThanOrEqual(760);
    expect(Math.abs(canvas!.y + canvas!.height - geometry!.y - geometry!.height - 12)).toBeLessThan(
      2,
    );
    await window.screenshot({ path: test.info().outputPath("empty-project-composer.png") });
    await harness.close();
    harness = await launchDesktop(userDataDir, { agentDir, testMode: "background" });
    window = await harness.firstWindow();
    await expect(window.getByTestId("new-thread-composer")).toBeVisible();
    await expect(
      window.getByRole("button", { name: `Workspace: ${basename(secondWorkspace)}`, exact: true }),
    ).toBeVisible();
  } finally {
    await harness.close();
  }
});

test("new thread reuses composer behaviors for slash commands, image previews, and project selection", async () => {
  test.setTimeout(60_000);
  const userDataDir = await makeUserDataDir();
  const agentDir = join(userDataDir, "agent");
  const workspacePath = await makeWorkspace("new-thread-composer-workspace");
  await seedAgentDir(agentDir);
  const harness = await launchDesktop(userDataDir, {
    agentDir,
    initialWorkspaces: [workspacePath],
    testMode: "background",
  });

  try {
    const window = await harness.firstWindow();
    await openNewThread(window);

    const composer = window.getByTestId("new-thread-composer");
    await expect(window.getByRole("heading", { name: "Pi", exact: true })).toBeVisible();
    await expect(composer).toBeFocused();
    await expect(composer).toHaveAttribute(
      "placeholder",
      "Ask anything, @mention files, or / for commands and skills",
    );

    const modelBadge = window.locator(".new-thread__hint .model-selector__badge").first();
    await expect(modelBadge).toBeVisible();
    await expect(window.locator('.new-thread input[type="file"]')).toBeHidden();

    await composer.fill("/stat");
    const slashMenu = window.getByTestId("slash-menu");
    await expect(slashMenu).toBeVisible();
    await expect(slashMenu).toContainText("Status");
    await composer.press("Tab");
    await expect(slashMenu).toHaveCount(0);
    await expect(composer).toHaveValue("/status");

    await composer.fill("Outline next steps /stat");
    await expect(slashMenu).toBeVisible();
    await expect(slashMenu).toContainText("Status");
    await composer.press("Tab");
    await expect(slashMenu).toHaveCount(0);
    await expect(composer).toHaveValue("Outline next steps /status");

    await composer.fill("");
    await pasteTinyPng(window, "new-thread-image.png", "new-thread-composer");
    const chip = window.locator(".composer-attachment");
    await expect(chip).toBeVisible();
    await expect(chip.locator(".composer-attachment__preview")).toHaveAttribute(
      "title",
      "new-thread-image.png",
    );
    await expect(chip.locator(".composer-attachment__name")).toHaveCount(0);

    await window.getByRole("button", { name: "Start thread" }).click();

    await expect(window.getByTestId("composer")).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(
        async () => {
          const transcript = await getSelectedTranscript(window);
          const userMessage = transcript?.transcript.find(
            (entry): entry is Extract<typeof entry, { kind: "message" }> =>
              entry.kind === "message" && entry.role === "user",
          );
          return userMessage?.attachments?.map((attachment) => attachment.kind).join(",") ?? "";
        },
        { timeout: 15_000 },
      )
      .toBe("image");
    const sentImage = window.getByRole("button", { name: "View new-thread-image.png" });
    await expect(sentImage).toBeVisible({ timeout: 15_000 });
    await expect(window.locator(".composer-attachment")).toHaveCount(0);
    await sentImage.click();
    await expect(window.getByTestId("image-viewer")).toBeVisible();
    await window.keyboard.press("Escape");
    await expect(window.getByTestId("image-viewer")).toHaveCount(0);
  } finally {
    await harness.close();
  }
});

test("new thread can choose and remember its first model without visiting settings", async () => {
  test.setTimeout(60_000);
  const userDataDir = await makeUserDataDir();
  const agentDir = join(userDataDir, "agent");
  const workspacePath = await makeWorkspace("new-thread-no-default-workspace");
  await seedAgentDir(agentDir, { withDefaultModel: false });
  let harness = await launchDesktop(userDataDir, {
    agentDir,
    initialWorkspaces: [workspacePath],
    testMode: "background",
  });

  try {
    const window = await harness.firstWindow();
    await openNewThread(window);

    const notice = window.getByTestId("model-onboarding-notice");
    const startButton = window.getByRole("button", { name: "Start thread" });
    const modelBadge = window.locator(".new-thread__hint .model-selector__badge").first();

    await window.getByTestId("new-thread-composer").fill("start a thread without a default");
    await expect(notice).toHaveCount(0);
    await expect(modelBadge).toHaveText("GPT-5");
    await expect(startButton).toBeEnabled();

    await modelBadge.click();
    const dropdown = window.getByRole("dialog", { name: "Choose model", exact: true });
    await expect(dropdown).toContainText("GPT-5");
    await expect(dropdown).toContainText("GPT-4o");
    await expect(dropdown.locator(".model-selector__item-label")).toHaveText(["GPT-5", "GPT-4o"]);
    await expect(dropdown.getByRole("textbox", { name: "Search models" })).toBeVisible();
    await expect(dropdown.getByRole("navigation", { name: "Model providers" })).toHaveCount(0);
    const bounds = await dropdown.boundingBox();
    const viewport = await window.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
    await window.screenshot({ path: test.info().outputPath("first-model-picker.png") });
    await dropdown.getByRole("button", { name: /GPT-5/ }).focus();
    await window.keyboard.press("ArrowDown");
    await expect(dropdown.getByRole("button", { name: /GPT-4o/ })).toBeFocused();
    await window.keyboard.press("Enter");

    await expect(modelBadge).toHaveText("GPT-4o");
    await expect
      .poll(async () => {
        const state = await getDesktopState(window);
        return Object.values(state.runtimeByWorkspace).some(
          (runtime) => runtime.settings.defaultModelId === "gpt-4o",
        );
      })
      .toBe(true);
    await expect(startButton).toBeEnabled();
    await expect(notice).toHaveCount(0);

    await startButton.click();

    await expect(window.getByTestId("composer")).toBeVisible({ timeout: 15_000 });
    await expect(window.getByTestId("model-onboarding-notice")).toHaveCount(0);

    const composer = window.getByTestId("composer");
    await composer.fill("continue");
    await expect(window.getByTestId("send")).toBeEnabled();
    await harness.close();
    harness = await launchDesktop(userDataDir, { agentDir, testMode: "background" });
    const reopened = await harness.firstWindow();
    await openNewThread(reopened);
    await expect(reopened.locator(".new-thread__hint .model-selector__badge").first()).toHaveText(
      "GPT-4o",
    );
    await expect(reopened.getByTestId("model-onboarding-notice")).toHaveCount(0);
  } finally {
    await harness.close();
  }
});

test("new thread routes disabled-model recovery to settings models", async () => {
  test.setTimeout(60_000);
  const userDataDir = await makeUserDataDir();
  const agentDir = join(userDataDir, "agent");
  const workspacePath = await makeWorkspace("new-thread-empty-models-workspace");
  await seedAgentDir(agentDir);
  const harness = await launchDesktop(userDataDir, {
    agentDir,
    initialWorkspaces: [workspacePath],
    testMode: "background",
  });

  try {
    const window = await harness.firstWindow();
    await openNewThread(window);

    const selectedWorkspaceId = (await getDesktopState(window)).selectedWorkspaceId;
    expect(selectedWorkspaceId).toBeTruthy();

    await window.evaluate(
      async ({ workspaceId }) => {
        const app = globalThis.window.piApp;
        if (!app) {
          throw new Error("piApp IPC bridge is unavailable");
        }
        await app.setScopedModelPatterns(workspaceId, ["fake-provider/fake-model"]);
      },
      { workspaceId: selectedWorkspaceId },
    );

    await window.getByTestId("new-thread-composer").fill("try to start with all models disabled");
    const modelBadge = window.locator(".new-thread__hint .model-selector__badge").first();
    await expect(modelBadge).toBeVisible();
    await expect(modelBadge).toHaveText("No models available");
    await expect(window.getByTestId("model-onboarding-notice")).toContainText("Settings > Models");
    await expect(window.getByRole("button", { name: "Start thread" })).toBeDisabled();

    await modelBadge.click();
    const dropdown = window.getByRole("dialog", { name: "Choose model", exact: true });
    await expect(dropdown).toBeVisible();
    await expect(dropdown).toContainText("No models available");
    await expect(dropdown).not.toContainText("Open Settings > Models");

    await window
      .getByTestId("model-onboarding-notice")
      .getByRole("button", { name: "Open Settings > Models" })
      .click();
    await expect(window.getByTestId("settings-surface")).toBeVisible();
    await expect(window.locator(".view-header__title")).toHaveText("Models");
  } finally {
    await harness.close();
  }
});

test("refreshing discovers a newly available provider without configured model defaults", async () => {
  test.setTimeout(60_000);
  const userDataDir = await makeUserDataDir();
  const agentDir = join(userDataDir, "agent");
  const workspacePath = await makeWorkspace("new-thread-provider-connect-workspace");
  await seedAgentDir(agentDir, {
    withOpenAiAuth: false,
    withDefaultModel: false,
    enabledModels: [],
  });
  const harness = await launchDesktop(userDataDir, {
    agentDir,
    initialWorkspaces: [workspacePath],
    testMode: "background",
    scrubProviderEnv: true,
  });

  try {
    const window = await harness.firstWindow();
    await openNewThread(window);

    const composer = window.getByTestId("new-thread-composer");
    const notice = window.getByTestId("model-onboarding-notice");
    const modelBadge = window.locator(".new-thread__hint .model-selector__badge").first();
    await composer.fill("connect provider");
    await expect(modelBadge).toHaveText("No models available");
    await expect(notice).toContainText("Open Settings > Providers");

    await writeFile(
      join(agentDir, "auth.json"),
      `${JSON.stringify({ openai: { type: "api_key", key: "test-openai-key" } }, null, 2)}\n`,
      "utf8",
    );

    const selectedWorkspaceId = (await getDesktopState(window)).selectedWorkspaceId;
    expect(selectedWorkspaceId).toBeTruthy();
    await window.evaluate(
      async ({ workspaceId }) => {
        const app = globalThis.window.piApp;
        if (!app) {
          throw new Error("piApp IPC bridge is unavailable");
        }
        await app.refreshRuntime(workspaceId);
      },
      { workspaceId: selectedWorkspaceId },
    );

    const refreshedState = await getDesktopState(window);
    const runtime = refreshedState.runtimeByWorkspace[selectedWorkspaceId!];
    const resolvedDefault = runtime?.modelDiscovery?.find(
      (discovery) => discovery.defaultModel,
    )?.defaultModel;
    expect(resolvedDefault).toBeDefined();
    const resolvedLabel = runtime?.models.find(
      (model) =>
        model.providerId === resolvedDefault!.providerId &&
        model.modelId === resolvedDefault!.modelId,
    )?.label;
    expect(resolvedLabel).toBeDefined();
    await expect(modelBadge).toHaveAttribute("aria-label", resolvedLabel!);
    await expect(notice).toHaveCount(0);

    await modelBadge.click();
    const dropdown = window.getByRole("dialog", { name: "Choose model", exact: true });
    await expect(dropdown).toContainText("GPT-5");
    await expect(dropdown).toContainText("GPT-4o");
  } finally {
    await harness.close();
  }
});

test("settings do not show stale enabled-model pills when no providers are connected", async () => {
  test.setTimeout(60_000);
  const userDataDir = await makeUserDataDir();
  const agentDir = join(userDataDir, "agent");
  const workspacePath = await makeWorkspace("new-thread-no-provider-settings-workspace");
  await seedAgentDir(agentDir, {
    withOpenAiAuth: false,
    withDefaultModel: false,
    enabledModels: ["openai/gpt-5", "openai/gpt-4o"],
  });
  const harness = await launchDesktop(userDataDir, {
    agentDir,
    initialWorkspaces: [workspacePath],
    testMode: "background",
    scrubProviderEnv: true,
  });

  try {
    const window = await harness.firstWindow();
    await openNewThread(window);

    await window.getByTestId("new-thread-composer").fill("check no provider settings");
    await expect(window.getByTestId("model-onboarding-notice")).toContainText(
      "Open Settings > Providers",
    );

    await window.keyboard.press(desktopShortcut(","));
    await expect(window.getByTestId("settings-surface")).toBeVisible();
    await window.getByRole("button", { name: "Models", exact: true }).click();
    await expect(window.locator(".view-header__title")).toHaveText("Models");

    const enabledModelsSection = window.locator(".settings-section", {
      has: window.locator(".settings-list-label", { hasText: "Enabled models" }),
    });
    await expect(enabledModelsSection).toContainText("No connected models available yet.");
    await expect(enabledModelsSection).not.toContainText("openai/gpt-5");
    await expect(enabledModelsSection).not.toContainText("openai/gpt-4o");
    await expect(enabledModelsSection.locator(".settings-list-label")).toContainText("0 of 0");
  } finally {
    await harness.close();
  }
});

test("new thread starts once when Enter is pressed twice before it opens", async () => {
  test.setTimeout(60_000);
  const userDataDir = await makeUserDataDir();
  const agentDir = join(userDataDir, "agent");
  const workspacePath = await makeWorkspace("new-thread-double-submit-workspace");
  await seedAgentDir(agentDir);
  const harness = await launchDesktop(userDataDir, {
    agentDir,
    initialWorkspaces: [workspacePath],
    testMode: "background",
  });

  try {
    const window = await harness.firstWindow();
    const sessionCount = async () =>
      (await getDesktopState(window)).workspaces.reduce(
        (count, workspace) => count + workspace.sessions.length,
        0,
      );
    const before = await sessionCount();
    await openNewThread(window);

    const composer = window.getByTestId("new-thread-composer");
    await composer.fill("start exactly one thread");
    // Both key presses land before the first start returns, as a fast double Enter does.
    await composer.evaluate((element) => {
      for (let press = 0; press < 2; press += 1) {
        element.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
        );
      }
    });

    await expect(window.getByTestId("composer")).toBeVisible({ timeout: 15_000 });
    await expect.poll(sessionCount, { timeout: 5_000 }).toBe(before + 1);
    // Give a late second start time to land before asserting it never did.
    await window.waitForTimeout(1_000);
    expect(await sessionCount()).toBe(before + 1);
  } finally {
    await harness.close();
  }
});

test("workspace picker searches folders and supports keyboard selection and dismissal", async () => {
  const first = await makeWorkspace("picker-first");
  const second = await makeWorkspace("picker-second");
  const harness = await launchDesktop(await makeUserDataDir(), {
    initialWorkspaces: [first, second],
    testMode: "background",
  });
  try {
    const page = await harness.firstWindow();
    await openNewThread(page);
    const trigger = page.getByRole("button", { name: /^Workspace:/ });
    await trigger.click();
    const search = page.getByRole("textbox", { name: "Find workspace" });
    await expect(search).toBeFocused();
    await search.fill("picker-second");
    const option = page
      .getByRole("listbox", { name: "Workspaces", exact: true })
      .getByRole("option");
    await expect(option).toHaveCount(1);
    await search.press("ArrowDown");
    await expect(option).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(trigger).toContainText("picker-second");
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.screenshot({ path: test.info().outputPath("workspace-picker.png") });
    await search.press("Escape");
    await expect(search).toHaveCount(0);
    await expect(trigger).toBeFocused();
  } finally {
    await harness.close();
  }
});
