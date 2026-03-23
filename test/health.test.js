import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import http from "node:http";
import { createRouter } from "../dist/router.js";

function makeRequest(server, path) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    http.get(`http://localhost:${port}${path}`, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    }).on("error", reject);
  });
}

describe("GET /health", () => {
  let server;

  afterEach(() => {
    if (server) return new Promise((resolve) => server.close(resolve));
  });

  it("returns status ok with uptime, version, and timestamp", async () => {
    const startTime = Date.now();
    const handler = createRouter({ getAll: () => [] }, startTime);
    server = http.createServer((req, res) => {
      req.body = "";
      handler(req, res, () => {});
    });
    await new Promise((resolve) => server.listen(0, resolve));

    const { status, body } = await makeRequest(server, "/health");
    assert.strictEqual(status, 200);
    assert.strictEqual(body.status, "ok");
    assert.strictEqual(body.version, "1.0.0");
    assert.strictEqual(typeof body.uptime, "number");
    assert.ok(body.uptime >= 0);
    assert.ok(body.timestamp);
    assert.ok(!isNaN(Date.parse(body.timestamp)));
  });
});
