import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const apiBaseUrl = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const originalFetch = globalThis.fetch.bind(globalThis);
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
  <App />
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => undefined));
}
