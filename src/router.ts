import { ServerResponse } from "node:http";
import { TodoStore } from "./store.js";
import { Middleware, MidRequest } from "./middleware.js";
import { WebhookManager } from "./webhooks.js";
import { todosToCSV, todosToJSON } from "./export.js";

function json(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

export interface AdminStats {
  todos: { total: number; completed: number; pending: number; completionRate: number };
  webhooks: { registered: number; totalNotificationsSent: number };
  importExport: { totalImported: number; totalExported: number };
  server: { uptime: number; requestCount: number };
}

export function createRouter(
  store: TodoStore,
  startTime: number = Date.now(),
  webhookManager?: WebhookManager,
  counters?: { requestCount: number; importCount: number; exportCount: number }
): Middleware {
  const stats = counters ?? { requestCount: 0, importCount: 0, exportCount: 0 };

  return (req: MidRequest, res: ServerResponse, _next) => {
    stats.requestCount++;
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const path = url.pathname;

    if (path === "/health" && req.method === "GET") {
      json(res, 200, {
        status: "ok",
        uptime: Math.floor((Date.now() - startTime) / 1000),
        version: "1.0.0",
        timestamp: new Date().toISOString(),
      });
    } else if (path === "/admin/stats" && req.method === "GET") {
      const todos = store.getAll();
      const completed = todos.filter((t) => t.completed).length;
      const total = todos.length;
      const result: AdminStats = {
        todos: {
          total,
          completed,
          pending: total - completed,
          completionRate: total === 0 ? 0 : Math.round((completed / total) * 10000) / 10000,
        },
        webhooks: {
          registered: webhookManager ? webhookManager.registeredUrls.length : 0,
          totalNotificationsSent: webhookManager ? webhookManager.notificationCount : 0,
        },
        importExport: {
          totalImported: stats.importCount,
          totalExported: stats.exportCount,
        },
        server: {
          uptime: Math.floor((Date.now() - startTime) / 1000),
          requestCount: stats.requestCount,
        },
      };
      json(res, 200, result);
    } else if (path === "/todos/export" && req.method === "GET") {
      const format = url.searchParams.get("format") ?? "json";
      const todos = store.getAll();
      stats.exportCount += todos.length;
      if (format === "csv") {
        res.writeHead(200, {
          "Content-Type": "text/csv",
          "Content-Disposition": 'attachment; filename="todos.csv"',
        });
        res.end(todosToCSV(todos));
      } else if (format === "json") {
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Content-Disposition": 'attachment; filename="todos.json"',
        });
        res.end(todosToJSON(todos));
      } else {
        json(res, 400, { error: "unknown format" });
      }
    } else if (path === "/todos/import" && req.method === "POST") {
      const parsed = JSON.parse(req.body ?? "{}");
      const todos = parsed.todos;
      if (!Array.isArray(todos) || todos.length === 0) {
        json(res, 400, { error: "todos array is required and must not be empty" });
        return;
      }
      const created = todos.map((t: { title?: string; completed?: boolean }) => {
        const todo = store.create(t.title ?? "Untitled");
        if (t.completed) store.update(todo.id, { completed: true });
        return store.getById(todo.id)!;
      });
      stats.importCount += created.length;
      if (webhookManager) webhookManager.notify("todo.bulk_created", created);
      json(res, 201, created);
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
      const created = store.bulkCreate(titles);
      if (webhookManager) webhookManager.notify("todo.bulk_created", created);
      json(res, 201, created);
    } else if (path === "/todos/bulk" && req.method === "DELETE") {
      const { ids } = JSON.parse(req.body ?? "{}");
      if (!Array.isArray(ids) || ids.length === 0) {
        json(res, 400, { error: "ids array is required and must not be empty" });
        return;
      }
      const result = store.bulkDelete(ids);
      if (webhookManager) webhookManager.notify("todo.bulk_deleted", result);
      json(res, 200, result);
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
    } else if (path === "/webhooks/register" && req.method === "POST") {
      const { url: hookUrl } = JSON.parse(req.body ?? "{}");
      if (!hookUrl) {
        json(res, 400, { error: "url is required" });
        return;
      }
      if (webhookManager) webhookManager.register(hookUrl);
      json(res, 201, { registered: true, url: hookUrl });
    } else if (path === "/webhooks/unregister" && req.method === "DELETE") {
      const { url: hookUrl } = JSON.parse(req.body ?? "{}");
      if (!hookUrl) {
        json(res, 400, { error: "url is required" });
        return;
      }
      const removed = webhookManager ? webhookManager.unregister(hookUrl) : false;
      if (!removed) {
        json(res, 404, { error: "webhook not found" });
        return;
      }
      json(res, 200, { unregistered: true, url: hookUrl });
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
      if (webhookManager) webhookManager.notify("todo.updated", todo);
      json(res, 200, todo);
    } else if (path.startsWith("/todos/") && req.method === "DELETE") {
      const id = path.split("/")[2];
      if (!store.delete(id)) {
        json(res, 404, { error: "not found" });
        return;
      }
      if (webhookManager) webhookManager.notify("todo.deleted", { id });
      json(res, 204, null);
    } else {
      json(res, 404, { error: "not found" });
    }
  };
}
