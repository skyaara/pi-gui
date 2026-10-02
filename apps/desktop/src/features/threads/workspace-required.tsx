import { useState } from "react";

export function WorkspaceRequired({
  description,
  onOpenWorkspace,
}: {
  readonly description: string;
  readonly onOpenWorkspace: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <div className="workspace-required resource-empty">
      <div className="resource-empty__title">Choose a project folder</div>
      <p className="resource-empty__body">{description}</p>
      <button
        className="button button--primary"
        type="button"
        disabled={pending}
        onClick={() => {
          setPending(true);
          setError(undefined);
          void onOpenWorkspace()
            .finally(() => setPending(false))
            .catch(() => setError("Couldn't open the folder. Please try again."));
        }}
      >
        {pending ? "Opening…" : "Open folder"}
      </button>
      {error ? (
        <p className="resource-empty__body" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
