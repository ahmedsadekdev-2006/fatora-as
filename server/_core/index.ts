import "dotenv/config";
import express, { Router } from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { registerMongoApi } from "../mongoApi";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

function configureCors(app: express.Express) {
  const configuredOrigins = new Set(
    [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      process.env.FRONTEND_URL,
      process.env.VITE_FRONTEND_URL,
      process.env.ALLOWED_ORIGINS,
    ]
      .flatMap(value => {
        if (!value) return [];
        return value
          .split(",")
          .map(part => part.trim())
          .filter(Boolean);
      })
      .map(origin => {
        try {
          return new URL(origin).origin;
        } catch {
          return origin;
        }
      })
  );

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const originToAllow = origin && configuredOrigins.has(origin) ? origin : undefined;

    if (originToAllow) {
      res.setHeader("Access-Control-Allow-Origin", originToAllow);
    }

    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, Idempotency-Key, X-Requested-With"
    );

    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }

    next();
  });
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  configureCors(app);
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  const apiRouter = Router();
  registerMongoApi(apiRouter);
  app.use("/api", apiRouter);
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
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = Number.parseInt(process.env.PORT || "3000", 10);
  const port = await findAvailablePort(preferredPort);
  const host = process.env.HOST || "0.0.0.0";

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, host, () => {
    console.log(`Server running on http://${host}:${port}/`);
  });
}

startServer().catch(console.error);
