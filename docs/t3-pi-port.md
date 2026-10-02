# T3 Code Pi port

Reference: [pingdotgg/t3code](https://github.com/pingdotgg/t3code/tree/b4d3d51ac99d4306d754afb5c78c49845bfac3c1), inspected October 3, 2026. The upstream MIT license is retained in `third-party/t3-code-LICENSE` and packaged with the desktop app.

The empty-project route uses the new-thread composer directly. Its placement follows `apps/web/src/components/ChatView.tsx`: center the composer lane, place the draft headline above it, and retain the project context strip below. `DraftHeroHeadline.tsx` supplies the project-heading pattern; `index.css` supplies the 46rem comfortable width, composer shadow, and white light-mode composer surface.

The Pi integration was compared against `apps/server/src/provider/Layers/PiProvider.ts` and `piThinkingCapabilities.ts`. Upstream discovers models and state through Pi RPC, preserves provider/model identity, and exposes only model-supported thinking options. Piui obtains these directly through the Pi SDK, including its supported-level and clamp helpers. The RPC process transport and Effect orchestration are not imported into the Electron renderer. Piui retains Pi SDK session authority, extensions, model ordering and saved defaults, plus its existing Fast toggle.

Verification covers initial empty-project startup, selecting another empty project, composer placement, restart, model selection and onboarding, image previews, slash commands, Enter submission, and keyboard project selection. This UI port does not claim a new real-provider conversation proof.

## Native provider discovery

`packages/pi-sdk-driver/src/pi-model-discovery.ts` adapts T3's ephemeral discovery workflow to the embedded Pi SDK. It probes an in-memory AgentSession for the resolved startup model and thinking level, and delegates `enabledModels` patterns to Pi's `resolveModelScopeWithDiagnostics`. This handles wildcards, aliases, effort suffixes, and Pi's scope order without renderer matching rules. Discovery metadata is tagged with its input settings so global and project views consume the matching native result. The saved settings remain unchanged.

New-thread selection now inherits the resolved default when no explicit desktop selection exists. The renderer consumes discovered scope references and exposes only available models; a scope with no matches stays empty. Refresh uses the current models.json and extension catalog. Existing authenticated model switching and Pi session persistence remain authoritative.

Verification of native discovery: `pnpm check` passed; the focused Electron/model-list lane passed 17 checks; packaged launch and thread creation passed. The real-provider recipe in `.artifacts/verify-pi-gui/run-DfBxpn` stopped before any conversation checkpoint because OpenAI OAuth refresh returned `invalid_grant`. Its owned process was closed and the evidence retained.
