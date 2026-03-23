export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
}

export class TodoStore {
  private todos: Map<string, Todo> = new Map();
  private nextId = 1;

  create(title: string): Todo {
    const id = String(this.nextId++);
    const todo: Todo = {
      id,
      title,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    this.todos.set(id, todo);
    return todo;
  }

  getAll(): Todo[] {
    return [...this.todos.values()];
  }

  getById(id: string): Todo | undefined {
    return this.todos.get(id);
  }

  update(id: string, updates: Partial<Pick<Todo, "title" | "completed">>): Todo | undefined {
    const todo = this.todos.get(id);
    if (!todo) return undefined;
    if (updates.title !== undefined) todo.title = updates.title;
    if (updates.completed !== undefined) todo.completed = updates.completed;
    return todo;
  }

  delete(id: string): boolean {
    return this.todos.delete(id);
  }

  stats(): { total: number; completed: number; pending: number; completionRate: number } {
    const total = this.todos.size;
    const completed = [...this.todos.values()].filter((t) => t.completed).length;
    const pending = total - completed;
    const completionRate = total === 0 ? 0 : Math.round((completed / total) * 10000) / 100;
    return { total, completed, pending, completionRate };
  }
}
