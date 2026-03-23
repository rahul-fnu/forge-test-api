import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import http from "node:http";
import { TodoApiClient } from "../dist/api-client.js";

function createMockServer(handler) {
  const server = http.createServer(handler);
  return new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port;
      resolve({ server, baseUrl: `http://localhost:${port}` });
    });
  });
}

function closeServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
  });
}

function jsonResponse(res, status, data, extraHeaders = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "X-RateLimit-Limit": "100",
    "X-RateLimit-Remaining": "99",
    "X-RateLimit-Reset": String(Math.floor(Date.now() / 1000) + 60),
    ...extraHeaders,
  });
  if (data !== undefined) {
    res.end(JSON.stringify(data));
  } else {
    res.end();
  }
}

describe("TodoApiClient", () => {
  let server;
  let client;

  afterEach(async () => {
    if (server) await closeServer(server);
  });

  it("listTodos returns todos array", async () => {
    const todos = [
      { id: "1", title: "Test", completed: false, createdAt: "2026-01-01T00:00:00.000Z" },
    ];
    const mock = await createMockServer((req, res) => {
      assert.strictEqual(req.url, "/todos");
      assert.strictEqual(req.headers.authorization, "Bearer test-api-key-1234");
      jsonResponse(res, 200, todos);
    });
    server = mock.server;
    client = new TodoApiClient(mock.baseUrl, "test-api-key-1234");

    const result = await client.listTodos();
    assert.deepStrictEqual(result.data, todos);
    assert.strictEqual(result.rateLimit.limit, 100);
  });

  it("listTodos passes query params", async () => {
    const mock = await createMockServer((req, res) => {
      assert.ok(req.url.includes("overdue=true"));
      jsonResponse(res, 200, []);
    });
    server = mock.server;
    client = new TodoApiClient(mock.baseUrl, "test-api-key-1234");

    await client.listTodos({ overdue: true });
  });

  it("createTodo sends POST with title", async () => {
    const todo = { id: "1", title: "New", completed: false, createdAt: "2026-01-01T00:00:00.000Z" };
    const mock = await createMockServer(async (req, res) => {
      assert.strictEqual(req.method, "POST");
      const body = JSON.parse(await readBody(req));
      assert.strictEqual(body.title, "New");
      jsonResponse(res, 201, todo);
    });
    server = mock.server;
    client = new TodoApiClient(mock.baseUrl, "test-api-key-1234");

    const result = await client.createTodo("New");
    assert.strictEqual(result.data.title, "New");
  });

  it("updateTodo sends PATCH", async () => {
    const todo = { id: "1", title: "Test", completed: true, createdAt: "2026-01-01T00:00:00.000Z" };
    const mock = await createMockServer(async (req, res) => {
      assert.strictEqual(req.method, "PATCH");
      assert.ok(req.url.includes("/todos/1"));
      const body = JSON.parse(await readBody(req));
      assert.strictEqual(body.completed, true);
      jsonResponse(res, 200, todo);
    });
    server = mock.server;
    client = new TodoApiClient(mock.baseUrl, "test-api-key-1234");

    const result = await client.updateTodo("1", { completed: true });
    assert.strictEqual(result.data.completed, true);
  });

  it("deleteTodo sends DELETE", async () => {
    const mock = await createMockServer((req, res) => {
      assert.strictEqual(req.method, "DELETE");
      assert.ok(req.url.includes("/todos/1"));
      res.writeHead(204, {
        "X-RateLimit-Limit": "100",
        "X-RateLimit-Remaining": "98",
        "X-RateLimit-Reset": String(Math.floor(Date.now() / 1000) + 60),
      });
      res.end();
    });
    server = mock.server;
    client = new TodoApiClient(mock.baseUrl, "test-api-key-1234");

    const result = await client.deleteTodo("1");
    assert.strictEqual(result.data, undefined);
  });

  it("throws on API error", async () => {
    const mock = await createMockServer((req, res) => {
      jsonResponse(res, 404, { error: "not found" });
    });
    server = mock.server;
    client = new TodoApiClient(mock.baseUrl, "test-api-key-1234");

    await assert.rejects(() => client.listTodos(), /API error 404/);
  });

  it("retries on 429 rate limit", async () => {
    let callCount = 0;
    const mock = await createMockServer((req, res) => {
      callCount++;
      if (callCount === 1) {
        const resetTime = Math.floor(Date.now() / 1000);
        res.writeHead(429, {
          "Content-Type": "application/json",
          "X-RateLimit-Limit": "100",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(resetTime),
        });
        res.end(JSON.stringify({ error: "rate limited" }));
      } else {
        jsonResponse(res, 200, []);
      }
    });
    server = mock.server;
    client = new TodoApiClient(mock.baseUrl, "test-api-key-1234");

    const result = await client.listTodos();
    assert.deepStrictEqual(result.data, []);
    assert.strictEqual(callCount, 2);
  });
});
