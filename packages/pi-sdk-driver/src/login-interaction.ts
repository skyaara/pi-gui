import type { ModelRuntime } from "@earendil-works/pi-coding-agent";
import type { RuntimeLoginCallbacks } from "@pi-gui/session-driver/runtime-types";
type LoginInteraction = Parameters<ModelRuntime["login"]>[2];

/** The option id pi's sign-in choices use for browser login (Anthropic, OpenAI Codex, Radius). */
const BROWSER_LOGIN_METHOD = "browser";

export function toAuthInteraction(callbacks: RuntimeLoginCallbacks): LoginInteraction {
  return {
    ...(callbacks.signal ? { signal: callbacks.signal } : {}),
    prompt: async (prompt) => {
      if (prompt.type === "select") {
        // pi's sign-ins open with "browser or headless"; pi-gui always runs where the browser is.
        const browser = prompt.options.find((option) => option.id === BROWSER_LOGIN_METHOD);
        if (browser) return browser.id;
        const defaultOption = prompt.options[0];
        const choice = await callbacks.onPrompt({
          message: `${prompt.message}\n${prompt.options
            .map((option, index) => `${index + 1}. ${option.label}`)
            .join("\n")}`,
          allowEmpty: true,
          ...(defaultOption ? { placeholder: defaultOption.label } : {}),
        });
        const normalizedChoice = choice.trim();
        if (!normalizedChoice) {
          return defaultOption?.id ?? "";
        }
        const selectedIndex = Number.parseInt(normalizedChoice, 10);
        if (
          Number.isInteger(selectedIndex) &&
          selectedIndex >= 1 &&
          selectedIndex <= prompt.options.length
        ) {
          return prompt.options[selectedIndex - 1]?.id ?? normalizedChoice;
        }
        return (
          prompt.options.find(
            (option) => option.id === normalizedChoice || option.label === normalizedChoice,
          )?.id ?? normalizedChoice
        );
      }
      if (prompt.type === "manual_code" && callbacks.onManualCodeInput) {
        return callbacks.onManualCodeInput(prompt.signal);
      }
      return callbacks.onPrompt({
        message: prompt.message,
        ...(prompt.type === "manual_code" ? { signal: prompt.signal, manualCode: true } : {}),
        allowEmpty: false,
        ...(prompt.placeholder ? { placeholder: prompt.placeholder } : {}),
      });
    },
    notify: (event) => {
      if (event.type === "auth_url") {
        Promise.resolve(
          callbacks.onAuth({
            url: event.url,
            ...(event.instructions ? { instructions: event.instructions } : {}),
          }),
        ).catch((error: unknown) => {
          console.error("OAuth authorization callback failed", error);
        });
        return;
      }
      if (event.type === "device_code") {
        Promise.resolve(
          callbacks.onAuth({
            url: event.verificationUri,
            userCode: event.userCode,
            instructions: [
              `Enter code: ${event.userCode}`,
              event.expiresInSeconds ? `Expires in ${event.expiresInSeconds} seconds.` : undefined,
            ]
              .filter((line): line is string => Boolean(line))
              .join("\n"),
          }),
        ).catch((error: unknown) => {
          console.error("OAuth device-code callback failed", error);
        });
        return;
      }
      if (event.type === "progress" || event.type === "info") {
        Promise.resolve(callbacks.onProgress?.(event.message)).catch((error: unknown) => {
          console.error("OAuth progress callback failed", error);
        });
      }
    },
  };
}
