import { ServerResponse } from "node:http";
import { Middleware, MidRequest } from "./middleware.js";

const API_KEYS = new Set(
  (process.env.API_KEYS ?? "test-key-1,test-key-2").split(",").map((k) => k.trim())
);

export const auth: Middleware = (req: MidRequest, res: ServerResponse, next) => {
  const key = req.headers["x-api-key"] as string | undefined;
  if (!key || !API_KEYS.has(key)) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }
  req.apiKey = key;
  return next();
};
