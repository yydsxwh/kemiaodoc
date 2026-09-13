import { describe, expect, it } from "vitest"
import {
  REALTIME_CLOUD_DEBOUNCE_MS,
  isNetworkSaveError,
  planRealtimeSave,
  realtimeSaveLabel,
  snapshotIsNewer,
} from "./realtime-save"

describe("realtime save plan", () => {
  it("always writes local, and debounces cloud while online", () => {
    expect(
      planRealtimeSave({ online: true, cloudEnabled: true, reason: "edit" }),
    ).toEqual({
      writeLocal: true,
      writeCloud: true,
      debounceMs: REALTIME_CLOUD_DEBOUNCE_MS,
    })
  })

  it("keeps local only when offline", () => {
    expect(
      planRealtimeSave({ online: false, cloudEnabled: true, reason: "edit" }),
    ).toEqual({ writeLocal: true, writeCloud: false, debounceMs: 0 })
  })

  it("flushes cloud immediately on hide or reconnect", () => {
    expect(
      planRealtimeSave({ online: true, cloudEnabled: true, reason: "flush" }),
    ).toMatchObject({ writeCloud: true, debounceMs: 0 })
    expect(
      planRealtimeSave({ online: true, cloudEnabled: true, reason: "reconnect" }),
    ).toMatchObject({ writeCloud: true, debounceMs: 0 })
  })

  it("does not hit cloud when the host has no cloud", () => {
    expect(
      planRealtimeSave({ online: true, cloudEnabled: false, reason: "edit" }),
    ).toEqual({ writeLocal: true, writeCloud: false, debounceMs: 0 })
  })
})

describe("network save errors", () => {
  it("treats fetch TypeError as offline", () => {
    expect(isNetworkSaveError(new TypeError("Failed to fetch"))).toBe(true)
    expect(isNetworkSaveError(new TypeError(""))).toBe(true)
    expect(isNetworkSaveError(new Error("文档内容过长"))).toBe(false)
  })
})

describe("snapshot freshness and labels", () => {
  it("prefers the later local snapshot", () => {
    expect(snapshotIsNewer("2026-09-13T12:00:01.000Z", "2026-09-13T12:00:00.000Z")).toBe(true)
    expect(snapshotIsNewer("2026-09-13T12:00:00.000Z", "2026-09-13T12:00:01.000Z")).toBe(false)
    expect(snapshotIsNewer("2026-09-13T12:00:00.000Z", undefined)).toBe(true)
    expect(snapshotIsNewer(undefined, "2026-09-13T12:00:00.000Z")).toBe(false)
  })

  it("tells students the draft is kept", () => {
    expect(
      realtimeSaveLabel({ state: "saved", cloudEnabled: true, online: true }),
    ).toBe("已实时保存到云端")
    expect(
      realtimeSaveLabel({ state: "offline", cloudEnabled: true, online: false }),
    ).toBe("已离线保存在本机，联网后会同步")
    expect(
      realtimeSaveLabel({ state: "idle", cloudEnabled: false, online: true }),
    ).toBe("会自动保存，不用自己点")
  })
})
