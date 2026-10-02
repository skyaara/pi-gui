import { execFile } from "node:child_process";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";
import {
  expectNewThreadWorkspace,
  getDesktopState,
  launchDesktop,
  makeUserDataDir,
  makeGitWorkspace,
  stubNextOpenDialog,
} from "../helpers/electron-app";

const execFileAsync = promisify(execFile);

test("welcome actions replace the sidebar card and support errors, cancellation, and keyboard navigation", async () => {
  const profile = await makeUserDataDir();
  const harness = await launchDesktop(profile, { testMode: "background" });
  try {
    const page = await harness.firstWindow();
    await expect(page.getByRole("heading", { name: "Start a project" })).toBeVisible();
    await expect(page.getByRole("complementary").getByTestId("empty-state")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Open folder", exact: true })).toBeVisible();
    await stubNextOpenDialog(harness, []);
    await page.getByRole("button", { name: "Open folder", exact: true }).click();
    await expect(page.getByRole("button", { name: "Clone repository", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Clone repository", exact: true }).click();
    const input = page.getByRole("textbox", { name: "Repository URL" });
    await expect(input).toBeFocused();
    await expect(page.getByRole("button", { name: "Choose location & clone" })).toBeDisabled();
    await input.fill("not a repository");
    await input.press("Enter");
    await expect(page.getByRole("alert")).toContainText("HTTPS or SSH");
    await input.fill("https://github.com/example/project.git");
    await stubNextOpenDialog(harness, []);
    await input.press("Enter");
    await expect(page.getByRole("button", { name: "Choose location & clone" })).toBeEnabled();
    expect((await getDesktopState(page)).workspaces).toEqual([]);
    await expect(input).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Clone repository", exact: true })).toBeFocused();
    await page.screenshot({ path: test.info().outputPath("welcome.png") });
  } finally {
    await harness.close();
  }
});

test("clones a repository through the welcome form and opens its new workspace", async () => {
  const profile = await makeUserDataDir();
  const source = await makeGitWorkspace("welcome-repository");
  await writeFile(path.join(source, "clone-proof.txt"), "Cloned through piui\n");
  await execFileAsync("git", ["-C", source, "add", "clone-proof.txt"]);
  await execFileAsync("git", [
    "-C",
    source,
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.com",
    "commit",
    "-m",
    "Clone fixture",
  ]);
  const parent = path.join(profile, "projects");
  await mkdir(parent);
  const destination = path.join(await realpath(parent), path.basename(source));
  const harness = await launchDesktop(profile, { testMode: "background" });
  try {
    const page = await harness.firstWindow();
    await page.getByRole("button", { name: "Clone repository", exact: true }).click();
    await page.getByRole("textbox", { name: "Repository URL" }).fill(source);
    await stubNextOpenDialog(harness, [parent]);
    await page.getByRole("button", { name: "Choose location & clone" }).click();
    await expectNewThreadWorkspace(page, destination);
    expect(await readFile(path.join(destination, "clone-proof.txt"), "utf8")).toBe(
      "Cloned through piui\n",
    );
    await expect(page.getByTestId("empty-state")).toHaveCount(0);
    await expect(page.getByTestId("new-thread-composer")).toBeVisible();
  } finally {
    await harness.close();
  }
});
