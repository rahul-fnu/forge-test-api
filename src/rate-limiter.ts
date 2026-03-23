import { ServerResponse } from "node:http";
import { Middleware, MidRequest } from "./middleware.js";

export class RateLimiter {
  private windows: Map<string, number[]> = new Map();

  constructor(
    private maxRequests: number = 100,
    private windowMs: number = 60_000
  ) {}

  check(key: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    let timestamps = this.windows.get(key);
    if (!timestamps) {
      timestamps = [];
      this.windows.set(key, timestamps);
    }

    // Remove expired timestamps (sliding window)
    while (timestamps.length > 0 && timestamps[0] <= cutoff) {
      timestamps.shift();
    }

    const resetAt = timestamps.length > 0 ? timestamps[0] + this.windowMs : now + this.windowMs;

    if (timestamps.length >= this.maxRequests) {
      return { allowed: false, remaining: 0, resetAt };
    }

    timestamps.push(now);
    return { allowed: true, remaining: this.maxRequests - timestamps.length, resetAt };
  }
}

export function createRateLimitMiddleware(limiter: RateLimiter): Middleware {
  return (req: MidRequest, res: ServerResponse, next) => {
    const key = req.apiKey!;
    const result = limiter.check(key);

    res.setHeader("X-RateLimit-Remaining", String(result.remaining));
    res.setHeader("X-RateLimit-Reset", String(result.resetAt));

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
      res.writeHead(429, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Rate limit exceeded", retryAfter }));
      return;
    }

    return next();
  };
}
