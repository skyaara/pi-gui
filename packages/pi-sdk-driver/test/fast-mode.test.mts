import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PiSdkDriver } from "../dist/pi-sdk-driver.js";
import { createAgentSessionRuntimeWithNpmFallback } from "../dist/npm-package-fallback.js";
import { supportsFastMode } from "../dist/fast-mode.js";

for (const providerCase of [
  { provider: "openai", modelId: "gpt-5" },
  { provider: "anthropic", modelId: "claude-opus-5-5" },
]) {
  await test(`Fast mode reaches the ${providerCase.provider} request and survives reopen without changing effort`, async () => {
    const requests: Record<string, unknown>[] = [];
    const betaHeaders: (string | undefined)[] = [];
    const server = createServer((request, response) => {
      let body = "";
      request.setEncoding("utf8");
      request.on("data", (chunk: string) => {
        body += chunk;
      });
      request.on("end", () => {
        requests.push(JSON.parse(body) as Record<string, unknown>);
        betaHeaders.push(request.headers["anthropic-beta"] as string | undefined);
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
      JSON.stringify({ [providerCase.provider]: { type: "api_key", key: "local-test-key" } }),
    );
    await writeFile(
      join(agentDir, "settings.json"),
      JSON.stringify({ packages: [], retry: { enabled: false } }),
    );
    await writeFile(
      join(agentDir, "models.json"),
      JSON.stringify({
        providers: {
          [providerCase.provider]: {
            baseUrl,
            headers: { "anthropic-beta": "local-probe-existing" },
          },
        },
      }),
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
      initialModel: providerCase,
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
      if (providerCase.provider === "anthropic") {
        assert.equal(requests.at(-1)?.speed, "fast");
        assert.ok(betaHeaders.at(-1)?.split(",").includes("fast-mode-2026-02-01"));
        assert.ok(betaHeaders.at(-1)?.split(",").includes("local-probe-existing"));
      } else {
        assert.equal(requests.at(-1)?.service_tier, "priority");
      }
      await driver.setSessionFastMode(snapshot.ref, false);
      await driver.sendUserMessage(snapshot.ref, { text: "Second local request" });
      assert.equal(requests.length, 2);
      assert.equal(requests.at(-1)?.service_tier, undefined);
      assert.equal(requests.at(-1)?.speed, undefined);
      assert.ok(!betaHeaders.at(-1)?.includes("fast-mode-2026-02-01"));
      await driver.closeSession(snapshot.ref);
      assert.equal((await driver.openSession(snapshot.ref)).config?.fastMode, false);
    } finally {
      await driver.closeSession(snapshot.ref);
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
}

await test("Fast mode follows model and provider support rather than request API alone", () => {
  for (const id of ["gpt-5", "gpt-6.1-sol", "gpt-4o-2024-05-13"])
    assert.equal(supportsFastMode({ provider: "openai", api: "openai-responses", id }), true);
  for (const id of ["gpt-4", "gpt-5-pro", "gpt-5-nano", "gpt-99"])
    assert.equal(supportsFastMode({ provider: "openai", api: "openai-responses", id }), false);
  assert.equal(
    supportsFastMode({
      provider: "openai-codex",
      api: "openai-codex-responses",
      id: "gpt-6.1-sol",
    }),
    true,
  );
  assert.equal(
    supportsFastMode({
      provider: "openai-codex",
      api: "openai-codex-responses",
      id: "gpt-5.3-codex-spark",
    }),
    false,
  );
  for (const id of ["claude-opus-5-5", "claude-opus-5", "claude-opus-4-8"])
    assert.equal(supportsFastMode({ provider: "anthropic", api: "anthropic-messages", id }), true);
  for (const provider of ["google-vertex", "amazon-bedrock", "custom"])
    assert.equal(
      supportsFastMode({ provider, api: "anthropic-messages", id: "claude-opus-5-5" }),
      false,
    );
  for (const id of ["claude-opus-4-6", "claude-opus-4-7", "claude-sonnet-5-5"])
    assert.equal(supportsFastMode({ provider: "anthropic", api: "anthropic-messages", id }), false);
  assert.equal(supportsFastMode(undefined), false);
});
