import test from "node:test";
import assert from "node:assert/strict";
import { toAuthInteraction } from "../dist/login-interaction.js";

await test("browser completion aborts the desktop manual fallback", async () => {
  const callback = new AbortController();
  let shown = false;
  const interaction = toAuthInteraction({
    onAuth: () => undefined,
    onPrompt: async (prompt) => {
      assert.equal(prompt.manualCode, true);
      assert.equal(prompt.signal, callback.signal);
      shown = true;
      return new Promise<string>((_resolve, reject) => {
        prompt.signal!.addEventListener("abort", () => reject(new Error("Fallback dismissed")), {
          once: true,
        });
      });
    },
  });
  const fallback = interaction.prompt({
    type: "manual_code",
    message: "Paste callback",
    signal: callback.signal,
  });
  const closed = assert.rejects(fallback, /Fallback dismissed/);
  assert.equal(shown, true);
  callback.abort();
  await closed;
});

await test("manual-code hosts receive the same cancellation signal", async () => {
  const callback = new AbortController();
  const interaction = toAuthInteraction({
    onAuth: () => undefined,
    onPrompt: async () => {
      throw new Error("Wrong prompt route");
    },
    onManualCodeInput: async (signal) => {
      assert.equal(signal, callback.signal);
      return "manual-result";
    },
  });
  assert.equal(
    await interaction.prompt({
      type: "manual_code",
      message: "Paste callback",
      signal: callback.signal,
    }),
    "manual-result",
  );
});
