# T3 Code Pi port

Reference: [pingdotgg/t3code](https://github.com/pingdotgg/t3code/tree/b4d3d51ac99d4306d754afb5c78c49845bfac3c1), inspected October 3, 2026. The upstream MIT license is retained in `third-party/t3-code-LICENSE` and packaged with the desktop app.

The empty-project route uses the new-thread composer directly. Its placement follows `apps/web/src/components/ChatView.tsx`: center the composer lane, place the draft headline above it, and retain the project context strip below. `DraftHeroHeadline.tsx` supplies the project-heading pattern; `index.css` supplies the 46rem comfortable width, composer shadow, and white light-mode composer surface.

The Pi integration was compared against `apps/server/src/provider/Layers/PiProvider.ts` and `piThinkingCapabilities.ts`. Upstream discovers models and state through Pi RPC, preserves provider/model identity, and exposes only model-supported thinking options. Piui obtains these directly through the Pi SDK, including its supported-level and clamp helpers. The RPC process transport and Effect orchestration are not imported into the Electron renderer. Piui retains Pi SDK session authority, extensions, model ordering and saved defaults, plus its existing Fast toggle.

Verification covers initial empty-project startup, selecting another empty project, composer placement, restart, model selection and onboarding, image previews, slash commands, Enter submission, and keyboard project selection. This UI port does not claim a new real-provider conversation proof.
