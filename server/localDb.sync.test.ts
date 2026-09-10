import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db, queue, syncPending } from "../client/src/lib/localDb";

describe("Dexie sync queue integration", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    Object.defineProperty(globalThis.navigator, "onLine", { configurable: true, value: true });
  });

  it("persists SYNCED, FAILED, and CONFLICT states from HTTP outcomes", async () => {
    await queue("CREATE", "payment", { customerId: "customer-1", amount: 50 });
    const operation = await db.syncQueue.toCollection().first();
    expect(operation).toBeDefined();

    globalThis.fetch = vi.fn().mockResolvedValue({ status: 200, ok: true });
    expect(await syncPending()).toBe(1);
    expect((await db.syncQueue.get(operation!.id))?.status).toBe("SYNCED");

    await db.syncQueue.update(operation!.id, { status: "PENDING", retryCount: 0 });
    globalThis.fetch = vi.fn().mockResolvedValue({ status: 503, ok: false });
    expect(await syncPending()).toBe(0);
    expect((await db.syncQueue.get(operation!.id))?.status).toBe("FAILED");

    await db.syncQueue.update(operation!.id, { status: "PENDING", retryCount: 0 });
    globalThis.fetch = vi.fn().mockResolvedValue({ status: 409, ok: false });
    expect(await syncPending()).toBe(0);
    expect((await db.syncQueue.get(operation!.id))?.status).toBe("CONFLICT");
  });

  it("coalesces offline todo create, update and delete operations", async () => {
    const todo = { id: "local-todo-1", title: "مهمة محلية", notes: "", status: "OPEN", priority: "MEDIUM", createdAt: Date.now(), updatedAt: Date.now() };
    await queue("CREATE", "todo", todo);
    await queue("UPDATE", "todo", { ...todo, title: "مهمة معدلة", status: "DONE", updatedAt: Date.now() });
    const merged = await db.syncQueue.where("entity").equals("todo").toArray();
    expect(merged).toHaveLength(1);
    expect(merged[0].type).toBe("CREATE");
    expect((merged[0].payload as any).title).toBe("مهمة معدلة");
    await queue("DELETE", "todo", { id: todo.id });
    expect(await db.syncQueue.where("entity").equals("todo").count()).toBe(0);
  });
});
