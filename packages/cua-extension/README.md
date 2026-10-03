# Pi Cua Driver extension

Native computer-use tools for [Pi](https://github.com/earendil-works/pi), backed by the
MIT-licensed [Cua Driver TypeScript SDK](https://cua.ai/docs/cua-driver/guides/use-the-sdk).
The extension calls Cua in the Pi process: no MCP server or Cua daemon is required.
Pi's selected model decides which tools to call; Cua does not run a model.

## Install

Install this package in the same Node environment as Pi, then add the package to
Pi's `extensions` setting or install it as a Pi package. From this repository, run
`pnpm --filter @pi-gui/cua-extension build` and add the absolute path to
`packages/cua-extension` to the `extensions` array in `~/.pi/agent/settings.json`.
In PiUI, use **Extensions → Refresh** after changing the setting.

The package has no PiUI dependency. Its `pi.extensions` manifest points to the
compiled entry point, so it can also be installed in terminal Pi. It has not
been published to npm.

## Tools

The extension loads Cua's tool inventory at session start and registers each
tool under a `cua_` name. `cua_list_apps`, `cua_list_windows`,
`cua_get_window_state`, `cua_get_desktop_state`, `cua_click`, `cua_type_text`,
`cua_press_key`, `cua_hotkey`, and `cua_scroll` are offered directly to the
model. The rest are available through Pi's code mode under the `cua` namespace.
The names, argument schemas, descriptions, and read-only/destructive hints come
from the installed Cua SDK version.
Run `/cua` to check that the tools loaded in the current Pi thread.

Screenshots are returned as Pi image blocks, along with Cua's text and structured
results. The structured result carries window IDs and element tokens needed for
follow-up actions.
Choose a vision-capable model when screenshot interpretation is needed. Cua's
tool refusals remain failed Pi tool results, including their error codes.

The SDK runs in Cua's **standard** permission mode: routine actions can reach
apps across the desktop. When Cua requests a separate host decision, such as
attaching to an existing signed-in browser profile, the extension presents
Cua's summary through Pi's UI confirmation. Non-interactive sessions deny
those requests. The extension never shows the model Cua's attested resource
identity or authorization digest.

On macOS, the process loading the SDK needs Accessibility and Screen Recording
permission. In terminal Pi this is the terminal/Pi host; in PiUI this is the
desktop app. A grant change may require restarting that app. For packaged
Electron builds, the native SDK library must be available outside the ASAR
archive. Windows and Linux need an interactive desktop session.

## Development

```sh
pnpm --filter @pi-gui/cua-extension typecheck
pnpm --filter @pi-gui/cua-extension test
```

Native desktop verification requires an installed app or PiUI session with OS
permissions. The automated package tests use a fake driver to verify tool
registration, screenshot forwarding, authorization, and cleanup.
