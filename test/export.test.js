import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import http from "node:http";
import { TodoStore } from "../dist/store.js";
import { createRouter } from "../dist/router.js";
import { todosToCSV, todosToJSON, parseCSV, parseImportJSON } from "../dist/export.js";

function makeRequest(server, path) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    http.get(`http://localhost:${port}${path}`, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () =>
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data,
        })
      );
    }).on("error", reject);
  });
}

function createTestServer(store) {
  const handler = createRouter(store);
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      req.body = body;
      handler(req, res, () => {});
    });
  });
  return server;
}

function postRequest(server, path, body, contentType) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const headers = { "Content-Type": contentType };
    if (body) headers["Content-Length"] = Buffer.byteLength(body);
    const req = http.request({ hostname: "localhost", port, path, method: "POST", headers }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

describe("todosToCSV", () => {
  it("returns CSV with headers and rows", () => {
    const todos = [
      { id: "1", title: "Buy milk", completed: false, createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "2", title: "Walk dog", completed: true, createdAt: "2026-01-02T00:00:00.000Z" },
    ];
    const csv = todosToCSV(todos);
    const lines = csv.split("\n");
    assert.strictEqual(lines[0], "id,title,completed,createdAt");
    assert.strictEqual(lines[1], "1,Buy milk,false,2026-01-01T00:00:00.000Z");
    assert.strictEqual(lines[2], "2,Walk dog,true,2026-01-02T00:00:00.000Z");
  });

  it("returns only headers for empty array", () => {
    assert.strictEqual(todosToCSV([]), "id,title,completed,createdAt");
  });
});

describe("todosToJSON", () => {
  it("returns JSON array string", () => {
    const todos = [
      { id: "1", title: "Test", completed: false, createdAt: "2026-01-01T00:00:00.000Z" },
    ];
    const result = todosToJSON(todos);
    assert.deepStrictEqual(JSON.parse(result), todos);
  });
});

describe("GET /todos/export", () => {
  let server;

  afterEach(() => {
    if (server) return new Promise((resolve) => server.close(resolve));
  });

  it("returns CSV with Content-Disposition header", async () => {
    const store = new TodoStore();
    store.create("Task A");
    server = createTestServer(store);
    await new Promise((resolve) => server.listen(0, resolve));

    const { status, headers, body } = await makeRequest(server, "/todos/export?format=csv");
    assert.strictEqual(status, 200);
    assert.strictEqual(headers["content-type"], "text/csv");
    assert.strictEqual(headers["content-disposition"], 'attachment; filename="todos.csv"');
    assert.ok(body.startsWith("id,title,completed,createdAt"));
    assert.ok(body.includes("Task A"));
  });

  it("returns JSON with Content-Disposition header", async () => {
    const store = new TodoStore();
    store.create("Task B");
    server = createTestServer(store);
    await new Promise((resolve) => server.listen(0, resolve));

    const { status, headers, body } = await makeRequest(server, "/todos/export?format=json");
    assert.strictEqual(status, 200);
    assert.strictEqual(headers["content-type"], "application/json");
    assert.strictEqual(headers["content-disposition"], 'attachment; filename="todos.json"');
    const parsed = JSON.parse(body);
    assert.ok(Array.isArray(parsed));
    assert.strictEqual(parsed[0].title, "Task B");
  });

  it("defaults to JSON when format not specified", async () => {
    const store = new TodoStore();
    server = createTestServer(store);
    await new Promise((resolve) => server.listen(0, resolve));

    const { status, headers } = await makeRequest(server, "/todos/export");
    assert.strictEqual(status, 200);
    assert.strictEqual(headers["content-disposition"], 'attachment; filename="todos.json"');
  });

  it("returns 400 for unknown format", async () => {
    const store = new TodoStore();
    server = createTestServer(store);
    await new Promise((resolve) => server.listen(0, resolve));

    const { status, body } = await makeRequest(server, "/todos/export?format=xml");
    assert.strictEqual(status, 400);
    const parsed = JSON.parse(body);
    assert.strictEqual(parsed.error, "unknown format");
  });
});

describe("POST /todos/import", () => {
  let server;

  afterEach(() => {
    if (server) return new Promise((resolve) => server.close(resolve));
  });

  it("imports todos from CSV", async () => {
    const store = new TodoStore();
    server = createTestServer(store);
    await new Promise((resolve) => server.listen(0, resolve));

    const csv = "id,title,completed,createdAt\n1,Buy milk,false,2026-01-01\n2,Walk dog,false,2026-01-02";
    const { status, body } = await postRequest(server, "/todos/import", csv, "text/csv");
    assert.strictEqual(status, 200);
    assert.strictEqual(body.imported, 2);
    assert.deepStrictEqual(body.errors, []);
    assert.strictEqual(store.getAll().length, 2);
  });

  it("imports todos from JSON", async () => {
    const store = new TodoStore();
    server = createTestServer(store);
    await new Promise((resolve) => server.listen(0, resolve));

    const jsonBody = JSON.stringify([{ title: "Task A" }, { title: "Task B" }]);
    const { status, body } = await postRequest(server, "/todos/import", jsonBody, "application/json");
    assert.strictEqual(status, 200);
    assert.strictEqual(body.imported, 2);
    assert.deepStrictEqual(body.errors, []);
    assert.strictEqual(store.getAll().length, 2);
  });

  it("handles mixed valid/invalid rows in CSV", async () => {
    const store = new TodoStore();
    server = createTestServer(store);
    await new Promise((resolve) => server.listen(0, resolve));

    const csv = "id,title,completed,createdAt\n1,Buy milk,false,2026-01-01\n2,,false,2026-01-02\n3,Walk dog,false,2026-01-03";
    const { status, body } = await postRequest(server, "/todos/import", csv, "text/csv");
    assert.strictEqual(status, 200);
    assert.strictEqual(body.imported, 2);
    assert.strictEqual(body.errors.length, 1);
    assert.ok(body.errors[0].includes("empty title"));
    assert.strictEqual(store.getAll().length, 2);
  });

  it("handles mixed valid/invalid items in JSON", async () => {
    const store = new TodoStore();
    server = createTestServer(store);
    await new Promise((resolve) => server.listen(0, resolve));

    const jsonBody = JSON.stringify([{ title: "Task A" }, { title: "" }, { title: "Task C" }]);
    const { status, body } = await postRequest(server, "/todos/import", jsonBody, "application/json");
    assert.strictEqual(status, 200);
    assert.strictEqual(body.imported, 2);
    assert.strictEqual(body.errors.length, 1);
    assert.ok(body.errors[0].includes("empty title"));
  });

  it("handles empty CSV input", async () => {
    const store = new TodoStore();
    server = createTestServer(store);
    await new Promise((resolve) => server.listen(0, resolve));

    const { status, body } = await postRequest(server, "/todos/import", "", "text/csv");
    assert.strictEqual(status, 200);
    assert.strictEqual(body.imported, 0);
    assert.strictEqual(store.getAll().length, 0);
  });

  it("handles empty JSON array input", async () => {
    const store = new TodoStore();
    server = createTestServer(store);
    await new Promise((resolve) => server.listen(0, resolve));

    const { status, body } = await postRequest(server, "/todos/import", "[]", "application/json");
    assert.strictEqual(status, 200);
    assert.strictEqual(body.imported, 0);
    assert.strictEqual(store.getAll().length, 0);
  });
});
