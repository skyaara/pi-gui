import { useEffect, useRef, useState } from "react";
import type { WorkspaceRecord } from "../../../contracts/desktop-state";
import { CheckIcon, ChevronDownIcon } from "../../ui/icons";

export function WorkspacePicker({
  workspace,
  workspaces,
  onSelect,
  onSelectStandalone,
}: {
  readonly workspace: WorkspaceRecord;
  readonly workspaces: readonly WorkspaceRecord[];
  readonly onSelect: (id: string) => void;
  readonly onSelectStandalone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const matches = workspaces.filter((entry) =>
    `${entry.name} ${entry.path}`.toLowerCase().includes(query.toLowerCase()),
  );
  const showStandaloneOption =
    !workspaces.some((entry) => entry.isStandalone) && "no project".includes(query.toLowerCase());
  const close = () => {
    setOpen(false);
    setQuery("");
    trigger.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [open]);
  return (
    <div
      className="new-thread__workspace-picker"
      ref={root}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
        event.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        const items = Array.from(
          root.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [],
        );
        const index = items.indexOf(document.activeElement as HTMLButtonElement);
        items[
          index < 0
            ? event.key === "ArrowDown"
              ? 0
              : items.length - 1
            : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length
        ]?.focus();
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="new-thread__workspace"
        title={workspace.path}
        aria-label={`Workspace: ${workspace.name}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          setQuery("");
        }}
      >
        <span>{workspace.name}</span>
        <ChevronDownIcon />
      </button>
      {open ? (
        <div className="workspace-picker__popover">
          <input
            autoFocus
            aria-label="Find workspace"
            placeholder="Find a folder…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div role="listbox" aria-label="Workspaces">
            {showStandaloneOption ? (
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => {
                  onSelectStandalone();
                  close();
                }}
              >
                <span>
                  <strong>No project</strong>
                  <small>A separate folder for each chat</small>
                </span>
              </button>
            ) : null}
            {matches.map((entry) => (
              <button
                type="button"
                role="option"
                aria-selected={entry.id === workspace.id}
                key={entry.id}
                onClick={() => {
                  onSelect(entry.id);
                  close();
                }}
              >
                <span>
                  <strong>{entry.name}</strong>
                  <small>
                    {entry.isStandalone ? "A separate folder for each chat" : entry.path}
                  </small>
                </span>
                {entry.id === workspace.id ? <CheckIcon /> : null}
              </button>
            ))}
            {!matches.length && !showStandaloneOption ? <p>No matching folders</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
