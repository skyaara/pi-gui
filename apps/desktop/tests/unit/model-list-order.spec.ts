import { expect, test } from "@playwright/test";
import type { RuntimeSnapshot } from "@pi-gui/session-driver/runtime-types";
import { buildModelOptions } from "../../src/features/conversation/composer-commands";

const runtime: RuntimeSnapshot = {
  workspace: { workspaceId: "order", path: "/order" },
  providers: [],
  skills: [],
  extensions: [],
  settings: {
    defaultProvider: "alpha",
    defaultModelId: "default",
    enableSkillCommands: true,
    enabledModelPatterns: [],
  },
  models: [
    ["beta", "newest"],
    ["beta", "oldest"],
    ["alpha", "z-model"],
    ["alpha", "a-model"],
    ["alpha", "default"],
  ].map(([providerId, modelId]) => ({
    providerId: providerId!,
    providerName: providerId!,
    modelId: modelId!,
    label: modelId!,
    available: true,
    authType: "api_key",
    reasoning: false,
    supportsImages: false,
  })),
};

test("Pi full-list order promotes current/default and preserves each provider's catalog order", () => {
  const options = buildModelOptions(runtime, { providerId: "beta", modelId: "oldest" });
  expect(options.map((model) => `${model.providerId}/${model.modelId}`)).toEqual([
    "beta/oldest",
    "alpha/default",
    "alpha/z-model",
    "alpha/a-model",
    "beta/newest",
  ]);
});

test("Pi scoped order wins over current/default and alphabetical labels", () => {
  const enabledModelPatterns = ["beta/newest", "alpha/z-model", "beta/oldest", "alpha/default"];
  const options = buildModelOptions(
    { ...runtime, settings: { ...runtime.settings, enabledModelPatterns } },
    { providerId: "beta", modelId: "oldest" },
  );
  expect(options.map((model) => `${model.providerId}/${model.modelId}`)).toEqual(
    enabledModelPatterns,
  );
});
