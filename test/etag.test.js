import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import http from "node:http";
import { TodoStore } from "../dist/store.js";
import { createRouter } from "../dist/router.js";
import { generateETag } from "../dist/etag.js";

function makeRequest(server, method, path, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const options = { hostname: "localhost", port, path, method, headers };
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data ? JSON.parse(data) : null,
        });
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

describe("ETag caching", () => {
  let server;
  let store;

  beforeEach(async () => {
    store = new TodoStore();
    const handler = createRouter(store);
    server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        req.body = body;
        handler(req, res, () => {});
      });
    });
    await new Promise((resolve) => server.listen(0, resolve));
  });

  afterEach(() => {
    if (server) return new Promise((resolve) => server.close(resolve));
  });

  it("includes ETag header in GET /todos response", async () => {
    store.create("Test");
    const { status, headers } = await makeRequest(server, "GET", "/todos");
    assert.strictEqual(status, 200);
    assert.ok(headers.etag, "ETag header should be present");
  });

  it("includes ETag header in GET /todos/:id response", async () => {
    const todo = store.create("Test");
    const { status, headers } = await makeRequest(server, "GET", `/todos/${todo.id}`);
    assert.strictEqual(status, 200);
    assert.ok(headers.etag, "ETag header should be present");
  });

  it("returns 304 when If-None-Match matches ETag for GET /todos", async () => {
    store.create("Test");
    const first = await makeRequest(server, "GET", "/todos");
    const etag = first.headers.etag;

    const second = await makeRequest(server, "GET", "/todos", {
      headers: { "If-None-Match": etag },
    });
    assert.strictEqual(second.status, 304);
    assert.strictEqual(second.body, null);
  });

  it("returns 304 when If-None-Match matches ETag for GET /todos/:id", async () => {
    const todo = store.create("Test");
    const first = await makeRequest(server, "GET", `/todos/${todo.id}`);
    const etag = first.headers.etag;

    const second = await makeRequest(server, "GET", `/todos/${todo.id}`, {
      headers: { "If-None-Match": etag },
    });
    assert.strictEqual(second.status, 304);
    assert.strictEqual(second.body, null);
  });

  it("returns 200 when If-None-Match does not match", async () => {
    store.create("Test");
    const { status } = await makeRequest(server, "GET", "/todos", {
      headers: { "If-None-Match": '"stale-etag"' },
    });
    assert.strictEqual(status, 200);
  });

  it("ETag changes after mutation (create)", async () => {
    store.create("First");
    const first = await makeRequest(server, "GET", "/todos");
    const etag1 = first.headers.etag;

    await makeRequest(server, "POST", "/todos", {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Second" }),
    });

    const second = await makeRequest(server, "GET", "/todos");
    const etag2 = second.headers.etag;
    assert.notStrictEqual(etag1, etag2, "ETag should change after creating a todo");
  });

  it("ETag changes after mutation (update)", async () => {
    const todo = store.create("Test");
    const first = await makeRequest(server, "GET", `/todos/${todo.id}`);
    const etag1 = first.headers.etag;

    await makeRequest(server, "PATCH", `/todos/${todo.id}`, {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    });

    const second = await makeRequest(server, "GET", `/todos/${todo.id}`);
    const etag2 = second.headers.etag;
    assert.notStrictEqual(etag1, etag2, "ETag should change after updating a todo");
  });

  it("ETag changes after mutation (delete)", async () => {
    store.create("A");
    const b = store.create("B");
    const first = await makeRequest(server, "GET", "/todos");
    const etag1 = first.headers.etag;

    await makeRequest(server, "DELETE", `/todos/${b.id}`);

    const second = await makeRequest(server, "GET", "/todos");
    const etag2 = second.headers.etag;
    assert.notStrictEqual(etag1, etag2, "ETag should change after deleting a todo");
  });
});
