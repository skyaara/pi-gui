import { useLayoutEffect, useRef, useState } from "react";
import type { DesktopAppState } from "../../../contracts/desktop-state";
import type { PiDesktopApi } from "../../../contracts/ipc";
import { ChevronRightIcon, FolderIcon, ForkIcon, PiLogoMark } from "../../ui/icons";

export function WorkspaceWelcome({
  api,
  onState,
  errorMessage,
}: {
  readonly api: PiDesktopApi;
  readonly onState: (state: DesktopAppState) => void;
  readonly errorMessage?: string;
}) {
  const [cloning, setCloning] = useState(false);
  const [repository, setRepository] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const cloneButton = useRef<HTMLButtonElement>(null);
  const openButton = useRef<HTMLButtonElement>(null);
  const repositoryInput = useRef<HTMLInputElement>(null);
  const restoreFocus = useRef<"open" | "clone" | "repository" | null>(null);

  useLayoutEffect(() => {
    if (busy || !restoreFocus.current) return;
    const target =
      restoreFocus.current === "repository"
        ? repositoryInput.current
        : restoreFocus.current === "clone"
          ? cloneButton.current
          : openButton.current;
    target?.focus();
    restoreFocus.current = null;
  }, [busy, cloning]);

  const run = (action: () => Promise<DesktopAppState>) => {
    restoreFocus.current = cloning ? "repository" : "open";
    setBusy(true);
    setError(undefined);
    void action()
      .then(onState)
      .finally(() => {
        setBusy(false);
      })
      .catch((failure: unknown) => {
        const message =
          failure instanceof Error ? failure.message : "Something went wrong. Please try again.";
        setError(message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, ""));
      });
  };

  const goBack = () => {
    restoreFocus.current = "clone";
    setCloning(false);
    setError(undefined);
  };

  return (
    <section className="canvas canvas--welcome" aria-label="Get started">
      <div className="workspace-welcome" data-testid="empty-state">
        <div className="workspace-welcome__intro">
          <div className="workspace-welcome__logo">
            <PiLogoMark />
          </div>
          <h1>Start a thread</h1>
          <p>Chat with pi, open a folder, or bring in a repository.</p>
        </div>
        {cloning ? (
          <form
            className="workspace-welcome__clone"
            aria-label="Clone repository"
            aria-busy={busy}
            onSubmit={(event) => {
              event.preventDefault();
              if (!busy && repository.trim()) run(() => api.cloneWorkspace(repository.trim()));
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape" && !busy) {
                event.preventDefault();
                goBack();
              }
            }}
          >
            <label htmlFor="clone-repository-url">Repository URL</label>
            <input
              ref={repositoryInput}
              id="clone-repository-url"
              autoFocus
              required
              value={repository}
              disabled={busy}
              placeholder="https://github.com/you/project.git"
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => {
                setRepository(event.target.value);
                setError(undefined);
              }}
              aria-describedby="clone-repository-hint"
            />
            <p id="clone-repository-hint">
              Use HTTPS or SSH. Choose where to save the new folder next.
            </p>
            <div className="workspace-welcome__form-actions">
              <button
                className="button button--ghost"
                type="button"
                disabled={busy}
                onClick={goBack}
              >
                Back
              </button>
              <button
                className="button button--primary"
                type="submit"
                disabled={busy || !repository.trim()}
              >
                {busy ? "Cloning repository…" : "Choose location & clone"}
              </button>
            </div>
          </form>
        ) : (
          <div className="workspace-welcome__actions" aria-busy={busy}>
            <button
              ref={openButton}
              className="workspace-welcome__action"
              type="button"
              disabled={busy}
              aria-label="Open folder"
              onClick={() => run(() => api.pickWorkspace())}
            >
              <span className="workspace-welcome__icon">
                <FolderIcon />
              </span>
              <span className="workspace-welcome__copy">
                <strong>Open folder</strong>
                <span>Continue with a project on your computer</span>
              </span>
              <ChevronRightIcon />
            </button>
            <button
              aria-label="Clone repository"
              ref={cloneButton}
              className="workspace-welcome__action"
              type="button"
              disabled={busy}
              onClick={() => {
                setCloning(true);
                setError(undefined);
              }}
            >
              <span className="workspace-welcome__icon">
                <ForkIcon />
              </span>
              <span className="workspace-welcome__copy">
                <strong>Clone repository</strong>
                <span>Bring a project from GitHub or another Git host</span>
              </span>
              <ChevronRightIcon />
            </button>
          </div>
        )}
        {error || errorMessage ? (
          <p className="workspace-welcome__error" role="alert">
            {error || errorMessage}
          </p>
        ) : null}
        {!cloning ? (
          <button
            type="button"
            className="button button--ghost"
            disabled={busy}
            onClick={() => run(() => api.prepareStandaloneWorkspace())}
          >
            Chat without a project
          </button>
        ) : null}
        <p className="workspace-welcome__footer">You can add more projects anytime.</p>
      </div>
    </section>
  );
}
