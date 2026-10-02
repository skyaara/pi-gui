import type { ExtensionFactory } from "@earendil-works/pi-coding-agent";

export const FAST_MODE_ENTRY = "piui-fast-mode";

// Model-specific availability from the providers' Fast pricing/support tables.
// https://developers.openai.com/api/docs/pricing?latest-pricing=fast
// https://platform.claude.com/docs/en/build-with-claude/fast-mode
const OPENAI_FAST_MODELS = new Set([
  "gpt-6-astra",
  "gpt-6.1-sol",
  "gpt-6-luna",
  "gpt-6-sol",
  "gpt-5.6-sol",
  "gpt-5.6-terra",
  "gpt-5.6-luna",
  "gpt-5.5",
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-5.2",
  "gpt-5.1",
  "gpt-5",
  "gpt-5-mini",
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4.1-nano",
  "gpt-4o",
  "gpt-4o-mini",
  "o3",
  "o4-mini",
]);
const CODEX_FAST_MODELS = new Set([
  "gpt-6-astra",
  "gpt-6.1-sol",
  "gpt-6-luna",
  "gpt-6-sol",
  "gpt-5.6-sol",
  "gpt-5.6-terra",
  "gpt-5.6-luna",
  "gpt-5.5",
  "gpt-5.4",
  "gpt-5.3-codex",
  "gpt-5.2-codex",
  "gpt-5.1-codex",
]);
const ANTHROPIC_FAST_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-opus-4-8"]);
const ANTHROPIC_FAST_BETA = "fast-mode-2026-02-01";

export function supportsFastMode(
  model: { provider: string; api: string; id: string } | undefined,
): boolean {
  if (!model) return false;
  if (model.provider === "anthropic" && model.api === "anthropic-messages")
    return ANTHROPIC_FAST_MODELS.has(model.id);
  // Dated OpenAI snapshots retain the same service tier as their base model.
  const modelId = model.id.replace(/-\d{4}-\d{2}-\d{2}$/, "");
  if (model.provider === "openai" && model.api === "openai-responses")
    return OPENAI_FAST_MODELS.has(modelId);
  return (
    model.provider === "openai-codex" &&
    model.api === "openai-codex-responses" &&
    CODEX_FAST_MODELS.has(modelId)
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
      return context.model?.provider === "anthropic"
        ? { ...event.payload, speed: "fast" }
        : { ...event.payload, service_tier: "priority" };
    }
  });
  pi.on("before_provider_headers", (event, context) => {
    if (
      context.model?.provider !== "anthropic" ||
      !supportsFastMode(context.model) ||
      !readFastMode(context.sessionManager.getBranch())
    )
      return;
    const key =
      Object.keys(event.headers).find((name) => name.toLowerCase() === "anthropic-beta") ??
      "anthropic-beta";
    const flags = (event.headers[key] ?? "")
      .split(",")
      .map((flag) => flag.trim())
      .filter(Boolean);
    if (!flags.includes(ANTHROPIC_FAST_BETA)) flags.push(ANTHROPIC_FAST_BETA);
    event.headers[key] = flags.join(",");
  });
};
