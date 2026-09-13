import assert from "node:assert/strict";
import {
  DOCS_CLOUD_DEBOUNCE_MS,
  docsRealtimeSaveLabel,
  isDocsNetworkSaveError,
  isDocsSnapshotNewer,
  planDocsRealtimeSave,
} from "./docs-realtime";

{
  assert.deepEqual(
    planDocsRealtimeSave({ online: true, cloudEnabled: true, reason: "edit" }),
    { writeLocal: true, writeCloud: true, debounceMs: DOCS_CLOUD_DEBOUNCE_MS },
  );
  assert.deepEqual(
    planDocsRealtimeSave({ online: false, cloudEnabled: true, reason: "edit" }),
    { writeLocal: true, writeCloud: false, debounceMs: 0 },
  );
  assert.equal(
    planDocsRealtimeSave({ online: true, cloudEnabled: true, reason: "flush" }).debounceMs,
    0,
  );
}

{
  assert.equal(isDocsNetworkSaveError(new TypeError("Failed to fetch")), true);
  assert.equal(isDocsNetworkSaveError(new Error("最多保存 80 篇文档")), false);
}

{
  assert.equal(
    isDocsSnapshotNewer("2026-09-13T12:00:01.000Z", "2026-09-13T12:00:00.000Z"),
    true,
  );
  assert.equal(
    docsRealtimeSaveLabel({ state: "offline", cloudEnabled: true, online: false }),
    "已离线保存在本机，联网后会同步",
  );
}

console.log("docs-realtime tests ok");
