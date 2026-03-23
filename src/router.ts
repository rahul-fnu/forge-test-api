import { ServerResponse } from "node:http";
import { TodoStore } from "./store.js";
import { Middleware, MidRequest } from "./middleware.js";
import { parseCSV, parseImportJSON } from "./export.js";
import { todosToCSV, todosToJSON } from "./export.js";
import { WebhookManager } from "./webhooks.js";

function json(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

export function createRouter(store: TodoStore, startTime: number = Date.now(), webhookManager?: WebhookManager): Middleware {
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
      const todo = store.create(title, dueDate);
      if (webhookManager) webhookManager.notify("todo.created", todo);
      json(res, 201, todo);
    } else if (path === "/todos/bulk" && req.method === "POST") {
      const { todos } = JSON.parse(req.body ?? "{}");
      if (!Array.isArray(todos) || todos.length === 0) {
        json(res, 400, { error: "todos array is required and must not be empty" });
        return;
      }
      const titles = todos.map((t: { title?: string }) => t.title).filter(Boolean) as string[];
      if (titles.length === 0) {
        json(res, 400, { error: "todos array is required and must not be empty" });
        return;
      }
      json(res, 201, store.bulkCreate(titles));
    } else if (path === "/todos/bulk" && req.method === "DELETE") {
      const { ids } = JSON.parse(req.body ?? "{}");
      if (!Array.isArray(ids) || ids.length === 0) {
        json(res, 400, { error: "ids array is required and must not be empty" });
        return;
      }
      json(res, 200, store.bulkDelete(ids));
    } else if (path === "/todos/export" && req.method === "GET") {
      const format = url.searchParams.get("format") ?? "json";
      if (format === "csv") {
        res.writeHead(200, { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="todos.csv"' });
        res.end(todosToCSV(store.getAll()));
      } else if (format === "json") {
        res.writeHead(200, { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="todos.json"' });
        res.end(todosToJSON(store.getAll()));
      } else {
        json(res, 400, { error: "unknown format" });
      }
    } else if (path === "/todos/import" && req.method === "POST") {
      const contentType = (req.headers["content-type"] ?? "").toLowerCase();
      let titles: string[];
      let errors: string[];
      if (contentType.includes("text/csv")) {
        ({ titles, errors } = parseCSV(req.body ?? ""));
      } else {
        ({ titles, errors } = parseImportJSON(req.body ?? "[]"));
      }
      if (titles.length > 0) {
        store.bulkCreate(titles);
      }
      json(res, 200, { imported: titles.length, errors });
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
      if (webhookManager) webhookManager.notify("todo.updated", todo);
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
      if (webhookManager) webhookManager.notify("todo.deleted", { id });
      json(res, 204, null);
    } else if (path === "/webhooks/register" && req.method === "POST") {
      const { url: hookUrl } = JSON.parse(req.body ?? "{}");
      if (!hookUrl) {
        json(res, 400, { error: "url is required" });
        return;
      }
      webhookManager?.register(hookUrl);
      json(res, 201, { registered: true });
    } else if (path === "/webhooks/unregister" && req.method === "DELETE") {
      const { url: hookUrl } = JSON.parse(req.body ?? "{}");
      if (!webhookManager?.unregister(hookUrl)) {
        json(res, 404, { error: "not found" });
        return;
      }
      json(res, 200, { unregistered: true });
    } else {
      json(res, 404, { error: "not found" });
    }
  };
}
