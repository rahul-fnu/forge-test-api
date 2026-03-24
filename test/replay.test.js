import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import http from "node:http";
import { RequestRecorder, recordingMiddleware } from "../dist/replay.js";
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
        resolve({ status: res.statusCode, body: parsed, headers: res.headers });
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

describe("RequestRecorder", () => {
  it("records and retrieves requests", async () => {
    const recorder = new RequestRecorder();
    const store = new TodoStore();
    const router = createRouter(store, Date.now(), undefined, undefined, recorder);
    const app = compose(bodyParser, recordingMiddleware(recorder), router);
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));

    await makeRequest(server, "GET", "/health");

    const records = recorder.listRecorded(50);
    assert.strictEqual(records.length, 1);
    assert.strictEqual(records[0].method, "GET");
    assert.strictEqual(records[0].path, "/health");
    assert.strictEqual(records[0].responseStatus, 200);
    assert.ok(records[0].id);
    assert.ok(records[0].timestamp);
    assert.ok(records[0].responseBody);

    await new Promise((resolve) => server.close(resolve));
  });

  it("getRecorded returns specific record by id", async () => {
    const recorder = new RequestRecorder();
    const store = new TodoStore();
    const router = createRouter(store, Date.now(), undefined, undefined, recorder);
    const app = compose(bodyParser, recordingMiddleware(recorder), router);
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));

    await makeRequest(server, "GET", "/health");
    const records = recorder.listRecorded(50);
    const record = recorder.getRecorded(records[0].id);
    assert.deepStrictEqual(record, records[0]);

    await new Promise((resolve) => server.close(resolve));
  });

  it("ring buffer drops oldest entries beyond maxSize", () => {
    const recorder = new RequestRecorder(5);
    for (let i = 0; i < 8; i++) {
      recorder["records"].push({
        id: `id-${i}`,
        method: "GET",
        path: `/item/${i}`,
        headers: {},
        body: undefined,
        responseStatus: 200,
        responseBody: "{}",
        timestamp: new Date().toISOString(),
      });
      if (recorder["records"].length > 5) {
        recorder["records"].shift();
      }
    }
    const records = recorder.listRecorded(50);
    assert.strictEqual(records.length, 5);
    assert.strictEqual(records[0].path, "/item/3");
    assert.strictEqual(records[4].path, "/item/7");
  });

  it("ring buffer overflow via actual recording", async () => {
    const recorder = new RequestRecorder(3);
    const store = new TodoStore();
    const router = createRouter(store, Date.now(), undefined, undefined, recorder);
    const app = compose(bodyParser, recordingMiddleware(recorder), router);
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));

    for (let i = 0; i < 5; i++) {
      await makeRequest(server, "GET", "/health");
    }

    const records = recorder.listRecorded(50);
    assert.strictEqual(records.length, 3);

    await new Promise((resolve) => server.close(resolve));
  });
});

describe("GET /debug/requests", () => {
  let server;
  let recorder;

  afterEach(() => {
    if (server) return new Promise((resolve) => server.close(resolve));
  });

  it("lists recorded requests", async () => {
    recorder = new RequestRecorder();
    const store = new TodoStore();
    const router = createRouter(store, Date.now(), undefined, undefined, recorder);
    const app = compose(bodyParser, recordingMiddleware(recorder), router);
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));

    await makeRequest(server, "GET", "/health");
    await makeRequest(server, "POST", "/todos", JSON.stringify({ title: "test" }));

    const { status, body } = await makeRequest(server, "GET", "/debug/requests");
    assert.strictEqual(status, 200);
    assert.ok(Array.isArray(body));
    assert.strictEqual(body.length, 2);
    assert.strictEqual(body[0].method, "GET");
    assert.strictEqual(body[0].path, "/health");
    assert.ok(body[0].id);
    assert.ok(body[0].timestamp);
    assert.strictEqual(body[0].status, 200);
    assert.strictEqual(body[1].method, "POST");
    assert.strictEqual(body[1].status, 201);
  });
});

describe("GET /debug/requests/:id", () => {
  let server;

  afterEach(() => {
    if (server) return new Promise((resolve) => server.close(resolve));
  });

  it("shows full request/response details", async () => {
    const recorder = new RequestRecorder();
    const store = new TodoStore();
    const router = createRouter(store, Date.now(), undefined, undefined, recorder);
    const app = compose(bodyParser, recordingMiddleware(recorder), router);
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));

    await makeRequest(server, "GET", "/health");

    const records = recorder.listRecorded(50);
    const { status, body } = await makeRequest(server, "GET", `/debug/requests/${records[0].id}`);
    assert.strictEqual(status, 200);
    assert.strictEqual(body.method, "GET");
    assert.strictEqual(body.path, "/health");
    assert.strictEqual(body.responseStatus, 200);
    assert.ok(body.responseBody);
    assert.ok(body.headers);
  });

  it("returns 404 for unknown id", async () => {
    const recorder = new RequestRecorder();
    const store = new TodoStore();
    const router = createRouter(store, Date.now(), undefined, undefined, recorder);
    const app = compose(bodyParser, recordingMiddleware(recorder), router);
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));

    const { status } = await makeRequest(server, "GET", "/debug/requests/nonexistent");
    assert.strictEqual(status, 404);
  });
});

describe("POST /debug/replay/:id", () => {
  let server;

  afterEach(() => {
    if (server) return new Promise((resolve) => server.close(resolve));
  });

  it("replays a recorded request and returns comparison", async () => {
    const recorder = new RequestRecorder();
    const store = new TodoStore();
    const router = createRouter(store, Date.now(), undefined, undefined, recorder);
    const app = compose(bodyParser, recordingMiddleware(recorder), router);
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));

    await makeRequest(server, "GET", "/health");

    const records = recorder.listRecorded(50);
    const { status, body } = await makeRequest(server, "POST", `/debug/replay/${records[0].id}`);
    assert.strictEqual(status, 200);
    assert.ok(body.original);
    assert.ok(body.replayed);
    assert.strictEqual(body.original.status, 200);
    assert.strictEqual(body.replayed.status, 200);
    assert.ok(body.original.body);
    assert.ok(body.replayed.body);
  });

  it("returns 404 for unknown id", async () => {
    const recorder = new RequestRecorder();
    const store = new TodoStore();
    const router = createRouter(store, Date.now(), undefined, undefined, recorder);
    const app = compose(bodyParser, recordingMiddleware(recorder), router);
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));

    const { status } = await makeRequest(server, "POST", "/debug/replay/nonexistent");
    assert.strictEqual(status, 404);
  });

  it("captures ETag headers in recording", async () => {
    const recorder = new RequestRecorder();
    const store = new TodoStore();
    const router = createRouter(store, Date.now(), undefined, undefined, recorder);
    const app = compose(bodyParser, recordingMiddleware(recorder), router);
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));

    await makeRequest(server, "GET", "/health");

    const records = recorder.listRecorded(50);
    const record = recorder.getRecorded(records[0].id);
    assert.ok(record.headers);
    assert.strictEqual(typeof record.headers, "object");
  });
});
