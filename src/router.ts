import { IncomingMessage, ServerResponse } from "node:http";
import { TodoStore } from "./store.js";

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
  });
}

function json(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

export function router(req: IncomingMessage, res: ServerResponse, store: TodoStore): void {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const path = url.pathname;

  if (path === "/todos" && req.method === "GET") {
    const completedParam = url.searchParams.get("completed");
    const completed = completedParam === "true" ? true : completedParam === "false" ? false : undefined;
    json(res, 200, store.getAll(completed));
  } else if (path === "/todos" && req.method === "POST") {
    readBody(req).then((body) => {
      const { title } = JSON.parse(body);
      if (!title) {
        json(res, 400, { error: "title is required" });
        return;
      }
      json(res, 201, store.create(title));
    });
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
    readBody(req).then((body) => {
      const updates = JSON.parse(body);
      const todo = store.update(id, updates);
      if (!todo) {
        json(res, 404, { error: "not found" });
        return;
      }
      json(res, 200, todo);
    });
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
}
