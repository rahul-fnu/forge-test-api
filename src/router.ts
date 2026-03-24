import http, { ServerResponse } from "node:http";
import { TodoStore } from "./store.js";
import { Middleware, MidRequest } from "./middleware.js";
import { parseCSV, parseImportJSON } from "./export.js";
import { todosToCSV, todosToJSON } from "./export.js";
import { WebhookManager } from "./webhooks.js";
import { RequestLogger } from "./logger.js";
import { RequestRecorder } from "./replay.js";
import { generateETag, checkConditional } from "./etag.js";

function json(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

export function createRouter(store: TodoStore, startTime: number = Date.now(), webhookManager?: WebhookManager, logger?: RequestLogger, recorder?: RequestRecorder): Middleware {
  let requestCount = 0;
  let totalImported = 0;
  let totalExported = 0;

  return (req: MidRequest, res: ServerResponse, _next) => {
    requestCount++;
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
      const data = url.searchParams.get("overdue") === "true" ? store.getOverdue() : store.getAll();
      const etag = generateETag(data);
      if (checkConditional(req, etag)) {
        res.writeHead(304);
        res.end();
        return;
      }
      res.setHeader("ETag", etag);
      json(res, 200, data);
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
      const allTodos = store.getAll();
      totalExported += allTodos.length;
      if (format === "csv") {
        res.writeHead(200, { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="todos.csv"' });
        res.end(todosToCSV(allTodos));
      } else if (format === "json") {
        res.writeHead(200, { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="todos.json"' });
        res.end(todosToJSON(allTodos));
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
        let importBody = req.body ?? "[]";
        try {
          const parsed = JSON.parse(importBody);
          if (!Array.isArray(parsed) && parsed && Array.isArray(parsed.todos)) {
            importBody = JSON.stringify(parsed.todos);
          }
        } catch {}
        ({ titles, errors } = parseImportJSON(importBody));
      }
      if (titles.length > 0) {
        store.bulkCreate(titles);
        totalImported += titles.length;
      }
      json(res, 200, { imported: titles.length, errors });
    } else if (path.startsWith("/todos/") && req.method === "GET") {
      const id = path.split("/")[2];
      const todo = store.getById(id);
      if (!todo) {
        json(res, 404, { error: "not found" });
        return;
      }
      const etag = generateETag(todo);
      if (checkConditional(req, etag)) {
        res.writeHead(304);
        res.end();
        return;
      }
      res.setHeader("ETag", etag);
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
    } else if (path === "/admin/logs" && req.method === "GET") {
      const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
      json(res, 200, logger ? logger.getRecent(limit) : []);
    } else if (path === "/admin/stats" && req.method === "GET") {
      const allTodos = store.getAll();
      const completed = allTodos.filter((t) => t.completed).length;
      const total = allTodos.length;
      json(res, 200, {
        todos: {
          total,
          completed,
          pending: total - completed,
          completionRate: total > 0 ? completed / total : 0,
        },
        webhooks: {
          registered: webhookManager ? webhookManager.registeredUrls.length : 0,
          totalNotificationsSent: webhookManager ? webhookManager.notificationCount : 0,
        },
        importExport: {
          totalImported,
          totalExported,
        },
        server: {
          uptime: Math.floor((Date.now() - startTime) / 1000),
          requestCount,
        },
      });
    } else if (path === "/debug/requests" && req.method === "GET") {
      const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
      const records = recorder ? recorder.listRecorded(limit) : [];
      const mapped = records.map((r) => ({
        id: r.id,
        method: r.method,
        path: r.path,
        status: r.responseStatus,
        timestamp: r.timestamp,
      }));
      json(res, 200, mapped);
    } else if (path.startsWith("/debug/requests/") && req.method === "GET") {
      const id = path.split("/")[3];
      const record = recorder?.getRecorded(id);
      if (!record) {
        json(res, 404, { error: "not found" });
        return;
      }
      json(res, 200, record);
    } else if (path.startsWith("/debug/replay/") && req.method === "POST") {
      const id = path.split("/")[3];
      const record = recorder?.getRecorded(id);
      if (!record) {
        json(res, 404, { error: "not found" });
        return;
      }
      const localPort = (req.socket.localPort ?? 3000);
      const options = {
        hostname: "localhost",
        port: localPort,
        path: record.path,
        method: record.method,
        headers: record.headers as Record<string, string>,
      };
      const proxyReq = http.request(options, (proxyRes) => {
        let data = "";
        proxyRes.on("data", (chunk: Buffer) => (data += chunk));
        proxyRes.on("end", () => {
          json(res, 200, {
            original: { status: record.responseStatus, body: record.responseBody },
            replayed: { status: proxyRes.statusCode, body: data },
          });
        });
      });
      proxyReq.on("error", (err) => {
        json(res, 500, { error: err.message });
      });
      if (record.body) proxyReq.write(record.body);
      proxyReq.end();
    } else {
      json(res, 404, { error: "not found" });
    }
  };
}
