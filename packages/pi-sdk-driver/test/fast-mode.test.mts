import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PiSdkDriver } from "../dist/pi-sdk-driver.js";
import { createAgentSessionRuntimeWithNpmFallback } from "../dist/npm-package-fallback.js";
import { supportsFastMode } from "../dist/fast-mode.js";

await test("Fast mode reaches the OpenAI request and survives reopen without changing effort", async () => {
  const requests: Record<string, unknown>[] = [];
  const server = createServer((request, response) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => {
      body += chunk;
    });
    request.on("end", () => {
      requests.push(JSON.parse(body) as Record<string, unknown>);
      // Stop after capturing the real SDK request; no remote provider is contacted.
      response.writeHead(400, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: { message: "Local request probe complete" } }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}/v1`;
  const root = await mkdtemp(join(tmpdir(), "piui-fast-"));
  const agentDir = join(root, "agent");
  const workspacePath = join(root, "workspace");
  await mkdir(agentDir);
  await mkdir(workspacePath);
  await writeFile(
    join(agentDir, "auth.json"),
    JSON.stringify({ openai: { type: "api_key", key: "local-test-key" } }),
  );
  await writeFile(
    join(agentDir, "settings.json"),
    JSON.stringify({ packages: [], retry: { enabled: false } }),
  );
  await writeFile(
    join(agentDir, "models.json"),
    JSON.stringify({ providers: { openai: { baseUrl } } }),
  );
  const driver = new PiSdkDriver({
    agentDir,
    catalogFilePath: join(root, "catalog.json"),
    createAgentSessionRuntimeImpl: async (options) => {
      const runtime = await createAgentSessionRuntimeWithNpmFallback(options);
      assert.equal(
        runtime.session.model?.baseUrl,
        baseUrl,
        "test must only contact its local server",
      );
      return runtime;
    },
  });
  const { workspace } = await driver.syncWorkspace(workspacePath);
  const snapshot = await driver.createSession(workspace, {
    initialModel: { provider: "openai", modelId: "gpt-5" },
    initialThinkingLevel: "high",
    initialFastMode: true,
  });
  try {
    assert.equal(snapshot.config?.fastMode, true);
    await driver.closeSession(snapshot.ref);
    const reopened = await driver.openSession(snapshot.ref);
    assert.equal(reopened.config?.fastMode, true);
    assert.equal(reopened.config?.thinkingLevel, "high");
    await driver.sendUserMessage(snapshot.ref, { text: "First local request" });
    assert.equal(requests.at(-1)?.service_tier, "priority");
    await driver.setSessionFastMode(snapshot.ref, false);
    await driver.sendUserMessage(snapshot.ref, { text: "Second local request" });
    assert.equal(requests.length, 2);
    assert.equal(requests.at(-1)?.service_tier, undefined);
    await driver.closeSession(snapshot.ref);
    assert.equal((await driver.openSession(snapshot.ref)).config?.fastMode, false);
  } finally {
    await driver.closeSession(snapshot.ref);
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

await test("Fast mode is limited to supported OpenAI request APIs", () => {
  assert.equal(supportsFastMode({ provider: "openai", api: "openai-responses" }), true);
  assert.equal(supportsFastMode({ provider: "openai-codex", api: "openai-codex-responses" }), true);
  assert.equal(supportsFastMode({ provider: "anthropic", api: "anthropic-messages" }), false);
  assert.equal(supportsFastMode({ provider: "custom", api: "openai-responses" }), false);
});
