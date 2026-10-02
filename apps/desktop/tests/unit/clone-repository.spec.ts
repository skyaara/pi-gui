import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";
import { cloneRepository, repositoryFolderName } from "../../electron/platform/clone-repository";

const execFileAsync = promisify(execFile);

test("clones real Git history and refuses to overwrite an existing destination", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "piui-clone-"));
  const source = path.join(root, "source");
  const parent = path.join(root, "projects");
  await mkdir(source);
  await mkdir(parent);
  await execFileAsync("git", ["init", source]);
  await writeFile(path.join(source, "README.md"), "A real clone\n");
  await execFileAsync("git", ["-C", source, "add", "README.md"]);
  await execFileAsync("git", [
    "-C",
    source,
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.com",
    "commit",
    "-m",
    "Initial",
  ]);
  const destination = await cloneRepository(source, parent);
  expect(await readFile(path.join(destination, "README.md"), "utf8")).toBe("A real clone\n");
  const original = await execFileAsync("git", ["-C", source, "rev-parse", "HEAD"]);
  const cloned = await execFileAsync("git", ["-C", destination, "rev-parse", "HEAD"]);
  expect(cloned.stdout).toBe(original.stdout);
  await expect(cloneRepository(source, parent)).rejects.toThrow("already exists");
  expect(await readFile(path.join(destination, "README.md"), "utf8")).toBe("A real clone\n");
});

test("keeps failed clone folders and reports a recoverable error", async () => {
  const parent = await mkdtemp(path.join(tmpdir(), "piui-clone-failed-"));
  await expect(cloneRepository(path.join(parent, "missing.git"), parent)).rejects.toThrow(
    "incomplete folder was kept",
  );
  expect((await stat(path.join(parent, "missing"))).isDirectory()).toBe(true);
});

test("accepts normal Git URLs and rejects executable transports, options, and embedded secrets", () => {
  expect(repositoryFolderName("https://github.com/owner/project.git")).toBe("project");
  expect(repositoryFolderName("git@github.com:owner/project.git")).toBe("project");
  expect(repositoryFolderName("ssh://git@example.com/owner/project.git")).toBe("project");
  for (const source of [
    "--upload-pack=evil",
    "ext::sh -c evil",
    "https://user:secret@example.com/repo.git",
    "https://example.com/..",
    "https://example.com/repo.git?token=secret",
    "https://example.com/repo\n.git",
  ]) {
    expect(() => repositoryFolderName(source)).toThrow();
  }
});
