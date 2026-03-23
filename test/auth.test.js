import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import http from "node:http";
import { TodoStore } from "../dist/store.js";
import { createRouter } from "../dist/router.js";
import { compose, requestId, timing, errorHandler, bodyParser } from "../dist/middleware.js";
import { authMiddleware } from "../dist/auth.js";

function request(server, method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, `http://localhost:${server.address().port}`);
    const req = http.request(url, { method, headers }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on("error", reject);
    if (body) req.end(JSON.stringify(body));
    else req.end();
  });
}

describe("Auth", () => {
  let server;

  afterEach((_, done) => {
    if (server) server.close(done);
    else done();
  });

  it("returns 401 when no API key is provided", async () => {
    const store = new TodoStore();
    const app = compose(requestId, timing, errorHandler, authMiddleware, bodyParser, createRouter(store));
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));

    const res = await request(server, "GET", "/todos");
    assert.strictEqual(res.status, 401);
    assert.strictEqual(JSON.parse(res.body).error, "API key required");
  });

  it("returns 403 when invalid API key is provided", async () => {
    const store = new TodoStore();
    const app = compose(requestId, timing, errorHandler, authMiddleware, bodyParser, createRouter(store));
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));

    const res = await request(server, "GET", "/todos", null, { "X-API-Key": "wrong-key" });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(JSON.parse(res.body).error, "Invalid API key");
  });

  it("returns 200 when valid API key is provided", async () => {
    const store = new TodoStore();
    const app = compose(requestId, timing, errorHandler, authMiddleware, bodyParser, createRouter(store));
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));

    const res = await request(server, "GET", "/todos", null, { "X-API-Key": "test-key-123" });
    assert.strictEqual(res.status, 200);
  });

  it("health endpoint requires no auth", async () => {
    const store = new TodoStore();
    const app = compose(requestId, timing, errorHandler, authMiddleware, bodyParser, createRouter(store));
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));

    const res = await request(server, "GET", "/health");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(JSON.parse(res.body).status, "ok");
  });
});
