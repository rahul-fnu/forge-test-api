import { IncomingMessage, ServerResponse } from "node:http";

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

export function withLogging(handler: Handler): Handler {
  return (req: IncomingMessage, res: ServerResponse) => {
    const start = Date.now();
    const method = req.method ?? "UNKNOWN";
    const path = req.url ?? "/";

    const originalEnd = res.end.bind(res);
    res.end = function (...args: Parameters<typeof res.end>) {
      const duration = Date.now() - start;
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] ${method} ${path} ${res.statusCode} ${duration}ms`);
      return originalEnd(...args);
    } as typeof res.end;

    handler(req, res);
  };
}
