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

export function parseCSV(csv: string): { titles: string[]; errors: string[] } {
  const titles: string[] = [];
  const errors: string[] = [];
  const lines = csv.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) return { titles, errors };

  const startIndex = lines[0].toLowerCase().startsWith("id,") || lines[0].toLowerCase() === "id,title,completed,createdat" ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    let title = "";
    const line = lines[i];
    const parts = line.split(",");
    if (parts.length >= 2) {
      title = parts[1].replace(/^"|"$/g, "").replace(/""/g, '"').trim();
    }
    if (!title) {
      errors.push(`Row ${i + 1}: empty title`);
    } else {
      titles.push(title);
    }
  }
  return { titles, errors };
}

export function parseImportJSON(body: string): { titles: string[]; errors: string[] } {
  const titles: string[] = [];
  const errors: string[] = [];
  let arr: unknown[];
  try {
    arr = JSON.parse(body);
  } catch {
    return { titles, errors: ["Invalid JSON"] };
  }
  if (!Array.isArray(arr)) {
    return { titles, errors: ["Expected JSON array"] };
  }
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i] as { title?: string };
    const title = typeof item === "object" && item !== null && typeof item.title === "string" ? item.title.trim() : "";
    if (!title) {
      errors.push(`Item ${i}: empty title`);
    } else {
      titles.push(title);
    }
  }
  return { titles, errors };
}
