import { ServerResponse } from "node:http";
import { TodoStore } from "./store.js";
import { Middleware, MidRequest } from "./middleware.js";

function json(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

export function createRouter(store: TodoStore, startTime: number = Date.now()): Middleware {
  return (req: MidRequest, res: ServerResponse, _next) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const path = url.pathname;

    if (path === "/health" && req.method === "GET") {
      json(res, 200, {
        status: "ok",
        uptime: Math.floor((Date.now() - startTime) / 1000),
        version: "1.0.0",
        timestamp: new Date().toISOString(),
      });
    } else if (path === "/todos" && req.method === "GET") {
      if (url.searchParams.get("overdue") === "true") {
        json(res, 200, store.getOverdue());
        return;
      }
      json(res, 200, store.getAll());
    } else if (path === "/todos" && req.method === "POST") {
      const { title, dueDate } = JSON.parse(req.body ?? "{}");
      if (!title) {
        json(res, 400, { error: "title is required" });
        return;
      }
      json(res, 201, store.create(title, dueDate));
    } else if (path.startsWith("/todos/") && req.method === "GET") {
      const id = path.split("/")[2];
      const todo = store.getById(id);
      if (!todo) {
        json(res, 404, { error: "not found" });
        return;
      }
      json(res, 200, todo);
    } else if (path.startsWith("/todos/") && req.method === "PATCH") {
      const id = path.split("/")[2];
      const updates = JSON.parse(req.body ?? "{}");
      const todo = store.update(id, updates);
      if (!todo) {
        json(res, 404, { error: "not found" });
        return;
      }
      json(res, 200, todo);
    } else if (path.startsWith("/todos/") && req.method === "PUT") {
      const id = path.split("/")[2];
      const { title, completed } = JSON.parse(req.body ?? "{}");
      if (!title) {
        json(res, 400, { error: "title is required" });
        return;
      }
      const todo = store.replace(id, title, completed ?? false);
      if (!todo) {
        json(res, 404, { error: "not found" });
        return;
      }
      json(res, 200, todo);
    } else if (path.startsWith("/todos/") && req.method === "DELETE") {
      const id = path.split("/")[2];
      if (!store.delete(id)) {
        json(res, 404, { error: "not found" });
        return;
      }
      json(res, 204, null);
    } else {
      json(res, 404, { error: "not found" });
    }
  };
}
