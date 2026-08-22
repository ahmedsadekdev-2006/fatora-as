import { trpc } from "@/lib/trpc";
import { COOKIE_NAME, UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { startLogin } from "./const";
import "./index.css";

const queryClient = new QueryClient();
const apiBaseUrl = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const originalFetch = globalThis.fetch.bind(globalThis);

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  startLogin();
};

globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const resolveApiUrl = (candidate: string) => {
    if (!apiBaseUrl) return candidate;
    if (!candidate.startsWith("/api")) return candidate;
    return `${apiBaseUrl}${candidate}`;
  };

  if (typeof input === "string") {
    return originalFetch(resolveApiUrl(input), init);
  }

  if (input instanceof URL) {
    const pathname = input.pathname;
    if (apiBaseUrl && pathname.startsWith("/api")) {
      return originalFetch(new URL(`${apiBaseUrl}${pathname}${input.search}`), init);
    }
    return originalFetch(input, init);
  }

  if (input instanceof Request) {
    const url = new URL(input.url);
    if (apiBaseUrl && url.pathname.startsWith("/api")) {
      return originalFetch(new Request(`${apiBaseUrl}${url.pathname}${url.search}`, {
        ...input,
        headers: input.headers,
        method: input.method,
        body: input.body,
      }), init);
    }
    return originalFetch(input, init);
  }

  return originalFetch(input, init);
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      headers() {
        // Preview auto-login fallback: when the browser blocks iframe cookies
        // (Safari ITP / private browsing / WebView), the runtime mirrors the
        // session into sessionStorage so we can forward it as a Bearer token.
        // The regular OAuth cookie flow keeps working and takes priority server-side.
        try {
          const raw = sessionStorage.getItem("manus-cookie");
          if (raw) {
            const prefix = `${COOKIE_NAME}=`;
            const pair = raw.split(";").find(s => s.trim().startsWith(prefix));
            const token = pair?.trim().slice(prefix.length);
            if (token) {
              return { Authorization: `Bearer ${token}` };
            }
          }
        } catch {
          // sessionStorage unavailable
        }
        return {};
      },
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

const analyticsEndpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT;
const analyticsWebsiteId = import.meta.env.VITE_ANALYTICS_WEBSITE_ID;

if (analyticsEndpoint && analyticsWebsiteId) {
  const script = document.createElement("script");
  script.src = `${analyticsEndpoint.replace(/\/$/, "")}/umami`;
  script.defer = true;
  script.setAttribute("data-website-id", analyticsWebsiteId);
  document.head.appendChild(script);
}

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => undefined));
}
