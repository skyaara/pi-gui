import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import {
  createNamedThread,
  getDesktopState,
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
  openNewThread,
  pasteTinyPng,
  seedAgentDir,
} from "../helpers/electron-app";

// Issue #228: picking a model or thinking level from the composer footer must keep the prompt
// and its attachments.
test("changing model or thinking from the composer footer keeps the typed prompt and attachments", async () => {
  test.setTimeout(60_000);
  const userDataDir = await makeUserDataDir();
  const agentDir = join(userDataDir, "agent");
  const workspacePath = await makeWorkspace("model-change-draft");
  await seedAgentDir(agentDir);
  const harness = await launchDesktop(userDataDir, {
    agentDir,
    initialWorkspaces: [workspacePath],
    testMode: "background",
  });

  try {
    const window = await harness.firstWindow();
    await createNamedThread(window, "Keep my prompt");
    const composer = window.getByTestId("composer");
    const footer = window.locator(".composer__bar");
    const prompt = "Refactor the parser\nand keep the tests green";
    await pasteTinyPng(window);
    const attachment = window.locator(".composer-attachment--image");
    await expect(attachment).toHaveCount(1);
    await composer.fill(prompt);
    // Wait until the draft is saved, so the picker's state update is not masked by a pending edit.
    await expect.poll(async () => (await getDesktopState(window)).composerDraft).toBe(prompt);

    await footer.getByRole("button", { name: "GPT-5", exact: true }).click();
    await window
      .getByRole("dialog", { name: "Choose model" })
      .getByRole("button", { name: /GPT-4o/ })
      .click();
    await expect(footer.getByRole("button", { name: "GPT-4o", exact: true })).toBeVisible();
    await expect(window.getByTestId("transcript")).toContainText("Model set to openai:gpt-4o");
    await expect(composer).toHaveValue(prompt);
    await expect(attachment).toHaveCount(1);

    const thinkingBadge = footer.locator(".model-selector__badge").nth(1);
    await expect(thinkingBadge).toHaveText("Off");
    await thinkingBadge.click();
    await expect(
      window.getByRole("dialog", { name: "Thinking level" }).locator(".model-selector__item-label"),
    ).toHaveText(["Off"]);
    await window.keyboard.press("Escape");
    await expect(thinkingBadge).toBeFocused();
    await expect(composer).toHaveValue(prompt);
    await expect(attachment).toHaveCount(1);

    // Picking from the /model menu consumes only the command text; the saved "/model" must not
    // return, and the attachment stays.
    await composer.fill("/model");
    await expect.poll(async () => (await getDesktopState(window)).composerDraft).toBe("/model");
    const optionsMenu = window.getByTestId("slash-options-menu");
    await optionsMenu.getByRole("button", { name: /GPT-5/ }).first().click();
    await expect(window.getByTestId("transcript")).toContainText("Model set to openai:gpt-5");
    // The cleared draft is saved before the model changes, not after the typing debounce.
    expect((await getDesktopState(window)).composerDraft).toBe("");
    await expect(footer.getByRole("button", { name: "GPT-5", exact: true })).toBeVisible();
    await expect(composer).toHaveValue("");
    await expect.poll(async () => (await getDesktopState(window)).composerDraft).toBe("");
    await expect(composer).toHaveValue("");
    await expect(attachment).toHaveCount(1);
    await expect(thinkingBadge).toHaveText("Medium");
    await composer.fill(prompt);
    await thinkingBadge.click();
    const thinkingMenu = window.getByRole("dialog", { name: "Thinking level" });
    await expect(thinkingMenu.locator(".model-selector__item-label")).toHaveText([
      "Minimal",
      "Low",
      "Medium",
      "High",
    ]);
    await thinkingMenu.getByRole("button", { name: /^Minimal/ }).click();
    await expect(thinkingBadge).toHaveText("Minimal");
    await expect(composer).toHaveValue(prompt);
    await expect(attachment).toHaveCount(1);
    await expect.poll(async () => (await getDesktopState(window)).composerDraft).toBe(prompt);
    await window.screenshot({ path: test.info().outputPath("pi-thinking-minimal.png") });
  } finally {
    await harness.close();
  }
});

test("switching provider and model keeps session and new-thread drafts", async () => {
  test.setTimeout(60_000);
  const userDataDir = await makeUserDataDir();
  const agentDir = join(userDataDir, "agent");
  const workspacePath = await makeWorkspace("provider-model-draft");
  await seedAgentDir(agentDir, {
    enabledModels: ["openai/gpt-5", "local-test/limited", "openai/gpt-4o"],
  });
  await writeFile(
    join(agentDir, "models.json"),
    JSON.stringify({
      providers: {
        "local-test": {
          api: "openai-completions",
          apiKey: "fixture-key",
          baseUrl: "http://localhost:9/v1",
          models: [
            {
              id: "limited",
              name: "Limited effort",
              reasoning: false,
              input: ["text"],
              contextWindow: 32000,
              maxTokens: 4000,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            },
          ],
        },
      },
    }),
  );
  let harness = await launchDesktop(userDataDir, {
    agentDir,
    initialWorkspaces: [workspacePath],
  });

  try {
    let window = await harness.firstWindow();
    if (process.env.PI_APP_TEST_MODE === "foreground") {
      await harness.focusWindow();
      expect(
        await harness.electronApp.evaluate(({ BrowserWindow }) => {
          const appWindow = BrowserWindow.getAllWindows()[0];
          return { visible: appWindow?.isVisible(), focused: appWindow?.isFocused() };
        }),
      ).toEqual({ visible: true, focused: true });
    }
    await createNamedThread(window, "Switch providers with a draft");
    // Keep the normal draft debounce pending while both model changes complete.
    await window.evaluate(() => {
      const schedule = globalThis.window.setTimeout.bind(globalThis.window);
      globalThis.window.setTimeout = (handler: TimerHandler, delay?: number, ...args: unknown[]) =>
        schedule(handler, delay === 350 ? 60_000 : delay, ...args);
    });
    const draft = "Preserve this exact unsent draft\nwhile switching providers";
    const composer = window.getByTestId("composer");
    await composer.fill(draft);
    const modelButton = window.locator(".composer__bar .model-selector__badge").first();
    await modelButton.click();
    let picker = window.getByRole("dialog", { name: "Choose model" });
    await picker.getByRole("button", { name: "Limited effort" }).click();
    await expect(modelButton).toHaveText("Limited effort");
    await expect(window.getByTestId("transcript")).toContainText("Model set to local-test:limited");
    await expect(composer).toHaveValue(draft);

    await modelButton.click();
    picker = window.getByRole("dialog", { name: "Choose model" });
    await picker.getByRole("button", { name: "GPT-4o" }).click();
    await expect(modelButton).toHaveText("GPT-4o");
    await expect(window.getByTestId("transcript")).toContainText("Model set to openai:gpt-4o");
    await expect(composer).toHaveValue(draft);

    await harness.close();
    harness = await launchDesktop(userDataDir, { agentDir });
    window = await harness.firstWindow();
    await expect(window.getByTestId("composer")).toHaveValue(draft);
    await expect(window.locator(".composer__bar .model-selector__badge").first()).toHaveText(
      "GPT-4o",
    );

    await openNewThread(window);
    const newThreadDraft = "Keep this new-thread draft across provider choices";
    const newThreadComposer = window.getByTestId("new-thread-composer");
    await newThreadComposer.fill(newThreadDraft);
    const newThreadModelButton = window.locator(".new-thread__hint .model-selector__badge").first();
    await newThreadModelButton.click();
    picker = window.getByRole("dialog", { name: "Choose model" });
    await window.keyboard.press("Escape");
    await expect(picker).toHaveCount(0);
    await expect(newThreadModelButton).toHaveText("GPT-5");
    await expect(newThreadComposer).toHaveValue(newThreadDraft);
    await newThreadModelButton.click();
    picker = window.getByRole("dialog", { name: "Choose model" });
    await picker.getByRole("button", { name: "Limited effort" }).click();
    await expect(newThreadModelButton).toHaveText("Limited effort");
    await expect(newThreadComposer).toHaveValue(newThreadDraft);
    await newThreadModelButton.click();
    picker = window.getByRole("dialog", { name: "Choose model" });
    await picker.getByRole("button", { name: "GPT-4o" }).click();
    await expect(newThreadModelButton).toHaveText("GPT-4o");
    await expect(newThreadComposer).toHaveValue(newThreadDraft);
    await window.screenshot({ path: test.info().outputPath("provider-model-drafts.png") });
  } finally {
    await harness.close();
  }
});
