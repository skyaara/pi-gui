import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export function repositoryFolderName(source: string): string {
  const remote = source.trim();
  if (!remote || /[\x00-\x1f\x7f]/.test(remote) || remote.startsWith("-")) {
    throw new Error("Enter a valid repository URL.");
  }
  let pathname: string;
  if (path.isAbsolute(remote)) {
    pathname = remote;
  } else if (/^[\w.-]+@[\w.-]+:[^\s]+$/.test(remote)) {
    pathname = remote.slice(remote.indexOf(":") + 1);
  } else {
    let url: URL;
    try {
      url = new URL(remote);
    } catch {
      throw new Error("Use an HTTPS or SSH repository URL.");
    }
    if (!["https:", "http:", "ssh:"].includes(url.protocol) || !url.hostname) {
      throw new Error("Use an HTTPS or SSH repository URL.");
    }
    if (url.password || (url.protocol !== "ssh:" && url.username) || url.search || url.hash) {
      throw new Error("Use a repository URL without embedded credentials, query, or fragment.");
    }
    pathname = url.pathname;
  }
  const name = pathname
    .replace(/[\\/]+$/, "")
    .split(/[\\/]/)
    .pop()
    ?.replace(/\.git$/i, "");
  if (!name || !/^[\w][\w.-]*$/.test(name) || /[. ]$/.test(name)) {
    throw new Error("The repository URL must end with a valid repository name.");
  }
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) {
    throw new Error("This repository name cannot be used as a local folder.");
  }
  return name;
}

export async function cloneRepository(source: string, parentFolder: string): Promise<string> {
  const destination = path.join(parentFolder, repositoryFolderName(source));
  try {
    // Reserve a new destination: never write into an existing folder, even an empty one.
    await mkdir(destination);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error(
        `A folder named "${path.basename(destination)}" already exists there. Choose another location.`,
      );
    }
    throw new Error("Couldn't create the repository folder. Choose a writable location.");
  }
  try {
    await execFileAsync("git", ["clone", "--", source.trim(), destination], {
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_SSH_COMMAND: "ssh -oBatchMode=yes" },
      timeout: 120_000,
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true,
    });
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & { killed?: boolean };
    const reason =
      failure.code === "ENOENT"
        ? "Git isn't installed or couldn't be found."
        : failure.killed
          ? "The clone timed out after two minutes."
          : "Couldn't clone the repository. Check the URL, connection, and your Git credentials.";
    throw new Error(
      `${reason} The incomplete folder was kept at ${destination}. Choose another location to retry.`,
    );
  }
  return destination;
}
