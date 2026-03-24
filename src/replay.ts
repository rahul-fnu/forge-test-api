import { ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { MidRequest, Middleware } from "./middleware.js";

export interface RecordedRequest {
  id: string;
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body: string | undefined;
  responseStatus: number;
  responseBody: string;
  timestamp: string;
}

export class RequestRecorder {
  private records: RecordedRequest[] = [];
  private maxSize: number;

  constructor(maxSize: number = 50) {
    this.maxSize = maxSize;
  }

  record(req: MidRequest, res: ServerResponse): void {
    const id = randomUUID();
    const method = req.method ?? "GET";
    const path = (req.url ?? "/").split("?")[0];
    const headers: Record<string, string | string[] | undefined> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      headers[key] = value;
    }
    const body = req.body;

    let responseBody = "";
    let capturedStatus = 200;

    const originalWriteHead = res.writeHead.bind(res);
    res.writeHead = function (statusCode: number, ...args: any[]) {
      capturedStatus = statusCode;
      return originalWriteHead(statusCode, ...args);
    } as typeof res.writeHead;

    const originalEnd = res.end.bind(res);
    const self = this;
    res.end = function (chunk?: any, encoding?: any, cb?: any) {
      if (chunk) {
        responseBody = typeof chunk === "string" ? chunk : chunk.toString();
      }
      const entry: RecordedRequest = {
        id,
        method,
        path,
        headers,
        body,
        responseStatus: capturedStatus,
        responseBody,
        timestamp: new Date().toISOString(),
      };
      if (self.records.length >= self.maxSize) {
        self.records.shift();
      }
      self.records.push(entry);
      return originalEnd(chunk, encoding, cb);
    } as typeof res.end;
  }

  getRecorded(id: string): RecordedRequest | undefined {
    return this.records.find((r) => r.id === id);
  }

  listRecorded(limit: number = 50): RecordedRequest[] {
    return this.records.slice(-limit);
  }

  replay(id: string): RecordedRequest | undefined {
    return this.getRecorded(id);
  }
}

export function recordingMiddleware(recorder: RequestRecorder): Middleware {
  return (req: MidRequest, res: ServerResponse, next) => {
    const path = (req.url ?? "/").split("?")[0];
    if (path.startsWith("/debug/")) {
      return next();
    }
    recorder.record(req, res);
    return next();
  };
}
