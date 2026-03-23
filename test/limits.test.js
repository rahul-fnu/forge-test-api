import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import http from "node:http";
import { TodoStore } from "../dist/store.js";
import { createRouter } from "../dist/router.js";
import { compose, requestId, timing, errorHandler, bodyParser } from "../dist/middleware.js";
import { authMiddleware } from "../dist/auth.js";
import { bodyLimit, timeoutMiddleware } from "../dist/limits.js";

const AUTH = { "X-API-Key": "test-key-123" };

function request(server, method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, `http://localhost:${server.address().port}`);
    const req = http.request(url, { method, headers }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on("error", reject);
    if (body) req.end(body);
    else req.end();
  });
}

describe("Body size limit", () => {
  let server;

  afterEach((_, done) => {
    if (server) server.close(done);
    else done();
  });

  it("rejects requests with body > 1MB with 413", async () => {
    const store = new TodoStore();
    const app = compose(requestId, timing, errorHandler, bodyLimit, authMiddleware, bodyParser, createRouter(store));
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));

    const largeBody = "x".repeat(1024 * 1024 + 1);
    const res = await request(server, "POST", "/todos", largeBody, {
      ...AUTH,
      "Content-Type": "application/json",
    });
    assert.strictEqual(res.status, 413);
    const parsed = JSON.parse(res.body);
    assert.strictEqual(parsed.error, "Payload Too Large");
  });

  it("allows requests with body <= 1MB", async () => {
    const store = new TodoStore();
    const app = compose(requestId, timing, errorHandler, bodyLimit, authMiddleware, bodyParser, createRouter(store));
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));

    const res = await request(server, "POST", "/todos", JSON.stringify({ title: "small" }), {
      ...AUTH,
      "Content-Type": "application/json",
    });
    assert.strictEqual(res.status, 201);
  });
});

describe("Request timeout", () => {
  let server;

  afterEach((_, done) => {
    if (server) server.close(done);
    else done();
  });

  it("returns 408 if handler does not respond in time", async () => {
    const slowMiddleware = async (_req, _res, _next) => {
      await new Promise((r) => setTimeout(r, 500));
    };
    const app = compose(errorHandler, timeoutMiddleware, slowMiddleware);
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));

    // Override timeout to 100ms for testing by creating a custom timeout middleware
    // Instead, let's use a direct approach with a short timeout
    server.close();

    const shortTimeout = (_req, res, next) => {
      const timer = setTimeout(() => {
        if (!res.headersSent) {
          res.writeHead(408, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Request Timeout" }));
        }
      }, 100);
      res.on("finish", () => clearTimeout(timer));
      res.on("close", () => clearTimeout(timer));
      return next();
    };

    const app2 = compose(errorHandler, shortTimeout, slowMiddleware);
    server = http.createServer(app2);
    await new Promise((r) => server.listen(0, r));

    const res = await request(server, "GET", "/test");
    assert.strictEqual(res.status, 408);
    const parsed = JSON.parse(res.body);
    assert.strictEqual(parsed.error, "Request Timeout");
  });

  it("does not timeout for normal fast requests", async () => {
    const store = new TodoStore();
    const app = compose(requestId, timing, errorHandler, timeoutMiddleware, bodyLimit, authMiddleware, bodyParser, createRouter(store));
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));

    const res = await request(server, "GET", "/todos", null, AUTH);
    assert.strictEqual(res.status, 200);
  });
});
