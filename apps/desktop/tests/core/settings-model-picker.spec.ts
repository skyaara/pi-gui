import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import {
  desktopShortcut,
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
  openNewThread,
  seedAgentDir,
} from "../helpers/electron-app";

test("Settings picker restricts models and shows selected model capabilities across providers", async () => {
  const userDataDir = await makeUserDataDir();
  const agentDir = join(userDataDir, "agent");
  const workspace = await makeWorkspace("settings-model-picker");
  await seedAgentDir(agentDir, {
    enabledModels: ["openai/gpt-5", "openai/gpt-4o", "local-test/limited"],
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
              reasoning: true,
              input: ["text"],
              contextWindow: 32000,
              maxTokens: 4000,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
              thinkingLevelMap: { off: null, minimal: null, medium: null, xhigh: null, max: null },
            },
          ],
        },
      },
    }),
  );
  let harness = await launchDesktop(userDataDir, {
    agentDir,
    initialWorkspaces: [workspace],
    testMode: "background",
  });
  try {
    let window = await harness.firstWindow();
    await openModels(window);
    await window.getByLabel("Enable openai/gpt-4o", { exact: true }).click();
    await expect(window.getByLabel("Enable openai/gpt-4o", { exact: true })).not.toBeChecked();
    await window.getByLabel("Default model", { exact: true }).click();
    let menu = window.getByRole("dialog", { name: "Choose model", exact: true });
    await expect(menu.locator(".model-selector__item-label")).toHaveText([
      "GPT-5",
      "Limited effort",
    ]);
    await menu.getByRole("button", { name: /Limited effort/ }).click();
    const thinking = window.getByLabel("Thinking level", { exact: true });
    await expect(thinking.locator("option")).toHaveText(["Low", "High"]);
    await expect(thinking).toHaveValue("high");
    await expect(window.locator(".settings-row").filter({ hasText: "Fast mode" })).toContainText(
      "Unavailable",
    );
    await thinking.selectOption("low");
    await window.getByRole("button", { name: "Back to app" }).click();
    await openNewThread(window);
    await expect(window.getByRole("button", { name: "Low", exact: true })).toBeVisible();
    await expect(window.getByRole("switch", { name: "Fast mode" })).toBeDisabled();
    await expect(window.getByRole("switch", { name: "Fast mode" })).toHaveAttribute(
      "title",
      "Fast mode unavailable for this model",
    );
    await harness.close();
    harness = await launchDesktop(userDataDir, {
      agentDir,
      initialWorkspaces: [workspace],
      testMode: "background",
    });
    window = await harness.firstWindow();
    await openModels(window);
    await expect(window.getByLabel("Enable openai/gpt-4o", { exact: true })).not.toBeChecked();
    await expect(window.getByLabel("Default model", { exact: true })).toHaveAttribute(
      "title",
      "local-test:limited",
    );
    await expect(window.getByLabel("Thinking level", { exact: true })).toHaveValue("low");
    await window.getByLabel("Default model", { exact: true }).click();
    menu = window.getByRole("dialog", { name: "Choose model", exact: true });
    await menu.getByRole("button", { name: /GPT-5/ }).click();
    await expect(window.getByLabel("Thinking level", { exact: true }).locator("option")).toHaveText(
      ["Minimal", "Low", "Medium", "High"],
    );
    await expect(window.locator(".settings-row").filter({ hasText: "Fast mode" })).toContainText(
      "Available",
    );
    await window.getByLabel("Thinking level", { exact: true }).selectOption("minimal");
    await expect(window.getByLabel("Thinking level", { exact: true })).toHaveValue("minimal");
    await harness.close();
    harness = await launchDesktop(userDataDir, {
      agentDir,
      initialWorkspaces: [workspace],
      testMode: "background",
    });
    window = await harness.firstWindow();
    await openModels(window);
    await expect(window.getByLabel("Thinking level", { exact: true })).toHaveValue("minimal");
    await window.screenshot({ path: test.info().outputPath("settings-model-picker.png") });
  } finally {
    await harness.close();
  }
});

async function openModels(window: Page): Promise<void> {
  await window.keyboard.press(desktopShortcut(","));
  await window.getByRole("button", { name: "Models", exact: true }).click();
  await expect(window.getByLabel("Default model", { exact: true })).toBeVisible();
}
