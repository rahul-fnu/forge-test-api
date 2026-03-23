import { Todo } from "./types.js";

export function todosToCSV(todos: Todo[]): string {
  const header = "id,title,completed,createdAt";
  const rows = todos.map(
    (t) =>
      `${t.id},${t.title.includes(",") || t.title.includes('"') ? '"' + t.title.replace(/"/g, '""') + '"' : t.title},${t.completed},${t.createdAt}`
  );
  return [header, ...rows].join("\n");
}

export function todosToJSON(todos: Todo[]): string {
  return JSON.stringify(todos);
}
