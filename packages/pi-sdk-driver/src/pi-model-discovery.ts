import {
  createAgentSession,
  resolveModelScopeWithDiagnostics,
  SessionManager,
  type DefaultResourceLoader,
  type ModelRuntime,
  type SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { clampThinkingLevel } from "@earendil-works/pi-ai/models";
import type { RuntimeModelDiscovery } from "@pi-gui/session-driver/runtime-types";

/** T3's PiProvider probes get_state/get_available_models; use the same Pi authority
 * through the SDK, with an in-memory session and no provider request or session file. */
export async function discoverPiModelSelection(
  cwd: string,
  agentDir: string,
  modelRuntime: ModelRuntime,
  settingsManager: SettingsManager,
  resourceLoader: DefaultResourceLoader,
): Promise<RuntimeModelDiscovery> {
  const patterns = settingsManager.getEnabledModels() ?? [];
  const { scopedModels, diagnostics } = await resolveModelScopeWithDiagnostics(
    patterns,
    modelRuntime,
  );
  // Pi's CLI retains a saved default within the scope, then falls back to its first entry.
  const first =
    scopedModels.find(
      ({ model }) =>
        model.provider === settingsManager.getDefaultProvider() &&
        model.id === settingsManager.getDefaultModel(),
    ) ?? scopedModels[0];
  const { session } = await createAgentSession({
    cwd,
    agentDir,
    modelRuntime,
    settingsManager,
    resourceLoader,
    sessionManager: SessionManager.inMemory(cwd),
    noTools: "all",
    ...(first
      ? {
          model: first.model,
          thinkingLevel: clampThinkingLevel(
            first.model,
            first.thinkingLevel ??
              settingsManager.getModelThinkingLevel(first.model.provider, first.model.id) ??
              settingsManager.getDefaultThinkingLevel() ??
              "medium",
          ),
        }
      : {}),
  });
  try {
    const model = session.model;
    return {
      settings: {
        ...(settingsManager.getDefaultProvider()
          ? { defaultProvider: settingsManager.getDefaultProvider()! }
          : {}),
        ...(settingsManager.getDefaultModel()
          ? { defaultModelId: settingsManager.getDefaultModel()! }
          : {}),
        ...(settingsManager.getDefaultThinkingLevel()
          ? { defaultThinkingLevel: settingsManager.getDefaultThinkingLevel()! }
          : {}),
        enabledModelPatterns: patterns,
      },
      ...(model
        ? {
            defaultModel: {
              providerId: model.provider,
              modelId: model.id,
              thinkingLevel: session.thinkingLevel,
            },
          }
        : {}),
      ...(patterns.length
        ? {
            scopedModels: scopedModels.map(({ model, thinkingLevel }) => ({
              providerId: model.provider,
              modelId: model.id,
              ...(thinkingLevel ? { thinkingLevel: clampThinkingLevel(model, thinkingLevel) } : {}),
            })),
          }
        : {}),
      diagnostics: diagnostics.map((diagnostic) => diagnostic.message),
    };
  } finally {
    session.dispose();
  }
}
