import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import http from "node:http";
import { TodoStore } from "../dist/store.js";
import { createRouter } from "../dist/router.js";
import { compose, requestId, timing, errorHandler, bodyParser } from "../dist/middleware.js";
import { auth } from "../dist/auth.js";
import { RateLimiter, createRateLimitMiddleware } from "../dist/rate-limiter.js";

function request(server, method, path, { body, apiKey } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, `http://localhost:${server.address().port}`);
    const headers = {};
    if (apiKey) headers["x-api-key"] = apiKey;
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

describe("Rate Limiter", () => {
  let server;

  afterEach((_, done) => {
    if (server?.listening) server.close(done);
    else done();
  });

  it("passes requests under the limit", async () => {
    const store = new TodoStore();
    const limiter = new RateLimiter(5, 60000);
    const app = compose(requestId, timing, errorHandler, bodyParser, auth, createRateLimitMiddleware(limiter), createRouter(store));
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));

    const res = await request(server, "GET", "/todos", { apiKey: "test-key-1" });
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers["x-ratelimit-remaining"]);
    assert.ok(res.headers["x-ratelimit-reset"]);
    assert.strictEqual(res.headers["x-ratelimit-remaining"], "4");
  });

  it("returns 429 when rate limit is exceeded", async () => {
    const store = new TodoStore();
    const limiter = new RateLimiter(3, 60000);
    const app = compose(requestId, timing, errorHandler, bodyParser, auth, createRateLimitMiddleware(limiter), createRouter(store));
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));

    for (let i = 0; i < 3; i++) {
      await request(server, "GET", "/todos", { apiKey: "test-key-1" });
    }

    const res = await request(server, "GET", "/todos", { apiKey: "test-key-1" });
    assert.strictEqual(res.status, 429);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.error, "Rate limit exceeded");
    assert.ok(typeof body.retryAfter === "number");
  });

  it("resets after the window expires", async () => {
    const limiter = new RateLimiter(2, 50);

    limiter.check("key-a");
    limiter.check("key-a");
    const blocked = limiter.check("key-a");
    assert.strictEqual(blocked.allowed, false);

    await new Promise((r) => setTimeout(r, 60));

    const afterReset = limiter.check("key-a");
    assert.strictEqual(afterReset.allowed, true);
  });

  it("isolates rate limits per API key", async () => {
    const store = new TodoStore();
    const limiter = new RateLimiter(2, 60000);
    const app = compose(requestId, timing, errorHandler, bodyParser, auth, createRateLimitMiddleware(limiter), createRouter(store));
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));

    // Exhaust limit for key-1
    await request(server, "GET", "/todos", { apiKey: "test-key-1" });
    await request(server, "GET", "/todos", { apiKey: "test-key-1" });
    const blocked = await request(server, "GET", "/todos", { apiKey: "test-key-1" });
    assert.strictEqual(blocked.status, 429);

    // key-2 should still work
    const res = await request(server, "GET", "/todos", { apiKey: "test-key-2" });
    assert.strictEqual(res.status, 200);
  });
});
