import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import {
  createNamedThread,
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
  seedAgentDir,
} from "../helpers/electron-app";

// The native SDK needs a platform desktop session. This proves the published
// extension shape loads inside macOS Electron, without a provider or OS grants.
test("the Cua package loads its native SDK and tools in an Electron thread", async () => {
  test.skip(process.platform !== "darwin", "macOS desktop integration proof");
  test.setTimeout(90_000);
  const userDataDir = await makeUserDataDir();
  const agentDir = join(userDataDir, "agent");
  const workspace = await makeWorkspace("cua-extension");
  await seedAgentDir(agentDir);
  await writeFile(
    join(agentDir, "settings.json"),
    JSON.stringify({
      packages: [],
      extensions: [resolve(__dirname, "../../../../packages/cua-extension")],
      cacheWarming: "off",
    }),
  );

  const harness = await launchDesktop(userDataDir, {
    agentDir,
    initialWorkspaces: [workspace],
    scrubProviderEnv: true,
    testMode: "background",
  });
  try {
    const window = await harness.firstWindow();
    await createNamedThread(window, "Cua tools");
    const composer = window.getByTestId("composer");
    await composer.fill("/cua ");
    await composer.press("Enter");
    await expect(window.getByTestId("extension-notice")).toContainText(
      /Cua Driver ready: \d+ computer tools/,
    );
    const screenshot = test.info().outputPath("cua-extension-loaded.png");
    await window.screenshot({ path: screenshot });
    await test.info().attach("Cua extension loaded in Electron", {
      path: screenshot,
      contentType: "image/png",
    });
  } finally {
    await harness.close();
  }
});
