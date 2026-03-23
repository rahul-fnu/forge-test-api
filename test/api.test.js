import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { createServer, request as httpRequest } from "node:http";
import { TodoStore } from "../dist/store.js";
import { router } from "../dist/router.js";

function request(server, method, path, body) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const options = {
      hostname: "127.0.0.1",
      port: addr.port,
      path,
      method,
      headers: { "Content-Type": "application/json" },
    };
    const req = httpRequest(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        resolve({
          status: res.statusCode,
          body: data ? JSON.parse(data) : null,
        });
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

describe("Todo API E2E", () => {
  let server;

  before((_, done) => {
    const store = new TodoStore();
    server = createServer((req, res) => router(req, res, store));
    server.listen(0, "127.0.0.1", done);
  });

  after((_, done) => {
    server.close(done);
  });

  it("POST /todos creates a todo", async () => {
    const res = await request(server, "POST", "/todos", { title: "Buy milk" });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.title, "Buy milk");
    assert.strictEqual(res.body.completed, false);
    assert.ok(res.body.id);
    assert.ok(res.body.createdAt);
  });

  it("POST /todos returns 400 without title", async () => {
    const res = await request(server, "POST", "/todos", {});
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, "title is required");
  });

  it("GET /todos lists all todos", async () => {
    const res = await request(server, "GET", "/todos");
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length >= 1);
  });

  it("GET /todos/:id returns a single todo", async () => {
    const created = await request(server, "POST", "/todos", { title: "Read book" });
    const res = await request(server, "GET", `/todos/${created.body.id}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.title, "Read book");
  });

  it("GET /todos/:id returns 404 for missing todo", async () => {
    const res = await request(server, "GET", "/todos/999");
    assert.strictEqual(res.status, 404);
  });

  it("PATCH /todos/:id updates a todo", async () => {
    const created = await request(server, "POST", "/todos", { title: "Exercise" });
    const res = await request(server, "PATCH", `/todos/${created.body.id}`, {
      completed: true,
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.completed, true);
    assert.strictEqual(res.body.title, "Exercise");
  });

  it("PATCH /todos/:id returns 404 for missing todo", async () => {
    const res = await request(server, "PATCH", "/todos/999", { title: "Nope" });
    assert.strictEqual(res.status, 404);
  });

  it("DELETE /todos/:id removes a todo", async () => {
    const created = await request(server, "POST", "/todos", { title: "Temp" });
    const del = await request(server, "DELETE", `/todos/${created.body.id}`);
    assert.strictEqual(del.status, 204);
    const get = await request(server, "GET", `/todos/${created.body.id}`);
    assert.strictEqual(get.status, 404);
  });

  it("DELETE /todos/:id returns 404 for missing todo", async () => {
    const res = await request(server, "DELETE", "/todos/999");
    assert.strictEqual(res.status, 404);
  });

  it("unknown route returns 404", async () => {
    const res = await request(server, "GET", "/unknown");
    assert.strictEqual(res.status, 404);
  });
});
