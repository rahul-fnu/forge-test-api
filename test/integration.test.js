import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { createServer } from "node:http";
import { TodoStore } from "../dist/store.js";
import { createRouter } from "../dist/router.js";
import {
  compose,
  requestId,
  timing,
  errorHandler,
  bodyParser,
} from "../dist/middleware.js";
import { authMiddleware } from "../dist/auth.js";
import { TodoApiClient } from "../dist/api-client.js";

function startServer(app) {
  const server = createServer(app);
  return new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port;
      resolve({ server, port, baseUrl: `http://localhost:${port}` });
    });
  });
}

function stopServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

describe("Integration: TodoApiClient against real server", () => {
  let server;
  let client;

  before(async () => {
    const store = new TodoStore();
    const app = compose(
      requestId,
      timing,
      errorHandler,
      bodyParser,
      createRouter(store)
    );
    const info = await startServer(app);
    server = info.server;
    client = new TodoApiClient(info.baseUrl, "test-key-123");
  });

  after(async () => {
    if (server) await stopServer(server);
  });

  it("a. Create 3 todos", async () => {
    const r1 = await client.createTodo("Todo 1");
    const r2 = await client.createTodo("Todo 2");
    const r3 = await client.createTodo("Todo 3");
    assert.strictEqual(r1.data.title, "Todo 1");
    assert.strictEqual(r2.data.title, "Todo 2");
    assert.strictEqual(r3.data.title, "Todo 3");
    assert.strictEqual(r1.data.completed, false);
  });

  it("b. List all todos (verify 3)", async () => {
    const result = await client.listTodos();
    assert.strictEqual(result.data.length, 3);
  });

  it("c. Update one to completed", async () => {
    const list = await client.listTodos();
    const id = list.data[0].id;
    const result = await client.updateTodo(id, { completed: true });
    assert.strictEqual(result.data.completed, true);
    assert.strictEqual(result.data.id, id);
  });

  it("d. List with ?overdue=true (verify filtering works)", async () => {
    const result = await client.listTodos({ overdue: true });
    assert.ok(Array.isArray(result.data));
    assert.strictEqual(result.data.length, 0);
  });

  it("e. Delete one", async () => {
    const list = await client.listTodos();
    const id = list.data[0].id;
    const result = await client.deleteTodo(id);
    assert.strictEqual(result.data, undefined);
  });

  it("f. Verify 404 on deleted todo", async () => {
    const list = await client.listTodos();
    assert.strictEqual(list.data.length, 2);
    const deletedId = "999";
    await assert.rejects(() => client.deleteTodo(deletedId), /API error 404/);
  });

  it("h. Test pagination params", async () => {
    const result = await client.listTodos({ page: 1, pageSize: 1 });
    assert.ok(Array.isArray(result.data));
  });
});

describe("Integration: Auth", () => {
  let server;

  before(async () => {
    const store = new TodoStore();
    const app = compose(
      requestId,
      timing,
      errorHandler,
      authMiddleware,
      bodyParser,
      createRouter(store)
    );
    const info = await startServer(app);
    server = info.server;
  });

  after(async () => {
    if (server) await stopServer(server);
  });

  it("g. Request without API key gets 401", async () => {
    const port = server.address().port;
    const noAuthClient = new TodoApiClient(
      `http://localhost:${port}`,
      ""
    );
    await assert.rejects(
      () => noAuthClient.listTodos(),
      /API error 401/
    );
  });
});
