import { describe, it, beforeEach, afterEach } from "node:test";
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

const AUTH = { "X-API-Key": "test-key-123" };

describe("Middleware", () => {
  let server;

  afterEach((_, done) => {
    if (server) server.close(done);
    else done();
  });

  it("adds X-Request-Id header (uuid v4)", async () => {
    const store = new TodoStore();
    const app = compose(requestId, timing, errorHandler, authMiddleware, bodyParser, createRouter(store));
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));

    const res = await request(server, "GET", "/todos", null, AUTH);
    assert.ok(res.headers["x-request-id"]);
    assert.match(res.headers["x-request-id"], /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it("adds X-Response-Time header", async () => {
    const store = new TodoStore();
    const app = compose(requestId, timing, errorHandler, authMiddleware, bodyParser, createRouter(store));
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));

    const res = await request(server, "GET", "/todos", null, AUTH);
    assert.ok(res.headers["x-response-time"]);
    assert.match(res.headers["x-response-time"], /^\d+ms$/);
  });

  it("returns 500 JSON response when handler throws", async () => {
    const throwingMiddleware = () => {
      throw new Error("something broke");
    };
    const app = compose(requestId, timing, errorHandler, throwingMiddleware);
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));

    const res = await request(server, "GET", "/anything");
    assert.strictEqual(res.status, 500);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.error, "something broke");
    assert.strictEqual(body.status, 500);
  });

  it("returns 500 JSON response when handler rejects", async () => {
    const rejectingMiddleware = async () => {
      throw new Error("async failure");
    };
    const app = compose(requestId, timing, errorHandler, rejectingMiddleware);
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));

    const res = await request(server, "GET", "/anything");
    assert.strictEqual(res.status, 500);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.error, "async failure");
    assert.strictEqual(body.status, 500);
  });

  it("existing CRUD operations still work through middleware chain", async () => {
    const store = new TodoStore();
    const app = compose(requestId, timing, errorHandler, authMiddleware, bodyParser, createRouter(store));
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));

    // Create
    const createRes = await request(server, "POST", "/todos", { title: "Test" }, AUTH);
    assert.strictEqual(createRes.status, 201);
    const created = JSON.parse(createRes.body);
    assert.strictEqual(created.title, "Test");

    // Get all
    const listRes = await request(server, "GET", "/todos", null, AUTH);
    assert.strictEqual(listRes.status, 200);
    assert.strictEqual(JSON.parse(listRes.body).length, 1);

    // Get by id
    const getRes = await request(server, "GET", `/todos/${created.id}`, null, AUTH);
    assert.strictEqual(getRes.status, 200);

    // Update
    const patchRes = await request(server, "PATCH", `/todos/${created.id}`, { completed: true }, AUTH);
    assert.strictEqual(patchRes.status, 200);
    assert.strictEqual(JSON.parse(patchRes.body).completed, true);

    // Delete
    const delRes = await request(server, "DELETE", `/todos/${created.id}`, null, AUTH);
    assert.strictEqual(delRes.status, 204);
  });
});
