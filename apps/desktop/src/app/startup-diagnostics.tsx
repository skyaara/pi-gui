import type { DesktopAppState } from "../../contracts/desktop-state";

export function StartupDiagnostics({
  diagnostics,
}: {
  diagnostics: DesktopAppState["startupDiagnostics"];
}) {
  if (diagnostics.length === 0) return null;
  return (
    <div className="startup-diagnostics" role="status" data-testid="startup-diagnostics">
      <strong>Some saved workspaces could not be refreshed.</strong>
      <span>
        {diagnostics
          .map((diagnostic) => {
            const workspaceName = diagnostic.workspacePath?.split(/[\\/]/).filter(Boolean).at(-1);
            return workspaceName ? `${workspaceName} is unavailable.` : diagnostic.message;
          })
          .join(" ")}
      </span>
    </div>
  );
}
