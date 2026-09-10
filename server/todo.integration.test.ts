import { describe, expect, it } from "vitest";
import { Todo, getMongo } from "./mongodb";

const baseUrl = process.env.TEST_API_BASE_URL;
const runLive = process.env.RUN_LIVE_INTEGRATION === "1" && Boolean(baseUrl);

describe.skipIf(!runLive)("todo CRUD HTTP integration", () => {
  it("creates, updates, completes and deletes a todo", async () => {
    await getMongo();
    let cookie = "";
    let id = "";
    const request = async (path: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      headers.set("Content-Type", "application/json");
      if (cookie) headers.set("Cookie", cookie);
      const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
      const setCookie = response.headers.get("set-cookie");
      if (setCookie) cookie = setCookie.split(";")[0];
      return { response, body: await response.json().catch(() => ({})) };
    };
    try {
      const login = await request("/api/auth/login", { method: "POST", body: JSON.stringify({ username: "admin", password: "Admin123!" }) });
      expect(login.response.status).toBe(200);
      const created = await request("/api/todos", { method: "POST", body: JSON.stringify({ title: `مهمة تكامل ${Date.now()}`, notes: "ملاحظة اختبارية", priority: "HIGH", dueDate: new Date(Date.now() + 86400000).toISOString() }) });
      expect(created.response.status).toBe(201);
      id = String(created.body._id);
      expect(created.body.status).toBe("OPEN");
      expect(created.body.createdByName).toBeTruthy();
      const listed = await request("/api/todos");
      expect(listed.response.status).toBe(200);
      expect(listed.body.some((todo: any) => String(todo._id) === id)).toBe(true);
      const updated = await request(`/api/todos/${id}`, { method: "PUT", body: JSON.stringify({ status: "DONE", notes: "تم التنفيذ" }) });
      expect(updated.response.status).toBe(200);
      expect(updated.body.status).toBe("DONE");
      expect(updated.body.notes).toBe("تم التنفيذ");
      const deleted = await request(`/api/todos/${id}`, { method: "DELETE" });
      expect(deleted.response.status).toBe(200);
      expect(await Todo.findById(id)).toBeNull();
    } finally {
      if (id) await Todo.findByIdAndDelete(id);
    }
  }, 30000);
});
