import { useState } from "react";
import type { OrchestrationChildThread } from "../../../contracts/desktop-state";
import { ChevronDownIcon, ChevronRightIcon } from "../../ui/icons";

export function SubagentPanel({
  children,
  onOpenThread,
  onFollowUp,
}: {
  readonly children: readonly OrchestrationChildThread[];
  readonly onOpenThread: (child: OrchestrationChildThread) => void;
  readonly onFollowUp: (childId: string, text: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  if (children.length === 0) return null;
  const done = children.filter((child) => child.status === "complete").length;
  const running = children.filter((child) => child.status === "running").length;
  const send = async (child: OrchestrationChildThread) => {
    const text = drafts[child.id]?.trim();
    if (!text || pendingId) return;
    setPendingId(child.id);
    setError("");
    try {
      await onFollowUp(child.id, text);
      setDrafts((current) => ({ ...current, [child.id]: "" }));
    } finally {
      setPendingId(null);
    }
  };

  return (
    <section className="subagent-panel" aria-label="Pi subagents">
      <button
        className="subagent-panel__summary"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span
          className={`subagent-panel__pulse${running ? " subagent-panel__pulse--running" : ""}`}
          aria-hidden="true"
        />
        <span>
          {running
            ? `${running} Pi subagent${running === 1 ? "" : "s"} running`
            : `${children.length} Pi subagent${children.length === 1 ? "" : "s"}`}
        </span>
        <span className="subagent-panel__count">
          {done}/{children.length} complete
        </span>
        {open ? <ChevronDownIcon /> : <ChevronRightIcon />}
      </button>
      {open ? (
        <div className="subagent-panel__list">
          {children.map((child) => {
            const expanded = expandedId === child.id;
            return (
              <div className="subagent-panel__item" key={child.id}>
                <button
                  className="subagent-panel__item-heading"
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setExpandedId(expanded ? null : child.id)}
                >
                  <span
                    className={`subagent-panel__state subagent-panel__state--${child.status}`}
                    aria-hidden="true"
                  />
                  <span className="subagent-panel__title">{child.title}</span>
                  <span className="subagent-panel__status">{child.status}</span>
                  {expanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
                </button>
                {expanded ? (
                  <div className="subagent-panel__details">
                    <p>{child.latestTranscript || child.goal}</p>
                    <div className="subagent-panel__controls">
                      <button type="button" onClick={() => onOpenThread(child)}>
                        Open thread
                      </button>
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          send(child).catch((cause: unknown) => {
                            setError(
                              cause instanceof Error ? cause.message : "Could not send follow-up.",
                            );
                          });
                        }}
                      >
                        <input
                          aria-label={`Follow up with ${child.title}`}
                          value={drafts[child.id] ?? ""}
                          onChange={(event) =>
                            setDrafts((current) => ({ ...current, [child.id]: event.target.value }))
                          }
                          placeholder="Follow up with this subagent"
                        />
                        <button
                          type="submit"
                          disabled={!drafts[child.id]?.trim() || pendingId !== null}
                        >
                          Send
                        </button>
                      </form>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
          {error ? (
            <p className="subagent-panel__error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
