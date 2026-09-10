import express, { Router } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "../server/_core/oauth";
import { registerStorageProxy } from "../server/_core/storageProxy";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";
import { registerMongoApi } from "../server/mongoApi";

// Vercel entry point for the existing Express backend.
// The local development server remains in server/_core/index.ts unchanged.
const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

registerStorageProxy(app);
registerOAuthRoutes(app);

const apiRouter = Router();
registerMongoApi(apiRouter);
app.use("/api", apiRouter);
app.use(apiRouter);

const processedOperations = new Map<string, { ok: true; processedAt: number }>();
app.post("/api/sync", (req, res) => {
  const key = req.header("Idempotency-Key");
  if (!key) return res.status(400).json({ ok: false, message: "missing_idempotency_key" });

  const existing = processedOperations.get(key);
  if (existing) return res.json(existing);

  const result = { ok: true as const, processedAt: Date.now() };
  processedOperations.set(key, result);
  return res.json(result);
});

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);
app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

// Keep API failures JSON-shaped and visible in Vercel logs instead of returning
// an opaque HTML error page. This is especially useful for async Mongo/API errors.
app.use((error: unknown, _req: any, res: any, _next: any) => {
  console.error("[API] Unhandled request error:", error);
  if (res.headersSent) return;
  const message = error instanceof Error ? error.message : "Internal server error";
  return res.status(500).json({ message: "حدث خطأ داخلي في الخادم", error: message });
});

export default app;
