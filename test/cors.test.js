import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import http from "node:http";
import { corsMiddleware } from "../dist/cors.js";
import { createRouter } from "../dist/router.js";
import { compose } from "../dist/middleware.js";

function makeRequest(server, path, method = "GET") {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const req = http.request(`http://localhost:${port}${path}`, { method }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on("error", reject);
    req.end();
  });
}

describe("CORS middleware", () => {
  let server;

  afterEach(() => {
    if (server) return new Promise((resolve) => server.close(resolve));
  });

  it("adds CORS headers to regular responses", async () => {
    const router = createRouter({ getAll: () => [] }, Date.now());
    const handler = compose(corsMiddleware, router);
    server = http.createServer(handler);
    await new Promise((resolve) => server.listen(0, resolve));

    const { status, headers } = await makeRequest(server, "/health");
    assert.strictEqual(status, 200);
    assert.strictEqual(headers["access-control-allow-origin"], "*");
    assert.strictEqual(headers["access-control-allow-methods"], "GET, POST, PATCH, PUT, DELETE, OPTIONS");
    assert.strictEqual(headers["access-control-allow-headers"], "Content-Type, X-API-Key");
  });

  it("handles OPTIONS preflight with 204 status", async () => {
    const router = createRouter({ getAll: () => [] }, Date.now());
    const handler = compose(corsMiddleware, router);
    server = http.createServer(handler);
    await new Promise((resolve) => server.listen(0, resolve));

    const { status, headers, body } = await makeRequest(server, "/todos", "OPTIONS");
    assert.strictEqual(status, 204);
    assert.strictEqual(headers["access-control-allow-origin"], "*");
    assert.strictEqual(headers["access-control-allow-methods"], "GET, POST, PATCH, PUT, DELETE, OPTIONS");
    assert.strictEqual(headers["access-control-allow-headers"], "Content-Type, X-API-Key");
    assert.strictEqual(body, "");
  });
});
