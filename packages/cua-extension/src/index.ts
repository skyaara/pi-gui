import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type {
  CuaDriverLike,
  DriverAuthorizationHost,
  DriverAuthorizationRequest,
  ToolResult,
} from "@trycua/cua-driver";
import { Type } from "typebox";

type CuaTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
};

type NativeDriver = CuaDriverLike & { uniffiDestroy(): void };
type DriverFactory = (host: DriverAuthorizationHost) => Promise<NativeDriver>;

const DIRECT_TOOLS = new Set([
  "list_apps",
  "list_windows",
  "get_window_state",
  "get_desktop_state",
  "click",
  "type_text",
  "press_key",
  "hotkey",
  "scroll",
]);

function parseTools(json: string): CuaTool[] {
  const inventory: unknown = JSON.parse(json);
  if (typeof inventory !== "object" || inventory === null || !("tools" in inventory)) {
    throw new Error("Cua Driver returned an invalid tool inventory.");
  }
  const tools = inventory.tools;
  if (!Array.isArray(tools)) {
    throw new Error("Cua Driver returned an invalid tool inventory.");
  }
  return tools.map((tool: unknown) => {
    if (
      typeof tool !== "object" ||
      tool === null ||
      !("name" in tool) ||
      typeof tool.name !== "string" ||
      !/^[a-z][a-z0-9_]*$/.test(tool.name) ||
      !("description" in tool) ||
      typeof tool.description !== "string" ||
      !("inputSchema" in tool) ||
      typeof tool.inputSchema !== "object" ||
      tool.inputSchema === null ||
      Array.isArray(tool.inputSchema)
    ) {
      throw new Error("Cua Driver returned an invalid tool definition.");
    }
    return tool as CuaTool;
  });
}

async function createDriver(host: DriverAuthorizationHost): Promise<NativeDriver> {
  const { CuaDriver, SessionPermissionMode } = await import("@trycua/cua-driver");
  return CuaDriver.createConfiguredWithAuthorizationHost(
    {
      claudeCodeCompatibility: false,
      authorization: {
        allowedModes: [SessionPermissionMode.Standard],
        compatibilityMode: SessionPermissionMode.Standard,
        unrestrictedAcknowledged: false,
        maxSessionTtlSeconds: 28_800n,
        maxIdleTtlSeconds: 1_800n,
      },
    },
    host,
  ) as NativeDriver;
}

function toolContent(result: ToolResult) {
  return [
    {
      type: "text" as const,
      text: result.text || (result.isError ? "Cua action failed." : "Done."),
    },
    ...result.images.map((image) => ({
      type: "image" as const,
      data: image.dataBase64,
      mimeType: image.mimeType,
    })),
  ];
}

/** Register Cua's native tools with Pi without an MCP process. */
export function registerCuaExtension(
  pi: ExtensionAPI,
  driverFactory: DriverFactory = createDriver,
): void {
  let driver: NativeDriver | undefined;
  let approvalContext: ExtensionContext | undefined;
  let serial = Promise.resolve();
  const registered = new Set<string>();

  const host: DriverAuthorizationHost = {
    async authorize(request: DriverAuthorizationRequest) {
      const { DriverAuthorizationAction } = await import("@trycua/cua-driver");
      const context = approvalContext;
      let allowed = false;
      if (context?.hasUI) {
        try {
          allowed = await context.ui.confirm("Allow Cua Driver access?", request.humanSummary);
        } catch {
          allowed = false;
        }
      }
      return {
        action: allowed ? DriverAuthorizationAction.Allow : DriverAuthorizationAction.Deny,
        requestDigest: request.requestDigest,
      };
    },
  };

  async function closeDriver(): Promise<void> {
    const current = driver;
    driver = undefined;
    if (!current) return;
    try {
      await current.shutdown();
    } finally {
      current.uniffiDestroy();
    }
  }

  function runSerial<T>(work: () => Promise<T>): Promise<T> {
    const next = serial.then(work, work);
    serial = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  pi.on("session_start", async () => {
    await runSerial(async () => {
      await closeDriver();
      const next = await driverFactory(host);
      try {
        const tools = parseTools(await next.listToolsJson());
        driver = next;
        for (const tool of tools) {
          const name = `cua_${tool.name}`;
          if (registered.has(name)) continue;
          registered.add(name);
          pi.registerTool({
            name,
            label: `Cua ${tool.name.replaceAll("_", " ")}`,
            description: tool.description,
            parameters: Type.Unsafe<Record<string, unknown>>(tool.inputSchema),
            exposure: DIRECT_TOOLS.has(tool.name) ? "direct" : "codemode",
            namespace: {
              name: "cua",
              description: "Inspect and control the local desktop through Cua Driver.",
            },
            ...(tool.annotations ? { annotations: tool.annotations } : {}),
            async execute(_id, args, signal, _onUpdate, context) {
              return runSerial(async () => {
                const current = driver;
                if (!current) throw new Error("Cua Driver is no longer running.");
                approvalContext = context;
                try {
                  const result = await current.callTool(tool.name, JSON.stringify(args), {
                    signal: signal ?? new AbortController().signal,
                  });
                  return {
                    content: toolContent(result),
                    details: {
                      ...(result.errorCode ? { errorCode: result.errorCode } : {}),
                      degraded: result.degraded,
                    },
                    isError: result.isError,
                  };
                } finally {
                  approvalContext = undefined;
                }
              });
            },
          });
        }
      } catch (error) {
        await next.shutdown();
        next.uniffiDestroy();
        driver = undefined;
        throw error;
      }
    });
  });

  pi.on("session_shutdown", async () => {
    await runSerial(closeDriver);
  });

  pi.registerCommand("cua", {
    description: "Show whether Cua Driver computer tools loaded",
    async handler(_args, context) {
      context.ui.notify(
        driver
          ? `Cua Driver ready: ${registered.size} computer tools`
          : "Cua Driver is unavailable.",
        driver ? "info" : "error",
      );
    },
  });
}

export default registerCuaExtension;
