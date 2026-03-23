import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import http from "node:http";
import { RequestLogger, loggingMiddleware } from "../dist/logger.js";
import { createRouter } from "../dist/router.js";
import { TodoStore } from "../dist/store.js";
import { compose, bodyParser, errorHandler } from "../dist/middleware.js";

function makeRequest(server, method, path, body) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const options = { hostname: "localhost", port, path, method };
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

describe("RequestLogger", () => {
  it("stores and retrieves log entries", () => {
    const logger = new RequestLogger();
    const entry = {
      timestamp: new Date().toISOString(),
      method: "GET",
      path: "/test",
      status: 200,
      durationMs: 5,
      requestSize: 0,
      responseSize: 10,
    };
    logger.log(entry);
    const recent = logger.getRecent(10);
    assert.strictEqual(recent.length, 1);
    assert.deepStrictEqual(recent[0], entry);
  });

  it("ring buffer drops oldest entries beyond maxSize", () => {
    const logger = new RequestLogger(5);
    for (let i = 0; i < 8; i++) {
      logger.log({
        timestamp: new Date().toISOString(),
        method: "GET",
        path: `/item/${i}`,
        status: 200,
        durationMs: 1,
        requestSize: 0,
        responseSize: 0,
      });
    }
    const recent = logger.getRecent(10);
    assert.strictEqual(recent.length, 5);
    assert.strictEqual(recent[0].path, "/item/3");
    assert.strictEqual(recent[4].path, "/item/7");
  });

  it("clear removes all entries", () => {
    const logger = new RequestLogger();
    logger.log({
      timestamp: new Date().toISOString(),
      method: "GET",
      path: "/test",
      status: 200,
      durationMs: 1,
      requestSize: 0,
      responseSize: 0,
    });
    logger.clear();
    assert.strictEqual(logger.getRecent(10).length, 0);
  });

  it("getRecent returns at most n entries", () => {
    const logger = new RequestLogger();
    for (let i = 0; i < 10; i++) {
      logger.log({
        timestamp: new Date().toISOString(),
        method: "GET",
        path: `/item/${i}`,
        status: 200,
        durationMs: 1,
        requestSize: 0,
        responseSize: 0,
      });
    }
    assert.strictEqual(logger.getRecent(3).length, 3);
  });
});

describe("Logging middleware", () => {
  let server;

  afterEach(() => {
    if (server) return new Promise((resolve) => server.close(resolve));
  });

  it("creates log entries for requests", async () => {
    const logger = new RequestLogger();
    const store = new TodoStore();
    const router = createRouter(store, Date.now(), undefined, logger);
    const app = compose(bodyParser, loggingMiddleware(logger), router);
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));

    await makeRequest(server, "GET", "/health");

    const entries = logger.getRecent(10);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].method, "GET");
    assert.strictEqual(entries[0].path, "/health");
    assert.strictEqual(entries[0].status, 200);
    assert.strictEqual(typeof entries[0].durationMs, "number");
    assert.strictEqual(typeof entries[0].responseSize, "number");
    assert.ok(entries[0].responseSize > 0);
  });

  it("logs error details when handler throws", async () => {
    const logger = new RequestLogger();
    const throwingMiddleware = async (_req, _res, _next) => {
      throw new Error("test explosion");
    };
    const app = compose(errorHandler, loggingMiddleware(logger), throwingMiddleware);
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));

    await makeRequest(server, "GET", "/anything");

    const entries = logger.getRecent(10);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].error, "test explosion");
  });
});

describe("GET /admin/logs", () => {
  let server;

  afterEach(() => {
    if (server) return new Promise((resolve) => server.close(resolve));
  });

  it("returns recent log entries", async () => {
    const logger = new RequestLogger();
    const store = new TodoStore();
    const router = createRouter(store, Date.now(), undefined, logger);
    const app = compose(bodyParser, loggingMiddleware(logger), router);
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));

    await makeRequest(server, "GET", "/health");
    await makeRequest(server, "GET", "/health");

    const { status, body } = await makeRequest(server, "GET", "/admin/logs?limit=50");
    assert.strictEqual(status, 200);
    assert.ok(Array.isArray(body));
    // 2 health requests + the logs requests that came before this response
    assert.ok(body.length >= 2);
  });

  it("respects limit parameter", async () => {
    const logger = new RequestLogger();
    const store = new TodoStore();
    const router = createRouter(store, Date.now(), undefined, logger);
    const app = compose(bodyParser, loggingMiddleware(logger), router);
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));

    for (let i = 0; i < 5; i++) {
      await makeRequest(server, "GET", "/health");
    }

    const { status, body } = await makeRequest(server, "GET", "/admin/logs?limit=2");
    assert.strictEqual(status, 200);
    assert.strictEqual(body.length, 2);
  });
});
