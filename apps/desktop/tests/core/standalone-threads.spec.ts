import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  getDesktopState,
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
  seedAgentDir,
  setDeferredThreadTitleMode,
  resolveDeferredThreadTitleEventually,
} from "../helpers/electron-app";

// Exercise the real Pi session loop with a local provider. No remote account is used.
const provider = String.raw`
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
export default function(pi) {
  let cwd;
  pi.on("before_agent_start", async (_event, ctx) => {
    cwd = ctx.cwd;
    await writeFile(join(cwd, "chat-file.txt"), "Saved in this chat's working folder");
  });
  pi.registerProvider("standalone-test", {
    baseUrl: "http://127.0.0.1:9/never-contact", apiKey: "LOCAL_TEST_CANARY", api: "standalone-test",
    models: [{ id: "local", name: "Local proof", reasoning: false, input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 128000, maxTokens: 4096 }],
    streamSimple(model) {
      const stream = createAssistantMessageEventStream();
      const result = { role: "assistant", content: [{ type: "text", text: "Chat ready in " + cwd }],
        api: model.api, provider: model.provider, model: model.id,
        usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
        stopReason: "stop", timestamp: Date.now() };
      stream.push({ type: "start", partial: { ...result, content: [] } });
      stream.push({ type: "text_delta", contentIndex: 0, delta: result.content[0].text, partial: result });
      stream.push({ type: "done", reason: "stop", message: result });
      return stream;
    }
  });
}
`;

test("projectless chats get separate working folders and survive restart", async () => {
  const profile = await makeUserDataDir();
  const agentDir = join(profile, "agent");
  await seedAgentDir(agentDir, { withOpenAiAuth: false, withDefaultModel: false });
  await mkdir(join(agentDir, "extensions"));
  await writeFile(join(agentDir, "extensions", "standalone-proof.ts"), provider);
  await writeFile(
    join(agentDir, "settings.json"),
    JSON.stringify({
      defaultProvider: "standalone-test",
      defaultModel: "local",
      enabledModels: ["standalone-test/local"],
      packages: [],
      cacheWarming: "off",
      compaction: { enabled: false },
    }),
  );
  let harness = await launchDesktop(profile, { agentDir, testMode: "background" });
  const folders: string[] = [];
  try {
    const page = await harness.firstWindow();
    await expect(
      page.getByRole("complementary").getByRole("button", { name: "New thread", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Chat without a project" }).click();
    await setDeferredThreadTitleMode(harness);
    for (const title of ["First personal chat", "Second personal chat"]) {
      await expect(page.getByRole("button", { name: "Workspace: No project" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Worktree", exact: true })).toHaveCount(0);
      await page.getByTestId("new-thread-composer").fill(title);
      await page.getByRole("button", { name: "Start thread", exact: true }).click();
      await expect(page.getByTestId("transcript")).toContainText("Chat ready in");
      await resolveDeferredThreadTitleEventually(harness, title);
      await expect(page.locator(".session-row__select", { hasText: title })).toBeVisible();
      const state = await getDesktopState(page);
      const workspace = state.workspaces.find((entry) => entry.id === state.selectedWorkspaceId)!;
      expect(workspace.kind).toBe("standalone");
      expect(workspace.isStandalone).toBe(true);
      expect(dirname(workspace.path)).toBe(
        state.workspaces.find((entry) => entry.id === workspace.rootWorkspaceId)!.path,
      );
      expect(await readFile(join(workspace.path, "chat-file.txt"), "utf8")).toBe(
        "Saved in this chat's working folder",
      );
      folders.push(workspace.path);
      await page
        .getByRole("complementary")
        .getByRole("button", { name: "New thread", exact: true })
        .click();
    }
    expect(new Set(folders).size).toBe(2);
    await expect(page.getByTestId("new-thread-composer")).toBeVisible();
    await page.screenshot({ path: test.info().outputPath("no-project.png") });
  } finally {
    await harness.close();
  }
  harness = await launchDesktop(profile, { agentDir, testMode: "background" });
  try {
    const page = await harness.firstWindow();
    for (const title of ["First personal chat", "Second personal chat"]) {
      await page.locator(".session-row__select", { hasText: title }).click();
      await expect(page.getByTestId("transcript")).toContainText("Chat ready in");
    }
    const state = await getDesktopState(page);
    expect(
      state.workspaces
        .filter((entry) => entry.kind === "standalone")
        .map((entry) => entry.path)
        .sort(),
    ).toEqual([...folders].sort());
    for (const folder of folders)
      expect(await readFile(join(folder, "chat-file.txt"), "utf8")).toContain("Saved");
  } finally {
    await harness.close();
  }
});

test("a project can switch to No project and storage failures remain recoverable", async () => {
  const profile = await makeUserDataDir();
  const workspace = await makeWorkspace("standalone-project-switch");
  const storage = join(profile, "threads");
  await writeFile(storage, "Blocking file preserved for the user");
  const harness = await launchDesktop(profile, {
    initialWorkspaces: [workspace],
    testMode: "background",
  });
  try {
    const page = await harness.firstWindow();
    await page
      .getByRole("complementary")
      .getByRole("button", { name: "New thread", exact: true })
      .click();
    await page.getByTestId("new-thread-composer").fill("Keep my draft");
    await page.getByRole("button", { name: /^Workspace:/ }).click();
    await page.getByRole("option", { name: /No project/ }).click();
    await expect(page.getByTestId("new-thread-composer")).toHaveValue("Keep my draft");
    await expect(page.locator(".new-thread__composer")).toContainText("EEXIST");
    expect((await getDesktopState(page)).workspaces).toHaveLength(1);
    await rename(storage, join(profile, "preserved-blocking-file"));
    await page.getByRole("button", { name: /^Workspace:/ }).click();
    await page.getByRole("option", { name: /No project/ }).click();
    await expect(page.getByRole("button", { name: "Workspace: No project" })).toBeVisible();
    await expect(page.getByTestId("new-thread-composer")).toHaveValue("Keep my draft");
    await expect(page.getByRole("button", { name: "Worktree", exact: true })).toHaveCount(0);
    await rename(storage, join(profile, "saved-chat-storage"));
    await writeFile(storage, "Another blocking file");
    await page.getByRole("button", { name: "Start thread", exact: true }).click();
    await expect(page.locator(".new-thread__composer")).toContainText("ENOTDIR");
    await expect(page.getByTestId("new-thread-composer")).toHaveValue("Keep my draft");
    await rename(storage, join(profile, "preserved-second-file"));
    await rename(join(profile, "saved-chat-storage"), storage);
    await page.getByRole("button", { name: "Workspace: No project" }).click();
    await page.getByRole("option", { name: /standalone-project-switch/ }).click();
    await expect(page.getByRole("button", { name: "Worktree", exact: true })).toBeVisible();
  } finally {
    await harness.close();
  }
});

test("New thread works before opening a folder and reports storage errors", async () => {
  const profile = await makeUserDataDir();
  const storage = join(profile, "threads");
  await writeFile(storage, "Keep this file");
  const harness = await launchDesktop(profile, { testMode: "background" });
  try {
    const page = await harness.firstWindow();
    const newThread = page
      .getByRole("complementary")
      .getByRole("button", { name: "New thread", exact: true });
    await newThread.click();
    await expect(page.getByRole("alert")).toContainText("EEXIST");
    await rename(storage, join(profile, "preserved-file"));
    await newThread.click();
    await expect(page.getByTestId("new-thread-composer")).toBeVisible();
    await expect(page.getByRole("button", { name: "Workspace: No project" })).toBeVisible();
  } finally {
    await harness.close();
  }
});
