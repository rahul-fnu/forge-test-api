import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert";
import http from "node:http";
import { WebhookManager } from "../dist/webhooks.js";
import { createRouter } from "../dist/router.js";
import { TodoStore } from "../dist/store.js";

function makeRequest(server, method, path, body) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const jsonBody = body ? JSON.stringify(body) : null;
    const headers = { "Content-Type": "application/json" };
    if (jsonBody) headers["Content-Length"] = Buffer.byteLength(jsonBody);
    const options = {
      hostname: "localhost",
      port,
      path,
      method,
      headers,
    };
    const req = http.request(options, (res) => {
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

describe("WebhookManager", () => {
  it("registers and unregisters URLs", () => {
    const wm = new WebhookManager();
    wm.register("http://example.com/hook");
    assert.deepStrictEqual(wm.registeredUrls, ["http://example.com/hook"]);
    assert.strictEqual(wm.unregister("http://example.com/hook"), true);
    assert.deepStrictEqual(wm.registeredUrls, []);
  });

  it("unregister returns false for unknown URL", () => {
    const wm = new WebhookManager();
    assert.strictEqual(wm.unregister("http://unknown.com"), false);
  });

  it("notify calls fetch for each registered URL", async () => {
    const wm = new WebhookManager();
    const calls = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      calls.push({ url, opts });
      return new Response("ok");
    };
    try {
      wm.register("http://a.com/hook");
      wm.register("http://b.com/hook");
      wm.notify("todo.created", { id: "1" });
      await new Promise((r) => setTimeout(r, 10));
      assert.strictEqual(calls.length, 2);
      const body0 = JSON.parse(calls[0].opts.body);
      assert.strictEqual(body0.event, "todo.created");
      assert.deepStrictEqual(body0.data, { id: "1" });
      assert.ok(body0.timestamp);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("notify swallows fetch errors", () => {
    const wm = new WebhookManager();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => { throw new Error("network error"); };
    try {
      wm.register("http://fail.com");
      assert.doesNotThrow(() => wm.notify("todo.deleted", {}));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("Webhook routes", () => {
  let server;

  afterEach(() => {
    if (server) return new Promise((resolve) => server.close(resolve));
  });

  it("POST /webhooks/register registers a webhook", async () => {
    const store = new TodoStore();
    const wm = new WebhookManager();
    server = createTestServer(store, wm);
    await new Promise((resolve) => server.listen(0, resolve));

    const { status, body } = await makeRequest(server, "POST", "/webhooks/register", { url: "http://test.com/hook" });
    assert.strictEqual(status, 201);
    assert.strictEqual(body.registered, true);
    assert.deepStrictEqual(wm.registeredUrls, ["http://test.com/hook"]);
  });

  it("POST /webhooks/register returns 400 without url", async () => {
    const store = new TodoStore();
    const wm = new WebhookManager();
    server = createTestServer(store, wm);
    await new Promise((resolve) => server.listen(0, resolve));

    const { status } = await makeRequest(server, "POST", "/webhooks/register", {});
    assert.strictEqual(status, 400);
  });

  it("DELETE /webhooks/unregister removes a webhook", async () => {
    const store = new TodoStore();
    const wm = new WebhookManager();
    wm.register("http://test.com/hook");
    server = createTestServer(store, wm);
    await new Promise((resolve) => server.listen(0, resolve));

    const { status, body } = await makeRequest(server, "DELETE", "/webhooks/unregister", { url: "http://test.com/hook" });
    assert.strictEqual(status, 200);
    assert.strictEqual(body.unregistered, true);
    assert.deepStrictEqual(wm.registeredUrls, []);
  });

  it("DELETE /webhooks/unregister returns 404 for unknown url", async () => {
    const store = new TodoStore();
    const wm = new WebhookManager();
    server = createTestServer(store, wm);
    await new Promise((resolve) => server.listen(0, resolve));

    const { status } = await makeRequest(server, "DELETE", "/webhooks/unregister", { url: "http://unknown.com" });
    assert.strictEqual(status, 404);
  });
});

describe("Webhook notifications on CRUD", () => {
  let server;
  let fetchCalls;
  let originalFetch;

  beforeEach(() => {
    fetchCalls = [];
    originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      fetchCalls.push({ url, body: JSON.parse(opts.body) });
      return new Response("ok");
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (server) return new Promise((resolve) => server.close(resolve));
  });

  it("notifies on todo create", async () => {
    const store = new TodoStore();
    const wm = new WebhookManager();
    wm.register("http://hook.test/cb");
    server = createTestServer(store, wm);
    await new Promise((resolve) => server.listen(0, resolve));

    await makeRequest(server, "POST", "/todos", { title: "Test" });
    await new Promise((r) => setTimeout(r, 10));
    assert.strictEqual(fetchCalls.length, 1);
    assert.strictEqual(fetchCalls[0].body.event, "todo.created");
    assert.strictEqual(fetchCalls[0].body.data.title, "Test");
  });

  it("notifies on todo delete", async () => {
    const store = new TodoStore();
    const wm = new WebhookManager();
    wm.register("http://hook.test/cb");
    server = createTestServer(store, wm);
    await new Promise((resolve) => server.listen(0, resolve));

    const { body: created } = await makeRequest(server, "POST", "/todos", { title: "Del me" });
    fetchCalls = [];
    await makeRequest(server, "DELETE", `/todos/${created.id}`, null);
    await new Promise((r) => setTimeout(r, 10));
    assert.strictEqual(fetchCalls.length, 1);
    assert.strictEqual(fetchCalls[0].body.event, "todo.deleted");
    assert.strictEqual(fetchCalls[0].body.data.id, created.id);
  });

  it("notifies on todo update (PATCH)", async () => {
    const store = new TodoStore();
    const wm = new WebhookManager();
    wm.register("http://hook.test/cb");
    server = createTestServer(store, wm);
    await new Promise((resolve) => server.listen(0, resolve));

    const { body: created } = await makeRequest(server, "POST", "/todos", { title: "Upd me" });
    fetchCalls = [];
    await makeRequest(server, "PATCH", `/todos/${created.id}`, { completed: true });
    await new Promise((r) => setTimeout(r, 10));
    assert.strictEqual(fetchCalls.length, 1);
    assert.strictEqual(fetchCalls[0].body.event, "todo.updated");
    assert.strictEqual(fetchCalls[0].body.data.completed, true);
  });
});
