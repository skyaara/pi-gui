import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RuntimeSupervisor } from "../dist/runtime-supervisor.js";
import { effectiveModelDiscovery } from "@pi-gui/session-driver/runtime-types";

await test("Pi discovers wildcard scopes, effort suffixes, defaults, and refresh without rewriting settings", async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-native-discovery-"));
  const agentDir = join(root, "agent");
  const workspacePath = join(root, "workspace");
  await mkdir(agentDir);
  await mkdir(workspacePath);
  await writeFile(join(agentDir, "auth.json"), "{}");
  const models = ["second", "first", "other"].map((id) => ({
    id,
    name: id,
    reasoning: true,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 32000,
    maxTokens: 4000,
    thinkingLevelMap: { xhigh: null, max: null },
  }));
  const modelsPath = join(agentDir, "models.json");
  const saveModels = async (catalog = models) =>
    writeFile(
      modelsPath,
      JSON.stringify({
        providers: {
          "discovery-test": {
            api: "openai-completions",
            apiKey: "test-key",
            baseUrl: "http://localhost:9/v1",
            models: catalog,
          },
        },
      }),
    );
  await saveModels();
  const settingsPath = join(agentDir, "settings.json");
  const settingsText = JSON.stringify({
    packages: [],
    enabledModels: ["discovery-test/first:high", "discovery-test/*:low"],
  });
  await writeFile(settingsPath, settingsText);
  const supervisor = new RuntimeSupervisor({ agentDir });
  const workspace = { workspaceId: "discovery", path: workspacePath };
  const snapshot = await supervisor.getRuntimeSnapshot(workspace);
  const discovery = effectiveModelDiscovery(snapshot);
  assert.deepEqual(
    discovery?.scopedModels?.map((model) => `${model.providerId}/${model.modelId}`),
    ["discovery-test/first", "discovery-test/second", "discovery-test/other"],
  );
  assert.equal(discovery?.defaultModel?.modelId, "first");
  assert.equal(discovery?.defaultModel?.thinkingLevel, "high");
  assert.equal(discovery?.scopedModels?.[1]?.thinkingLevel, "low");
  assert.deepEqual(discovery?.diagnostics, []);
  await supervisor.refreshRuntime(workspace);
  assert.equal(await readFile(settingsPath, "utf8"), settingsText);
  await saveModels(models.filter((model) => model.id !== "other"));
  const refreshed = effectiveModelDiscovery(await supervisor.refreshRuntime(workspace));
  assert.deepEqual(
    refreshed?.scopedModels?.map((model) => model.modelId),
    ["first", "second"],
  );
  assert.equal(await readFile(settingsPath, "utf8"), settingsText);
  const savedDefaultSettings = JSON.stringify({
    packages: [],
    enabledModels: ["discovery-test/first:high", "discovery-test/*:low"],
    defaultProvider: "discovery-test",
    defaultModel: "second",
  });
  await writeFile(settingsPath, savedDefaultSettings);
  const savedDefault = effectiveModelDiscovery(await supervisor.refreshRuntime(workspace));
  assert.equal(savedDefault?.defaultModel?.modelId, "second");
  assert.equal(savedDefault?.defaultModel?.thinkingLevel, "low");
  assert.equal(await readFile(settingsPath, "utf8"), savedDefaultSettings);
  const unmatchedSettings = JSON.stringify({
    packages: [],
    enabledModels: ["discovery-test/missing*"],
  });
  await writeFile(settingsPath, unmatchedSettings);
  const unmatched = effectiveModelDiscovery(await supervisor.refreshRuntime(workspace));
  assert.deepEqual(unmatched?.scopedModels, []);
  assert.equal(unmatched?.diagnostics.length, 1);
  assert.equal(await readFile(settingsPath, "utf8"), unmatchedSettings);
  assert.ok(
    !(await readdir(agentDir)).includes("sessions"),
    "discovery must not create a saved Pi session",
  );
});
