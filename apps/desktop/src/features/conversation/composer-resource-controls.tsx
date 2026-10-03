interface ComposerResourceControlsProps {
  readonly skillCount: number;
  readonly onOpenSkills: () => void;
  readonly onOpenConnectors: () => void;
}

export function ComposerResourceControls({
  skillCount,
  onOpenSkills,
  onOpenConnectors,
}: ComposerResourceControlsProps) {
  return (
    <>
      <button
        className="composer__feature-control"
        type="button"
        aria-label="Open connectors"
        onClick={onOpenConnectors}
      >
        <span className="composer__connector-mark" aria-hidden="true" />
        Connectors
      </button>
      <button
        className="composer__feature-control"
        type="button"
        aria-label="Open skills"
        onClick={onOpenSkills}
      >
        Skills <span className="composer__resource-count">({skillCount})</span>
      </button>
    </>
  );
}
