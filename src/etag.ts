import { createHash } from "node:crypto";
import { IncomingMessage } from "node:http";

export function generateETag(data: unknown): string {
  const hash = createHash("sha256")
    .update(JSON.stringify(data))
    .digest("hex")
    .slice(0, 16);
  return `"${hash}"`;
}

export function checkConditional(req: IncomingMessage, etag: string): boolean {
  const ifNoneMatch = req.headers["if-none-match"];
  return ifNoneMatch === etag;
}
