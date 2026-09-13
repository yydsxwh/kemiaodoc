import { describe, expect, it } from "vitest"
import { createEmptyDocument } from "./document"
import {
  adoptLiveSnapshot,
  createMemorySnapshotStore,
  liveSnapshotKey,
  markLiveSnapshotSynced,
  readLiveSnapshot,
  writeLiveSnapshot,
} from "./live-snapshot"

describe("live snapshot", () => {
  it("writes and reads a crash-safe copy", () => {
    const store = createMemorySnapshotStore()
    const doc = createEmptyDocument("hw-1")
    doc.title = "高等数学作业"
    const result = writeLiveSnapshot({ ...doc, pendingCloud: true }, store)
    expect(result).toEqual({ ok: true, degraded: false })
    expect(store.getItem(liveSnapshotKey("hw-1"))).toContain("高等数学作业")
    const loaded = readLiveSnapshot("hw-1", store)
    expect(loaded?.title).toBe("高等数学作业")
    expect(loaded?.pendingCloud).toBe(true)
    markLiveSnapshotSynced("hw-1", store)
    expect(readLiveSnapshot("hw-1", store)?.pendingCloud).toBe(false)
    adoptLiveSnapshot("hw-1", "cloud-1", store)
    expect(readLiveSnapshot("hw-1", store)).toBeNull()
    expect(readLiveSnapshot("cloud-1", store)?.title).toBe("高等数学作业")
  })

  it("returns null for missing or broken data", () => {
    const store = createMemorySnapshotStore({ [liveSnapshotKey("bad")]: "{not-json" })
    expect(readLiveSnapshot("missing", store)).toBeNull()
    expect(readLiveSnapshot("bad", store)).toBeNull()
  })
})
