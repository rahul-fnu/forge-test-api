import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import http from "node:http";
import { TodoStore } from "../dist/store.js";
import { createRouter } from "../dist/router.js";
import { WebhookManager } from "../dist/webhooks.js";

function makeRequest(server, method, path, body) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const jsonBody = body ? JSON.stringify(body) : null;
    const headers = { "Content-Type": "application/json" };
    if (jsonBody) headers["Content-Length"] = Buffer.byteLength(jsonBody);
    const options = { hostname: "localhost", port, path, method, headers };
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }));
    });
    req.on("error", reject);
    if (jsonBody) req.write(jsonBody);
    req.end();
  });
}

function createTestServer(store, webhookManager) {
  const handler = createRouter(store, Date.now(), webhookManager);
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

describe("GET /admin/stats", () => {
  let server;
  let originalFetch;

  afterEach(() => {
    if (originalFetch) {
      globalThis.fetch = originalFetch;
      originalFetch = undefined;
    }
    if (server) return new Promise((resolve) => server.close(resolve));
  });

  it("returns initial empty stats", async () => {
    const store = new TodoStore();
    const wm = new WebhookManager();
    server = createTestServer(store, wm);
    await new Promise((r) => server.listen(0, r));

    const { status, body } = await makeRequest(server, "GET", "/admin/stats");
    assert.strictEqual(status, 200);
    assert.strictEqual(body.todos.total, 0);
    assert.strictEqual(body.todos.completed, 0);
    assert.strictEqual(body.todos.pending, 0);
    assert.strictEqual(body.todos.completionRate, 0);
    assert.strictEqual(body.webhooks.registered, 0);
    assert.strictEqual(body.webhooks.totalNotificationsSent, 0);
    assert.strictEqual(body.importExport.totalImported, 0);
    assert.strictEqual(body.importExport.totalExported, 0);
    assert.strictEqual(typeof body.server.uptime, "number");
    assert.strictEqual(body.server.requestCount, 1);
  });

  it("reflects todo stats after creating and completing todos", async () => {
    const store = new TodoStore();
    const wm = new WebhookManager();
    server = createTestServer(store, wm);
    await new Promise((r) => server.listen(0, r));

    await makeRequest(server, "POST", "/todos", { title: "A" });
    await makeRequest(server, "POST", "/todos", { title: "B" });
    const { body: created } = await makeRequest(server, "POST", "/todos", { title: "C" });
    await makeRequest(server, "PATCH", `/todos/${created.id}`, { completed: true });

    const { body } = await makeRequest(server, "GET", "/admin/stats");
    assert.strictEqual(body.todos.total, 3);
    assert.strictEqual(body.todos.completed, 1);
    assert.strictEqual(body.todos.pending, 2);
    assert.ok(body.todos.completionRate > 0.33 && body.todos.completionRate < 0.34);
  });

  it("tracks webhook registration count and notification count", async () => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response("ok");

    const store = new TodoStore();
    const wm = new WebhookManager();
    server = createTestServer(store, wm);
    await new Promise((r) => server.listen(0, r));

    await makeRequest(server, "POST", "/webhooks/register", { url: "http://a.com/hook" });
    await makeRequest(server, "POST", "/webhooks/register", { url: "http://b.com/hook" });
    await makeRequest(server, "POST", "/todos", { title: "Trigger" });
    await new Promise((r) => setTimeout(r, 10));

    const { body } = await makeRequest(server, "GET", "/admin/stats");
    assert.strictEqual(body.webhooks.registered, 2);
    assert.strictEqual(body.webhooks.totalNotificationsSent, 2);
  });

  it("tracks import count", async () => {
    const store = new TodoStore();
    const wm = new WebhookManager();
    server = createTestServer(store, wm);
    await new Promise((r) => server.listen(0, r));

    await makeRequest(server, "POST", "/todos/import", { todos: [{ title: "I1" }, { title: "I2" }] });

    const { body } = await makeRequest(server, "GET", "/admin/stats");
    assert.strictEqual(body.importExport.totalImported, 2);
    assert.strictEqual(body.todos.total, 2);
  });

  it("tracks export count", async () => {
    const store = new TodoStore();
    const wm = new WebhookManager();
    server = createTestServer(store, wm);
    await new Promise((r) => server.listen(0, r));

    store.create("E1");
    store.create("E2");
    store.create("E3");

    await makeRequest(server, "GET", "/todos/export?format=json");

    const { body } = await makeRequest(server, "GET", "/admin/stats");
    assert.strictEqual(body.importExport.totalExported, 3);
  });

  it("tracks request count across multiple operations", async () => {
    const store = new TodoStore();
    const wm = new WebhookManager();
    server = createTestServer(store, wm);
    await new Promise((r) => server.listen(0, r));

    await makeRequest(server, "GET", "/health");
    await makeRequest(server, "POST", "/todos", { title: "X" });
    await makeRequest(server, "GET", "/todos");

    const { body } = await makeRequest(server, "GET", "/admin/stats");
    assert.strictEqual(body.server.requestCount, 4);
  });
});
