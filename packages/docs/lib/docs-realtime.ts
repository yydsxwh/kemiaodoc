/** 打字后多久同步云端。本机快照会立刻写，不走这个延迟。 */
export const DOCS_CLOUD_DEBOUNCE_MS = 600;

export type DocsSaveReason = "edit" | "flush" | "reconnect";

export type DocsRealtimePlan = {
  writeLocal: true;
  writeCloud: boolean;
  debounceMs: number;
};

export function isDocsBrowserOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

export function planDocsRealtimeSave(input: {
  online: boolean;
  cloudEnabled: boolean;
  reason: DocsSaveReason;
}): DocsRealtimePlan {
  const writeCloud = Boolean(input.cloudEnabled && input.online);
  const debounceMs = input.reason === "edit" && writeCloud ? DOCS_CLOUD_DEBOUNCE_MS : 0;
  return { writeLocal: true, writeCloud, debounceMs };
}

export function isDocsNetworkSaveError(error: unknown): boolean {
  if (error instanceof TypeError) {
    const message = error.message || "";
    return !message || /fetch|network|load|internet|offline/i.test(message);
  }
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /failed to fetch|networkerror|network request failed|offline|err_internet|err_name_not_resolved|load failed/i.test(
    message,
  );
}

export function isDocsSnapshotNewer(
  localUpdatedAt: string | undefined,
  remoteUpdatedAt: string | undefined,
): boolean {
  const local = Date.parse(localUpdatedAt || "");
  const remote = Date.parse(remoteUpdatedAt || "");
  if (Number.isNaN(local)) return false;
  if (Number.isNaN(remote)) return true;
  return local > remote;
}

export type DocsRealtimeSaveState = "idle" | "dirty" | "saving" | "saved" | "offline" | "error";

export function docsRealtimeSaveLabel(input: {
  state: DocsRealtimeSaveState;
  cloudEnabled: boolean;
  online: boolean;
}): string {
  switch (input.state) {
    case "saving":
      return input.cloudEnabled && input.online ? "正在保存到云端…" : "正在保存到本机…";
    case "saved":
      return input.cloudEnabled && input.online ? "已实时保存到云端" : "已实时保存在本机";
    case "offline":
      return "已离线保存在本机，联网后会同步";
    case "dirty":
      return "正在自动保存…";
    case "error":
      return "云端保存失败，稿还在本机";
    default:
      return "会自动保存，不用自己点";
  }
}
