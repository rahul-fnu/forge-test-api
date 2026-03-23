import { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";

export interface MidRequest extends IncomingMessage {
  body?: string;
}

export type NextFn = () => Promise<void>;
export type Middleware = (req: MidRequest, res: ServerResponse, next: NextFn) => void | Promise<void>;

export function compose(...middlewares: Middleware[]): (req: IncomingMessage, res: ServerResponse) => void {
  return (req: MidRequest, res: ServerResponse) => {
    let index = -1;
    function dispatch(i: number): Promise<void> {
      if (i <= index) return Promise.reject(new Error("next() called multiple times"));
      index = i;
      const mw = middlewares[i];
      if (!mw) return Promise.resolve();
      return Promise.resolve(mw(req, res, () => dispatch(i + 1)));
    }
    dispatch(0).catch(() => {});
  };
}

export const requestId: Middleware = (_req, res, next) => {
  res.setHeader("X-Request-Id", randomUUID());
  return next();
};

export const timing: Middleware = async (_req, res, next) => {
  const start = Date.now();
  const originalWriteHead = res.writeHead.bind(res);
  res.writeHead = function (statusCode: number, ...args: any[]) {
    res.setHeader("X-Response-Time", `${Date.now() - start}ms`);
    return originalWriteHead(statusCode, ...args);
  } as typeof res.writeHead;
  await next();
};

export const errorHandler: Middleware = async (req, res, next) => {
  try {
    await next();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = 500;
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: message, status }));
  }
};

export const bodyParser: Middleware = (req, res, next) => {
  if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      req.body = body;
      next();
    });
  } else {
    return next();
  }
};
