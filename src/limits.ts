import { ServerResponse } from "node:http";
import { MidRequest, Middleware } from "./middleware.js";

const MAX_BODY_BYTES = 1024 * 1024; // 1MB
const TIMEOUT_MS = 30_000; // 30 seconds

export const bodyLimit: Middleware = (req, res, next) => {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return next();
  }
  const contentLength = parseInt(req.headers["content-length"] ?? "0", 10);
  if (contentLength > MAX_BODY_BYTES) {
    res.writeHead(413, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Payload Too Large" }));
    req.destroy();
    return;
  }
  let received = 0;
  const origEmit = req.emit.bind(req);
  req.emit = function (event: string, ...args: any[]) {
    if (event === "data") {
      received += (args[0] as Buffer).length;
      if (received > MAX_BODY_BYTES) {
        req.emit = origEmit;
        if (!res.headersSent) {
          res.writeHead(413, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Payload Too Large" }));
        }
        req.destroy();
        return false;
      }
    }
    return origEmit(event, ...args);
  } as typeof req.emit;
  return next();
};

export const timeoutMiddleware: Middleware = (_req, res, next) => {
  const timer = setTimeout(() => {
    if (!res.headersSent) {
      res.writeHead(408, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Request Timeout" }));
    }
  }, TIMEOUT_MS);
  res.on("finish", () => clearTimeout(timer));
  res.on("close", () => clearTimeout(timer));
  return next();
};
