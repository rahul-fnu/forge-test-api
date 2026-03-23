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

function jsonResponse(res, status, data, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(data != null ? JSON.stringify(data) : "");
}

describe("TodoApiClient", () => {
  let server;
  let client;

  afterEach(() => {
    if (server) server.close();
  });

  it("creates a todo", async () => {
    const mock = await createMockServer((req, res) => {
      assert.strictEqual(req.method, "POST");
      assert.strictEqual(req.url, "/todos");
      const parsed = JSON.parse(req.body);
      jsonResponse(res, 201, {
        id: "1",
        title: parsed.title,
        completed: false,
        createdAt: "2026-01-01T00:00:00.000Z",
      });
    });
    server = mock.server;
    client = new TodoApiClient(mock.baseUrl, "test-api-key-12345");

    const result = await client.createTodo("Buy milk");
    assert.strictEqual(result.data.title, "Buy milk");
    assert.strictEqual(result.data.id, "1");
  });

  it("lists todos", async () => {
    const mock = await createMockServer((req, res) => {
      assert.strictEqual(req.method, "GET");
      assert.ok(req.url.startsWith("/todos"));
      jsonResponse(res, 200, {
        data: [{ id: "1", title: "A", completed: false, createdAt: "2026-01-01T00:00:00.000Z" }],
        total: 1,
        page: 1,
        pageSize: 20,
        hasMore: false,
      });
    });
    server = mock.server;
    client = new TodoApiClient(mock.baseUrl, "test-api-key-12345");

    const result = await client.listTodos();
    assert.strictEqual(result.data.data.length, 1);
    assert.strictEqual(result.data.total, 1);
  });

  it("updates a todo", async () => {
    const mock = await createMockServer((req, res) => {
      assert.strictEqual(req.method, "PATCH");
      assert.strictEqual(req.url, "/todos/1");
      jsonResponse(res, 200, {
        id: "1",
        title: "Updated",
        completed: true,
        createdAt: "2026-01-01T00:00:00.000Z",
      });
    });
    server = mock.server;
    client = new TodoApiClient(mock.baseUrl, "test-api-key-12345");

    const result = await client.updateTodo("1", { title: "Updated", completed: true });
    assert.strictEqual(result.data.title, "Updated");
    assert.strictEqual(result.data.completed, true);
  });

  it("deletes a todo", async () => {
    const mock = await createMockServer((req, res) => {
      assert.strictEqual(req.method, "DELETE");
      assert.strictEqual(req.url, "/todos/1");
      res.writeHead(204);
      res.end();
    });
    server = mock.server;
    client = new TodoApiClient(mock.baseUrl, "test-api-key-12345");

    const result = await client.deleteTodo("1");
    assert.strictEqual(result.data, undefined);
  });

  it("sends authorization header", async () => {
    const mock = await createMockServer((req, res) => {
      assert.strictEqual(req.headers.authorization, "Bearer my-secret-key-1234");
      jsonResponse(res, 200, {
        data: [],
        total: 0,
        page: 1,
        pageSize: 20,
        hasMore: false,
      });
    });
    server = mock.server;
    client = new TodoApiClient(mock.baseUrl, "my-secret-key-1234");

    await client.listTodos();
  });

  it("throws on error responses", async () => {
    const mock = await createMockServer((req, res) => {
      jsonResponse(res, 404, { error: "not found" });
    });
    server = mock.server;
    client = new TodoApiClient(mock.baseUrl, "test-api-key-12345");

    await assert.rejects(() => client.updateTodo("999", { title: "x" }), /API error 404/);
  });

  it("retries on 429 rate limit", async () => {
    let requestCount = 0;
    const mock = await createMockServer((req, res) => {
      requestCount++;
      if (requestCount === 1) {
        const resetAt = String(Math.floor(Date.now() / 1000));
        jsonResponse(res, 429, { error: "rate limited" }, {
          "X-RateLimit-Limit": "100",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": resetAt,
        });
      } else {
        jsonResponse(res, 200, {
          data: [],
          total: 0,
          page: 1,
          pageSize: 20,
          hasMore: false,
        });
      }
    });
    server = mock.server;
    client = new TodoApiClient(mock.baseUrl, "test-api-key-12345");

    const result = await client.listTodos();
    assert.strictEqual(requestCount, 2);
    assert.strictEqual(result.data.total, 0);
  });

  it("parses rate limit headers", async () => {
    const mock = await createMockServer((req, res) => {
      jsonResponse(res, 200, {
        data: [],
        total: 0,
        page: 1,
        pageSize: 20,
        hasMore: false,
      }, {
        "X-RateLimit-Limit": "100",
        "X-RateLimit-Remaining": "99",
        "X-RateLimit-Reset": "1700000000",
      });
    });
    server = mock.server;
    client = new TodoApiClient(mock.baseUrl, "test-api-key-12345");

    const result = await client.listTodos();
    assert.strictEqual(result.rateLimit.limit, 100);
    assert.strictEqual(result.rateLimit.remaining, 99);
    assert.strictEqual(result.rateLimit.resetAt, 1700000000);
  });
});
