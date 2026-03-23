import { Todo } from "./types.js";

export type { Todo };

export class TodoStore {
  private todos: Map<string, Todo> = new Map();
  private nextId = 1;

  create(title: string, dueDate?: string): Todo {
    const id = String(this.nextId++);
    const todo: Todo = {
      id,
      title,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    if (dueDate !== undefined) todo.dueDate = dueDate;
    this.todos.set(id, todo);
    return todo;
  }

  getAll(): Todo[] {
    return [...this.todos.values()];
  }

  getOverdue(): Todo[] {
    const now = new Date();
    return [...this.todos.values()].filter(
      (t) => t.dueDate && !t.completed && new Date(t.dueDate) < now
    );
  }

  getById(id: string): Todo | undefined {
    return this.todos.get(id);
  }

  update(id: string, updates: Partial<Pick<Todo, "title" | "completed" | "dueDate">>): Todo | undefined {
    const todo = this.todos.get(id);
    if (!todo) return undefined;
    if (updates.title !== undefined) todo.title = updates.title;
    if (updates.completed !== undefined) todo.completed = updates.completed;
    if (updates.dueDate !== undefined) todo.dueDate = updates.dueDate;
    return todo;
  }

  replace(id: string, title: string, completed: boolean = false): Todo | undefined {
    const todo = this.todos.get(id);
    if (!todo) return undefined;
    todo.title = title;
    todo.completed = completed;
    return todo;
  }

  delete(id: string): boolean {
    return this.todos.delete(id);
  }
}
