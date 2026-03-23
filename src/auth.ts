import { ServerResponse } from "node:http";
import { Middleware, MidRequest } from "./middleware.js";

const apiKeys = new Set<string>(["test-key-123"]);

export function validateApiKey(req: MidRequest): string | undefined {
  return req.headers["x-api-key"] as string | undefined;
}

export function addApiKey(key: string): void {
  apiKeys.add(key);
}

export function removeApiKey(key: string): void {
  apiKeys.delete(key);
}

export const authMiddleware: Middleware = (req: MidRequest, res: ServerResponse, next) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  if (req.method === "GET" && url.pathname === "/health") {
    return next();
  }

  const key = validateApiKey(req);
  if (!key) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "API key required" }));
    return;
  }

  if (!apiKeys.has(key)) {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid API key" }));
    return;
  }

  return next();
};
