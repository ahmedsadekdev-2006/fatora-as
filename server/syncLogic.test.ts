import { describe, expect, it } from "vitest";
import { isSupportedSyncEntity, shouldRejectStaleUpdate } from "./syncLogic";
import { getSyncRetryDelay, syncOutcomeFromStatus } from "../client/src/lib/localDb";

describe("offline sync entity contract", () => {
  it("supports every entity emitted by the local queue", () => {
    expect(isSupportedSyncEntity("payment")).toBe(true);
    expect(isSupportedSyncEntity("stockMovement")).toBe(true);
    expect(isSupportedSyncEntity("todo")).toBe(true);
    expect(isSupportedSyncEntity("unknown")).toBe(false);
  });
});

describe("offline sync retry policy", () => {
  it("uses exponential backoff with a 30 second cap", () => {
    expect(getSyncRetryDelay(0)).toBe(1000);
    expect(getSyncRetryDelay(1)).toBe(2000);
    expect(getSyncRetryDelay(5)).toBe(30000);
    expect(getSyncRetryDelay(9)).toBe(30000);
  });
});

describe("offline sync response handling", () => {
  it("keeps successful, conflict, and retryable outcomes distinct", () => {
    expect(syncOutcomeFromStatus(200)).toBe("SYNCED");
    expect(syncOutcomeFromStatus(409)).toBe("CONFLICT");
    expect(syncOutcomeFromStatus(503)).toBe("FAILED");
  });
});

describe("offline sync conflicts", () => {
  it("rejects a local update when the server record is newer", () => {
    expect(shouldRejectStaleUpdate("2026-08-20T10:00:00Z", "2026-08-20T11:00:00Z")).toBe(true);
  });

  it("allows an update when the local record is newer or timestamps are missing", () => {
    expect(shouldRejectStaleUpdate("2026-08-20T12:00:00Z", "2026-08-20T11:00:00Z")).toBe(false);
    expect(shouldRejectStaleUpdate(undefined, "2026-08-20T11:00:00Z")).toBe(false);
  });
});
