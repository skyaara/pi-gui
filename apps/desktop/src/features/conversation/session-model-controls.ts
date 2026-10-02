import type { Dispatch, SetStateAction } from "react";
import type { SessionRef } from "@pi-gui/session-driver";
import type { RuntimeSettingsSnapshot } from "@pi-gui/session-driver/runtime-types";
import type { PiDesktopApi } from "../../../contracts/ipc";
import type { DesktopAppState } from "../../../contracts/desktop-state";
import { updateSnapshot } from "../../app/desktop-app-state";

export function createSessionModelControls(
  api: PiDesktopApi,
  sessionRef: SessionRef | undefined,
  setSnapshot: Dispatch<SetStateAction<DesktopAppState | null>>,
) {
  const apply = (action: (ref: SessionRef) => Promise<DesktopAppState>) => {
    if (!sessionRef) return;
    void updateSnapshot(setSnapshot, () => action(sessionRef)).catch((error: unknown) => {
      console.error("[renderer] model controls update failed", error);
    });
  };
  return {
    setModel: (provider: string, modelId: string) =>
      apply((ref) => api.setSessionModel(ref.workspaceId, ref.sessionId, provider, modelId)),
    setThinking: (level: string) =>
      apply((ref) =>
        api.setSessionThinkingLevel(
          ref.workspaceId,
          ref.sessionId,
          level as NonNullable<RuntimeSettingsSnapshot["defaultThinkingLevel"]>,
        ),
      ),
    setFastMode: (enabled: boolean) =>
      apply((ref) => api.setSessionFastMode(ref.workspaceId, ref.sessionId, enabled)),
  };
}
