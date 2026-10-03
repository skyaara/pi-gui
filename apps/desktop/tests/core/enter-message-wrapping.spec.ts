import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
  seedAgentDir,
  writeProjectExtension,
} from "../helpers/electron-app";

// Keep Enter submission on the real Pi session path without a remote request.
const provider = String.raw`
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
export default function(pi) {
  pi.registerProvider("wrapping-test", {
    baseUrl: "http://127.0.0.1:9/never-contact", apiKey: "LOCAL_TEST_CANARY", api: "wrapping-test",
    models: [{ id: "local", name: "Local wrapping proof", reasoning: false, input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 128000, maxTokens: 4096 }],
    streamSimple(model) {
      const stream = createAssistantMessageEventStream();
      const message = { role: "assistant", content: [{ type: "text", text: "Received." }],
        api: model.api, provider: model.provider, model: model.id,
        usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
        stopReason: "stop", timestamp: Date.now() };
      stream.push({ type: "start", partial: { ...message, content: [] } });
      stream.push({ type: "text_delta", contentIndex: 0, delta: "Received.", partial: message });
      stream.push({ type: "done", reason: "stop", message });
      return stream;
    }
  });
}
`;

test("Enter sends short messages without splitting the last letter and long messages stay contained", async ({}, testInfo) => {
  const profile = await makeUserDataDir();
  const agentDir = join(profile, "agent");
  const workspace = await makeWorkspace("message-wrapping");
  await seedAgentDir(agentDir, { withOpenAiAuth: false, withDefaultModel: false });
  await writeFile(
    join(agentDir, "settings.json"),
    JSON.stringify({
      defaultProvider: "wrapping-test",
      defaultModel: "local",
      enabledModels: ["wrapping-test/local"],
      packages: [],
      cacheWarming: "off",
    }),
  );
  await writeProjectExtension(workspace, "wrapping.ts", provider);
  const harness = await launchDesktop(profile, {
    agentDir,
    initialWorkspaces: [workspace],
    scrubProviderEnv: true,
  });
  try {
    const page = await harness.firstWindow();
    const messages = ["hello", "thanks", "verified", "Please check this sentence."];
    for (const [index, text] of messages.entries()) {
      const composer = page.getByTestId(index === 0 ? "new-thread-composer" : "composer");
      await composer.fill(text);
      await composer.press("Enter");
      const bubble = page.locator(".timeline-item__bubble").last();
      await expect(bubble).toHaveText(text);
      await expect(page.getByTestId("composer")).toHaveValue("");
      await expect(page.getByTestId("send")).not.toHaveAttribute("aria-label", "Stop run");
      await page.screenshot({ path: testInfo.outputPath(`sent-${index}.png`) });
      const lineCount = await bubble.locator("p").evaluate((paragraph) => {
        const range = document.createRange();
        range.selectNodeContents(paragraph);
        return new Set(Array.from(range.getClientRects(), (rect) => rect.top)).size;
      });
      expect(lineCount, `Sent message ${JSON.stringify(text)} should fit on one line`).toBe(1);
    }

    // Explicit newlines still belong to the draft; Enter submits all its characters.
    const composer = page.getByTestId("composer");
    await composer.fill("First paragraph");
    await composer.press("Shift+Enter");
    await composer.press("Shift+Enter");
    await composer.pressSequentially("Second paragraph");
    await expect(composer).toHaveValue("First paragraph\n\nSecond paragraph");
    await composer.press("Enter");
    await expect(page.locator(".timeline-item__bubble").last().locator("p")).toHaveText([
      "First paragraph",
      "Second paragraph",
    ]);
    await expect(page.getByTestId("send")).not.toHaveAttribute("aria-label", "Stop run");

    for (const text of ["Long message words. ".repeat(30).trim(), "x".repeat(220)]) {
      await composer.fill(text);
      await composer.press("Enter");
      const bubble = page.locator(".timeline-item__bubble").last();
      await expect(bubble).toHaveText(text);
      const geometry = await bubble.evaluate((element) => {
        const row = element.closest(".timeline-item--user")!;
        const bounds = element.getBoundingClientRect();
        const rowBounds = row.getBoundingClientRect();
        return {
          width: bounds.width,
          rowWidth: rowBounds.width,
          right: bounds.right,
          rowRight: rowBounds.right,
          overflow: element.scrollWidth - element.clientWidth,
        };
      });
      expect(geometry.width).toBeLessThanOrEqual(Math.min(680, geometry.rowWidth * 0.9) + 1);
      expect(geometry.right).toBeLessThanOrEqual(geometry.rowRight + 1);
      expect(geometry.overflow).toBeLessThanOrEqual(1);
      await expect(page.getByTestId("send")).not.toHaveAttribute("aria-label", "Stop run");
    }
    await page.screenshot({ path: testInfo.outputPath("long-messages.png") });
  } finally {
    await harness.close();
  }
});
