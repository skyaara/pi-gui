import type { ExtensionFactory } from "@earendil-works/pi-coding-agent";

export const FAST_MODE_ENTRY = "piui-fast-mode";

export function supportsFastMode(model: { provider: string; api: string } | undefined): boolean {
  return Boolean(
    model &&
    (model.provider === "openai" || model.provider === "openai-codex") &&
    (model.api === "openai-responses" || model.api === "openai-codex-responses"),
  );
}

export function readFastMode(
  entries: readonly { type: string; customType?: string; data?: unknown }[],
): boolean | undefined {
  for (let index = entries.length - 1; index >= 0; index--) {
    const entry = entries[index]!;
    if (
      entry.type === "custom" &&
      entry.customType === FAST_MODE_ENTRY &&
      entry.data &&
      typeof entry.data === "object" &&
      "enabled" in entry.data &&
      typeof entry.data.enabled === "boolean"
    ) {
      return entry.data.enabled;
    }
  }
  return undefined;
}

export const fastModeExtension: ExtensionFactory = (pi) => {
  pi.on("before_provider_request", (event, context) => {
    if (!supportsFastMode(context.model) || !readFastMode(context.sessionManager.getBranch()))
      return;
    if (event.payload && typeof event.payload === "object") {
      return { ...event.payload, service_tier: "priority" };
    }
  });
};
