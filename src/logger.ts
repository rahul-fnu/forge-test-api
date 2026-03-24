import { ServerResponse } from "node:http";
import { MidRequest, Middleware } from "./middleware.js";

export interface LogEntry {
  timestamp: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  requestSize: number;
  responseSize: number;
  error?: string;
}

export class RequestLogger {
  private entries: LogEntry[] = [];
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  log(entry: LogEntry): void {
    if (this.entries.length >= this.maxSize) {
      this.entries.shift();
    }
    this.entries.push(entry);
  }

  getRecent(n: number): LogEntry[] {
    return this.entries.slice(-n);
  }

  clear(): void {
    this.entries = [];
  }
}

export function loggingMiddleware(logger: RequestLogger): Middleware {
  return async (req: MidRequest, res: ServerResponse, next) => {
    const start = Date.now();
    const method = req.method ?? "GET";
    const path = (req.url ?? "/").split("?")[0];
    const requestSize = req.headers["content-length"] ? parseInt(req.headers["content-length"], 10) : 0;

    let error: string | undefined;
    let bytesWritten = 0;

    const originalWrite = res.write.bind(res);
    res.write = function (chunk: any, ...args: any[]) {
      if (chunk) {
        bytesWritten += typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.length;
      }
      return originalWrite(chunk, ...args);
    } as typeof res.write;

    const originalEnd = res.end.bind(res);
    res.end = function (chunk?: any, ...args: any[]) {
      if (chunk) {
        bytesWritten += typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.length;
      }
      return originalEnd(chunk, ...args);
    } as typeof res.end;

    try {
      await next();
    } catch (err: unknown) {
      error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      logger.log({
        timestamp: new Date().toISOString(),
        method,
        path,
        status: res.statusCode,
        durationMs: Date.now() - start,
        requestSize,
        responseSize: bytesWritten,
        error,
      });
    }
  };
}
