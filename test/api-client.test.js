import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { createServer } from "node:http";
import { TodoApiClient } from "../dist/api-client.js";

function createMockServer(handler) {
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      req.body = body;
      handler(req, res);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port;
      resolve({ server, port, baseUrl: `http://localhost:${port}` });
    });
  });
}

function json(res, status, data, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(JSON.stringify(data));
}

describe("TodoApiClient", () => {
  let server;
  let client;

  afterEach(() => {
    if (server) server.close();
  });

  it("listTodos fetches todos", async () => {
    const todos = [
      { id: "1", title: "Test", completed: false, createdAt: "2026-01-01T00:00:00.000Z" },
    ];
    const mock = await createMockServer((req, res) => {
      assert.strictEqual(req.url, "/todos");
      assert.strictEqual(req.headers.authorization, "Bearer test-api-key-12345");
      json(res, 200, todos);
    });
    server = mock.server;
    client = new TodoApiClient(mock.baseUrl, "test-api-key-12345");

    const result = await client.listTodos();
    assert.deepStrictEqual(result, todos);
  });

  it("listTodos passes query parameters", async () => {
    const mock = await createMockServer((req, res) => {
      const url = new URL(req.url, `http://localhost`);
      assert.strictEqual(url.searchParams.get("overdue"), "true");
      json(res, 200, []);
    });
    server = mock.server;
    client = new TodoApiClient(mock.baseUrl, "test-api-key-12345");

    await client.listTodos({ overdue: true });
  });

  it("createTodo sends POST request", async () => {
    const mock = await createMockServer((req, res) => {
      assert.strictEqual(req.method, "POST");
      assert.strictEqual(req.url, "/todos");
      const body = JSON.parse(req.body);
      assert.strictEqual(body.title, "New Todo");
      json(res, 201, { id: "1", title: "New Todo", completed: false, createdAt: "2026-01-01T00:00:00.000Z" });
    });
    server = mock.server;
    client = new TodoApiClient(mock.baseUrl, "test-api-key-12345");

    const result = await client.createTodo("New Todo");
    assert.strictEqual(result.title, "New Todo");
  });

  it("updateTodo sends PATCH request", async () => {
    const mock = await createMockServer((req, res) => {
      assert.strictEqual(req.method, "PATCH");
      assert.strictEqual(req.url, "/todos/1");
      const body = JSON.parse(req.body);
      assert.strictEqual(body.completed, true);
      json(res, 200, { id: "1", title: "Test", completed: true, createdAt: "2026-01-01T00:00:00.000Z" });
    });
    server = mock.server;
    client = new TodoApiClient(mock.baseUrl, "test-api-key-12345");

    const result = await client.updateTodo("1", { completed: true });
    assert.strictEqual(result.completed, true);
  });

  it("deleteTodo sends DELETE request", async () => {
    const mock = await createMockServer((req, res) => {
      assert.strictEqual(req.method, "DELETE");
      assert.strictEqual(req.url, "/todos/1");
      res.writeHead(204);
      res.end();
    });
    server = mock.server;
    client = new TodoApiClient(mock.baseUrl, "test-api-key-12345");

    await client.deleteTodo("1");
  });

  it("throws on error responses", async () => {
    const mock = await createMockServer((req, res) => {
      json(res, 404, { error: "not found" });
    });
    server = mock.server;
    client = new TodoApiClient(mock.baseUrl, "test-api-key-12345");

    await assert.rejects(() => client.listTodos(), /HTTP 404/);
  });

  it("retries on 429 with rate limit headers", async () => {
    let callCount = 0;
    const mock = await createMockServer((req, res) => {
      callCount++;
      if (callCount === 1) {
        json(res, 429, { error: "rate limited" }, {
          "X-RateLimit-Limit": "100",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Date.now() + 50),
        });
      } else {
        json(res, 200, []);
      }
    });
    server = mock.server;
    client = new TodoApiClient(mock.baseUrl, "test-api-key-12345");

    const result = await client.listTodos();
    assert.deepStrictEqual(result, []);
    assert.strictEqual(callCount, 2);
  });
});
