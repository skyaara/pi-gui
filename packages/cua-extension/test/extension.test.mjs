import assert from "node:assert/strict";
import { test } from "node:test";
import registerCuaExtension from "../dist/index.js";

const inventory = JSON.stringify({
  tools: [
    {
      name: "get_window_state",
      description: "Observe a window",
      inputSchema: {
        type: "object",
        properties: { pid: { type: "integer" }, window_id: { type: "integer" } },
        required: ["pid", "window_id"],
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: "browser_prepare",
      description: "Prepare a browser profile",
      inputSchema: { type: "object", properties: { profile: { type: "string" } } },
    },
  ],
});

function setup(
  onCall = async () => ({ text: "Done", images: [], isError: false, degraded: false }),
) {
  const handlers = new Map();
  const registered = new Map();
  const commands = new Map();
  const calls = [];
  let authorizationHost;
  let shutdownCount = 0;
  let destroyCount = 0;
  const driver = {
    async listToolsJson() {
      return inventory;
    },
    async callTool(name, args, options) {
      calls.push({ name, args: JSON.parse(args), options });
      return onCall(name, args, options, authorizationHost);
    },
    async shutdown() {
      shutdownCount++;
    },
    uniffiDestroy() {
      destroyCount++;
    },
  };
  registerCuaExtension(
    {
      on(name, handler) {
        handlers.set(name, handler);
      },
      registerTool(tool) {
        registered.set(tool.name, tool);
      },
      registerCommand(name, command) {
        commands.set(name, command);
      },
    },
    async (host) => {
      authorizationHost = host;
      return driver;
    },
  );
  return {
    handlers,
    registered,
    commands,
    calls,
    counts: () => ({ shutdownCount, destroyCount }),
  };
}

test("registers native schemas and returns images to Pi", async () => {
  const app = setup(async () => ({
    text: "Window state",
    images: [{ mimeType: "image/png", dataBase64: "aGVsbG8=" }],
    isError: false,
    degraded: false,
  }));
  assert.equal(app.registered.size, 0);
  await app.handlers.get("session_start")();
  const observe = app.registered.get("cua_get_window_state");
  assert.equal(observe.exposure, "direct");
  assert.deepEqual(observe.parameters.required, ["pid", "window_id"]);
  assert.equal(observe.annotations.readOnlyHint, true);
  assert.equal(app.registered.get("cua_browser_prepare").exposure, "codemode");
  const notices = [];
  app.commands.get("cua").handler("", {
    ui: { notify: (message) => notices.push(message) },
  });
  assert.deepEqual(notices, ["Cua Driver ready: 2 computer tools"]);

  const result = await observe.execute(
    "call-1",
    { pid: 41, window_id: 7 },
    undefined,
    undefined,
    {},
  );
  assert.equal(app.calls[0].name, "get_window_state");
  assert.deepEqual(app.calls[0].args, { pid: 41, window_id: 7 });
  assert.deepEqual(result.content, [
    { type: "text", text: "Window state" },
    { type: "image", data: "aGVsbG8=", mimeType: "image/png" },
  ]);
  await app.handlers.get("session_shutdown")();
  assert.deepEqual(app.counts(), { shutdownCount: 1, destroyCount: 1 });
});

test("asks the host only for a Cua authorization request and preserves refusal", async () => {
  let prompts = 0;
  const app = setup(async (_name, _args, _options, host) => {
    const decision = await host.authorize({
      humanSummary: "Attach to your signed-in browser profile",
      requestDigest: "digest-123",
    });
    return {
      text: decision.action === 0 ? "Allowed" : "Refused",
      images: [],
      isError: decision.action !== 0,
      errorCode: decision.action !== 0 ? "authorization_required" : undefined,
      degraded: false,
    };
  });
  await app.handlers.get("session_start")();
  const prepare = app.registered.get("cua_browser_prepare");
  const accepted = await prepare.execute("call-2", {}, undefined, undefined, {
    hasUI: true,
    ui: {
      async confirm(_title, summary) {
        prompts++;
        assert.equal(summary, "Attach to your signed-in browser profile");
        return true;
      },
    },
  });
  assert.equal(accepted.isError, false);
  assert.equal(prompts, 1);

  const refused = await prepare.execute("call-3", {}, undefined, undefined, { hasUI: false });
  assert.equal(refused.isError, true);
  assert.equal(refused.details.errorCode, "authorization_required");
  assert.equal(prompts, 1);
  await app.handlers.get("session_shutdown")();
});

test("a failed inventory closes the native runtime", async () => {
  const handlers = new Map();
  let shutdown = false;
  let destroyed = false;
  registerCuaExtension(
    {
      on(name, handler) {
        handlers.set(name, handler);
      },
      registerTool() {
        assert.fail("invalid inventory must not register a tool");
      },
      registerCommand() {},
    },
    async () => ({
      async listToolsJson() {
        return '{"tools":[{"name":"bad tool"}]}';
      },
      async shutdown() {
        shutdown = true;
      },
      uniffiDestroy() {
        destroyed = true;
      },
    }),
  );
  await assert.rejects(handlers.get("session_start")(), /invalid tool definition/);
  assert.equal(shutdown, true);
  assert.equal(destroyed, true);
});
